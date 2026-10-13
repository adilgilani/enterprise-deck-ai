// Mock meeting analysis. Swap `analyzeMeeting` / `buildMeetingDeck` for LLM calls later —
// the inputs and outputs are already the shape an API would take and return.
// Lines may use "Headline — detail"; the headline becomes the slide item title.
import type { BrandGuidelines, BrandSystem } from "@/lib/brand-data";
import type { Slide, SlideItem } from "@/lib/mock-data";

export interface MeetingInput {
  title: string;
  date: string;
  participants: string[];
  /** One objective per line. */
  objective: string;
  agenda: string[];
  discussion: string[];
  decisions: string[];
  actions: { task: string; owner: string; due: string }[];
  nextSteps: string[];
}

export const sampleMeeting: MeetingInput = {
  title: "Product Launch Planning Meeting",
  date: "2026-10-02",
  participants: ["Fawaz Ahmed", "Sara Malik", "Omar Shah", "Priya Nair", "Ahmed Raza"],
  objective: [
    "Launch scope — Agree what ships in the Work AI general-availability release",
    "Go-to-market — Confirm launch date, pricing and first target accounts",
    "Readiness — Assign owners for security review, enablement and launch assets",
  ].join("\n"),
  agenda: [
    "Launch scope & readiness",
    "Pricing & packaging",
    "Go-to-market plan",
    "Risks & dependencies",
  ],
  discussion: [
    "Pilot results — Pilot users at Riyadh Bank found answers 38% faster with verified citations",
    "Connectors — 7 enterprise connectors are production-ready, from SharePoint to PostgreSQL",
    "Deployment — Two of three pilot clients require on-premise or air-gapped deployment",
    "Enablement — The support team maybe needs two weeks of training before launch",
    "Roadmap — SSO (SAML 2.0 / OIDC) is the most requested feature from pilot IT teams",
  ],
  decisions: [
    "Launch date — Work AI goes generally available on 12 November",
    "Pricing — Enterprise tier at $48 per seat per month; on-premise priced per deployment",
    "Positioning — Lead with verified citations and permission-aware retrieval",
    "Roadmap — Single sign-on ships in the first release after launch",
  ],
  actions: [
    { task: "Finalise launch messaging and website copy", owner: "Sara Malik", due: "16 Oct" },
    {
      task: "Complete security review of the on-premise package",
      owner: "Omar Shah",
      due: "22 Oct",
    },
    { task: "Run support team enablement", owner: "Priya Nair", due: "29 Oct" },
    {
      task: "Brief Riyadh Bank and the top 20 waitlist accounts",
      owner: "Ahmed Raza",
      due: "30 Oct",
    },
    { task: "Prepare the launch-day runbook and war room", owner: "Fawaz Ahmed", due: "10 Nov" },
  ],
  nextSteps: [
    "Weekly stand-up — Launch stand-up every Monday at 10:00",
    "Go / no-go — Readiness review on 6 November",
    "Launch — General availability and customer webinar on 12 November",
    "Retrospective — Post-launch review hopefully on 26 November",
  ],
};

/** The recorded Q4 Strategy Meeting (Meeting Studio live demo), in the same shape. */
export const q4Meeting = (title: string): MeetingInput => ({
  title,
  date: "2026-10-02",
  participants: [
    "Ahmed Raza",
    "Sara Malik",
    "Omar Shah",
    "Priya Nair",
    "Lena Ortiz",
    "Adil Gillani",
  ],
  objective: [
    "Q4 focus — Agree where the business concentrates next quarter",
    "Implementation speed — Set a target for enterprise onboarding time",
    "EU readiness — Decide how to sell to European banks before the EU region ships",
  ].join("\n"),
  agenda: [
    "Enterprise focus",
    "Implementation speed",
    "Hiring budget",
    "Banking pipeline",
    "EU data region",
  ],
  discussion: [
    "Enterprise focus — Next quarter concentrates on enterprise customers",
    "Onboarding — Onboarding averages 41 days today; the target is under 21",
    "Capacity — Hitting the target needs two more solutions engineers, roughly $380K",
    "Banking pipeline — Banking pipeline is up 34%; ABC Bank alone is a $2.4M opportunity",
    "EU region — The EU data region will not be ready before January",
  ],
  decisions: [
    "Onboarding — 21-day enterprise onboarding by the end of Q4",
    "Hiring — Two additional solutions engineers (~$380K)",
    "EU positioning — Private AI mode for European banks until the EU region ships",
    "Cadence — Leadership progress review every two weeks",
  ],
  actions: [
    { task: "Confirm solutions engineering hiring budget", owner: "Priya Nair", due: "9 Oct" },
    { task: "Finalise ABC Bank proposal", owner: "Lena Ortiz", due: "7 Oct" },
    { task: "Build enterprise sales enablement deck", owner: "Priya Nair", due: "14 Oct" },
    { task: "Private AI positioning for EU banks", owner: "Ahmed Raza", due: "16 Oct" },
    { task: "Ship 21-day onboarding playbook", owner: "Omar Shah", due: "30 Oct" },
  ],
  nextSteps: [
    "Budget — Finance confirms hiring budget by 9 October",
    "Proposal — ABC Bank proposal sent on 7 October",
    "Review — Leadership progress review on 16 October",
  ],
});

export const emptyMeeting: MeetingInput = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  participants: [],
  objective: "",
  agenda: [],
  discussion: [],
  decisions: [],
  actions: [],
  nextSteps: [],
};

/* ---------------- Brand voice ---------------- */

export interface VoiceReport {
  removed: { word: string; count: number }[];
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Applies the brand's guideline voice: strips hedging and fluff words, tidies spacing and capitals. */
export function applyVoice(
  text: string,
  g: BrandGuidelines | undefined,
  report?: VoiceReport,
): string {
  if (!g?.bannedWords.length) return text;
  let out = text;
  for (const w of g.bannedWords) {
    const re = new RegExp(`\\b${esc(w)}\\b\\s*`, "gi");
    const n = out.match(re)?.length ?? 0;
    if (n && report) {
      const hit = report.removed.find((r) => r.word === w);
      if (hit) hit.count += n;
      else report.removed.push({ word: w, count: n });
    }
    out = out.replace(re, "");
  }
  out = out
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/* ---------------- Analysis ---------------- */

export const splitLine = (s: string): SlideItem => {
  const [title, ...rest] = s.split(" — ");
  return rest.length ? { title: title!.trim(), text: rest.join(" — ").trim() } : { text: s.trim() };
};
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

const FIGURE =
  /(\$\s?\d[\d,.]*\s?[KMB]?|~?\d[\d,.]*\s?%|\d[\d,.]*x\b|\b\d+(?:\.\d+)?\s+(?:days?|weeks?|months?|seats?|connectors?|accounts?|clients?|companies|customers))/i;

export interface MeetingAnalysis {
  summary: string;
  insights: { value: string; title: string; text: string }[];
  owners: Record<string, string[]>;
  objectives: SlideItem[];
  voice: VoiceReport;
}

/** Cleans every text field with the brand voice and reports what changed. */
export function cleanMeeting(
  m: MeetingInput,
  brand?: BrandSystem,
): { input: MeetingInput; voice: VoiceReport } {
  const voice: VoiceReport = { removed: [] };
  const v = (t: string) => applyVoice(t, brand?.guidelines, voice);
  return {
    voice,
    input: {
      ...m,
      objective: lines(m.objective).map(v).join("\n"),
      agenda: m.agenda.map(v),
      discussion: m.discussion.map(v),
      decisions: m.decisions.map(v),
      nextSteps: m.nextSteps.map(v),
      actions: m.actions.map((a) => ({ ...a, task: v(a.task) })),
    },
  };
}

export function analyzeMeeting(raw: MeetingInput, brand?: BrandSystem): MeetingAnalysis {
  const { input: m, voice } = cleanMeeting(raw, brand);
  const insights = [...m.discussion, ...m.decisions]
    .map((line) => {
      const it = splitLine(line);
      const match = (it.text ?? "").match(FIGURE);
      return match
        ? {
            value: match[0].replace(/\s+/g, " ").trim(),
            title: it.title ?? "Insight",
            text: it.text ?? "",
          }
        : null;
    })
    .filter((x): x is { value: string; title: string; text: string } => !!x)
    .slice(0, 3);
  const fill = [
    {
      value: String(m.decisions.length),
      title: "Decisions made",
      text: "Agreed and recorded in this meeting.",
    },
    {
      value: String(m.actions.length),
      title: "Action items",
      text: "Each assigned to a named owner with a due date.",
    },
    {
      value: String(m.participants.length),
      title: "Participants",
      text: m.participants.join(", "),
    },
  ];
  while (insights.length < 3) insights.push(fill[insights.length]!);
  const owners = m.actions.reduce<Record<string, string[]>>((a, x) => {
    const o = x.owner || "Unassigned";
    return { ...a, [o]: [...(a[o] ?? []), x.task] };
  }, {});
  const objectives = lines(m.objective).map(splitLine);
  const nOwners = Object.keys(owners).length;
  const summary =
    `${m.participants.length} participants agreed ${m.decisions.length} decision${m.decisions.length === 1 ? "" : "s"} and assigned ${m.actions.length} action item${m.actions.length === 1 ? "" : "s"} across ${nOwners} owner${nOwners === 1 ? "" : "s"}. ${splitLine(m.decisions[0] ?? "").text ?? ""}.`.replace(
      /\.\.$/,
      ".",
    );
  return { summary, insights, owners, objectives, voice };
}

const fmtDate = (iso: string, style: "long" | "short" = "long") => {
  const d = new Date(iso + "T12:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return style === "long"
    ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

/** Section titles of the template-based meeting deck, in order. */
export const signatureOutline = [
  "Cover",
  "Meeting Overview",
  "Objectives",
  "Key Discussion Points",
  "Decisions Made",
  "Important Insights",
  "Action Items",
  "Owners & Responsibilities",
  "Next Steps",
  "Closing",
];

/**
 * Meeting → presentation. With `layout: "signature"` the deck is built from the brand's
 * presentation-template layouts (cover, chart + list, cards, steps, tables, dark cards, closing).
 */
export function buildMeetingDeck(
  raw: MeetingInput,
  opts: { brand?: BrandSystem | undefined; layout?: "signature" | "classic" } = {},
): Slide[] {
  const { input: m } = cleanMeeting(raw, opts.brand);
  const a = analyzeMeeting(raw, opts.brand);
  const id = (n: number) => `mt-${n}-${Math.random().toString(36).slice(2, 7)}`;

  if (opts.layout !== "signature") {
    return [
      {
        id: id(1),
        kind: "title",
        title: m.title || "Meeting overview",
        subtitle: `Meeting overview · ${fmtDate(m.date, "short")} · ${m.participants.length} participants`,
      },
      {
        id: id(2),
        kind: "split",
        title: "Objectives",
        bullets: a.objectives.map((o) => o.text ?? "").slice(0, 3),
      },
      {
        id: id(3),
        kind: "agenda",
        title: "Key discussion points",
        bullets: m.discussion.map((d) => splitLine(d).text ?? d).slice(0, 5),
      },
      {
        id: id(4),
        kind: "grid",
        title: "Decisions made",
        bullets: m.decisions.map((d) => splitLine(d).title ?? d).slice(0, 4),
      },
      {
        id: id(5),
        kind: "metrics",
        title: "Important insights",
        metrics: a.insights.map((i) => ({ value: i.value, label: i.title })),
      },
      {
        id: id(6),
        kind: "list",
        title: "Action items",
        bullets: m.actions.slice(0, 5).map((x) => `${x.due || "TBC"} — ${x.task}`),
      },
      {
        id: id(7),
        kind: "list",
        title: "Owners & responsibilities",
        bullets: Object.entries(a.owners)
          .slice(0, 5)
          .map(([o, ts]) => `${o} — ${ts.join("; ")}`),
      },
      {
        id: id(8),
        kind: "agenda",
        title: "Next steps",
        bullets: m.nextSteps.map((d) => splitLine(d).text ?? d).slice(0, 5),
      },
    ];
  }

  const footer = m.title.replace(/\s+Meeting$/i, "");
  const decisions = m.decisions.map(splitLine);
  const steps = m.nextSteps.map(splitLine);
  const firstDecision = decisions[0];
  return [
    {
      id: id(1),
      kind: "cover",
      kicker: "Meeting summary & action plan",
      title: m.title || "Meeting summary",
      subtitle: "Decisions, owners and next steps",
      meta: [
        { label: "Prepared for", value: `${m.participants.length} meeting participants` },
        { label: "Prepared by", value: opts.brand?.name ?? "Meeting Studio" },
        { label: "Date", value: fmtDate(m.date) },
      ],
    },
    {
      id: id(2),
      kind: "overview",
      kicker: "Meeting overview",
      title: "What We Covered",
      lead: a.summary,
      footer,
      metrics: [
        { label: "Decisions", value: String(m.decisions.length) },
        { label: "Action items", value: String(m.actions.length) },
        { label: "Next steps", value: String(m.nextSteps.length) },
      ],
      items: m.agenda
        .slice(0, 4)
        .map((x, i) => ({ title: x, text: `Agenda item ${String(i + 1).padStart(2, "0")}` })),
      callout: `Participants — ${m.participants.join(", ")}.`,
    },
    {
      id: id(3),
      kind: "cards",
      kicker: "Objectives",
      title: "What This Meeting Set Out to Do",
      footer,
      items: a.objectives
        .slice(0, 3)
        .map((o) => ({ title: o.title ?? o.text, text: o.title ? o.text : undefined })),
      ...(firstDecision && { callout: `“${firstDecision.text ?? firstDecision.title}.”` }),
    },
    {
      id: id(4),
      kind: "steps",
      kicker: "Key discussion points",
      title: "What Was Discussed",
      footer,
      items: m.discussion.slice(0, 5).map(splitLine),
    },
    {
      id: id(5),
      kind: "table",
      kicker: "Decisions made",
      title: "What Was Agreed",
      footer,
      lead: "Each decision below is final and recorded in the meeting notes.",
      table: {
        head: ["Decision", "What Was Agreed"],
        rows: decisions.slice(0, 6).map((d) => [d.title ?? "Decision", d.text ?? ""]),
      },
    },
    {
      id: id(6),
      kind: "dark-cards",
      kicker: "Important insights",
      title: "The Numbers That Matter",
      footer,
      lead: "Figures stated in the meeting, carried through unchanged.",
      items: a.insights.map((i) => ({ value: i.value, title: i.title, text: i.text })),
    },
    {
      id: id(7),
      kind: "table",
      kicker: "Action items",
      title: "Actions, Owners and Deadlines",
      footer,
      table: {
        head: ["Action", "Owner", "Due"],
        widths: [58, 26, 16],
        rows: m.actions.slice(0, 7).map((x) => [x.task, x.owner || "Unassigned", x.due || "TBC"]),
      },
    },
    {
      id: id(8),
      kind: "groups",
      kicker: "Owners & responsibilities",
      title: "Who Owns What",
      footer,
      items: Object.entries(a.owners)
        .slice(0, 6)
        .map(([o, ts]) => ({ title: o, text: ts.join("\n") })),
    },
    {
      id: id(9),
      kind: "cards",
      kicker: "Next steps",
      title: "What Happens Next",
      footer,
      items: steps
        .slice(0, 6)
        .map((s) => ({ title: s.title ?? s.text, text: s.title ? s.text : undefined })),
    },
    {
      id: id(10),
      kind: "closing",
      kicker: "Closing",
      title: "Summary",
      items: [
        ...decisions.slice(0, 4).map((d) => ({ title: d.title ?? "Decision", text: d.text })),
        {
          title: "Owners",
          text: `${Object.keys(a.owners).length} owners, ${m.actions.length} actions — every action has a due date.`,
        },
        ...(steps[1] ? [{ title: "Next checkpoint", text: steps[1].text ?? steps[1].title }] : []),
      ].slice(0, 6),
      callout: a.summary,
    },
  ];
}
