"""A user in Organization A must never reach Organization B's resources."""

import io

from tests.conftest import make_workspace

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


async def _seed_resources(client, w):
    h = w["headers"]
    p = (await client.post("/presentations", json={"title": "Secret deck"}, headers=h)).json()
    pr = (await client.post("/proposals", json={"client": "Secret Bank", "title": "Secret proposal"}, headers=h)).json()
    m = (await client.post("/meetings", json={"title": "Secret meeting"}, headers=h)).json()
    d = (await client.post("/documents", files={"file": ("secret.txt", io.BytesIO(b"Top secret strategy document with enough text to index."), "text/plain")}, headers=h)).json()
    a = (await client.post("/assets", files={"file": ("logo.png", io.BytesIO(PNG), "image/png")}, headers=h)).json()
    b = (await client.get("/brand", headers=h)).json()
    return {"presentations": p["id"], "proposals": pr["id"], "meetings": m["id"], "documents": d["id"], "assets": a["id"], "brand": b["id"]}


async def test_cross_org_reads_writes_and_deletes_are_404(client):
    a = await make_workspace(client, "Alpha")
    b = await make_workspace(client, "Beta")
    ids = await _seed_resources(client, a)
    hb = b["headers"]
    for kind, rid in ids.items():
        assert (await client.get(f"/{kind}/{rid}", headers=hb)).status_code == 404, kind
    assert (await client.patch(f"/presentations/{ids['presentations']}", json={"title": "pwned"}, headers=hb)).status_code == 404
    assert (await client.delete(f"/presentations/{ids['presentations']}", headers=hb)).status_code == 404
    assert (await client.patch(f"/brand/{ids['brand']}", json={"name": "pwned"}, headers=hb)).status_code == 404
    assert (await client.get(f"/assets/{ids['assets']}/file", headers=hb)).status_code == 404
    assert (await client.post(f"/meetings/{ids['meetings']}/start", headers=hb)).status_code == 404
    assert (await client.post(f"/presentations/{ids['presentations']}/export", json={"format": "pdf"}, headers=hb)).status_code == 404
    # and the owner still sees everything
    assert (await client.get(f"/presentations/{ids['presentations']}", headers=a["headers"])).json()["title"] == "Secret deck"


async def test_lists_and_search_are_scoped(client):
    a = await make_workspace(client, "Gamma")
    b = await make_workspace(client, "Delta")
    await _seed_resources(client, a)
    for kind in ("presentations", "proposals", "meetings", "documents", "assets"):
        items = (await client.get(f"/{kind}", headers=b["headers"])).json()
        assert all("Secret" not in str(i) for i in items), kind
    hits = (await client.post("/documents/search", json={"query": "secret strategy"}, headers=b["headers"])).json()
    assert hits == []


async def test_org_header_cannot_select_foreign_workspace(client):
    a = await make_workspace(client, "Eps")
    b = await make_workspace(client, "Zeta")
    r = await client.get("/presentations", headers={**b["headers"], "X-Organization-Id": a["org_id"]})
    assert r.status_code == 403


async def test_brand_reference_to_foreign_asset_rejected(client):
    a = await make_workspace(client, "Eta")
    b = await make_workspace(client, "Theta")
    ids = await _seed_resources(client, a)
    brand_b = (await client.get("/brand", headers=b["headers"])).json()
    r = await client.patch(f"/brand/{brand_b['id']}", json={"logo_asset_id": ids["assets"]}, headers=b["headers"])
    assert r.status_code == 404
