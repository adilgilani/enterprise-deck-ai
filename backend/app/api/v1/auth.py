import hashlib
import re
import uuid
from datetime import timedelta

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import func, select

from app.api.deps import DB, CurrentCtx, audit, rate_limit
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.base import utcnow
from app.models import AuthSession, BrandSystem, Invitation, Membership, Organization, User
from app.schemas.api import (
    AcceptInviteIn,
    LoginIn,
    MeOut,
    MembershipBrief,
    OrgOut,
    RegisterIn,
    SessionOut,
    TokenOut,
    UserOut,
)
from app.services.brand import DEFAULT_COLORS, DEFAULT_FONTS

router = APIRouter(prefix="/auth", tags=["auth"])

# Equalize timing between "no such user" and "wrong password".
_DUMMY_HASH = hash_password("timing-equalizer-password")


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:50] or "workspace"


async def _unique_slug(db: DB, base: str) -> str:
    slug, n = base, 1
    while (await db.execute(select(Organization.id).where(Organization.slug == slug))).first():
        n += 1
        slug = f"{base}-{n}"
    return slug


async def build_me(db: DB, user: User, org: Organization, role: str) -> MeOut:
    rows = (
        await db.execute(
            select(Membership, Organization)
            .join(Organization, Organization.id == Membership.organization_id)
            .where(Membership.user_id == user.id)
            .order_by(Membership.created_at)
        )
    ).all()
    return MeOut(
        user=UserOut.model_validate(user),
        organization=OrgOut.model_validate(org),
        role=role,  # type: ignore[arg-type]
        memberships=[MembershipBrief(organization=OrgOut.model_validate(o), role=m.role) for m, o in rows],
    )


async def _issue(db: DB, request: Request, user: User, org: Organization, role: str) -> TokenOut:
    sess = AuthSession(
        user_id=user.id,
        user_agent=(request.headers.get("user-agent") or "")[:500],
        ip_address=request.client.host if request.client else None,
    )
    db.add(sess)
    user.last_login_at = utcnow()
    await db.flush()
    token = create_access_token(user.id, sess.id)
    me = await build_me(db, user, org, role)
    await db.commit()
    return TokenOut(access_token=token, expires_in=get_settings().access_token_ttl_minutes * 60, me=me)


@router.post("/register", response_model=TokenOut, status_code=201, dependencies=[rate_limit("auth")])
async def register(body: RegisterIn, request: Request, db: DB) -> TokenOut:
    """Create a user and a new company workspace (owner role) with a default Brand System."""
    email = body.email.lower()
    if (await db.execute(select(User.id).where(func.lower(User.email) == email))).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "An account with this email already exists")
    user = User(email=email, name=body.name.strip(), password_hash=hash_password(body.password))
    org = Organization(
        name=body.company_name.strip(),
        slug=await _unique_slug(db, slugify(body.company_name)),
        settings={"ai": {"temperature": 0.4, "default_slide_count": 10, "default_tone": "executive"}},
    )
    db.add_all([user, org])
    await db.flush()
    db.add(Membership(user_id=user.id, organization_id=org.id, role="owner"))
    db.add(
        BrandSystem(
            organization_id=org.id,
            name=f"{org.name} Brand",
            is_default=True,
            colors=DEFAULT_COLORS,
            fonts=DEFAULT_FONTS,
            company_profile={
                "name": org.name,
                "short_name": org.name.split()[0],
                "industry": body.industry or "",
                "website": body.website or "",
            },
            tone_of_voice={"summary": "Clear, confident and specific.", "do": [], "dont": []},
        )
    )
    await audit(db, None, "auth.register", "organization", org.id, request=request, org_id=org.id, user_id=user.id)
    return await _issue(db, request, user, org, "owner")


@router.post("/login", response_model=TokenOut, dependencies=[rate_limit("auth")])
async def login(body: LoginIn, request: Request, db: DB) -> TokenOut:
    user = (await db.execute(select(User).where(func.lower(User.email) == body.email.lower()))).scalar_one_or_none()
    if user is None or not user.password_hash:
        verify_password(body.password, _DUMMY_HASH)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    if not verify_password(body.password, user.password_hash) or not user.is_active:
        await audit(db, None, "auth.login_failed", "user", user.id, request=request, user_id=user.id)
        await db.commit()
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")
    row = (
        await db.execute(
            select(Membership, Organization)
            .join(Organization, Organization.id == Membership.organization_id)
            .where(Membership.user_id == user.id)
            .order_by(Membership.created_at)
            .limit(1)
        )
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You are not a member of any workspace")
    membership, org = row
    await audit(db, None, "auth.login", "user", user.id, request=request, org_id=org.id, user_id=user.id)
    return await _issue(db, request, user, org, membership.role)


@router.post("/accept-invite", response_model=TokenOut, dependencies=[rate_limit("auth")])
async def accept_invite(body: AcceptInviteIn, request: Request, db: DB) -> TokenOut:
    inv = (
        await db.execute(select(Invitation).where(Invitation.token_hash == hashlib.sha256(body.token.encode()).hexdigest()))
    ).scalar_one_or_none()
    now = utcnow()
    if inv is None or inv.status != "pending":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invitation is invalid or already used")
    exp = inv.expires_at if inv.expires_at.tzinfo else inv.expires_at.replace(tzinfo=now.tzinfo)
    if exp < now:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invitation has expired")
    user = (await db.execute(select(User).where(func.lower(User.email) == inv.email.lower()))).scalar_one_or_none()
    if user is None:
        user = User(email=inv.email.lower(), name=body.name, password_hash=hash_password(body.password))
        db.add(user)
        await db.flush()
    elif not user.password_hash or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "This email already has an account — use its password")
    exists = (
        await db.execute(select(Membership).where(Membership.user_id == user.id, Membership.organization_id == inv.organization_id))
    ).scalar_one_or_none()
    if exists is None:
        db.add(Membership(user_id=user.id, organization_id=inv.organization_id, role=inv.role, department=inv.department))
    inv.status = "accepted"
    org = await db.get(Organization, inv.organization_id)
    assert org is not None
    await audit(db, None, "team.invite_accepted", "user", user.id, request=request, org_id=org.id, user_id=user.id)
    return await _issue(db, request, user, org, exists.role if exists else inv.role)


@router.get("/me", response_model=MeOut)
async def me(ctx: CurrentCtx, db: DB) -> MeOut:
    return await build_me(db, ctx.user, ctx.org, ctx.role)


@router.post("/logout", status_code=204)
async def logout(ctx: CurrentCtx, db: DB) -> None:
    if ctx.session_id:
        sess = await db.get(AuthSession, ctx.session_id)
        if sess:
            sess.revoked_at = utcnow()
            await db.commit()


@router.get("/sessions", response_model=list[SessionOut])
async def sessions(ctx: CurrentCtx, db: DB) -> list[SessionOut]:
    cutoff = utcnow() - timedelta(days=30)
    rows = (
        await db.execute(
            select(AuthSession)
            .where(AuthSession.user_id == ctx.user.id, AuthSession.revoked_at.is_(None), AuthSession.last_seen_at >= cutoff)
            .order_by(AuthSession.last_seen_at.desc())
            .limit(20)
        )
    ).scalars()
    return [SessionOut.model_validate(s).model_copy(update={"current": s.id == ctx.session_id}) for s in rows]


@router.delete("/sessions/{session_id}", status_code=204)
async def revoke_session(session_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> None:
    sess = await db.get(AuthSession, session_id)
    if sess is None or sess.user_id != ctx.user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    sess.revoked_at = utcnow()
    await db.commit()
