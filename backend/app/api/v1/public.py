"""Secure share links (no workspace login for external links).

Checks, in order: link exists & not revoked → not expired → internal links require a member of the same
workspace → password (header X-Share-Password) → view-only payload. Downloads only when allowed.
"""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import Response
from sqlalchemy import select

from app.api.deps import DB, audit, get_ctx, rate_limit
from app.core.security import verify_password
from app.db.base import utcnow
from app.models import ActionItem, Meeting, MeetingParticipant, Organization, Presentation, Proposal, ShareLink
from app.services import brand as brand_svc
from app.services.presentations import deck_dict

router = APIRouter(prefix="/public/shares", tags=["sharing"])


async def _resolve(db: DB, request: Request, token: str, password: str | None, authorization: str | None) -> ShareLink:
    link = (await db.execute(select(ShareLink).where(ShareLink.token == token))).scalar_one_or_none()
    if link is None or link.revoked_at is not None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "This link is invalid or has been revoked")
    now = utcnow()
    if link.expires_at is not None:
        exp = link.expires_at if link.expires_at.tzinfo else link.expires_at.replace(tzinfo=now.tzinfo)
        if exp < now:
            raise HTTPException(status.HTTP_410_GONE, "This link has expired")
    if link.audience == "internal":
        if not authorization:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sign in to your workspace to view this internal link")
        ctx = await get_ctx(request, db, authorization, str(link.organization_id))
        if ctx.org_id != link.organization_id:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "This link is internal to another workspace")
    if link.password_hash:
        if not password:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "password_required")
        if not verify_password(password, link.password_hash):
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect password")
    return link


async def _payload(db: DB, link: ShareLink) -> dict[str, Any]:
    org = await db.get(Organization, link.organization_id)
    base: dict[str, Any] = {"resource_type": link.resource_type, "allow_download": link.allow_download, "organization": org.name if org else ""}
    if link.resource_type == "presentation":
        p = await db.get(Presentation, link.resource_id)
        if p is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Presentation no longer exists")
        return {**base, "title": p.title, "deck": await deck_dict(db, p)}
    if link.resource_type == "proposal":
        pr = await db.get(Proposal, link.resource_id)
        if pr is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Proposal no longer exists")
        return {**base, "title": pr.title, "client": pr.client, "schema": pr.schema}
    m = await db.get(Meeting, link.resource_id)
    if m is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Meeting no longer exists")
    parts = [p.name for p in (await db.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id))).scalars()]
    actions = [
        {"title": a.title, "owner": a.owner, "deadline": a.deadline.isoformat() if a.deadline else a.deadline_text, "status": a.status}
        for a in (await db.execute(select(ActionItem).where(ActionItem.meeting_id == m.id))).scalars()
    ]
    theme = await brand_svc.theme_for(db, await brand_svc.get_brand(db, m.organization_id))
    return {
        **base, "title": m.title, "started_at": m.started_at, "duration_seconds": m.duration_seconds, "participants": parts,
        "intelligence": m.intelligence or {}, "action_items": actions, "theme": theme,
    }


@router.get("/{token}", dependencies=[rate_limit("share")])
async def view(
    token: str, request: Request, db: DB,
    x_share_password: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> dict[str, Any]:
    link = await _resolve(db, request, token, x_share_password, authorization)
    link.view_count += 1
    await audit(db, None, "share.view", link.resource_type, link.resource_id, {"audience": link.audience}, request, org_id=link.organization_id)
    data = await _payload(db, link)
    await db.commit()
    return data


@router.get("/{token}/download", dependencies=[rate_limit("share")])
async def download(
    token: str, request: Request, db: DB, format: str = "pdf",
    x_share_password: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header()] = None,
) -> Response:
    from app.services.export.pdf_export import build_meeting_notes_pdf, build_proposal_pdf, build_slides_pdf
    from app.services.export.pptx_export import build_pptx

    link = await _resolve(db, request, token, x_share_password, authorization)
    if not link.allow_download:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Downloads are disabled for this link")
    data = await _payload(db, link)
    title = str(data.get("title", "download")).replace('"', "")
    if link.resource_type == "presentation":
        if format == "pptx":
            body, mime, ext = build_pptx(data["deck"]), "application/vnd.openxmlformats-officedocument.presentationml.presentation", "pptx"
        else:
            body, mime, ext = build_slides_pdf(data["deck"]), "application/pdf", "pdf"
    elif link.resource_type == "proposal":
        body, mime, ext = build_proposal_pdf(title, data["client"], data["schema"] or {}, data["organization"]), "application/pdf", "pdf"
    else:
        secs = data.get("duration_seconds") or 0
        body = build_meeting_notes_pdf(
            {"title": title, "date": data["started_at"].strftime("%B %d, %Y") if data.get("started_at") else "", "duration": f"{secs // 60} min",
             "participants": data["participants"], "intelligence": data["intelligence"], "action_items": data["action_items"]},
            data["theme"], data["organization"],
        )
        mime, ext = "application/pdf", "pdf"
    await audit(db, None, "share.download", link.resource_type, link.resource_id, {"format": ext}, request, org_id=link.organization_id)
    await db.commit()
    return Response(body, media_type=mime, headers={"Content-Disposition": f'attachment; filename="{title[:80]}.{ext}"'})


@router.delete("/{share_id}", status_code=204, summary="Revoke a share link (authenticated)")
async def revoke(share_id: uuid.UUID, request: Request, db: DB, authorization: Annotated[str | None, Header()] = None) -> None:
    link = await db.get(ShareLink, share_id)
    if link is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share link not found")
    ctx = await get_ctx(request, db, authorization, str(link.organization_id))
    if link.organization_id != ctx.org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Share link not found")
    if not ctx.can("editor"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requires editor role")
    link.revoked_at = utcnow()
    await audit(db, ctx, "share.revoke", link.resource_type, link.resource_id, request=request)
    await db.commit()
