"""Presentation generation and persistence.

    prompt + options → company context (Brand System) → RAG over AI Library → LLM (DeckContent JSON)
        → validate/repair → apply brand theme → persist Presentation + PresentationSlide rows
"""

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, Presentation, PresentationSlide
from app.schemas.deck import Deck, DeckContent, Slide, SlideEditResult
from app.services import brand as brand_svc
from app.services.ai import prompts
from app.services.ai.service import AIContext, ai_service
from app.services.documents import retrieve
from app.services.jobs import JobContext, handler

AUDIENCE_LABELS = {
    "executives": "executives",
    "investors": "investors",
    "customers": "customers",
    "employees": "employees",
    "partners": "partners",
}


async def load_slides(session: AsyncSession, presentation_id: uuid.UUID) -> list[PresentationSlide]:
    q = select(PresentationSlide).where(PresentationSlide.presentation_id == presentation_id).order_by(PresentationSlide.position)
    return list((await session.execute(q)).scalars())


async def deck_dict(session: AsyncSession, p: Presentation) -> dict[str, Any]:
    slides = await load_slides(session, p.id)
    schema = p.schema or {}
    return {
        "version": schema.get("version", 1),
        "title": p.title,
        "subtitle": schema.get("subtitle", ""),
        "theme": schema.get("theme") or {},
        "slides": [s.schema for s in slides],
    }


async def save_deck(session: AsyncSession, p: Presentation, deck: Deck) -> None:
    """Replace the presentation's slides with the given validated deck."""
    p.title = deck.title
    p.schema = {"version": deck.version, "subtitle": deck.subtitle, "theme": deck.theme.model_dump()}
    p.style = deck.theme.style
    await session.execute(delete(PresentationSlide).where(PresentationSlide.presentation_id == p.id))
    for i, slide in enumerate(deck.slides):
        session.add(PresentationSlide(presentation_id=p.id, position=i, schema=slide.model_dump(by_alias=True)))


def ai_ctx(org: Organization | None, user_id: uuid.UUID | None) -> AIContext:
    return AIContext(organization_id=org.id if org else None, user_id=user_id, org_settings=org.settings if org else None)


@handler("presentation.generate")
async def generate_job(ctx: JobContext) -> dict[str, Any]:
    s, job = ctx.session, ctx.job
    pl = job.payload
    p = await s.get(Presentation, uuid.UUID(pl["presentation_id"]))
    if p is None or p.organization_id != job.organization_id:
        raise ValueError("presentation not found")
    org = await s.get(Organization, job.organization_id)
    await ctx.progress(8, "Reading company context")
    brand = await brand_svc.get_brand(s, job.organization_id, p.brand_system_id)

    knowledge: list[dict[str, Any]] = []
    if pl.get("use_knowledge", True):
        await ctx.progress(20, "Retrieving company knowledge")
        knowledge = await retrieve(s, job.organization_id, pl["prompt"], k=5)

    await ctx.progress(35, "Generating storyline")
    instructions, payload = prompts.presentation_prompt(
        prompt=pl["prompt"],
        deck_type=pl.get("deck_type", "custom"),
        audience=AUDIENCE_LABELS.get(pl.get("audience", "executives"), "executives"),
        tone=pl.get("tone", "executive"),
        slide_count=int(pl.get("slide_count", 10)),
        brand=brand_svc.brand_context(brand),
        knowledge=knowledge,
        creative=bool(pl.get("creative_mode")),
    )
    company = (brand.company_profile if brand else {}) or {}
    content = await ai_service.generate(
        task="presentation.generate",
        schema=DeckContent,
        instructions=instructions,
        payload=payload,
        ctx=ai_ctx(org, job.created_by),
        context={**pl, "company": company, "knowledge": knowledge},
        max_tokens=12000,
    )
    await ctx.progress(75, "Designing slides")
    count = int(pl.get("slide_count", 10))
    if len(content.slides) > count:
        content.slides = content.slides[:count]

    await ctx.progress(88, "Applying brand system")
    theme = await brand_svc.theme_for(s, brand, pl.get("style"))
    deck = Deck(title=content.title, subtitle=content.subtitle, slides=content.slides, theme=theme)  # type: ignore[arg-type]
    await save_deck(s, p, deck)
    p.status = "draft"
    p.description = p.description or content.subtitle
    await s.commit()
    return {"presentation_id": str(p.id), "slides": len(deck.slides), "sources": [k["title"] for k in knowledge]}


async def edit_slide(
    session: AsyncSession, org: Organization, user_id: uuid.UUID, p: Presentation, slide_row: PresentationSlide, command: str
) -> SlideEditResult:
    brand = await brand_svc.get_brand(session, org.id, p.brand_system_id)
    instructions, payload = prompts.slide_edit_prompt(
        slide=slide_row.schema, command=command, deck_title=p.title, brand=brand_svc.brand_context(brand)
    )
    result = await ai_service.generate(
        task="presentation.slide_edit",
        schema=SlideEditResult,
        instructions=instructions,
        payload=payload,
        ctx=ai_ctx(org, user_id),
        context={"slide": slide_row.schema, "command": command, "deck_title": p.title},
        max_tokens=4000,
    )
    result.slide.id = slide_row.schema.get("id", result.slide.id)
    return result


def validate_slide(data: dict[str, Any]) -> dict[str, Any]:
    return Slide.model_validate(data).model_dump(by_alias=True)
