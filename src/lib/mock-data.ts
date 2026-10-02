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
  | "comparison";

export type Theme = "ink" | "light" | "brand" | "editorial";

export interface Slide {
  id: string;
  kind: SlideKind;
  title: string;
  subtitle?: string;
  bullets?: string[];
  metrics?: { label: string; value: string }[];
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
  { id: "q3-board-review", title: "Q3 Board Review", author: "Sara Malik", edited: "2h ago", status: "Approved", theme: "ink", slides: 18, lastPresented: "Sep 28, 2026", cover: "title" },
  { id: "series-b", title: "Series B Investor Presentation", author: "Ahmed Raza", edited: "Yesterday", status: "In review", theme: "brand", slides: 14, cover: "metrics" },
  { id: "strategy-2027", title: "Annual Strategy 2027", author: "Adil Gillani", edited: "3 days ago", status: "Draft", theme: "editorial", slides: 22, cover: "title" },
  { id: "enterprise-sales", title: "Enterprise Sales Proposal", author: "Lena Ortiz", edited: "Sep 24", status: "Presented", theme: "light", slides: 12, lastPresented: "Sep 25, 2026", cover: "chart" },
  { id: "product-launch", title: "Product Launch — Atlas 4", author: "Omar Shah", edited: "Sep 20", status: "Approved", theme: "brand", slides: 16, cover: "split" },
  { id: "market-analysis", title: "Market Analysis H2", author: "Priya Nair", edited: "Sep 18", status: "Draft", theme: "light", slides: 10, cover: "chart" },
];

export const deckSlides: Slide[] = [
  { id: "s1", kind: "title", title: "Q3 Board Review", subtitle: "Performance, priorities and the path to FY27" },
  { id: "s2", kind: "agenda", title: "Agenda", bullets: ["Quarter in review", "Financial performance", "Go-to-market", "Product roadmap", "Risks & asks"] },
  { id: "s3", kind: "metrics", title: "A record quarter", metrics: [{ label: "ARR", value: "$48.2M" }, { label: "Net retention", value: "128%" }, { label: "Gross margin", value: "81%" }] },
  { id: "s4", kind: "chart", title: "Revenue growth accelerated", subtitle: "Quarterly ARR, $M" },
  { id: "s5", kind: "split", title: "Enterprise is our growth engine", bullets: ["62% of new ARR from Fortune 1000", "Sales cycle down 18 days", "Implementation time halved"] },
  { id: "s6", kind: "timeline", title: "Roadmap to FY27", bullets: ["Q4 — Atlas 4", "Q1 — EU region", "Q2 — Private AI", "Q3 — Marketplace"] },
  { id: "s7", kind: "comparison", title: "Where we win", bullets: ["Brand-locked output", "Enterprise security", "Meeting intelligence"] },
  { id: "s8", kind: "quote", title: "“The first AI tool our brand team actually trusts.”", subtitle: "CMO, Global Bank" },
  { id: "s9", kind: "grid", title: "Strategic priorities", bullets: ["Enterprise", "Platform", "Partners", "Talent"] },
  { id: "s10", kind: "title", title: "Asks of the board", subtitle: "Approve FY27 plan and EU expansion" },
];

export type ProposalStatus = "Draft" | "Internal Review" | "Ready" | "Sent" | "Won" | "Lost";

export const proposals: { id: string; title: string; client: string; value: string; status: ProposalStatus; by: string; edited: string; theme: Theme }[] = [
  { id: "abc-bank", title: "Enterprise Software Proposal", client: "ABC Bank", value: "$2.4M", status: "Internal Review", by: "Lena Ortiz", edited: "1h ago", theme: "ink" },
  { id: "xyz-telecom", title: "Digital Transformation Proposal", client: "XYZ Telecom", value: "$5.1M", status: "Sent", by: "Ahmed Raza", edited: "Yesterday", theme: "brand" },
  { id: "global-ind", title: "Consulting Proposal", client: "Global Industries", value: "$860K", status: "Won", by: "Sara Malik", edited: "Sep 22", theme: "editorial" },
  { id: "gov-tech", title: "Government Technology Proposal", client: "Ministry of IT", value: "$3.2M", status: "Draft", by: "Omar Shah", edited: "Sep 19", theme: "light" },
  { id: "partner", title: "Partnership Proposal", client: "Northwind Cloud", value: "$1.1M", status: "Ready", by: "Priya Nair", edited: "Sep 15", theme: "brand" },
  { id: "retail", title: "Analytics Platform Proposal", client: "Meridian Retail", value: "$640K", status: "Lost", by: "Adil Gillani", edited: "Sep 02", theme: "light" },
];

export const proposalSections = [
  "Cover", "Executive Summary", "About Us", "Client Understanding", "Challenges", "Proposed Solution",
  "Solution Architecture", "Scope of Work", "Implementation Roadmap", "Timeline", "Team",
  "Case Studies", "Commercial Proposal", "Expected Outcomes", "Next Steps",
];

export const transcriptScript = [
  { who: "Ahmed", text: "We should focus the next quarter on enterprise customers." },
  { who: "Sara", text: "I agree, but we need to reduce implementation time." },
  { who: "Omar", text: "Right now onboarding averages 41 days. Target should be under 21." },
  { who: "Ahmed", text: "Let's make that a decision — 21-day onboarding by end of Q4." },
  { who: "Priya", text: "We'll need two more solutions engineers to hit that. Budget is roughly $380K." },
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
  { name: "Omar Shah", email: "omar@acme.com", role: "Brand manager", dept: "Marketing", active: "Yesterday" },
  { name: "Priya Nair", email: "priya@acme.com", role: "Viewer", dept: "Finance", active: "3d ago" },
];

export const initials = (n: string) => n.split(" ").map((p) => p[0]).join("").slice(0, 2);
