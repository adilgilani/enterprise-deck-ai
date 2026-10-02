"""arq worker entrypoint:  arq app.worker.WorkerSettings

Consumes jobs enqueued by the API when JOB_BACKEND=arq.
"""

import uuid
from typing import Any

from arq.connections import RedisSettings

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services import register_job_handlers
from app.services.jobs import run_job


async def arq_run_job(ctx: dict[str, Any], job_id: str) -> None:
    await run_job(uuid.UUID(job_id))


async def startup(ctx: dict[str, Any]) -> None:
    s = get_settings()
    configure_logging(s.log_level, s.log_json)
    register_job_handlers()


class WorkerSettings:
    functions = [arq_run_job]
    on_startup = startup
    redis_settings = RedisSettings.from_dsn(get_settings().redis_url)
    max_jobs = 8
    job_timeout = 60 * 30
