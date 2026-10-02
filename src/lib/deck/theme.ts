import type { Theme } from "@/lib/deck/schema";

/** Mirrors backend/app/services/export/layout.py::colors_for so web, PPTX and PDF look the same. */
export interface SlideColors {
  bg: string;
  fg: string;
  muted: string;
  accent: string;
  panel: string;
  line: string;
  primary: string;
  secondary: string;
  dark: boolean;
}

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((c) => c + c).join("") : s.padEnd(6, "0");
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return "#" + x.map((v, i) => Math.round(v + ((y[i] ?? 0) - v) * t).toString(16).padStart(2, "0")).join("");
}

export function isDark(hex: string): boolean {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
}

export function slideColors(theme: Theme, background: string | undefined): SlideColors {
  const p = theme.palette;
  const style = theme.style;
  let kind = background ?? "default";
  if (kind === "default" && style === "premium") kind = "inverse";
  if (kind === "image") kind = "inverse";
  if (kind === "inverse") {
    const bg = style === "executive" ? mix(p.text, p.secondary, 0.3) : p.secondary;
    const fg = "#FFFFFF";
    return { bg, fg, muted: mix(fg, bg, 0.4), accent: p.accent, panel: mix(bg, fg, 0.08), line: mix(bg, fg, 0.18), primary: p.primary, secondary: p.secondary, dark: true };
  }
  if (kind === "brand") {
    const bg = p.primary;
    const fg = "#FFFFFF";
    return { bg, fg, muted: mix(fg, bg, 0.3), accent: p.accent, panel: mix(bg, fg, 0.12), line: mix(bg, fg, 0.25), primary: p.primary, secondary: p.secondary, dark: true };
  }
  const bg = style === "editorial" ? p.surface : p.background;
  const fg = p.text;
  const accent = style === "editorial" ? p.accent : p.primary;
  return { bg, fg, muted: p.muted, accent, panel: mix(bg, p.secondary, 0.06), line: mix(bg, fg, 0.14), primary: p.primary, secondary: p.secondary, dark: isDark(bg) };
}

export function headingClass(theme: Theme): string {
  return theme.style === "premium" || theme.style === "editorial" ? "font-serif font-normal tracking-[-0.01em]" : "font-semibold tracking-[-0.025em]";
}

export const STYLE_INFO: Record<Theme["style"], { label: string; blurb: string }> = {
  executive: { label: "Executive", blurb: "Crisp, white and data-forward. Built for boardrooms." },
  premium: { label: "Premium", blurb: "Deep brand surfaces, serif headlines, gold accents." },
  modern: { label: "Modern", blurb: "Bold brand color, confident sans-serif, high contrast." },
  editorial: { label: "Editorial", blurb: "Warm paper tones and magazine-style typography." },
};
