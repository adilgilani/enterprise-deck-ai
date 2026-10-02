import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, CheckCircle2, Circle, Clock, Mic, Plus, Presentation } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Avatar, EmptyState, StatusPill, ago, duration } from "@/components/shared";
import { useActionItems, useInvalidate, useMeetings } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import type { ActionItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings/")({
  head: () => ({ meta: [{ title: "Meetings — Enterprise AI" }] }),
  component: MeetingsPage,
});

function MeetingsPage() {
  const { data: meetings, isLoading } = useMeetings();
  const { data: actions } = useActionItems();
  const invalidate = useInvalidate();
  const upcoming = (meetings ?? []).filter((m) => m.status === "scheduled").sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
  const recent = (meetings ?? []).filter((m) => m.status !== "scheduled");
  const open = (actions ?? []).filter((a) => a.status !== "done");
  const hours = recent.reduce((a, m) => a + (m.duration_seconds ?? 0), 0) / 3600;

  const toggle = async (a: ActionItem) => {
    await api(`/action-items/${a.id}`, { method: "PATCH", body: { status: a.status === "done" ? "open" : "done" } });
    void invalidate("action-items", "meetings");
  };

  return (
    <Page>
      <PageHeader title="Meetings" subtitle="Capture physical meetings and turn them into notes, decisions and branded decks." actions={<Button size="lg" asChild><Link to="/meetings/new"><Mic />Start Meeting</Link></Button>} />
      <div className="mb-10 grid gap-4 md:grid-cols-4">
        {[
          ["Meetings captured", recent.length, Mic],
          ["Hours transcribed", hours.toFixed(1), Clock],
          ["Open action items", open.length, CheckCircle2],
          ["Decks generated", recent.filter((m) => m.presentation_id).length, Presentation],
        ].map(([l, v, Icon]) => {
          const I = Icon as typeof Mic;
          return <div key={l as string} className="surface p-5"><I className="size-4 text-muted-foreground" /><div className="mt-4 font-mono text-[28px] font-medium">{v as string | number}</div><div className="text-[12.5px] text-muted-foreground">{l as string}</div></div>;
        })}
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Upcoming</h2>
            <div className="surface divide-y">
              {upcoming.length === 0 && <div className="p-5 text-[13px] text-muted-foreground">No upcoming meetings.</div>}
              {upcoming.map((m) => (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                  <CalendarClock className="size-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1"><div className="text-[14px] font-medium">{m.title}</div><div className="text-[12px] text-muted-foreground">{m.scheduled_at ? new Date(m.scheduled_at).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""} · {m.location}</div></div>
                  <div className="flex -space-x-1.5">{m.participants.slice(0, 4).map((p) => <Avatar key={p.id} name={p.name} />)}</div>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h2 className="mb-3 text-[15px] font-semibold">Recent meetings</h2>
            {!isLoading && recent.length === 0 && <EmptyState icon={Mic} title="No meetings yet" body="Start a meeting to capture the conversation." action={<Button asChild><Link to="/meetings/new"><Plus />Start Meeting</Link></Button>} />}
            <div className="space-y-3">
              {recent.map((m) => (
                <Link key={m.id} to="/meetings/$id" params={{ id: m.id }} className="surface surface-hover block p-5">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2"><span className="text-[15px] font-medium">{m.title}</span><StatusPill status={m.status} /></div>
                      <div className="mt-1 text-[12px] text-muted-foreground">{ago(m.started_at)} · {duration(m.duration_seconds)} · {m.participants.length} participants</div>
                    </div>
                    <div className="flex -space-x-1.5">{m.participants.slice(0, 5).map((p) => <Avatar key={p.id} name={p.name} />)}</div>
                  </div>
                  {m.summary && <p className="mt-3 line-clamp-2 text-[13px] text-muted-foreground">{m.summary}</p>}
                  <div className="mt-3 flex gap-4 text-[12px] text-muted-foreground">
                    <span>{m.decision_count} decisions</span><span>{m.action_item_count} action items</span>
                    {m.presentation_id && <span className="flex items-center gap-1 text-brand"><Presentation className="size-3" />Deck generated</span>}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        </div>
        <aside>
          <h2 className="mb-3 text-[15px] font-semibold">Open action items</h2>
          <div className="surface divide-y">
            {open.length === 0 && <div className="p-5 text-[13px] text-muted-foreground">All caught up.</div>}
            {open.slice(0, 12).map((a) => (
              <div key={a.id} className="flex gap-3 px-4 py-3">
                <button onClick={() => void toggle(a)} aria-label="Complete" className="mt-0.5"><Circle className={cn("size-4 text-muted-foreground")} /></button>
                <div className="min-w-0 flex-1 text-[13px]"><div className="leading-snug">{a.title}</div><div className="mt-0.5 text-[11.5px] text-muted-foreground">{a.owner ?? "Unassigned"}{a.deadline ? ` · due ${new Date(a.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : a.deadline_text ? ` · ${a.deadline_text}` : ""}</div></div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  );
}
