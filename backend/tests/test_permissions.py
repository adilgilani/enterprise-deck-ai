from tests.conftest import add_member, make_workspace


async def test_viewer_is_read_only(client):
    owner = await make_workspace(client)
    viewer = await add_member(client, owner, "viewer")
    assert (await client.get("/presentations", headers=viewer["headers"])).status_code == 200
    assert (await client.post("/presentations", json={"title": "x"}, headers=viewer["headers"])).status_code == 403
    assert (await client.post("/presentations/generate", json={"prompt": "A deck"}, headers=viewer["headers"])).status_code == 403
    assert (await client.post("/meetings", json={"title": "x"}, headers=viewer["headers"])).status_code == 403


async def test_editor_cannot_change_brand_or_team(client):
    owner = await make_workspace(client)
    editor = await add_member(client, owner, "editor")
    brand = (await client.get("/brand", headers=editor["headers"])).json()
    assert (await client.patch(f"/brand/{brand['id']}", json={"name": "x"}, headers=editor["headers"])).status_code == 403
    assert (await client.post("/team/invitations", json={"email": "z@z.io"}, headers=editor["headers"])).status_code == 403
    assert (await client.post("/presentations", json={"title": "ok"}, headers=editor["headers"])).status_code == 201


async def test_admin_cannot_grant_owner_and_last_owner_is_protected(client):
    owner = await make_workspace(client)
    admin = await add_member(client, owner, "admin")
    members = (await client.get("/team/members", headers=owner["headers"])).json()
    owner_member = next(m for m in members if m["role"] == "owner")
    admin_member = next(m for m in members if m["role"] == "admin")
    assert (await client.patch(f"/team/members/{admin_member['id']}", json={"role": "owner"}, headers=admin["headers"])).status_code == 403
    assert (await client.patch(f"/team/members/{owner_member['id']}", json={"role": "viewer"}, headers=owner["headers"])).status_code == 400


async def test_audit_log_records_actions_and_is_admin_only(client):
    owner = await make_workspace(client)
    editor = await add_member(client, owner, "editor")
    await client.post("/presentations", json={"title": "Audited"}, headers=owner["headers"])
    logs = (await client.get("/audit-logs", headers=owner["headers"])).json()
    assert any(entry["action"] == "presentation.create" for entry in logs)
    assert (await client.get("/audit-logs", headers=editor["headers"])).status_code == 403
