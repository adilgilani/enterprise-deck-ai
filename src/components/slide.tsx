/**
 * Structured slide renderer.
 *
 * Renders any Slide (see lib/deck/schema.ts) with the deck Theme. Sizes use container-query units (cqw) so
 * the same component scales from a 120px thumbnail to a full-screen presenter. Brand colors flow in as CSS
 * variables; animations come from each element's `animation` spec; text is inline-editable in the editor.
 */
import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { blobUrl } from "@/lib/api/client";
import { DeckIcon } from "@/components/deck/icons";
import { headingClass, slideColors, type SlideColors } from "@/lib/deck/theme";
import {
  normalizeTheme,
  type Animation,
  type ChartEl,
  type ColumnsEl,
  type DiagramEl,
  type Element,
  type PeopleEl,
  type Slide,
  type TableEl,
  type Theme,
  type TimelineEl,
} from "@/lib/deck/schema";

type Path = (string | number)[];

interface RenderCtx {
  theme: Theme;
  c: SlideColors;
  animate: boolean;
  editable: boolean;
  onEdit?: ((path: Path, value: string) => void) | undefined;
}
const Ctx = createContext<RenderCtx | null>(null);
const useR = () => useContext(Ctx) as RenderCtx;

// ---------------------------------------------------------------------------- animation helpers

const ANIM_CLASS: Record<string, string> = {
  fade: "s-anim-fade",
  slide: "s-anim-left",
  scale: "s-anim-scale",
  reveal: "s-anim-reveal",
  stagger: "s-anim-up",
  progressive: "s-anim-up",
};

function anim(a: Animation | null | undefined, animate: boolean, index = 0, fallback?: Animation["type"]): { className: string; style: CSSProperties } {
  const type = a?.type ?? fallback;
  if (!animate || !type || type === "none") return { className: "", style: {} };
  const delay = (a?.delay_ms ?? 0) + index * (a?.stagger_ms ?? 90);
  const style = { "--d": `${delay + 150}ms`, "--dur": `${a?.duration_ms ?? 600}ms` } as CSSProperties;
  const dirClass = type === "slide" && a?.direction === "right" ? "s-anim-right" : ANIM_CLASS[type] ?? "s-anim-fade";
  return { className: `s-anim ${dirClass}`, style };
}

// ---------------------------------------------------------------------------- editable text

function E({ path, value, className, style, as: Tag = "span", placeholder }: { path: Path; value: string | undefined | null; className?: string; style?: CSSProperties; as?: "span" | "div" | "p" | "li" | "td" | "th"; placeholder?: string }) {
  const { editable, onEdit } = useR();
  const text = value ?? "";
  if (!editable || !onEdit) return <Tag className={className} style={style}>{text}</Tag>;
  return (
    <Tag
      className={cn(className, "s-editable")}
      style={style}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={placeholder ?? "Type…"}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
        if (e.key === "Escape") (e.currentTarget as HTMLElement).blur();
        e.stopPropagation();
      }}
      onBlur={(e) => {
        const next = (e.currentTarget.textContent ?? "").trim();
        if (next !== text) onEdit(path, next);
      }}
    >
      {text}
    </Tag>
  );
}

// ---------------------------------------------------------------------------- root

export interface SlideRendererProps {
  slide: Slide | null | undefined;
  theme?: Partial<Theme> | null | undefined;
  index?: number;
  total?: number;
  animate?: boolean;
  editable?: boolean;
  onEdit?: (path: Path, value: string) => void;
  className?: string;
  /** Optional fallback title for empty decks (e.g. while generating). */
  title?: string;
}

export function SlideRenderer({ slide, theme: rawTheme, index = 0, total = 1, animate = false, editable = false, onEdit, className, title }: SlideRendererProps) {
  const theme = normalizeTheme(rawTheme ?? undefined);
  const s: Slide = slide ?? { id: "empty", layout: "hero", title: title ?? "Untitled", elements: [], background: "inverse" };
  const c = slideColors(theme, s.background);
  const vars = {
    "--s-bg": c.bg,
    "--s-fg": c.fg,
    "--s-muted": c.muted,
    "--s-accent": c.accent,
    "--s-panel": c.panel,
    "--s-line": c.line,
    "--s-primary": c.primary,
    "--s-secondary": c.secondary,
    background: c.bg,
    color: c.fg,
  } as CSSProperties;
  return (
    <Ctx.Provider value={{ theme, c, animate, editable, onEdit }}>
      <div className={cn("@container relative aspect-video w-full select-none overflow-hidden", editable && "select-text", className)} style={vars}>
        <Decoration slide={s} />
        <div className="absolute inset-0 flex flex-col px-[5.5cqw] pb-[4.5cqw] pt-[3.4cqw]">
          <Header index={index} total={total} />
          <Body slide={s} />
        </div>
      </div>
    </Ctx.Provider>
  );
}

/** Back-compat alias used by cards. */
export const SlideView = SlideRenderer;

function Header({ index, total }: { index: number; total: number }) {
  const { theme, c } = useR();
  return (
    <div className="relative z-10 flex items-center justify-between">
      <div className="flex items-center gap-[0.9cqw]">
        <div className="relative size-[2cqw] rounded-[0.35cqw]" style={{ background: c.dark ? c.accent : c.secondary }}>
          <div className="absolute inset-[0.45cqw] rounded-[0.18cqw] border border-white/40" />
        </div>
        <span className="text-[1.25cqw] font-semibold tracking-[0.12em]">{theme.logo_text ?? "ACME"}</span>
      </div>
      <span className="font-mono text-[1.05cqw]" style={{ color: c.muted }}>
        {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
      </span>
    </div>
  );
}

function Decoration({ slide }: { slide: Slide }) {
  const { theme, c } = useR();
  if (slide.layout === "hero" || slide.layout === "closing") {
    return (
      <>
        <div className="absolute -right-[12%] -top-[30%] size-[62cqw] rounded-full opacity-[0.10]" style={{ background: c.accent }} />
        <div className="absolute -right-[4%] top-[18%] size-[34cqw] rounded-full border opacity-25" style={{ borderColor: c.accent, borderWidth: "0.15cqw" }} />
        {theme.style === "modern" && <div className="absolute bottom-0 left-0 h-[0.8cqw] w-full" style={{ background: c.accent }} />}
      </>
    );
  }
  if (theme.style === "editorial") return <div className="absolute inset-x-[5.5cqw] top-[7.4cqw] h-px opacity-60" style={{ background: c.line }} />;
  if (theme.style === "modern") return <div className="absolute left-0 top-0 h-full w-[0.6cqw]" style={{ background: c.accent }} />;
  return null;
}

function Title({ slide, size = 4.2, className }: { slide: Slide; size?: number; className?: string }) {
  const { theme, c, animate, editable } = useR();
  const a = anim({ type: "fade", duration_ms: 500 }, animate);
  return (
    <div className={cn(a.className, className)} style={a.style}>
      {(slide.eyebrow || editable) && (
        <E path={["eyebrow"]} value={slide.eyebrow} as="div" placeholder="Eyebrow" className="mb-[1.1cqw] block font-mono text-[1.05cqw] uppercase tracking-[0.16em]" style={{ color: c.accent }} />
      )}
      <E path={["title"]} value={slide.title} as="div" placeholder="Slide title" className={cn("block leading-[1.06]", headingClass(theme))} style={{ fontSize: `${size}cqw` }} />
      {(slide.subtitle || editable) && (
        <E path={["subtitle"]} value={slide.subtitle} as="p" placeholder="Subtitle" className="mt-[1.1cqw] block max-w-[90%] text-[1.55cqw] leading-snug" style={{ color: c.muted }} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------- layouts

const VISUAL = new Set(["image", "chart", "quote", "diagram", "metric", "people", "table"]);

function Body({ slide }: { slide: Slide }) {
  const { c, theme, animate, editable } = useR();
  const els = slide.elements.filter((e) => e.type !== "shape");
  const withIndex = slide.elements.map((e, i) => ({ e, i })).filter(({ e }) => e.type !== "shape");

  switch (slide.layout) {
    case "hero":
    case "closing":
      return (
        <div className="relative z-10 mt-auto max-w-[78%]">
          <div className="mb-[2cqw] h-[0.35cqw] w-[7cqw]" style={{ background: c.accent }} />
          {slide.eyebrow && <E path={["eyebrow"]} value={slide.eyebrow} as="div" className="mb-[1.4cqw] block font-mono text-[1.1cqw] uppercase tracking-[0.16em]" style={{ color: c.muted }} />}
          <E path={["title"]} value={slide.title} as="div" placeholder="Title" className={cn("block leading-[1.02]", headingClass(theme), animate && "s-anim s-anim-up")} style={{ fontSize: slide.layout === "hero" ? "6.4cqw" : "5.6cqw", ...({ "--d": "150ms", "--dur": "700ms" } as CSSProperties) }} />
          {(slide.subtitle || editable) && <E path={["subtitle"]} value={slide.subtitle} as="p" placeholder="Subtitle" className="mt-[1.8cqw] block text-[1.75cqw]" style={{ color: c.muted }} />}
          {els.length > 0 && <div className="mt-[2.4cqw]">{renderGroups(withIndex, "stack")}</div>}
        </div>
      );
    case "quote": {
      const qi = slide.elements.findIndex((e) => e.type === "quote");
      const q = slide.elements[qi];
      const quote = q && q.type === "quote" ? q : null;
      return (
        <div className="relative z-10 m-auto max-w-[82%] text-center">
          <div className="mb-[1cqw] font-serif text-[8cqw] leading-none" style={{ color: c.accent }}>“</div>
          {quote ? (
            <E path={["elements", qi, "text"]} value={quote.text.replace(/^[“"]|[”"]$/g, "")} as="div" className={cn("block font-serif text-[3.9cqw] leading-[1.12]", animate && "s-anim s-anim-fade")} />
          ) : (
            <E path={["title"]} value={slide.title} as="div" className="block font-serif text-[3.9cqw] leading-[1.12]" />
          )}
          <E path={quote ? ["elements", qi, "attribution"] : ["subtitle"]} value={quote?.attribution ?? slide.subtitle} as="div" className="mt-[2.6cqw] block font-mono text-[1.15cqw] uppercase tracking-[0.18em]" style={{ color: c.muted }} />
        </div>
      );
    }
    case "agenda":
      return (
        <div className="mt-[4cqw] grid flex-1 grid-cols-[1fr_1.35fr] gap-[5cqw]">
          <Title slide={slide} size={5.4} />
          <div className="self-end">{renderGroups(withIndex, "stack")}</div>
        </div>
      );
    case "full_image": {
      const img = withIndex.find(({ e }) => e.type === "image");
      return (
        <>
          <div className="absolute inset-0">
            {img ? <ImageBlock el={img.e as Extract<Element, { type: "image" }>} full /> : <Placeholder query={slide.title} full />}
            <div className="absolute inset-0" style={{ background: `linear-gradient(to top, ${c.secondary}EE, ${c.secondary}22 60%)` }} />
          </div>
          <div className="relative z-10 mt-auto max-w-[70%] text-white">
            <Title slide={slide} size={4.8} />
          </div>
        </>
      );
    }
    case "split": {
      const text = withIndex.filter(({ e }) => !VISUAL.has(e.type));
      const visual = withIndex.filter(({ e }) => VISUAL.has(e.type));
      return (
        <div className="mt-[3.6cqw] grid min-h-0 flex-1 grid-cols-2 gap-[4.5cqw]">
          <div className="flex min-h-0 flex-col">
            <Title slide={slide} size={3.9} />
            <div className="mt-auto pt-[2cqw]">{renderGroups(text, "stack")}</div>
          </div>
          <div className="relative min-h-0">{visual.length ? <div className="flex h-full flex-col justify-center gap-[2cqw]">{renderGroups(visual, "stack")}</div> : <Placeholder query={slide.title} />}</div>
        </div>
      );
    }
    default:
      return (
        <div className="mt-[3.6cqw] flex min-h-0 flex-1 flex-col">
          <Title slide={slide} />
          <div className="mt-auto flex min-h-0 flex-col justify-end gap-[2.2cqw] pt-[2.4cqw]">{renderGroups(withIndex, "stack", slide.layout === "before_after")}</div>
        </div>
      );
  }
}

/** Group consecutive metrics / icons into rows; render others as blocks. */
function renderGroups(items: { e: Element; i: number }[], _mode: "stack", arrows = false): ReactNode {
  const groups: { e: Element; i: number }[][] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last[0] && last[0].e.type === it.e.type && (it.e.type === "metric" || it.e.type === "icon")) last.push(it);
    else groups.push([it]);
  }
  return groups.map((g) => {
    const first = g[0];
    if (!first) return null;
    if (first.e.type === "metric") return <MetricRow key={`m${first.i}`} items={g} />;
    if (first.e.type === "icon") return <IconGrid key={`i${first.i}`} items={g} />;
    return <ElementBlock key={first.i} el={first.e} index={first.i} arrows={arrows} />;
  });
}

// ---------------------------------------------------------------------------- elements

function ElementBlock({ el, index, arrows }: { el: Element; index: number; arrows?: boolean }) {
  const { c, animate } = useR();
  const base: Path = ["elements", index];
  switch (el.type) {
    case "text": {
      const size = { lead: 2.1, caption: 1.2, kicker: 1.05, label: 1.2, body: 1.6 }[el.role ?? "body"];
      const a = anim(el.animation, animate, 0, "fade");
      return <E path={[...base, "text"]} value={el.text} as="p" className={cn("block leading-snug", el.role === "kicker" && "font-mono uppercase tracking-widest", a.className)} style={{ fontSize: `${size}cqw`, color: el.role === "caption" || el.role === "kicker" ? c.muted : undefined, ...a.style }} />;
    }
    case "bullets":
      return (
        <ul className="space-y-[1.2cqw]">
          {el.items.map((item, k) => {
            const a = anim(el.animation, animate, k, "stagger");
            return (
              <li key={k} className={cn("flex items-baseline gap-[1.3cqw] text-[1.7cqw] leading-snug", a.className)} style={a.style}>
                {el.ordered ? (
                  <span className="w-[2.4cqw] shrink-0 font-mono text-[1.15cqw]" style={{ color: c.accent }}>{String(k + 1).padStart(2, "0")}</span>
                ) : (
                  <span className="relative top-[-0.2cqw] size-[0.75cqw] shrink-0 rounded-full" style={{ background: c.accent }} />
                )}
                <E path={[...base, "items", k]} value={item} className="flex-1" />
              </li>
            );
          })}
        </ul>
      );
    case "chart":
      return <Chart el={el} />;
    case "table":
      return <TableBlock el={el} index={index} />;
    case "image":
      return <ImageBlock el={el} />;
    case "quote": {
      const a = anim(el.animation, animate, 0, "fade");
      return (
        <figure className={cn("border-l-[0.35cqw] pl-[2cqw]", a.className)} style={{ borderColor: c.accent, ...a.style }}>
          <E path={[...base, "text"]} value={`${el.text}`} as="div" className="block font-serif text-[2.5cqw] leading-[1.18]" />
          <E path={[...base, "attribution"]} value={el.attribution} as="div" className="mt-[1.2cqw] block font-mono text-[1cqw] uppercase tracking-[0.16em]" style={{ color: c.muted }} />
        </figure>
      );
    }
    case "timeline":
      return <TimelineBlock el={el} index={index} />;
    case "diagram":
      return <DiagramBlock el={el} index={index} />;
    case "columns":
      return <ColumnsBlock el={el} index={index} arrows={arrows ?? false} />;
    case "people":
      return <PeopleBlock el={el} index={index} />;
    case "metric":
      return <MetricRow items={[{ e: el, i: index }]} />;
    case "icon":
      return <IconGrid items={[{ e: el, i: index }]} />;
    default:
      return null;
  }
}

function MetricRow({ items }: { items: { e: Element; i: number }[] }) {
  const { c, animate } = useR();
  return (
    <div className="grid gap-[2.6cqw]" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map(({ e, i }, k) => {
        if (e.type !== "metric") return null;
        const a = anim(e.animation, animate, k, "scale");
        const trendColor = e.trend === "down" ? c.muted : c.accent;
        return (
          <div key={i} className={cn("border-t pt-[1.6cqw]", a.className)} style={{ borderColor: c.line, borderTopWidth: "0.15cqw", ...a.style }}>
            <E path={["elements", i, "value"]} value={e.value} as="div" className="block font-mono text-[5cqw] font-medium leading-none tracking-[-0.04em]" />
            <div className="mt-[1cqw] flex items-center gap-[1cqw]">
              <E path={["elements", i, "label"]} value={e.label} as="div" className="block text-[1.35cqw]" style={{ color: c.muted }} />
              {e.delta && (
                <span className="rounded-full px-[0.8cqw] py-[0.15cqw] font-mono text-[1cqw] font-medium" style={{ background: c.panel, color: trendColor }}>
                  {e.trend === "down" ? "▼" : e.trend === "up" ? "▲" : ""} {e.delta}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconGrid({ items }: { items: { e: Element; i: number }[] }) {
  const { c, animate, theme } = useR();
  return (
    <div className="grid gap-[1.6cqw]" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
      {items.map(({ e, i }, k) => {
        if (e.type !== "icon") return null;
        const a = anim(e.animation, animate, k, "stagger");
        return (
          <div key={i} className={cn("flex min-h-[15cqw] flex-col rounded-[0.9cqw] p-[1.8cqw]", a.className)} style={{ background: c.panel, ...a.style }}>
            <div className="grid size-[3.6cqw] place-items-center rounded-full" style={{ background: theme.style === "executive" ? c.accent : "transparent", border: theme.style === "executive" ? undefined : `0.15cqw solid ${c.accent}` }}>
              <DeckIcon name={e.name} className="size-[1.8cqw]" style={{ color: theme.style === "executive" ? "#fff" : c.accent }} />
            </div>
            <E path={["elements", i, "label"]} value={e.label} as="div" className="mt-auto block pt-[2cqw] text-[1.6cqw] font-semibold leading-tight" />
            <E path={["elements", i, "description"]} value={e.description} as="div" className="mt-[0.6cqw] block text-[1.15cqw] leading-snug" style={{ color: c.muted }} />
          </div>
        );
      })}
    </div>
  );
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function Chart({ el }: { el: ChartEl }) {
  const { c, animate } = useR();
  const series = el.series.length ? el.series : [{ name: "Series", values: [] }];
  const palette = [c.accent, c.line, c.primary, c.muted];
  const progressive = animate && el.animation?.type !== "none";
  const legend = series.length > 1 && (
    <div className="mt-[1cqw] flex gap-[2cqw] text-[1.05cqw]" style={{ color: c.muted }}>
      {series.map((s, i) => (
        <span key={s.name} className="flex items-center gap-[0.6cqw]"><span className="size-[0.9cqw] rounded-sm" style={{ background: palette[i % palette.length] }} />{s.name}</span>
      ))}
    </div>
  );

  if (el.chart_type === "pie" || el.chart_type === "donut") {
    const vals = (series[0]?.values ?? []).map((v) => Math.max(0, v));
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    const pieColors = [c.accent, c.primary, c.secondary, c.line, c.muted];
    let acc = 0;
    return (
      <div className="flex h-[28cqw] items-center gap-[4cqw]">
        <svg viewBox="0 0 42 42" className={cn("h-full", progressive && "s-anim s-anim-scale")}>
          {vals.map((v, i) => {
            const len = (v / total) * 100;
            const off = 25 - acc;
            acc += len;
            return <circle key={i} cx="21" cy="21" r="15.915" fill="none" stroke={pieColors[i % pieColors.length]} strokeWidth={el.chart_type === "donut" ? 6 : 31.8} strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={off} />;
          })}
        </svg>
        <div className="space-y-[1cqw]">
          {el.labels.map((l, i) => (
            <div key={i} className="flex items-center gap-[1cqw] text-[1.4cqw]">
              <span className="size-[1.1cqw] rounded-sm" style={{ background: pieColors[i % pieColors.length] }} />
              {l}
              <span className="font-mono" style={{ color: c.muted }}>{Math.round(((vals[i] ?? 0) / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const n = el.labels.length;
  const stacked = el.chart_type === "stacked_bar";
  const totals = el.labels.map((_, i) => series.reduce((a, s) => a + (s.values[i] ?? 0), 0));
  const max = Math.max(...(stacked ? totals : series.flatMap((s) => s.values)), 1e-9);

  if (el.chart_type === "line" || el.chart_type === "area") {
    const pts = (vals: number[]) => vals.map((v, i) => [((i + 0.5) / n) * 100, 100 - (v / max) * 88] as const);
    return (
      <div>
        <div className="relative h-[24cqw]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
            <line x1="0" y1="100" x2="100" y2="100" stroke={c.line} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
            {series.map((s, si) => {
              const p = pts(s.values);
              const d = p.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
              const col = si === 0 ? c.accent : palette[si % palette.length];
              return (
                <g key={si}>
                  {el.chart_type === "area" && si === 0 && p.length > 0 && <path d={`${d} L${p[p.length - 1]?.[0]},100 L${p[0]?.[0]},100 Z`} fill={c.accent} opacity="0.14" className={cn(progressive && "s-anim s-anim-fade")} />}
                  <path d={d} fill="none" stroke={col} strokeWidth="2.4" vectorEffect="non-scaling-stroke" pathLength={100} className={cn(progressive && "s-draw")} />
                </g>
              );
            })}
          </svg>
          {series[0]?.values.map((v, i) => {
            const x = ((i + 0.5) / n) * 100;
            const y = 100 - (v / max) * 88;
            const hi = el.highlight_index === i || (el.highlight_index == null && i === n - 1);
            return (
              <div key={i} className={cn("absolute -translate-x-1/2 -translate-y-1/2", progressive && "s-anim s-anim-scale")} style={{ left: `${x}%`, top: `${y}%`, ...({ "--d": `${300 + i * 90}ms` } as CSSProperties) }}>
                <div className="size-[1cqw] rounded-full border-[0.2cqw]" style={{ background: c.bg, borderColor: c.accent }} />
                {hi && <div className="absolute bottom-[1.6cqw] left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[1.15cqw] font-medium">{fmt(v)}{el.unit && el.unit !== "$M" ? "" : ""}</div>}
              </div>
            );
          })}
        </div>
        <div className="mt-[1cqw] grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0,1fr))` }}>
          {el.labels.map((l, i) => <div key={i} className="truncate text-center text-[1.05cqw]" style={{ color: c.muted }}>{l}</div>)}
        </div>
        {legend}
      </div>
    );
  }

  // bar & stacked bar
  return (
    <div>
      <div className="flex h-[24cqw] items-end gap-[1.6cqw] border-b" style={{ borderColor: c.line }}>
        {el.labels.map((label, i) => {
          const hi = el.highlight_index != null ? el.highlight_index === i : i === n - 1;
          const delay = { "--d": `${200 + i * 110}ms`, "--dur": "700ms" } as CSSProperties;
          if (stacked) {
            return (
              <div key={label + i} className={cn("flex h-full flex-1 flex-col justify-end", progressive && "s-anim s-grow")} style={delay}>
                <div className="mb-[0.6cqw] text-center font-mono text-[1cqw]" style={{ color: c.muted }}>{fmt(totals[i] ?? 0)}</div>
                {series.map((s, si) => <div key={si} style={{ height: `${((s.values[i] ?? 0) / max) * 88}%`, background: palette[si % palette.length] }} className="w-full first:rounded-t-[0.3cqw]" />)}
              </div>
            );
          }
          return (
            <div key={label + i} className="flex h-full flex-1 items-end justify-center gap-[0.4cqw]">
              {series.map((s, si) => {
                const v = s.values[i] ?? 0;
                const color = series.length > 1 ? palette[si % palette.length] : hi ? c.accent : c.line;
                return (
                  <div key={si} className="flex h-full flex-1 flex-col justify-end">
                    {series.length === 1 && <div className={cn("mb-[0.5cqw] text-center font-mono text-[1.05cqw]", progressive && "s-anim s-anim-fade")} style={{ color: hi ? c.fg : c.muted, ...delay }}>{fmt(v)}</div>}
                    <div className={cn("w-full rounded-t-[0.35cqw]", progressive && "s-anim s-grow")} style={{ height: `${(v / max) * 88}%`, background: color, ...delay }} />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="mt-[0.8cqw] flex gap-[1.6cqw]">
        {el.labels.map((l, i) => <div key={i} className="flex-1 truncate text-center text-[1.05cqw]" style={{ color: c.muted }}>{l}</div>)}
      </div>
      {legend}
    </div>
  );
}

function TableBlock({ el, index }: { el: TableEl; index: number }) {
  const { c, animate } = useR();
  const a = anim(el.animation, animate, 0, "fade");
  return (
    <table className={cn("w-full border-collapse text-left text-[1.3cqw]", a.className)} style={a.style}>
      <thead>
        <tr style={{ background: c.dark ? c.panel : c.fg, color: c.dark ? c.fg : c.bg }}>
          {el.columns.map((col, k) => <E key={k} as="th" path={["elements", index, "columns", k]} value={col} className="px-[1.2cqw] py-[0.9cqw] font-semibold first:rounded-tl-[0.4cqw] last:rounded-tr-[0.4cqw]" />)}
        </tr>
      </thead>
      <tbody>
        {el.rows.map((row, r) => (
          <tr key={r} className="border-b" style={{ borderColor: c.line, background: r % 2 ? c.panel : "transparent" }}>
            {row.map((cell, k) => <E key={k} as="td" path={["elements", index, "rows", r, k]} value={cell} className={cn("px-[1.2cqw] py-[0.85cqw]", k === 0 && "font-medium")} />)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TimelineBlock({ el, index }: { el: TimelineEl; index: number }) {
  const { c, animate, editable } = useR();
  return (
    <div className="relative">
      <div className={cn("absolute left-0 right-0 top-[1.1cqw] h-[0.2cqw]", animate && "s-anim s-anim-reveal")} style={{ background: c.line }} />
      <div className="grid gap-[2cqw]" style={{ gridTemplateColumns: `repeat(${el.items.length}, minmax(0,1fr))` }}>
        {el.items.map((it, k) => {
          const a = anim(el.animation, animate, k, "reveal");
          const active = it.status === "done" || it.status === "current" || (!it.status && k === 0);
          return (
            <div key={k} className={cn(a.className.replace("s-anim-reveal", "s-anim-up"))} style={a.style}>
              <div className="relative grid size-[2.4cqw] place-items-center rounded-full" style={{ background: active ? c.accent : c.bg, border: `0.2cqw solid ${active ? c.accent : c.line}` }}>
                {it.status === "current" && <div className="absolute inset-[-0.7cqw] rounded-full border" style={{ borderColor: c.accent, opacity: 0.4 }} />}
              </div>
              <E path={["elements", index, "items", k, "label"]} value={it.label} as="div" className="mt-[1.8cqw] block font-mono text-[1.05cqw] uppercase tracking-wider" style={{ color: c.muted }} />
              <E path={["elements", index, "items", k, "title"]} value={it.title} as="div" className="mt-[0.4cqw] block text-[1.75cqw] font-semibold leading-tight" />
              {(it.description || editable) && <E path={["elements", index, "items", k, "description"]} value={it.description} as="div" className="mt-[0.6cqw] block text-[1.2cqw] leading-snug" style={{ color: c.muted }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Node({ n, path, k, a }: { n: DiagramEl["nodes"][number]; path: Path; k: number; a: ReturnType<typeof anim> }) {
  const { c } = useR();
  return (
    <div className={cn("relative min-w-0 flex-1 rounded-[0.8cqw] border p-[1.5cqw]", a.className)} style={{ background: c.panel, borderColor: c.line, borderWidth: "0.12cqw", ...a.style }}>
      <div className="mb-[0.8cqw] font-mono text-[0.95cqw]" style={{ color: c.accent }}>{String(k + 1).padStart(2, "0")}</div>
      <E path={[...path, "label"]} value={n.label} as="div" className="block text-[1.55cqw] font-semibold leading-tight" />
      {n.description && <E path={[...path, "description"]} value={n.description} as="div" className="mt-[0.5cqw] block text-[1.1cqw] leading-snug" style={{ color: c.muted }} />}
    </div>
  );
}

function Arrow({ vertical }: { vertical?: boolean }) {
  const { c } = useR();
  return (
    <div className={cn("grid shrink-0 place-items-center", vertical ? "h-[2.4cqw]" : "w-[2.4cqw]")}>
      <svg viewBox="0 0 24 24" className={cn("size-[1.8cqw]", vertical && "rotate-90")} fill="none" stroke={c.accent} strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </div>
  );
}

function DiagramBlock({ el, index }: { el: DiagramEl; index: number }) {
  const { animate } = useR();
  const nodes = el.nodes;
  const path = (k: number): Path => ["elements", index, "nodes", k];
  if (el.kind === "architecture" && nodes.length >= 4) {
    const tiers = [nodes.slice(0, 1), nodes.slice(1, nodes.length - 2), nodes.slice(-2)].filter((t) => t.length);
    let k = -1;
    return (
      <div className="flex flex-col">
        {tiers.map((tier, ti) => (
          <div key={ti}>
            {ti > 0 && <Arrow vertical />}
            <div className="flex gap-[1.6cqw]">
              {tier.map((n) => {
                k += 1;
                return <Node key={n.id} n={n} path={path(k)} k={k} a={anim(el.animation, animate, k, "reveal")} />;
              })}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (el.kind === "hierarchy" && nodes.length > 1) {
    const [root, ...rest] = nodes;
    return (
      <div className="flex flex-col items-center">
        {root && <div className="w-[34%]"><Node n={root} path={path(0)} k={0} a={anim(el.animation, animate, 0, "reveal")} /></div>}
        <Arrow vertical />
        <div className="flex w-full gap-[1.6cqw]">{rest.map((n, i) => <Node key={n.id} n={n} path={path(i + 1)} k={i + 1} a={anim(el.animation, animate, i + 1, "reveal")} />)}</div>
      </div>
    );
  }
  return (
    <div className="flex items-stretch">
      {nodes.map((n, k) => (
        <div key={n.id} className="flex min-w-0 flex-1 items-center">
          <Node n={n} path={path(k)} k={k} a={anim(el.animation, animate, k, "stagger")} />
          {(k < nodes.length - 1 || el.kind === "cycle") && <Arrow />}
        </div>
      ))}
    </div>
  );
}

function ColumnsBlock({ el, index, arrows }: { el: ColumnsEl; index: number; arrows: boolean }) {
  const { c, animate } = useR();
  return (
    <div className="flex items-stretch gap-[1.6cqw]">
      {el.columns.map((col, k) => {
        const a = anim(el.animation, animate, k, "slide");
        const pos = col.tone === "positive";
        const neg = col.tone === "negative";
        return (
          <div key={k} className="flex flex-1 items-center gap-[1.6cqw]">
            {arrows && k > 0 && <Arrow />}
            <div className={cn("h-full flex-1 rounded-[0.9cqw] border p-[2cqw]", a.className)} style={{ background: pos ? c.panel : "transparent", borderColor: pos ? c.accent : c.line, borderWidth: "0.13cqw", ...a.style }}>
              <div className="flex items-center gap-[0.8cqw]">
                <span className="size-[0.9cqw] rounded-full" style={{ background: pos ? c.accent : c.line }} />
                <E path={["elements", index, "columns", k, "title"]} value={col.title} as="div" className="block text-[1.75cqw] font-semibold" />
              </div>
              <ul className="mt-[1.4cqw] space-y-[0.9cqw]">
                {col.items.map((item, j) => (
                  <li key={j} className="flex items-baseline gap-[0.9cqw] text-[1.35cqw] leading-snug" style={{ color: neg ? c.muted : undefined }}>
                    <span style={{ color: pos ? c.accent : c.muted }}>{pos ? "✓" : neg ? "–" : "•"}</span>
                    <E path={["elements", index, "columns", k, "items", j]} value={item} className="flex-1" />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PeopleBlock({ el, index }: { el: PeopleEl; index: number }) {
  const { c, animate } = useR();
  return (
    <div className="grid gap-[2cqw]" style={{ gridTemplateColumns: `repeat(${Math.min(el.people.length, 5)}, minmax(0,1fr))` }}>
      {el.people.map((p, k) => {
        const a = anim(el.animation, animate, k, "stagger");
        const ini = p.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
        return (
          <div key={k} className={a.className} style={a.style}>
            <div className="grid aspect-square w-[45%] place-items-center rounded-full text-[2cqw] font-semibold" style={{ background: `linear-gradient(135deg, ${c.panel}, ${c.line})` }}>{ini}</div>
            <E path={["elements", index, "people", k, "name"]} value={p.name} as="div" className="mt-[1.4cqw] block text-[1.6cqw] font-semibold" />
            <E path={["elements", index, "people", k, "role"]} value={p.role} as="div" className="block text-[1.2cqw]" style={{ color: c.accent }} />
            {p.bio && <E path={["elements", index, "people", k, "bio"]} value={p.bio} as="div" className="mt-[0.6cqw] block text-[1.1cqw] leading-snug" style={{ color: c.muted }} />}
          </div>
        );
      })}
    </div>
  );
}

function useAssetSrc(assetId: string | null | undefined, src?: string | null): string | null {
  const [url, setUrl] = useState<string | null>(src ?? null);
  useEffect(() => {
    if (src) return setUrl(src);
    if (!assetId) return setUrl(null);
    let alive = true;
    blobUrl(`/assets/${assetId}/file`).then((u) => alive && setUrl(u)).catch(() => alive && setUrl(null));
    return () => {
      alive = false;
    };
  }, [assetId, src]);
  return url;
}

function ImageBlock({ el, full }: { el: Extract<Element, { type: "image" }>; full?: boolean }) {
  const { animate } = useR();
  const url = useAssetSrc(el.asset_id, el.src);
  const a = anim(el.animation, animate, 0, "fade");
  if (!url) return <Placeholder query={el.alt || el.query || ""} full={full ?? false} anim={a} />;
  return <img src={url} alt={el.alt ?? ""} className={cn(full ? "size-full" : "h-full max-h-[34cqw] w-full rounded-[0.9cqw]", el.fit === "contain" ? "object-contain" : "object-cover", a.className)} style={a.style} draggable={false} />;
}

function Placeholder({ query, full, anim: a }: { query: string; full?: boolean; anim?: ReturnType<typeof anim> }) {
  const { c } = useR();
  return (
    <div className={cn("relative overflow-hidden", full ? "size-full" : "h-full min-h-[18cqw] rounded-[0.9cqw]", a?.className)} style={{ background: `linear-gradient(140deg, ${c.panel}, ${c.line})`, ...(a?.style ?? {}) }}>
      <div className="absolute -bottom-[25%] -right-[12%] size-[70%] rounded-full opacity-90" style={{ background: c.accent }} />
      <div className="absolute -bottom-[35%] right-[22%] size-[45%] rounded-full opacity-40" style={{ background: c.primary }} />
      <div className="absolute left-[8%] top-[12%] h-[0.45cqw] w-[36%] rounded-full" style={{ background: c.line }} />
      <div className="absolute left-[8%] top-[20%] h-[0.45cqw] w-[22%] rounded-full" style={{ background: c.line }} />
      {query && <div className="absolute bottom-[1.4cqw] left-[1.6cqw] max-w-[60%] truncate font-mono text-[0.95cqw] uppercase tracking-wider" style={{ color: c.muted }}>{query}</div>}
    </div>
  );
}
