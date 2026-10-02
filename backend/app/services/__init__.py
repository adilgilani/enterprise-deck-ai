def register_job_handlers() -> None:
    """Import every module that registers @handler job types (API process and arq worker)."""
    from app.services import documents_jobs, export, meetings, presentations, proposals  # noqa: F401
