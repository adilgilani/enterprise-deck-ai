import os
import tempfile
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any

_tmp = Path(tempfile.mkdtemp(prefix="eai-test-"))
os.environ.update(
    {
        "ENVIRONMENT": "test",
        "DATABASE_URL": f"sqlite+aiosqlite:///{(_tmp / 'test.db').as_posix()}",
        "LOCAL_STORAGE_DIR": str(_tmp / "storage"),
        "JOB_BACKEND": "eager",
        "LLM_PROVIDER": "mock",
        "STT_PROVIDER_EN": "mock",
        "STT_PROVIDER_UR": "mock",
        "EMBEDDING_PROVIDER": "hash",
        "STORAGE_PROVIDER": "local",
        "RATE_LIMIT_AUTH_PER_MINUTE": "1000",
        "RATE_LIMIT_AI_PER_MINUTE": "1000",
        "LIVE_INSIGHT_INTERVAL_SECONDS": "0.5",
        "SECRET_KEY": "test-secret-key-not-for-production-use-0123456789",
    }
)

import httpx  # noqa: E402
import pytest  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402
from app.services import register_job_handlers  # noqa: E402

PASSWORD = "correct-horse-battery"


@pytest.fixture(scope="session", autouse=True)
async def _schema() -> AsyncIterator[None]:
    register_job_handlers()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.fixture
async def client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as c:
        yield c


_counter = 0


async def make_workspace(client: httpx.AsyncClient, company: str = "Org") -> dict[str, Any]:
    global _counter
    _counter += 1
    email = f"user{_counter}@{company.lower().replace(' ', '')}{_counter}.io"
    r = await client.post("/auth/register", json={"email": email, "password": PASSWORD, "name": f"User {_counter}", "company_name": f"{company} {_counter}"})
    assert r.status_code == 201, r.text
    data = r.json()
    return {"email": email, "headers": {"Authorization": f"Bearer {data['access_token']}"}, "org_id": data["me"]["organization"]["id"], "me": data["me"]}


async def add_member(client: httpx.AsyncClient, owner: dict[str, Any], role: str) -> dict[str, Any]:
    """Invite + accept, returning auth for the new member."""
    global _counter
    _counter += 1
    email = f"member{_counter}@example.io"
    r = await client.post("/team/invitations", json={"email": email, "role": role}, headers=owner["headers"])
    assert r.status_code == 201, r.text
    token = r.json()["invite_url"].rsplit("/", 1)[-1]
    r = await client.post("/auth/accept-invite", json={"token": token, "name": f"Member {_counter}", "password": PASSWORD})
    assert r.status_code == 200, r.text
    return {"email": email, "headers": {"Authorization": f"Bearer {r.json()['access_token']}"}}


@pytest.fixture
async def ws(client: httpx.AsyncClient) -> dict[str, Any]:
    return await make_workspace(client, "Acme")
