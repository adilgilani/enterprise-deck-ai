import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileSignature, Plus, Search } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, StatusPill, ago, money } from "@/components/shared";
import { useProposals } from "@/lib/api/hooks";
import { normalizeTheme } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proposals/")({
  head: () => ({ meta: [{ title: "Proposals — VYRA" }] }),
  component: ProposalsPage,
});

const FILTERS = [["all", "All"], ["draft", "Draft"], ["internal_review", "Internal Review"], ["ready", "Ready"], ["sent", "Sent"], ["won", "Won"], ["lost", "Lost"]] as const;

function ProposalsPage() {
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useProposals();
  const all = data ?? [];
  const items = all.filter((p) => (status === "all" || p.status === status) && (!q || `${p.title} ${p.client}`.toLowerCase().includes(q.toLowerCase())));
  const pipeline = all.filter((p) => ["draft", "internal_review", "ready", "sent"].includes(p.status)).reduce((a, p) => a + (p.value ?? 0), 0);
  const won = all.filter((p) => p.status === "won");
  const decided = all.filter((p) => p.status === "won" || p.status === "lost").length;

  return (
    <Page>
      <PageHeader title="Proposals" subtitle="Client-specific proposals, generated with your brand, services and case studies." actions={<Button asChild><Link to="/proposals/new"><Plus />Create proposal</Link></Button>} />
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[
          ["Open pipeline", money(pipeline)],
          ["Won", money(won.reduce((a, p) => a + (p.value ?? 0), 0))],
          ["Win rate", decided ? `${Math.round((won.length / decided) * 100)}%` : "—"],
          ["Proposals", String(all.length)],
        ].map(([l, v]) => <div key={l} className="surface p-5"><div className="text-[12.5px] text-muted-foreground">{l}</div><div className="mt-2 font-mono text-[28px] font-medium">{v}</div></div>)}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input className="h-8 pl-8" placeholder="Search client or title" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex flex-wrap rounded-md border bg-card p-0.5">
          {FILTERS.map(([k, l]) => <button key={k} onClick={() => setStatus(k)} className={cn("h-7 rounded px-2.5 text-[12.5px]", status === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
        </div>
      </div>
      {!isLoading && items.length === 0 && <EmptyState icon={FileSignature} title="No proposals" body="Generate a client proposal using your brand and company knowledge." action={<Button asChild><Link to="/proposals/new"><Plus />Create proposal</Link></Button>} />}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-lg bg-muted" />)}
        {items.map((p) => {
          const t = normalizeTheme(p.theme);
          return (
            <Link key={p.id} to="/proposals/$id" params={{ id: p.id }} className="surface surface-hover group flex flex-col overflow-hidden">
              <div className="relative h-24 px-5 py-4" style={{ background: t.palette.secondary, color: "#fff" }}>
                <div className="absolute -right-6 -top-10 size-32 rounded-full opacity-25" style={{ background: t.palette.accent }} />
                <div className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-70">Proposal for</div>
                <div className="mt-1 font-serif text-[24px] leading-tight">{p.client}</div>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-start justify-between gap-2"><div className="text-[14.5px] font-medium leading-snug">{p.title}</div><StatusPill status={p.status} /></div>
                <div className="mt-1 text-[12px] text-muted-foreground">{p.industry ?? "—"} · {p.section_count} sections</div>
                <div className="mt-auto flex items-end justify-between pt-5">
                  <div className="font-mono text-[20px] font-medium">{money(p.value, p.currency)}</div>
                  <div className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground"><Avatar name={p.author?.name} className="size-5" />{p.author?.name?.split(" ")[0]} · {ago(p.updated_at)}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}
