import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Page, PageHeader } from "@/components/app-shell";
import { money } from "@/components/shared";
import { useAnalytics } from "@/lib/api/hooks";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — VYRA" }] }),
  component: AnalyticsPage,
});

const C = { pres: "#2F5BD3", prop: "#B07D2B", meet: "#1F8A70", ai: "#9AA6C4" };
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

function Panel({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return <div className={`surface p-5 ${className ?? ""}`}><div className="text-[14px] font-medium">{title}</div>{sub && <div className="text-[12px] text-muted-foreground">{sub}</div>}<div className="mt-4">{children}</div></div>;
}

function AnalyticsPage() {
  const { data } = useAnalytics(90);
  if (!data) return <Page><div className="h-96 animate-pulse rounded-lg bg-muted" /></Page>;
  const t = data.totals;
  const weekly = data.weekly.map((w) => ({ ...w, label: new Date(w.week).toLocaleDateString(undefined, { month: "short", day: "numeric" }) }));
  const tiles: [string, string][] = [
    ["Presentations created", String(t["presentations"])], ["Proposals created", String(t["proposals"])], ["Meetings captured", String(t["meetings"])],
    ["Slides generated", String(t["slides"])], ["AI generations", String(t["ai_generations"])], ["Time saved", `${t["hours_saved"]} h`],
  ];
  const maxTpl = Math.max(1, ...data.templates.map((x) => x.uses));
  const maxTask = Math.max(1, ...data.ai_tasks.map((x) => x.count));
  return (
    <Page>
      <PageHeader title="Analytics" subtitle="Adoption, AI usage and business impact across the workspace · last 90 days" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map(([l, v]) => <div key={l} className="surface p-5"><div className="text-[12px] text-muted-foreground">{l}</div><div className="mt-2 font-mono text-[28px] font-medium tracking-tight">{v}</div></div>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Panel title="Weekly activity" sub="Artifacts created per week">
          <div className="mb-2 flex gap-4 text-[12px] text-muted-foreground">{[["Presentations", C.pres], ["Proposals", C.prop], ["Meetings", C.meet]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: c }} />{l}</span>)}</div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={weekly} margin={{ left: -20, right: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
              <Area type="monotone" dataKey="presentations" name="Presentations" stackId="1" stroke={C.pres} fill={C.pres} fillOpacity={0.85} />
              <Area type="monotone" dataKey="proposals" name="Proposals" stackId="1" stroke={C.prop} fill={C.prop} fillOpacity={0.85} />
              <Area type="monotone" dataKey="meetings" name="Meetings" stackId="1" stroke={C.meet} fill={C.meet} fillOpacity={0.85} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="AI platform health" sub={`${t["ai_success_rate"]}% structured-output success`}>
          <dl className="space-y-3 text-[13px]">
            {[["Avg. latency", `${((t["avg_latency_ms"] ?? 0) / 1000).toFixed(1)} s`], ["Prompt tokens", (t["prompt_tokens"] ?? 0).toLocaleString()], ["Completion tokens", (t["completion_tokens"] ?? 0).toLocaleString()], ["Knowledge documents", String(t["documents"])], ["Won proposal value", money(t["won_value"])], ["Open pipeline", money(t["pipeline_value"])]].map(([k, v]) => <div key={k} className="flex justify-between border-b pb-2 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono">{v}</dd></div>)}
          </dl>
        </Panel>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Panel title="Most-used templates">
          <div className="space-y-2.5">{data.templates.map((x) => <div key={x.name}><div className="flex justify-between text-[12.5px]"><span>{x.name}</span><span className="font-mono text-muted-foreground">{x.uses}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full" style={{ width: `${(x.uses / maxTpl) * 100}%`, background: C.pres }} /></div></div>)}</div>
        </Panel>
        <Panel title="AI generations by task">
          <div className="space-y-2.5">{data.ai_tasks.map((x) => <div key={x.task}><div className="flex justify-between text-[12.5px]"><span className="font-mono">{x.task}</span><span className="font-mono text-muted-foreground">{x.count}</span></div><div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-foreground/70" style={{ width: `${(x.count / maxTask) * 100}%` }} /></div></div>)}</div>
        </Panel>
        <Panel title="Most-used brands & deck types">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.deck_types.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 16 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="type" tick={axis} tickLine={false} axisLine={false} width={110} tickFormatter={(v: string) => v.replace("_", " ")} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="count" fill={C.pres} radius={[0, 4, 4, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 space-y-1 text-[12.5px]">{data.brands.map((b) => <div key={b.name} className="flex justify-between"><span>{b.name}</span><span className="font-mono text-muted-foreground">{b.uses} decks</span></div>)}</div>
        </Panel>
      </div>
      <Panel title="Team activity" className="mt-6">
        <table className="w-full text-[13px]"><thead><tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground"><th className="py-2">Member</th><th>Presentations</th><th>Proposals</th><th>Meetings</th><th>Total</th></tr></thead>
          <tbody>{data.team.map((m) => <tr key={m.name} className="border-b last:border-0"><td className="py-2.5 font-medium">{m.name}</td><td className="font-mono">{m.presentations}</td><td className="font-mono">{m.proposals}</td><td className="font-mono">{m.meetings}</td><td className="font-mono">{m.total}</td></tr>)}</tbody>
        </table>
      </Panel>
    </Page>
  );
}
