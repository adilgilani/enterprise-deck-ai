"""Backend-agnostic slide layout engine used by both exporters.

Coordinates are points on a 960×540 (16:9) slide, origin top-left. Backends (python-pptx for editable
PowerPoint, reportlab for vector PDF) implement `Canvas`; this module decides *what goes where* from the
structured slide JSON, mirroring the web renderer's layouts and the four visual styles.
"""

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

W, H = 960.0, 540.0
PAD = 52.0


@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float

    def inset(self, d: float) -> "Box":
        return Box(self.x + d, self.y + d, self.w - 2 * d, self.h - 2 * d)

    def split_h(self, n: int, gap: float = 16) -> list["Box"]:
        if n <= 0:
            return []
        w = (self.w - gap * (n - 1)) / n
        return [Box(self.x + i * (w + gap), self.y, w, self.h) for i in range(n)]

    def split_v(self, ratios: list[float], gap: float = 12) -> list["Box"]:
        total = sum(ratios)
        avail = self.h - gap * (len(ratios) - 1)
        out, y = [], self.y
        for r in ratios:
            h = avail * r / total
            out.append(Box(self.x, y, self.w, h))
            y += h + gap
        return out


@dataclass
class Colors:
    bg: str
    fg: str
    muted: str
    accent: str
    panel: str
    line: str
    primary: str
    secondary: str


class Canvas(ABC):
    """Drawing primitives every export backend implements."""

    @abstractmethod
    def rect(self, b: Box, fill: str, radius: float = 0, line: str | None = None) -> None: ...

    @abstractmethod
    def ellipse(self, b: Box, fill: str) -> None: ...

    @abstractmethod
    def line(self, x1: float, y1: float, x2: float, y2: float, color: str, width: float = 1, arrow: bool = False) -> None: ...

    @abstractmethod
    def text(
        self, b: Box, text: str, *, size: float, color: str, font: str = "body", bold: bool = False,
        align: str = "left", valign: str = "top", italic: bool = False,
    ) -> None: ...

    @abstractmethod
    def bullets(self, b: Box, items: list[str], *, size: float, color: str, bullet_color: str, ordered: bool = False) -> None: ...

    @abstractmethod
    def chart(self, b: Box, el: dict[str, Any], c: Colors) -> None: ...

    @abstractmethod
    def table(self, b: Box, columns: list[str], rows: list[list[str]], c: Colors) -> None: ...

    @abstractmethod
    def image(self, b: Box, data: bytes | None, alt: str, c: Colors) -> None: ...


def _mix(hex_a: str, hex_b: str, t: float) -> str:
    a = [int(hex_a.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)]
    b = [int(hex_b.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4)]
    return "#" + "".join(f"{round(x + (y - x) * t):02X}" for x, y in zip(a, b, strict=True))


def colors_for(theme: dict[str, Any], background: str) -> Colors:
    p = {**{"primary": "#2F5BD3", "secondary": "#1B2A4A", "accent": "#E3B866", "background": "#FFFFFF",
            "surface": "#F6F4EF", "text": "#1C1D21", "muted": "#6B6F7A"}, **(theme.get("palette") or {})}
    style = theme.get("style", "executive")
    dark_default = style == "premium"
    bg_kind = background
    if bg_kind == "default" and dark_default:
        bg_kind = "inverse"
    if bg_kind == "inverse":
        bg = p["secondary"] if style != "executive" else _mix(p["text"], p["secondary"], 0.3)
        fg = "#FFFFFF"
        accent = p["accent"]
        return Colors(bg, fg, _mix(fg, bg, 0.4), accent, _mix(bg, fg, 0.08), _mix(bg, fg, 0.18), p["primary"], p["secondary"])
    if bg_kind == "brand":
        bg, fg = p["primary"], "#FFFFFF"
        return Colors(bg, fg, _mix(fg, bg, 0.3), p["accent"], _mix(bg, fg, 0.12), _mix(bg, fg, 0.25), p["primary"], p["secondary"])
    bg = p["surface"] if style == "editorial" else p["background"]
    fg = p["text"]
    accent = p["accent"] if style == "editorial" else p["primary"]
    return Colors(bg, fg, p["muted"], accent, _mix(bg, p["secondary"], 0.06), _mix(bg, fg, 0.14), p["primary"], p["secondary"])


def heading_font(theme: dict[str, Any]) -> str:
    return "heading" if theme.get("style") in ("premium", "editorial") else "body_bold"


class SlideRenderer:
    def __init__(self, canvas: Canvas, theme: dict[str, Any], images: dict[str, bytes] | None = None) -> None:
        self.c = canvas
        self.theme = theme
        self.images = images or {}

    # ------------------------------------------------------------------ frame
    def render(self, slide: dict[str, Any], index: int, total: int) -> None:
        col = colors_for(self.theme, slide.get("background", "default"))
        self.col = col
        self.c.rect(Box(0, 0, W, H), col.bg)
        # header: logo mark + wordmark, page number
        self.c.rect(Box(PAD, 30, 11, 11), col.accent, radius=2)
        self.c.text(Box(PAD + 18, 26, 300, 20), self.theme.get("logo_text", "ACME"), size=10, color=col.fg, bold=True)
        self.c.text(Box(W - PAD - 100, 26, 100, 20), f"{index + 1:02d} / {total:02d}", size=9, color=col.muted, font="mono", align="right")

        layout = slide.get("layout", "split")
        els = slide.get("elements") or []
        fn = getattr(self, f"_layout_{layout}", None)
        if layout in ("hero", "closing"):
            self._layout_hero(slide, els)
        elif layout == "quote":
            self._layout_quote(slide, els)
        elif layout in ("agenda",):
            self._layout_agenda(slide, els)
        elif layout in ("split", "full_image"):
            self._layout_split(slide, els)
        elif fn:
            fn(slide, els)
        else:
            self._layout_default(slide, els)

    def _title(self, slide: dict[str, Any], box: Box, size: float = 32) -> float:
        y = box.y
        if slide.get("eyebrow"):
            self.c.text(Box(box.x, y, box.w, 16), slide["eyebrow"].upper(), size=9, color=self.col.muted, font="mono")
            y += 22
        # Average glyph width ≈ 0.52 em; reserve enough height for the wrapped headline (max 3 lines).
        lines = max(1, min(3, math.ceil(len(slide.get("title", "")) * size * 0.52 / box.w)))
        th = size * 1.25 * lines
        self.c.text(Box(box.x, y, box.w, th), slide.get("title", ""), size=size, color=self.col.fg, font=heading_font(self.theme))
        y += th + 6
        if slide.get("subtitle"):
            self.c.text(Box(box.x, y, box.w, 34), slide["subtitle"], size=13, color=self.col.muted)
            y += 34
        return y

    # ------------------------------------------------------------------ layouts
    def _layout_hero(self, slide: dict[str, Any], els: list[dict[str, Any]]) -> None:
        x, w = PAD, W * 0.72
        self.c.rect(Box(x, H * 0.42, 64, 3), self.col.accent)
        if slide.get("eyebrow"):
            self.c.text(Box(x, H * 0.42 - 30, w, 16), slide["eyebrow"].upper(), size=10, color=self.col.muted, font="mono")
        self.c.text(Box(x, H * 0.42 + 18, w, 130), slide.get("title", ""), size=50, color=self.col.fg, font=heading_font(self.theme))
        y = H * 0.42 + 150
        if slide.get("subtitle"):
            self.c.text(Box(x, y, w, 30), slide["subtitle"], size=15, color=self.col.muted)
            y += 36
        rest = [e for e in els if e.get("type") != "shape"]
        if rest:
            self._elements(Box(x, y, w, H - y - 30), rest)

    def _layout_quote(self, slide: dict[str, Any], els: list[dict[str, Any]]) -> None:
        q = next((e for e in els if e.get("type") == "quote"), None)
        text = q["text"] if q else slide.get("title", "")
        attribution = (q or {}).get("attribution") or slide.get("subtitle", "")
        self.c.text(Box(W * 0.12, H * 0.25, W * 0.76, 200), f"“{text.strip(chr(8220) + chr(8221) + chr(34))}”", size=36,
                    color=self.col.fg, font="heading", align="center", valign="middle")
        if attribution:
            self.c.text(Box(W * 0.12, H * 0.25 + 220, W * 0.76, 20), attribution.upper(), size=10, color=self.col.muted, font="mono", align="center")

    def _layout_agenda(self, slide: dict[str, Any], els: list[dict[str, Any]]) -> None:
        self._title(slide, Box(PAD, 110, W * 0.36, 200), size=42)
        self._elements(Box(W * 0.46, 120, W * 0.54 - PAD, H - 170), els)

    def _layout_split(self, slide: dict[str, Any], els: list[dict[str, Any]]) -> None:
        visual_types = {"image", "chart", "quote", "diagram", "metric", "people"}
        text = [e for e in els if e.get("type") not in visual_types]
        visual = [e for e in els if e.get("type") in visual_types]
        left = Box(PAD, 90, (W - 2 * PAD) * 0.5 - 16, H - 140)
        y = self._title(slide, left, size=30)
        if text:
            self._elements(Box(left.x, max(y + 16, 260), left.w, H - max(y + 16, 260) - 50), text)
        right = Box(W / 2 + 16, 90, W / 2 - PAD - 16, H - 140)
        if visual:
            self._elements(right, visual)
        else:
            self.c.rect(right, self.col.panel, radius=8)
            self.c.ellipse(Box(right.x + right.w * 0.45, right.y + right.h * 0.45, right.w * 0.6, right.w * 0.6), self.col.accent)

    def _layout_default(self, slide: dict[str, Any], els: list[dict[str, Any]]) -> None:
        y = self._title(slide, Box(PAD, 90, W - 2 * PAD, 140), size=30)
        top = max(y + 18, 200)
        self._elements(Box(PAD, top, W - 2 * PAD, H - top - 46), els)

    # ------------------------------------------------------------------ elements
    def _elements(self, box: Box, els: list[dict[str, Any]]) -> None:
        groups: list[list[dict[str, Any]]] = []
        for e in els:
            if e.get("type") == "shape":
                continue
            if groups and groups[-1][0].get("type") == e.get("type") and e.get("type") in ("metric", "icon"):
                groups[-1].append(e)
            else:
                groups.append([e])
        if not groups:
            return
        weights = [self._weight(g) for g in groups]
        for g, b in zip(groups, box.split_v(weights, gap=18), strict=True):
            self._group(b, g)

    @staticmethod
    def _weight(g: list[dict[str, Any]]) -> float:
        t = g[0].get("type")
        return {"text": 0.6, "metric": 1.0, "icon": 1.4, "bullets": 1.6, "chart": 3.0, "table": 2.4, "timeline": 1.6,
                "diagram": 2.2, "columns": 2.4, "people": 1.8, "quote": 1.4, "image": 3.0}.get(t or "", 1.0)

    def _group(self, b: Box, g: list[dict[str, Any]]) -> None:
        t = g[0].get("type")
        c = self.col
        if t == "metric":
            for e, cell in zip(g, b.split_h(len(g), 24), strict=True):
                self.c.rect(Box(cell.x, cell.y, cell.w, 1.2), c.line)
                self.c.text(Box(cell.x, cell.y + 12, cell.w, 56), e.get("value", ""), size=40, color=c.fg, font="mono")
                self.c.text(Box(cell.x, cell.y + 68, cell.w, 34), e.get("label", ""), size=12, color=c.muted)
                if e.get("delta"):
                    self.c.text(Box(cell.x, cell.y + 92, cell.w, 18), e["delta"], size=11, color=c.accent, bold=True)
        elif t == "icon":
            for e, cell in zip(g, b.split_h(len(g), 14), strict=True):
                self.c.rect(cell, c.panel, radius=8)
                self.c.ellipse(Box(cell.x + 16, cell.y + 16, 26, 26), c.accent)
                self.c.text(Box(cell.x + 16, cell.y + 56, cell.w - 32, 40), e.get("label", ""), size=14, color=c.fg, bold=True)
                self.c.text(Box(cell.x + 16, cell.y + 92, cell.w - 32, cell.h - 100), e.get("description", ""), size=11, color=c.muted)
        else:
            e = g[0]
            if t == "text":
                size = {"lead": 18, "caption": 11, "kicker": 10, "label": 11}.get(e.get("role", "body"), 14)
                self.c.text(b, e.get("text", ""), size=size, color=c.muted if e.get("role") == "caption" else c.fg)
            elif t == "bullets":
                self.c.bullets(b, e.get("items", []), size=15, color=c.fg, bullet_color=c.accent, ordered=bool(e.get("ordered")))
            elif t == "chart":
                self.c.chart(b, e, c)
            elif t == "table":
                self.c.table(b, e.get("columns", []), e.get("rows", []), c)
            elif t == "image":
                data = self.images.get(e.get("asset_id") or "")
                self.c.image(b, data, e.get("alt") or e.get("query") or "", c)
            elif t == "quote":
                self.c.rect(Box(b.x, b.y, 3, b.h), c.accent)
                self.c.text(Box(b.x + 18, b.y, b.w - 18, b.h - 24), f"“{e.get('text', '')}”", size=20, color=c.fg, font="heading")
                self.c.text(Box(b.x + 18, b.y + b.h - 20, b.w - 18, 18), e.get("attribution", ""), size=10, color=c.muted, font="mono")
            elif t == "timeline":
                self._timeline(b, e.get("items", []))
            elif t == "diagram":
                self._diagram(b, e)
            elif t == "columns":
                self._columns(b, e.get("columns", []))
            elif t == "people":
                self._people(b, e.get("people", []))

    def _timeline(self, b: Box, items: list[dict[str, Any]]) -> None:
        c = self.col
        if not items:
            return
        mid = b.y + 26
        self.c.line(b.x, mid, b.x + b.w, mid, c.line, 2)
        for i, (it, cell) in enumerate(zip(items, b.split_h(len(items), 18), strict=True)):
            done = it.get("status") in ("done", "current") or i == 0
            self.c.ellipse(Box(cell.x, mid - 8, 16, 16), c.accent if done else c.line)
            self.c.text(Box(cell.x, mid + 22, cell.w, 16), it.get("label", ""), size=10, color=c.muted, font="mono")
            self.c.text(Box(cell.x, mid + 40, cell.w, 36), it.get("title", ""), size=15, color=c.fg, bold=True)
            if it.get("description"):
                self.c.text(Box(cell.x, mid + 78, cell.w, b.h - 110), it["description"], size=11, color=c.muted)

    def _diagram(self, b: Box, e: dict[str, Any]) -> None:
        c = self.col
        nodes = e.get("nodes", [])
        if not nodes:
            return
        if e.get("kind") == "architecture" and len(nodes) > 3:
            rows = [nodes[:1], nodes[1:-2] or nodes[1:2], nodes[-2:]] if len(nodes) >= 4 else [nodes]
        else:
            rows = [nodes]
        row_boxes = b.split_v([1] * len(rows), gap=26)
        centers: dict[str, tuple[float, float, float, float]] = {}
        for row, rb in zip(rows, row_boxes, strict=True):
            for n, cell in zip(row, Box(rb.x, rb.y, rb.w, min(rb.h, 96)).split_h(len(row), 34), strict=True):
                self.c.rect(cell, c.panel, radius=8, line=c.line)
                self.c.text(Box(cell.x + 12, cell.y + 12, cell.w - 24, 22), n.get("label", ""), size=14, color=c.fg, bold=True)
                if n.get("description"):
                    self.c.text(Box(cell.x + 12, cell.y + 36, cell.w - 24, cell.h - 40), n["description"], size=10.5, color=c.muted)
                centers[n["id"]] = (cell.x, cell.y, cell.w, cell.h)
        for edge in e.get("edges", []):
            a, z = centers.get(edge.get("from") or edge.get("source", "")), centers.get(edge.get("to") or edge.get("target", ""))
            if not a or not z:
                continue
            if abs(a[1] - z[1]) < 1:  # same row → horizontal arrow
                x1, x2 = (a[0] + a[2], z[0]) if a[0] < z[0] else (a[0], z[0] + z[2])
                y = a[1] + a[3] / 2
                self.c.line(x1 + 2, y, x2 - 2, y, c.accent, 1.5, arrow=True)
            else:
                x1, y1 = a[0] + a[2] / 2, a[1] + a[3]
                x2, y2 = z[0] + z[2] / 2, z[1]
                if y1 > y2:
                    x1, y1, x2, y2 = z[0] + z[2] / 2, z[1] + z[3], a[0] + a[2] / 2, a[1]
                self.c.line(x1, y1 + 2, x2, y2 - 2, c.accent, 1.5, arrow=True)

    def _columns(self, b: Box, cols: list[dict[str, Any]]) -> None:
        c = self.col
        for col, cell in zip(cols, b.split_h(len(cols), 18), strict=True):
            positive = col.get("tone") == "positive"
            self.c.rect(cell, c.panel if positive else c.bg, radius=8, line=c.line)
            self.c.text(Box(cell.x + 18, cell.y + 16, cell.w - 36, 24), col.get("title", ""), size=16, color=c.fg, bold=True)
            self.c.bullets(Box(cell.x + 18, cell.y + 50, cell.w - 36, cell.h - 60), col.get("items", []), size=13,
                           color=c.fg if positive else c.muted, bullet_color=c.accent if positive else c.line)

    def _people(self, b: Box, people: list[dict[str, Any]]) -> None:
        c = self.col
        for p, cell in zip(people, b.split_h(len(people), 18), strict=True):
            d = min(64.0, cell.w * 0.4)
            self.c.ellipse(Box(cell.x, cell.y, d, d), c.panel)
            initials = "".join(w[0] for w in p.get("name", "?").split()[:2]).upper()
            self.c.text(Box(cell.x, cell.y, d, d), initials, size=18, color=c.fg, bold=True, align="center", valign="middle")
            self.c.text(Box(cell.x, cell.y + d + 12, cell.w, 20), p.get("name", ""), size=14, color=c.fg, bold=True)
            self.c.text(Box(cell.x, cell.y + d + 32, cell.w, 18), p.get("role", ""), size=11, color=c.muted)
            if p.get("bio"):
                self.c.text(Box(cell.x, cell.y + d + 52, cell.w, cell.h - d - 52), p["bio"], size=10, color=c.muted)
