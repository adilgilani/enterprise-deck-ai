"""Export jobs: PPTX (editable), PDF (vector) for presentations; PDF for proposals and meeting notes.

Results are written to storage; GET /api/v1/jobs/{id}/download streams them to the user.
"""

import re
import uuid
from typing import Any

from sqlalchemy import select

from app.models import ActionItem, Asset, Meeting, MeetingParticipant, Organization, Presentation, Proposal
from app.services import brand as brand_svc
from app.services.jobs import JobContext, handler
from app.services.storage import get_storage, make_key

PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


def _filename(title: str, ext: str) -> str:
    base = re.sub(r"[^A-Za-z0-9 _-]+", "", title).strip().replace(" ", "-")[:80] or "export"
    return f"{base}.{ext}"


async def _images(ctx: JobContext, org_id: uuid.UUID, deck: dict[str, Any]) -> dict[str, bytes]:
    ids = {
        e.get("asset_id")
        for s in deck.get("slides", [])
        for e in s.get("elements", [])
        if e.get("type") == "image" and e.get("asset_id")
    }
    out: dict[str, bytes] = {}
    logo_id = (deck.get("theme") or {}).get("logo_asset_id")
    if logo_id:
        try:
            logo = await ctx.session.get(Asset, uuid.UUID(str(logo_id)))
        except ValueError:
            logo = None
        if logo and logo.organization_id == org_id and logo.mime_type in ("image/png", "image/jpeg", "image/gif"):
            out["__logo__"] = await get_storage().get(logo.storage_key)
    for aid in ids:
        try:
            asset = await ctx.session.get(Asset, uuid.UUID(aid))
        except (ValueError, TypeError):
            continue
        if asset and asset.organization_id == org_id and asset.mime_type in ("image/png", "image/jpeg", "image/gif"):
            out[aid] = await get_storage().get(asset.storage_key)
    return out


async def _store(ctx: JobContext, data: bytes, filename: str, mime: str) -> dict[str, Any]:
    key = make_key(ctx.job.organization_id, "exports", filename)
    await get_storage().put(key, data, mime)
    return {"storage_key": key, "filename": filename, "content_type": mime, "size_bytes": len(data)}


@handler("export.presentation")
async def export_presentation(ctx: JobContext) -> dict[str, Any]:
    from app.services.export.pdf_export import build_slides_pdf
    from app.services.export.pptx_export import build_pptx
    from app.services.presentations import deck_dict

    pl = ctx.job.payload
    p = await ctx.session.get(Presentation, uuid.UUID(pl["presentation_id"]))
    if p is None or p.organization_id != ctx.job.organization_id:
        raise ValueError("presentation not found")
    await ctx.progress(20, "Collecting slides & brand assets")
    deck = await deck_dict(ctx.session, p)
    images = await _images(ctx, p.organization_id, deck)
    fmt = pl.get("format", "pptx")
    await ctx.progress(55, f"Rendering {fmt.upper()}")
    if fmt == "pdf":
        data = build_slides_pdf(deck, images)
        return await _store(ctx, data, _filename(p.title, "pdf"), "application/pdf")
    data = build_pptx(deck, images, include_notes=pl.get("include_notes", True))
    return await _store(ctx, data, _filename(p.title, "pptx"), PPTX_MIME)


@handler("export.proposal")
async def export_proposal(ctx: JobContext) -> dict[str, Any]:
    from app.services.export.pdf_export import build_proposal_pdf

    p = await ctx.session.get(Proposal, uuid.UUID(ctx.job.payload["proposal_id"]))
    if p is None or p.organization_id != ctx.job.organization_id:
        raise ValueError("proposal not found")
    org = await ctx.session.get(Organization, p.organization_id)
    await ctx.progress(40, "Typesetting proposal")
    schema = dict(p.schema or {})
    if not schema.get("theme"):
        schema["theme"] = await brand_svc.theme_for(ctx.session, await brand_svc.get_brand(ctx.session, p.organization_id))
    data = build_proposal_pdf(p.title, p.client, schema, org.name if org else "")
    return await _store(ctx, data, _filename(f"{p.client} {p.title}", "pdf"), "application/pdf")


@handler("export.meeting_notes")
async def export_meeting(ctx: JobContext) -> dict[str, Any]:
    from app.services.export.pdf_export import build_meeting_notes_pdf
    from app.services.meetings import duration

    m = await ctx.session.get(Meeting, uuid.UUID(ctx.job.payload["meeting_id"]))
    if m is None or m.organization_id != ctx.job.organization_id:
        raise ValueError("meeting not found")
    org = await ctx.session.get(Organization, m.organization_id)
    brand = await brand_svc.get_brand(ctx.session, m.organization_id)
    theme = await brand_svc.theme_for(ctx.session, brand)
    participants = [p.name for p in (await ctx.session.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id))).scalars()]
    actions = [
        {"title": a.title, "owner": a.owner, "deadline": a.deadline.isoformat() if a.deadline else a.deadline_text, "status": a.status}
        for a in (await ctx.session.execute(select(ActionItem).where(ActionItem.meeting_id == m.id))).scalars()
    ]
    secs = duration(m) or 0
    await ctx.progress(50, "Typesetting meeting notes")
    data = build_meeting_notes_pdf(
        {
            "title": m.title,
            "date": (m.started_at or m.created_at).strftime("%B %d, %Y"),
            "duration": f"{secs // 3600:d}h {secs % 3600 // 60:02d}m" if secs >= 3600 else f"{secs // 60} min",
            "participants": participants,
            "intelligence": m.intelligence or {},
            "action_items": actions,
        },
        theme,
        org.name if org else "",
    )
    return await _store(ctx, data, _filename(f"{m.title} notes", "pdf"), "application/pdf")
