// Mock data layer. Replace these exports with API calls (e.g. createServerFn) later.

export type SlideKind =
  | "title"
  | "metrics"
  | "chart"
  | "split"
  | "timeline"
  | "quote"
  | "grid"
  | "agenda"
  | "comparison"
  | "list"
  // Layouts from the Stixor presentation template (Work AI deck)
  | "cover"
  | "overview"
  | "cards"
  | "steps"
  | "table"
  | "dark-cards"
  | "groups"
  | "closing";

/** "signature" renders the brand's own presentation-template layouts (see components/signature-slide). */
export type Theme = "ink" | "light" | "brand" | "editorial" | "signature";

export interface SlideItem {
  title?: string | undefined;
  text?: string | undefined;
  /** Big figure, e.g. "38%" */
  value?: string | undefined;
}

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  subtitle?: string | undefined;
  bullets?: string[] | undefined;
  metrics?: { label: string; value: string }[] | undefined;
  /** Orange caps label above the title; also the footer section name. */
  kicker?: string | undefined;
  /** Intro paragraph under the title. */
  lead?: string | undefined;
  items?: SlideItem[] | undefined;
  /** `widths` are column widths in %, e.g. [60, 25, 15]. */
  table?: { head: string[]; rows: string[][]; widths?: number[] | undefined } | undefined;
  /** Emphasis band (quote / core rule). */
  callout?: string | undefined;
  /** Cover meta columns, e.g. PREPARED FOR / PREPARED BY / DATE. */
  meta?: { label: string; value: string }[] | undefined;
  /** Footer text on the right, e.g. "Work AI · Stixor". */
  footer?: string | undefined;
}

export interface Deck {
  id: string;
  title: string;
  author: string;
  edited: string;
  status: "Draft" | "In review" | "Approved" | "Presented";
  theme: Theme;
  slides: number;
  lastPresented?: string;
  cover: SlideKind;
}

export const brand = {
  name: "Acme Corporation",
  industry: "Enterprise Software",
  website: "acme.com",
  colors: [
    { name: "Primary", hex: "#2F5BD3" },
    { name: "Secondary", hex: "#1B2A4A" },
    { name: "Accent", hex: "#E3B866" },
    { name: "Background", hex: "#F6F4EF" },
    { name: "Text", hex: "#1C1D21" },
  ],
  headingFont: "Instrument Serif",
  bodyFont: "Geist",
  dataFont: "Geist Mono",
};

export const decks: Deck[] = [
  {
    id: "q3-board-review",
    title: "Q3 Board Review",
    author: "Sara Malik",
    edited: "2h ago",
    status: "Approved",
    theme: "ink",
    slides: 18,
    lastPresented: "Sep 28, 2026",
    cover: "title",
  },
  {
    id: "series-b",
    title: "Series B Investor Presentation",
    author: "Ahmed Raza",
    edited: "Yesterday",
    status: "In review",
    theme: "brand",
    slides: 14,
    cover: "metrics",
  },
  {
    id: "strategy-2027",
    title: "Annual Strategy 2027",
    author: "Adil Gillani",
    edited: "3 days ago",
    status: "Draft",
    theme: "editorial",
    slides: 22,
    cover: "title",
  },
  {
    id: "enterprise-sales",
    title: "Enterprise Sales Proposal",
    author: "Lena Ortiz",
    edited: "Sep 24",
    status: "Presented",
    theme: "light",
    slides: 12,
    lastPresented: "Sep 25, 2026",
    cover: "chart",
  },
  {
    id: "product-launch",
    title: "Product Launch — Atlas 4",
    author: "Omar Shah",
    edited: "Sep 20",
    status: "Approved",
    theme: "brand",
    slides: 16,
    cover: "split",
  },
  {
    id: "market-analysis",
    title: "Market Analysis H2",
    author: "Priya Nair",
    edited: "Sep 18",
    status: "Draft",
    theme: "light",
    slides: 10,
    cover: "chart",
  },
];

export const deckSlides: Slide[] = [
  {
    id: "s1",
    kind: "title",
    title: "Q3 Board Review",
    subtitle: "Performance, priorities and the path to FY27",
  },
  {
    id: "s2",
    kind: "agenda",
    title: "Agenda",
    bullets: [
      "Quarter in review",
      "Financial performance",
      "Go-to-market",
      "Product roadmap",
      "Risks & asks",
    ],
  },
  {
    id: "s3",
    kind: "metrics",
    title: "A record quarter",
    metrics: [
      { label: "ARR", value: "$48.2M" },
      { label: "Net retention", value: "128%" },
      { label: "Gross margin", value: "81%" },
    ],
  },
  { id: "s4", kind: "chart", title: "Revenue growth accelerated", subtitle: "Quarterly ARR, $M" },
  {
    id: "s5",
    kind: "split",
    title: "Enterprise is our growth engine",
    bullets: [
      "62% of new ARR from Fortune 1000",
      "Sales cycle down 18 days",
      "Implementation time halved",
    ],
  },
  {
    id: "s6",
    kind: "timeline",
    title: "Roadmap to FY27",
    bullets: ["Q4 — Atlas 4", "Q1 — EU region", "Q2 — Private AI", "Q3 — Marketplace"],
  },
  {
    id: "s7",
    kind: "comparison",
    title: "Where we win",
    bullets: ["Brand-locked output", "Enterprise security", "Meeting intelligence"],
  },
  {
    id: "s8",
    kind: "quote",
    title: "“The first AI tool our brand team actually trusts.”",
    subtitle: "CMO, Global Bank",
  },
  {
    id: "s9",
    kind: "grid",
    title: "Strategic priorities",
    bullets: ["Enterprise", "Platform", "Partners", "Talent"],
  },
  {
    id: "s10",
    kind: "title",
    title: "Asks of the board",
    subtitle: "Approve FY27 plan and EU expansion",
  },
];

export type ProposalStatus = "Draft" | "Internal Review" | "Ready" | "Sent" | "Won" | "Lost";

export const proposals: {
  id: string;
  title: string;
  client: string;
  value: string;
  status: ProposalStatus;
  by: string;
  edited: string;
  theme: Theme;
}[] = [
  {
    id: "abc-bank",
    title: "Enterprise Software Proposal",
    client: "ABC Bank",
    value: "$2.4M",
    status: "Internal Review",
    by: "Lena Ortiz",
    edited: "1h ago",
    theme: "ink",
  },
  {
    id: "xyz-telecom",
    title: "Digital Transformation Proposal",
    client: "XYZ Telecom",
    value: "$5.1M",
    status: "Sent",
    by: "Ahmed Raza",
    edited: "Yesterday",
    theme: "brand",
  },
  {
    id: "global-ind",
    title: "Consulting Proposal",
    client: "Global Industries",
    value: "$860K",
    status: "Won",
    by: "Sara Malik",
    edited: "Sep 22",
    theme: "editorial",
  },
  {
    id: "gov-tech",
    title: "Government Technology Proposal",
    client: "Ministry of IT",
    value: "$3.2M",
    status: "Draft",
    by: "Omar Shah",
    edited: "Sep 19",
    theme: "light",
  },
  {
    id: "partner",
    title: "Partnership Proposal",
    client: "Northwind Cloud",
    value: "$1.1M",
    status: "Ready",
    by: "Priya Nair",
    edited: "Sep 15",
    theme: "brand",
  },
  {
    id: "retail",
    title: "Analytics Platform Proposal",
    client: "Meridian Retail",
    value: "$640K",
    status: "Lost",
    by: "Adil Gillani",
    edited: "Sep 02",
    theme: "light",
  },
];

export const proposalSections = [
  "Cover",
  "Executive Summary",
  "About Us",
  "Client Understanding",
  "Challenges",
  "Proposed Solution",
  "Solution Architecture",
  "Scope of Work",
  "Implementation Roadmap",
  "Timeline",
  "Team",
  "Case Studies",
  "Commercial Proposal",
  "Expected Outcomes",
  "Next Steps",
];

export const transcriptScript = [
  { who: "Ahmed", text: "We should focus the next quarter on enterprise customers." },
  { who: "Sara", text: "I agree, but we need to reduce implementation time." },
  { who: "Omar", text: "Right now onboarding averages 41 days. Target should be under 21." },
  { who: "Ahmed", text: "Let's make that a decision — 21-day onboarding by end of Q4." },
  {
    who: "Priya",
    text: "We'll need two more solutions engineers to hit that. Budget is roughly $380K.",
  },
  { who: "Sara", text: "Can finance confirm the hiring budget by next Friday?" },
  { who: "Lena", text: "Pipeline for banking is up 34%. ABC Bank alone is a $2.4M opportunity." },
  { who: "Omar", text: "Risk: the EU data region won't be ready before January." },
  { who: "Ahmed", text: "Then we position private AI mode for European banks in the meantime." },
  { who: "Priya", text: "I'll own the enablement deck for the sales team." },
  { who: "Sara", text: "Let's review progress in two weeks with the full leadership team." },
];

export const actionItems = [
  { task: "Confirm solutions engineering hiring budget", owner: "Priya Nair", due: "Oct 9" },
  { task: "Ship 21-day onboarding playbook", owner: "Omar Shah", due: "Oct 30" },
  { task: "Build enterprise sales enablement deck", owner: "Priya Nair", due: "Oct 14" },
  { task: "Finalise ABC Bank proposal", owner: "Lena Ortiz", due: "Oct 7" },
  { task: "Private AI positioning for EU banks", owner: "Ahmed Raza", due: "Oct 16" },
  { task: "Leadership progress review", owner: "Sara Malik", due: "Oct 16" },
  { task: "EU data region delivery plan", owner: "Omar Shah", due: "Oct 12" },
];

export const team = [
  { name: "Adil Gillani", email: "adil@acme.com", role: "Owner", dept: "Executive", active: "Now" },
  { name: "Sara Malik", email: "sara@acme.com", role: "Admin", dept: "Strategy", active: "5m ago" },
  { name: "Ahmed Raza", email: "ahmed@acme.com", role: "Editor", dept: "Sales", active: "1h ago" },
  { name: "Lena Ortiz", email: "lena@acme.com", role: "Editor", dept: "Sales", active: "2h ago" },
  {
    name: "Omar Shah",
    email: "omar@acme.com",
    role: "Brand manager",
    dept: "Marketing",
    active: "Yesterday",
  },
  {
    name: "Priya Nair",
    email: "priya@acme.com",
    role: "Viewer",
    dept: "Finance",
    active: "3d ago",
  },
];

export const initials = (n: string) =>
  n
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2);

/* ---------- Extended mock data ---------- */

export const meetingSlides: Slide[] = [
  {
    id: "m1",
    kind: "title",
    title: "Q4 Strategy Meeting",
    subtitle: "Meeting overview · Oct 2, 2026 · 6 participants",
  },
  {
    id: "m2",
    kind: "split",
    title: "Executive summary",
    bullets: [
      "Focus Q4 on enterprise customers",
      "Cut onboarding from 41 to 21 days",
      "Position Private AI for EU banks",
    ],
  },
  {
    id: "m3",
    kind: "agenda",
    title: "Key discussion points",
    bullets: [
      "Enterprise focus",
      "Implementation speed",
      "Hiring budget",
      "Banking pipeline",
      "EU data region",
    ],
  },
  {
    id: "m4",
    kind: "grid",
    title: "Decisions made",
    bullets: ["21-day onboarding", "Hire 2 SEs", "Private AI for EU", "Bi-weekly review"],
  },
  {
    id: "m5",
    kind: "comparison",
    title: "Strategic priorities",
    bullets: ["Enterprise-first GTM", "Faster time to value", "Regulated-industry trust"],
  },
  {
    id: "m6",
    kind: "metrics",
    title: "Important data",
    metrics: [
      { label: "Onboarding today", value: "41d" },
      { label: "Target", value: "21d" },
      { label: "Banking pipeline", value: "+34%" },
    ],
  },
  {
    id: "m7",
    kind: "split",
    title: "Challenges",
    bullets: [
      "EU region not ready before Jan",
      "Solutions engineer capacity",
      "Onboarding playbook gaps",
    ],
  },
  { id: "m8", kind: "chart", title: "Opportunities", subtitle: "Banking pipeline, $M" },
  {
    id: "m9",
    kind: "timeline",
    title: "Action plan",
    bullets: [
      "Oct 7 — ABC Bank proposal",
      "Oct 9 — Budget confirmed",
      "Oct 16 — Leadership review",
      "Oct 30 — Playbook live",
    ],
  },
  {
    id: "m10",
    kind: "title",
    title: "Next steps",
    subtitle: "Review progress in two weeks with the full leadership team",
  },
];

export const meetingHistory = [
  {
    id: "mt-1",
    title: "Q3 Board Prep",
    date: "Sep 29",
    duration: "52 min",
    people: 5,
    outputs: ["Notes", "Deck"],
  },
  {
    id: "mt-2",
    title: "ABC Bank Discovery Call",
    date: "Sep 26",
    duration: "38 min",
    people: 4,
    outputs: ["Notes"],
  },
  {
    id: "mt-3",
    title: "Product Roadmap Sync",
    date: "Sep 24",
    duration: "1h 04m",
    people: 9,
    outputs: ["Notes", "Deck"],
  },
  {
    id: "mt-4",
    title: "Weekly Leadership",
    date: "Sep 22",
    duration: "45 min",
    people: 7,
    outputs: ["Notes"],
  },
];

export const decisions = [
  "Make 21-day onboarding a Q4 commitment",
  "Hire two additional solutions engineers (~$380K)",
  "Position Private AI mode for European banks until the EU region ships",
];
export const risks = [
  "EU data region will not be ready before January",
  "Solutions engineering capacity limits onboarding speed",
];
export const openQuestions = [
  "Can finance confirm the hiring budget by next Friday?",
  "Which EU banks are first in line for Private AI?",
  "Does the 21-day target apply to regulated customers?",
];
export const quotes = [
  { who: "Ahmed Raza", text: "Let's make that a decision — 21-day onboarding by end of Q4." },
  { who: "Lena Ortiz", text: "ABC Bank alone is a $2.4M opportunity." },
];

export const presentationTypes = [
  "Investor Deck",
  "Board Presentation",
  "Sales Presentation",
  "Company Overview",
  "Annual Report",
  "Strategy Presentation",
  "Product Launch",
  "Training",
  "Market Analysis",
  "Custom",
];
export const lengths = ["5 slides", "8 slides", "10 slides", "12 slides", "15 slides", "Custom"];
export const audiences = [
  "Executives",
  "Investors",
  "Customers",
  "Employees",
  "Partners",
  "General",
];
export const tones = ["Executive", "Premium", "Minimal", "Bold", "Data-driven", "Storytelling"];

export const visualStyles: {
  id: string;
  name: string;
  blurb: string;
  themes: Theme[];
  kinds: SlideKind[];
}[] = [
  {
    id: "executive",
    name: "Executive",
    blurb: "Minimal, structured, consulting-style.",
    themes: ["light", "light", "light", "light"],
    kinds: ["title", "metrics", "agenda", "chart"],
  },
  {
    id: "premium",
    name: "Premium",
    blurb: "High-end cinematic business presentation.",
    themes: ["ink", "ink", "ink", "ink"],
    kinds: ["title", "quote", "split", "metrics"],
  },
  {
    id: "modern",
    name: "Modern",
    blurb: "Bold typography, clean layouts, contemporary startup style.",
    themes: ["brand", "brand", "brand", "brand"],
    kinds: ["title", "grid", "timeline", "comparison"],
  },
  {
    id: "editorial",
    name: "Editorial",
    blurb: "Sophisticated magazine-inspired layouts.",
    themes: ["editorial", "editorial", "editorial", "editorial"],
    kinds: ["title", "split", "quote", "chart"],
  },
];

export const layouts: { id: string; name: string; kind: SlideKind }[] = [
  { id: "hero", name: "Hero", kind: "title" },
  { id: "split", name: "Split", kind: "split" },
  { id: "grid", name: "Grid", kind: "grid" },
  { id: "timeline", name: "Timeline", kind: "timeline" },
  { id: "comparison", name: "Comparison", kind: "comparison" },
  { id: "metrics", name: "Metrics", kind: "metrics" },
  { id: "full", name: "Full image", kind: "split" },
  { id: "chart", name: "Chart", kind: "chart" },
  { id: "process", name: "Process", kind: "agenda" },
  { id: "quote", name: "Quote", kind: "quote" },
  { id: "ba", name: "Before / After", kind: "comparison" },
  { id: "table", name: "Table", kind: "list" },
];

export const proposalClientIntel = {
  industry: "Banking",
  size: "Enterprise · 12,000 employees",
  priorities: ["Digital transformation", "Cost reduction", "Customer experience"],
};

export const proposalAiActions = [
  "Make proposal more persuasive",
  "Make it more executive",
  "Reduce text",
  "Add visual storytelling",
  "Add implementation roadmap",
  "Improve executive summary",
  "Strengthen value proposition",
  "Create pricing comparison",
  "Add case study",
  "Rewrite for this client",
];

export const templateCategories = [
  "All",
  "Investor",
  "Board",
  "Sales",
  "Consulting",
  "Finance",
  "Marketing",
  "Product",
  "Strategy",
  "HR",
  "Government",
  "Proposals",
  "Meeting summaries",
];
const tk: SlideKind[] = [
  "title",
  "metrics",
  "split",
  "chart",
  "timeline",
  "grid",
  "quote",
  "comparison",
  "agenda",
];
const tt: Theme[] = ["ink", "light", "brand", "editorial"];
export const templates = templateCategories.slice(1).flatMap((c, ci) => [
  {
    id: `${c}-1`,
    name: `${c} — Signature`,
    category: c,
    status: "Approved" as const,
    uses: 120 - ci * 7,
    theme: tt[ci % 4]!,
    kind: tk[ci % 9]!,
  },
  {
    id: `${c}-2`,
    name: `${c} — Minimal`,
    category: c,
    status: (ci % 4 === 0 ? "Restricted" : ci % 3 === 0 ? "Draft" : "Approved") as
      "Approved" | "Restricted" | "Draft",
    uses: 64 - ci * 3,
    theme: tt[(ci + 2) % 4]!,
    kind: tk[(ci + 4) % 9]!,
  },
]);

export const assetCategories = [
  "All",
  "Images",
  "Logos",
  "Icons",
  "Charts",
  "Videos",
  "Documents",
  "Brand Assets",
  "Templates",
];
export const assets = Array.from({ length: 24 }, (_, i) => {
  const cat = assetCategories[1 + (i % 8)]!;
  return {
    id: `a${i}`,
    name: `${cat.replace(/s$/, "")}_${String(i + 1).padStart(2, "0")}`,
    category: cat,
    size: `${(1.2 + ((i * 0.37) % 6)).toFixed(1)} MB`,
    hue: (i * 47) % 360,
  };
});

export const libraryDocs = [
  {
    name: "Acme Company Overview 2026.pdf",
    type: "Company information",
    size: "4.2 MB",
    updated: "Sep 30",
    status: "Indexed",
  },
  {
    name: "Atlas 4 Product Sheet.pdf",
    type: "Product information",
    size: "1.8 MB",
    updated: "Sep 28",
    status: "Indexed",
  },
  {
    name: "Global Bank Case Study.pptx",
    type: "Case studies",
    size: "12 MB",
    updated: "Sep 20",
    status: "Indexed",
  },
  {
    name: "Approved Messaging Framework.docx",
    type: "Approved messaging",
    size: "320 KB",
    updated: "Sep 14",
    status: "Indexed",
  },
  {
    name: "Enterprise Sales Playbook.pdf",
    type: "Sales materials",
    size: "6.1 MB",
    updated: "Sep 02",
    status: "Indexed",
  },
  {
    name: "Brand Guidelines v4.pdf",
    type: "Brand guidelines",
    size: "18 MB",
    updated: "Aug 21",
    status: "Indexed",
  },
  {
    name: "Northwind Proposal (won).pdf",
    type: "Proposal examples",
    size: "3.4 MB",
    updated: "Aug 09",
    status: "Processing",
  },
];

export const analyticsSeries = [
  { m: "Apr", decks: 42, proposals: 12, meetings: 18 },
  { m: "May", decks: 58, proposals: 15, meetings: 26 },
  { m: "Jun", decks: 66, proposals: 21, meetings: 34 },
  { m: "Jul", decks: 71, proposals: 24, meetings: 47 },
  { m: "Aug", decks: 94, proposals: 31, meetings: 63 },
  { m: "Sep", decks: 118, proposals: 38, meetings: 82 },
];

export const auditLog = [
  { who: "Sara Malik", what: "Updated brand colors", when: "2h ago" },
  { who: "Adil Gillani", what: "Enabled Private AI mode", when: "Yesterday" },
  { who: "Omar Shah", what: "Approved template 'Board — Signature'", when: "Sep 29" },
  { who: "System", what: "SCIM sync completed (142 users)", when: "Sep 28" },
];
