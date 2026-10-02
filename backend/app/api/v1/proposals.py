import uuid
from typing import Literal

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select

from app.api.deps import DB, AICtx, CurrentCtx, EditorCtx, audit, get_owned
from app.api.v1.common import authors, create_share, job_out, list_shares
from app.db.base import utcnow
from app.models import BrandSystem, Proposal
from app.schemas.api import (
    GenerateOut,
    JobOut,
    ProposalBase,
    ProposalGenerateIn,
    ProposalOut,
    ProposalSummary,
    ProposalUpdate,
    SectionEditIn,
    SectionEditOut,
    ShareIn,
    ShareOut,
)
from app.services import brand as brand_svc
from app.services import jobs
from app.services.ai.service import AIOutputError
from app.services.proposals import DEFAULT_SECTIONS, edit_section

router = APIRouter(prefix="/proposals", tags=["proposals"])


async def summaries(db: DB, items: list[Proposal]) -> list[ProposalSummary]:
    who = await authors(db, {p.created_by for p in items})
    return [
        ProposalSummary(
            id=p.id,
            client=p.client,
            industry=p.industry,
            title=p.title,
            status=p.status,
            value=float(p.value) if p.value is not None else None,
            currency=p.currency,
            deadline=p.deadline,
            author=who.get(p.created_by) if p.created_by else None,
            section_count=len((p.schema or {}).get("sections", [])),
            theme=(p.schema or {}).get("theme") or {},
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in items
    ]


async def full(db: DB, p: Proposal) -> ProposalOut:
    [s] = await summaries(db, [p])
    schema = dict(p.schema or {})
    if p.brand_system_id:
        brand = await db.get(BrandSystem, p.brand_system_id)
        if brand is not None:
            schema["theme"] = {**(schema.get("theme") or {}), **(await brand_svc.identity(db, brand))}
    return ProposalOut(
        **s.model_dump(),
        contact_name=p.contact_name,
        contact_email=p.contact_email,
        opportunity=p.opportunity,
        description=p.description,
        prompt=p.prompt,
        schema_=schema,
        brand_system_id=p.brand_system_id,
    )


@router.get("", response_model=list[ProposalSummary])
async def list_proposals(
    ctx: CurrentCtx,
    db: DB,
    q: str | None = Query(None, max_length=200),
    status_: str | None = Query(None, alias="status"),
    sort: Literal["updated", "created", "value", "client"] = "updated",
) -> list[ProposalSummary]:
    stmt = select(Proposal).where(Proposal.organization_id == ctx.org_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Proposal.title).like(like), func.lower(Proposal.client).like(like)))
    if status_:
        stmt = stmt.where(Proposal.status == status_)
    order = {
        "updated": Proposal.updated_at.desc(),
        "created": Proposal.created_at.desc(),
        "value": Proposal.value.desc(),
        "client": func.lower(Proposal.client),
    }[sort]
    return await summaries(db, list((await db.execute(stmt.order_by(order).limit(500))).scalars()))


@router.post("", response_model=ProposalOut, status_code=201, summary="Create an empty proposal")
async def create_proposal(body: ProposalBase, ctx: EditorCtx, db: DB, request: Request) -> ProposalOut:
    brand = await brand_svc.get_brand(db, ctx.org_id)
    theme = await brand_svc.theme_for(db, brand)
    p = Proposal(
        organization_id=ctx.org_id,
        created_by=ctx.user.id,
        brand_system_id=brand.id if brand else None,
        schema={"sections": [{"id": uuid.uuid4().hex[:10], "kind": "cover", "title": "Cover", "blocks": []}], "theme": theme,
                "brand_lock": bool(brand and brand.brand_lock), "compliance": brand_svc.compliance_report(brand, theme, False)},
        **body.model_dump(),
    )
    db.add(p)
    await audit(db, ctx, "proposal.create", "proposal", p.id, {"client": p.client}, request)
    await db.commit()
    return await full(db, p)


@router.post("/generate", response_model=GenerateOut, status_code=202, summary="Generate a client proposal with AI (async job)")
async def generate(body: ProposalGenerateIn, ctx: AICtx, db: DB, request: Request) -> GenerateOut:
    brand = await brand_svc.get_brand(db, ctx.org_id, body.brand_system_id)
    if body.sections:
        unknown = set(body.sections) - set(DEFAULT_SECTIONS) - {"custom"}
        if unknown:
            raise HTTPException(422, f"Unknown sections: {', '.join(sorted(unknown))}")
    fields = body.model_dump(exclude={"prompt", "sections", "creative_mode", "brand_system_id"})
    p = Proposal(
        organization_id=ctx.org_id,
        created_by=ctx.user.id,
        brand_system_id=brand.id if brand else None,
        status="generating",
        prompt=body.prompt,
        **fields,
    )
    db.add(p)
    await audit(db, ctx, "proposal.generate", "proposal", p.id, {"client": body.client}, request)
    await db.commit()
    payload = {
        "proposal_id": str(p.id),
        "prompt": body.prompt,
        "sections": body.sections,
        "creative_mode": body.creative_mode,
        "keep_title": body.title != "Untitled proposal",
    }
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="proposal.generate", payload=payload, resource_type="proposal", resource_id=p.id)
    return GenerateOut(job=job_out(job), proposal_id=p.id)


@router.get("/{proposal_id}", response_model=ProposalOut)
async def get_proposal(proposal_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> ProposalOut:
    return await full(db, await get_owned(db, Proposal, proposal_id, ctx.org_id))


@router.patch("/{proposal_id}", response_model=ProposalOut)
async def update_proposal(proposal_id: uuid.UUID, body: ProposalUpdate, ctx: EditorCtx, db: DB, request: Request) -> ProposalOut:
    p = await get_owned(db, Proposal, proposal_id, ctx.org_id)
    data = body.model_dump(exclude_unset=True, exclude={"sections", "creative_mode"})
    for k, v in data.items():
        setattr(p, k, v)
    if body.sections is not None or body.creative_mode is not None:
        schema = dict(p.schema or {})
        if body.sections is not None:
            schema["sections"] = [s.model_dump(by_alias=True) for s in body.sections]
        if body.creative_mode is not None:
            brand = await brand_svc.get_brand(db, ctx.org_id, p.brand_system_id)
            schema["creative_mode"] = body.creative_mode
            schema["brand_lock"] = bool(brand and brand.brand_lock and not body.creative_mode)
            schema["compliance"] = brand_svc.compliance_report(brand, schema.get("theme") or {}, body.creative_mode)
        p.schema = schema
    p.updated_at = utcnow()
    await audit(db, ctx, "proposal.update", "proposal", p.id, {"fields": sorted(body.model_dump(exclude_unset=True))}, request)
    await db.commit()
    return await full(db, p)


@router.delete("/{proposal_id}", status_code=204)
async def delete_proposal(proposal_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> None:
    p = await get_owned(db, Proposal, proposal_id, ctx.org_id)
    await audit(db, ctx, "proposal.delete", "proposal", p.id, {"title": p.title, "client": p.client}, request)
    await db.delete(p)
    await db.commit()


@router.post("/{proposal_id}/duplicate", response_model=ProposalOut, status_code=201)
async def duplicate(proposal_id: uuid.UUID, ctx: EditorCtx, db: DB) -> ProposalOut:
    src = await get_owned(db, Proposal, proposal_id, ctx.org_id)
    copy = Proposal(
        organization_id=ctx.org_id,
        created_by=ctx.user.id,
        client=src.client,
        industry=src.industry,
        contact_name=src.contact_name,
        contact_email=src.contact_email,
        opportunity=src.opportunity,
        title=f"{src.title} (copy)",
        description=src.description,
        value=src.value,
        currency=src.currency,
        deadline=src.deadline,
        status="draft",
        schema=src.schema,
        prompt=src.prompt,
        brand_system_id=src.brand_system_id,
    )
    db.add(copy)
    await db.commit()
    return await full(db, copy)


@router.post("/{proposal_id}/sections/ai-edit", response_model=SectionEditOut, summary="Proposal AI assistant / regenerate section")
async def ai_edit_section(proposal_id: uuid.UUID, body: SectionEditIn, ctx: AICtx, db: DB) -> SectionEditOut:
    p = await get_owned(db, Proposal, proposal_id, ctx.org_id)
    try:
        result = await edit_section(db, ctx.org, ctx.user.id, p, body.section.model_dump(by_alias=True), body.command)
    except AIOutputError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"AI could not complete this edit: {e}") from e
    return SectionEditOut(section=result.section.model_dump(by_alias=True), explanation=result.explanation)


@router.post("/{proposal_id}/export", response_model=JobOut, status_code=202)
async def export(proposal_id: uuid.UUID, ctx: CurrentCtx, db: DB, request: Request) -> JobOut:
    p = await get_owned(db, Proposal, proposal_id, ctx.org_id)
    await audit(db, ctx, "proposal.export", "proposal", p.id, {"format": "pdf"}, request)
    await db.commit()
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="export.proposal", payload={"proposal_id": str(p.id)}, resource_type="proposal", resource_id=p.id)
    return job_out(job)


@router.post("/{proposal_id}/share", response_model=ShareOut, status_code=201)
async def share(proposal_id: uuid.UUID, body: ShareIn, ctx: EditorCtx, db: DB, request: Request) -> ShareOut:
    await get_owned(db, Proposal, proposal_id, ctx.org_id)
    return await create_share(db, ctx, "proposal", proposal_id, body, request)


@router.get("/{proposal_id}/shares", response_model=list[ShareOut])
async def shares(proposal_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> list[ShareOut]:
    await get_owned(db, Proposal, proposal_id, ctx.org_id)
    return await list_shares(db, ctx, "proposal", proposal_id)
