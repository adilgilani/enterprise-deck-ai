"""Structured-output schemas for proposal, meeting and document AI tasks."""

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.deck import DiagramElement, TimelineItem


def _id() -> str:
    return uuid.uuid4().hex[:10]


class Strict(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


# ---------------------------------------------------------------------------- proposals

SectionKind = Literal[
    "cover",
    "executive_summary",
    "about_us",
    "client_understanding",
    "challenges",
    "solution",
    "architecture",
    "scope",
    "implementation",
    "timeline",
    "team",
    "case_studies",
    "commercial",
    "outcomes",
    "next_steps",
    "custom",
]


class ParagraphBlock(Strict):
    type: Literal["paragraph"] = "paragraph"
    text: str = Field(max_length=3000)


class BulletsBlock(Strict):
    type: Literal["bullets"] = "bullets"
    items: list[str] = Field(min_length=1, max_length=12)


class MetricItem(Strict):
    value: str
    label: str


class MetricsBlock(Strict):
    type: Literal["metrics"] = "metrics"
    items: list[MetricItem] = Field(min_length=1, max_length=6)


class TableBlock(Strict):
    type: Literal["table"] = "table"
    columns: list[str] = Field(min_length=1, max_length=8)
    rows: list[list[str]] = Field(min_length=1, max_length=20)


class TimelineBlock(Strict):
    type: Literal["timeline"] = "timeline"
    items: list[TimelineItem] = Field(min_length=1, max_length=10)


class CalloutBlock(Strict):
    type: Literal["callout"] = "callout"
    title: str = ""
    text: str


class QuoteBlock(Strict):
    type: Literal["quote"] = "quote"
    text: str
    attribution: str = ""


class PricingLine(Strict):
    item: str
    description: str = ""
    amount: float = 0


class PricingBlock(Strict):
    type: Literal["pricing"] = "pricing"
    currency: str = "USD"
    lines: list[PricingLine] = Field(min_length=1, max_length=15)
    notes: str = ""


class CaseStudyBlock(Strict):
    type: Literal["case_study"] = "case_study"
    client: str
    challenge: str = ""
    solution: str = ""
    results: list[str] = Field(default_factory=list, max_length=6)


class DiagramBlock(Strict):
    type: Literal["diagram"] = "diagram"
    diagram: DiagramElement


class TeamMember(Strict):
    name: str
    role: str = ""
    bio: str = ""


class TeamBlock(Strict):
    type: Literal["team"] = "team"
    members: list[TeamMember] = Field(min_length=1, max_length=10)


Block = Annotated[
    ParagraphBlock
    | BulletsBlock
    | MetricsBlock
    | TableBlock
    | TimelineBlock
    | CalloutBlock
    | QuoteBlock
    | PricingBlock
    | CaseStudyBlock
    | DiagramBlock
    | TeamBlock,
    Field(discriminator="type"),
]


class ProposalSection(Strict):
    id: str = Field(default_factory=_id)
    kind: SectionKind = "custom"
    title: str = Field(max_length=160)
    blocks: list[Block] = Field(default_factory=list, max_length=12)


class ProposalContent(Strict):
    title: str = Field(max_length=200)
    subtitle: str = Field("", max_length=300)
    sections: list[ProposalSection] = Field(min_length=1, max_length=30)


class SectionEditResult(Strict):
    section: ProposalSection
    explanation: str = ""


# ---------------------------------------------------------------------------- meetings


class Topic(Strict):
    title: str
    summary: str = ""


class Decision(Strict):
    text: str
    owner: str | None = None
    context: str = ""


class ActionItemOut(Strict):
    title: str
    owner: str | None = None
    deadline: str | None = None  # natural language or ISO date, normalized server-side
    priority: Literal["high", "medium", "low"] = "medium"


class Risk(Strict):
    text: str
    severity: Literal["high", "medium", "low"] = "medium"
    mitigation: str = ""


class Question(Strict):
    text: str
    asked_by: str | None = None
    answered: bool = False


class NumberFact(Strict):
    value: str
    label: str
    context: str = ""


class Highlight(Strict):
    speaker: str = ""
    quote: str
    timestamp_ms: int | None = None


class MeetingIntelligence(Strict):
    summary: str = ""
    topics: list[Topic] = Field(default_factory=list)
    decisions: list[Decision] = Field(default_factory=list)
    action_items: list[ActionItemOut] = Field(default_factory=list)
    risks: list[Risk] = Field(default_factory=list)
    questions: list[Question] = Field(default_factory=list)
    numbers: list[NumberFact] = Field(default_factory=list)
    next_steps: list[str] = Field(default_factory=list)
    highlights: list[Highlight] = Field(default_factory=list)


class LiveInsights(Strict):
    """Incremental extraction run periodically during a live meeting."""

    topics: list[Topic] = Field(default_factory=list)
    decisions: list[Decision] = Field(default_factory=list)
    action_items: list[ActionItemOut] = Field(default_factory=list)
    questions: list[Question] = Field(default_factory=list)
    risks: list[Risk] = Field(default_factory=list)
    numbers: list[NumberFact] = Field(default_factory=list)
    moments: list[Highlight] = Field(default_factory=list)


# ---------------------------------------------------------------------------- documents

DocumentCategory = Literal[
    "company",
    "product",
    "services",
    "case_study",
    "sales",
    "presentation",
    "proposal",
    "messaging",
    "brand_guidelines",
    "other",
]


class DocumentAnalysis(Strict):
    summary: str = Field(max_length=1500)
    category: DocumentCategory = "other"
    key_points: list[str] = Field(default_factory=list, max_length=10)


class RomanText(Strict):
    """Roman Urdu transliteration of one transcript segment."""

    text: str = Field(max_length=6000)
