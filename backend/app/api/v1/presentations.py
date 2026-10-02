import uuid
from typing import Any, Literal

from fastapi import APIRouter, HTTPException, Query, Request, status
from sqlalchemy import func, or_, select

from app.api.deps import DB, AICtx, CurrentCtx, EditorCtx, audit, get_owned
from app.api.v1.common import authors, create_share, favorite_ids, job_out, list_shares, set_favorite
from app.db.base import utcnow
from app.models import Folder, Presentation, PresentationSlide, Template
from app.schemas.api import (
    ExportIn,
    FolderIn,
    FolderOut,
    GenerateIn,
    GenerateOut,
    JobOut,
    PresentationCreate,
    PresentationOut,
    PresentationSummary,
    PresentationUpdate,
    ShareIn,
    ShareOut,
    SlideAIEditIn,
    SlideAIEditOut,
)
from app.schemas.deck import Deck, Slide, Theme
from app.services import brand as brand_svc
from app.services import jobs
from app.services.ai.service import AIOutputError
from app.services.presentations import deck_dict, edit_slide, save_deck

router = APIRouter(prefix="/presentations", tags=["presentations"])
slides_router = APIRouter(prefix="/slides", tags=["presentations"])
folders_router = APIRouter(prefix="/folders", tags=["presentations"])


async def summaries(db: DB, ctx: CurrentCtx, items: list[Presentation]) -> list[PresentationSummary]:
    ids = [p.id for p in items]
    covers: dict[uuid.UUID, dict[str, Any]] = {}
    counts: dict[uuid.UUID, int] = {}
    if ids:
        for s in (await db.execute(select(PresentationSlide).where(PresentationSlide.presentation_id.in_(ids), PresentationSlide.position == 0))).scalars():
            covers[s.presentation_id] = s.schema
        for pid, n in (await db.execute(select(PresentationSlide.presentation_id, func.count()).where(PresentationSlide.presentation_id.in_(ids)).group_by(PresentationSlide.presentation_id))).all():
            counts[pid] = n
    favs = await favorite_ids(db, ctx, "presentation")
    who = await authors(db, {p.created_by for p in items})
    return [
        PresentationSummary(
            id=p.id,
            title=p.title,
            description=p.description,
            status=p.status,
            style=p.style,
            theme=(p.schema or {}).get("theme") or {},
            cover=covers.get(p.id),
            slide_count=counts.get(p.id, 0),
            author=who.get(p.created_by) if p.created_by else None,
            folder_id=p.folder_id,
            is_favorite=p.id in favs,
            source=p.source,
            source_meeting_id=p.source_meeting_id,
            options=p.options or {},
            last_presented_at=p.last_presented_at,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        for p in items
    ]


async def full(db: DB, ctx: CurrentCtx, p: Presentation) -> PresentationOut:
    [summary] = await summaries(db, ctx, [p])
    return PresentationOut(**summary.model_dump(), deck=await deck_dict(db, p), brand_system_id=p.brand_system_id, prompt=p.prompt)


@router.get("", response_model=list[PresentationSummary])
async def list_presentations(
    ctx: CurrentCtx,
    db: DB,
    q: str | None = Query(None, max_length=200),
    status_: str | None = Query(None, alias="status"),
    folder_id: uuid.UUID | None = None,
    favorites: bool = False,
    sort: Literal["updated", "created", "title"] = "updated",
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> list[PresentationSummary]:
    stmt = select(Presentation).where(Presentation.organization_id == ctx.org_id, Presentation.status != "archived")
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Presentation.title).like(like), func.lower(Presentation.description).like(like)))
    if status_:
        stmt = stmt.where(Presentation.status == status_)
    if folder_id:
        stmt = stmt.where(Presentation.folder_id == folder_id)
    if favorites:
        stmt = stmt.where(Presentation.id.in_(await favorite_ids(db, ctx, "presentation")))
    order = {"updated": Presentation.updated_at.desc(), "created": Presentation.created_at.desc(), "title": func.lower(Presentation.title)}[sort]
    items = list((await db.execute(stmt.order_by(order).limit(limit).offset(offset))).scalars())
    return await summaries(db, ctx, items)


@router.post("", response_model=PresentationOut, status_code=201)
async def create_presentation(body: PresentationCreate, ctx: EditorCtx, db: DB, request: Request) -> PresentationOut:
    brand = await brand_svc.get_brand(db, ctx.org_id)
    if body.folder_id:
        await get_owned(db, Folder, body.folder_id, ctx.org_id)
    p = Presentation(
        organization_id=ctx.org_id,
        title=body.title,
        description=body.description,
        created_by=ctx.user.id,
        brand_system_id=brand.id if brand else None,
        folder_id=body.folder_id,
        source="blank",
    )
    db.add(p)
    await db.flush()
    if body.template_id:
        tpl = await get_owned(db, Template, body.template_id, ctx.org_id)
        deck = Deck.model_validate(tpl.schema)
        if body.title != "Untitled presentation":
            deck.title = body.title
        # Templates adopt the workspace brand (colors, fonts, logo) but keep their visual style.
        deck.theme = Theme.model_validate(await brand_svc.theme_for(db, brand, deck.theme.style))
        p.template_id = tpl.id
        p.source = "template"
        tpl.usage_count += 1
    elif body.deck:
        deck = body.deck
    else:
        theme = await brand_svc.theme_for(db, brand)
        deck = Deck.model_validate(
            {"title": body.title, "theme": theme, "slides": [{"layout": "hero", "title": body.title, "subtitle": ctx.org.name, "background": "inverse"}]}
        )
    await save_deck(db, p, deck)
    await audit(db, ctx, "presentation.create", "presentation", p.id, {"source": p.source}, request)
    await db.commit()
    return await full(db, ctx, p)


@router.post("/generate", response_model=GenerateOut, status_code=202, summary="Generate a presentation with AI (async job)")
async def generate(body: GenerateIn, ctx: AICtx, db: DB, request: Request) -> GenerateOut:
    brand = await brand_svc.get_brand(db, ctx.org_id, body.brand_system_id)
    if body.brand_system_id and brand is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Brand system not found")
    p = Presentation(
        organization_id=ctx.org_id,
        title=body.title or "Generating…",
        created_by=ctx.user.id,
        brand_system_id=brand.id if brand else None,
        status="generating",
        source="prompt",
        prompt=body.prompt,
        options=body.model_dump(mode="json", exclude={"prompt", "brand_system_id"}),
        style=body.style or (brand.default_style if brand else "executive"),
    )
    db.add(p)
    await audit(db, ctx, "presentation.generate", "presentation", p.id, {"deck_type": body.deck_type, "slides": body.slide_count}, request)
    await db.commit()
    payload = {**body.model_dump(mode="json"), "presentation_id": str(p.id)}
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="presentation.generate", payload=payload, resource_type="presentation", resource_id=p.id)
    return GenerateOut(job=job_out(job), presentation_id=p.id)


@router.get("/{presentation_id}", response_model=PresentationOut)
async def get_presentation(presentation_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> PresentationOut:
    return await full(db, ctx, await get_owned(db, Presentation, presentation_id, ctx.org_id))


@router.patch("/{presentation_id}", response_model=PresentationOut)
async def update_presentation(presentation_id: uuid.UUID, body: PresentationUpdate, ctx: EditorCtx, db: DB, request: Request) -> PresentationOut:
    p = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    if body.deck is not None:
        await save_deck(db, p, body.deck)
    if body.title is not None:
        p.title = body.title
    if body.description is not None:
        p.description = body.description
    if body.status is not None:
        p.status = body.status
    if body.folder_id is not None:
        await get_owned(db, Folder, body.folder_id, ctx.org_id)
        p.folder_id = body.folder_id
    if body.clear_folder:
        p.folder_id = None
    if body.style is not None:
        brand = await brand_svc.get_brand(db, ctx.org_id, p.brand_system_id)
        schema = dict(p.schema or {})
        schema["theme"] = {**(schema.get("theme") or await brand_svc.theme_for(db, brand)), "style": body.style}
        p.schema = schema
        p.style = body.style
    p.updated_at = utcnow()
    await audit(db, ctx, "presentation.update", "presentation", p.id, {"fields": sorted(body.model_dump(exclude_unset=True, exclude={"deck"})) + (["deck"] if body.deck else [])}, request)
    await db.commit()
    return await full(db, ctx, p)


@router.delete("/{presentation_id}", status_code=204)
async def delete_presentation(presentation_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> None:
    p = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    await audit(db, ctx, "presentation.delete", "presentation", p.id, {"title": p.title}, request)
    await db.delete(p)
    await db.commit()


@router.post("/{presentation_id}/duplicate", response_model=PresentationOut, status_code=201)
async def duplicate(presentation_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> PresentationOut:
    src = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    copy = Presentation(
        organization_id=ctx.org_id,
        title=f"{src.title} (copy)",
        description=src.description,
        schema=src.schema,
        status="draft",
        created_by=ctx.user.id,
        brand_system_id=src.brand_system_id,
        folder_id=src.folder_id,
        source=src.source,
        prompt=src.prompt,
        options=src.options,
        style=src.style,
    )
    db.add(copy)
    await db.flush()
    for s in (await db.execute(select(PresentationSlide).where(PresentationSlide.presentation_id == src.id))).scalars():
        db.add(PresentationSlide(presentation_id=copy.id, position=s.position, schema=s.schema))
    await audit(db, ctx, "presentation.duplicate", "presentation", copy.id, {"from": str(src.id)}, request)
    await db.commit()
    return await full(db, ctx, copy)


@router.put("/{presentation_id}/favorite", status_code=204)
async def favorite(presentation_id: uuid.UUID, ctx: CurrentCtx, db: DB, on: bool = True) -> None:
    await get_owned(db, Presentation, presentation_id, ctx.org_id)
    await set_favorite(db, ctx, "presentation", presentation_id, on)


@router.post("/{presentation_id}/regenerate", response_model=GenerateOut, status_code=202)
async def regenerate(presentation_id: uuid.UUID, ctx: AICtx, db: DB) -> GenerateOut:
    p = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    if not p.prompt:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This presentation was not generated from a prompt")
    p.status = "generating"
    await db.commit()
    payload = {**(p.options or {}), "prompt": p.prompt, "presentation_id": str(p.id), "style": p.style}
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="presentation.generate", payload=payload, resource_type="presentation", resource_id=p.id)
    return GenerateOut(job=job_out(job), presentation_id=p.id)


@router.post("/{presentation_id}/ai-edit", response_model=SlideAIEditOut, summary="AI Designer: apply a command to one slide")
async def ai_edit(presentation_id: uuid.UUID, body: SlideAIEditIn, ctx: AICtx, db: DB) -> SlideAIEditOut:
    p = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    if body.slide is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "slide is required")
    row = PresentationSlide(presentation_id=p.id, position=-1, schema=body.slide.model_dump(by_alias=True))
    try:
        result = await edit_slide(db, ctx.org, ctx.user.id, p, row, body.command)
    except AIOutputError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"AI could not complete this edit: {e}") from e
    return SlideAIEditOut(slide=result.slide.model_dump(by_alias=True), explanation=result.explanation)


@router.post("/{presentation_id}/export", response_model=JobOut, status_code=202)
async def export(presentation_id: uuid.UUID, body: ExportIn, ctx: CurrentCtx, db: DB, request: Request) -> JobOut:
    p = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    await audit(db, ctx, "presentation.export", "presentation", p.id, {"format": body.format}, request)
    await db.commit()
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="export.presentation", payload={"presentation_id": str(p.id), **body.model_dump()}, resource_type="presentation", resource_id=p.id)
    return job_out(job)


@router.post("/{presentation_id}/present", status_code=204)
async def mark_presented(presentation_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> None:
    p = await get_owned(db, Presentation, presentation_id, ctx.org_id)
    p.last_presented_at = utcnow()
    await db.commit()


@router.post("/{presentation_id}/share", response_model=ShareOut, status_code=201)
async def share(presentation_id: uuid.UUID, body: ShareIn, ctx: EditorCtx, db: DB, request: Request) -> ShareOut:
    await get_owned(db, Presentation, presentation_id, ctx.org_id)
    return await create_share(db, ctx, "presentation", presentation_id, body, request)


@router.get("/{presentation_id}/shares", response_model=list[ShareOut])
async def shares(presentation_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> list[ShareOut]:
    await get_owned(db, Presentation, presentation_id, ctx.org_id)
    return await list_shares(db, ctx, "presentation", presentation_id)


# ---------------------------------------------------------------------------- persisted slide AI edit


@slides_router.post("/{slide_id}/ai-edit", response_model=SlideAIEditOut, summary="AI edit a saved slide and persist it")
async def ai_edit_saved(slide_id: uuid.UUID, body: SlideAIEditIn, ctx: AICtx, db: DB) -> SlideAIEditOut:
    row = await db.get(PresentationSlide, slide_id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Slide not found")
    p = await get_owned(db, Presentation, row.presentation_id, ctx.org_id)
    try:
        result = await edit_slide(db, ctx.org, ctx.user.id, p, row, body.command)
    except AIOutputError as e:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"AI could not complete this edit: {e}") from e
    row.schema = Slide.model_validate(result.slide.model_dump(by_alias=True)).model_dump(by_alias=True)
    p.updated_at = utcnow()
    await db.commit()
    return SlideAIEditOut(slide=row.schema, explanation=result.explanation)


# ---------------------------------------------------------------------------- folders


@folders_router.get("", response_model=list[FolderOut])
async def list_folders(ctx: CurrentCtx, db: DB, kind: str = "presentations") -> list[FolderOut]:
    rows = (await db.execute(select(Folder).where(Folder.organization_id == ctx.org_id, Folder.kind == kind).order_by(Folder.name))).scalars()
    return [FolderOut.model_validate(f) for f in rows]


@folders_router.post("", response_model=FolderOut, status_code=201)
async def create_folder(body: FolderIn, ctx: EditorCtx, db: DB) -> FolderOut:
    exists = (await db.execute(select(Folder).where(Folder.organization_id == ctx.org_id, Folder.kind == body.kind, Folder.name == body.name))).scalar_one_or_none()
    if exists:
        raise HTTPException(status.HTTP_409_CONFLICT, "A folder with this name already exists")
    f = Folder(organization_id=ctx.org_id, name=body.name, kind=body.kind)
    db.add(f)
    await db.commit()
    return FolderOut.model_validate(f)


@folders_router.delete("/{folder_id}", status_code=204)
async def delete_folder(folder_id: uuid.UUID, ctx: EditorCtx, db: DB) -> None:
    f = await get_owned(db, Folder, folder_id, ctx.org_id)
    await db.delete(f)
    await db.commit()
