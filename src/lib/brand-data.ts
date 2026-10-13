// Brand systems, brand-scoped assets and document templates.
// Mock seed data — replace with API calls (brand service, asset storage, template parser) later.
import type { Theme } from "@/lib/mock-data";
import stixorLogoSvg from "@/assets/brands/stixor/stixor-logo.svg?raw";
import stixorLogoReversedSvg from "@/assets/brands/stixor/stixor-logo-reversed.svg?raw";
import stixorMarkSvg from "@/assets/brands/stixor/stixor-mark.svg?raw";

const svgData = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;

export type ColorRole = "primary" | "secondary" | "accent" | "background" | "text" | "custom";
export interface BrandColor {
  name: string;
  hex: string;
  role?: ColorRole;
}

/** Derives the slide palette from color roles (falls back to list position for legacy data). */
export function paletteOf(colors: BrandColor[]): BrandSystem["slide"] {
  const byRole = (r: ColorRole) => colors.find((c) => c.role === r)?.hex;
  const primary = byRole("primary") ?? colors[0]?.hex ?? "#1C1D21";
  return {
    a: byRole("text") ?? (colors.some((c) => c.role) ? primary : (colors[1]?.hex ?? primary)),
    b: primary,
    c: byRole("accent") ?? byRole("secondary") ?? colors[2]?.hex ?? primary,
    d: byRole("background") ?? colors[3]?.hex ?? "#F5F5F3",
  };
}

/** Rules extracted from a brand-guidelines document. The AI applies these to everything it generates. */
export interface BrandGuidelines {
  fileName: string;
  pages: number;
  uploadedAt: string;
  /** "extracted" = curated from the brand's real guideline; "auto" = demo extraction from an upload */
  source: "extracted" | "auto";
  principle?: string;
  voice: { title: string; text: string }[];
  dos: string[];
  donts: string[];
  examples: { say: string; avoid: string }[];
  colorUsage: { name: string; hex: string; role: string; share: number }[];
  typography: { role: string; font: string; usage: string }[];
  logoRules: string[];
  imagery: string[];
  /** Hedging / fluff words the AI strips from generated copy. */
  bannedWords: string[];
}

export interface BrandSystem {
  id: string;
  name: string;
  initials: string;
  industry: string;
  website: string;
  tagline: string;
  description: string;
  mission: string;
  colors: BrandColor[];
  headingFont: string;
  bodyFont: string;
  dataFont: string;
  /** Slide palette: a = deep, b = primary, c = accent, d = paper */
  slide: { a: string; b: string; c: string; d: string };
  tone: string;
  imageStyle: string;
  chartStyle: string;
  updated: string;
  /** Data URLs. `reversed` is used on dark slides; falls back to `primary`. */
  logos?: BrandLogos | undefined;
  guidelines?: BrandGuidelines | undefined;
}

export interface BrandLogos {
  primary?: string;
  reversed?: string;
  favicon?: string;
}

export const logoSlots: { key: keyof BrandLogos; label: string; hint: string }[] = [
  { key: "primary", label: "Primary logo", hint: "Used on light backgrounds" },
  { key: "reversed", label: "Reversed logo", hint: "Used on dark slides & covers" },
  { key: "favicon", label: "Favicon / mark", hint: "Square icon, app & cards" },
];

/** Builds a simple wordmark SVG so seed brands have real logo files. */
function svgLogo(name: string, initials: string, mark: string, accent: string, text: string) {
  const w = 64 + name.length * 12;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="48" viewBox="0 0 ${w} 48"><rect x="0" y="4" width="40" height="40" rx="9" fill="${mark}"/><rect x="28" y="10" width="7" height="7" rx="2" fill="${accent}"/><text x="7" y="30" font-family="Inter,Helvetica,Arial,sans-serif" font-size="14" font-weight="700" fill="#ffffff">${initials}</text><text x="52" y="32" font-family="Inter,Helvetica,Arial,sans-serif" font-size="21" font-weight="600" letter-spacing="-0.3" fill="${text}">${name}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
function svgMark(initials: string, mark: string, accent: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${mark}"/><rect x="44" y="9" width="11" height="11" rx="3" fill="${accent}"/><text x="11" y="42" font-family="Inter,Helvetica,Arial,sans-serif" font-size="22" font-weight="700" fill="#ffffff">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
const seedLogos = (
  name: string,
  initials: string,
  primary: string,
  deep: string,
  accent: string,
): BrandLogos => ({
  primary: svgLogo(name, initials, primary, accent, deep),
  reversed: svgLogo(name, initials, primary, accent, "#ffffff"),
  favicon: svgMark(initials, primary, accent),
});

const c = (p: string, s: string, a: string, bg: string, t: string): BrandColor[] => [
  { name: "Primary", hex: p, role: "primary" },
  { name: "Secondary", hex: s, role: "secondary" },
  { name: "Accent", hex: a, role: "accent" },
  { name: "Background", hex: bg, role: "background" },
  { name: "Text", hex: t, role: "text" },
];

export const seedBrands: BrandSystem[] = [
  {
    id: "acme",
    name: "Acme Corporation",
    initials: "AC",
    industry: "Enterprise Software",
    website: "acme.com",
    tagline: "The brand-safe AI platform for enterprise communication",
    description:
      "Acme builds enterprise software that helps regulated organizations communicate with clarity and consistency.",
    mission: "Make every business communication on-brand, accurate and effortless.",
    colors: c("#2F5BD3", "#1B2A4A", "#E3B866", "#F6F4EF", "#1C1D21"),
    guidelines: {
      fileName: "Brand Guidelines v4.pdf",
      pages: 64,
      uploadedAt: "2026-08-21T09:00:00Z",
      source: "extracted",
      principle: "Confident and clear — never clever for its own sake.",
      voice: [
        { title: "Confident.", text: "State outcomes plainly and back them with numbers." },
        { title: "Clear.", text: "One idea per sentence; no acronyms without expansion." },
      ],
      dos: ["Lead with the customer outcome.", "Use sentence case for headings."],
      donts: ["Avoid superlatives.", "Never use the logo on photography without a scrim."],
      examples: [],
      colorUsage: [
        { name: "Acme Blue", hex: "#2F5BD3", role: "Primary", share: 30 },
        { name: "Navy", hex: "#1B2A4A", role: "Secondary", share: 20 },
        { name: "Paper", hex: "#F6F4EF", role: "Background", share: 45 },
        { name: "Gold", hex: "#E3B866", role: "Accent", share: 5 },
      ],
      typography: [
        { role: "Headings", font: "Instrument Serif", usage: "Display and slide titles" },
        { role: "Body", font: "Geist", usage: "Paragraphs and UI" },
        { role: "Data", font: "Geist Mono", usage: "Figures and tables" },
      ],
      logoRules: [
        "Minimum clear space equals the height of the mark.",
        "Use the reversed logo on navy and photography.",
      ],
      imagery: ["Editorial photography with natural light."],
      bannedWords: ["revolutionary", "best-in-class", "synergy"],
    },
    headingFont: "Instrument Serif",
    bodyFont: "Geist",
    dataFont: "Geist Mono",
    slide: { a: "#1B2A4A", b: "#2F5BD3", c: "#E3B866", d: "#F3F1EC" },
    tone: "Confident / Clear",
    imageStyle: "Editorial",
    chartStyle: "Minimal",
    updated: "Today",
    logos: seedLogos("Acme", "AC", "#2F5BD3", "#1B2A4A", "#E3B866"),
  },
  {
    // Source of truth: "Brand Guideline Stixor.pdf" (2025) + official logo SVG.
    id: "stixor",
    name: "Stixor",
    initials: "SX",
    industry: "Technology & Software Development",
    website: "stixor.com",
    tagline: "Engineered clarity",
    description:
      "We help businesses solve complex problems by combining technology, design, and strategy. Using the latest frameworks and tools, we deliver innovative solutions across industries, including Software Development, AI, AR/VR, Web Development, Big Data, Blockchain, Game Development, and IoT.",
    mission:
      "Forward-thinking, practical, and focused on creating measurable impact for our clients.",
    colors: [
      { name: "Deep Charcoal", hex: "#2B2B2B", role: "primary" },
      { name: "Warm Orange", hex: "#E97B50", role: "secondary" },
      { name: "Light Ivory", hex: "#F5F5F3", role: "background" },
    ],
    headingFont: "Helvetica Neue",
    bodyFont: "Inter",
    dataFont: "DM Mono",
    slide: { a: "#2B2B2B", b: "#2B2B2B", c: "#E97B50", d: "#F5F5F3" },
    tone: "Confident & Direct",
    imageStyle: "Candid",
    chartStyle: "Minimal",
    updated: "Today",
    logos: {
      primary: svgData(stixorLogoSvg),
      reversed: svgData(stixorLogoReversedSvg),
      favicon: svgData(stixorMarkSvg),
    },
    guidelines: {
      fileName: "Brand Guideline Stixor.pdf",
      pages: 29,
      uploadedAt: "2026-10-02T09:00:00Z",
      source: "extracted",
      principle:
        "Engineered Clarity — strip away the fluff to reveal the logic. Don't just claim things work; explain how, with precision.",
      voice: [
        {
          title: "Precise, not Pedantic.",
          text: "Accuracy above all. Specific terminology when necessary, never jargon to confuse or intimidate — every word earns its place.",
        },
        {
          title: "Confident & Direct.",
          text: "Lead with the solution. No passive voice or hedging words like “maybe”, “sort of” or “hopefully”. We are the experts in the room.",
        },
        {
          title: "Human, but Professional.",
          text: "Technical, not robotic. Speak to the people behind the technology — helpful partners, not cold manuals.",
        },
      ],
      dos: [
        "Use simple, active language.",
        "Focus on solutions and impact.",
        "Keep messaging consistent with brand values.",
        "Be clear, transparent, and client-focused.",
      ],
      donts: [
        "Don’t use overly technical jargon without explanation.",
        "Avoid vague marketing fluff.",
        "Don’t make promises we can’t deliver.",
      ],
      examples: [
        {
          say: "The latency reduced by 200ms.",
          avoid: "The system is now blazing fast and super optimized.",
        },
        {
          say: "Implement this patch to secure the database.",
          avoid: "You might want to try looking at the database security if you have time.",
        },
        {
          say: "Automate your manual data entry with 99% accuracy.",
          avoid: "Revolutionize your workflow with our game-changing AI solutions.",
        },
      ],
      colorUsage: [
        { name: "Deep Charcoal", hex: "#2B2B2B", role: "Primary — contrast & emphasis", share: 50 },
        {
          name: "Light Ivory",
          hex: "#F5F5F3",
          role: "Background — primary focus colour",
          share: 40,
        },
        {
          name: "Warm Orange",
          hex: "#E97B50",
          role: "Secondary — accent for focal points",
          share: 10,
        },
      ],
      typography: [
        { role: "Headings", font: "Helvetica Neue", usage: "Medium · Large 1–6 (83 → 33pt)" },
        { role: "Body", font: "Inter", usage: "Regular · paragraphs and UI copy" },
        { role: "Utility", font: "DM Mono", usage: "Tables, taglines and labels (23 → 11pt)" },
      ],
      logoRules: [
        "Primary logos appear on light backgrounds using dark colours.",
        "Orange is an accent — never a background.",
        "Use the reversed (light) lockup on Deep Charcoal.",
        "Use the icon-only mark when space is limited.",
        "Maintain proportions and clear space around the logo.",
      ],
      imagery: [
        "Real interactions, diverse teams and natural moments — no posed stock photos.",
        "Feature South Asian (particularly Pakistani) or Arab individuals.",
        "Apply a light orange overlay to all images.",
        "Hexagon graphic elements are used selectively on key touchpoints.",
      ],
      bannedWords: [
        "maybe",
        "sort of",
        "hopefully",
        "super",
        "amazing",
        "game-changing",
        "revolutionize",
        "blazing fast",
        "thrilled",
        "oopsie",
      ],
    },
  },
  {
    id: "furviax",
    name: "Furviax",
    initials: "FV",
    industry: "Consumer & Lifestyle",
    website: "furviax.co",
    tagline: "Considered products for modern living",
    description:
      "Furviax designs premium lifestyle products sold through flagship stores and selected retail partners.",
    mission: "Make everyday objects quietly exceptional.",
    colors: c("#7A1F3D", "#2B1A22", "#E8B4A0", "#FAF5F0", "#21161B"),
    headingFont: "Fraunces",
    bodyFont: "Inter",
    dataFont: "Geist Mono",
    slide: { a: "#2B1A22", b: "#7A1F3D", c: "#E8B4A0", d: "#FAF3EE" },
    tone: "Warm / Refined",
    imageStyle: "Candid",
    chartStyle: "Minimal",
    updated: "Sep 24",
    logos: seedLogos("Furviax", "FV", "#7A1F3D", "#2B1A22", "#E8B4A0"),
  },
];

/* ---------- Document templates (Proposal Studio) ---------- */

export const templateTypes = [
  "Proposal",
  "Letterhead",
  "Presentation",
  "PowerPoint",
  "Business Document",
] as const;
export type TemplateType = (typeof templateTypes)[number];

export interface DocTemplate {
  id: string;
  name: string;
  type: TemplateType;
  format: string;
  brandId: string;
  pages: number;
  updated: string;
  by: string;
  source: "Uploaded" | "Built-in";
  theme: Theme;
  /** The brand's default template — preselected whenever this brand generates. */
  isDefault?: boolean;
  /** Original file the template was built from. */
  sourceFile?: string;
}

/** Slide-shaped templates render as 16:9 slides; the rest as A4 documents. */
export const isSlideTemplate = (t: Pick<DocTemplate, "type">) =>
  t.type === "Presentation" || t.type === "PowerPoint";

/** Heuristic auto-classification from a file name. A real backend would inspect the file's structure. */
export function classifyTemplate(fileName: string): TemplateType {
  const n = fileName.toLowerCase();
  const ext = n.split(".").pop() ?? "";
  if (ext === "ppt" || ext === "pptx" || ext === "potx") return "PowerPoint";
  if (ext === "key" || /deck|pitch|slides|presentation|keynote/.test(n)) return "Presentation";
  if (/letterhead|letter|stationery/.test(n)) return "Letterhead";
  if (/proposal|rfp|bid|tender|quote|sow/.test(n)) return "Proposal";
  return "Business Document";
}

export const formatOf = (fileName: string) =>
  "." + (fileName.split(".").pop() ?? "file").toLowerCase();

const t = (
  brandId: string,
  name: string,
  type: TemplateType,
  format: string,
  pages: number,
  theme: Theme,
  updated: string,
  by: string,
  source: DocTemplate["source"] = "Uploaded",
): DocTemplate => ({
  id: `${brandId}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  name,
  type,
  format,
  brandId,
  pages,
  updated,
  by,
  source,
  theme,
});

export const seedDocTemplates: DocTemplate[] = [
  t("acme", "Acme Proposal — Standard", "Proposal", ".docx", 18, "brand", "Sep 30", "Lena Ortiz"),
  t("acme", "Acme Letterhead", "Letterhead", ".docx", 1, "light", "Sep 12", "Omar Shah"),
  t("acme", "Acme Board Deck", "PowerPoint", ".pptx", 24, "ink", "Sep 28", "Sara Malik"),
  t(
    "acme",
    "Acme Statement of Work",
    "Business Document",
    ".pdf",
    9,
    "light",
    "Aug 30",
    "Lena Ortiz",
  ),
  t(
    "acme",
    "Acme Executive Pitch",
    "Presentation",
    ".key",
    14,
    "brand",
    "Aug 21",
    "Ahmed Raza",
    "Built-in",
  ),
  t("stixor", "Stixor Technical Proposal", "Proposal", ".docx", 22, "ink", "Today", "Fawaz Ahmed"),
  t("stixor", "Stixor Letterhead", "Letterhead", ".docx", 1, "light", "Sep 27", "Fawaz Ahmed"),
  {
    ...t(
      "stixor",
      "Stixor Presentation Template",
      "PowerPoint",
      ".pptx",
      21,
      "signature",
      "Today",
      "Fawaz Ahmed",
    ),
    isDefault: true,
    sourceFile: "WorkAI_Platform_Technical_Deck.pptx",
  },
  t(
    "stixor",
    "Stixor Project Brief",
    "Business Document",
    ".docx",
    6,
    "light",
    "Sep 18",
    "Adil Gillani",
  ),
  t(
    "furviax",
    "Furviax Partnership Proposal",
    "Proposal",
    ".pdf",
    12,
    "editorial",
    "Sep 22",
    "Priya Nair",
  ),
  t("furviax", "Furviax Letterhead", "Letterhead", ".docx", 1, "editorial", "Sep 10", "Priya Nair"),
  t("furviax", "Furviax Keynote", "Presentation", ".key", 20, "ink", "Sep 06", "Omar Shah"),
  t(
    "furviax",
    "Furviax Quarterly Review",
    "PowerPoint",
    ".pptx",
    18,
    "editorial",
    "Aug 28",
    "Omar Shah",
  ),
];

/* ---------- Brand-scoped asset library ---------- */

export const brandAssetCategories = [
  "Logos",
  "Images",
  "Icons",
  "Templates",
  "Presentation assets",
  "Document assets",
  "Guidelines",
] as const;
export type BrandAssetCategory = (typeof brandAssetCategories)[number];

export interface BrandAsset {
  id: string;
  brandId: string;
  name: string;
  category: BrandAssetCategory;
  size: string;
  hue: number;
}

const assetNames: Record<BrandAssetCategory, string[]> = {
  Logos: ["primary-logo.svg", "logo-dark.svg", "logo-light.svg", "favicon.png"],
  Images: [
    "hero-office.jpg",
    "team-workshop.jpg",
    "product-detail.jpg",
    "city-skyline.jpg",
    "client-meeting.jpg",
  ],
  Icons: ["icon-set-line.svg", "icon-set-solid.svg", "pictograms.svg"],
  Templates: ["proposal-template.docx", "board-deck.pptx"],
  "Presentation assets": ["chart-styles.pptx", "section-dividers.pptx", "data-tables.pptx"],
  "Document assets": ["letterhead.docx", "email-signature.html", "invoice-layout.docx"],
  Guidelines: ["brand-guidelines.pdf", "tone-of-voice.pdf"],
};
const brandHue: Record<string, number> = { acme: 250, stixor: 175, furviax: 350 };

export const seedBrandAssets: BrandAsset[] = seedBrands.flatMap((b) =>
  brandAssetCategories.flatMap((cat, ci) =>
    assetNames[cat].map((n, i) => ({
      id: `${b.id}-${cat}-${i}`,
      brandId: b.id,
      name: `${b.id}-${n}`,
      category: cat,
      size: `${(0.2 + ((ci * 7 + i * 3) % 9) * 0.7).toFixed(1)} MB`,
      hue: (brandHue[b.id] ?? 200) + i * 18 - ci * 6,
    })),
  ),
);

/** Layout templates available to every brand (rendered in the active brand's palette). */
export const builtinDeckTemplates: { id: string; name: string; blurb: string; theme: Theme }[] = [
  {
    id: "builtin-meeting-summary",
    name: "Meeting Summary",
    blurb: "Overview, decisions, actions — built for follow-ups.",
    theme: "brand",
  },
  {
    id: "builtin-executive-briefing",
    name: "Executive Briefing",
    blurb: "Minimal, structured, consulting-style.",
    theme: "light",
  },
  {
    id: "builtin-strategy-review",
    name: "Strategy Review",
    blurb: "Cinematic, high-contrast leadership review.",
    theme: "ink",
  },
];
