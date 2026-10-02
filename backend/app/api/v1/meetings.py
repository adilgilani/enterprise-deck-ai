import asyncio
import contextlib
import json
import os
import tempfile
import time
import uuid
import wave
from typing import Any

import jwt
from fastapi import APIRouter, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_, select

from app.api.deps import DB, AICtx, CurrentCtx, EditorCtx, audit, get_owned
from app.api.v1.common import authors, create_share, job_out, list_shares
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import create_ws_ticket, decode_token
from app.db.base import utcnow
from app.db.session import SessionLocal
from app.models import ActionItem, Meeting, MeetingInsight, MeetingParticipant, TranscriptSegment
from app.schemas.api import (
    ActionItemCreate,
    ActionItemOut,
    ActionItemUpdate,
    InsightOut,
    JobOut,
    MeetingCreate,
    MeetingEndIn,
    MeetingOut,
    MeetingSummary,
    MeetingUpdate,
    ParticipantOut,
    ShareIn,
    ShareOut,
    TranscriptSegmentOut,
    WsTicketOut,
)
from app.services import jobs
from app.services.meetings import duration, live_extract, segments_for
from app.services.storage import get_storage, make_key
from app.services.stt import get_stt_provider
from app.services.stt.base import SAMPLE_RATE

log = get_logger(__name__)
router = APIRouter(prefix="/meetings", tags=["meetings"])
actions_router = APIRouter(prefix="/action-items", tags=["meetings"])


async def summaries(db: DB, items: list[Meeting]) -> list[MeetingSummary]:
    ids = [m.id for m in items]
    parts: dict[uuid.UUID, list[ParticipantOut]] = {i: [] for i in ids}
    counts: dict[uuid.UUID, tuple[int, int]] = {}
    if ids:
        for p in (await db.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id.in_(ids)))).scalars():
            parts[p.meeting_id].append(ParticipantOut.model_validate(p))
        for mid, total, open_ in (
            await db.execute(
                select(ActionItem.meeting_id, func.count(), func.sum(case((ActionItem.status != "done", 1), else_=0)))
                .where(ActionItem.meeting_id.in_(ids))
                .group_by(ActionItem.meeting_id)
            )
        ).all():
            counts[mid] = (total, int(open_ or 0))
    who = await authors(db, {m.created_by for m in items})
    return [
        MeetingSummary(
            id=m.id,
            title=m.title,
            status=m.status,
            language=m.language,
            location=m.location,
            scheduled_at=m.scheduled_at,
            started_at=m.started_at,
            ended_at=m.ended_at,
            duration_seconds=duration(m),
            participants=parts.get(m.id, []),
            summary=m.summary,
            action_item_count=counts.get(m.id, (0, 0))[0],
            open_action_items=counts.get(m.id, (0, 0))[1],
            decision_count=len((m.intelligence or {}).get("decisions", [])),
            presentation_id=m.presentation_id,
            author=who.get(m.created_by) if m.created_by else None,
            created_at=m.created_at,
        )
        for m in items
    ]


async def full(db: DB, m: Meeting) -> MeetingOut:
    [s] = await summaries(db, [m])
    actions = (await db.execute(select(ActionItem).where(ActionItem.meeting_id == m.id).order_by(ActionItem.created_at))).scalars()
    live = (await db.execute(select(MeetingInsight).where(MeetingInsight.meeting_id == m.id, MeetingInsight.source == "live"))).scalars()
    return MeetingOut(
        **s.model_dump(),
        agenda=m.agenda,
        intelligence=m.intelligence or {},
        notes=m.notes or {},
        action_items=[ActionItemOut.model_validate(a) for a in actions],
        live_insights=[InsightOut.model_validate(i) for i in live],
        audio_meta=m.audio_meta or {},
        stt_provider=m.stt_provider,
    )


@router.get("", response_model=list[MeetingSummary])
async def list_meetings(ctx: CurrentCtx, db: DB, q: str | None = Query(None, max_length=200), status_: str | None = Query(None, alias="status")) -> list[MeetingSummary]:
    stmt = select(Meeting).where(Meeting.organization_id == ctx.org_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(or_(func.lower(Meeting.title).like(like), func.lower(func.coalesce(Meeting.summary, "")).like(like)))
    if status_:
        stmt = stmt.where(Meeting.status == status_)
    stmt = stmt.order_by(func.coalesce(Meeting.started_at, Meeting.scheduled_at, Meeting.created_at).desc()).limit(300)
    return await summaries(db, list((await db.execute(stmt)).scalars()))


@router.post("", response_model=MeetingOut, status_code=201)
async def create_meeting(body: MeetingCreate, ctx: EditorCtx, db: DB, request: Request) -> MeetingOut:
    m = Meeting(
        organization_id=ctx.org_id,
        title=body.title,
        agenda=body.agenda,
        language=body.language,
        scheduled_at=body.scheduled_at,
        location=body.location,
        created_by=ctx.user.id,
        status="scheduled",
    )
    db.add(m)
    await db.flush()
    for i, p in enumerate(body.participants):
        db.add(MeetingParticipant(meeting_id=m.id, name=p.name, email=p.email, speaker_label=str(i)))
    await audit(db, ctx, "meeting.create", "meeting", m.id, {"participants": len(body.participants)}, request)
    await db.commit()
    return await full(db, m)


@router.get("/{meeting_id}", response_model=MeetingOut)
async def get_meeting(meeting_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> MeetingOut:
    return await full(db, await get_owned(db, Meeting, meeting_id, ctx.org_id))


@router.patch("/{meeting_id}", response_model=MeetingOut, summary="Edit meeting details or notes")
async def update_meeting(meeting_id: uuid.UUID, body: MeetingUpdate, ctx: EditorCtx, db: DB, request: Request) -> MeetingOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    if body.title is not None:
        m.title = body.title
    if body.agenda is not None:
        m.agenda = body.agenda
    if body.intelligence is not None:
        from app.schemas.ai import MeetingIntelligence

        merged = MeetingIntelligence.model_validate({**(m.intelligence or {}), **body.intelligence})
        m.intelligence = merged.model_dump()
        m.summary = merged.summary
    if body.notes is not None:
        m.notes = {**(m.notes or {}), **body.notes, "edited_at": utcnow().isoformat(), "edited_by": ctx.user.name}
    await audit(db, ctx, "meeting.update", "meeting", m.id, {"fields": sorted(body.model_dump(exclude_unset=True))}, request)
    await db.commit()
    return await full(db, m)


@router.delete("/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> None:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    await audit(db, ctx, "meeting.delete", "meeting", m.id, {"title": m.title}, request)
    await db.delete(m)
    await db.commit()


def _ticket(ctx: CurrentCtx, m: Meeting, request: Request) -> WsTicketOut:
    ticket = create_ws_ticket(ctx.user.id, ctx.org_id, m.id)
    base = str(request.base_url).rstrip("/").replace("http://", "ws://").replace("https://", "wss://")
    return WsTicketOut(ticket=ticket, url=f"{base}/api/v1/meetings/{m.id}/live?ticket={ticket}", provider=get_stt_provider(m.language).name)


@router.post("/{meeting_id}/start", response_model=WsTicketOut, summary="Start capture; returns a short-lived WebSocket ticket")
async def start(meeting_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> WsTicketOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    if m.status in ("processing", "ready"):
        raise HTTPException(status.HTTP_409_CONFLICT, "This meeting has already ended")
    if m.started_at is None:
        m.started_at = utcnow()
    m.status = "live"
    await audit(db, ctx, "meeting.start", "meeting", m.id, request=request)
    await db.commit()
    return _ticket(ctx, m, request)


@router.post("/{meeting_id}/ws-ticket", response_model=WsTicketOut, summary="Fresh WebSocket ticket (reconnect)")
async def ws_ticket(meeting_id: uuid.UUID, ctx: EditorCtx, db: DB, request: Request) -> WsTicketOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    return _ticket(ctx, m, request)


@router.post("/{meeting_id}/end", response_model=JobOut, status_code=202, summary="End capture and run the processing pipeline")
async def end(meeting_id: uuid.UUID, body: MeetingEndIn, ctx: EditorCtx, db: DB, request: Request) -> JobOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    if m.status == "processing":
        raise HTTPException(status.HTTP_409_CONFLICT, "Meeting is already being processed")
    now = utcnow()
    if m.started_at is None:
        m.started_at = now
    if m.ended_at is None:
        m.ended_at = now
    started = m.started_at if m.started_at.tzinfo else m.started_at.replace(tzinfo=now.tzinfo)
    ended = m.ended_at if m.ended_at.tzinfo else m.ended_at.replace(tzinfo=now.tzinfo)
    m.duration_seconds = max(0, int((ended - started).total_seconds()))
    m.status = "processing"
    await audit(db, ctx, "meeting.end", "meeting", m.id, {"output": body.output}, request)
    await db.commit()
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="meeting.process", payload={"meeting_id": str(m.id), "output": body.output}, resource_type="meeting", resource_id=m.id)
    return job_out(job)


@router.get("/{meeting_id}/transcript", response_model=list[TranscriptSegmentOut])
async def transcript(meeting_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> list[TranscriptSegmentOut]:
    await get_owned(db, Meeting, meeting_id, ctx.org_id)
    rows = (await db.execute(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.seq))).scalars()
    return [TranscriptSegmentOut(seq=s.seq, speaker=s.speaker, text=s.text, start_ms=s.start_ms, end_ms=s.end_ms) for s in rows]


class TranscriptAppend(BaseModel):
    segments: list[dict[str, Any]] = Field(min_length=1, max_length=2000)


@router.post("/{meeting_id}/transcript", response_model=list[TranscriptSegmentOut], status_code=201, summary="Append transcript text (import or manual)")
async def append_transcript(meeting_id: uuid.UUID, body: TranscriptAppend, ctx: EditorCtx, db: DB) -> list[TranscriptSegmentOut]:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    seq = (await db.execute(select(func.coalesce(func.max(TranscriptSegment.seq), 0)).where(TranscriptSegment.meeting_id == m.id))).scalar_one()
    out = []
    for s in body.segments:
        text = str(s.get("text", "")).strip()
        if not text:
            continue
        seq += 1
        row = TranscriptSegment(meeting_id=m.id, seq=seq, speaker=str(s.get("speaker") or "Speaker")[:120], text=text[:5000], start_ms=int(s.get("start_ms") or 0), end_ms=int(s.get("end_ms") or 0))
        db.add(row)
        out.append(TranscriptSegmentOut(seq=seq, speaker=row.speaker, text=row.text, start_ms=row.start_ms, end_ms=row.end_ms))
    await db.commit()
    return out


@router.post("/{meeting_id}/generate-deck", response_model=JobOut, status_code=202, summary="Meeting → branded presentation")
async def generate_deck(meeting_id: uuid.UUID, ctx: AICtx, db: DB, request: Request) -> JobOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    await audit(db, ctx, "meeting.generate_deck", "meeting", m.id, request=request)
    await db.commit()
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="meeting.deck", payload={"meeting_id": str(m.id)}, resource_type="meeting", resource_id=m.id)
    return job_out(job)


@router.post("/{meeting_id}/export", response_model=JobOut, status_code=202, summary="Meeting notes → PDF")
async def export(meeting_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> JobOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    job = await jobs.enqueue(db, org_id=ctx.org_id, user_id=ctx.user.id, job_type="export.meeting_notes", payload={"meeting_id": str(m.id)}, resource_type="meeting", resource_id=m.id)
    return job_out(job)


@router.post("/{meeting_id}/share", response_model=ShareOut, status_code=201)
async def share(meeting_id: uuid.UUID, body: ShareIn, ctx: EditorCtx, db: DB, request: Request) -> ShareOut:
    await get_owned(db, Meeting, meeting_id, ctx.org_id)
    return await create_share(db, ctx, "meeting", meeting_id, body, request)


@router.get("/{meeting_id}/shares", response_model=list[ShareOut])
async def shares(meeting_id: uuid.UUID, ctx: CurrentCtx, db: DB) -> list[ShareOut]:
    await get_owned(db, Meeting, meeting_id, ctx.org_id)
    return await list_shares(db, ctx, "meeting", meeting_id)


@router.post("/{meeting_id}/action-items", response_model=ActionItemOut, status_code=201)
async def add_action(meeting_id: uuid.UUID, body: ActionItemCreate, ctx: EditorCtx, db: DB) -> ActionItemOut:
    m = await get_owned(db, Meeting, meeting_id, ctx.org_id)
    a = ActionItem(meeting_id=m.id, organization_id=ctx.org_id, title=body.title, owner=body.owner, deadline=body.deadline)
    db.add(a)
    await db.commit()
    return ActionItemOut.model_validate(a)


# ---------------------------------------------------------------------------- action items (org-wide)


@actions_router.get("", response_model=list[ActionItemOut])
async def list_actions(ctx: CurrentCtx, db: DB, status_: str | None = Query(None, alias="status"), limit: int = Query(100, le=500)) -> list[ActionItemOut]:
    stmt = select(ActionItem).where(ActionItem.organization_id == ctx.org_id)
    if status_:
        stmt = stmt.where(ActionItem.status == status_)
    rows = (await db.execute(stmt.order_by(ActionItem.deadline.is_(None), ActionItem.deadline, ActionItem.created_at.desc()).limit(limit))).scalars()
    return [ActionItemOut.model_validate(a) for a in rows]


@actions_router.patch("/{item_id}", response_model=ActionItemOut)
async def update_action(item_id: uuid.UUID, body: ActionItemUpdate, ctx: EditorCtx, db: DB) -> ActionItemOut:
    a = await get_owned(db, ActionItem, item_id, ctx.org_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(a, k, v)
    await db.commit()
    return ActionItemOut.model_validate(a)


@actions_router.delete("/{item_id}", status_code=204)
async def delete_action(item_id: uuid.UUID, ctx: EditorCtx, db: DB) -> None:
    a = await get_owned(db, ActionItem, item_id, ctx.org_id)
    await db.delete(a)
    await db.commit()


# ---------------------------------------------------------------------------- live capture WebSocket
#
# Client → server: binary frames of 16 kHz mono PCM16; text {"type":"stop"} | {"type":"ping"}
# Server → client: {"type":"ready"|"partial"|"segment"|"insights"|"error"|"stopped"|"pong", ...}


@router.websocket("/{meeting_id}/live")
async def live(ws: WebSocket, meeting_id: uuid.UUID, ticket: str = "") -> None:
    try:
        claims = decode_token(ticket, "ws")
        if claims.get("mid") != str(meeting_id):
            raise jwt.InvalidTokenError("ticket/meeting mismatch")
    except jwt.InvalidTokenError:
        await ws.close(code=4401)
        return
    org_id = uuid.UUID(claims["org"])
    await ws.accept()

    async with SessionLocal() as db:
        m = await db.get(Meeting, meeting_id)
        if m is None or m.organization_id != org_id:
            await ws.send_json({"type": "error", "message": "Meeting not found"})
            await ws.close(code=4404)
            return
        names = [p.name for p in (await db.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id))).scalars()]
        seq0 = (await db.execute(select(func.coalesce(func.max(TranscriptSegment.seq), 0)).where(TranscriptSegment.meeting_id == m.id))).scalar_one()
        language = m.language

    provider = get_stt_provider(language)
    stt = provider.create_session(language, names)
    try:
        await stt.start()
    except Exception as e:
        log.warning("stt start failed", extra={"data": {"provider": provider.name, "error": str(e)[:200]}})
        await ws.send_json({"type": "error", "message": f"Speech-to-text unavailable ({provider.name}): {e}"})
        await ws.close(code=1011)
        return

    async with SessionLocal() as db:
        m = await db.get(Meeting, meeting_id)
        assert m is not None
        m.stt_provider = provider.name
        m.status = "live"
        m.started_at = m.started_at or utcnow()
        await db.commit()

    state = {"seq": seq0, "insight_seq": seq0, "closed": False}
    send_lock = asyncio.Lock()
    audio_fd, audio_path = tempfile.mkstemp(suffix=".pcm")
    os.close(audio_fd)
    audio_file = open(audio_path, "wb")  # noqa: SIM115 - closed in finally
    started = time.monotonic()

    async def send(msg: dict[str, Any]) -> None:
        if state["closed"]:
            return
        async with send_lock:
            with contextlib.suppress(Exception):
                await ws.send_json(msg)

    async def pump() -> None:
        async for ev in stt.events():
            if ev.kind == "partial":
                await send({"type": "partial", "speaker": ev.speaker, "text": ev.text})
            elif ev.kind == "error":
                await send({"type": "error", "message": ev.text})
            elif ev.kind == "final" and ev.text.strip():
                state["seq"] += 1
                async with SessionLocal() as db:
                    db.add(TranscriptSegment(meeting_id=meeting_id, seq=state["seq"], speaker=ev.speaker[:120], text=ev.text, start_ms=ev.start_ms, end_ms=ev.end_ms, language=ev.language))
                    await db.commit()
                await send({"type": "segment", "seq": state["seq"], "speaker": ev.speaker, "text": ev.text, "start_ms": ev.start_ms, "end_ms": ev.end_ms})

    async def insights_loop() -> None:
        interval = get_settings().live_insight_interval_seconds
        while True:
            await asyncio.sleep(interval)
            await run_insights()

    async def run_insights() -> None:
        if state["seq"] <= state["insight_seq"]:
            return  # nothing new said — don't call the LLM
        state["insight_seq"] = state["seq"]
        try:
            async with SessionLocal() as db:
                m = await db.get(Meeting, meeting_id)
                assert m is not None
                segs = await segments_for(db, meeting_id)
                result = await live_extract(db, m, segs)
            await send({"type": "insights", "data": result.model_dump()})
        except Exception as e:
            log.warning("live insights failed", extra={"data": {"meeting_id": str(meeting_id), "error": str(e)[:200]}})

    pump_task = asyncio.create_task(pump())
    insight_task = asyncio.create_task(insights_loop())
    await send({"type": "ready", "provider": provider.name, "language": language, "sample_rate": SAMPLE_RATE})
    try:
        while True:
            msg = await ws.receive()
            if msg["type"] == "websocket.disconnect":
                break
            if msg.get("bytes"):
                audio_file.write(msg["bytes"])
                await stt.send_audio(msg["bytes"])
            elif msg.get("text"):
                data = json.loads(msg["text"])
                if data.get("type") == "stop":
                    break
                if data.get("type") == "ping":
                    await send({"type": "pong"})
    except WebSocketDisconnect:
        pass
    finally:
        await stt.finish()
        with contextlib.suppress(asyncio.TimeoutError):
            await asyncio.wait_for(pump_task, timeout=20)
        insight_task.cancel()
        await run_insights()
        audio_file.close()
        size = os.path.getsize(audio_path)
        storage_key = None
        if size > 0:
            try:
                wav_path = audio_path + ".wav"
                with open(audio_path, "rb") as raw, wave.open(wav_path, "wb") as w:
                    w.setnchannels(1)
                    w.setsampwidth(2)
                    w.setframerate(SAMPLE_RATE)
                    w.writeframes(raw.read())
                storage_key = make_key(org_id, "meeting-audio", f"{meeting_id}.wav")
                with open(wav_path, "rb") as f:
                    await get_storage().put(storage_key, f.read(), "audio/wav")
                os.remove(wav_path)
            except Exception:
                log.exception("failed to store meeting audio")
                storage_key = None
        with contextlib.suppress(OSError):
            os.remove(audio_path)
        async with SessionLocal() as db:
            m = await db.get(Meeting, meeting_id)
            if m is not None:
                prev = m.audio_meta or {}
                m.audio_meta = {
                    "sample_rate": SAMPLE_RATE,
                    "channels": 1,
                    "encoding": "pcm_s16le",
                    "bytes_received": int(prev.get("bytes_received", 0)) + size,
                    "seconds": round(float(prev.get("seconds", 0)) + size / (SAMPLE_RATE * 2), 1),
                    "wall_seconds": round(float(prev.get("wall_seconds", 0)) + time.monotonic() - started, 1),
                    "segments": state["seq"],
                    "storage_key": storage_key or prev.get("storage_key"),
                    "provider": provider.name,
                }
                m.ended_at = utcnow()
                await db.commit()
        await send({"type": "stopped", "segments": state["seq"]})
        state["closed"] = True
        with contextlib.suppress(Exception):
            await ws.close()
