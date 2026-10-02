import time
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.v1 import auth, brand, library, meetings, presentations, proposals, public, workspace
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger, org_id_var, request_id_var, user_id_var
from app.db.session import engine
from app.services import register_job_handlers
from app.services.ai.providers import get_provider
from app.services.storage import get_storage

settings = get_settings()
configure_logging(settings.log_level, settings.log_json)
log = get_logger("app")

DESCRIPTION = """
**VYRA** — Enterprise AI Presentation Infrastructure: presentations, proposals and meeting intelligence that all run
on one persistent **Brand System** and **Company AI Context**.

* Authenticate with `POST /api/v1/auth/login` and send `Authorization: Bearer <token>`.
* Optional `X-Organization-Id` selects one of *your* workspaces.
* Long-running work returns a **Job** — poll `GET /api/v1/jobs/{id}`.
* Live meeting audio streams over the WebSocket `/api/v1/meetings/{id}/live?ticket=…`.
"""


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    settings.validate_for_production()
    register_job_handlers()
    try:
        await get_storage().ensure_ready()
    except Exception as e:  # storage may come up after the API in docker
        log.warning("storage not ready at startup", extra={"data": {"error": str(e)[:200]}})
    log.info(
        "api started",
        extra={"data": {"env": settings.environment, "db": settings.database_url.split("://")[0], "llm": settings.llm_provider, "jobs": settings.job_backend, "storage": settings.storage_provider}},
    )
    yield
    from app.services.jobs import drain

    await drain()
    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description=DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "X-Organization-Id", "X-Request-Id", "X-Share-Password"],
    expose_headers=["X-Request-Id", "Content-Disposition"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
    request_id_var.set(rid)
    user_id_var.set(None)
    org_id_var.set(None)
    started = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception("unhandled error", extra={"data": {"path": request.url.path, "method": request.method}})
        response = JSONResponse({"detail": "Internal server error", "request_id": rid}, status_code=500)
    ms = int((time.perf_counter() - started) * 1000)
    response.headers["X-Request-Id"] = rid
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if request.url.path not in ("/health", "/api/v1/health"):
        log.info(
            f"{request.method} {request.url.path} {response.status_code}",
            extra={"data": {"status": response.status_code, "ms": ms, "user_id": getattr(request.state, "user_id", None), "org_id": getattr(request.state, "org_id", None)}},
        )
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [{"loc": [str(p) for p in e["loc"]], "msg": e["msg"]} for e in exc.errors()[:20]]
    first = errors[0] if errors else {"loc": [], "msg": "Invalid request"}
    field = ".".join(p for p in first["loc"] if p not in ("body", "query", "path"))
    return JSONResponse({"detail": f"{field}: {first['msg']}" if field else first["msg"], "errors": errors}, status_code=422)


api = APIRouter(prefix="/api/v1")
for r in (
    auth.router,
    brand.router,
    presentations.router,
    presentations.slides_router,
    presentations.folders_router,
    proposals.router,
    meetings.router,
    meetings.actions_router,
    library.templates_router,
    library.assets_router,
    library.documents_router,
    workspace.team_router,
    workspace.settings_router,
    workspace.analytics_router,
    workspace.jobs_router,
    public.router,
):
    api.include_router(r)


@api.get("/health", tags=["system"])
async def health() -> dict[str, object]:
    db_ok = True
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_ok = False
    provider = get_provider()
    return {
        "status": "ok" if db_ok else "degraded",
        "database": db_ok,
        "llm": {"provider": provider.name, "model": provider.model},
        "stt": {"en": settings.stt_provider_en, "ur": settings.stt_provider_ur},
        "storage": settings.storage_provider,
        "jobs": settings.job_backend,
    }


app.include_router(api)


@app.get("/health", include_in_schema=False)
async def root_health() -> dict[str, str]:
    return {"status": "ok"}
