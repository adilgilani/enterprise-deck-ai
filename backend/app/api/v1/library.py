"""Templates, assets and the AI Library (documents + retrieval)."""

import json
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import func, or_, select

from app.api.deps import DB, CurrentCtx, EditorCtx, audit, get_owned
from app.api.v1.common import authors, favorite_ids, job_out, set_favorite
from app.models import Asset, Document, DocumentChunk, Folder, Presentation, Template
from app.schemas.api import (
    AssetOut,
    AssetUpdate,
    DocumentDetail,
    DocumentOut,
    DocumentTextIn,
    JobOut,
    SearchHit,
    SearchIn,
    TemplateCreate,
    TemplateDetail,
    TemplateOut,
)
from app.schemas.deck import Deck
from app.services import brand as brand_svc
from app.services import jobs
from app.services.documents import ExtractionError, extract_text, retrieve
from app.services.presentations import deck_dict
from app.services.storage import get_storage, make_key
from app.services.uploads import ASSET_EXTS, DOCUMENT_EXTS, TEMPLATE_EXTS, read_validated

templates_router = APIRouter(prefix="/templates", tags=["templates"])
assets_router = APIRouter(prefix="/assets", tags=["assets"])
documents_router = APIRouter(prefix="/documents", tags=["ai-library"])

TEMPLATE_CATEGORIES = [
    "investor", "board", "sales", "consulting", "finance", "marketing", "product", "strategy", "hr", "government",
    "proposal", "meeting",
]


# ---------------------------------------------------------------------------- templates


def _tpl_out(t: Template, favs: set[uuid.UUID]) -> TemplateOut:
    slides = (t.schema or {}).get("slides") or []
    return TemplateOut(
        id=t.id,
        name=t.name,
        description=t.description,
        category=t.category,
        kind=t.kind,
        source=t.source,
        approved=t.approved,
        usage_count=t.usage_count,
        is_favorite=t.id in favs,
        slide_count=len(slides),
        cover=slides[0] if slides else None,
        theme=(t.schema or {}).get("theme") or {},
        created_at=t.created_at,
    )


@templates_router.get("", response_model=list[TemplateOut])
async def list_templates(ctx: CurrentCtx, db: DB, category: str | None = None, q: str | None = None, favorites: bool = False) -> list[TemplateOut]:
    stmt = select(Template).where(Template.organization_id == ctx.org_id)
    if category:
        stmt = stmt.where(Template.category == category)
    if q:
        stmt = stmt.where(or_(func.lower(Template.name).like(f"%{q.lower()}%"), func.lower(Template.description).like(f"%{q.lower()}%")))
    favs = await favorite_ids(db, ctx, "template")
    if favorites:
        stmt = stmt.where(Template.id.in_(favs))
    rows = (await db.execute(stmt.order_by(Template.usage_count.desc(), Template.name))).scalars()
    return [_tpl_out(t, favs) for t in rows]


@templates_router.get("/{template_id}", response_model=TemplateDetail)
async def get_template(template_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> TemplateDetail:
    t = await get_owned(db, Template, template_id, ctx.org_id)
    return TemplateDetail(**_tpl_out(t, await favorite_ids(db, ctx, "template")).model_dump(), schema_=t.schema)


@templates_router.post("", response_model=TemplateOut, status_code=201, summary="Save a presentation or deck JSON as a template")
async def create_template(body: TemplateCreate, ctx: EditorCtx, db: DB, request: Request) -> TemplateOut:
    if body.presentation_id:
        p = await get_owned(db, Presentation, body.presentation_id, ctx.org_id)
        schema = await deck_dict(db, p)
    elif body.deck:
        schema = body.deck.model_dump(by_alias=True)
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Provide presentation_id or deck")
    t = Template(organization_id=ctx.org_id, name=body.name, description=body.description, category=body.category, schema=schema, source="uploaded", created_by=ctx.user.id, approved=ctx.can("admin"))
    db.add(t)
    await audit(db, ctx, "template.create", "template", t.id, {"name": t.name}, request)
    await db.commit()
    return _tpl_out(t, set())


@templates_router.post("/upload", response_model=TemplateOut, status_code=201, summary="Upload a .pptx or deck .json as a template")
async def upload_template(ctx: EditorCtx, db: DB, request: Request, file: UploadFile = File(...), name: str = Form(...), category: str = Form("strategy")) -> TemplateOut:
    data, kind = await read_validated(file, TEMPLATE_EXTS)
    if kind.ext == "json":
        try:
            deck = Deck.model_validate(json.loads(data))
        except Exception as e:
            raise HTTPException(422, f"Invalid deck JSON: {e}") from e
    else:
        # Import PPTX structure: one slide per source slide, text mapped to title + bullets.
        try:
            text, _ = extract_text(data, "pptx")
        except ExtractionError as e:
            raise HTTPException(422, str(e)) from e
        slides: list[dict[str, Any]] = []
        for i, block in enumerate(t for t in text.split("[Slide ") if t.strip()):
            lines = [ln.strip() for ln in block.split("\n")[1:] if ln.strip() and not ln.startswith("Notes:")]
            if not lines:
                continue
            slides.append({"layout": "hero" if i == 0 else "split", "title": lines[0][:200], "elements": [{"type": "bullets", "items": [ln[:300] for ln in lines[1:7]]}] if len(lines) > 1 else []})
        if not slides:
            raise HTTPException(422, "No slides with text found in the PPTX")
        theme = await brand_svc.theme_for(db, await brand_svc.get_brand(db, ctx.org_id))
        deck = Deck.model_validate({"title": name, "slides": slides[:60], "theme": theme})
    key = make_key(ctx.org_id, "templates", file.filename or f"template.{kind.ext}")
    await get_storage().put(key, data, kind.mime)
    t = Template(organization_id=ctx.org_id, name=name, category=category if category in TEMPLATE_CATEGORIES else "strategy", schema=deck.model_dump(by_alias=True), source="uploaded", created_by=ctx.user.id, approved=ctx.can("admin"), description=f"Imported from {file.filename}")
    db.add(t)
    await audit(db, ctx, "template.upload", "template", t.id, {"filename": file.filename}, request)
    await db.commit()
    return _tpl_out(t, set())


@templates_router.post("/{template_id}/duplicate", response_model=TemplateOut, status_code=201)
async def duplicate_template(template_id: uuid.UUID, ctx: EditorCtx, db: DB) -> TemplateOut:
    src = await get_owned(db, Template, template_id, ctx.org_id)
    t = Template(organization_id=ctx.org_id, name=f"{src.name} (copy)", description=src.description, category=src.category, kind=src.kind, schema=src.schema, source="duplicated", created_by=ctx.user.id, approved=src.approved)
    db.add(t)
    await db.commit()
    return _tpl_out(t, set())


@templates_router.put("/{template_id}/favorite", status_code=204)
async def favorite_template(template_id: uuid.UUID, ctx: CurrentCtx, db: DB, on: bool = True) -> None:
    await get_owned(db, Template, template_id, ctx.org_id)
    await set_favorite(db, ctx, "template", template_id, on)


@templates_router.delete("/{template_id}", status_code=204)
async def delete_template(template_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> None:
    t = await get_owned(db, Template, template_id, ctx.org_id)
    if t.source == "built_in" and not ctx.can("admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only admins can delete approved templates")
    await audit(db, ctx, "template.delete", "template", t.id, {"name": t.name}, request)
    await db.delete(t)
    await db.commit()


# ---------------------------------------------------------------------------- assets


def _asset_type(family: str, ext: str, requested: str | None) -> str:
    if requested in ("logo", "image", "icon", "video", "document", "chart", "template"):
        return requested
    if family == "image":
        return "icon" if ext == "svg" else "image"
    if family == "video":
        return "video"
    if family == "presentation":
        return "template"
    return "document"


async def _asset_out(db: DB, items: list[Asset]) -> list[AssetOut]:
    who = await authors(db, {a.uploaded_by for a in items})
    return [
        AssetOut(
            id=a.id, name=a.name, filename=a.filename, type=a.type, mime_type=a.mime_type, size_bytes=a.size_bytes,
            url=f"/api/v1/assets/{a.id}/file", folder_id=a.folder_id, meta=a.meta or {},
            uploaded_by=who.get(a.uploaded_by) if a.uploaded_by else None, created_at=a.created_at,
        )
        for a in items
    ]


def _image_size(data: bytes, ext: str) -> dict[str, int]:
    try:
        if ext == "png" and len(data) > 24:
            return {"width": int.from_bytes(data[16:20], "big"), "height": int.from_bytes(data[20:24], "big")}
        if ext == "gif" and len(data) > 10:
            return {"width": int.from_bytes(data[6:8], "little"), "height": int.from_bytes(data[8:10], "little")}
        if ext in ("jpg", "jpeg"):
            i = 2
            while i < len(data) - 9:
                if data[i] != 0xFF:
                    i += 1
                    continue
                marker = data[i + 1]
                if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                    return {"height": int.from_bytes(data[i + 5 : i + 7], "big"), "width": int.from_bytes(data[i + 7 : i + 9], "big")}
                i += 2 + int.from_bytes(data[i + 2 : i + 4], "big")
    except Exception:
        pass
    return {}


@assets_router.get("", response_model=list[AssetOut])
async def list_assets(ctx: CurrentCtx, db: DB, type: str | None = None, q: str | None = None, folder_id: uuid.UUID | None = None) -> list[AssetOut]:
    stmt = select(Asset).where(Asset.organization_id == ctx.org_id)
    if type:
        stmt = stmt.where(Asset.type == type)
    if q:
        stmt = stmt.where(or_(func.lower(Asset.name).like(f"%{q.lower()}%"), func.lower(Asset.filename).like(f"%{q.lower()}%")))
    if folder_id:
        stmt = stmt.where(Asset.folder_id == folder_id)
    return await _asset_out(db, list((await db.execute(stmt.order_by(Asset.created_at.desc()).limit(500))).scalars()))


@assets_router.post("", response_model=AssetOut, status_code=201)
async def upload_asset(
    ctx: EditorCtx, db: DB, request: Request,
    file: UploadFile = File(...), type: str | None = Form(None), name: str | None = Form(None), folder_id: uuid.UUID | None = Form(None),
    tags: str | None = Form(None),
) -> AssetOut:
    data, kind = await read_validated(file, ASSET_EXTS)
    if folder_id:
        await get_owned(db, Folder, folder_id, ctx.org_id)
    filename = file.filename or f"asset.{kind.ext}"
    key = make_key(ctx.org_id, "assets", filename)
    await get_storage().put(key, data, kind.mime)
    meta: dict[str, Any] = {**_image_size(data, kind.ext), "ext": kind.ext}
    if tags:
        meta["tags"] = [t.strip() for t in tags.split(",") if t.strip()][:20]
    a = Asset(organization_id=ctx.org_id, folder_id=folder_id, filename=filename, name=name or filename.rsplit(".", 1)[0], type=_asset_type(kind.family, kind.ext, type), mime_type=kind.mime, size_bytes=len(data), storage_key=key, meta=meta, uploaded_by=ctx.user.id)
    db.add(a)
    await audit(db, ctx, "asset.upload", "asset", a.id, {"filename": filename, "size": len(data)}, request)
    await db.commit()
    return (await _asset_out(db, [a]))[0]


@assets_router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> AssetOut:
    return (await _asset_out(db, [await get_owned(db, Asset, asset_id, ctx.org_id)]))[0]


@assets_router.get("/{asset_id}/file", summary="Download/stream the asset (auth required)")
async def asset_file(asset_id: uuid.UUID, ctx: CurrentCtx, db: DB, download: bool = False) -> Response:
    a = await get_owned(db, Asset, asset_id, ctx.org_id)
    data = await get_storage().get(a.storage_key)
    disp = "attachment" if download else "inline"
    headers = {"Content-Disposition": f'{disp}; filename="{a.filename}"', "Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"}
    if a.mime_type == "image/svg+xml":
        headers["Content-Security-Policy"] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    return Response(data, media_type=a.mime_type, headers=headers)


@assets_router.patch("/{asset_id}", response_model=AssetOut)
async def update_asset(asset_id: uuid.UUID, body: AssetUpdate, ctx: EditorCtx, db: DB) -> AssetOut:
    a = await get_owned(db, Asset, asset_id, ctx.org_id)
    if body.name is not None:
        a.name = body.name
    if body.type is not None:
        a.type = body.type
    if body.folder_id is not None:
        await get_owned(db, Folder, body.folder_id, ctx.org_id)
        a.folder_id = body.folder_id
    if body.clear_folder:
        a.folder_id = None
    if body.tags is not None:
        a.meta = {**(a.meta or {}), "tags": body.tags[:20]}
    await db.commit()
    return (await _asset_out(db, [a]))[0]


@assets_router.delete("/{asset_id}", status_code=204)
async def delete_asset(asset_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> None:
    a = await get_owned(db, Asset, asset_id, ctx.org_id)
    await get_storage().delete(a.storage_key)
    await audit(db, ctx, "asset.delete", "asset", a.id, {"filename": a.filename}, request)
    await db.delete(a)
    await db.commit()


# ---------------------------------------------------------------------------- AI Library documents


async def _doc_out(db: DB, items: list[Document]) -> list[DocumentOut]:
    ids = [d.id for d in items]
    counts: dict[uuid.UUID, int] = {}
    if ids:
        for did, n in (await db.execute(select(DocumentChunk.document_id, func.count()).where(DocumentChunk.document_id.in_(ids)).group_by(DocumentChunk.document_id))).all():
            counts[did] = n
    who = await authors(db, {d.uploaded_by for d in items})
    return [
        DocumentOut(
            id=d.id, filename=d.filename, title=d.title, category=d.category, mime_type=d.mime_type, size_bytes=d.size_bytes,
            status=d.status, summary=d.summary, meta=d.meta or {}, chunk_count=counts.get(d.id, 0),
            uploaded_by=who.get(d.uploaded_by) if d.uploaded_by else None, created_at=d.created_at,
        )
        for d in items
    ]


@documents_router.get("", response_model=list[DocumentOut])
async def list_documents(ctx: CurrentCtx, db: DB, category: str | None = None, q: str | None = None) -> list[DocumentOut]:
    stmt = select(Document).where(Document.organization_id == ctx.org_id)
    if category:
        stmt = stmt.where(Document.category == category)
    if q:
        stmt = stmt.where(or_(func.lower(Document.title).like(f"%{q.lower()}%"), func.lower(Document.filename).like(f"%{q.lower()}%")))
    return await _doc_out(db, list((await db.execute(stmt.order_by(Document.created_at.desc()).limit(500))).scalars()))


@documents_router.post("", response_model=DocumentOut, status_code=202, summary="Upload a document into the company AI context")
async def upload_document(ctx: EditorCtx, db: DB, request: Request, file: UploadFile = File(...), category: str = Form("auto"), title: str | None = Form(None)) -> DocumentOut:
    data, kind = await read_validated(file, DOCUMENT_EXTS)
    filename = file.filename or f"document.{kind.ext}"
    key = make_key(ctx.org_id, "documents", filename)
    await get_storage().put(key, data, kind.mime)
    d = Document(organization_id=ctx.org_id, filename=filename, title=title or filename.rsplit(".", 1)[0].replace("_", " ").replace("-", " "), category=category, mime_type=kind.mime, size_bytes=len(data), storage_key=key, status="queued", uploaded_by=ctx.user.id)
    db.add(d)
    await audit(db, ctx, "document.upload", "document", d.id, {"filename": filename, "size": len(data)}, request)
    await db.commit()
    await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="document.ingest", payload={"document_id": str(d.id)}, resource_type="document", resource_id=d.id)
    await db.refresh(d)
    return (await _doc_out(db, [d]))[0]


@documents_router.post("/text", response_model=DocumentOut, status_code=202, summary="Add pasted text (e.g. approved messaging) to the AI context")
async def add_text_document(body: DocumentTextIn, ctx: EditorCtx, db: DB) -> DocumentOut:
    data = body.text.encode()
    key = make_key(ctx.org_id, "documents", f"{body.title[:60]}.txt")
    await get_storage().put(key, data, "text/plain")
    d = Document(organization_id=ctx.org_id, filename=f"{body.title[:60]}.txt", title=body.title, category=body.category, mime_type="text/plain", size_bytes=len(data), storage_key=key, status="queued", uploaded_by=ctx.user.id)
    db.add(d)
    await db.commit()
    await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="document.ingest", payload={"document_id": str(d.id)}, resource_type="document", resource_id=d.id)
    await db.refresh(d)
    return (await _doc_out(db, [d]))[0]


@documents_router.post("/search", response_model=list[SearchHit], summary="Semantic retrieval over the company knowledge (RAG)")
async def search(body: SearchIn, ctx: CurrentCtx, db: DB) -> list[SearchHit]:
    return [SearchHit(**h) for h in await retrieve(db, ctx.org_id, body.query, body.k, body.categories)]


@documents_router.post("/reindex", response_model=list[JobOut], status_code=202, summary="Re-embed all documents (after changing embedding provider)")
async def reindex(ctx: EditorCtx, db: DB) -> list[JobOut]:
    if not ctx.can("admin"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Requires admin role")
    docs = list((await db.execute(select(Document).where(Document.organization_id == ctx.org_id))).scalars())
    out = []
    for d in docs:
        out.append(job_out(await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="document.ingest", payload={"document_id": str(d.id)}, resource_type="document", resource_id=d.id)))
    return out


@documents_router.get("/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> DocumentDetail:
    d = await get_owned(db, Document, document_id, ctx.org_id)
    return DocumentDetail(**(await _doc_out(db, [d]))[0].model_dump(), extracted_text=(d.extracted_text or "")[:50000])


@documents_router.patch("/{document_id}", response_model=DocumentOut)
async def update_document(document_id: uuid.UUID, ctx: EditorCtx, db: DB, title: str | None = Query(None, max_length=300), category: str | None = Query(None, max_length=40)) -> DocumentOut:
    d = await get_owned(db, Document, document_id, ctx.org_id)
    if title:
        d.title = title
    if category:
        d.category = category
    await db.commit()
    return (await _doc_out(db, [d]))[0]


@documents_router.post("/{document_id}/reprocess", response_model=JobOut, status_code=202)
async def reprocess(document_id: uuid.UUID, ctx: EditorCtx, db: DB) -> JobOut:
    d = await get_owned(db, Document, document_id, ctx.org_id)
    return job_out(await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="document.ingest", payload={"document_id": str(d.id)}, resource_type="document", resource_id=d.id))


@documents_router.delete("/{document_id}", status_code=204)
async def delete_document(document_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> None:
    d = await get_owned(db, Document, document_id, ctx.org_id)
    if d.storage_key:
        await get_storage().delete(d.storage_key)
    await audit(db, ctx, "document.delete", "document", d.id, {"filename": d.filename}, request)
    await db.delete(d)
    await db.commit()
