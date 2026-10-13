import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { SlideView } from "@/components/slide";
import { TemplateCard } from "@/components/templates";
import { builtinDeckTemplates, isSlideTemplate } from "@/lib/brand-data";
import type { Theme } from "@/lib/mock-data";
import { useActiveBrand, useDocTemplates } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Resolves a deck template id (brand upload or built-in layout) to what generation needs. */
export function useDeckTemplate(id: string | undefined) {
  const all = useDocTemplates();
  const uploaded = all.find((t) => t.id === id);
  const builtin = builtinDeckTemplates.find((t) => t.id === id);
  const theme = (uploaded?.theme ?? builtin?.theme ?? "brand") as Theme;
  return {
    name: uploaded?.name ?? builtin?.name ?? "Brand default",
    theme,
    format: uploaded?.format,
    sourceFile: uploaded?.sourceFile,
    /** Template-based decks use the brand's own presentation-template layouts. */
    layout: (theme === "signature" ? "signature" : "classic") as "signature" | "classic",
  };
}

/** The active brand's default deck template (falls back to the first built-in layout). */
export function useBrandDefaultDeckTemplate() {
  const brand = useActiveBrand();
  const all = useDocTemplates();
  return (
    all.find((t) => t.brandId === brand.id && t.isDefault && isSlideTemplate(t))?.id ??
    builtinDeckTemplates[0]!.id
  );
}

/** The active brand's presentation/PowerPoint templates plus built-in layouts. */
export function DeckTemplateGrid({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const brand = useActiveBrand();
  const all = useDocTemplates();
  const brandDecks = useMemo(
    () => all.filter((t) => t.brandId === brand.id && isSlideTemplate(t)),
    [all, brand.id],
  );
  return (
    <div className="space-y-8">
      <section>
        <div className="eyebrow mb-3">{brand.name} templates</div>
        {brandDecks.length ? (
          <div className="grid gap-x-5 gap-y-6 sm:grid-cols-2">
            {brandDecks.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                selected={selected === t.id}
                onSelect={() => onSelect(t.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-6 text-[13px] text-muted-foreground">
            No presentation templates uploaded for {brand.name}.{" "}
            <Link to="/proposals" search={{ tab: "templates" }} className="underline">
              Upload one
            </Link>{" "}
            or use a layout below.
          </div>
        )}
      </section>
      <section>
        <div className="eyebrow mb-3">Layouts</div>
        <div className="grid gap-4 sm:grid-cols-3">
          {builtinDeckTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              aria-pressed={selected === t.id}
              className={cn(
                "surface p-2 text-left transition-all",
                selected === t.id ? "ring-2 ring-brand" : "surface-hover",
              )}
            >
              <div className="overflow-hidden rounded">
                <SlideView kind="title" theme={t.theme} title={t.name} />
              </div>
              <div className="px-1 pb-1 pt-2">
                <div className="text-[13px] font-medium">{t.name}</div>
                <div className="text-[11.5px] text-muted-foreground">{t.blurb}</div>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
