import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Page, PageHeader } from "@/components/app-shell";
import { analyticsSeries, initials, team, templates } from "@/lib/mock-data";

export const Route = createFileRoute("/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Enterprise AI" }] }),
  component: Analytics,
});

const kpis = [
  ["Presentations created", "589", "+24%"],
  ["Proposals created", "141", "+18%"],
  ["Meetings captured", "270", "+31%"],
  ["AI-generated slides", "7,420", "+27%"],
  ["Time saved", "1,180 hrs", "+22%"],
];
const series = [
  ["decks", "Presentations", "var(--chart-1)"],
  ["proposals", "Proposals", "var(--chart-4)"],
  ["meetings", "Meetings", "var(--chart-5)"],
] as const;

function Bars({ rows }: { rows: [string, number][] }) {
  const max = Math.max(...rows.map((r) => r[1]));
  return (
    <div className="space-y-3">
      {rows.map(([l, v]) => (
        <div key={l}>
          <div className="mb-1 flex justify-between text-[12.5px]">
            <span>{l}</span>
            <span className="font-mono text-muted-foreground">{v}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-foreground"
              style={{ width: `${(v / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Analytics() {
  return (
    <Page>
      <PageHeader
        title="Analytics"
        subtitle="How your organization creates with AI — last 6 months."
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map(([k, v, d]) => (
          <div key={k} className="surface p-4">
            <div className="text-[12px] text-muted-foreground">{k}</div>
            <div className="mt-2 font-mono text-[26px] tracking-tight">{v}</div>
            <div className="mt-1 text-[12px] text-success">{d} vs prior period</div>
          </div>
        ))}
      </div>
      <div className="surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">Output over time</h2>
          <div className="flex gap-4 text-[12px] text-muted-foreground">
            {series.map(([, l, c]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: c }} />
                {l}
              </span>
            ))}
          </div>
        </div>
        <div className="h-72">
          <ResponsiveContainer>
            <AreaChart data={analyticsSeries} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="m" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  fontSize: 12,
                  boxShadow: "var(--shadow-lift)",
                }}
              />
              {series.map(([k, , c]) => (
                <Area
                  key={k}
                  type="monotone"
                  dataKey={k}
                  stroke={c}
                  fill={c}
                  fillOpacity={0.08}
                  strokeWidth={1.75}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="surface p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Most-used templates</h2>
          <Bars rows={templates.slice(0, 5).map((t) => [t.name, t.uses])} />
        </div>
        <div className="surface p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Most-used brand systems</h2>
          <Bars
            rows={[
              ["Acme Corporation", 412],
              ["Acme EMEA", 118],
              ["Acme Ventures", 59],
            ]}
          />
        </div>
        <div className="surface p-5">
          <h2 className="mb-4 text-[15px] font-semibold">Team activity</h2>
          <ul className="space-y-3">
            {team.slice(0, 5).map((m, i) => (
              <li key={m.name} className="flex items-center gap-3 text-[13px]">
                <span className="grid size-7 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                  {initials(m.name)}
                </span>
                <span className="flex-1">{m.name}</span>
                <span className="font-mono text-muted-foreground">{48 - i * 7} docs</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Page>
  );
}
