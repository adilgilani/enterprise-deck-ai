"""Vector PDF export with reportlab (open source, no headless browser or LibreOffice needed).

Slides use the shared layout engine; proposals and meeting notes are typeset as branded documents.
"""

import io
import math
from typing import Any

from reportlab.lib import colors as rl_colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader, simpleSplit
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.export.layout import H, W, Box, Canvas, Colors, SlideRenderer

FONTS = {"heading": "Times-Roman", "body": "Helvetica", "body_bold": "Helvetica-Bold", "mono": "Courier"}
_REPLACE = {"→": "->", "←": "<-", "✓": "v", "✔": "v", "≥": ">=", "≤": "<=", "−": "-", " ": " "}


def _safe(text: str) -> str:
    """Standard PDF fonts are cp1252; replace what they cannot encode."""
    for k, v in _REPLACE.items():
        text = text.replace(k, v)
    return text.encode("cp1252", errors="replace").decode("cp1252")


def _c(hex_: str) -> rl_colors.Color:
    return rl_colors.HexColor(hex_ if hex_.startswith("#") else f"#{hex_}")


class PdfCanvas(Canvas):
    def __init__(self, cv: rl_canvas.Canvas) -> None:
        self.cv = cv

    def _y(self, y: float, h: float = 0) -> float:
        return H - y - h

    def rect(self, b: Box, fill: str, radius: float = 0, line: str | None = None) -> None:
        self.cv.setFillColor(_c(fill))
        if line:
            self.cv.setStrokeColor(_c(line))
            self.cv.setLineWidth(0.75)
        stroke = 1 if line else 0
        if radius:
            self.cv.roundRect(b.x, self._y(b.y, b.h), b.w, b.h, radius, stroke=stroke, fill=1)
        else:
            self.cv.rect(b.x, self._y(b.y, b.h), b.w, b.h, stroke=stroke, fill=1)

    def ellipse(self, b: Box, fill: str) -> None:
        self.cv.saveState()
        p = self.cv.beginPath()
        p.rect(0, 0, W, H)
        self.cv.clipPath(p, stroke=0, fill=0)
        self.cv.setFillColor(_c(fill))
        self.cv.ellipse(b.x, self._y(b.y, b.h), b.x + b.w, self._y(b.y), stroke=0, fill=1)
        self.cv.restoreState()

    def line(self, x1: float, y1: float, x2: float, y2: float, color: str, width: float = 1, arrow: bool = False) -> None:
        self.cv.setStrokeColor(_c(color))
        self.cv.setLineWidth(width)
        self.cv.line(x1, self._y(y1), x2, self._y(y2))
        if arrow:
            ang = math.atan2(self._y(y2) - self._y(y1), x2 - x1)
            size = 6
            pts = [
                (x2, self._y(y2)),
                (x2 - size * math.cos(ang - 0.45), self._y(y2) - size * math.sin(ang - 0.45)),
                (x2 - size * math.cos(ang + 0.45), self._y(y2) - size * math.sin(ang + 0.45)),
            ]
            path = self.cv.beginPath()
            path.moveTo(*pts[0])
            path.lineTo(*pts[1])
            path.lineTo(*pts[2])
            path.close()
            self.cv.setFillColor(_c(color))
            self.cv.drawPath(path, stroke=0, fill=1)

    def _font(self, font: str, bold: bool) -> str:
        if font == "body" and bold:
            return "Helvetica-Bold"
        if font == "heading" and bold:
            return "Times-Bold"
        return FONTS.get(font, "Helvetica")

    def text(self, b: Box, text: str, *, size: float, color: str, font: str = "body", bold: bool = False,
             align: str = "left", valign: str = "top", italic: bool = False) -> None:
        name = self._font(font, bold)
        lines = simpleSplit(_safe(text or ""), name, size, max(b.w, 10))
        lh = size * 1.18
        max_lines = max(1, int(b.h // lh)) if b.h >= lh else 1
        if len(lines) > max_lines:
            lines = lines[:max_lines]
            lines[-1] = lines[-1].rstrip()[:-1] + "…" if lines[-1] else lines[-1]
        total = lh * len(lines)
        top = b.y + (b.h - total) / 2 if valign == "middle" else b.y
        self.cv.setFillColor(_c(color))
        self.cv.setFont(name, size)
        for i, ln in enumerate(lines):
            y = self._y(top + size + i * lh)
            if align == "center":
                self.cv.drawCentredString(b.x + b.w / 2, y, ln)
            elif align == "right":
                self.cv.drawRightString(b.x + b.w, y, ln)
            else:
                self.cv.drawString(b.x, y, ln)

    def bullets(self, b: Box, items: list[str], *, size: float, color: str, bullet_color: str, ordered: bool = False) -> None:
        y = b.y
        indent = 26 if ordered else 16
        for i, item in enumerate(items):
            lines = simpleSplit(_safe(item), "Helvetica", size, b.w - indent)
            h = len(lines) * size * 1.2
            if y + size > b.y + b.h:
                break
            if ordered:
                self.text(Box(b.x, y + 1, indent, size), f"{i + 1:02d}", size=size * 0.7, color=bullet_color, font="mono")
            else:
                self.ellipse(Box(b.x, y + size * 0.42, 5, 5), bullet_color)
            self.text(Box(b.x + indent, y, b.w - indent, h + 2), item, size=size, color=color)
            y += h + size * 0.6

    def chart(self, b: Box, el: dict[str, Any], c: Colors) -> None:
        labels = el.get("labels", [])
        series = el.get("series", [])
        if not labels or not series:
            return
        kind = el.get("chart_type", "bar")
        plot = Box(b.x, b.y + 4, b.w, b.h - 26)
        if kind in ("pie", "donut"):
            vals = [max(0.0, float(v)) for v in series[0].get("values", [])]
            total = sum(vals) or 1
            d = min(plot.w, plot.h)
            cx, cy = plot.x + d / 2, self._y(plot.y + d / 2)
            start = 90.0
            pal = [c.accent, c.primary, c.secondary, c.line, c.muted]
            for i, v in enumerate(vals):
                ext = 360 * v / total
                self.cv.setFillColor(_c(pal[i % len(pal)]))
                self.cv.wedge(cx - d / 2, cy - d / 2, cx + d / 2, cy + d / 2, start, ext, stroke=0, fill=1)
                start += ext
            if kind == "donut":
                self.cv.setFillColor(_c(c.bg))
                self.cv.circle(cx, cy, d * 0.28, stroke=0, fill=1)
            for i, lab in enumerate(labels):
                self.rect(Box(plot.x + d + 24, plot.y + i * 20, 10, 10), pal[i % len(pal)])
                self.text(Box(plot.x + d + 40, plot.y + i * 20 - 1, 220, 14), f"{lab} ({vals[i] if i < len(vals) else 0:g})", size=10, color=c.fg)
            return
        all_vals = [float(v) for s in series for v in s.get("values", [])] or [0]
        vmax = max(max(all_vals), 1e-9)
        n = len(labels)
        slot = plot.w / n
        base_y = plot.y + plot.h
        self.line(plot.x, base_y, plot.x + plot.w, base_y, c.line, 1)
        hi = el.get("highlight_index")
        if kind in ("line", "area"):
            for si, s in enumerate(series):
                pts = [(plot.x + slot * (i + 0.5), base_y - plot.h * 0.9 * float(v) / vmax) for i, v in enumerate(s.get("values", []))]
                col = c.accent if si == 0 else c.line
                if kind == "area" and si == 0:
                    path = self.cv.beginPath()
                    path.moveTo(pts[0][0], self._y(base_y))
                    for x, y in pts:
                        path.lineTo(x, self._y(y))
                    path.lineTo(pts[-1][0], self._y(base_y))
                    path.close()
                    self.cv.setFillColor(_c(c.panel))
                    self.cv.drawPath(path, stroke=0, fill=1)
                for (x1, y1), (x2, y2) in zip(pts, pts[1:], strict=False):
                    self.line(x1, y1, x2, y2, col, 2.2)
                for x, y in pts:
                    self.ellipse(Box(x - 3, y - 3, 6, 6), col)
        else:
            bw = slot * 0.62 / len(series)
            for si, s in enumerate(series):
                for i, v in enumerate(s.get("values", [])):
                    h = plot.h * 0.9 * float(v) / vmax
                    col = c.accent if (hi is None and si == 0) or i == hi else c.line
                    x = plot.x + slot * i + slot * 0.19 + si * bw
                    self.rect(Box(x, base_y - h, bw - 2, h), col)
                    if len(series) == 1:
                        self.text(Box(x - 10, base_y - h - 14, bw + 18, 12), f"{float(v):g}", size=8, color=c.muted, align="center")
        for i, lab in enumerate(labels):
            self.text(Box(plot.x + slot * i, base_y + 6, slot, 14), str(lab), size=8.5, color=c.muted, align="center")

    def table(self, b: Box, columns: list[str], rows: list[list[str]], c: Colors) -> None:
        n = len(rows) + 1
        rh = min(30.0, b.h / max(n, 1))
        cw = b.w / max(len(columns), 1)
        self.rect(Box(b.x, b.y, b.w, rh), c.fg if c.bg.upper() in ("#FFFFFF", "#F6F4EF") else c.panel)
        head_color = c.bg if c.bg.upper() in ("#FFFFFF", "#F6F4EF") else c.fg
        for ci, name in enumerate(columns):
            self.text(Box(b.x + ci * cw + 10, b.y + 8, cw - 16, rh - 8), name, size=10.5, color=head_color, bold=True)
        for ri, row in enumerate(rows, start=1):
            y = b.y + ri * rh
            if ri % 2 == 0:
                self.rect(Box(b.x, y, b.w, rh), c.panel)
            for ci, val in enumerate(row):
                self.text(Box(b.x + ci * cw + 10, y + 8, cw - 16, rh - 8), str(val), size=10.5, color=c.fg)
        self.line(b.x, b.y + n * rh, b.x + b.w, b.y + n * rh, c.line, 0.75)

    def image(self, b: Box, data: bytes | None, alt: str, c: Colors) -> None:
        if data:
            try:
                self.cv.drawImage(ImageReader(io.BytesIO(data)), b.x, self._y(b.y, b.h), b.w, b.h, preserveAspectRatio=True, mask="auto")
                return
            except Exception:
                pass
        self.rect(b, c.panel, radius=8)
        self.cv.saveState()
        p = self.cv.beginPath()
        p.roundRect(b.x, self._y(b.y, b.h), b.w, b.h, 8)
        self.cv.clipPath(p, stroke=0, fill=0)
        self.cv.setFillColor(_c(c.accent))
        r = b.w * 0.32
        self.cv.circle(b.x + b.w * 0.78, self._y(b.y + b.h * 0.82), r, stroke=0, fill=1)
        self.cv.restoreState()
        if alt:
            self.text(Box(b.x + 16, b.y + b.h - 28, b.w - 32, 16), alt, size=9, color=c.muted, font="mono")


    def logo(self, b: Box, data: bytes) -> None:
        try:
            self.cv.drawImage(ImageReader(io.BytesIO(data)), b.x, self._y(b.y, b.h), b.w, b.h, preserveAspectRatio=True, anchor="w", mask="auto")
        except Exception:
            pass




def build_slides_pdf(deck: dict[str, Any], images: dict[str, bytes] | None = None) -> bytes:
    buf = io.BytesIO()
    cv = rl_canvas.Canvas(buf, pagesize=(W, H))
    cv.setTitle(_safe(deck.get("title", "Presentation")))
    theme = deck.get("theme") or {}
    slides = deck.get("slides") or []
    for i, s in enumerate(slides):
        SlideRenderer(PdfCanvas(cv), theme, images).render(s, i, len(slides))
        cv.showPage()
    cv.save()
    return buf.getvalue()


# ---------------------------------------------------------------------------- documents


def _styles(theme: dict[str, Any]) -> dict[str, ParagraphStyle]:
    p = theme.get("palette") or {}
    ink = _c(p.get("text", "#1C1D21"))
    muted = _c(p.get("muted", "#6B6F7A"))
    accent = _c(p.get("primary", "#2F5BD3"))
    return {
        "title": ParagraphStyle("title", fontName="Times-Roman", fontSize=30, leading=34, textColor=ink, spaceAfter=6),
        "subtitle": ParagraphStyle("subtitle", fontName="Helvetica", fontSize=12, leading=16, textColor=muted, spaceAfter=18),
        "eyebrow": ParagraphStyle("eyebrow", fontName="Courier", fontSize=8, leading=10, textColor=accent, spaceAfter=4),
        "h2": ParagraphStyle("h2", fontName="Times-Roman", fontSize=19, leading=23, textColor=ink, spaceBefore=16, spaceAfter=8),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=10, leading=15, textColor=ink, alignment=TA_LEFT, spaceAfter=6),
        "muted": ParagraphStyle("muted", fontName="Helvetica", fontSize=9, leading=13, textColor=muted),
        "bullet": ParagraphStyle("bullet", fontName="Helvetica", fontSize=10, leading=15, textColor=ink, leftIndent=12, bulletIndent=0, spaceAfter=3),
        "metric": ParagraphStyle("metric", fontName="Courier-Bold", fontSize=18, leading=22, textColor=ink),
    }


def _esc(s: Any) -> str:
    return _safe(str(s if s is not None else "")).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _tbl(data: list[list[Any]], theme: dict[str, Any], widths: list[float] | None = None) -> Table:
    st = _styles(theme)
    p = theme.get("palette") or {}
    rows = [[Paragraph(_esc(c), st["body"]) for c in r] for r in data]
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), _c(p.get("surface", "#F6F4EF"))),
                ("LINEBELOW", (0, 0), (-1, -1), 0.4, _c("#DDDDDD")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return t


def _blocks(blocks: list[dict[str, Any]], theme: dict[str, Any]) -> list[Any]:
    st = _styles(theme)
    out: list[Any] = []
    for b in blocks:
        t = b.get("type")
        if t == "paragraph":
            out.append(Paragraph(_esc(b.get("text")), st["body"]))
        elif t == "bullets":
            out += [Paragraph(_esc(i), st["bullet"], bulletText="•") for i in b.get("items", [])]
        elif t == "metrics":
            cells = [[Paragraph(_esc(m.get("value")), st["metric"]) for m in b.get("items", [])],
                     [Paragraph(_esc(m.get("label")), st["muted"]) for m in b.get("items", [])]]
            out.append(Table(cells))
        elif t == "table":
            out.append(_tbl([b.get("columns", [])] + b.get("rows", []), theme))
        elif t == "timeline":
            out.append(_tbl([["When", "Milestone", "Detail"]] + [[i.get("label"), i.get("title"), i.get("description", "")] for i in b.get("items", [])], theme))
        elif t == "callout":
            out.append(_tbl([[Paragraph(f"<b>{_esc(b.get('title'))}</b><br/>{_esc(b.get('text'))}", st["body"])]], theme))
        elif t == "quote":
            out.append(Paragraph(f"<i>“{_esc(b.get('text'))}”</i> — {_esc(b.get('attribution'))}", st["body"]))
        elif t == "pricing":
            cur = b.get("currency", "USD")
            lines = b.get("lines", [])
            total = sum(float(x.get("amount") or 0) for x in lines)
            data = [["Item", "Description", f"Amount ({cur})"]] + [[x.get("item"), x.get("description", ""), f"{float(x.get('amount') or 0):,.0f}"] for x in lines]
            data.append(["Total", "", f"{total:,.0f}"])
            out.append(_tbl(data, theme))
            if b.get("notes"):
                out.append(Paragraph(_esc(b["notes"]), st["muted"]))
        elif t == "case_study":
            out.append(Paragraph(f"<b>{_esc(b.get('client'))}</b>", st["body"]))
            out.append(Paragraph(f"Challenge: {_esc(b.get('challenge'))}", st["body"]))
            out.append(Paragraph(f"Solution: {_esc(b.get('solution'))}", st["body"]))
            out += [Paragraph(_esc(r), st["bullet"], bulletText="+") for r in b.get("results", [])]
        elif t == "team":
            out.append(_tbl([["Name", "Role", ""]] + [[m.get("name"), m.get("role"), m.get("bio", "")] for m in b.get("members", [])], theme))
        elif t == "diagram":
            nodes = (b.get("diagram") or {}).get("nodes", [])
            out.append(Paragraph("  »  ".join(_esc(n.get("label")) for n in nodes), st["body"]))
        out.append(Spacer(1, 4))
    return out


def _doc(flow: list[Any], title: str, theme: dict[str, Any], footer: str) -> bytes:
    buf = io.BytesIO()
    p = theme.get("palette") or {}

    def deco(cv: rl_canvas.Canvas, doc: Any) -> None:
        cv.saveState()
        cv.setFillColor(_c(p.get("primary", "#2F5BD3")))
        cv.rect(18 * mm, A4[1] - 14 * mm, 4 * mm, 4 * mm, stroke=0, fill=1)
        cv.setFont("Helvetica-Bold", 8)
        cv.setFillColor(_c(p.get("text", "#1C1D21")))
        cv.drawString(24 * mm, A4[1] - 13.4 * mm, _safe(theme.get("logo_text", "ACME")))
        cv.setFont("Helvetica", 7.5)
        cv.setFillColor(_c(p.get("muted", "#6B6F7A")))
        cv.drawString(18 * mm, 10 * mm, _safe(footer))
        cv.drawRightString(A4[0] - 18 * mm, 10 * mm, f"{doc.page}")
        cv.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=24 * mm, bottomMargin=18 * mm, title=_safe(title))
    doc.build(flow, onFirstPage=deco, onLaterPages=deco)
    return buf.getvalue()


def build_proposal_pdf(title: str, client: str, schema: dict[str, Any], company: str) -> bytes:
    theme = schema.get("theme") or {}
    st = _styles(theme)
    flow: list[Any] = [
        Paragraph(_esc(f"Proposal for {client}").upper(), st["eyebrow"]),
        Paragraph(_esc(title), st["title"]),
        Paragraph(_esc(schema.get("subtitle", "")), st["subtitle"]),
    ]
    for i, sec in enumerate(schema.get("sections", []), 1):
        if sec.get("kind") == "cover":
            flow += _blocks(sec.get("blocks", []), theme)
            continue
        flow.append(KeepTogether([Paragraph(f"{i:02d}", st["eyebrow"]), Paragraph(_esc(sec.get("title")), st["h2"])]))
        flow += _blocks(sec.get("blocks", []), theme)
    return _doc(flow, title, theme, f"{company} · Confidential · Prepared for {client}")


def build_meeting_notes_pdf(meeting: dict[str, Any], theme: dict[str, Any], company: str) -> bytes:
    st = _styles(theme)
    intel = meeting.get("intelligence") or {}
    flow: list[Any] = [
        Paragraph("MEETING NOTES", st["eyebrow"]),
        Paragraph(_esc(meeting.get("title")), st["title"]),
        Paragraph(_esc(f"{meeting.get('date', '')} · {meeting.get('duration', '')} · {', '.join(meeting.get('participants', []))}"), st["subtitle"]),
        Paragraph("Executive Summary", st["h2"]),
        Paragraph(_esc(intel.get("summary", "")), st["body"]),
    ]

    def section(title: str, items: list[Any]) -> None:
        if items:
            flow.append(Paragraph(title, st["h2"]))
            flow.extend(items)

    section("Key Decisions", [Paragraph(_esc(d.get("text")), st["bullet"], bulletText="•") for d in intel.get("decisions", [])])
    section("Discussion Highlights", [Paragraph(f"<b>{_esc(t.get('title'))}</b> — {_esc(t.get('summary', ''))}", st["body"]) for t in intel.get("topics", [])])
    actions = meeting.get("action_items") or []
    if actions:
        flow.append(Paragraph("Action Items", st["h2"]))
        flow.append(_tbl([["Action", "Owner", "Deadline", "Status"]] + [[a.get("title"), a.get("owner") or "—", a.get("deadline") or a.get("deadline_text") or "—", a.get("status", "open")] for a in actions], theme, [95 * mm, 32 * mm, 26 * mm, 20 * mm]))
    section("Open Questions", [Paragraph(_esc(q.get("text")), st["bullet"], bulletText="?") for q in intel.get("questions", [])])
    section("Risks", [Paragraph(f"{_esc(r.get('text'))} <font color='#888888'>({_esc(r.get('severity'))})</font>", st["bullet"], bulletText="!") for r in intel.get("risks", [])])
    nums = intel.get("numbers", [])
    if nums:
        flow.append(Paragraph("Important Numbers", st["h2"]))
        flow.append(_tbl([["Figure", "What it refers to"]] + [[n.get("value"), n.get("label")] for n in nums], theme, [40 * mm, 134 * mm]))
    section("Next Steps", [Paragraph(_esc(s), st["bullet"], bulletText="»") for s in intel.get("next_steps", [])])
    return _doc(flow, meeting.get("title", "Meeting notes"), theme, f"{company} · Meeting notes · Confidential")
