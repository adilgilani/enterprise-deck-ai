import { createContext, useContext, type CSSProperties, type ReactNode } from "react";
import type { BrandSystem } from "@/lib/brand-data";
import { cn } from "@/lib/utils";

const SERIFS = new Set(["Instrument Serif", "Fraunces", "Playfair Display", "Georgia"]);

const ScopeCtx = createContext<BrandSystem | null>(null);

/**
 * Re-skins every slide/document rendered inside it with a brand's palette and
 * fonts via CSS variables. Uses `display: contents` so it never affects layout.
 */
export function BrandScope({
  brand,
  children,
  className,
}: {
  brand: BrandSystem;
  children: ReactNode;
  className?: string;
}) {
  const style = {
    "--slide-a": brand.slide.a,
    "--slide-b": brand.slide.b,
    "--slide-c": brand.slide.c,
    "--slide-d": brand.slide.d,
    "--brand-serif": `"${brand.headingFont}", ${SERIFS.has(brand.headingFont) ? '"Instrument Serif", Georgia, serif' : '"Helvetica Neue", Helvetica, Arial, sans-serif'}`,
    "--brand-sans": `"${brand.bodyFont}", "Geist", system-ui, sans-serif`,
    "--brand-mono": `"${brand.dataFont}", "Geist Mono", ui-monospace, monospace`,
  } as CSSProperties;
  return (
    <ScopeCtx.Provider value={brand}>
      <div style={style} className={cn("contents", className)}>
        {children}
      </div>
    </ScopeCtx.Provider>
  );
}

export const useScopedBrand = () => useContext(ScopeCtx);

export function BrandMark({ brand, className }: { brand: BrandSystem; className?: string }) {
  if (brand.logos?.favicon) {
    return (
      <img
        src={brand.logos.favicon}
        alt={`${brand.name} mark`}
        className={cn("size-9 shrink-0 rounded-md object-contain", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-md text-[12px] font-semibold text-white",
        className,
      )}
      style={{ background: `linear-gradient(135deg, ${brand.slide.b}, ${brand.slide.a})` }}
    >
      {brand.initials}
    </div>
  );
}

/** The brand's logo for a given background; falls back to mark + name when none is uploaded. */
export function BrandLogo({
  brand,
  dark = false,
  className,
  fallbackClassName,
}: {
  brand: BrandSystem;
  dark?: boolean;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = dark ? (brand.logos?.reversed ?? brand.logos?.primary) : brand.logos?.primary;
  if (src)
    return (
      <img
        src={src}
        alt={`${brand.name} logo`}
        className={cn("w-auto object-contain", className)}
      />
    );
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold", fallbackClassName)}>
      <BrandMark brand={brand} className="size-[1.4em] text-[0.55em]" />
      {brand.name}
    </span>
  );
}
