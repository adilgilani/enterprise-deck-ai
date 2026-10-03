"""Flow 3: start meeting → transcript → end → notes.  Flow 4: meeting → presentation."""

import json

from starlette.testclient import TestClient

from app.main import app

PARTICIPANTS = [{"name": "Ahmed Raza"}, {"name": "Sara Malik"}, {"name": "Omar Shah"}, {"name": "Priya Nair"}, {"name": "Lena Ortiz"}]


async def test_live_capture_over_websocket_then_notes_and_deck(client, ws):
    h = ws["headers"]
    m = (await client.post("/meetings", json={"title": "Q4 Strategy", "participants": PARTICIPANTS, "agenda": "Enterprise focus\nOnboarding"}, headers=h)).json()
    ticket = (await client.post(f"/meetings/{m['id']}/start", headers=h)).json()
    assert ticket["provider"] == "mock"

    received: list[dict] = []
    with TestClient(app) as tc, tc.websocket_connect(f"/api/v1/meetings/{m['id']}/live?ticket={ticket['ticket']}") as sock:
        assert sock.receive_json()["type"] == "ready"
        chunk = b"\x00\x00" * 1600  # 100 ms of 16 kHz PCM16
        for _ in range(200):  # 20 s of audio → ~6 scripted utterances
            sock.send_bytes(chunk)
        sock.send_text(json.dumps({"type": "stop"}))
        while True:
            msg = sock.receive_json()
            received.append(msg)
            if msg["type"] == "stopped":
                break
    segments = [r for r in received if r["type"] == "segment"]
    assert len(segments) >= 5
    assert segments[0]["speaker"] == "Ahmed Raza"
    assert any(r["type"] == "insights" for r in received)

    transcript = (await client.get(f"/meetings/{m['id']}/transcript", headers=h)).json()
    assert len(transcript) == len(segments)

    job = (await client.post(f"/meetings/{m['id']}/end", json={"output": "both"}, headers=h)).json()
    assert job["status"] == "completed", job
    meeting = (await client.get(f"/meetings/{m['id']}", headers=h)).json()
    assert meeting["status"] == "ready"
    assert meeting["summary"]
    assert meeting["intelligence"]["decisions"]
    assert meeting["audio_meta"]["bytes_received"] == 200 * 3200
    assert meeting["presentation_id"] == job["result"]["presentation_id"]
    deck = (await client.get(f"/presentations/{meeting['presentation_id']}", headers=h)).json()
    assert deck["source"] == "meeting" and deck["slide_count"] >= 5

    # notes are editable and exportable
    r = await client.patch(f"/meetings/{m['id']}", json={"intelligence": {"summary": "Edited summary."}}, headers=h)
    assert r.json()["summary"] == "Edited summary."
    pdf_job = (await client.post(f"/meetings/{m['id']}/export", headers=h)).json()
    assert (await client.get(f"/jobs/{pdf_job['id']}/download", headers=h)).content.startswith(b"%PDF")


async def test_websocket_rejects_bad_ticket(client, ws):
    m = (await client.post("/meetings", json={"title": "x"}, headers=ws["headers"])).json()
    with TestClient(app) as tc:
        try:
            with tc.websocket_connect(f"/api/v1/meetings/{m['id']}/live?ticket=forged") as sock:
                sock.receive_json()
            raise AssertionError("connection should be refused")
        except Exception as e:  # WebSocketDisconnect with code 4401
            assert "4401" in repr(e) or "WebSocketDisconnect" in type(e).__name__


async def test_imported_transcript_meeting_to_presentation(client, ws):
    h = ws["headers"]
    m = (await client.post("/meetings", json={"title": "Pricing review", "participants": [{"name": "Ana"}, {"name": "Ben"}]}, headers=h)).json()
    lines = [
        {"speaker": "Ana", "text": "Revenue is up 22% this quarter to $4.1M."},
        {"speaker": "Ben", "text": "We decided to raise enterprise prices by 8% from January."},
        {"speaker": "Ana", "text": "I'll update the price book by next Friday."},
        {"speaker": "Ben", "text": "The risk is churn in the mid-market segment."},
        {"speaker": "Ana", "text": "Can sales confirm the discount policy?"},
    ]
    assert (await client.post(f"/meetings/{m['id']}/transcript", json={"segments": lines}, headers=h)).status_code == 201
    job = (await client.post(f"/meetings/{m['id']}/end", json={"output": "notes"}, headers=h)).json()
    assert job["status"] == "completed"
    meeting = (await client.get(f"/meetings/{m['id']}", headers=h)).json()
    intel = meeting["intelligence"]
    assert any("raise enterprise prices" in d["text"] for d in intel["decisions"])
    assert any(n["value"] == "22%" for n in intel["numbers"])
    assert intel["risks"] and intel["questions"]
    item = next(a for a in meeting["action_items"] if "price book" in a["title"])
    assert item["owner"] == "Ana" and item["deadline"] is not None
    # action items are trackable
    upd = await client.patch(f"/action-items/{item['id']}", json={"status": "done"}, headers=h)
    assert upd.json()["status"] == "done"
    # Flow 4: one-click deck
    deck_job = (await client.post(f"/meetings/{m['id']}/generate-deck", headers=h)).json()
    assert deck_job["status"] == "completed"
    p = (await client.get(f"/presentations/{deck_job['result']['presentation_id']}", headers=h)).json()
    layouts = [s["layout"] for s in p["deck"]["slides"]]
    assert layouts[0] == "hero" and layouts[-1] == "closing" and "table" in layouts


async def test_urdu_meeting_uses_urdu_provider_route(client, ws):
    from app.services.stt import get_stt_provider

    assert get_stt_provider("ur").name == "mock"  # STT_PROVIDER_UR=mock in tests; soniox in production config
    m = (await client.post("/meetings", json={"title": "اردو میٹنگ", "language": "ur"}, headers=ws["headers"])).json()
    assert m["language"] == "ur"


async def test_roman_urdu_meeting_transcript_is_latin_script(client, ws):
    h = ws["headers"]
    m = (await client.post("/meetings", json={"title": "Roman Urdu sync", "language": "ur-Latn", "participants": [{"name": "Ahmed"}, {"name": "Sara"}]}, headers=h)).json()
    assert m["language"] == "ur-Latn"
    ticket = (await client.post(f"/meetings/{m['id']}/start", headers=h)).json()
    with TestClient(app) as tc, tc.websocket_connect(f"/api/v1/meetings/{m['id']}/live?ticket={ticket['ticket']}") as sock:
        assert sock.receive_json()["type"] == "ready"
        for _ in range(80):
            sock.send_bytes(b"\x00\x00" * 1600)
        sock.send_text(json.dumps({"type": "stop"}))
        texts = []
        while True:
            msg = sock.receive_json()
            if msg["type"] == "segment":
                texts.append(msg["text"])
            if msg["type"] == "stopped":
                break
    assert texts and all(not any("\u0600" <= ch <= "\u06ff" for ch in t) for t in texts)


async def test_urdu_script_is_romanized_when_requested():
    import uuid as _uuid

    from app.services.meetings import romanize

    out = await romanize("کیا فنانس بجٹ کی تصدیق کر سکتا ہے؟", _uuid.uuid4(), None, None)
    assert out and not any("\u0600" <= ch <= "\u06ff" for ch in out)


async def test_meeting_deck_uses_brand_default_template(client, ws):
    h = ws["headers"]
    # a template in editorial style, set as the default brand's default template
    tpl = (await client.post("/templates", json={"name": "Board Readout", "category": "meeting", "deck": {"title": "T", "theme": {"style": "editorial"}, "slides": [
        {"layout": "hero", "title": "Cover", "background": "brand", "transition": {"type": "dissolve"}},
        {"layout": "table", "title": "Actions", "background": "inverse", "transition": {"type": "slide"}},
    ]}}, headers=h)).json()
    brand = (await client.get("/brand", headers=h)).json()
    assert (await client.patch(f"/brand/{brand['id']}", json={"default_template_id": tpl["id"]}, headers=h)).status_code == 200

    m = (await client.post("/meetings", json={"title": "Ops review", "participants": [{"name": "Ana"}, {"name": "Ben"}]}, headers=h)).json()
    await client.post(f"/meetings/{m['id']}/transcript", json={"segments": [
        {"speaker": "Ana", "text": "We decided to hire two engineers by next Friday."},
        {"speaker": "Ben", "text": "I'll send the budget of $120K to finance by Tuesday."},
    ]}, headers=h)
    job = (await client.post(f"/meetings/{m['id']}/end", json={"output": "presentation"}, headers=h)).json()
    assert job["status"] == "completed", job
    deck = (await client.get(f"/presentations/{job['result']['presentation_id']}", headers=h)).json()
    assert deck["deck"]["theme"]["style"] == "editorial"  # template style, not the brand default (executive)
    slides = deck["deck"]["slides"]
    hero = next(s for s in slides if s["layout"] == "hero")
    assert hero["background"] == "brand" and hero["transition"]["type"] == "dissolve"
    table = next(s for s in slides if s["layout"] == "table")
    assert table["background"] == "inverse"
    assert (await client.get(f"/templates/{tpl['id']}", headers=h)).json()["usage_count"] == 1
