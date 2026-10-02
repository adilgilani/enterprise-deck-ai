/**
 * Presentation schema — mirror of backend/app/schemas/deck.py.
 * The LLM produces this JSON; the renderer, editor, presenter and exporters all consume it.
 */

export const LAYOUTS = [
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
] as const;
export type Layout = (typeof LAYOUTS)[number];

export const STYLES = ["executive", "premium", "modern", "editorial"] as const;
export type Style = (typeof STYLES)[number];

export type AnimationType = "none" | "fade" | "slide" | "scale" | "reveal" | "stagger" | "progressive";
export type TransitionType = "none" | "fade" | "dissolve" | "slide";

export interface Animation {
  type: AnimationType;
  delay_ms?: number;
  duration_ms?: number;
  stagger_ms?: number;
  direction?: "up" | "down" | "left" | "right";
}

interface Base {
  id?: string;
  animation?: Animation | null;
}

export interface TextEl extends Base {
  type: "text";
  role?: "body" | "lead" | "kicker" | "caption" | "label";
  text: string;
}
export interface BulletsEl extends Base {
  type: "bullets";
  items: string[];
  ordered?: boolean;
}
export interface ImageEl extends Base {
  type: "image";
  alt?: string;
  query?: string;
  asset_id?: string | null;
  src?: string | null;
  fit?: "cover" | "contain";
}
export interface ChartSeries {
  name: string;
  values: number[];
}
export type ChartType = "bar" | "line" | "area" | "pie" | "donut" | "stacked_bar";
export interface ChartEl extends Base {
  type: "chart";
  chart_type: ChartType;
  title?: string;
  labels: string[];
  series: ChartSeries[];
  unit?: string;
  highlight_index?: number | null;
}
export interface TableEl extends Base {
  type: "table";
  columns: string[];
  rows: string[][];
}
export interface MetricEl extends Base {
  type: "metric";
  value: string;
  label: string;
  delta?: string | null;
  trend?: "up" | "down" | "flat" | null;
}
export interface ShapeEl extends Base {
  type: "shape";
  shape: "rect" | "circle" | "line" | "arrow";
  color?: "primary" | "secondary" | "accent" | "muted";
}
export interface TimelineItem {
  label: string;
  title: string;
  description?: string;
  status?: "done" | "current" | "upcoming";
}
export interface TimelineEl extends Base {
  type: "timeline";
  items: TimelineItem[];
}
export interface DiagramNode {
  id: string;
  label: string;
  description?: string;
  group?: string | null;
  icon?: string | null;
}
export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}
export interface DiagramEl extends Base {
  type: "diagram";
  kind: "process" | "architecture" | "cycle" | "hierarchy";
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}
export interface IconEl extends Base {
  type: "icon";
  name: string;
  label?: string;
  description?: string;
}
export interface QuoteEl extends Base {
  type: "quote";
  text: string;
  attribution?: string;
}
export interface Column {
  title: string;
  items: string[];
  tone?: "positive" | "negative" | "neutral";
}
export interface ColumnsEl extends Base {
  type: "columns";
  columns: Column[];
}
export interface Person {
  name: string;
  role?: string;
  bio?: string;
  image_asset_id?: string | null;
}
export interface PeopleEl extends Base {
  type: "people";
  people: Person[];
}

export type Element =
  | TextEl
  | BulletsEl
  | ImageEl
  | ChartEl
  | TableEl
  | MetricEl
  | ShapeEl
  | TimelineEl
  | DiagramEl
  | IconEl
  | QuoteEl
  | ColumnsEl
  | PeopleEl;
export type ElementType = Element["type"];

export interface Slide {
  id: string;
  layout: Layout;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  elements: Element[];
  notes?: string;
  background?: "default" | "inverse" | "brand" | "image";
  transition?: { type: TransitionType; duration_ms?: number };
}

export interface Palette {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

export interface Theme {
  style: Style;
  palette: Palette;
  fonts: { heading: string; body: string; mono: string };
  logo_text?: string;
  logo_url?: string | null;
}

export interface Deck {
  version?: number;
  title: string;
  subtitle?: string;
  theme: Theme;
  slides: Slide[];
}

export const DEFAULT_THEME: Theme = {
  style: "executive",
  palette: {
    primary: "#2F5BD3",
    secondary: "#1B2A4A",
    accent: "#E3B866",
    background: "#FFFFFF",
    surface: "#F6F4EF",
    text: "#1C1D21",
    muted: "#6B6F7A",
  },
  fonts: { heading: "Instrument Serif", body: "Geist", mono: "Geist Mono" },
  logo_text: "ACME",
};

export function newId(): string {
  return Math.random().toString(16).slice(2, 12);
}

export function normalizeTheme(t: Partial<Theme> | undefined | null): Theme {
  return {
    ...DEFAULT_THEME,
    ...(t ?? {}),
    palette: { ...DEFAULT_THEME.palette, ...(t?.palette ?? {}) },
    fonts: { ...DEFAULT_THEME.fonts, ...(t?.fonts ?? {}) },
  };
}

export const LAYOUT_LABELS: Record<Layout, string> = {
  hero: "Hero",
  agenda: "Agenda",
  split: "Split",
  grid: "Grid",
  metrics: "Metrics",
  comparison: "Comparison",
  timeline: "Timeline",
  process: "Process",
  chart: "Chart",
  table: "Table",
  full_image: "Full image",
  quote: "Quote",
  before_after: "Before / after",
  architecture: "Architecture",
  roadmap: "Roadmap",
  team: "Team",
  closing: "Closing",
};

/** Starter content for a new slide of a given layout (used by "Add slide"). */
export function blankSlide(layout: Layout): Slide {
  const id = newId();
  const base = { id, layout, transition: { type: "fade" as const, duration_ms: 500 } };
  switch (layout) {
    case "hero":
    case "closing":
      return { ...base, title: layout === "hero" ? "Presentation title" : "Thank you", subtitle: "Subtitle", background: "inverse", elements: [] };
    case "metrics":
      return {
        ...base,
        title: "Key results",
        elements: [
          { type: "metric", value: "$48M", label: "Revenue", animation: { type: "scale" } },
          { type: "metric", value: "128%", label: "Net retention", animation: { type: "scale", delay_ms: 120 } },
          { type: "metric", value: "81%", label: "Gross margin", animation: { type: "scale", delay_ms: 240 } },
        ],
      };
    case "chart":
      return {
        ...base,
        title: "Growth accelerated",
        subtitle: "Quarterly revenue, $M",
        elements: [{ type: "chart", chart_type: "bar", labels: ["Q1", "Q2", "Q3", "Q4"], series: [{ name: "Revenue", values: [12, 16, 21, 28] }], highlight_index: 3, animation: { type: "progressive" } }],
      };
    case "timeline":
    case "roadmap":
      return {
        ...base,
        title: "Roadmap",
        elements: [{ type: "timeline", items: [{ label: "Q1", title: "Foundation", status: "done" }, { label: "Q2", title: "Scale", status: "current" }, { label: "Q3", title: "Expand" }, { label: "Q4", title: "Lead" }], animation: { type: "reveal" } }],
      };
    case "comparison":
    case "before_after":
      return {
        ...base,
        title: layout === "before_after" ? "Before and after" : "How we compare",
        elements: [{ type: "columns", columns: [{ title: layout === "before_after" ? "Before" : "Us", tone: "negative", items: ["Point one", "Point two"] }, { title: layout === "before_after" ? "After" : "Others", tone: "positive", items: ["Point one", "Point two"] }] }],
      };
    case "process":
    case "architecture":
      return {
        ...base,
        title: layout === "process" ? "How it works" : "Architecture",
        elements: [{ type: "diagram", kind: layout === "process" ? "process" : "architecture", nodes: [{ id: "a", label: "Step one" }, { id: "b", label: "Step two" }, { id: "c", label: "Step three" }], edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }], animation: { type: "stagger" } }],
      };
    case "grid":
      return {
        ...base,
        title: "Four pillars",
        elements: ["target", "zap", "shield-check", "trending-up"].map((n, i) => ({ type: "icon" as const, name: n, label: `Pillar ${i + 1}`, description: "Short description", animation: { type: "stagger" as const, delay_ms: i * 80 } })),
      };
    case "quote":
      return { ...base, title: "", background: "brand", elements: [{ type: "quote", text: "A memorable customer quote.", attribution: "Customer, Company" }] };
    case "team":
      return { ...base, title: "Our team", elements: [{ type: "people", people: [{ name: "Name Surname", role: "Role" }, { name: "Name Surname", role: "Role" }, { name: "Name Surname", role: "Role" }] }] };
    case "table":
      return { ...base, title: "Comparison table", elements: [{ type: "table", columns: ["Item", "Value", "Notes"], rows: [["A", "1", "—"], ["B", "2", "—"]] }] };
    case "full_image":
      return { ...base, title: "A striking visual", elements: [{ type: "image", query: "abstract architecture", alt: "Image" }] };
    case "agenda":
      return { ...base, title: "Agenda", elements: [{ type: "bullets", ordered: true, items: ["Context", "Insights", "Plan", "Decisions"], animation: { type: "stagger" } }] };
    default:
      return { ...base, title: "New slide", elements: [{ type: "bullets", items: ["First point", "Second point", "Third point"], animation: { type: "stagger" } }, { type: "image", query: "", alt: "" }] };
  }
}
