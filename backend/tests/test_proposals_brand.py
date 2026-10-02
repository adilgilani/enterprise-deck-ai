"""Flow 2: create proposal → apply brand → generate; Brand System behaviour."""

import io

from tests.conftest import make_workspace


async def test_brand_system_update_and_application(client, ws):
    h = ws["headers"]
    brand = (await client.get("/brand", headers=h)).json()
    r = await client.patch(
        f"/brand/{brand['id']}",
        json={
            "colors": [{"name": "Teal", "hex": "#0F766E", "role": "primary"}, {"name": "Ink", "hex": "#111827", "role": "secondary"}, {"name": "Coral", "hex": "#F97316", "role": "accent"}],
            "company_profile": {"name": "Tealbank", "description": "A digital bank for SMEs.", "services": ["SME lending", "Payments"]},
            "tone_of_voice": {"summary": "Warm and direct"},
            "approved_messaging": ["Banking that moves at your speed."],
            "default_style": "premium",
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert r.json()["completeness"]["company_profile"] is True
    # invalid colour rejected
    assert (await client.patch(f"/brand/{brand['id']}", json={"colors": [{"name": "x", "hex": "red", "role": "primary"}]}, headers=h)).status_code == 422
    # brand flows into generated presentations
    gen = (await client.post("/presentations/generate", json={"prompt": "Company overview", "slide_count": 4}, headers=h)).json()
    p = (await client.get(f"/presentations/{gen['presentation_id']}", headers=h)).json()
    assert p["deck"]["theme"]["palette"]["primary"] == "#0F766E"
    assert p["deck"]["theme"]["style"] == "premium"
    ctx = (await client.get("/brand/context/summary", headers=h)).json()
    assert ctx["company_name"] == "Tealbank"
    assert {c["label"] for c in ctx["checks"]} >= {"Brand guidelines", "Logo", "Templates", "Company profile", "Approved messaging"}


async def test_proposal_generation_uses_brand_and_knowledge(client):
    w = await make_workspace(client, "Proposer")
    h = w["headers"]
    doc = b"Case study: Horizon Bank digital onboarding. Onboarding time cut from 40 days to 5 days. Savings of $3M a year."
    up = await client.post("/documents", files={"file": ("horizon.txt", io.BytesIO(doc), "text/plain")}, data={"category": "case_study"}, headers=h)
    assert up.status_code == 202
    r = await client.post(
        "/proposals/generate",
        json={"client": "ABC Bank", "industry": "Banking", "title": "Digital Transformation", "value": 2400000, "prompt": "Create a proposal for ABC Bank for a three-year digital transformation program using our previous banking projects."},
        headers=h,
    )
    assert r.status_code == 202, r.text
    assert r.json()["job"]["status"] == "completed", r.json()["job"]
    p = (await client.get(f"/proposals/{r.json()['proposal_id']}", headers=h)).json()
    kinds = [s["kind"] for s in p["schema"]["sections"]]
    assert kinds[:3] == ["cover", "executive_summary", "about_us"] and "commercial" in kinds
    assert p["schema"]["brand_lock"] is True
    assert p["schema"]["compliance"]["score"] == 100
    assert "horizon" in p["schema"]["sources"]  # RAG pulled the uploaded case study
    commercial = next(s for s in p["schema"]["sections"] if s["kind"] == "commercial")
    pricing = next(b for b in commercial["blocks"] if b["type"] == "pricing")
    assert abs(sum(line["amount"] for line in pricing["lines"]) - 2_400_000) < 50_000

    # reorder / delete / add sections, AI assistant, creative mode
    sections = p["schema"]["sections"]
    sections = [sections[1], sections[0], *sections[3:]]
    r = await client.patch(f"/proposals/{p['id']}", json={"sections": sections, "status": "internal_review"}, headers=h)
    assert r.status_code == 200 and r.json()["schema"]["sections"][0]["kind"] == "executive_summary"
    edit = await client.post(f"/proposals/{p['id']}/sections/ai-edit", json={"section": sections[0], "command": "Create pricing table"}, headers=h)
    assert edit.status_code == 200 and any(b["type"] == "pricing" for b in edit.json()["section"]["blocks"])
    r = await client.patch(f"/proposals/{p['id']}", json={"creative_mode": True}, headers=h)
    assert r.json()["schema"]["brand_lock"] is False
    job = (await client.post(f"/proposals/{p['id']}/export", headers=h)).json()
    assert (await client.get(f"/jobs/{job['id']}/download", headers=h)).content.startswith(b"%PDF")


async def test_proposal_rejects_unknown_sections(client, ws):
    r = await client.post("/proposals/generate", json={"client": "X", "prompt": "Proposal", "sections": ["cover", "rm -rf"]}, headers=ws["headers"])
    assert r.status_code == 422


async def test_multiple_brands_default_and_delete(client, ws):
    h = ws["headers"]
    default = (await client.get("/brand", headers=h)).json()
    sub = (await client.post("/brand", json={"name": "Atlas Product Brand", "colors": [{"name": "Lime", "hex": "#65A30D", "role": "primary"}]}, headers=h)).json()
    assert sub["is_default"] is False
    assert len((await client.get("/brand/systems", headers=h)).json()) == 2
    # generation can target a non-default brand
    gen = (await client.post("/presentations/generate", json={"prompt": "Atlas launch", "slide_count": 3, "brand_system_id": sub["id"]}, headers=h)).json()
    p = (await client.get(f"/presentations/{gen['presentation_id']}", headers=h)).json()
    assert p["deck"]["theme"]["palette"]["primary"] == "#65A30D"
    # the default brand cannot be deleted; others can
    assert (await client.delete(f"/brand/{default['id']}", headers=h)).status_code == 400
    assert (await client.post(f"/brand/{sub['id']}/default", headers=h)).json()["is_default"] is True
    assert (await client.delete(f"/brand/{default['id']}", headers=h)).status_code == 204
    assert [b["id"] for b in (await client.get("/brand/systems", headers=h)).json()] == [sub["id"]]
