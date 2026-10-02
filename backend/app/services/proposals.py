"""Proposal generation: client brief + Brand System + retrieved case studies/services → structured proposal."""

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, Proposal
from app.schemas.ai import ProposalContent, ProposalSection, SectionEditResult
from app.services import brand as brand_svc
from app.services.ai import prompts
from app.services.ai.mock import SECTION_TITLES
from app.services.ai.service import ai_service
from app.services.documents import retrieve
from app.services.jobs import JobContext, handler
from app.services.presentations import ai_ctx

DEFAULT_SECTIONS = list(SECTION_TITLES)


def client_brief(p: Proposal) -> dict[str, Any]:
    return {
        "client": p.client,
        "industry": p.industry,
        "contact": p.contact_name,
        "opportunity": p.opportunity,
        "title": p.title,
        "description": p.description,
        "estimated_value": float(p.value) if p.value is not None else None,
        "currency": p.currency,
        "deadline": p.deadline.isoformat() if p.deadline else None,
    }


@handler("proposal.generate")
async def generate_job(ctx: JobContext) -> dict[str, Any]:
    s, job = ctx.session, ctx.job
    pl = job.payload
    p = await s.get(Proposal, uuid.UUID(pl["proposal_id"]))
    if p is None or p.organization_id != job.organization_id:
        raise ValueError("proposal not found")
    org = await s.get(Organization, job.organization_id)
    await ctx.progress(8, "Loading brand system & company profile")
    brand = await brand_svc.get_brand(s, job.organization_id, p.brand_system_id)

    await ctx.progress(20, "Retrieving case studies & services")
    query = f"{p.client} {p.industry or ''} {p.opportunity or ''} {pl.get('prompt', '')}"
    knowledge = await retrieve(s, job.organization_id, query, k=6)

    await ctx.progress(35, f"Writing proposal for {p.client}")
    sections = pl.get("sections") or DEFAULT_SECTIONS
    creative = bool(pl.get("creative_mode"))
    instructions, payload = prompts.proposal_prompt(
        prompt=pl.get("prompt", ""),
        client=client_brief(p),
        sections=sections,
        brand=brand_svc.brand_context(brand),
        knowledge=knowledge,
        creative=creative,
    )
    content = await ai_service.generate(
        task="proposal.generate",
        schema=ProposalContent,
        instructions=instructions,
        payload=payload,
        ctx=ai_ctx(org, job.created_by),
        context={
            **pl,
            "client": p.client,
            "industry": p.industry,
            "value": float(p.value) if p.value is not None else None,
            "currency": p.currency,
            "title": p.title if pl.get("keep_title") else None,
            "opportunity": p.opportunity,
            "sections": sections,
            "company": (brand.company_profile if brand else {}) or {},
            "knowledge": knowledge,
        },
        max_tokens=14000,
    )
    await ctx.progress(85, "Applying brand & compliance checks")
    theme = await brand_svc.theme_for(s, brand, pl.get("style"))
    p.schema = {
        "subtitle": content.subtitle,
        "sections": [sec.model_dump(by_alias=True) for sec in content.sections],
        "theme": theme,
        "creative_mode": creative,
        "brand_lock": bool(brand and brand.brand_lock and not creative),
        "compliance": brand_svc.compliance_report(brand, theme, creative),
        "sources": [k["title"] for k in knowledge],
    }
    if not pl.get("keep_title"):
        p.title = content.title or p.title
    p.status = "draft"
    await s.commit()
    return {"proposal_id": str(p.id), "sections": len(content.sections)}


async def edit_section(
    session: AsyncSession, org: Organization, user_id: uuid.UUID, p: Proposal, section: dict[str, Any], command: str
) -> SectionEditResult:
    brand = await brand_svc.get_brand(session, org.id, p.brand_system_id)
    knowledge: list[dict[str, Any]] = []
    if any(w in command.lower() for w in ("case", "regenerate", "client", "value")):
        knowledge = await retrieve(session, org.id, f"{p.client} {p.industry or ''} {section.get('title', '')}", k=4)
    instructions, payload = prompts.section_edit_prompt(
        section=section, command=command, client=client_brief(p), brand=brand_svc.brand_context(brand), knowledge=knowledge
    )
    result = await ai_service.generate(
        task="proposal.section_edit",
        schema=SectionEditResult,
        instructions=instructions,
        payload=payload,
        ctx=ai_ctx(org, user_id),
        context={
            "section": section,
            "command": command,
            "client": p.client,
            "industry": p.industry,
            "value": float(p.value) if p.value is not None else None,
            "company": (brand.company_profile if brand else {}) or {},
            "knowledge": knowledge,
            "section_title": section.get("title"),
        },
        max_tokens=5000,
    )
    result.section.id = section.get("id", result.section.id)
    result.section.kind = section.get("kind", result.section.kind)
    return result


def validate_section(data: dict[str, Any]) -> dict[str, Any]:
    return ProposalSection.model_validate(data).model_dump(by_alias=True)
