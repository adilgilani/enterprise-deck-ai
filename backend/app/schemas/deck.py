"""Presentation schema — the single contract between the LLM, the database, the editor and the exporters.

The LLM never produces HTML or code: it produces JSON that must validate against `DeckContent`.
Layouts are a closed set; elements are a discriminated union on `type`. The frontend mirrors this
file in `src/lib/deck/schema.ts`.
"""

import uuid
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

Layout = Literal[
    "hero",
    "agenda",
    "split",
    "grid",
    "metrics",
    "comparison",
    "timeline",
    "process",
    "chart",
    "table",
    "full_image",
    "quote",
    "before_after",
    "architecture",
    "roadmap",
    "team",
    "closing",
]
LAYOUTS: tuple[str, ...] = Layout.__args__  # type: ignore[attr-defined]

Style = Literal["executive", "premium", "modern", "editorial"]
STYLES: tuple[str, ...] = Style.__args__  # type: ignore[attr-defined]

AnimationType = Literal["none", "fade", "slide", "scale", "reveal", "stagger", "progressive"]
TransitionType = Literal["none", "fade", "dissolve", "slide"]


def _id() -> str:
    return uuid.uuid4().hex[:10]


class Strict(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class Animation(Strict):
    type: AnimationType = "fade"
    delay_ms: int = Field(0, ge=0, le=10_000)
    duration_ms: int = Field(500, ge=0, le=5_000)
    stagger_ms: int = Field(80, ge=0, le=2_000)
    direction: Literal["up", "down", "left", "right"] = "up"


class Transition(Strict):
    type: TransitionType = "fade"
    duration_ms: int = Field(500, ge=0, le=3_000)


class _Element(Strict):
    id: str = Field(default_factory=_id)
    animation: Animation | None = None


class TextElement(_Element):
    type: Literal["text"] = "text"
    role: Literal["body", "lead", "kicker", "caption", "label"] = "body"
    text: str = Field(max_length=1200)


class BulletsElement(_Element):
    type: Literal["bullets"] = "bullets"
    items: list[str] = Field(min_length=1, max_length=8)
    ordered: bool = False

    @field_validator("items")
    @classmethod
    def _trim(cls, v: list[str]) -> list[str]:
        return [i.strip()[:300] for i in v if i and i.strip()] or ["—"]


class ImageElement(_Element):
    type: Literal["image"] = "image"
    alt: str = ""
    # A short visual description the renderer / asset search uses; never a URL invented by the model.
    query: str = ""
    asset_id: str | None = None
    src: str | None = None
    fit: Literal["cover", "contain"] = "cover"


class ChartSeries(Strict):
    name: str = "Series"
    values: list[float] = Field(min_length=1, max_length=24)


class ChartElement(_Element):
    type: Literal["chart"] = "chart"
    chart_type: Literal["bar", "line", "area", "pie", "donut", "stacked_bar"] = "bar"
    title: str = ""
    labels: list[str] = Field(min_length=1, max_length=24)
    series: list[ChartSeries] = Field(min_length=1, max_length=4)
    unit: str = ""
    highlight_index: int | None = None

    @model_validator(mode="after")
    def _align(self) -> "ChartElement":
        n = len(self.labels)
        for s in self.series:
            if len(s.values) < n:
                s.values = s.values + [0.0] * (n - len(s.values))
            elif len(s.values) > n:
                s.values = s.values[:n]
        if self.highlight_index is not None and not 0 <= self.highlight_index < n:
            self.highlight_index = None
        return self


class TableElement(_Element):
    type: Literal["table"] = "table"
    columns: list[str] = Field(min_length=1, max_length=8)
    rows: list[list[str]] = Field(min_length=1, max_length=14)

    @model_validator(mode="after")
    def _rect(self) -> "TableElement":
        w = len(self.columns)
        self.rows = [[str(c) for c in (r + [""] * w)[:w]] for r in self.rows]
        return self


class MetricElement(_Element):
    type: Literal["metric"] = "metric"
    value: str = Field(max_length=24)
    label: str = Field(max_length=80)
    delta: str | None = Field(None, max_length=24)
    trend: Literal["up", "down", "flat"] | None = None


class ShapeElement(_Element):
    type: Literal["shape"] = "shape"
    shape: Literal["rect", "circle", "line", "arrow"] = "rect"
    color: Literal["primary", "secondary", "accent", "muted"] = "accent"


class TimelineItem(Strict):
    label: str = Field(max_length=40)  # e.g. "Q1 2027"
    title: str = Field(max_length=120)
    description: str = Field("", max_length=300)
    status: Literal["done", "current", "upcoming"] = "upcoming"


class TimelineElement(_Element):
    type: Literal["timeline"] = "timeline"
    items: list[TimelineItem] = Field(min_length=1, max_length=8)


class DiagramNode(Strict):
    id: str
    label: str = Field(max_length=80)
    description: str = Field("", max_length=200)
    group: str | None = None
    icon: str | None = None


class DiagramEdge(Strict):
    source: str = Field(alias="from")
    target: str = Field(alias="to")
    label: str = ""

    model_config = ConfigDict(populate_by_name=True, extra="ignore")


class DiagramElement(_Element):
    type: Literal["diagram"] = "diagram"
    kind: Literal["process", "architecture", "cycle", "hierarchy"] = "process"
    nodes: list[DiagramNode] = Field(min_length=1, max_length=12)
    edges: list[DiagramEdge] = Field(default_factory=list, max_length=20)

    @model_validator(mode="after")
    def _edges_reference_nodes(self) -> "DiagramElement":
        ids = {n.id for n in self.nodes}
        self.edges = [e for e in self.edges if e.source in ids and e.target in ids]
        return self


class IconElement(_Element):
    type: Literal["icon"] = "icon"
    name: str = Field("sparkles", max_length=40)  # lucide icon name
    label: str = ""
    description: str = ""


class QuoteElement(_Element):
    type: Literal["quote"] = "quote"
    text: str = Field(max_length=400)
    attribution: str = ""


class Column(Strict):
    title: str = Field(max_length=80)
    items: list[str] = Field(default_factory=list, max_length=8)
    tone: Literal["positive", "negative", "neutral"] = "neutral"


class ColumnsElement(_Element):
    """Side-by-side groups — comparison, before/after, pros/cons."""

    type: Literal["columns"] = "columns"
    columns: list[Column] = Field(min_length=2, max_length=4)


class Person(Strict):
    name: str
    role: str = ""
    bio: str = ""
    image_asset_id: str | None = None


class PeopleElement(_Element):
    type: Literal["people"] = "people"
    people: list[Person] = Field(min_length=1, max_length=8)


Element = Annotated[
    TextElement
    | BulletsElement
    | ImageElement
    | ChartElement
    | TableElement
    | MetricElement
    | ShapeElement
    | TimelineElement
    | DiagramElement
    | IconElement
    | QuoteElement
    | ColumnsElement
    | PeopleElement,
    Field(discriminator="type"),
]


class Slide(Strict):
    id: str = Field(default_factory=_id)
    layout: Layout = "split"
    eyebrow: str = Field("", max_length=60)
    title: str = Field(max_length=200)
    subtitle: str = Field("", max_length=300)
    elements: list[Element] = Field(default_factory=list, max_length=16)
    notes: str = Field("", max_length=3000)
    background: Literal["default", "inverse", "brand", "image"] = "default"
    transition: Transition = Field(default_factory=Transition)


class Palette(Strict):
    primary: str = "#2F5BD3"
    secondary: str = "#1B2A4A"
    accent: str = "#E3B866"
    background: str = "#FFFFFF"
    surface: str = "#F6F4EF"
    text: str = "#1C1D21"
    muted: str = "#6B6F7A"


class Fonts(Strict):
    heading: str = "Instrument Serif"
    body: str = "Geist"
    mono: str = "Geist Mono"


class Theme(Strict):
    style: Style = "executive"
    palette: Palette = Field(default_factory=Palette)
    fonts: Fonts = Field(default_factory=Fonts)
    logo_text: str = "ACME"
    logo_url: str | None = None


class DeckContent(Strict):
    """What the LLM produces (theme is applied server-side from the Brand System)."""

    title: str = Field(max_length=200)
    subtitle: str = Field("", max_length=300)
    slides: list[Slide] = Field(min_length=1, max_length=60)


class Deck(DeckContent):
    version: int = 1
    theme: Theme = Field(default_factory=Theme)


# ---- single-slide AI edit -----------------------------------------------------


class SlideEditResult(Strict):
    slide: Slide
    explanation: str = Field("", max_length=400)
