"""Deterministic development provider.

Produces schema-valid, context-aware JSON for every AI task so the full product works without an API
key (and so tests are reproducible). Output is driven by the same structured inputs the real prompts
are rendered from: the user's prompt, presentation type, company profile, retrieved knowledge,
transcripts, etc. It is intentionally heuristic — swap LLM_PROVIDER=qwen for real generation.
"""

import hashlib
import math
import random
import re
from collections import Counter
from typing import Any

# ---------------------------------------------------------------------------- helpers

STOP = set(
    """a an the and or but if of to in on for with at by from as is are was were be been being it its this that these
    those we our us you your they their i me my he she him her them his hers not no so do does did done have has had
    will would should could can may might must shall about into over under than then there here what which who whom
    whose when where why how all any both each few more most other some such only own same too very just also
    create make build generate presentation deck slides slide proposal please need want lets let's okay ok yeah yes
    right think going get got one two three like really well now today next last new up out""".split()
)


def _rng(*parts: Any) -> random.Random:
    seed = hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()
    return random.Random(int(seed[:12], 16))


def _title_case(s: str) -> str:
    small = {"and", "or", "of", "for", "the", "a", "an", "in", "on", "to", "with", "vs"}
    words = s.split()
    out = []
    for i, w in enumerate(words):
        if w.isupper() and len(w) > 1:
            out.append(w)
        elif i and w.lower() in small:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)


def extract_topic(prompt: str, fallback: str = "Strategic Overview") -> str:
    p = re.sub(r"\s+", " ", prompt or "").strip().rstrip(".!")
    patterns = [
        r"\babout (.+)",
        r"\bon (?:the )?(.+)",
        r"\bfor (?:our |the )?(.+?)(?: for | to |$)",
        r"\bcovering (.+)",
    ]
    for pat in patterns:
        m = re.search(pat, p, re.IGNORECASE)
        if m:
            topic = m.group(1)
            break
    else:
        topic = p
    topic = re.sub(r"^(our|the|a|an|my)\s+", "", topic.strip(), flags=re.IGNORECASE)
    topic = re.split(r"[.;\n]| that | which | using | with a focus", topic)[0].strip()
    topic = " ".join(topic.split()[:8])
    return _title_case(topic) if topic else fallback


def _company(ctx: dict[str, Any]) -> dict[str, Any]:
    c = ctx.get("company") or {}
    return {
        "name": c.get("name") or "Acme Corporation",
        "short": (c.get("name") or "Acme").split()[0],
        "industry": c.get("industry") or "Enterprise Software",
        "description": c.get("description") or "",
        "services": c.get("services") or ["Strategy", "Implementation", "Managed services"],
        "differentiators": c.get("differentiators") or ["Enterprise-grade security", "Faster time to value"],
        "clients": c.get("clients") or [],
    }


def _sentences(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?؟])\s+|\n+", text or "")
    return [p.strip() for p in parts if len(p.strip()) > 3]


def _knowledge_facts(ctx: dict[str, Any], limit: int = 4) -> list[str]:
    facts: list[str] = []
    for chunk in ctx.get("knowledge") or []:
        text = chunk.get("content", "") if isinstance(chunk, dict) else str(chunk)
        for s in _sentences(text):
            if re.search(r"\d", s) and 25 < len(s) < 220:
                facts.append(s)
            if len(facts) >= limit:
                return facts
    return facts


def _anim(kind: str, delay: int = 0) -> dict[str, Any]:
    return {"type": kind, "delay_ms": delay, "duration_ms": 550, "stagger_ms": 90, "direction": "up"}


def _shorten(text: str, ratio: float) -> str:
    words = text.split()
    keep = max(3, math.ceil(len(words) * ratio))
    out = " ".join(words[:keep]).rstrip(",;:—-")
    return out


# ---------------------------------------------------------------------------- presentations

PLANS: dict[str, list[str]] = {
    "investor": [
        "hero", "problem", "solution", "market", "product", "traction", "business_model", "competition",
        "gtm", "team", "financials", "roadmap", "ask", "closing",
    ],
    "board": [
        "hero", "agenda", "highlights", "revenue", "kpis", "priorities", "risks", "roadmap", "asks", "closing",
    ],
    "sales": [
        "hero", "challenges", "solution", "how_it_works", "benefits", "proof", "competition", "pricing",
        "implementation", "closing",
    ],
    "product_launch": [
        "hero", "problem", "solution", "product", "how_it_works", "benefits", "proof", "pricing", "roadmap",
        "closing",
    ],
    "strategy": [
        "hero", "agenda", "context", "insights", "priorities", "before_after", "process", "roadmap", "kpis",
        "risks", "closing",
    ],
    "default": [
        "hero", "agenda", "context", "insights", "highlights", "revenue", "process", "competition", "roadmap",
        "proof", "team", "closing",
    ],
}
PLAN_ALIASES = {
    "company_overview": "default",
    "annual_report": "board",
    "training": "strategy",
    "market_analysis": "default",
    "custom": "default",
}
FILLERS = ["insights", "process", "highlights", "before_after", "proof", "kpis", "competition", "context"]


def _plan(deck_type: str, n: int) -> list[str]:
    base = PLANS.get(deck_type) or PLANS[PLAN_ALIASES.get(deck_type, "default")]
    body = [k for k in base if k not in ("hero", "closing")]
    want = max(n - 2, 0)
    if len(body) > want:
        body = body[:want]
    i = 0
    while len(body) < want:
        extra = FILLERS[i % len(FILLERS)]
        body.append(extra if extra not in body else f"{extra}#{i}")
        i += 1
    plan = ["hero", *body]
    if n >= 2:
        plan.append("closing")
    return plan[:n]


def _slide_builders(topic: str, co: dict[str, Any], r: random.Random, ctx: dict[str, Any]) -> dict[str, Any]:
    name, short = co["name"], co["short"]
    audience = ctx.get("audience") or "executives"
    growth = r.choice([38, 46, 52, 61, 74])
    arr = r.choice([12.4, 18.6, 24.1, 31.8, 48.2])
    nrr = r.choice([118, 124, 128, 131])
    margin = r.choice([71, 76, 81])
    tam = r.choice([18, 24, 42, 64])
    quarters = ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2", "Q3", "Q4"]
    series = [round(arr * (0.45 + 0.08 * i) + r.uniform(-0.6, 0.6), 1) for i in range(8)]
    facts = _knowledge_facts(ctx)
    services = co["services"][:4] or ["Strategy", "Platform", "Services", "Support"]

    def s(layout: str, title: str, **kw: Any) -> dict[str, Any]:
        return {"layout": layout, "title": title, **kw}

    return {
        "hero": lambda: s(
            "hero",
            topic,
            eyebrow=f"{name} · {ctx.get('deck_label', 'Presentation')}",
            subtitle=f"Prepared for {audience.lower()} · {ctx.get('date_label', '2026')}",
            elements=[{"type": "shape", "shape": "line", "color": "accent", "animation": _anim("reveal")}],
            background="inverse",
            notes=f"Open by framing why {topic.lower()} matters now. Keep the first minute crisp.",
        ),
        "agenda": lambda: s(
            "agenda",
            "Agenda",
            elements=[
                {
                    "type": "bullets",
                    "ordered": True,
                    "items": ["Where we are today", "What we've learned", "Strategic priorities", "Roadmap", "Decisions we need"],
                    "animation": _anim("stagger"),
                }
            ],
            notes="Walk through the agenda quickly; signal where the decision points are.",
        ),
        "problem": lambda: s(
            "split",
            "The problem is costing enterprises millions",
            eyebrow="The problem",
            elements=[
                {
                    "type": "bullets",
                    "items": [
                        f"Legacy approaches to {topic.lower()} are slow and fragmented",
                        "Teams spend 30–40% of their time on manual work",
                        "Inconsistent output erodes trust with customers and regulators",
                    ],
                    "animation": _anim("stagger"),
                },
                {"type": "image", "query": f"{topic} complexity", "alt": "Fragmented legacy systems", "animation": _anim("fade", 200)},
            ],
            notes="Make the pain concrete. Use a customer example if you have one.",
        ),
        "challenges": lambda: s(
            "grid",
            "What we hear from customers",
            eyebrow="Challenges",
            elements=[
                {"type": "icon", "name": "clock", "label": "Slow delivery", "description": "Weeks to ship what should take days"},
                {"type": "icon", "name": "shield-alert", "label": "Compliance risk", "description": "Manual controls, inconsistent evidence"},
                {"type": "icon", "name": "layers", "label": "Fragmented tools", "description": "Seven systems, no single source of truth"},
                {"type": "icon", "name": "trending-down", "label": "Rising cost", "description": "Cost-to-serve up 18% year on year"},
            ],
        ),
        "solution": lambda: s(
            "grid",
            f"{short} makes {topic.lower()} simple, secure and fast",
            eyebrow="Our solution",
            elements=[
                {"type": "icon", "name": "sparkles", "label": "AI-native", "description": "Automates the repetitive 60% of the work"},
                {"type": "icon", "name": "shield-check", "label": "Enterprise-grade", "description": "SOC 2, SSO, data residency"},
                {"type": "icon", "name": "plug", "label": "Connected", "description": "Integrates with the systems you already run"},
                {"type": "icon", "name": "gauge", "label": "Measurable", "description": "ROI dashboards from day one"},
            ],
            notes="Tie each pillar back to one of the problems on the previous slide.",
        ),
        "market": lambda: s(
            "metrics",
            "A large market moving fast",
            eyebrow="Market opportunity",
            elements=[
                {"type": "metric", "value": f"${tam}B", "label": "Total addressable market", "animation": _anim("scale")},
                {"type": "metric", "value": f"${round(tam * 0.32)}B", "label": "Serviceable market", "animation": _anim("scale", 120)},
                {"type": "metric", "value": f"{r.choice([17, 21, 24])}%", "label": "Annual market growth", "trend": "up", "animation": _anim("scale", 240)},
            ],
            notes="Source market numbers before presenting externally.",
        ),
        "product": lambda: s(
            "architecture",
            "How the platform works",
            eyebrow="Product",
            elements=[
                {
                    "type": "diagram",
                    "kind": "architecture",
                    "nodes": [
                        {"id": "data", "label": "Your data", "description": "ERP · CRM · Docs", "group": "sources"},
                        {"id": "core", "label": f"{short} Core", "description": "AI engine + rules", "group": "platform"},
                        {"id": "gov", "label": "Governance", "description": "Audit · Access · Policy", "group": "platform"},
                        {"id": "apps", "label": "Workflows", "description": "Teams · Channels", "group": "outputs"},
                        {"id": "insight", "label": "Insights", "description": "Dashboards · Alerts", "group": "outputs"},
                    ],
                    "edges": [
                        {"from": "data", "to": "core"},
                        {"from": "core", "to": "gov"},
                        {"from": "core", "to": "apps"},
                        {"from": "core", "to": "insight"},
                    ],
                    "animation": _anim("reveal"),
                }
            ],
        ),
        "traction": lambda: s(
            "chart",
            f"Revenue grew {growth}% year over year",
            eyebrow="Traction",
            subtitle="Annual recurring revenue, $M",
            elements=[
                {
                    "type": "chart",
                    "chart_type": "bar",
                    "labels": [f"{q} {'25' if i < 4 else '26'}" for i, q in enumerate(quarters)],
                    "series": [{"name": "ARR", "values": series}],
                    "unit": "$M",
                    "highlight_index": 7,
                    "animation": _anim("progressive"),
                },
                {"type": "text", "role": "caption", "text": f"Net revenue retention {nrr}% · Gross margin {margin}%"},
            ],
            notes="Lead with the growth rate; mention retention as proof of product value.",
        ),
        "revenue": lambda: s(
            "chart",
            "Revenue growth accelerated",
            eyebrow="Performance",
            subtitle="Quarterly revenue, $M",
            elements=[
                {
                    "type": "chart",
                    "chart_type": "area",
                    "labels": [f"{q}" for q in quarters[:6]],
                    "series": [{"name": "Revenue", "values": series[:6]}, {"name": "Plan", "values": [round(v * 0.93, 1) for v in series[:6]]}],
                    "unit": "$M",
                    "animation": _anim("progressive"),
                }
            ],
        ),
        "business_model": lambda: s(
            "table",
            "A recurring, expanding business model",
            eyebrow="Business model",
            elements=[
                {
                    "type": "table",
                    "columns": ["Tier", "Customers", "Avg. contract", "Expansion"],
                    "rows": [
                        ["Enterprise", "Fortune 1000", "$420K", f"{nrr}% NRR"],
                        ["Growth", "Mid-market", "$85K", "112% NRR"],
                        ["Platform", "Partners & ISVs", "Usage-based", "Rev-share"],
                    ],
                    "animation": _anim("fade"),
                }
            ],
        ),
        "competition": lambda: s(
            "comparison",
            f"Why {short} wins",
            eyebrow="Differentiation",
            elements=[
                {
                    "type": "columns",
                    "columns": [
                        {"title": short, "tone": "positive", "items": co["differentiators"][:3] + ["Live in weeks, not quarters"]},
                        {"title": "Alternatives", "tone": "negative", "items": ["Point solutions", "Manual governance", "Months to implement", "Opaque pricing"]},
                    ],
                    "animation": _anim("stagger"),
                }
            ],
        ),
        "gtm": lambda: s(
            "process",
            "Go-to-market engine",
            eyebrow="Go-to-market",
            elements=[
                {
                    "type": "diagram",
                    "kind": "process",
                    "nodes": [
                        {"id": "a", "label": "Land", "description": "Executive-sponsored pilot"},
                        {"id": "b", "label": "Prove", "description": "ROI in 60 days"},
                        {"id": "c", "label": "Expand", "description": "New teams & regions"},
                        {"id": "d", "label": "Partner", "description": "SI & cloud marketplaces"},
                    ],
                    "edges": [{"from": "a", "to": "b"}, {"from": "b", "to": "c"}, {"from": "c", "to": "d"}],
                    "animation": _anim("stagger"),
                }
            ],
        ),
        "team": lambda: s(
            "team",
            "A team built to win this market",
            eyebrow="Leadership",
            elements=[
                {
                    "type": "people",
                    "people": [
                        {"name": "Adil Gillani", "role": "Chief Executive Officer", "bio": "2x founder, scaled to $100M ARR"},
                        {"name": "Sara Malik", "role": "Chief Strategy Officer", "bio": "Ex-McKinsey, enterprise transformation"},
                        {"name": "Ahmed Raza", "role": "Chief Revenue Officer", "bio": "Built global sales at two unicorns"},
                        {"name": "Omar Shah", "role": "Chief Technology Officer", "bio": "AI infrastructure at hyperscale"},
                    ],
                    "animation": _anim("stagger"),
                }
            ],
        ),
        "financials": lambda: s(
            "chart",
            "Path to profitability",
            eyebrow="Financials",
            subtitle="Revenue vs. operating margin",
            elements=[
                {
                    "type": "chart",
                    "chart_type": "line",
                    "labels": ["FY24", "FY25", "FY26", "FY27E", "FY28E"],
                    "series": [{"name": "Revenue ($M)", "values": [round(arr * k, 1) for k in (0.4, 0.7, 1.0, 1.55, 2.3)]}],
                    "unit": "$M",
                    "highlight_index": 2,
                    "animation": _anim("progressive"),
                }
            ],
        ),
        "roadmap": lambda: s(
            "roadmap",
            "Roadmap",
            eyebrow="What's next",
            elements=[
                {
                    "type": "timeline",
                    "items": [
                        {"label": "Q4 2026", "title": "Foundation", "description": "Core platform GA", "status": "done"},
                        {"label": "Q1 2027", "title": "Scale", "description": "EU data region", "status": "current"},
                        {"label": "Q2 2027", "title": "Intelligence", "description": "Private AI models", "status": "upcoming"},
                        {"label": "Q3 2027", "title": "Ecosystem", "description": "Partner marketplace", "status": "upcoming"},
                    ],
                    "animation": _anim("reveal"),
                }
            ],
        ),
        "ask": lambda: s(
            "metrics",
            "The ask",
            eyebrow="Investment",
            elements=[
                {"type": "metric", "value": f"${r.choice([20, 25, 30, 40])}M", "label": "Series B raise", "animation": _anim("scale")},
                {"type": "metric", "value": "24 mo", "label": "Runway to profitability", "animation": _anim("scale", 120)},
                {"type": "metric", "value": f"{growth + 40}%", "label": "Target growth FY27", "trend": "up", "animation": _anim("scale", 240)},
                {"type": "text", "role": "caption", "text": "Use of funds: 50% R&D · 35% go-to-market · 15% operations"},
            ],
        ),
        "highlights": lambda: s(
            "metrics",
            "A record quarter",
            eyebrow="Highlights",
            elements=[
                {"type": "metric", "value": f"${arr}M", "label": "Annual recurring revenue", "delta": f"+{growth}%", "trend": "up", "animation": _anim("scale")},
                {"type": "metric", "value": f"{nrr}%", "label": "Net revenue retention", "animation": _anim("scale", 120)},
                {"type": "metric", "value": f"{margin}%", "label": "Gross margin", "animation": _anim("scale", 240)},
            ],
        ),
        "kpis": lambda: s(
            "table",
            "Key performance indicators",
            eyebrow="Scorecard",
            elements=[
                {
                    "type": "table",
                    "columns": ["Metric", "Target", "Actual", "Status"],
                    "rows": [
                        ["Revenue", f"${round(arr * 0.95, 1)}M", f"${arr}M", "Ahead"],
                        ["Net retention", "120%", f"{nrr}%", "Ahead"],
                        ["Time to value", "30 days", "24 days", "On track"],
                        ["Customer NPS", "50", "57", "Ahead"],
                    ],
                }
            ],
        ),
        "priorities": lambda: s(
            "grid",
            "Strategic priorities",
            eyebrow="Focus",
            elements=[
                {"type": "icon", "name": "building-2", "label": "Enterprise", "description": "Win the Fortune 1000"},
                {"type": "icon", "name": "boxes", "label": "Platform", "description": "Open the ecosystem"},
                {"type": "icon", "name": "handshake", "label": "Partners", "description": "Scale through SIs"},
                {"type": "icon", "name": "users", "label": "Talent", "description": "Hire top 5% builders"},
            ],
        ),
        "risks": lambda: s(
            "comparison",
            "Risks and mitigations",
            eyebrow="Risk",
            elements=[
                {
                    "type": "columns",
                    "columns": [
                        {"title": "Risks", "tone": "negative", "items": ["Longer enterprise sales cycles", "Regulatory change in EU", "Competition for AI talent"]},
                        {"title": "Mitigations", "tone": "positive", "items": ["Land-and-expand pilots", "EU data region in Q1", "Equity refresh + remote hubs"]},
                    ],
                }
            ],
        ),
        "asks": lambda: s(
            "split",
            "Decisions we need today",
            eyebrow="Asks",
            elements=[
                {"type": "bullets", "ordered": True, "items": ["Approve the FY27 operating plan", "Endorse EU expansion", "Confirm hiring budget for 2 solution engineers"], "animation": _anim("stagger")},
                {"type": "quote", "text": f"Focus wins. {topic} is where we should concentrate.", "attribution": "Leadership team"},
            ],
        ),
        "how_it_works": lambda: s(
            "process",
            "How it works",
            eyebrow="Approach",
            elements=[
                {
                    "type": "diagram",
                    "kind": "process",
                    "nodes": [
                        {"id": "1", "label": "Connect", "description": "Plug in data sources"},
                        {"id": "2", "label": "Configure", "description": "Apply your rules"},
                        {"id": "3", "label": "Automate", "description": "AI does the heavy lifting"},
                        {"id": "4", "label": "Measure", "description": "Track ROI continuously"},
                    ],
                    "edges": [{"from": "1", "to": "2"}, {"from": "2", "to": "3"}, {"from": "3", "to": "4"}],
                    "animation": _anim("stagger"),
                }
            ],
        ),
        "benefits": lambda: s(
            "metrics",
            "Measurable impact in the first 90 days",
            eyebrow="Outcomes",
            elements=[
                {"type": "metric", "value": "-42%", "label": "Cost to serve", "trend": "down", "animation": _anim("scale")},
                {"type": "metric", "value": "3.1×", "label": "Faster delivery", "trend": "up", "animation": _anim("scale", 120)},
                {"type": "metric", "value": "99.9%", "label": "Policy compliance", "animation": _anim("scale", 240)},
            ],
        ),
        "proof": lambda: s(
            "quote",
            facts[0] if facts else f"“The first {topic.lower()} solution our leadership actually trusts.”",
            elements=[
                {
                    "type": "quote",
                    "text": facts[0] if facts else f"The first {topic.lower()} solution our leadership actually trusts.",
                    "attribution": "Chief Operating Officer, Global Bank",
                    "animation": _anim("fade"),
                }
            ],
            background="brand",
        ),
        "pricing": lambda: s(
            "table",
            "Simple, transparent pricing",
            eyebrow="Commercials",
            elements=[
                {
                    "type": "table",
                    "columns": ["Package", "Includes", "Annual"],
                    "rows": [
                        ["Foundation", "Core platform, 50 seats, standard support", "$120K"],
                        ["Enterprise", "Unlimited seats, SSO, premium support", "$340K"],
                        ["Strategic", "Private AI, dedicated success team", "Custom"],
                    ],
                }
            ],
        ),
        "implementation": lambda: s(
            "timeline",
            "Live in 90 days",
            eyebrow="Implementation",
            elements=[
                {
                    "type": "timeline",
                    "items": [
                        {"label": "Weeks 1–2", "title": "Discover", "description": "Goals, data, success metrics"},
                        {"label": "Weeks 3–6", "title": "Configure", "description": "Integrations and governance"},
                        {"label": "Weeks 7–10", "title": "Pilot", "description": "Two teams in production"},
                        {"label": "Weeks 11–13", "title": "Scale", "description": "Roll-out and enablement"},
                    ],
                    "animation": _anim("reveal"),
                }
            ],
        ),
        "context": lambda: s(
            "split",
            f"Why {topic.lower()} matters now",
            eyebrow="Context",
            elements=[
                {
                    "type": "bullets",
                    "items": [
                        "Customer expectations have reset around speed and personalization",
                        "AI is compressing cost curves across the industry",
                        f"{name} is positioned to lead with {services[0].lower() if services else 'our platform'}",
                    ],
                    "animation": _anim("stagger"),
                },
                {"type": "image", "query": topic, "alt": topic},
            ],
        ),
        "insights": lambda: s(
            "grid",
            "Key insights",
            eyebrow="What we learned",
            elements=[
                {"type": "icon", "name": "target", "label": "Focus", "description": "Top 20% of accounts drive 70% of value"},
                {"type": "icon", "name": "zap", "label": "Speed", "description": "Time to value is the #1 buying criterion"},
                {"type": "icon", "name": "shield-check", "label": "Trust", "description": "Security reviews gate every enterprise deal"},
                {"type": "icon", "name": "trending-up", "label": "Expansion", "description": "Happy customers expand 2.4× in year two"},
            ],
        ),
        "before_after": lambda: s(
            "before_after",
            "From fragmented to focused",
            eyebrow="Transformation",
            elements=[
                {
                    "type": "columns",
                    "columns": [
                        {"title": "Before", "tone": "negative", "items": ["Manual, siloed processes", "Weeks to produce insight", "Inconsistent brand and quality"]},
                        {"title": "After", "tone": "positive", "items": ["One governed platform", "Answers in minutes", "Every output on-brand"]},
                    ],
                    "animation": _anim("slide"),
                }
            ],
        ),
        "process": lambda: s(
            "process",
            "Our operating model",
            eyebrow="Execution",
            elements=[
                {
                    "type": "diagram",
                    "kind": "process",
                    "nodes": [
                        {"id": "p1", "label": "Diagnose", "description": "Baseline & opportunity"},
                        {"id": "p2", "label": "Design", "description": "Target state & roadmap"},
                        {"id": "p3", "label": "Deliver", "description": "Agile release trains"},
                        {"id": "p4", "label": "Sustain", "description": "Run, measure, improve"},
                    ],
                    "edges": [{"from": "p1", "to": "p2"}, {"from": "p2", "to": "p3"}, {"from": "p3", "to": "p4"}],
                    "animation": _anim("stagger"),
                }
            ],
        ),
        "closing": lambda: s(
            "closing",
            "Thank you",
            subtitle=f"{name} · Questions & discussion",
            elements=[{"type": "text", "role": "lead", "text": f"Let's make {topic.lower()} our competitive advantage."}],
            background="inverse",
            notes="Pause for questions. Restate the single decision you need.",
        ),
    }


DECK_LABELS = {
    "investor": "Investor presentation",
    "board": "Board review",
    "sales": "Sales presentation",
    "company_overview": "Company overview",
    "strategy": "Strategy",
    "product_launch": "Product launch",
    "annual_report": "Annual report",
    "training": "Training",
    "market_analysis": "Market analysis",
    "custom": "Presentation",
}


def gen_presentation(ctx: dict[str, Any]) -> dict[str, Any]:
    prompt = ctx.get("prompt", "")
    deck_type = ctx.get("deck_type") or "custom"
    n = int(ctx.get("slide_count") or 10)
    co = _company(ctx)
    topic = ctx.get("title") or extract_topic(prompt, f"{co['name']} {DECK_LABELS.get(deck_type, 'Presentation')}")
    r = _rng(prompt, deck_type, n)
    ctx = {**ctx, "deck_label": DECK_LABELS.get(deck_type, "Presentation")}
    builders = _slide_builders(topic, co, r, ctx)
    slides = []
    for kind in _plan(deck_type, n):
        key = kind.split("#")[0]
        slide = builders.get(key, builders["insights"])()
        transition = "fade" if key in ("hero", "closing") else r.choice(["fade", "slide", "dissolve"])
        slide["transition"] = {"type": transition, "duration_ms": 500}
        slides.append(slide)
    if ctx.get("tone") in ("minimal",):
        for s in slides:
            for e in s.get("elements", []):
                if e.get("type") == "bullets":
                    e["items"] = e["items"][:3]
    return {"title": topic, "subtitle": f"{co['name']} · {DECK_LABELS.get(deck_type, 'Presentation')}", "slides": slides}


LAYOUT_CYCLE = ["split", "grid", "metrics", "comparison", "timeline", "process", "chart", "quote", "hero"]


def _bullets_of(slide: dict[str, Any]) -> list[str]:
    out: list[str] = []
    for e in slide.get("elements", []):
        t = e.get("type")
        if t == "bullets":
            out += e["items"]
        elif t == "icon":
            out.append(f"{e.get('label', '')}: {e.get('description', '')}".strip(": "))
        elif t == "columns":
            for c in e["columns"]:
                out += c.get("items", [])
        elif t == "text":
            out.append(e["text"])
    return [o for o in out if o]


def gen_slide_edit(ctx: dict[str, Any]) -> dict[str, Any]:
    slide = dict(ctx.get("slide") or {})
    cmd = (ctx.get("command") or "").lower()
    elements = [dict(e) for e in slide.get("elements", [])]
    bullets = _bullets_of(slide)
    explanation = "Refined the slide."

    if "visual" in cmd:
        icons = ["target", "zap", "shield-check", "trending-up", "layers", "users"]
        items = bullets[:4] or ["Clarity", "Speed", "Trust", "Growth"]
        elements = [
            {"type": "icon", "name": icons[i % len(icons)], "label": _shorten(b.split(":")[0], 0.5), "description": _shorten(b, 0.6), "animation": _anim("stagger", i * 80)}
            for i, b in enumerate(items)
        ]
        slide["layout"] = "grid"
        explanation = "Converted text into a visual icon grid."
    elif "reduce" in cmd or "40%" in cmd or "shorter" in cmd:
        for e in elements:
            if e.get("type") == "bullets":
                e["items"] = [_shorten(i, 0.6) for i in e["items"][: max(1, math.ceil(len(e["items"]) * 0.6))]]
            elif e.get("type") == "text":
                e["text"] = _shorten(e["text"], 0.6)
            elif e.get("type") == "icon":
                e["description"] = _shorten(e.get("description", ""), 0.6)
        slide["subtitle"] = _shorten(slide.get("subtitle", ""), 0.6) if slide.get("subtitle") else ""
        explanation = "Reduced text by roughly 40% while keeping the key message."
    elif "premium" in cmd:
        slide["background"] = "inverse"
        slide["eyebrow"] = slide.get("eyebrow") or "Perspective"
        for e in elements:
            e["animation"] = _anim("fade", 150)
        slide["transition"] = {"type": "dissolve", "duration_ms": 700}
        explanation = "Applied a premium dark treatment, slower dissolve transition and refined motion."
    elif "simplif" in cmd:
        keep = []
        for e in elements:
            if e.get("type") == "bullets":
                e["items"] = e["items"][:3]
            keep.append(e)
        elements = keep[:2]
        explanation = "Simplified to the two most important elements and three points."
    elif "chart" in cmd:
        r = _rng(slide.get("title"))
        vals = [round(10 + i * r.uniform(2, 6), 1) for i in range(6)]
        elements = [e for e in elements if e.get("type") not in ("image",)][:1] + [
            {"type": "chart", "chart_type": "bar", "labels": ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2"], "series": [{"name": "Value", "values": vals}], "highlight_index": 5, "animation": _anim("progressive")}
        ]
        slide["layout"] = "chart"
        explanation = "Added a bar chart with progressive reveal."
    elif "image" in cmd:
        elements = [e for e in elements if e.get("type") != "image"][:2] + [
            {"type": "image", "query": slide.get("title", ""), "alt": slide.get("title", ""), "animation": _anim("fade", 200)}
        ]
        slide["layout"] = "split"
        explanation = "Added a supporting image on a split layout."
    elif "story" in cmd:
        slide["eyebrow"] = "Why this matters"
        slide["subtitle"] = f"Here is what changes for our customers — and why now. {slide.get('subtitle', '')}".strip()
        slide["notes"] = (slide.get("notes", "") + "\nStory arc: tension → insight → resolution. Pause after the headline.").strip()
        explanation = "Reframed the slide as a tension → insight → resolution story beat."
    elif "layout" in cmd:
        cur = slide.get("layout", "split")
        nxt = LAYOUT_CYCLE[(LAYOUT_CYCLE.index(cur) + 1) % len(LAYOUT_CYCLE)] if cur in LAYOUT_CYCLE else "split"
        slide["layout"] = nxt
        explanation = f"Switched the layout from {cur} to {nxt}."
    elif "headline" in cmd or "stronger" in cmd:
        nums = re.findall(r"\$?\d[\d.,]*\s?(?:%|×|x|M|B|K)?", " ".join(bullets) + " " + slide.get("subtitle", ""))
        base = slide.get("title", "")
        slide["title"] = f"{base} — up {nums[0].strip()}" if nums else f"{base}: the decision that defines our next year"
        explanation = "Rewrote the headline to lead with the outcome."
    elif "rewrite" in cmd or "persuasive" in cmd:
        for e in elements:
            if e.get("type") == "bullets":
                e["items"] = [re.sub(r"^(We |Our )", "", i).capitalize() for i in e["items"]]
        slide["title"] = slide.get("title", "").replace("Our ", "").strip()
        explanation = "Rewrote the copy to be more direct and outcome-led."
    else:
        explanation = f"Applied: {ctx.get('command')}"
    slide["elements"] = elements
    slide.setdefault("title", "Untitled")
    return {"slide": slide, "explanation": explanation}


# ---------------------------------------------------------------------------- proposals

SECTION_TITLES = {
    "cover": "Cover",
    "executive_summary": "Executive Summary",
    "about_us": "About Us",
    "client_understanding": "Our Understanding",
    "challenges": "Challenges",
    "solution": "Proposed Solution",
    "architecture": "Solution Architecture",
    "scope": "Scope of Work",
    "implementation": "Implementation Approach",
    "timeline": "Timeline",
    "team": "Team",
    "case_studies": "Case Studies",
    "commercial": "Commercial Proposal",
    "outcomes": "Expected Outcomes",
    "next_steps": "Next Steps",
}


def _proposal_section(kind: str, ctx: dict[str, Any]) -> dict[str, Any]:
    co = _company(ctx)
    client = ctx.get("client") or "the client"
    industry = (ctx.get("industry") or "enterprise").lower()
    topic = ctx.get("topic") or extract_topic(ctx.get("prompt", ""), "Digital Transformation")
    value = float(ctx.get("value") or 1_200_000)
    facts = _knowledge_facts(ctx, 3)
    blocks: list[dict[str, Any]]
    if kind == "cover":
        blocks = [{"type": "paragraph", "text": f"Prepared for {client} by {co['name']}. {topic} — a partnership proposal."}]
    elif kind == "executive_summary":
        blocks = [
            {"type": "paragraph", "text": f"{client} has an opportunity to lead its {industry} peers through {topic.lower()}. {co['name']} proposes a phased program that delivers measurable value within the first 90 days while building the foundation for long-term transformation."},
            {"type": "metrics", "items": [{"value": "90 days", "label": "To first value"}, {"value": "35%", "label": "Target cost reduction"}, {"value": "3.2×", "label": "Expected ROI"}]},
            {"type": "callout", "title": "Why us", "text": f"{co['name']} combines {', '.join(s.lower() for s in co['services'][:3])} with a proven delivery model across {industry} clients."},
        ]
    elif kind == "about_us":
        desc = co["description"] or f"{co['name']} is a leading {co['industry'].lower()} company helping enterprises modernize with confidence."
        blocks = [{"type": "paragraph", "text": desc}, {"type": "bullets", "items": co["differentiators"][:4] or ["Enterprise-grade delivery"]}]
    elif kind == "client_understanding":
        blocks = [
            {"type": "paragraph", "text": f"We understand that {client} is balancing growth ambitions with rising customer expectations, regulatory scrutiny and legacy technology constraints."},
            {"type": "bullets", "items": [f"Deliver modern digital experiences to {client}'s customers", "Reduce operational cost and manual effort", "Strengthen security, risk and compliance posture", "Build internal capability for continuous change"]},
        ]
    elif kind == "challenges":
        blocks = [{"type": "table", "columns": ["Challenge", "Business impact"], "rows": [["Legacy core systems", "Slow time-to-market for new products"], ["Fragmented data", "Limited customer insight and personalization"], ["Manual processes", "High cost-to-serve and operational risk"], ["Skills gap", "Dependence on external vendors"]]}]
    elif kind == "solution":
        blocks = [
            {"type": "paragraph", "text": f"Our solution for {client} is a three-horizon program: stabilize the foundation, modernize the customer journeys, and scale with AI-driven operations."},
            {"type": "bullets", "items": [f"{s} tailored to {client}" for s in co["services"][:4]]},
        ]
    elif kind == "architecture":
        blocks = [{"type": "diagram", "diagram": {"type": "diagram", "kind": "architecture", "nodes": [{"id": "ch", "label": "Digital channels", "description": "Web · Mobile · Branch"}, {"id": "api", "label": "API layer", "description": "Secure integration hub"}, {"id": "core", "label": "Core platforms", "description": f"{client} systems of record"}, {"id": "data", "label": "Data & AI", "description": "Governed analytics"}], "edges": [{"from": "ch", "to": "api"}, {"from": "api", "to": "core"}, {"from": "api", "to": "data"}]}}]
    elif kind == "scope":
        blocks = [{"type": "table", "columns": ["Workstream", "In scope", "Deliverables"], "rows": [["Strategy", "Target state & roadmap", "Blueprint, business case"], ["Platform", "Integration & cloud", "Production-ready platform"], ["Experience", "Priority customer journeys", "Redesigned journeys"], ["Change", "Training & adoption", "Enablement program"]]}]
    elif kind == "implementation":
        blocks = [{"type": "bullets", "items": ["Agile delivery in 2-week sprints with joint teams", "Executive steering committee every month", "Quality gates and security reviews at each release", "Knowledge transfer built into every phase"]}]
    elif kind == "timeline":
        blocks = [{"type": "timeline", "items": [{"label": "Months 0–3", "title": "Mobilize & discover", "status": "current"}, {"label": "Months 4–12", "title": "Build foundation"}, {"label": "Months 13–24", "title": "Modernize journeys"}, {"label": "Months 25–36", "title": "Scale & optimize"}]}]
    elif kind == "team":
        blocks = [{"type": "team", "members": [{"name": "Sara Malik", "role": "Engagement Director"}, {"name": "Omar Shah", "role": "Chief Architect"}, {"name": "Lena Ortiz", "role": "Delivery Lead"}, {"name": "Priya Nair", "role": "Change & Adoption Lead"}]}]
    elif kind == "case_studies":
        if facts:
            blocks = [{"type": "case_study", "client": "Reference client", "challenge": "Similar transformation mandate", "solution": f"{co['name']} delivery program", "results": facts}]
        else:
            blocks = [{"type": "case_study", "client": f"Leading {industry} institution", "challenge": "Fragmented legacy platforms slowing growth", "solution": "Phased modernization with a joint delivery team", "results": ["41% faster product launches", "$12M annual cost savings", "NPS up 18 points"]}]
    elif kind == "commercial":
        blocks = [
            {"type": "pricing", "currency": ctx.get("currency") or "USD", "lines": [{"item": "Phase 1 — Mobilize & discover", "amount": round(value * 0.15, -3)}, {"item": "Phase 2 — Build foundation", "amount": round(value * 0.4, -3)}, {"item": "Phase 3 — Modernize journeys", "amount": round(value * 0.3, -3)}, {"item": "Phase 4 — Scale & optimize", "amount": round(value * 0.15, -3)}], "notes": "Fixed-fee per phase. Payment milestones aligned to deliverable acceptance."},
        ]
    elif kind == "outcomes":
        blocks = [{"type": "metrics", "items": [{"value": "-35%", "label": "Cost to serve"}, {"value": "2×", "label": "Release velocity"}, {"value": "+20", "label": "NPS points"}]}]
    elif kind == "next_steps":
        blocks = [{"type": "bullets", "items": [f"Executive alignment workshop with {client}", "Confirm scope and commercial terms", "Mobilize joint team within 2 weeks of signature"]}]
    else:
        blocks = [{"type": "paragraph", "text": ctx.get("instruction") or f"Additional detail for {client}."}]
    return {"kind": kind, "title": ctx.get("section_title") or SECTION_TITLES.get(kind, "Section"), "blocks": blocks}


def gen_proposal(ctx: dict[str, Any]) -> dict[str, Any]:
    kinds = ctx.get("sections") or list(SECTION_TITLES)
    client = ctx.get("client") or "Client"
    topic = ctx.get("topic") or ctx.get("opportunity") or ctx.get("title") or extract_topic(ctx.get("prompt", ""), "Digital Transformation")
    if client and client.lower() in str(topic).lower():
        topic = "Digital Transformation"
    return {
        "title": ctx.get("title") or f"{topic} Proposal",
        "subtitle": f"Prepared for {client} by {_company(ctx)['name']}",
        "sections": [_proposal_section(k, {**ctx, "topic": topic}) for k in kinds],
    }


def gen_section_edit(ctx: dict[str, Any]) -> dict[str, Any]:
    section = dict(ctx.get("section") or {})
    cmd = (ctx.get("command") or "").lower()
    blocks = [dict(b) for b in section.get("blocks", [])]
    client = ctx.get("client") or "the client"
    explanation = "Updated section."
    if "regenerate" in cmd:
        fresh = _proposal_section(section.get("kind", "custom"), ctx)
        return {"section": {**section, "blocks": fresh["blocks"]}, "explanation": "Regenerated this section."}
    if "reduce" in cmd:
        for b in blocks:
            if b.get("type") == "paragraph":
                b["text"] = _shorten(b["text"], 0.6)
            if b.get("type") == "bullets":
                b["items"] = b["items"][: max(2, math.ceil(len(b["items"]) * 0.6))]
        explanation = "Reduced text by ~40%."
    elif "persuasive" in cmd or "value" in cmd:
        blocks.insert(0, {"type": "callout", "title": "The value for " + client, "text": f"This program pays for itself within 14 months and positions {client} as the category leader."})
        explanation = "Strengthened the value proposition with a quantified callout."
    elif "executive" in cmd or "summary" in cmd:
        blocks = [b for b in blocks if b.get("type") != "table"][:2]
        blocks.insert(0, {"type": "paragraph", "text": f"In short: {client} gets faster growth, lower cost and lower risk — with a partner accountable for outcomes."})
        explanation = "Made the section more executive: bottom line first, detail second."
    elif "visual" in cmd:
        blocks.append({"type": "metrics", "items": [{"value": "90 days", "label": "To first value"}, {"value": "3.2×", "label": "ROI"}, {"value": "-35%", "label": "Cost"}]})
        explanation = "Added visual storytelling with headline metrics."
    elif "roadmap" in cmd:
        blocks.append({"type": "timeline", "items": [{"label": "Phase 1", "title": "Mobilize"}, {"label": "Phase 2", "title": "Build"}, {"label": "Phase 3", "title": "Scale"}]})
        explanation = "Added a roadmap."
    elif "case" in cmd:
        blocks.append({"type": "case_study", "client": "Global bank", "challenge": "Legacy onboarding took 41 days", "solution": "Digital onboarding platform", "results": ["Onboarding cut to 6 days", "$4.2M annual savings"]})
        explanation = "Added a relevant case study."
    elif "pricing" in cmd:
        value = float(ctx.get("value") or 1_000_000)
        blocks.append({"type": "pricing", "currency": "USD", "lines": [{"item": "Discovery", "amount": round(value * 0.2, -3)}, {"item": "Delivery", "amount": round(value * 0.6, -3)}, {"item": "Adoption", "amount": round(value * 0.2, -3)}]})
        explanation = "Created a pricing table."
    elif "client" in cmd or "rewrite" in cmd:
        for b in blocks:
            if b.get("type") == "paragraph":
                b["text"] = re.sub(r"\bthe client\b", client, b["text"], flags=re.IGNORECASE)
                if client not in b["text"]:
                    b["text"] = f"For {client}: " + b["text"]
        explanation = f"Rewrote the section specifically for {client}."
    section["blocks"] = blocks or [{"type": "paragraph", "text": "—"}]
    section.setdefault("title", "Section")
    return {"section": section, "explanation": explanation}


# ---------------------------------------------------------------------------- meetings

DECISION_RX = re.compile(r"\b(decid\w*|decision|agreed|agree on|let's go with|let's make|we will go|approve\w*|commit to|signed off)\b|^then we\b", re.I)
ACTION_RX = re.compile(r"\b(i'll|i will|can you|could you|please|will own|take the action|follow up|need to send|can \w+ confirm|can \w+ send|can \w+ share)\b", re.I)
PERSONAL_RX = re.compile(r"\b(i'll|i will|can you|could you|please|can \w+ (?:confirm|send|share|own))\b", re.I)
TOPIC_STOP = STOP | set("""days weeks months years averages average roughly alone target should under need needs meantime
    focus point thing things quarter yeah okay right lets also still before after ready review progress full""".split())
RISK_RX = re.compile(r"\b(risk|concern|worried|won't be ready|delay|blocker|blocked|issue|threat|slip)\w*", re.I)
NUM_RX = re.compile(r"(\$\s?\d[\d,.]*\s?(?:k|m|b|million|billion)?|\d[\d,.]*\s?(?:%|percent|k\b|m\b|million|billion|days|weeks|months|customers|people|engineers)|\b\d{2,}[\d,.]*\b)", re.I)
DEADLINE_RX = re.compile(r"\b(by (?:next )?(?:mon|tues|wednes|thurs|fri|satur|sun)day|next (?:mon|tues|wednes|thurs|fri)day|by end of [\w ]+?(?=[.,;]|$)|end of q[1-4]|next week|in two weeks|by (?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w* \d{1,2}|tomorrow)\b", re.I)


def _segments(ctx: dict[str, Any]) -> list[dict[str, Any]]:
    segs = ctx.get("segments") or []
    if not segs and ctx.get("transcript"):
        for line in str(ctx["transcript"]).splitlines():
            if ":" in line:
                who, text = line.split(":", 1)
                segs.append({"speaker": who.strip(), "text": text.strip()})
    return segs


def _owner_from(text: str, speaker: str, names: list[str]) -> str | None:
    for n in names:
        first = n.split()[0]
        if re.search(rf"\b{re.escape(first)}\b", text, re.I) and not text.lower().startswith(first.lower()):
            return n
    if re.search(r"\b(i'll|i will|i can|i'll own)\b", text, re.I):
        return speaker
    return None


def analyze_meeting(ctx: dict[str, Any]) -> dict[str, Any]:
    segs = _segments(ctx)
    names = [p.get("name") if isinstance(p, dict) else str(p) for p in (ctx.get("participants") or [])]
    names = [n for n in names if n] or sorted({s.get("speaker", "") for s in segs if s.get("speaker")})
    decisions, actions, risks, questions, numbers, highlights = [], [], [], [], [], []
    words = Counter()
    for seg in segs:
        speaker = seg.get("speaker") or "Speaker"
        for sent in _sentences(seg.get("text", "")):
            low = sent.lower()
            for w in re.findall(r"[a-zA-Z][a-zA-Z\-]{3,}", low):
                if w not in STOP:
                    words[w] += 1
            is_q = sent.endswith("?") or sent.endswith("؟")
            if is_q:
                questions.append({"text": sent, "asked_by": speaker, "answered": False})
            is_decision = bool(DECISION_RX.search(sent)) and not is_q
            if is_decision:
                # "We agreed on that." carries no content on its own — use the whole turn.
                text = sent if len(sent.split()) >= 6 else seg.get("text", sent)
                decisions.append({"text": re.sub(r"^(so|okay|ok|right),?\s*", "", text, flags=re.I).strip(), "owner": speaker})
                highlights.append({"speaker": speaker, "quote": sent, "timestamp_ms": seg.get("start_ms")})
            if ACTION_RX.search(sent) and (not is_decision or PERSONAL_RX.search(sent)):
                dl = DEADLINE_RX.search(sent)
                owner = _owner_from(sent, speaker, names)
                team = re.search(r"\bcan (\w+) (?:confirm|send|share|own)", sent, re.I)
                if owner is None and team and team.group(1).lower() not in ("you", "we", "i", "they", "someone"):
                    owner = team.group(1).capitalize()
                actions.append({"title": _action_title(sent), "owner": owner, "deadline": dl.group(0).replace("by ", "").strip() if dl else None, "priority": "high" if dl else "medium"})
            if RISK_RX.search(sent):
                risks.append({"text": sent, "severity": "high" if re.search(r"won't|blocker|critical", low) else "medium"})
            for m in NUM_RX.finditer(sent):
                val = m.group(0).strip()
                bare = re.fullmatch(r"\d+", val)
                prev = sent[max(0, m.start() - 12) : m.start()].lower()
                if len(val) < 2 or (bare and (int(val) < 100 or any(mo in prev for mo in ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec")))):
                    continue
                if any(val.split()[0] in n["value"] for n in numbers):
                    continue
                label = _number_label(sent, m.start(), m.end())
                numbers.append({"value": val, "label": label, "context": sent})
                if len(highlights) < 8:
                    highlights.append({"speaker": speaker, "quote": sent, "timestamp_ms": seg.get("start_ms")})
    agenda = [a.strip("-• ").strip() for a in (ctx.get("agenda") or "").splitlines() if a.strip()]
    topic_titles = agenda[:5] if agenda else _topic_phrases(segs, words)
    topics = [{"title": t, "summary": _topic_summary(t, segs)} for t in topic_titles]
    dedupe = lambda items, key: list({i[key].lower(): i for i in items}.values())  # noqa: E731
    decisions, actions, risks, questions = dedupe(decisions, "text"), dedupe(actions, "title"), dedupe(risks, "text"), dedupe(questions, "text")
    decisions = [d for d in decisions if not any(d is not o and d["text"] in o["text"] for o in decisions)]
    numbers = dedupe(numbers, "value")[:10]
    title = ctx.get("title") or "the meeting"
    summary = _compose_summary(title, topics, decisions, actions, risks, names)
    next_steps = [
        f"{a['owner'] or 'Team'}: {a['title']}" + (f" ({a['deadline']})" if a.get("deadline") and a["deadline"].lower() not in a["title"].lower() else "")
        for a in actions[:5]
    ]
    if not next_steps and decisions:
        next_steps = [f"Execute on: {decisions[0]['text']}"]
    return {
        "summary": summary,
        "topics": topics,
        "decisions": decisions[:10],
        "action_items": actions[:12],
        "risks": risks[:8],
        "questions": questions[:8],
        "numbers": numbers,
        "next_steps": next_steps,
        "highlights": highlights[:8],
    }


def _topic_phrases(segs: list[dict[str, Any]], words: Counter) -> list[str]:
    """Pick up to 5 non-overlapping two-word noun-ish phrases, scored by word frequency."""
    scores: Counter = Counter()
    for seg in segs:
        toks = re.findall(r"[A-Za-z][A-Za-z\-]+", seg.get("text", ""))
        for a, b in zip(toks, toks[1:], strict=False):
            la, lb = a.lower(), b.lower()
            if la in TOPIC_STOP or lb in TOPIC_STOP or len(la) < 3 or len(lb) < 3:
                continue
            scores[f"{la} {lb}"] += 1 + words[la] + words[lb]
    out: list[str] = []
    used: set[str] = set()
    for phrase, _ in scores.most_common(30):
        parts = set(phrase.split())
        if parts & used:
            continue
        used |= parts
        out.append(phrase[:1].upper() + phrase[1:])
        if len(out) == 5:
            break
    if not out:
        out = [_title_case(w) for w, _ in words.most_common(5) if w not in TOPIC_STOP]
    return out


def _action_title(sent: str) -> str:
    t = re.sub(r"^(okay|ok|so|and|also|then|great|right)[,\s]+", "", sent.strip(), flags=re.I)
    t = re.sub(r"^(i'll|i will|i can|we'll|we will|can you|could you|please|can \w+(?= (?:confirm|send|share|own)))\s+", "", t, flags=re.I)
    t = t.rstrip(".?!")
    return (t[:1].upper() + t[1:])[:200] if t else sent[:200]


def _number_label(sent: str, start: int, end: int) -> str:
    after = re.findall(r"[A-Za-z]+", sent[end : end + 40])
    before = re.findall(r"[A-Za-z]+", sent[max(0, start - 40) : start])
    words = [w for w in (before[-4:] + after[:2]) if w.lower() not in TOPIC_STOP]
    if not words:
        words = [w for w in re.findall(r"[A-Za-z]+", sent) if w.lower() not in STOP][:4]
    return " ".join(words[:4]).capitalize() or "Figure"


def _topic_summary(topic: str, segs: list[dict[str, Any]]) -> str:
    key = topic.split()[0].lower()
    for s in segs:
        if key in s.get("text", "").lower():
            return s["text"][:220]
    return ""


def _compose_summary(title: str, topics: list[dict[str, Any]], decisions: list[Any], actions: list[Any], risks: list[Any], names: list[str]) -> str:
    parts = []
    tnames = ", ".join(t["title"].lower() for t in topics[:3])
    who = ", ".join(names[:4]) if names else "the team"
    parts.append(f"{who} met for {title} and focused on {tnames or 'priorities for the coming period'}.")
    if decisions:
        parts.append(f"The group made {len(decisions)} decision{'s' if len(decisions) != 1 else ''}, most notably: {decisions[0]['text'].rstrip('.')}.")
    if actions:
        parts.append(f"{len(actions)} action item{'s' if len(actions) != 1 else ''} were assigned with owners.")
    if risks:
        parts.append(f"Key risk raised: {risks[0]['text'].rstrip('.')}.")
    return " ".join(parts)


def gen_live_insights(ctx: dict[str, Any]) -> dict[str, Any]:
    full = analyze_meeting(ctx)
    return {
        "topics": full["topics"][:4],
        "decisions": full["decisions"],
        "action_items": full["action_items"],
        "questions": full["questions"],
        "risks": full["risks"],
        "numbers": full["numbers"],
        "moments": full["highlights"][:5],
    }


def gen_meeting_deck(ctx: dict[str, Any]) -> dict[str, Any]:
    intel = ctx.get("intelligence") or {}
    title = ctx.get("title") or "Meeting"
    co = _company(ctx)
    date_label = ctx.get("date_label") or ""
    decisions = [d["text"] for d in intel.get("decisions", [])][:5] or ["No formal decisions recorded"]
    actions = intel.get("action_items", [])[:8]
    numbers = intel.get("numbers", [])[:4]
    risks = [r["text"] for r in intel.get("risks", [])][:4]
    topics = intel.get("topics", [])[:4]
    qs = [q["text"] for q in intel.get("questions", [])][:3]
    slides: list[dict[str, Any]] = [
        {"layout": "hero", "title": title, "eyebrow": f"{co['name']} · Meeting readout", "subtitle": f"{date_label} · {', '.join((ctx.get('participants') or [])[:5])}".strip(" ·"), "background": "inverse", "elements": [{"type": "shape", "shape": "line", "color": "accent", "animation": _anim("reveal")}]},
        {"layout": "split", "title": "Executive summary", "eyebrow": "Overview", "elements": [{"type": "text", "role": "lead", "text": intel.get("summary") or "Summary unavailable.", "animation": _anim("fade")}]},
    ]
    if topics:
        slides.append({"layout": "grid", "title": "Key discussion", "eyebrow": "Topics", "elements": [{"type": "icon", "name": ["message-square", "target", "layers", "compass"][i % 4], "label": t["title"], "description": _shorten(t.get("summary", ""), 0.4) if t.get("summary") else "", "animation": _anim("stagger", i * 80)} for i, t in enumerate(topics)]})
    slides.append({"layout": "split", "title": "Decisions", "eyebrow": "What we agreed", "elements": [{"type": "bullets", "ordered": True, "items": decisions, "animation": _anim("stagger")}]})
    if len(decisions) > 1:
        slides.append({"layout": "grid", "title": "Strategic priorities", "eyebrow": "Focus", "elements": [{"type": "icon", "name": ["flag", "rocket", "shield-check", "users"][i % 4], "label": _shorten(d, 0.35), "description": d, "animation": _anim("stagger", i * 80)} for i, d in enumerate(decisions[:4])]})
    if numbers:
        slides.append({"layout": "metrics", "title": "Important data", "eyebrow": "By the numbers", "elements": [{"type": "metric", "value": n["value"][:24], "label": (n.get("label") or "Figure")[:80], "animation": _anim("scale", i * 120)} for i, n in enumerate(numbers[:4])]})
    if risks:
        slides.append({"layout": "comparison", "title": "Challenges and opportunities", "eyebrow": "Risks", "elements": [{"type": "columns", "columns": [{"title": "Challenges", "tone": "negative", "items": risks}, {"title": "Opportunities", "tone": "positive", "items": (intel.get("next_steps") or ["Act on decisions quickly"])[:4]}]}]})
    if actions:
        slides.append({"layout": "table", "title": "Action plan", "eyebrow": "Owners & deadlines", "elements": [{"type": "table", "columns": ["Action", "Owner", "Due"], "rows": [[a["title"][:90], a.get("owner") or "—", a.get("deadline") or "—"] for a in actions]}]})
    if qs:
        slides.append({"layout": "split", "title": "Open questions", "eyebrow": "To resolve", "elements": [{"type": "bullets", "items": qs}]})
    slides.append({"layout": "closing", "title": "Next steps", "background": "inverse", "elements": [{"type": "bullets", "items": (intel.get("next_steps") or ["Circulate notes", "Review progress in two weeks"])[:5]}]})
    for s in slides:
        s["transition"] = {"type": "fade", "duration_ms": 450}
    return {"title": f"{title} — Readout", "subtitle": f"{co['name']} meeting intelligence", "slides": slides}


# ---------------------------------------------------------------------------- documents

CATEGORY_KEYWORDS = {
    "case_study": ["case study", "client", "results", "challenge", "outcome"],
    "brand_guidelines": ["logo", "typography", "brand", "color palette", "tone of voice"],
    "services": ["services", "we offer", "consulting", "managed", "implementation"],
    "product": ["product", "feature", "platform", "release", "api"],
    "proposal": ["proposal", "scope of work", "commercial", "pricing"],
    "sales": ["pitch", "objection", "pricing", "competitor", "battlecard"],
    "messaging": ["messaging", "value proposition", "positioning", "tagline"],
    "company": ["founded", "headquarters", "mission", "employees", "about us"],
}


def gen_document_analysis(ctx: dict[str, Any]) -> dict[str, Any]:
    text = ctx.get("text", "")
    low = text.lower()
    scores = {cat: sum(low.count(k) for k in kws) for cat, kws in CATEGORY_KEYWORDS.items()}
    category = max(scores, key=lambda k: scores[k]) if any(scores.values()) else "other"
    sents = _sentences(text)
    summary = " ".join(sents[:3])[:1200] or "Empty document."
    key_points = [s for s in sents if re.search(r"\d", s)][:5] or sents[3:8]
    return {"summary": summary, "category": category, "key_points": [k[:300] for k in key_points]}


# ---------------------------------------------------------------------------- dispatch

TASKS = {
    "presentation.generate": gen_presentation,
    "presentation.slide_edit": gen_slide_edit,
    "proposal.generate": gen_proposal,
    "proposal.section_edit": gen_section_edit,
    "meeting.live_insights": gen_live_insights,
    "meeting.analyze": analyze_meeting,
    "meeting.deck": gen_meeting_deck,
    "document.analyze": gen_document_analysis,
}


def generate(task: str, ctx: dict[str, Any]) -> dict[str, Any]:
    base = task.removesuffix(".repair")
    fn = TASKS.get(base)
    if fn is None:
        raise ValueError(f"mock provider has no generator for task '{task}'")
    return fn(ctx)
