import type { ReactNode } from "react";
import { Check, CircleDashed, Loader2, ShieldCheck, X } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { cn } from "@/lib/utils";
import { useBrandContext, useBrands } from "@/lib/api/hooks";
import type { AuditEntry, Job } from "@/lib/api/types";

// ---------------------------------------------------------------------------- formatting

export const STATUS_LABEL: Record<string, string> = {
  generating: "Generating",
  draft: "Draft",
  in_review: "In review",
  internal_review: "Internal Review",
  approved: "Approved",
  presented: "Presented",
  ready: "Ready",
  sent: "Sent",
  won: "Won",
  lost: "Lost",
  failed: "Failed",
  archived: "Archived",
  scheduled: "Scheduled",
  live: "Live",
  processing: "Processing",
  open: "Open",
  in_progress: "In progress",
  done: "Done",
  queued: "Queued",
};

const statusTone: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  generating: "bg-brand-soft text-brand",
  processing: "bg-brand-soft text-brand",
  queued: "bg-muted text-muted-foreground",
  in_review: "bg-warning-soft text-warning",
  internal_review: "bg-warning-soft text-warning",
  in_progress: "bg-warning-soft text-warning",
  approved: "bg-success-soft text-success",
  presented: "bg-brand-soft text-brand",
  ready: "bg-brand-soft text-brand",
  sent: "bg-brand-soft text-brand",
  scheduled: "bg-muted text-foreground",
  won: "bg-success-soft text-success",
  done: "bg-success-soft text-success",
  lost: "bg-destructive/10 text-destructive",
  failed: "bg-destructive/10 text-destructive",
  live: "bg-live/10 text-live",
};

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const key = status.toLowerCase().replace(/ /g, "_");
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 text-[11px] font-medium", statusTone[key] ?? "bg-muted text-muted-foreground", className)}>
      <span className={cn("size-1 rounded-full bg-current", (key === "generating" || key === "live" || key === "processing") && "animate-pulse")} />
      {STATUS_LABEL[key] ?? status}
    </span>
  );
}

export function money(v: number | null | undefined, currency = "USD"): string {
  if (v == null) return "—";
  const abs = Math.abs(v);
  const sym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  if (abs >= 1e9) return `${sym}${(v / 1e9).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1e6) return `${sym}${(v / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1e3) return `${sym}${Math.round(v / 1e3)}K`;
  return `${sym}${v}`;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 7 * 86_400_000) return `${formatDistanceToNowStrict(d)} ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });
}

export function duration(sec: number | null | undefined): string {
  if (!sec) return "—";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m} min`;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function describeActivity(a: AuditEntry): string {
  const title = (a.meta["title"] as string | undefined) ?? (a.meta["name"] as string | undefined) ?? (a.meta["filename"] as string | undefined) ?? (a.meta["client"] as string | undefined);
  const map: Record<string, string> = {
    "presentation.create": "created a presentation",
    "presentation.generate": "generated a presentation with AI",
    "presentation.update": "edited a presentation",
    "presentation.export": `exported a presentation${a.meta["format"] ? ` as ${String(a.meta["format"]).toUpperCase()}` : ""}`,
    "presentation.delete": "deleted a presentation",
    "presentation.duplicate": "duplicated a presentation",
    "proposal.generate": "generated a proposal",
    "proposal.create": "created a proposal",
    "proposal.update": "updated a proposal",
    "proposal.export": "exported a proposal",
    "meeting.create": "scheduled a meeting",
    "meeting.start": "started a meeting",
    "meeting.end": "ended a meeting",
    "meeting.generate_deck": "turned a meeting into a deck",
    "brand.update": "updated the brand system",
    "document.upload": "added a document to the AI Library",
    "asset.upload": "uploaded an asset",
    "share.create": "created a share link",
    "share.view": "share link was viewed",
    "team.invite": "invited a teammate",
    "template.create": "saved a template",
  };
  const base = map[a.action] ?? a.action.replace(/[._]/g, " ");
  return title ? `${base} · ${title}` : base;
}

// ---------------------------------------------------------------------------- generation progress

/** Progress screen driven by a real backend job (status, % and step label). */
export function JobProgress({ title, job, steps, eyebrow }: { title: string; job: Job | null; steps: string[]; eyebrow?: string }) {
  const pct = job ? (job.status === "completed" ? 100 : job.progress) : 2;
  const stepIdx = job?.status === "completed" ? steps.length : Math.min(steps.length - 1, Math.floor((pct / 100) * steps.length));
  const current = job?.step;
  return (
    <div className="mx-auto w-full max-w-lg animate-rise">
      <div className="eyebrow">{eyebrow ?? "Brand system applied"}</div>
      <h2 className="mt-2 font-serif text-[40px] leading-tight">{title}</h2>
      <div className="mt-6 h-px w-full bg-border">
        <div className="h-px bg-foreground transition-all duration-700" style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <div className="mt-2 flex justify-between font-mono text-[11px] text-muted-foreground"><span>{current ?? "Queued"}</span><span>{pct}%</span></div>
      <ol className="mt-6 space-y-3">
        {steps.map((s, idx) => {
          const state = idx < stepIdx ? "done" : idx === stepIdx ? "active" : "todo";
          return (
            <li key={s} className={cn("flex items-center gap-3 text-[14px] transition-colors", state === "todo" && "text-subtle")}>
              <span className={cn("grid size-5 place-items-center rounded-full border", state === "done" && "border-foreground bg-foreground text-background", state === "active" && "border-brand text-brand")}>
                {state === "done" ? <Check className="size-3" /> : state === "active" ? <Loader2 className="size-3 animate-spin" /> : null}
              </span>
              {s}
            </li>
          );
        })}
      </ol>
      {job?.status === "failed" && <div className="mt-6 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-[13px] text-destructive">{job.error}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------- brand

export function BrandBadge({ className }: { className?: string }) {
  const { data } = useBrandContext();
  if (!data) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-[12px] shadow-card", className)}>
      <span className="flex -space-x-1">
        {data.colors.slice(0, 3).map((c) => <span key={c.hex} className="size-3 rounded-full ring-2 ring-card" style={{ background: c.hex }} />)}
      </span>
      Generated using <strong className="font-medium">{data.company_name}</strong> Brand System
    </span>
  );
}

/** "Using: Acme Corporation Brand ✓ Brand guidelines ✓ Logo …" — the company context the AI already has. */
export function UsingBrandPanel({ className, compact, brandId }: { className?: string; compact?: boolean; brandId?: string | null | undefined }) {
  const { data, isLoading } = useBrandContext();
  const { data: brands } = useBrands();
  if (isLoading || !data) return <div className={cn("surface h-40 animate-pulse", className)} />;
  const chosen = brandId ? brands?.find((b) => b.id === brandId) : undefined;
  const colors = chosen ? chosen.colors : data.colors;
  const brandName = chosen ? chosen.name : `${data.company_name} Brand`;
  const locked = chosen ? chosen.brand_lock : data.brand_lock;
  return (
    <div className={cn("surface overflow-hidden", className)}>
      <div className="flex items-center gap-3 border-b bg-muted/30 px-4 py-3">
        <span className="flex -space-x-1">
          {colors.slice(0, 4).map((c) => <span key={c.hex} className="size-4 rounded-full ring-2 ring-card" style={{ background: c.hex }} />)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="eyebrow">Using</div>
          <div className="truncate text-[13.5px] font-medium">{brandName}</div>
        </div>
        {locked && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10.5px] font-medium text-background">Brand Lock</span>}
      </div>
      <ul className={cn("grid gap-x-4 gap-y-2 p-4 text-[13px]", compact ? "grid-cols-2" : "grid-cols-1")}>
        {data.checks.map((c) => (
          <li key={c.label} className="flex items-center gap-2">
            {c.ok ? <Check className="size-3.5 text-success" /> : <CircleDashed className="size-3.5 text-subtle" />}
            <span className={cn(!c.ok && "text-muted-foreground")}>{c.label}</span>
            {c.count != null && <span className="ml-auto font-mono text-[11px] text-muted-foreground">{c.count}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CompliancePill({ score = 100, className }: { score?: number; className?: string }) {
  const ok = score >= 100;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium", ok ? "bg-success-soft text-success" : "bg-warning-soft text-warning", className)}>
      <ShieldCheck className="size-3.5" />
      {score}% Brand Compliant
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

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("h-8 rounded-md border px-3 text-[13px] transition-all", active ? "border-foreground bg-foreground text-background" : "bg-card hover:border-input hover:bg-accent", className)}
    >
      {children}
    </button>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="surface flex flex-col items-center px-6 py-14 text-center">
      <div className="grid size-11 place-items-center rounded-full border bg-muted/50"><Icon className="size-5 text-muted-foreground" /></div>
      <div className="mt-4 text-[15px] font-medium">{title}</div>
      {body && <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  return (
    <div className="surface flex items-center gap-3 border-destructive/30 p-4 text-[13px]">
      <X className="size-4 text-destructive" />
      <span className="flex-1">{error?.message ?? "Something went wrong."}</span>
      {onRetry && <button className="text-[13px] font-medium underline" onClick={onRetry}>Retry</button>}
    </div>
  );
}

export function Avatar({ name, className }: { name: string | null | undefined; className?: string }) {
  const ini = (name ?? "?").split(/\s+/).filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return <span className={cn("grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold text-foreground ring-2 ring-card", className)}>{ini}</span>;
}

