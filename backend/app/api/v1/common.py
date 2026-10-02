"""Helpers shared by resource routers: favorites, sharing, job output."""

import uuid
from datetime import timedelta

from fastapi import HTTPException, Request, status
from sqlalchemy import delete, select

from app.api.deps import DB, Ctx, audit
from app.core.config import get_settings
from app.core.security import generate_share_token, hash_password
from app.db.base import utcnow
from app.models import Favorite, Job, ShareLink, User
from app.schemas.api import AuthorOut, JobOut, ShareIn, ShareOut


async def favorite_ids(db: DB, ctx: Ctx, resource_type: str) -> set[uuid.UUID]:
    rows = await db.execute(
        select(Favorite.resource_id).where(Favorite.user_id == ctx.user.id, Favorite.resource_type == resource_type)
    )
    return set(rows.scalars())


async def set_favorite(db: DB, ctx: Ctx, resource_type: str, resource_id: uuid.UUID, on: bool) -> None:
    await db.execute(
        delete(Favorite).where(
            Favorite.user_id == ctx.user.id, Favorite.resource_type == resource_type, Favorite.resource_id == resource_id
        )
    )
    if on:
        db.add(Favorite(user_id=ctx.user.id, organization_id=ctx.org_id, resource_type=resource_type, resource_id=resource_id))
    await db.commit()


async def authors(db: DB, ids: set[uuid.UUID | None]) -> dict[uuid.UUID, AuthorOut]:
    clean = {i for i in ids if i}
    if not clean:
        return {}
    rows = (await db.execute(select(User).where(User.id.in_(clean)))).scalars()
    return {u.id: AuthorOut(id=u.id, name=u.name) for u in rows}


def share_out(link: ShareLink) -> ShareOut:
    base = get_settings().public_app_url.rstrip("/")
    return ShareOut(
        id=link.id,
        token=link.token,
        url=f"{base}/s/{link.token}",
        audience=link.audience,
        allow_download=link.allow_download,
        has_password=link.password_hash is not None,
        expires_at=link.expires_at,
        created_at=link.created_at,
        view_count=link.view_count,
        resource_type=link.resource_type,
    )


async def create_share(db: DB, ctx: Ctx, resource_type: str, resource_id: uuid.UUID, body: ShareIn, request: Request) -> ShareOut:
    link = ShareLink(
        organization_id=ctx.org_id,
        resource_type=resource_type,
        resource_id=resource_id,
        token=generate_share_token(),
        audience=body.audience,
        allow_download=body.allow_download,
        password_hash=hash_password(body.password) if body.password else None,
        expires_at=utcnow() + timedelta(days=body.expires_in_days) if body.expires_in_days else None,
        created_by=ctx.user.id,
    )
    db.add(link)
    await audit(db, ctx, "share.create", resource_type, resource_id, {"audience": body.audience, "download": body.allow_download, "password": bool(body.password)}, request)
    await db.commit()
    return share_out(link)


async def list_shares(db: DB, ctx: Ctx, resource_type: str, resource_id: uuid.UUID) -> list[ShareOut]:
    rows = (
        await db.execute(
            select(ShareLink)
            .where(
                ShareLink.organization_id == ctx.org_id,
                ShareLink.resource_type == resource_type,
                ShareLink.resource_id == resource_id,
                ShareLink.revoked_at.is_(None),
            )
            .order_by(ShareLink.created_at.desc())
        )
    ).scalars()
    return [share_out(link) for link in rows]


def job_out(job: Job) -> JobOut:
    return JobOut.model_validate(job)


def ensure(cond: bool, code: int, msg: str) -> None:
    if not cond:
        raise HTTPException(code, msg)


NOT_FOUND = status.HTTP_404_NOT_FOUND
