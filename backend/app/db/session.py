from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

_settings = get_settings()

_settings.ensure_sqlite_dir()

if _settings.environment == "test":
    # Tests drive the app from several event loops (ASGI client + WebSocket test client); never share connections.
    engine = create_async_engine(_settings.database_url, poolclass=NullPool)
else:
    engine = create_async_engine(
        _settings.database_url,
        pool_pre_ping=not _settings.is_sqlite,
        **({} if _settings.is_sqlite else {"pool_size": 10, "max_overflow": 20}),
    )

if _settings.is_sqlite:

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):  # type: ignore[no-untyped-def]
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.close()


SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session
