import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowLeft, ArrowUp, Download, Loader2, Plus, RefreshCw, Save, Share2, ShieldCheck, Sparkles, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShareDialog } from "@/components/share-dialog";
import { CompliancePill, money } from "@/components/shared";
import { api } from "@/lib/api/client";
import { runExport, useInvalidate, useProposal } from "@/lib/api/hooks";
import type { ProposalBlock, ProposalSection } from "@/lib/api/types";
import { normalizeTheme, newId } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proposals/$id")({
  head: () => ({ meta: [{ title: "Proposal — Enterprise AI" }] }),
  component: ProposalEditor,
});

const ACTIONS = ["Make more persuasive", "Make more executive", "Reduce text", "Add visual storytelling", "Improve executive summary", "Strengthen value proposition", "Add roadmap", "Add case study", "Create pricing table", "Rewrite for this client"];
const ADDABLE: [string, string][] = [["executive_summary", "Executive Summary"], ["about_us", "About Us"], ["challenges", "Challenges"], ["solution", "Proposed Solution"], ["architecture", "Architecture"], ["timeline", "Timeline"], ["team", "Team"], ["case_studies", "Case Studies"], ["commercial", "Commercial Proposal"], ["outcomes", "Expected Outcomes"], ["next_steps", "Next Steps"], ["custom", "Custom section"]];
const STATUSES: [string, string][] = [["draft", "Draft"], ["internal_review", "Internal Review"], ["ready", "Ready"], ["sent", "Sent"], ["won", "Won"], ["lost", "Lost"]];

function ProposalEditor() {
  const { id } = Route.useParams();
  const { data: p, isLoading, refetch } = useProposal(id);
  const invalidate = useInvalidate();
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [share, setShare] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    if (p?.status === "generating") {
      const t = setTimeout(() => void refetch(), 1500);
      return () => clearTimeout(t);
    }
    if (p && !loaded.current) {
      loaded.current = true;
      setSections(p.schema.sections ?? []);
    }
    return undefined;
  }, [p, refetch]);

  if (isLoading || !p) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin" /></div>;
  if (p.status === "generating") return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="animate-spin" />Generating proposal…</div></div>;
  const theme = normalizeTheme(p.schema.theme);
  const creative = !!p.schema.creative_mode;
  const mutate = (fn: (s: ProposalSection[]) => ProposalSection[]) => { setSections(fn); setDirty(true); };
  const current = sections[sel];

  const save = async () => {
    setBusy("save");
    try {
      await api(`/proposals/${id}`, { method: "PATCH", body: { sections } });
      setDirty(false);
      void invalidate("proposals", "proposal");
      toast.success("Proposal saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  };
  const ai = async (command: string) => {
    if (!current) return;
    setBusy(command);
    try {
      const r = await api<{ section: ProposalSection; explanation: string }>(`/proposals/${id}/sections/ai-edit`, { body: { section: current, command } });
      mutate((s) => s.map((x, i) => (i === sel ? r.section : x)));
      setLog((l) => [`${command}: ${r.explanation}`, ...l].slice(0, 6));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
  };
  const setStatus = async (status: string) => {
    await api(`/proposals/${id}`, { method: "PATCH", body: { status } });
    void invalidate("proposals", "proposal");
    toast.success(`Status: ${STATUSES.find(([k]) => k === status)?.[1] ?? status}`);
  };
  const setCreative = async (on: boolean) => {
    await api(`/proposals/${id}`, { method: "PATCH", body: { creative_mode: on } });
    void refetch();
  };

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-4">
        <Button variant="ghost" size="sm" asChild><Link to="/proposals"><ArrowLeft />Proposals</Link></Button>
        <div className="truncate text-[14px] font-medium">{p.title} <span className="text-muted-foreground">· {p.client} · {money(p.value, p.currency)}</span></div>
        <span className="text-[12px] text-muted-foreground">{dirty ? "Unsaved changes" : ""}</span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={p.status} onValueChange={(v) => void setStatus(v)}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setShare(true)}><Share2 />Share</Button>
          <Button variant="ghost" size="sm" disabled={busy === "pdf"} onClick={async () => { setBusy("pdf"); try { if (dirty) await save(); await runExport(`/proposals/${id}/export`, {}, `${p.client}.pdf`); } catch (e) { toast.error((e as Error).message); } setBusy(null); }}>{busy === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}Export PDF</Button>
          <Button size="sm" onClick={() => void save()} disabled={!dirty || busy === "save"}><Save />Save</Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <aside className="w-[250px] shrink-0 overflow-y-auto border-r bg-sidebar p-3">
          <div className="eyebrow mb-2 px-1">Sections</div>
          <div className="space-y-0.5">
            {sections.map((s, i) => (
              <div key={s.id} className={cn("group flex items-center gap-1 rounded-md px-2 py-1.5 text-[13px]", i === sel ? "bg-sidebar-accent font-medium" : "hover:bg-sidebar-accent/60")}>
                <button onClick={() => { setSel(i); document.getElementById(`sec-${s.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="flex min-w-0 flex-1 items-center gap-2 text-left"><span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span><span className="truncate">{s.title}</span></button>
                <div className="hidden items-center group-hover:flex">
                  <button aria-label="Up" onClick={() => i > 0 && mutate((x) => { const y = [...x]; [y[i - 1], y[i]] = [y[i] as ProposalSection, y[i - 1] as ProposalSection]; return y; })}><ArrowUp className="size-3" /></button>
                  <button aria-label="Down" onClick={() => i < sections.length - 1 && mutate((x) => { const y = [...x]; [y[i + 1], y[i]] = [y[i] as ProposalSection, y[i + 1] as ProposalSection]; return y; })}><ArrowDown className="size-3" /></button>
                  <button aria-label="Delete" onClick={() => { mutate((x) => x.filter((_, j) => j !== i)); setSel(Math.max(0, sel - (i <= sel ? 1 : 0))); }}><Trash2 className="size-3 text-destructive" /></button>
                </div>
              </div>
            ))}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="mt-3 w-full"><Plus />Add section</Button></DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">{ADDABLE.map(([k, l]) => <DropdownMenuItem key={k} onClick={() => { mutate((x) => [...x.slice(0, sel + 1), { id: newId(), kind: k, title: l, blocks: [{ type: "paragraph", text: "Write or regenerate this section with AI." }] }, ...x.slice(sel + 1)]); setSel(sel + 1); }}>{l}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto bg-muted/30 px-10 py-10">
          <article className="mx-auto max-w-[820px] overflow-hidden rounded-lg bg-card shadow-slide">
            <header className="relative overflow-hidden px-14 py-16" style={{ background: theme.palette.secondary, color: "#fff" }}>
              <div className="absolute -right-24 -top-24 size-80 rounded-full opacity-20" style={{ background: theme.palette.accent }} />
              <div className="flex items-center gap-2 text-[12px] font-semibold tracking-[0.14em]"><span className="size-3 rounded-sm" style={{ background: theme.palette.accent }} />{theme.logo_text}</div>
              <div className="mt-16 font-mono text-[11px] uppercase tracking-[0.18em] opacity-70">Proposal for {p.client}</div>
              <h1 className="mt-3 max-w-xl font-serif text-[46px] leading-[1.04]">{p.title}</h1>
              <p className="mt-3 text-[14px] opacity-75">{p.schema.subtitle}</p>
            </header>
            <div className="divide-y px-14">
              {sections.filter((s) => s.kind !== "cover").map((s) => {
                const idx = sections.indexOf(s);
                return (
                  <section key={s.id} id={`sec-${s.id}`} onClick={() => setSel(idx)} className={cn("scroll-mt-6 py-10 transition-colors", idx === sel && "relative before:absolute before:-left-14 before:top-10 before:h-8 before:w-1 before:rounded-r before:bg-brand")}>
                    <div className="font-mono text-[11px] tracking-[0.14em]" style={{ color: theme.palette.primary }}>{String(idx + 1).padStart(2, "0")}</div>
                    <h2 contentEditable suppressContentEditableWarning onBlur={(e) => { const t = e.currentTarget.textContent ?? ""; if (t !== s.title) mutate((x) => x.map((y) => (y.id === s.id ? { ...y, title: t } : y))); }} className="mt-1 font-serif text-[30px] leading-tight outline-none">{s.title}</h2>
                    <div className="mt-5 space-y-5">{s.blocks.map((b, bi) => <Block key={bi} b={b} primary={theme.palette.primary} accent={theme.palette.accent} onText={(t) => mutate((x) => x.map((y) => (y.id === s.id ? { ...y, blocks: y.blocks.map((bb, j) => (j === bi ? { ...bb, text: t } : bb)) } : y)))} />)}</div>
                  </section>
                );
              })}
            </div>
          </article>
        </main>

        <aside className="w-[310px] shrink-0 overflow-y-auto border-l bg-background p-4">
          <div className="surface p-4">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2 text-[13px] font-medium"><ShieldCheck className="size-4" />Brand Lock: {creative ? "OFF" : "ON"}</div><Switch checked={!creative} onCheckedChange={(v) => void setCreative(!v)} /></div>
            <CompliancePill className="mt-3" score={p.schema.compliance?.score ?? 100} />
            <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">{(p.schema.compliance?.checks ?? []).map((c) => <li key={c.label}>✓ {c.label}</li>)}</ul>
            <div className="mt-3 text-[11.5px] text-muted-foreground">{creative ? "Creative Mode: the AI has more design freedom within the brand system." : "Approved logo, colors, fonts, templates and visual style are enforced."}</div>
          </div>
          <div className="mt-5">
            <div className="eyebrow mb-2 flex items-center gap-1.5"><Sparkles className="size-3 text-brand" />Proposal AI assistant</div>
            <div className="mb-2 truncate text-[12px] text-muted-foreground">Applies to: <span className="font-medium text-foreground">{current?.title}</span></div>
            <div className="grid gap-1.5">
              <button onClick={() => void ai("Regenerate this section")} disabled={!!busy} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-[12.5px] hover:bg-accent disabled:opacity-50">{busy === "Regenerate this section" ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}Regenerate section</button>
              {ACTIONS.map((a) => <button key={a} onClick={() => void ai(a)} disabled={!!busy} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-left text-[12.5px] hover:bg-accent disabled:opacity-50">{busy === a ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3 text-brand" />}{a}</button>)}
            </div>
            {log.length > 0 && <div className="mt-4 space-y-1.5">{log.map((l, i) => <div key={i} className="rounded-md bg-muted/40 p-2 text-[11.5px] text-muted-foreground">{l}</div>)}</div>}
          </div>
          {p.schema.sources && p.schema.sources.length > 0 && <div className="mt-5"><div className="eyebrow mb-2">Company knowledge used</div><ul className="space-y-1 text-[12px] text-muted-foreground">{p.schema.sources.map((s) => <li key={s}>• {s}</li>)}</ul></div>}
        </aside>
      </div>
      <ShareDialog kind="proposals" id={id} title={p.title} open={share} onOpenChange={setShare} />
    </div>
  );
}

function Block({ b, primary, accent, onText }: { b: ProposalBlock; primary: string; accent: string; onText: (t: string) => void }) {
  const items = (b["items"] as unknown[] | undefined) ?? [];
  switch (b.type) {
    case "paragraph":
      return <p contentEditable suppressContentEditableWarning onBlur={(e) => onText(e.currentTarget.textContent ?? "")} className="text-[15px] leading-relaxed outline-none focus:bg-muted/40">{String(b["text"] ?? "")}</p>;
    case "bullets":
      return <ul className="space-y-2">{(items as string[]).map((t, i) => <li key={i} className="flex gap-3 text-[14.5px]"><span className="mt-2 size-1.5 shrink-0 rounded-full" style={{ background: primary }} />{t}</li>)}</ul>;
    case "metrics":
      return <div className="grid grid-cols-3 gap-4">{(items as { value: string; label: string }[]).map((m, i) => <div key={i} className="border-t-2 pt-3" style={{ borderColor: primary }}><div className="font-mono text-[28px] font-medium">{m.value}</div><div className="text-[12.5px] text-muted-foreground">{m.label}</div></div>)}</div>;
    case "callout":
      return <div className="rounded-lg border-l-4 bg-muted/40 p-5" style={{ borderColor: accent }}><div className="text-[14px] font-semibold">{String(b["title"] ?? "")}</div><div className="mt-1 text-[14px] text-muted-foreground">{String(b["text"] ?? "")}</div></div>;
    case "quote":
      return <blockquote className="border-l-2 pl-4 font-serif text-[20px] italic" style={{ borderColor: accent }}>“{String(b["text"])}” <span className="not-italic text-[13px] text-muted-foreground">— {String(b["attribution"] ?? "")}</span></blockquote>;
    case "table": {
      const cols = (b["columns"] as string[]) ?? [];
      const rows = (b["rows"] as string[][]) ?? [];
      return <table className="w-full text-[13.5px]"><thead><tr className="border-b-2" style={{ borderColor: primary }}>{cols.map((c) => <th key={c} className="py-2 pr-4 text-left font-semibold">{c}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={i} className="border-b">{r.map((c, j) => <td key={j} className="py-2 pr-4">{c}</td>)}</tr>)}</tbody></table>;
    }
    case "timeline":
      return <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0,1fr))` }}>{(items as { label: string; title: string; description?: string }[]).map((t, i) => <div key={i} className="border-t-2 pt-3" style={{ borderColor: i === 0 ? primary : "var(--border)" }}><div className="font-mono text-[11px] text-muted-foreground">{t.label}</div><div className="mt-1 text-[14px] font-medium">{t.title}</div>{t.description && <div className="text-[12px] text-muted-foreground">{t.description}</div>}</div>)}</div>;
    case "pricing": {
      const lines = (b["lines"] as { item: string; description?: string; amount: number }[]) ?? [];
      const total = lines.reduce((a, l) => a + Number(l.amount || 0), 0);
      return (
        <div className="overflow-hidden rounded-lg border">
          {lines.map((l, i) => <div key={i} className="flex justify-between border-b px-5 py-3 text-[14px]"><span>{l.item}</span><span className="font-mono">{money(l.amount, String(b["currency"] ?? "USD"))}</span></div>)}
          <div className="flex justify-between px-5 py-3 text-[15px] font-semibold" style={{ background: `${primary}12` }}><span>Total investment</span><span className="font-mono">{money(total, String(b["currency"] ?? "USD"))}</span></div>
          {b["notes"] ? <div className="px-5 py-2.5 text-[12px] text-muted-foreground">{String(b["notes"])}</div> : null}
        </div>
      );
    }
    case "case_study":
      return <div className="rounded-lg border p-5"><div className="eyebrow">Case study</div><div className="mt-1 text-[16px] font-semibold">{String(b["client"])}</div><div className="mt-2 text-[13.5px] text-muted-foreground"><b className="text-foreground">Challenge:</b> {String(b["challenge"] ?? "")}<br /><b className="text-foreground">Solution:</b> {String(b["solution"] ?? "")}</div><ul className="mt-3 grid gap-1.5 sm:grid-cols-2">{((b["results"] as string[]) ?? []).map((r) => <li key={r} className="text-[13.5px] font-medium" style={{ color: primary }}>✓ {r}</li>)}</ul></div>;
    case "team":
      return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{((b["members"] as { name: string; role: string }[]) ?? []).map((m) => <div key={m.name} className="rounded-lg border p-3"><div className="grid size-10 place-items-center rounded-full bg-muted text-[13px] font-semibold">{m.name.split(" ").map((x) => x[0]).join("").slice(0, 2)}</div><div className="mt-2 text-[13.5px] font-medium">{m.name}</div><div className="text-[12px] text-muted-foreground">{m.role}</div></div>)}</div>;
    case "diagram": {
      const nodes = ((b["diagram"] as { nodes?: { id: string; label: string; description?: string }[] })?.nodes) ?? [];
      return <div className="flex items-stretch gap-2">{nodes.map((n, i) => <div key={n.id} className="flex flex-1 items-center gap-2"><div className="flex-1 rounded-lg border bg-muted/30 p-3"><div className="text-[13.5px] font-medium">{n.label}</div><div className="text-[11.5px] text-muted-foreground">{n.description}</div></div>{i < nodes.length - 1 && <span style={{ color: primary }}>→</span>}</div>)}</div>;
    }
    default:
      return null;
  }
}
