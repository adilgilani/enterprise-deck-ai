import uuid
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, select, update

from app.api.deps import DB, AdminCtx, CurrentCtx, audit, get_owned
from app.models import Asset, BrandSystem, Document, Template
from app.schemas.api import BrandOut, BrandUpsert
from app.services import brand as brand_svc

router = APIRouter(prefix="/brand", tags=["brand"])


async def brand_out(db: DB, b: BrandSystem) -> BrandOut:
    profile = b.company_profile or {}
    out = BrandOut.model_validate(b)
    out.logo_url = await brand_svc.logo_url(db, b)
    out.completeness = {
        "company_profile": bool(profile.get("name") and profile.get("description")),
        "logo": b.logo_asset_id is not None,
        "colors": len(b.colors or []) >= 3,
        "fonts": bool((b.fonts or {}).get("heading")),
        "guidelines": len(b.guidelines or "") > 40,
        "tone_of_voice": bool((b.tone_of_voice or {}).get("summary")),
        "visual_rules": len(b.visual_rules or []) > 0,
        "approved_messaging": len(b.approved_messaging or []) > 0,
    }
    return out


async def _validate_refs(db: DB, ctx: CurrentCtx, body: BrandUpsert) -> None:
    if body.logo_asset_id:
        await get_owned(db, Asset, body.logo_asset_id, ctx.org_id)
    if body.default_template_id:
        await get_owned(db, Template, body.default_template_id, ctx.org_id)


def _apply(b: BrandSystem, body: BrandUpsert) -> None:
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(b, k, v)


@router.get("", response_model=BrandOut, summary="Default brand system for the workspace")
async def get_default(ctx: CurrentCtx, db: DB) -> BrandOut:
    b = await brand_svc.get_brand(db, ctx.org_id)
    if b is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No brand system configured")
    return await brand_out(db, b)


@router.get("/systems", response_model=list[BrandOut])
async def list_brands(ctx: CurrentCtx, db: DB) -> list[BrandOut]:
    rows = (
        await db.execute(select(BrandSystem).where(BrandSystem.organization_id == ctx.org_id).order_by(BrandSystem.is_default.desc(), BrandSystem.name))
    ).scalars()
    return [await brand_out(db, b) for b in rows]


@router.post("", response_model=BrandOut, status_code=201, summary="Create a brand system")
async def create_brand(body: BrandUpsert, ctx: AdminCtx, db: DB, request: Request) -> BrandOut:
    await _validate_refs(db, ctx, body)
    count = (await db.execute(select(func.count()).select_from(BrandSystem).where(BrandSystem.organization_id == ctx.org_id))).scalar_one()
    b = BrandSystem(
        organization_id=ctx.org_id,
        name=body.name or f"{ctx.org.name} Brand",
        is_default=count == 0,
        colors=brand_svc.DEFAULT_COLORS,
        fonts=brand_svc.DEFAULT_FONTS,
    )
    _apply(b, body)
    db.add(b)
    await audit(db, ctx, "brand.create", "brand_system", b.id, request=request)
    await db.commit()
    return await brand_out(db, b)


@router.get("/{brand_id}", response_model=BrandOut)
async def get_brand(brand_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> BrandOut:
    return await brand_out(db, await get_owned(db, BrandSystem, brand_id, ctx.org_id))


@router.patch("/{brand_id}", response_model=BrandOut)
async def update_brand(brand_id: uuid.UUID, body: BrandUpsert, ctx: AdminCtx, db: DB, request: Request) -> BrandOut:
    b = await get_owned(db, BrandSystem, brand_id, ctx.org_id)
    await _validate_refs(db, ctx, body)
    _apply(b, body)
    await audit(db, ctx, "brand.update", "brand_system", b.id, {"fields": sorted(body.model_dump(exclude_unset=True))}, request)
    await db.commit()
    await db.refresh(b)
    return await brand_out(db, b)


@router.delete("/{brand_id}", status_code=204, summary="Delete a brand system (not the default)")
async def delete_brand(brand_id: uuid.UUID, ctx: AdminCtx, db: DB, request: Request) -> None:
    b = await get_owned(db, BrandSystem, brand_id, ctx.org_id)
    if b.is_default:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Make another brand the default before deleting this one")
    await audit(db, ctx, "brand.delete", "brand_system", b.id, {"name": b.name}, request)
    await db.delete(b)
    await db.commit()


@router.post("/{brand_id}/default", response_model=BrandOut)
async def make_default(brand_id: uuid.UUID, ctx: AdminCtx, db: DB) -> BrandOut:
    b = await get_owned(db, BrandSystem, brand_id, ctx.org_id)
    await db.execute(update(BrandSystem).where(BrandSystem.organization_id == ctx.org_id).values(is_default=False))
    b.is_default = True
    await db.commit()
    return await brand_out(db, b)


@router.get("/context/summary", summary="What the AI already knows about this company (shown in builders)")
async def context_summary(ctx: CurrentCtx, db: DB) -> dict[str, Any]:
    b = await brand_svc.get_brand(db, ctx.org_id)
    docs = (await db.execute(select(Document.category, func.count()).where(Document.organization_id == ctx.org_id, Document.status == "ready").group_by(Document.category))).all()
    templates = (await db.execute(select(func.count()).select_from(Template).where(Template.organization_id == ctx.org_id, Template.approved.is_(True)))).scalar_one()
    by_cat = {c: n for c, n in docs}
    profile = (b.company_profile if b else {}) or {}
    return {
        "brand_id": str(b.id) if b else None,
        "brand_name": b.name if b else None,
        "company_name": profile.get("name") or ctx.org.name,
        "brand_lock": bool(b and b.brand_lock),
        "default_style": b.default_style if b else "executive",
        "colors": (b.colors if b else [])[:5],
        "fonts": (b.fonts if b else {}) or {},
        "checks": [
            {"label": "Brand guidelines", "ok": bool(b and len(b.guidelines or "") > 40)},
            {"label": "Logo", "ok": bool(b and b.logo_asset_id)},
            {"label": "Templates", "ok": templates > 0, "count": templates},
            {"label": "Company profile", "ok": bool(profile.get("description"))},
            {"label": "Approved messaging", "ok": bool(b and b.approved_messaging)},
            {"label": "Company knowledge", "ok": sum(by_cat.values()) > 0, "count": sum(by_cat.values())},
        ],
        "knowledge": by_cat,
    }
