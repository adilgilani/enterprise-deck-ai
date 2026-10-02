"""Brand System helpers: the persistent company identity that every generator consumes."""

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Asset, BrandSystem
from app.schemas.deck import STYLES, Theme

ROLE_DEFAULTS = {
    "primary": "#2F5BD3",
    "secondary": "#1B2A4A",
    "accent": "#E3B866",
    "background": "#FFFFFF",
    "surface": "#F6F4EF",
    "text": "#1C1D21",
    "muted": "#6B6F7A",
}

DEFAULT_COLORS = [
    {"name": "Acme Blue", "hex": "#2F5BD3", "role": "primary"},
    {"name": "Midnight", "hex": "#1B2A4A", "role": "secondary"},
    {"name": "Gold", "hex": "#E3B866", "role": "accent"},
    {"name": "Paper", "hex": "#F6F4EF", "role": "surface"},
    {"name": "White", "hex": "#FFFFFF", "role": "background"},
    {"name": "Ink", "hex": "#1C1D21", "role": "text"},
    {"name": "Slate", "hex": "#6B6F7A", "role": "muted"},
]
DEFAULT_FONTS = {"heading": "Instrument Serif", "body": "Geist", "mono": "Geist Mono"}


async def get_brand(session: AsyncSession, org_id: uuid.UUID, brand_id: uuid.UUID | None = None) -> BrandSystem | None:
    q = select(BrandSystem).where(BrandSystem.organization_id == org_id)
    if brand_id:
        q = q.where(BrandSystem.id == brand_id)
    else:
        q = q.order_by(BrandSystem.is_default.desc(), BrandSystem.created_at)
    return (await session.execute(q.limit(1))).scalar_one_or_none()


def palette(brand: BrandSystem | None) -> dict[str, str]:
    out = dict(ROLE_DEFAULTS)
    for c in (brand.colors if brand else []) or []:
        role = c.get("role")
        if role in out and isinstance(c.get("hex"), str):
            out[role] = c["hex"]
    return out


async def logo_url(session: AsyncSession, brand: BrandSystem | None) -> str | None:
    if not brand or not brand.logo_asset_id:
        return None
    asset = await session.get(Asset, brand.logo_asset_id)
    return f"/api/v1/assets/{asset.id}/file" if asset else None


async def theme_for(session: AsyncSession, brand: BrandSystem | None, style: str | None = None) -> dict[str, Any]:
    st = style if style in STYLES else (brand.default_style if brand else "executive")
    profile = (brand.company_profile if brand else {}) or {}
    name = profile.get("name") or (brand.name if brand else "Acme")
    theme = Theme(
        style=st,  # type: ignore[arg-type]
        palette=palette(brand),  # type: ignore[arg-type]
        fonts={**DEFAULT_FONTS, **((brand.fonts if brand else {}) or {})},  # type: ignore[arg-type]
        logo_text=(profile.get("short_name") or name.split()[0]).upper()[:14],
        logo_url=await logo_url(session, brand),
    )
    return theme.model_dump()


def brand_context(brand: BrandSystem | None) -> dict[str, Any] | None:
    if brand is None:
        return None
    return {
        "name": brand.name,
        "company_profile": brand.company_profile,
        "tone_of_voice": brand.tone_of_voice,
        "approved_messaging": brand.approved_messaging,
        "brand_lock": brand.brand_lock,
        "guidelines": (brand.guidelines or "")[:2000],
        "visual_rules": brand.visual_rules,
    }


def compliance_report(brand: BrandSystem | None, theme: dict[str, Any], creative: bool) -> dict[str, Any]:
    """Checks a deck/proposal theme against the brand system. Brand Lock forces 100% compliance."""
    if brand is None:
        return {"score": 100, "checks": [], "brand_lock": False}
    pal = palette(brand)
    fonts = {**DEFAULT_FONTS, **(brand.fonts or {})}
    checks = [
        {"label": "Approved colors", "ok": all(theme.get("palette", {}).get(k, v).lower() == v.lower() for k, v in pal.items())},
        {"label": "Approved fonts", "ok": all(theme.get("fonts", {}).get(k) == v for k, v in fonts.items())},
        {"label": "Approved logo", "ok": True},
        {"label": "Approved visual style", "ok": theme.get("style") in STYLES},
        {"label": "Tone of voice", "ok": True},
    ]
    score = round(100 * sum(c["ok"] for c in checks) / len(checks))
    return {"score": score, "checks": checks, "brand_lock": brand.brand_lock and not creative, "creative_mode": creative}
