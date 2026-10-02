"""Central authentication, tenancy and authorization.

* The organization is NEVER taken from the client blindly: `X-Organization-Id` only selects among the
  caller's own memberships; anything else is 403.
* `get_owned` is the single way routes load tenant resources — a row from another organization is a 404
  (we don't reveal that it exists).
* Roles: owner > admin > editor > viewer.
"""

import hashlib
import time
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated, Any, TypeVar

import jwt
from fastapi import Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import org_id_var, user_id_var
from app.core.security import decode_token
from app.db.base import utcnow
from app.db.session import get_db
from app.models import ApiKey, AuditLog, AuthSession, Membership, Organization, User

ROLE_RANK = {"viewer": 0, "editor": 1, "admin": 2, "owner": 3}
ROLES = tuple(ROLE_RANK)

DB = Annotated[AsyncSession, Depends(get_db)]
T = TypeVar("T")


@dataclass
class Ctx:
    user: User
    org: Organization
    role: str
    session_id: uuid.UUID | None = None
    via_api_key: bool = False

    @property
    def org_id(self) -> uuid.UUID:
        return self.org.id

    def can(self, min_role: str) -> bool:
        return ROLE_RANK.get(self.role, -1) >= ROLE_RANK[min_role]


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


async def _user_from_token(db: AsyncSession, token: str) -> tuple[User, uuid.UUID]:
    try:
        payload = decode_token(token, "access")
    except jwt.ExpiredSignatureError as e:
        raise _unauthorized("Session expired") from e
    except jwt.InvalidTokenError as e:
        raise _unauthorized("Invalid token") from e
    sid = uuid.UUID(payload["sid"])
    sess = await db.get(AuthSession, sid)
    if sess is None or sess.revoked_at is not None:
        raise _unauthorized("Session revoked")
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("User disabled")
    now = utcnow()
    last = sess.last_seen_at if sess.last_seen_at.tzinfo else sess.last_seen_at.replace(tzinfo=now.tzinfo)
    if now - last > timedelta(minutes=5):
        sess.last_seen_at = now
        await db.commit()
    return user, sid


async def get_ctx(
    request: Request,
    db: DB,
    authorization: Annotated[str | None, Header()] = None,
    x_organization_id: Annotated[str | None, Header()] = None,
) -> Ctx:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise _unauthorized()
    token = authorization.split(" ", 1)[1].strip()

    if token.startswith("eai_"):
        key = (
            await db.execute(select(ApiKey).where(ApiKey.key_hash == hashlib.sha256(token.encode()).hexdigest()))
        ).scalar_one_or_none()
        if key is None or key.revoked_at is not None:
            raise _unauthorized("Invalid API key")
        org = await db.get(Organization, key.organization_id)
        user = await db.get(User, key.created_by) if key.created_by else None
        if org is None or user is None:
            raise _unauthorized("Invalid API key")
        key.last_used_at = utcnow()
        await db.commit()
        ctx = Ctx(user=user, org=org, role="editor", via_api_key=True)
    else:
        user, sid = await _user_from_token(db, token)
        rows = (
            await db.execute(
                select(Membership, Organization)
                .join(Organization, Organization.id == Membership.organization_id)
                .where(Membership.user_id == user.id)
                .order_by(Membership.created_at)
            )
        ).all()
        if not rows:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of any workspace")
        chosen = rows[0]
        if x_organization_id:
            try:
                wanted = uuid.UUID(x_organization_id)
            except ValueError as e:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Malformed X-Organization-Id") from e
            match = next((r for r in rows if r[1].id == wanted), None)
            if match is None:
                raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of this workspace")
            chosen = match
        membership, org = chosen
        ctx = Ctx(user=user, org=org, role=membership.role, session_id=sid)

    request.state.user_id = str(ctx.user.id)
    request.state.org_id = str(ctx.org.id)
    user_id_var.set(str(ctx.user.id))
    org_id_var.set(str(ctx.org.id))
    return ctx


CurrentCtx = Annotated[Ctx, Depends(get_ctx)]


def require_role(min_role: str) -> Any:
    async def dep(ctx: CurrentCtx) -> Ctx:
        if not ctx.can(min_role):
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Requires {min_role} role or higher")
        return ctx

    return Depends(dep)


EditorCtx = Annotated[Ctx, require_role("editor")]
AdminCtx = Annotated[Ctx, require_role("admin")]
OwnerCtx = Annotated[Ctx, require_role("owner")]


async def get_owned(db: AsyncSession, model: type[T], id_: uuid.UUID, org_id: uuid.UUID) -> T:
    obj = await db.get(model, id_)
    if obj is None or getattr(obj, "organization_id", None) != org_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} not found")  # type: ignore[attr-defined]
    return obj


async def audit(
    db: AsyncSession,
    ctx: Ctx | None,
    action: str,
    resource: str | None = None,
    resource_id: Any = None,
    meta: dict[str, Any] | None = None,
    request: Request | None = None,
    org_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
) -> None:
    db.add(
        AuditLog(
            organization_id=ctx.org_id if ctx else org_id,
            user_id=ctx.user.id if ctx else user_id,
            action=action,
            resource=resource,
            resource_id=str(resource_id) if resource_id is not None else None,
            meta=meta or {},
            ip_address=request.client.host if request and request.client else None,
        )
    )


# ---------------------------------------------------------------------------- rate limiting


class RateLimiter:
    """In-process sliding-window limiter. Interface is deliberately small so a Redis-backed implementation
    can replace it for multi-instance deployments."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def hit(self, key: str, limit: int, window: float = 60.0) -> bool:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()


limiter = RateLimiter()


def rate_limit(bucket: str) -> Any:
    async def dep(request: Request) -> None:
        """Per-client-IP limit for unauthenticated endpoints (login, signup, public share links)."""
        who = request.client.host if request.client else "anon"
        if not limiter.hit(f"{bucket}:{who}", get_settings().rate_limit_auth_per_minute):
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Rate limit exceeded — please slow down", headers={"Retry-After": "60"})

    return Depends(dep)


async def _ai_limited(ctx: EditorCtx) -> Ctx:
    """Editor role + per-user AI rate limit, for endpoints that trigger LLM work."""
    if not limiter.hit(f"ai:{ctx.user.id}", get_settings().rate_limit_ai_per_minute):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "AI rate limit exceeded — please wait a moment", headers={"Retry-After": "60"})
    return ctx


AICtx = Annotated[Ctx, Depends(_ai_limited)]
