import { useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { Check, Plus, ShieldCheck } from "lucide-react";
import { SlideRenderer } from "@/components/slide";
import { useBrands } from "@/lib/api/hooks";
import { brandToTheme } from "@/lib/deck/brand-theme";
import { cn } from "@/lib/utils";

/**
 * "Choose your brand guidelines" — clickable cards for every Brand System defined in Brand Studio.
 * Selects the workspace default on load so generation always runs on a brand.
 */
export function BrandChooser({ value, onChange, title = "Choose your brand guidelines" }: { value: string | null; onChange: (id: string) => void; title?: string }) {
  const { data: brands, isLoading } = useBrands();

  useEffect(() => {
    if (!value && brands?.length) {
      const def = brands.find((b) => b.is_default) ?? brands[0];
      if (def) onChange(def.id);
    }
  }, [brands, value, onChange]);

  return (
    <section>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <div className="text-[12.5px] font-medium text-muted-foreground">{title}</div>
          <div className="text-[12px] text-subtle">From Brand Studio — colors, fonts, logo, tone of voice and visual rules are applied automatically.</div>
        </div>
        <Link to="/brand" className="text-[12.5px] text-muted-foreground hover:text-foreground">Manage brands →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[150px] animate-pulse rounded-lg bg-muted" />)}
        {brands?.map((b) => {
          const selected = b.id === value;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => onChange(b.id)}
              aria-pressed={selected}
              className={cn("surface group relative overflow-hidden text-left transition-all", selected ? "ring-2 ring-foreground" : "surface-hover opacity-90 hover:opacity-100")}
            >
              <div className="pointer-events-none">
                <SlideRenderer slide={{ id: b.id, layout: "hero", title: b.name.replace(/ Brand$/, ""), subtitle: b.approved_messaging[0] ?? "", background: "inverse", elements: [] }} theme={brandToTheme(b)} />
              </div>
              <div className="flex h-1.5">{b.colors.slice(0, 7).map((c, i) => <div key={i} className="flex-1" style={{ background: c.hex }} />)}</div>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{b.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] capitalize text-muted-foreground">
                    {b.default_style}
                    {b.brand_lock && <><span>·</span><ShieldCheck className="size-3 text-success" />Locked</>}
                    {b.is_default && <><span>·</span>default</>}
                  </div>
                </div>
              </div>
              {selected && <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-foreground text-background shadow"><Check className="size-3.5" /></span>}
            </button>
          );
        })}
        <Link to="/brand" className="flex min-h-[150px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-[12.5px] text-muted-foreground hover:bg-muted/40 hover:text-foreground">
          <Plus className="size-4" />New brand
        </Link>
      </div>
    </section>
  );
}
