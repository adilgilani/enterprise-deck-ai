import { useEffect, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/mock-data";

const statusTone: Record<string, string> = {
  Draft: "bg-muted text-muted-foreground",
  "In review": "bg-warning-soft text-warning",
  "Internal Review": "bg-warning-soft text-warning",
  Approved: "bg-success-soft text-success",
  Ready: "bg-brand-soft text-brand",
  Presented: "bg-brand-soft text-brand",
  Sent: "bg-brand-soft text-brand",
  Won: "bg-success-soft text-success",
  Lost: "bg-destructive/10 text-destructive",
  Restricted: "bg-destructive/10 text-destructive",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={cn("inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium", statusTone[status] ?? "bg-muted text-muted-foreground")}>
      <span className="size-1 rounded-full bg-current" />
      {status}
    </span>
  );
}

/** Animated multi-step AI progress. Swap the timer for streamed server events later. */
export function GenerationSteps({ title, steps, onDone, interval = 700 }: { title: string; steps: string[]; onDone?: () => void; interval?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (i >= steps.length) { const t = setTimeout(() => onDone?.(), 500); return () => clearTimeout(t); }
    const t = setTimeout(() => setI((x) => x + 1), interval);
    return () => clearTimeout(t);
  }, [i, steps.length, interval, onDone]);
  const pct = Math.round((i / steps.length) * 100);
  return (
    <div className="mx-auto w-full max-w-lg animate-rise">
      <div className="eyebrow">Acme brand system applied</div>
      <h2 className="mt-2 font-serif text-[40px] leading-tight">{title}</h2>
      <div className="mt-6 h-px w-full bg-border">
        <div className="h-px bg-foreground transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <ol className="mt-6 space-y-3">
        {steps.map((s, idx) => {
          const state = idx < i ? "done" : idx === i ? "active" : "todo";
          return (
            <li key={s} className={cn("flex items-center gap-3 text-[14px] transition-colors", state === "todo" && "text-subtle")}>
              <span className={cn("grid size-5 place-items-center rounded-full border", state === "done" && "border-foreground bg-foreground text-background", state === "active" && "border-brand text-brand")}>
                {state === "done" ? <Check className="size-3" /> : state === "active" ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
              {s}
              {state === "done" && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{(0.4 + idx * 0.3).toFixed(1)}s</span>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function BrandBadge({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[12px] shadow-card", className)}>
      <span className="flex -space-x-1">
        {brand.colors.slice(0, 3).map((c) => (
          <span key={c.hex} className="size-3 rounded-full ring-2 ring-card" style={{ background: c.hex }} />
        ))}
      </span>
      Generated using <strong className="font-medium">{brand.name}</strong> Brand System
    </span>
  );
}

export function CompliancePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-medium text-success">
      <ShieldCheck className="size-3.5" />100% Brand Compliant
    </span>
  );
}

export function Score({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[13px]">
        <span>{label}</span>
        <span className="font-mono text-[12px] text-muted-foreground">{value}</span>
      </div>
      <div className="mt-1.5 h-1 rounded-full bg-muted">
        <div className={cn("h-1 rounded-full", value > 85 ? "bg-success" : value > 70 ? "bg-brand" : "bg-warning")} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-8 rounded-md border px-3 text-[13px] transition-all",
        active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-input hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}
