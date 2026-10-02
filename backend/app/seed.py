"""Development seed: a fully populated "Acme Corporation" workspace.

Everything is created through the same schemas/pipelines the product uses (deck validation, document
ingestion with real chunking + embeddings, meeting analysis), so the seeded workspace behaves exactly like
user-created data. Demo password for every seeded user: DEMO_PASSWORD below (development only).
"""

import random
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import get_logger
from app.core.security import hash_password
from app.models import (
    ActionItem,
    AIGeneration,
    Asset,
    AuditLog,
    BrandSystem,
    Document,
    Favorite,
    Folder,
    Meeting,
    MeetingParticipant,
    Membership,
    Organization,
    Presentation,
    PresentationSlide,
    Proposal,
    Template,
    Transcript,
    TranscriptSegment,
    User,
)
from app.schemas.ai import MeetingIntelligence, ProposalContent
from app.schemas.deck import Deck, DeckContent
from app.services import brand as brand_svc
from app.services.ai import mock
from app.services.documents import ingest_document
from app.services.meetings import parse_deadline
from app.services.storage import get_storage, make_key

log = get_logger(__name__)
DEMO_PASSWORD = "AcmeDemo2026!"
NOW = datetime.now(UTC).replace(microsecond=0)

PEOPLE = [
    ("Adil Gillani", "adil@acme.com", "owner", "Executive", "Chief Executive Officer"),
    ("Sara Malik", "sara@acme.com", "admin", "Strategy", "Chief Strategy Officer"),
    ("Ahmed Raza", "ahmed@acme.com", "editor", "Sales", "Chief Revenue Officer"),
    ("Lena Ortiz", "lena@acme.com", "editor", "Sales", "Enterprise Account Director"),
    ("Omar Shah", "omar@acme.com", "editor", "Marketing", "Brand Manager"),
    ("Priya Nair", "priya@acme.com", "viewer", "Finance", "Finance Business Partner"),
]

LOGO_SVG = """<svg xmlns="http://www.w3.org/2000/svg" width="240" height="64" viewBox="0 0 240 64">
<rect x="4" y="8" width="48" height="48" rx="10" fill="#1B2A4A"/><rect x="14" y="18" width="28" height="28" rx="5" fill="none" stroke="#F6F4EF" stroke-opacity=".5" stroke-width="2"/>
<circle cx="28" cy="32" r="5" fill="#2F5BD3"/><text x="66" y="41" font-family="Georgia, serif" font-size="28" fill="#1B2A4A">Acme</text>
<text x="140" y="41" font-family="Helvetica, Arial, sans-serif" font-size="13" letter-spacing="3" fill="#6B6F7A">CORP</text></svg>"""

COMPANY = {
    "name": "Acme Corporation",
    "short_name": "Acme",
    "industry": "Enterprise Software & Digital Transformation",
    "website": "acme.com",
    "headquarters": "London · Dubai · Karachi",
    "description": (
        "Acme Corporation helps banks, telcos and governments modernize how they operate. We combine an AI-native "
        "enterprise platform with transformation consulting, delivering measurable outcomes in weeks rather than years. "
        "Founded in 2014, Acme employs 1,200 people across 9 countries and serves 140 enterprise clients."
    ),
    "services": ["Digital transformation consulting", "Core banking modernization", "AI & data platforms", "Managed cloud services", "Customer experience design"],
    "differentiators": ["Brand-locked AI output", "ISO 27001 & SOC 2 Type II", "Outcome-based pricing", "Live in 90 days"],
    "clients": ["Global Bank", "XYZ Telecom", "Ministry of IT", "Meridian Retail"],
}

DOCUMENTS = [
    ("Acme company profile", "company", COMPANY["description"] + """

Acme Corporation at a glance. Founded 2014. 1,200 employees. Offices in London, Dubai, Karachi, Riyadh and Singapore.
Revenue FY26: $210M, growing 38% year over year. 140 enterprise clients including 22 tier-1 banks.

Mission: make every enterprise as fast and consistent as its best team.

Leadership: Adil Gillani (CEO), Sara Malik (Chief Strategy Officer), Ahmed Raza (Chief Revenue Officer), Omar Shah (Chief Technology Officer)."""),
    ("Services catalog 2026", "services", """Acme services catalog.

Digital transformation consulting: target operating model, business case, transformation office. Typical engagement 12–36 months.

Core banking modernization: progressive migration from legacy cores with zero-downtime cut-overs. 14 core migrations delivered since 2019.

AI & data platforms: governed data lakehouse, private AI models, retrieval-augmented assistants for employees and customers.

Managed cloud services: 24/7 operations, FinOps, security operations. 99.95% availability SLA.

Customer experience design: research-led journey redesign; average NPS improvement of 18 points."""),
    ("Case study — Global Bank digital onboarding", "case_study", """Case study: Global Bank — digital onboarding transformation.

Challenge: Corporate customer onboarding took 41 days on average, with 7 manual hand-offs and frequent compliance rework.

Solution: Acme delivered a digital onboarding platform with automated KYC, e-signature and a rules engine, deployed in 16 weeks.

Results: Onboarding time reduced from 41 days to 6 days. $4.2M annual operating savings. Customer NPS up 22 points. Zero compliance findings in the following audit."""),
    ("Case study — XYZ Telecom AI customer care", "case_study", """Case study: XYZ Telecom — AI-assisted customer care.

Challenge: 11 million customers, rising contact volumes, and average handling time of 9 minutes.

Solution: Acme deployed a retrieval-augmented agent assistant across 3,400 agents and a self-service virtual assistant in Urdu and English.

Results: 31% reduction in average handling time. 44% of contacts resolved in self-service. $18M annual savings. Delivered in 5 months."""),
    ("Case study — Ministry of IT digital services", "case_study", """Case study: Ministry of IT — citizen digital services platform.

Challenge: 60 government services spread across 12 portals with inconsistent identity and payments.

Solution: A single citizen platform with national ID integration, unified payments and an open API layer for agencies.

Results: 48 services migrated in year one. 2.3 million monthly active citizens. Processing time cut by 63%."""),
    ("Approved messaging & value propositions", "messaging", """Approved messaging.

Tagline: Enterprise speed, brand-perfect every time.

Value proposition: Acme helps regulated enterprises transform in weeks, not years — with outcome-based commercials and enterprise-grade security.

Proof points: 140 enterprise clients. 22 tier-1 banks. Average 3.2x ROI within 18 months. Live in 90 days.

Never say: "cheap", "disrupt", "revolutionary". Prefer: "measurable", "proven", "secure"."""),
    ("Acme brand guidelines", "brand_guidelines", """Acme brand guidelines (v4).

Logo: always on Midnight or Paper backgrounds with clear space equal to the mark height. Never stretch, recolor or add effects.

Color: Acme Blue #2F5BD3 is the primary action color. Midnight #1B2A4A for premium surfaces. Gold #E3B866 is an accent — use sparingly, max one gold element per slide.

Typography: Instrument Serif for headlines, Geist for body copy, Geist Mono for data and labels.

Layout: generous white space; maximum 6 bullets per slide; one idea per slide; headlines state the takeaway."""),
]

TEMPLATES = [
    ("Investor Narrative", "investor", "investor", "premium", "Series A–C fundraising narrative with traction, market and the ask."),
    ("Quarterly Board Review", "board", "board", "executive", "Board-ready performance review with KPIs, risks and decisions."),
    ("Enterprise Sales Pitch", "sales", "sales", "modern", "Customer-centric pitch: challenges, solution, proof and pricing."),
    ("Consulting Engagement Readout", "consulting", "strategy", "editorial", "Diagnose → design → deliver readout for client steering committees."),
    ("Financial Results", "finance", "board", "executive", "Quarterly results with revenue, margin and outlook charts."),
    ("Campaign Plan", "marketing", "product_launch", "modern", "Integrated marketing campaign plan with timeline and KPIs."),
    ("Product Launch", "product", "product_launch", "modern", "Launch narrative: problem, product, proof, pricing and roadmap."),
    ("Annual Strategy", "strategy", "strategy", "editorial", "Strategic priorities, transformation and roadmap for the year ahead."),
    ("All-Hands & Onboarding", "hr", "training", "modern", "Company all-hands or new-joiner onboarding."),
    ("Public Sector Briefing", "government", "strategy", "executive", "Ministerial briefing with context, options and recommendation."),
    ("Client Proposal Deck", "proposal", "sales", "premium", "Proposal companion deck for executive presentations."),
    ("Meeting Readout", "meeting", "default", "executive", "Decisions, action plan and next steps from a leadership meeting."),
]

PRESENTATIONS = [
    ("Q3 Board Review", "board", 10, "approved", "premium", 0, timedelta(hours=2), "Performance, priorities and the path to FY27."),
    ("Series B Investor Presentation", "investor", 12, "in_review", "modern", 2, timedelta(days=1), "Fintech platform growth story for Series B investors."),
    ("Annual Strategy 2027", "strategy", 11, "draft", "editorial", 0, timedelta(days=3), "Strategic priorities and roadmap for 2027."),
    ("Enterprise Sales Proposal", "sales", 10, "presented", "executive", 3, timedelta(days=8), "Enterprise pitch for tier-1 banks."),
    ("Product Launch — Atlas 4", "product_launch", 10, "approved", "modern", 4, timedelta(days=12), "Launch narrative for Atlas 4."),
    ("Market Analysis H2", "market_analysis", 8, "draft", "executive", 5, timedelta(days=14), "Market sizing and competitive landscape for H2."),
]

PROPOSALS = [
    ("abc", "Digital Transformation Program", "ABC Bank", "Banking", "Faisal Khan", 2_400_000, "internal_review", 3, timedelta(hours=1), "Create a proposal for ABC Bank for a three-year digital transformation program."),
    ("xyz", "AI Customer Care Expansion", "XYZ Telecom", "Telecommunications", "Maria Chen", 5_100_000, "sent", 2, timedelta(days=1), "Proposal to expand AI customer care to all regions."),
    ("gi", "Operating Model Consulting", "Global Industries", "Manufacturing", "Tom Baker", 860_000, "won", 1, timedelta(days=10), "Consulting proposal for an operating model redesign."),
    ("gov", "Citizen Services Platform Phase 2", "Ministry of IT", "Government", "Dr. Amina Yusuf", 3_200_000, "draft", 4, timedelta(days=13), "Government technology proposal for phase two of the citizen platform."),
    ("nw", "Strategic Partnership", "Northwind Cloud", "Cloud Infrastructure", "Ravi Patel", 1_100_000, "ready", 5, timedelta(days=17), "Partnership proposal for joint go-to-market."),
    ("mr", "Analytics Platform", "Meridian Retail", "Retail", "Sophie Martin", 640_000, "lost", 0, timedelta(days=30), "Analytics platform proposal for retail merchandising."),
]

LEADERSHIP_SYNC = [
    (1, "Let's start with the pipeline. We closed two banking deals this week worth $1.3M combined."),
    (0, "Great progress. What's blocking the Ministry of IT renewal?"),
    (2, "Procurement wants a security review. The concern is data residency for citizen records."),
    (0, "We decided to offer the in-country deployment option. Omar, can you prepare the architecture note by Thursday?"),
    (3, "I'll have the architecture note ready by Thursday."),
    (1, "Marketing launches the Atlas 4 campaign on the 15th; budget is $220K."),
    (4, "One risk: the analyst briefing slipped to next month, which could delay coverage."),
    (0, "Agreed. Let's review campaign metrics in two weeks."),
]
DISCOVERY = [
    (0, "Thanks for joining. We want to understand ABC Bank's priorities for the next three years."),
    (5, "Our biggest issue is onboarding time for corporate clients — it's around 38 days today."),
    (1, "We delivered a similar program at Global Bank and cut onboarding to 6 days."),
    (5, "That's compelling. Budget for phase one is roughly $2.4M over three years."),
    (5, "Can you send a proposal by October 20?"),
    (1, "Yes, I'll send the proposal by October 20 with a phased commercial model."),
    (0, "The main risk is integration with your legacy core; we'll include a mitigation plan."),
]


def _slide_rows(pid: uuid.UUID, deck: Deck) -> list[PresentationSlide]:
    return [PresentationSlide(presentation_id=pid, position=i, schema=s.model_dump(by_alias=True)) for i, s in enumerate(deck.slides)]


async def _deck(session: AsyncSession, brand: BrandSystem, deck_type: str, n: int, style: str, prompt: str, title: str | None = None) -> Deck:
    content = DeckContent.model_validate(
        mock.gen_presentation({"prompt": prompt, "deck_type": deck_type, "slide_count": n, "company": brand.company_profile, "title": title, "audience": "executives"})
    )
    theme = await brand_svc.theme_for(session, brand, style)
    return Deck(title=title or content.title, subtitle=content.subtitle, slides=content.slides, theme=theme)  # type: ignore[arg-type]


async def reset(session: AsyncSession) -> None:
    for slug in ("acme", "acme-ventures"):
        org = (await session.execute(select(Organization).where(Organization.slug == slug))).scalar_one_or_none()
        if org:
            await session.delete(org)
    await session.execute(delete(User).where(User.email.like("%@acme.com")))
    await session.commit()


async def seed(session: AsyncSession, force: bool = False) -> bool:
    existing = (await session.execute(select(Organization).where(Organization.slug == "acme"))).scalar_one_or_none()
    if existing and not force:
        log.info("seed: Acme workspace already exists — skipping (use --reset to recreate)")
        return False
    if existing:
        await reset(session)
    rnd = random.Random(7)

    org = Organization(name="Acme Corporation", slug="acme", plan="enterprise", seats=142, created_at=NOW - timedelta(days=120),
                       settings={"ai": {"temperature": 0.4, "default_slide_count": 10, "default_tone": "executive", "system_instructions": "Write for a regulated enterprise audience. Use British English spelling.", "use_knowledge_default": True}})
    session.add(org)
    users: list[User] = []
    pw = hash_password(DEMO_PASSWORD)
    for i, (name, email, role, dept, title) in enumerate(PEOPLE):
        u = User(email=email, name=name, password_hash=pw, created_at=NOW - timedelta(days=120 - i), last_login_at=NOW - timedelta(minutes=5 + i * 170))
        session.add(u)
        users.append(u)
    await session.flush()
    for u, (_, _, role, dept, title) in zip(users, PEOPLE, strict=True):
        session.add(Membership(user_id=u.id, organization_id=org.id, role=role, department=dept, title=title, created_at=u.created_at))

    # second workspace for the switcher / isolation demo
    ventures = Organization(name="Acme Ventures", slug="acme-ventures", plan="enterprise", seats=12)
    session.add(ventures)
    await session.flush()
    session.add(Membership(user_id=users[0].id, organization_id=ventures.id, role="admin", created_at=NOW))
    session.add(BrandSystem(organization_id=ventures.id, name="Acme Ventures Brand", is_default=True, colors=[{"name": "Forest", "hex": "#14532D", "role": "primary"}, {"name": "Night", "hex": "#0F172A", "role": "secondary"}, {"name": "Lime", "hex": "#A3E635", "role": "accent"}], fonts=brand_svc.DEFAULT_FONTS, company_profile={"name": "Acme Ventures", "industry": "Venture capital", "description": "Acme's corporate venture arm."}))

    # logo asset
    logo_key = make_key(org.id, "assets", "acme-logo.svg")
    await get_storage().put(logo_key, LOGO_SVG.encode(), "image/svg+xml")
    logo = Asset(organization_id=org.id, filename="acme-logo.svg", name="Acme primary logo", type="logo", mime_type="image/svg+xml", size_bytes=len(LOGO_SVG), storage_key=logo_key, meta={"width": 240, "height": 64, "tags": ["primary", "approved"]}, uploaded_by=users[4].id, created_at=NOW - timedelta(days=100))
    session.add(logo)
    await session.flush()

    brand = BrandSystem(
        organization_id=org.id, name="Acme Corporation Brand", is_default=True, brand_lock=True, colors=brand_svc.DEFAULT_COLORS,
        fonts=brand_svc.DEFAULT_FONTS, logo_asset_id=logo.id, default_style="executive", company_profile=COMPANY,
        guidelines=DOCUMENTS[-1][2],
        visual_rules=[
            {"id": "r1", "rule": "Maximum 6 bullets per slide; one idea per slide", "category": "layout"},
            {"id": "r2", "rule": "Headlines state the takeaway, not the topic", "category": "copy"},
            {"id": "r3", "rule": "Gold accent at most once per slide", "category": "color"},
            {"id": "r4", "rule": "Never stretch, recolor or add effects to the logo", "category": "logo"},
            {"id": "r5", "rule": "Charts highlight the single most important data point", "category": "data"},
        ],
        tone_of_voice={"summary": "Confident, precise and human. We sound like a trusted senior advisor.", "attributes": ["Confident", "Precise", "Warm", "Outcome-led"], "do": ["Lead with outcomes and numbers", "Use active voice", "Be specific about timelines"], "dont": ["Hype words like 'revolutionary'", "Jargon without explanation", "Unquantified claims"]},
        approved_messaging=["Enterprise speed, brand-perfect every time.", "Transform in weeks, not years.", "Live in 90 days.", "Average 3.2x ROI within 18 months."],
        created_at=NOW - timedelta(days=110),
    )
    session.add(brand)
    await session.flush()

    # templates
    first_tpl = None
    for i, (name, cat, deck_type, style, desc) in enumerate(TEMPLATES):
        deck = await _deck(session, brand, deck_type, 8, style, f"{name} for Acme Corporation", name)
        t = Template(organization_id=org.id, name=name, description=desc, category=cat, kind="presentation", schema=deck.model_dump(by_alias=True), source="built_in", approved=True, usage_count=rnd.randint(4, 60), created_by=users[4].id, created_at=NOW - timedelta(days=90 - i))
        session.add(t)
        first_tpl = first_tpl or t
    await session.flush()
    brand.default_template_id = first_tpl.id if first_tpl else None

    # folders
    folders = {n: Folder(organization_id=org.id, name=n, kind="presentations") for n in ("Board & Investors", "Sales", "Strategy")}
    asset_folders = {n: Folder(organization_id=org.id, name=n, kind="assets") for n in ("Brand", "Photography", "Product")}
    session.add_all([*folders.values(), *asset_folders.values()])
    await session.flush()
    logo.folder_id = asset_folders["Brand"].id

    # presentations
    folder_for = {"board": "Board & Investors", "investor": "Board & Investors", "sales": "Sales", "strategy": "Strategy", "market_analysis": "Strategy"}
    pres: list[Presentation] = []
    for title, deck_type, n, status, style, author, ago, desc in PRESENTATIONS:
        deck = await _deck(session, brand, deck_type, n, style, f"{title} for Acme", title)
        when = NOW - ago
        p = Presentation(organization_id=org.id, title=title, description=desc, schema={"version": 1, "subtitle": deck.subtitle, "theme": deck.theme.model_dump()}, status=status, style=style, created_by=users[author].id, brand_system_id=brand.id, folder_id=folders[folder_for[deck_type]].id if deck_type in folder_for else None, source="prompt", prompt=f"Create a {n}-slide {deck_type.replace('_', ' ')} presentation: {desc}", options={"deck_type": deck_type, "slide_count": n, "audience": "executives", "tone": "executive"}, created_at=when - timedelta(days=2), updated_at=when, last_presented_at=when if status == "presented" else None)
        session.add(p)
        await session.flush()
        session.add_all(_slide_rows(p.id, deck))
        pres.append(p)
    # history for analytics
    history_topics = ["Customer success review", "EMEA expansion plan", "Partner enablement", "Security & compliance update", "Pricing strategy", "Hiring plan FY27", "Atlas roadmap", "Banking vertical playbook", "Telecom QBR", "Investor update", "Brand refresh", "Data platform vision", "Ops excellence", "AI governance", "Customer advisory board", "Marketing QBR", "Government sector strategy", "Retail analytics pitch"]
    for i, topic in enumerate(history_topics):
        dt = rnd.choice(["board", "sales", "strategy", "product_launch", "investor", "company_overview"])
        deck = await _deck(session, brand, dt, rnd.randint(5, 9), rnd.choice(["executive", "modern", "editorial", "premium"]), topic, topic)
        when = NOW - timedelta(days=16 + i * 5 + rnd.randint(0, 3))
        p = Presentation(organization_id=org.id, title=topic, description="", schema={"version": 1, "subtitle": deck.subtitle, "theme": deck.theme.model_dump()}, status=rnd.choice(["approved", "presented", "draft"]), style=deck.theme.style, created_by=rnd.choice(users[:5]).id, brand_system_id=brand.id, source="prompt", options={"deck_type": dt, "slide_count": len(deck.slides)}, created_at=when, updated_at=when + timedelta(days=1))
        session.add(p)
        await session.flush()
        session.add_all(_slide_rows(p.id, deck))
    for p in (pres[0], pres[1]):
        session.add(Favorite(user_id=users[0].id, organization_id=org.id, resource_type="presentation", resource_id=p.id))

    # proposals
    theme = await brand_svc.theme_for(session, brand)
    for _key, title, client, industry, contact, value, status, author, ago, prompt in PROPOSALS:
        content = ProposalContent.model_validate(mock.gen_proposal({"client": client, "industry": industry, "prompt": prompt, "value": value, "company": COMPANY, "title": title}))
        when = NOW - ago
        session.add(Proposal(organization_id=org.id, client=client, industry=industry, contact_name=contact, contact_email=f"{contact.split()[-1].lower()}@{client.split()[0].lower()}.com", opportunity=title, title=title, description=prompt, value=value, currency="USD", deadline=(NOW + timedelta(days=rnd.randint(5, 40))).date(), status=status, prompt=prompt, brand_system_id=brand.id, created_by=users[author].id, created_at=when - timedelta(days=3), updated_at=when,
                             schema={"subtitle": content.subtitle, "sections": [s.model_dump(by_alias=True) for s in content.sections], "theme": theme, "brand_lock": True, "creative_mode": False, "compliance": brand_svc.compliance_report(brand, theme, False)}))

    # meetings
    from app.services.stt.mock import SCRIPT_EN

    names = [p[0] for p in PEOPLE]
    meetings_spec = [
        ("Q4 Strategy Meeting", SCRIPT_EN, ["Ahmed Raza", "Sara Malik", "Omar Shah", "Priya Nair", "Lena Ortiz"], timedelta(hours=4), 42 * 60, "Q4 priorities\nEnterprise onboarding\nEU expansion", True),
        ("Weekly Leadership Sync", LEADERSHIP_SYNC, ["Adil Gillani", "Ahmed Raza", "Sara Malik", "Omar Shah", "Lena Ortiz"], timedelta(days=2), 31 * 60, None, False),
        ("ABC Bank Discovery Call", DISCOVERY, ["Lena Ortiz", "Ahmed Raza", "Sara Malik", "Omar Shah", "Priya Nair", "Faisal Khan"], timedelta(days=5), 48 * 60, "Client priorities\nCurrent onboarding process\nBudget & timeline", False),
    ]
    for title, script, people, ago, secs, agenda, make_deck in meetings_spec:
        started = NOW - ago
        m = Meeting(organization_id=org.id, title=title, agenda=agenda, status="ready", language="en", location="Boardroom 4A", started_at=started, ended_at=started + timedelta(seconds=secs), duration_seconds=secs, created_by=users[0].id, stt_provider="deepgram", audio_meta={"sample_rate": 16000, "channels": 1, "encoding": "pcm_s16le", "seconds": secs}, created_at=started)
        session.add(m)
        await session.flush()
        for i, n in enumerate(people):
            email = next((p[1] for p in PEOPLE if p[0] == n), None)
            session.add(MeetingParticipant(meeting_id=m.id, name=n, email=email, speaker_label=str(i)))
        segs = []
        t_ms = 0
        for seq, (who, text) in enumerate(script, 1):
            dur = 3000 + len(text) * 55
            seg = {"speaker": people[who % len(people)], "text": text, "start_ms": t_ms, "end_ms": t_ms + dur}
            segs.append(seg)
            session.add(TranscriptSegment(meeting_id=m.id, seq=seq, speaker=seg["speaker"], text=text, start_ms=t_ms, end_ms=t_ms + dur, language="en"))
            t_ms += dur + 2500
        session.add(Transcript(meeting_id=m.id, content="\n".join(f"{s['speaker']}: {s['text']}" for s in segs), timestamps=segs, language="en", provider="deepgram"))
        intel = MeetingIntelligence.model_validate(mock.analyze_meeting({"segments": segs, "participants": people, "title": title, "agenda": agenda}))
        from app.services.meetings import persist_intelligence

        await persist_intelligence(session, m, intel)
        await session.flush()
        if make_deck:
            content = DeckContent.model_validate(mock.gen_meeting_deck({"intelligence": intel.model_dump(), "title": title, "participants": people, "date_label": started.strftime("%B %d, %Y"), "company": COMPANY}))
            deck = Deck(title=content.title, subtitle=content.subtitle, slides=content.slides, theme=theme)  # type: ignore[arg-type]
            p = Presentation(organization_id=org.id, title=deck.title, description=f"Generated from meeting “{title}”", schema={"version": 1, "subtitle": deck.subtitle, "theme": deck.theme.model_dump()}, status="draft", style="executive", created_by=users[0].id, brand_system_id=brand.id, source="meeting", source_meeting_id=m.id, options={"deck_type": "meeting"}, created_at=started + timedelta(minutes=50), updated_at=started + timedelta(minutes=50))
            session.add(p)
            await session.flush()
            session.add_all(_slide_rows(p.id, deck))
            m.presentation_id = p.id
    # mark a couple of seeded action items done
    for a in (await session.execute(select(ActionItem).where(ActionItem.organization_id == org.id))).scalars():
        if a.deadline is None:
            a.deadline = parse_deadline(a.deadline_text, NOW.date())
    for title, days, people in (("Board Prep Review", 1, ["Adil Gillani", "Sara Malik", "Priya Nair"]), ("Brand Council", 3, ["Omar Shah", "Sara Malik", "Lena Ortiz"]), ("Atlas 4 Launch Readiness", 6, ["Omar Shah", "Ahmed Raza", "Adil Gillani", "Priya Nair"])):
        m = Meeting(organization_id=org.id, title=title, status="scheduled", language="en", location="Boardroom 4A", scheduled_at=(NOW + timedelta(days=days)).replace(hour=10, minute=0, second=0), created_by=users[1].id)
        session.add(m)
        await session.flush()
        for n in people:
            session.add(MeetingParticipant(meeting_id=m.id, name=n, email=next((p[1] for p in PEOPLE if p[0] == n), None)))

    # AI generation history + audit trail for analytics
    tasks = ["presentation.generate", "proposal.generate", "meeting.analyze", "meeting.live_insights", "presentation.slide_edit", "proposal.section_edit", "document.analyze", "meeting.deck"]
    for i in range(180):
        task = rnd.choices(tasks, weights=[20, 8, 10, 25, 30, 10, 6, 5])[0]
        session.add(AIGeneration(organization_id=org.id, user_id=rnd.choice(users).id, task=task, provider="qwen", model="qwen3.5-plus", status=rnd.choices(["success", "repaired", "failed"], weights=[92, 6, 2])[0], attempts=1, latency_ms=rnd.randint(900, 14000), prompt_tokens=rnd.randint(1500, 9000), completion_tokens=rnd.randint(400, 6000), created_at=NOW - timedelta(days=rnd.randint(0, 84), hours=rnd.randint(0, 23)), meta={"seed": True}))
    actions = [("presentation.generate", "presentation"), ("presentation.export", "presentation"), ("proposal.generate", "proposal"), ("meeting.end", "meeting"), ("brand.update", "brand_system"), ("document.upload", "document"), ("share.create", "presentation")]
    for i in range(40):
        a, r = rnd.choice(actions)
        session.add(AuditLog(organization_id=org.id, user_id=rnd.choice(users).id, action=a, resource=r, meta={}, ip_address="10.0.4.12", created_at=NOW - timedelta(hours=i * 7 + rnd.randint(0, 5))))
    await session.commit()

    # company knowledge — real ingestion pipeline (extract → chunk → embed → summarize)
    for i, (title, category, text) in enumerate(DOCUMENTS):
        data = text.strip().encode()
        key = make_key(org.id, "documents", f"{title}.txt")
        await get_storage().put(key, data, "text/plain")
        d = Document(organization_id=org.id, filename=f"{title}.txt", title=title, category=category, mime_type="text/plain", size_bytes=len(data), storage_key=key, status="queued", uploaded_by=users[i % 3].id, created_at=NOW - timedelta(days=60 - i * 4))
        session.add(d)
        await session.commit()
        await ingest_document(session, d, data)

    log.info("seed complete", extra={"data": {"org": org.slug, "users": len(users), "login": PEOPLE[0][1], "password": "<see DEMO_PASSWORD>"}})
    return True

