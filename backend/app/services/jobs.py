"""Background jobs.

Long-running work (generation, meeting processing, ingestion, exports) never blocks a request.
`enqueue` persists a Job row (queued → processing → completed | failed) and dispatches it to:

    JOB_BACKEND=inline  asyncio task inside the API process (zero-dependency local dev)
    JOB_BACKEND=arq     Redis queue consumed by `arq app.worker.WorkerSettings` (Docker / production)
    JOB_BACKEND=eager   awaited inside the request (tests)

The frontend polls GET /api/v1/jobs/{id} for status, progress and the current step label.
"""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.logging import get_logger, org_id_var
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.models import Job

log = get_logger(__name__)


class JobContext:
    def __init__(self, session: AsyncSession, job: Job) -> None:
        self.session = session
        self.job = job

    async def progress(self, pct: int, step: str) -> None:
        self.job.progress = max(self.job.progress, min(pct, 99))
        self.job.step = step
        await self.session.commit()


Handler = Callable[[JobContext], Awaitable[dict[str, Any]]]
HANDLERS: dict[str, Handler] = {}
_running: set[asyncio.Task[None]] = set()
_arq_pool: Any = None


def handler(job_type: str) -> Callable[[Handler], Handler]:
    def deco(fn: Handler) -> Handler:
        HANDLERS[job_type] = fn
        return fn

    return deco


async def enqueue(
    session: AsyncSession,
    *,
    org_id: uuid.UUID,
    user_id: uuid.UUID | None,
    job_type: str,
    payload: dict[str, Any],
    resource_type: str | None = None,
    resource_id: uuid.UUID | None = None,
) -> Job:
    if job_type not in HANDLERS:
        raise ValueError(f"unknown job type {job_type}")
    job = Job(
        organization_id=org_id,
        created_by=user_id,
        type=job_type,
        payload=payload,
        resource_type=resource_type,
        resource_id=resource_id,
        step="Queued",
    )
    session.add(job)
    await session.commit()
    backend = get_settings().job_backend
    log.info("job queued", extra={"data": {"job_id": str(job.id), "type": job_type, "backend": backend}})
    if backend == "eager":
        await run_job(job.id)
        await session.refresh(job)
    elif backend == "arq":
        pool = await _get_arq_pool()
        await pool.enqueue_job("arq_run_job", str(job.id), _job_id=str(job.id))
    else:
        task = asyncio.create_task(run_job(job.id))
        _running.add(task)
        task.add_done_callback(_running.discard)
    return job


async def run_job(job_id: uuid.UUID) -> None:
    async with SessionLocal() as session:
        job = await session.get(Job, job_id)
        if job is None:
            log.error("job not found", extra={"data": {"job_id": str(job_id)}})
            return
        if job.status in ("completed", "failed"):
            return
        org_id_var.set(str(job.organization_id))
        job.status = "processing"
        job.started_at = utcnow()
        job.step = "Starting"
        await session.commit()
        ctx = JobContext(session, job)
        try:
            result = await HANDLERS[job.type](ctx)
            await session.refresh(job)
            job.status = "completed"
            job.progress = 100
            job.step = "Done"
            job.result = result or {}
            job.finished_at = utcnow()
            await session.commit()
            log.info("job completed", extra={"data": {"job_id": str(job.id), "type": job.type}})
        except Exception as e:
            await session.rollback()
            job = await session.get(Job, job_id)
            if job is not None:
                job.status = "failed"
                job.error = str(e)[:2000] or type(e).__name__
                job.finished_at = utcnow()
                await session.commit()
            log.exception("job failed", extra={"data": {"job_id": str(job_id)}})


async def _get_arq_pool() -> Any:
    global _arq_pool
    if _arq_pool is None:
        from arq import create_pool
        from arq.connections import RedisSettings

        _arq_pool = await create_pool(RedisSettings.from_dsn(get_settings().redis_url))
    return _arq_pool


async def drain() -> None:
    """Wait for in-process jobs (used on shutdown and in tests)."""
    while _running:
        await asyncio.gather(*list(_running), return_exceptions=True)
