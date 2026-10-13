// Helpers that let any slide render in any layout: structured template slides
// degrade to classic layouts, and classic slides upgrade to template layouts.
import type { Slide, SlideItem, SlideKind } from "@/lib/mock-data";

const split = (s: string) => {
  const [title, ...rest] = s.split(" — ");
  return rest.length ? { title: title!, text: rest.join(" — ") } : { text: s };
};

export function itemsOf(s: Slide): SlideItem[] {
  if (s.items?.length) return s.items;
  if (s.metrics?.length) return s.metrics.map((m) => ({ value: m.value, title: m.label }));
  if (s.table?.rows.length)
    return s.table.rows.map((r) => ({ title: r[0], text: r.slice(1).join(" · ") }));
  return (s.bullets ?? []).map(split);
}

export function tableOf(s: Slide): NonNullable<Slide["table"]> {
  if (s.table) return s.table;
  const items = itemsOf(s);
  return {
    head: ["Item", "Detail"],
    rows: items.map((i) => [i.title ?? i.value ?? "", i.text ?? ""]),
  };
}

const label = (i: SlideItem) => [i.title, i.text].filter(Boolean).join(" — ");

/** Template-only layouts mapped to the closest classic layout (for ink / light / brand / editorial themes). */
export function toClassic(s: Slide): Slide {
  const items = itemsOf(s);
  const base = { ...s, subtitle: s.subtitle ?? s.lead };
  const map: Partial<Record<SlideKind, () => Slide>> = {
    cover: () => ({ ...base, kind: "title" }),
    closing: () => ({ ...base, kind: "grid", bullets: items.map((i) => i.title ?? i.text ?? "") }),
    overview: () => ({ ...base, kind: "split", bullets: items.map(label) }),
    cards: () => ({ ...base, kind: "split", bullets: items.map((i) => i.title ?? i.text ?? "") }),
    steps: () => ({ ...base, kind: "agenda", bullets: items.map((i) => i.title ?? i.text ?? "") }),
    table: () => ({
      ...base,
      kind: "list",
      bullets: tableOf(s).rows.map((r) => `${r[0]} — ${r.slice(1).join(" · ")}`),
    }),
    "dark-cards": () => ({
      ...base,
      kind: "metrics",
      metrics: items.slice(0, 3).map((i) => ({
        value: i.value ?? i.title ?? "",
        label: i.value ? (i.title ?? i.text ?? "") : (i.text ?? ""),
      })),
    }),
    groups: () => ({
      ...base,
      kind: "list",
      bullets: items.map((i) => `${i.title ?? ""} — ${(i.text ?? "").split("\n").join("; ")}`),
    }),
  };
  return map[s.kind]?.() ?? s;
}

/** Classic layouts mapped to the closest template layout (for the "signature" theme). */
export function toSignatureKind(k: SlideKind): SlideKind {
  const map: Partial<Record<SlideKind, SlideKind>> = {
    title: "cover",
    agenda: "steps",
    timeline: "steps",
    split: "cards",
    grid: "cards",
    quote: "cards",
    metrics: "dark-cards",
    chart: "overview",
    comparison: "table",
    list: "table",
  };
  return map[k] ?? k;
}

export const signatureLayouts: { id: string; name: string; kind: SlideKind }[] = [
  { id: "sig-cover", name: "Cover", kind: "cover" },
  { id: "sig-overview", name: "Chart + list", kind: "overview" },
  { id: "sig-cards", name: "Cards", kind: "cards" },
  { id: "sig-steps", name: "Numbered steps", kind: "steps" },
  { id: "sig-table", name: "Table", kind: "table" },
  { id: "sig-dark", name: "Dark cards", kind: "dark-cards" },
  { id: "sig-groups", name: "Grouped lists", kind: "groups" },
  { id: "sig-closing", name: "Closing", kind: "closing" },
];
