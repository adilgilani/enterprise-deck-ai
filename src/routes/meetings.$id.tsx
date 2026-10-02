import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Circle, Copy, Download, HelpCircle, Loader2, Pencil, Presentation, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShareDialog } from "@/components/share-dialog";
import { Avatar, StatusPill, duration } from "@/components/shared";
import { api } from "@/lib/api/client";
import { runExport, useInvalidate, useMeeting, useTranscript, waitForJob } from "@/lib/api/hooks";
import type { ActionItem, Job, MeetingFull } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings/$id")({
  head: () => ({ meta: [{ title: "Meeting notes — Enterprise AI" }] }),
  component: MeetingNotes,
});

function toMarkdown(m: MeetingFull): string {
  const i = m.intelligence;
  const lines = [`# ${m.title}`, "", `## Executive Summary`, i.summary ?? "", "", "## Key Decisions", ...(i.decisions ?? []).map((d) => `- ${d.text}`), "", "## Action Items", ...m.action_items.map((a) => `- [${a.status === "done" ? "x" : " "}] ${a.title} — ${a.owner ?? "Unassigned"}${a.deadline ? ` (due ${a.deadline})` : ""}`), "", "## Open Questions", ...(i.questions ?? []).map((q) => `- ${q.text}`), "", "## Risks", ...(i.risks ?? []).map((r) => `- ${r.text}`), "", "## Important Numbers", ...(i.numbers ?? []).map((n) => `- ${n.value} — ${n.label}`), "", "## Next Steps", ...(i.next_steps ?? []).map((s) => `- ${s}`)];
  return lines.join("\n");
}

function MeetingNotes() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data: m, isLoading } = useMeeting(id, false);
  const { data: transcript } = useTranscript(id);
  const invalidate = useInvalidate();
  const [share, setShare] = useState(false);
  const [editing, setEditing] = useState(false);
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (isLoading || !m) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin" /></div>;
  if (m.status === "processing") return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="animate-spin" />Processing meeting…</div></div>;
  const i = m.intelligence;

  const toggle = async (a: ActionItem) => {
    await api(`/action-items/${a.id}`, { method: "PATCH", body: { status: a.status === "done" ? "open" : "done" } });
    void invalidate("meeting", "action-items");
  };
  const saveSummary = async () => {
    await api(`/meetings/${id}`, { method: "PATCH", body: { intelligence: { summary } } });
    setEditing(false);
    void invalidate("meeting");
    toast.success("Notes updated");
  };
  const createDeck = async () => {
    setBusy("deck");
    try {
      const job = await api<Job>(`/meetings/${id}/generate-deck`, { method: "POST" });
      const done = await waitForJob(job.id);
      void navigate({ to: "/editor/$id", params: { id: String(done.result["presentation_id"]) } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  return (
    <Page className="max-w-[1100px]">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-4"><Link to="/meetings"><ArrowLeft />Meetings</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Meeting notes · {m.started_at ? new Date(m.started_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}</div>
          <h1 className="mt-2 font-serif text-[44px] leading-tight">{m.title}</h1>
          <div className="mt-2 flex items-center gap-3 text-[13px] text-muted-foreground">
            <StatusPill status={m.status} /><span>{duration(m.duration_seconds)}</span>
            <div className="flex -space-x-1.5">{m.participants.map((p) => <Avatar key={p.id} name={p.name} />)}</div>
            <span>{m.participants.map((p) => p.name).join(", ")}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(toMarkdown(m)).then(() => toast.success("Notes copied as Markdown"))}><Copy />Copy</Button>
          <Button variant="outline" size="sm" onClick={() => setShare(true)}><Share2 />Share</Button>
          <Button variant="outline" size="sm" disabled={busy === "pdf"} onClick={async () => { setBusy("pdf"); try { await runExport(`/meetings/${id}/export`, {}, `${m.title}.pdf`); } catch (e) { toast.error((e as Error).message); } setBusy(null); }}>{busy === "pdf" ? <Loader2 className="animate-spin" /> : <Download />}Export PDF</Button>
          {m.presentation_id ? (
            <Button size="sm" asChild><Link to="/editor/$id" params={{ id: m.presentation_id }}><Presentation />Open presentation</Link></Button>
          ) : (
            <Button size="sm" onClick={() => void createDeck()} disabled={busy === "deck"}>{busy === "deck" ? <Loader2 className="animate-spin" /> : <Presentation />}Create presentation</Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="notes" className="mt-8">
        <TabsList><TabsTrigger value="notes">Notes</TabsTrigger><TabsTrigger value="transcript">Transcript ({transcript?.length ?? 0})</TabsTrigger></TabsList>
        <TabsContent value="notes" className="mt-6 space-y-10">
          <Section title="Executive Summary" action={!editing && <button onClick={() => { setSummary(i.summary ?? ""); setEditing(true); }} className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"><Pencil className="size-3" />Edit</button>}>
            {editing ? (
              <div className="space-y-2"><Textarea value={summary} onChange={(e) => setSummary(e.target.value)} className="min-h-[120px]" /><div className="flex gap-2"><Button size="sm" onClick={() => void saveSummary()}>Save</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button></div></div>
            ) : <p className="font-serif text-[22px] leading-snug">{i.summary}</p>}
          </Section>
          <div className="grid gap-10 md:grid-cols-2">
            <Section title="Key Decisions">
              <ol className="space-y-3">{(i.decisions ?? []).map((d, k) => <li key={k} className="flex gap-3 text-[14px]"><span className="font-mono text-[12px] text-brand">{String(k + 1).padStart(2, "0")}</span><span>{d.text}{d.owner && <span className="text-muted-foreground"> — {d.owner}</span>}</span></li>)}</ol>
            </Section>
            <Section title="Discussion Highlights">
              <ul className="space-y-3">{(i.topics ?? []).map((t, k) => <li key={k} className="text-[14px]"><span className="font-medium">{t.title}</span>{t.summary && <span className="text-muted-foreground"> — {t.summary}</span>}</li>)}</ul>
            </Section>
          </div>
          <Section title="Action Items">
            <div className="surface divide-y">
              <div className="grid grid-cols-[24px_1fr_160px_120px] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><span /><span>Action</span><span>Owner</span><span>Deadline</span></div>
              {m.action_items.map((a) => (
                <div key={a.id} className="grid grid-cols-[24px_1fr_160px_120px] items-center gap-3 px-4 py-3 text-[13.5px]">
                  <button onClick={() => void toggle(a)} aria-label="Toggle">{a.status === "done" ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}</button>
                  <span className={cn(a.status === "done" && "text-muted-foreground line-through")}>{a.title}</span>
                  <span className="flex items-center gap-2">{a.owner && <Avatar name={a.owner} />}{a.owner ?? "—"}</span>
                  <span className="text-muted-foreground">{a.deadline ? new Date(a.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : a.deadline_text ?? "—"}</span>
                </div>
              ))}
              {m.action_items.length === 0 && <div className="px-4 py-4 text-[13px] text-muted-foreground">No action items.</div>}
            </div>
          </Section>
          <div className="grid gap-10 md:grid-cols-2">
            <Section title="Open Questions"><ul className="space-y-2">{(i.questions ?? []).map((q, k) => <li key={k} className="flex gap-2 text-[14px]"><HelpCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />{q.text}</li>)}</ul></Section>
            <Section title="Risks"><ul className="space-y-2">{(i.risks ?? []).map((r, k) => <li key={k} className="flex gap-2 text-[14px]"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />{r.text}</li>)}</ul></Section>
          </div>
          {(i.numbers ?? []).length > 0 && (
            <Section title="Important Numbers">
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">{(i.numbers ?? []).map((n, k) => <div key={k} className="surface p-4"><div className="font-mono text-[24px] font-medium">{n.value}</div><div className="mt-1 text-[12px] text-muted-foreground">{n.label}</div></div>)}</div>
            </Section>
          )}
          <Section title="Next Steps"><ul className="space-y-2">{(i.next_steps ?? []).map((s, k) => <li key={k} className="flex gap-2 text-[14px]"><span className="text-brand">→</span>{s}</li>)}</ul></Section>
        </TabsContent>
        <TabsContent value="transcript" className="mt-6">
          <div className="surface max-w-3xl divide-y">
            {(transcript ?? []).map((s) => (
              <div key={s.seq} className="flex gap-4 px-5 py-3">
                <span className="w-12 shrink-0 pt-0.5 font-mono text-[11px] text-muted-foreground">{String(Math.floor(s.start_ms / 60000)).padStart(2, "0")}:{String(Math.floor(s.start_ms / 1000) % 60).padStart(2, "0")}</span>
                <div><div className="text-[12.5px] font-semibold">{s.speaker}</div><div className="text-[14px] leading-relaxed" dir="auto">{s.text}</div></div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <ShareDialog kind="meetings" id={id} title={m.title} open={share} onOpenChange={setShare} />
    </Page>
  );
}

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section><div className="mb-3 flex items-center justify-between border-b pb-2"><h2 className="eyebrow">{title}</h2>{action}</div>{children}</section>;
}
