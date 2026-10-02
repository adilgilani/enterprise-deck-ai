from tests.conftest import PASSWORD, make_workspace


async def test_register_creates_workspace_owner_and_brand(client):
    w = await make_workspace(client, "Fintech")
    assert w["me"]["role"] == "owner"
    r = await client.get("/brand", headers=w["headers"])
    assert r.status_code == 200
    assert r.json()["is_default"] is True
    assert r.json()["company_profile"]["name"].startswith("Fintech")


async def test_login_and_me(client):
    w = await make_workspace(client)
    r = await client.post("/auth/login", json={"email": w["email"], "password": PASSWORD})
    assert r.status_code == 200
    token = r.json()["access_token"]
    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["user"]["email"] == w["email"]


async def test_wrong_password_and_unknown_user_are_indistinguishable(client):
    w = await make_workspace(client)
    a = await client.post("/auth/login", json={"email": w["email"], "password": "wrong-password!"})
    b = await client.post("/auth/login", json={"email": "nobody@nowhere.io", "password": "wrong-password!"})
    assert a.status_code == b.status_code == 401
    assert a.json()["detail"] == b.json()["detail"]


async def test_password_policy_and_duplicates(client):
    r = await client.post("/auth/register", json={"email": "x@y.io", "password": "short", "name": "X", "company_name": "XY"})
    assert r.status_code == 422
    w = await make_workspace(client)
    r = await client.post("/auth/register", json={"email": w["email"], "password": PASSWORD, "name": "X", "company_name": "Other"})
    assert r.status_code == 409


async def test_requires_auth_and_rejects_bad_tokens(client):
    assert (await client.get("/presentations")).status_code == 401
    assert (await client.get("/presentations", headers={"Authorization": "Bearer nope"})).status_code == 401


async def test_logout_revokes_session(client):
    w = await make_workspace(client)
    assert (await client.post("/auth/logout", headers=w["headers"])).status_code == 204
    assert (await client.get("/auth/me", headers=w["headers"])).status_code == 401


async def test_passwords_are_hashed(client):
    from sqlalchemy import select

    from app.db.session import SessionLocal
    from app.models import User

    w = await make_workspace(client)
    async with SessionLocal() as s:
        u = (await s.execute(select(User).where(User.email == w["email"]))).scalar_one()
    assert u.password_hash and PASSWORD not in u.password_hash and u.password_hash.startswith("$argon2")


async def test_api_key_auth_and_revocation(client):
    w = await make_workspace(client)
    r = await client.post("/settings/api-keys", json={"name": "CI"}, headers=w["headers"])
    key = r.json()["key"]
    assert key.startswith("eai_")
    assert (await client.get("/presentations", headers={"Authorization": f"Bearer {key}"})).status_code == 200
    kid = (await client.get("/settings/api-keys", headers=w["headers"])).json()[0]["id"]
    await client.delete(f"/settings/api-keys/{kid}", headers=w["headers"])
    assert (await client.get("/presentations", headers={"Authorization": f"Bearer {key}"})).status_code == 401
