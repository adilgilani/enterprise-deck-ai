// Generated Content Library: a history of everything AI has produced.
// Replace with a server-side content store when generation runs on the backend.
import type { TemplateType } from "@/lib/brand-data";
import { workAiDeck } from "@/lib/workai-deck";
import {
  deckSlides,
  meetingSlides,
  proposalSections,
  type Slide,
  type Theme,
} from "@/lib/mock-data";

export type GeneratedKind = "Presentation" | "Proposal" | "Document";
export type GeneratedStatus = "Ready" | "Generating" | "Failed";

export interface GeneratedItem {
  id: string;
  name: string;
  kind: GeneratedKind;
  fileType: string;
  brandId: string;
  templateName: string;
  /** ISO timestamp */
  createdAt: string;
  status: GeneratedStatus;
  /** Where it came from, e.g. "Meeting · Product Launch Planning" */
  source?: string;
  theme: Theme;
  slides?: Slide[];
  doc?: { type: TemplateType; client: string; sections: string[] };
}

export const newGeneratedId = () =>
  `gen-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Maps a template's file extension to the file type of what it generates. */
export function fileTypeFor(format: string | undefined, kind: GeneratedKind) {
  const f = (format ?? "").replace(".", "").toUpperCase();
  if (f === "PPT" || f === "POTX") return "PPTX";
  if (f === "DOTX" || f === "DOC") return "DOCX";
  if (f) return f;
  return kind === "Presentation" ? "PPTX" : "DOCX";
}

export const seedGenerated: GeneratedItem[] = [
  {
    id: "gen-seed-q4-meeting",
    name: "Q4 Strategy Meeting — Deck",
    kind: "Presentation",
    fileType: "PPTX",
    brandId: "acme",
    templateName: "Meeting Summary",
    createdAt: "2026-10-01T15:42:00Z",
    status: "Ready",
    source: "Meeting · Q4 Strategy Meeting",
    theme: "brand",
    slides: meetingSlides,
  },
  {
    id: "gen-seed-abc-proposal",
    name: "Digital Transformation Program — ABC Bank",
    kind: "Proposal",
    fileType: "DOCX",
    brandId: "acme",
    templateName: "Acme Proposal — Standard",
    createdAt: "2026-09-30T10:05:00Z",
    status: "Ready",
    theme: "brand",
    doc: { type: "Proposal", client: "ABC Bank", sections: proposalSections },
  },
  {
    id: "gen-seed-q3-board",
    name: "Q3 Board Review",
    kind: "Presentation",
    fileType: "PPTX",
    brandId: "acme",
    templateName: "Acme Board Deck",
    createdAt: "2026-09-28T08:30:00Z",
    status: "Ready",
    theme: "ink",
    slides: deckSlides,
  },
  {
    id: "gen-seed-workai",
    name: "Work AI — Platform & Technical Deep-Dive",
    kind: "Presentation",
    fileType: "PPTX",
    brandId: "stixor",
    templateName: "Stixor Presentation Template",
    createdAt: "2026-09-26T13:12:00Z",
    status: "Ready",
    source: "Imported · WorkAI_Platform_Technical_Deck.pptx",
    theme: "signature",
    slides: workAiDeck,
  },
  {
    id: "gen-seed-furviax-letter",
    name: "Partnership Letter — Meridian Retail",
    kind: "Document",
    fileType: "DOCX",
    brandId: "furviax",
    templateName: "Furviax Letterhead",
    createdAt: "2026-09-22T09:00:00Z",
    status: "Ready",
    theme: "editorial",
    doc: { type: "Letterhead", client: "Meridian Retail", sections: ["Partnership Letter"] },
  },
  {
    id: "gen-seed-failed",
    name: "Market Analysis H2 — Draft",
    kind: "Presentation",
    fileType: "PPTX",
    brandId: "acme",
    templateName: "Executive Briefing",
    createdAt: "2026-09-18T16:20:00Z",
    status: "Failed",
    theme: "light",
    slides: deckSlides.slice(0, 6),
  },
];
