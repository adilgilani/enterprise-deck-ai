"""Meeting intelligence.

    live:  audio → STT → transcript segments ──(every N seconds, new text only)──► LiveInsights
    final: segments → Transcript → chunk (long meetings) → LLM → MeetingIntelligence
               → MeetingInsight rows + ActionItems + notes → optional branded deck
"""

import re
import uuid
from datetime import date, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import utcnow
from app.models import ActionItem, Meeting, MeetingInsight, MeetingParticipant, Organization, Presentation, Transcript, TranscriptSegment
from app.schemas.ai import LiveInsights, MeetingIntelligence
from app.schemas.deck import Deck, DeckContent
from app.services import brand as brand_svc
from app.services.ai import prompts
from app.services.ai.service import AIContext, ai_service
from app.services.jobs import JobContext, handler
from app.services.presentations import ai_ctx, save_deck

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
# Transcripts longer than this are analyzed in chunks and merged (map-reduce).
CHUNK_SEGMENTS_CHARS = 40000


def parse_deadline(text: str | None, base: date) -> date | None:
    if not text:
        return None
    t = text.lower().strip()
    try:
        return date.fromisoformat(t[:10])
    except ValueError:
        pass
    if "tomorrow" in t:
        return base + timedelta(days=1)
    if "next week" in t:
        return base + timedelta(days=7 - base.weekday())
    if "two weeks" in t or "2 weeks" in t:
        return base + timedelta(days=14)
    m = re.search(r"end of (?:the )?month", t)
    if m:
        nxt = (base.replace(day=28) + timedelta(days=4)).replace(day=1)
        return nxt - timedelta(days=1)
    m = re.search(r"end of q([1-4])", t)
    if m:
        q = int(m.group(1))
        month = q * 3
        year = base.year if month >= base.month else base.year + 1
        return (date(year, month, 28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
    for i, wd in enumerate(WEEKDAYS):
        if wd in t:
            delta = (i - base.weekday()) % 7 or 7
            if "next" in t and delta < 7:
                delta += 7 if delta <= 2 else 0
            return base + timedelta(days=delta)
    m = re.search(r"(" + "|".join(MONTHS) + r")\w*\.?\s+(\d{1,2})", t)
    if m:
        month = MONTHS.index(m.group(1)) + 1
        day = int(m.group(2))
        try:
            d = date(base.year, month, day)
        except ValueError:
            return None
        return d if d >= base - timedelta(days=30) else date(base.year + 1, month, day)
    return None


async def segments_for(session: AsyncSession, meeting_id: uuid.UUID) -> list[dict[str, Any]]:
    q = select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.seq)
    return [
        {"speaker": s.speaker, "text": s.text, "start_ms": s.start_ms, "end_ms": s.end_ms}
        for s in (await session.execute(q)).scalars()
    ]


async def finalize_transcript(session: AsyncSession, m: Meeting) -> Transcript:
    segs = await segments_for(session, m.id)
    t = (await session.execute(select(Transcript).where(Transcript.meeting_id == m.id))).scalar_one_or_none()
    if t is None:
        t = Transcript(meeting_id=m.id)
        session.add(t)
    t.timestamps = segs
    t.content = "\n".join(f"{s['speaker']}: {s['text']}" for s in segs)
    t.language = m.language
    t.provider = m.stt_provider
    return t


def _merge(parts: list[MeetingIntelligence]) -> MeetingIntelligence:
    if len(parts) == 1:
        return parts[0]
    out = MeetingIntelligence(summary=" ".join(p.summary for p in parts if p.summary))
    for p in parts:
        out.topics += p.topics
        out.decisions += p.decisions
        out.action_items += p.action_items
        out.risks += p.risks
        out.questions += p.questions
        out.numbers += p.numbers
        out.next_steps += p.next_steps
        out.highlights += p.highlights
    return out


def _chunks(segs: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    out: list[list[dict[str, Any]]] = [[]]
    size = 0
    for s in segs:
        n = len(s.get("text", "")) + 20
        if size + n > CHUNK_SEGMENTS_CHARS and out[-1]:
            out.append([])
            size = 0
        out[-1].append(s)
        size += n
    return out


async def analyze(session: AsyncSession, m: Meeting, org: Organization | None) -> MeetingIntelligence:
    parts_rows = list((await session.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id))).scalars())
    names = [p.name for p in parts_rows]
    segs = await segments_for(session, m.id)
    if not segs:
        return MeetingIntelligence(summary="No speech was captured in this meeting.")
    results = []
    for chunk in _chunks(segs):
        instructions, payload = prompts.meeting_analysis_prompt(
            title=m.title, participants=names, agenda=m.agenda, segments=chunk, language=m.language
        )
        results.append(
            await ai_service.generate(
                task="meeting.analyze",
                schema=MeetingIntelligence,
                instructions=instructions,
                payload=payload,
                ctx=ai_ctx(org, m.created_by),
                context={"segments": chunk, "participants": names, "title": m.title, "agenda": m.agenda},
                temperature=0.1,
                max_tokens=6000,
            )
        )
    return _merge(results)


async def persist_intelligence(session: AsyncSession, m: Meeting, intel: MeetingIntelligence) -> None:
    await session.execute(delete(MeetingInsight).where(MeetingInsight.meeting_id == m.id, MeetingInsight.source == "final"))
    await session.execute(delete(ActionItem).where(ActionItem.meeting_id == m.id))
    rows: list[tuple[str, str, dict[str, Any]]] = []
    rows += [("topic", t.title, {"summary": t.summary}) for t in intel.topics]
    rows += [("decision", d.text, {"owner": d.owner, "context": d.context}) for d in intel.decisions]
    rows += [("risk", r.text, {"severity": r.severity, "mitigation": r.mitigation}) for r in intel.risks]
    rows += [("question", q.text, {"asked_by": q.asked_by, "answered": q.answered}) for q in intel.questions]
    rows += [("number", n.value, {"label": n.label, "context": n.context}) for n in intel.numbers]
    rows += [("next_step", s, {}) for s in intel.next_steps]
    rows += [("moment", h.quote, {"speaker": h.speaker, "timestamp_ms": h.timestamp_ms}) for h in intel.highlights]
    for typ, content, meta in rows:
        session.add(MeetingInsight(meeting_id=m.id, type=typ, content=content[:4000], meta=meta, source="final"))
    base = (m.started_at or utcnow()).date()
    for a in intel.action_items:
        session.add(
            ActionItem(
                meeting_id=m.id,
                organization_id=m.organization_id,
                title=a.title[:500],
                owner=a.owner,
                deadline_text=a.deadline,
                deadline=parse_deadline(a.deadline, base),
            )
        )
    m.summary = intel.summary
    m.intelligence = intel.model_dump()


async def live_extract(session: AsyncSession, m: Meeting, segs: list[dict[str, Any]]) -> LiveInsights:
    org = await session.get(Organization, m.organization_id)
    instructions, payload = prompts.live_insights_prompt(segments=segs, known={})
    names = [p.name for p in (await session.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id))).scalars()]
    insights = await ai_service.generate(
        task="meeting.live_insights",
        schema=LiveInsights,
        instructions=instructions,
        payload=payload,
        ctx=AIContext(organization_id=m.organization_id, user_id=m.created_by, org_settings=org.settings if org else None),
        context={"segments": segs, "participants": names, "title": m.title, "agenda": m.agenda},
        temperature=0.1,
        max_tokens=2500,
    )
    await session.execute(delete(MeetingInsight).where(MeetingInsight.meeting_id == m.id, MeetingInsight.source == "live"))
    for typ, items in (
        ("topic", [(t.title, {}) for t in insights.topics]),
        ("decision", [(d.text, {"owner": d.owner}) for d in insights.decisions]),
        ("action_item", [(a.title, {"owner": a.owner, "deadline": a.deadline}) for a in insights.action_items]),
        ("question", [(q.text, {"asked_by": q.asked_by}) for q in insights.questions]),
        ("risk", [(r.text, {"severity": r.severity}) for r in insights.risks]),
        ("number", [(n.value, {"label": n.label}) for n in insights.numbers]),
        ("moment", [(h.quote, {"speaker": h.speaker}) for h in insights.moments]),
    ):
        for content, meta in items:
            session.add(MeetingInsight(meeting_id=m.id, type=typ, content=content[:2000], meta=meta, source="live"))
    await session.commit()
    return insights


async def create_meeting_deck(session: AsyncSession, m: Meeting, user_id: uuid.UUID | None) -> Presentation:
    org = await session.get(Organization, m.organization_id)
    brand = await brand_svc.get_brand(session, m.organization_id)
    names = [p.name for p in (await session.execute(select(MeetingParticipant).where(MeetingParticipant.meeting_id == m.id))).scalars()]
    intel = m.intelligence or {}
    date_label = (m.started_at or utcnow()).strftime("%B %d, %Y")
    instructions, payload = prompts.meeting_deck_prompt(
        title=m.title, intelligence=intel, brand=brand_svc.brand_context(brand), participants=names
    )
    content = await ai_service.generate(
        task="meeting.deck",
        schema=DeckContent,
        instructions=instructions,
        payload=payload,
        ctx=ai_ctx(org, user_id),
        context={"intelligence": intel, "title": m.title, "participants": names, "date_label": date_label,
                 "company": (brand.company_profile if brand else {}) or {}},
        max_tokens=10000,
    )
    theme = await brand_svc.theme_for(session, brand)
    p = Presentation(
        organization_id=m.organization_id,
        title=content.title,
        description=f"Generated from meeting “{m.title}”",
        created_by=user_id or m.created_by,
        brand_system_id=brand.id if brand else None,
        source="meeting",
        source_meeting_id=m.id,
        options={"deck_type": "meeting", "slide_count": len(content.slides)},
        status="draft",
    )
    session.add(p)
    await session.flush()
    await save_deck(session, p, Deck(title=content.title, subtitle=content.subtitle, slides=content.slides, theme=theme))  # type: ignore[arg-type]
    m.presentation_id = p.id
    await session.commit()
    return p


@handler("meeting.process")
async def process_job(ctx: JobContext) -> dict[str, Any]:
    s, job = ctx.session, ctx.job
    m = await s.get(Meeting, uuid.UUID(job.payload["meeting_id"]))
    if m is None or m.organization_id != job.organization_id:
        raise ValueError("meeting not found")
    org = await s.get(Organization, m.organization_id)
    m.status = "processing"
    await ctx.progress(10, "Finalizing transcript")
    await finalize_transcript(s, m)
    await s.commit()
    await ctx.progress(30, "Extracting decisions, actions and risks")
    intel = await analyze(s, m, org)
    await ctx.progress(70, "Writing meeting notes")
    await persist_intelligence(s, m, intel)
    m.notes = {**(m.notes or {}), "generated_at": utcnow().isoformat()}
    m.status = "ready"
    await s.commit()
    result: dict[str, Any] = {"meeting_id": str(m.id)}
    if job.payload.get("output") in ("presentation", "both"):
        await ctx.progress(80, "Designing branded presentation")
        p = await create_meeting_deck(s, m, job.created_by)
        result["presentation_id"] = str(p.id)
    return result


@handler("meeting.deck")
async def deck_job(ctx: JobContext) -> dict[str, Any]:
    s, job = ctx.session, ctx.job
    m = await s.get(Meeting, uuid.UUID(job.payload["meeting_id"]))
    if m is None or m.organization_id != job.organization_id:
        raise ValueError("meeting not found")
    if not m.intelligence:
        await ctx.progress(15, "Analyzing meeting first")
        org = await s.get(Organization, m.organization_id)
        await finalize_transcript(s, m)
        await s.commit()
        await persist_intelligence(s, m, await analyze(s, m, org))
        await s.commit()
    await ctx.progress(40, "Designing branded presentation")
    p = await create_meeting_deck(s, m, job.created_by)
    return {"meeting_id": str(m.id), "presentation_id": str(p.id)}


def duration(m: Meeting) -> int | None:
    if m.duration_seconds is not None:
        return m.duration_seconds
    if m.started_at and m.ended_at:
        return int((m.ended_at - m.started_at).total_seconds())
    return None

