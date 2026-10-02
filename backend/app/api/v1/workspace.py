"""Team, workspace settings (AI, security, API keys), analytics, audit logs and job status."""

import hashlib
import secrets
import uuid
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import Response
from sqlalchemy import func, select

from app.api.deps import DB, AdminCtx, CurrentCtx, OwnerCtx, audit, get_owned
from app.api.v1.common import job_out
from app.core.config import get_settings
from app.core.security import generate_api_key
from app.db.base import utcnow
from app.models import (
    AIGeneration,
    ApiKey,
    AuditLog,
    BrandSystem,
    Document,
    Invitation,
    Job,
    Meeting,
    Membership,
    Organization,
    Presentation,
    PresentationSlide,
    Proposal,
    Template,
    User,
)
from app.schemas.api import (
    AISettings,
    AISettingsOut,
    ApiKeyCreated,
    ApiKeyIn,
    ApiKeyOut,
    AuditLogOut,
    AuthorOut,
    InvitationCreated,
    InvitationOut,
    InviteIn,
    JobOut,
    MemberOut,
    MemberUpdate,
    OrgOut,
    UserOut,
    WorkspaceUpdate,
)
from app.services.ai.providers import get_provider
from app.services.storage import get_storage

team_router = APIRouter(prefix="/team", tags=["team"])
settings_router = APIRouter(prefix="/settings", tags=["settings"])
analytics_router = APIRouter(tags=["analytics"])
jobs_router = APIRouter(prefix="/jobs", tags=["jobs"])

# ---------------------------------------------------------------------------- team


@team_router.get("/members", response_model=list[MemberOut])
async def members(ctx: CurrentCtx, db: DB) -> list[MemberOut]:
    rows = (
        await db.execute(
            select(Membership, User).join(User, User.id == Membership.user_id).where(Membership.organization_id == ctx.org_id).order_by(Membership.created_at)
        )
    ).all()
    stats: dict[uuid.UUID, dict[str, int]] = {}
    for model, key in ((Presentation, "presentations"), (Proposal, "proposals"), (Meeting, "meetings")):
        for uid, n in (await db.execute(select(model.created_by, func.count()).where(model.organization_id == ctx.org_id).group_by(model.created_by))).all():
            if uid:
                stats.setdefault(uid, {})[key] = n
    return [
        MemberOut(id=m.id, user=UserOut.model_validate(u), role=m.role, department=m.department, title=m.title,  # type: ignore[arg-type]
                  last_active_at=u.last_login_at, created_at=m.created_at, stats=stats.get(u.id, {}))
        for m, u in rows
    ]


@team_router.patch("/members/{member_id}", response_model=MemberOut)
async def update_member(member_id: uuid.UUID, body: MemberUpdate, ctx: AdminCtx, db: DB, request: Request) -> MemberOut:
    m = await get_owned(db, Membership, member_id, ctx.org_id)
    if body.role is not None and body.role != m.role:
        if (m.role == "owner" or body.role == "owner") and not ctx.can("owner"):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Only owners can grant or remove the owner role")
        if m.role == "owner":
            owners = (await db.execute(select(func.count()).select_from(Membership).where(Membership.organization_id == ctx.org_id, Membership.role == "owner"))).scalar_one()
            if owners <= 1:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "A workspace must keep at least one owner")
        await audit(db, ctx, "team.role_change", "membership", m.id, {"from": m.role, "to": body.role}, request)
        m.role = body.role
    if body.department is not None:
        m.department = body.department
    if body.title is not None:
        m.title = body.title
    await db.commit()
    u = await db.get(User, m.user_id)
    assert u is not None
    return MemberOut(id=m.id, user=UserOut.model_validate(u), role=m.role, department=m.department, title=m.title, last_active_at=u.last_login_at, created_at=m.created_at)  # type: ignore[arg-type]


@team_router.delete("/members/{member_id}", status_code=204)
async def remove_member(member_id: uuid.UUID, ctx: AdminCtx, db: DB, request: Request) -> None:
    m = await get_owned(db, Membership, member_id, ctx.org_id)
    if m.user_id == ctx.user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You cannot remove yourself")
    if m.role == "owner" and not ctx.can("owner"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only owners can remove owners")
    await audit(db, ctx, "team.remove", "membership", m.id, {"user_id": str(m.user_id)}, request)
    await db.delete(m)
    await db.commit()


@team_router.get("/invitations", response_model=list[InvitationOut])
async def invitations(ctx: AdminCtx, db: DB) -> list[InvitationOut]:
    rows = (await db.execute(select(Invitation).where(Invitation.organization_id == ctx.org_id, Invitation.status == "pending").order_by(Invitation.created_at.desc()))).scalars()
    return [InvitationOut.model_validate(i) for i in rows]


@team_router.post("/invitations", response_model=InvitationCreated, status_code=201)
async def invite(body: InviteIn, ctx: AdminCtx, db: DB, request: Request) -> InvitationCreated:
    if body.role == "owner" and not ctx.can("owner"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only owners can invite owners")
    existing = (
        await db.execute(select(Membership).join(User, User.id == Membership.user_id).where(Membership.organization_id == ctx.org_id, func.lower(User.email) == body.email.lower()))
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "This person is already a member")
    token = secrets.token_urlsafe(32)
    inv = Invitation(organization_id=ctx.org_id, email=body.email.lower(), role=body.role, department=body.department, token_hash=hashlib.sha256(token.encode()).hexdigest(), invited_by=ctx.user.id, expires_at=utcnow() + timedelta(days=14))
    db.add(inv)
    await audit(db, ctx, "team.invite", "invitation", inv.id, {"email": body.email, "role": body.role}, request)
    await db.commit()
    # Email delivery is an integration point; the link is returned so admins can share it directly.
    return InvitationCreated(**InvitationOut.model_validate(inv).model_dump(), invite_url=f"{get_settings().public_app_url.rstrip('/')}/invite/{token}")


@team_router.delete("/invitations/{invitation_id}", status_code=204)
async def revoke_invite(invitation_id: uuid.UUID, ctx: AdminCtx, db: DB) -> None:
    inv = await get_owned(db, Invitation, invitation_id, ctx.org_id)
    inv.status = "revoked"
    await db.commit()


@team_router.get("/activity", response_model=list[AuditLogOut])
async def activity(ctx: CurrentCtx, db: DB, limit: int = Query(30, le=100)) -> list[AuditLogOut]:
    return await _audit_rows(db, ctx.org_id, limit, None, exclude_auth=True)


# ---------------------------------------------------------------------------- settings


@settings_router.get("/workspace", response_model=OrgOut)
async def workspace(ctx: CurrentCtx) -> OrgOut:
    return OrgOut.model_validate(ctx.org)


@settings_router.patch("/workspace", response_model=OrgOut)
async def update_workspace(body: WorkspaceUpdate, ctx: AdminCtx, db: DB, request: Request) -> OrgOut:
    org = await db.get(Organization, ctx.org_id)
    assert org is not None
    if body.slug and body.slug != org.slug:
        if (await db.execute(select(Organization.id).where(Organization.slug == body.slug))).first():
            raise HTTPException(status.HTTP_409_CONFLICT, "That workspace URL is taken")
        org.slug = body.slug
    if body.name:
        org.name = body.name
    await audit(db, ctx, "settings.workspace", "organization", org.id, body.model_dump(exclude_unset=True), request)
    await db.commit()
    return OrgOut.model_validate(org)


def _ai_out(org: Organization) -> AISettingsOut:
    s = get_settings()
    provider = get_provider()
    stored = (org.settings or {}).get("ai", {})
    base = AISettings.model_validate({**AISettings().model_dump(), **stored})
    configured = s.llm_provider == "mock" or (s.llm_provider == "qwen" and s.qwen_api_key is not None) or (s.llm_provider == "openai_compatible" and bool(s.openai_compatible_base_url))
    return AISettingsOut(**base.model_dump(), provider=provider.name, provider_model=provider.model, stt_provider_en=s.stt_provider_en, stt_provider_ur=s.stt_provider_ur, embedding_provider=s.embedding_provider, configured=configured)


@settings_router.get("/ai", response_model=AISettingsOut, summary="AI configuration (provider secrets are never returned)")
async def ai_settings(ctx: CurrentCtx) -> AISettingsOut:
    return _ai_out(ctx.org)


@settings_router.put("/ai", response_model=AISettingsOut)
async def update_ai_settings(body: AISettings, ctx: AdminCtx, db: DB, request: Request) -> AISettingsOut:
    org = await db.get(Organization, ctx.org_id)
    assert org is not None
    org.settings = {**(org.settings or {}), "ai": body.model_dump()}
    await audit(db, ctx, "settings.ai", "organization", org.id, {"model": body.model, "temperature": body.temperature}, request)
    await db.commit()
    return _ai_out(org)


@settings_router.get("/api-keys", response_model=list[ApiKeyOut])
async def api_keys(ctx: AdminCtx, db: DB) -> list[ApiKeyOut]:
    rows = (await db.execute(select(ApiKey).where(ApiKey.organization_id == ctx.org_id).order_by(ApiKey.created_at.desc()))).scalars()
    return [ApiKeyOut.model_validate(k) for k in rows]


@settings_router.post("/api-keys", response_model=ApiKeyCreated, status_code=201, summary="Create an API key (plaintext shown once)")
async def create_api_key(body: ApiKeyIn, ctx: AdminCtx, db: DB, request: Request) -> ApiKeyCreated:
    raw, prefix, digest = generate_api_key()
    k = ApiKey(organization_id=ctx.org_id, name=body.name, prefix=prefix, key_hash=digest, created_by=ctx.user.id)
    db.add(k)
    await audit(db, ctx, "settings.api_key_create", "api_key", k.id, {"name": body.name}, request)
    await db.commit()
    return ApiKeyCreated(**ApiKeyOut.model_validate(k).model_dump(), key=raw)


@settings_router.delete("/api-keys/{key_id}", status_code=204)
async def revoke_api_key(key_id: uuid.UUID, ctx: AdminCtx, db: DB, request: Request) -> None:
    k = await get_owned(db, ApiKey, key_id, ctx.org_id)
    k.revoked_at = utcnow()
    await audit(db, ctx, "settings.api_key_revoke", "api_key", k.id, request=request)
    await db.commit()


@settings_router.delete("/workspace", status_code=204, summary="Delete the workspace and all its data")
async def delete_workspace(ctx: OwnerCtx, db: DB, confirm: str = Query(...)) -> None:
    if confirm != ctx.org.slug:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Type the workspace slug to confirm")
    org = await db.get(Organization, ctx.org_id)
    await db.delete(org)
    await db.commit()


# ---------------------------------------------------------------------------- analytics & audit


async def _audit_rows(db: DB, org_id: uuid.UUID, limit: int, action: str | None, exclude_auth: bool = False) -> list[AuditLogOut]:
    stmt = select(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id).where(AuditLog.organization_id == org_id)
    if action:
        stmt = stmt.where(AuditLog.action.like(f"{action}%"))
    if exclude_auth:
        stmt = stmt.where(~AuditLog.action.like("auth.%"))
    rows = (await db.execute(stmt.order_by(AuditLog.created_at.desc()).limit(limit))).all()
    return [
        AuditLogOut(id=a.id, action=a.action, resource=a.resource, resource_id=a.resource_id, meta=a.meta or {}, ip_address=a.ip_address,
                    user=AuthorOut(id=u.id, name=u.name) if u else None, created_at=a.created_at)
        for a, u in rows
    ]


@analytics_router.get("/audit-logs", response_model=list[AuditLogOut], tags=["audit"])
async def audit_logs(ctx: AdminCtx, db: DB, limit: int = Query(100, le=500), action: str | None = None) -> list[AuditLogOut]:
    return await _audit_rows(db, ctx.org_id, limit, action)


# Minutes saved per artifact vs. manual creation — conservative internal benchmarks.
TIME_SAVED_MIN = {"presentation": 180, "proposal": 300, "meeting": 45, "slide_edit": 6}


@analytics_router.get("/analytics", summary="Workspace usage analytics")
async def analytics(ctx: CurrentCtx, db: DB, days: int = Query(90, ge=7, le=365)) -> dict[str, Any]:
    org = ctx.org_id
    since = utcnow() - timedelta(days=days)

    async def count(model: Any, *where: Any) -> int:
        return int((await db.execute(select(func.count()).select_from(model).where(model.organization_id == org, *where))).scalar_one())

    presentations = await count(Presentation)
    proposals = await count(Proposal)
    meetings = await count(Meeting, Meeting.started_at.is_not(None))
    slides = int((await db.execute(select(func.count()).select_from(PresentationSlide).join(Presentation).where(Presentation.organization_id == org))).scalar_one())
    gens = int((await db.execute(select(func.count()).select_from(AIGeneration).where(AIGeneration.organization_id == org))).scalar_one())
    gen_ok = int((await db.execute(select(func.count()).select_from(AIGeneration).where(AIGeneration.organization_id == org, AIGeneration.status != "failed"))).scalar_one())
    avg_latency = (await db.execute(select(func.avg(AIGeneration.latency_ms)).where(AIGeneration.organization_id == org))).scalar_one()
    tokens = (await db.execute(select(func.sum(AIGeneration.prompt_tokens), func.sum(AIGeneration.completion_tokens)).where(AIGeneration.organization_id == org))).one()
    edits = int((await db.execute(select(func.count()).select_from(AIGeneration).where(AIGeneration.organization_id == org, AIGeneration.task.like("%edit%")))).scalar_one())
    minutes = presentations * TIME_SAVED_MIN["presentation"] + proposals * TIME_SAVED_MIN["proposal"] + meetings * TIME_SAVED_MIN["meeting"] + edits * TIME_SAVED_MIN["slide_edit"]

    # weekly series
    def week_key(dt: Any) -> str:
        d = dt.date() - timedelta(days=dt.weekday())
        return d.isoformat()

    weeks: dict[str, dict[str, int]] = {}
    start = (utcnow() - timedelta(days=days)).date()
    cur = start - timedelta(days=start.weekday())
    while cur <= utcnow().date():
        weeks[cur.isoformat()] = {"presentations": 0, "proposals": 0, "meetings": 0, "ai_generations": 0}
        cur += timedelta(days=7)
    for model, key, col in ((Presentation, "presentations", Presentation.created_at), (Proposal, "proposals", Proposal.created_at), (Meeting, "meetings", Meeting.created_at), (AIGeneration, "ai_generations", AIGeneration.created_at)):
        for (dt,) in (await db.execute(select(col).where(model.organization_id == org, col >= since))).all():
            k = week_key(dt)
            if k in weeks:
                weeks[k][key] += 1

    templates = [{"name": n, "category": c, "uses": u} for n, c, u in (await db.execute(select(Template.name, Template.category, Template.usage_count).where(Template.organization_id == org).order_by(Template.usage_count.desc()).limit(6))).all()]
    brand_use = [
        {"name": n or "No brand", "uses": u}
        for n, u in (await db.execute(select(BrandSystem.name, func.count(Presentation.id)).outerjoin(Presentation, Presentation.brand_system_id == BrandSystem.id).where(BrandSystem.organization_id == org).group_by(BrandSystem.name).order_by(func.count(Presentation.id).desc()))).all()
    ]
    team = []
    for uid, name in (await db.execute(select(User.id, User.name).join(Membership, Membership.user_id == User.id).where(Membership.organization_id == org))).all():
        row = {"name": name}
        for model, key in ((Presentation, "presentations"), (Proposal, "proposals"), (Meeting, "meetings")):
            row[key] = int((await db.execute(select(func.count()).select_from(model).where(model.organization_id == org, model.created_by == uid))).scalar_one())
        row["total"] = row["presentations"] + row["proposals"] + row["meetings"]
        team.append(row)
    team.sort(key=lambda r: r["total"], reverse=True)
    deck_types: dict[str, int] = {}
    for (opts,) in (await db.execute(select(Presentation.options).where(Presentation.organization_id == org))).all():
        t = (opts or {}).get("deck_type") or "custom"
        deck_types[t] = deck_types.get(t, 0) + 1
    tasks = [{"task": t, "count": n} for t, n in (await db.execute(select(AIGeneration.task, func.count()).where(AIGeneration.organization_id == org).group_by(AIGeneration.task).order_by(func.count().desc()))).all()]
    proposal_value = (await db.execute(select(func.sum(Proposal.value)).where(Proposal.organization_id == org, Proposal.status == "won"))).scalar_one()
    pipeline_value = (await db.execute(select(func.sum(Proposal.value)).where(Proposal.organization_id == org, Proposal.status.in_(["sent", "ready", "internal_review", "draft"])))).scalar_one()
    docs = await count(Document, Document.status == "ready")
    return {
        "totals": {
            "presentations": presentations,
            "proposals": proposals,
            "meetings": meetings,
            "slides": slides,
            "ai_generations": gens,
            "ai_success_rate": round(100 * gen_ok / gens, 1) if gens else 100.0,
            "avg_latency_ms": int(avg_latency or 0),
            "prompt_tokens": int(tokens[0] or 0),
            "completion_tokens": int(tokens[1] or 0),
            "hours_saved": round(minutes / 60, 1),
            "documents": docs,
            "won_value": float(proposal_value or 0),
            "pipeline_value": float(pipeline_value or 0),
        },
        "weekly": [{"week": k, **v} for k, v in weeks.items()],
        "templates": templates,
        "brands": brand_use,
        "team": team[:10],
        "deck_types": [{"type": k, "count": v} for k, v in sorted(deck_types.items(), key=lambda x: -x[1])],
        "ai_tasks": tasks,
    }


# ---------------------------------------------------------------------------- jobs


@jobs_router.get("/{job_id}", response_model=JobOut, summary="Poll a background job")
async def get_job(job_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> JobOut:
    return job_out(await get_owned(db, Job, job_id, ctx.org_id))


@jobs_router.get("/{job_id}/download", summary="Download a completed export")
async def download(job_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> Response:
    job = await get_owned(db, Job, job_id, ctx.org_id)
    if job.status != "completed" or not (job.result or {}).get("storage_key"):
        raise HTTPException(status.HTTP_409_CONFLICT, "Export is not ready")
    data = await get_storage().get(job.result["storage_key"])
    return Response(data, media_type=job.result.get("content_type", "application/octet-stream"), headers={"Content-Disposition": f'attachment; filename="{job.result.get("filename", "export")}"'})
