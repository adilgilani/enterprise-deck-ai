import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  BookCheck,
  Check,
  FileText,
  Loader2,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { BrandGuidelines, BrandSystem } from "@/lib/brand-data";
import type { VoiceReport } from "@/lib/meeting-ai";
import { actions, useActiveBrand } from "@/lib/store";
import { cn } from "@/lib/utils";

const extractSteps = [
  "Reading PDF",
  "Extracting voice & tone",
  "Extracting colour palette & usage",
  "Extracting typography",
  "Extracting logo usage rules",
  "Extracting imagery rules",
];

/** Counts pages in a PDF by scanning its object table — enough for a real page count without a parser. */
async function countPdfPages(file: File) {
  const text = new TextDecoder("latin1").decode(await file.arrayBuffer());
  return (text.match(/\/Type\s*\/Page(?!s)/g) ?? []).length || 1;
}

/** Demo extraction for brands without curated rules: derives rules from the brand profile. Swap for a document-AI call. */
function autoGuidelines(brand: BrandSystem, fileName: string, pages: number): BrandGuidelines {
  const share = Math.round(100 / Math.max(brand.colors.length, 1));
  return {
    fileName,
    pages,
    uploadedAt: new Date().toISOString(),
    source: "auto",
    principle: `${brand.tone}. ${brand.tagline}`.trim(),
    voice: brand.tone
      .split(/[/&·]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => ({
        title: `${t}.`,
        text: `Copy should read as ${t.toLowerCase()} in every presentation and document.`,
      })),
    dos: ["Use simple, active language.", "Lead with outcomes and evidence."],
    donts: ["Avoid vague marketing fluff.", "Don’t stretch, recolour or crop the logo."],
    examples: [],
    colorUsage: brand.colors.map((c) => ({
      name: c.name,
      hex: c.hex,
      role: c.role ?? "Brand colour",
      share,
    })),
    typography: [
      { role: "Headings", font: brand.headingFont, usage: "Titles and display" },
      { role: "Body", font: brand.bodyFont, usage: "Paragraphs" },
      { role: "Data", font: brand.dataFont, usage: "Tables and figures" },
    ],
    logoRules: [
      "Use the primary logo on light backgrounds.",
      "Use the reversed logo on dark backgrounds.",
      "Keep clear space around the logo.",
    ],
    imagery: [`${brand.imageStyle} photography.`],
    bannedWords: ["maybe", "sort of", "hopefully"],
  };
}

export function GuidelinesPanel({ brand }: { brand: BrandSystem }) {
  const g = brand.guidelines;
  const input = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name)) {
      toast.error("Upload a PDF", { description: "Brand guidelines must be a .pdf file." });
      return;
    }
    const pages = await countPdfPages(file);
    for (let i = 0; i <= extractSteps.length; i++) {
      setStep(i);
      await new Promise((r) => setTimeout(r, 320));
    }
    setStep(null);
    const next = g
      ? { ...g, fileName: file.name, pages, uploadedAt: new Date().toISOString() }
      : autoGuidelines(brand, file.name, pages);
    actions.updateBrand(brand.id, { guidelines: next });
    toast.success("Brand guidelines applied", {
      description: `${file.name} · ${pages} pages · used for every ${brand.name} output.`,
    });
  };

  const dropzone = (
    <div
      role="button"
      tabIndex={0}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => e.key === "Enter" && input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        void upload(e.dataTransfer.files[0]);
      }}
      className={cn(
        "grid cursor-pointer place-items-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
        drag ? "border-brand bg-brand-soft" : "hover:bg-muted/40",
      )}
    >
      <UploadCloud className="size-6 text-muted-foreground" />
      <div className="mt-3 text-[14px] font-medium">Upload {brand.name} brand guidelines</div>
      <p className="mt-1 max-w-md text-[12.5px] text-muted-foreground">
        PDF. Voice, colour usage, typography, logo and imagery rules are extracted and enforced on
        every presentation and document for this brand only.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {step !== null ? (
        <div className="surface p-6">
          <div className="flex items-center gap-2 text-[14px] font-medium">
            <Loader2 className="size-4 animate-spin text-brand" />
            Extracting brand rules…
          </div>
          <ol className="mt-4 space-y-2">
            {extractSteps.map((s, i) => (
              <li
                key={s}
                className={cn("flex items-center gap-2.5 text-[13px]", i > step && "text-subtle")}
              >
                {i < step ? (
                  <Check className="size-3.5 text-success" />
                ) : i === step ? (
                  <Loader2 className="size-3.5 animate-spin text-brand" />
                ) : (
                  <span className="size-3.5" />
                )}
                {s}
              </li>
            ))}
          </ol>
        </div>
      ) : !g ? (
        dropzone
      ) : (
        <>
          <div className="surface flex flex-wrap items-center gap-4 p-5">
            <div className="grid size-11 place-items-center rounded-lg border bg-muted/40">
              <FileText className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-medium">{g.fileName}</div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                {g.pages} pages · added{" "}
                {new Date(g.uploadedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
                {g.source === "extracted" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-medium text-success">
                    <ShieldCheck className="size-3" />
                    Enforced on all {brand.name} output
                  </span>
                ) : (
                  <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                    Auto-extracted — review rules
                  </span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => input.current?.click()}>
              <UploadCloud />
              Replace PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                actions.updateBrand(brand.id, { guidelines: undefined });
                toast("Guidelines removed", {
                  description: `${brand.name} output no longer enforces them.`,
                });
              }}
            >
              <Trash2 />
              Remove
            </Button>
          </div>

          {g.principle && (
            <blockquote
              className="surface border-l-4 p-6 text-[18px] leading-relaxed"
              style={{
                borderLeftColor: brand.slide.c,
                fontFamily: `"${brand.headingFont}", Helvetica, Arial, sans-serif`,
              }}
            >
              {g.principle}
            </blockquote>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Section title="Voice & tone — core pillars">
              <ol className="divide-y">
                {g.voice.map((v, i) => (
                  <li
                    key={v.title}
                    className="grid grid-cols-[150px_1fr] gap-4 py-3 text-[13px] first:pt-0"
                  >
                    <span className="font-medium">
                      {i + 1}. {v.title}
                    </span>
                    <span className="text-muted-foreground">{v.text}</span>
                  </li>
                ))}
              </ol>
            </Section>
            <Section title="Colour usage">
              <div className="flex h-9 overflow-hidden rounded-md border">
                {g.colorUsage.map((c) => (
                  <div
                    key={c.hex + c.name}
                    style={{ width: `${c.share}%`, background: c.hex }}
                    title={`${c.name} ${c.share}%`}
                  />
                ))}
              </div>
              <ul className="mt-4 space-y-2.5">
                {g.colorUsage.map((c) => (
                  <li key={c.hex + c.name} className="flex items-center gap-3 text-[13px]">
                    <span
                      className="size-4 shrink-0 rounded-full border"
                      style={{ background: c.hex }}
                    />
                    <span className="font-medium">{c.name}</span>
                    <span className="font-mono text-[11.5px] text-muted-foreground">{c.hex}</span>
                    <span className="flex-1 truncate text-muted-foreground">{c.role}</span>
                    <span className="font-mono">{c.share}%</span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Do’s & don’ts">
              <div className="grid gap-5 sm:grid-cols-2">
                <Rules items={g.dos} tone="do" />
                <Rules items={g.donts} tone="dont" />
              </div>
              {g.examples.length > 0 && (
                <div className="mt-5 space-y-2 border-t pt-4 text-[12.5px]">
                  {g.examples.map((e) => (
                    <div key={e.say} className="grid gap-1 sm:grid-cols-2 sm:gap-4">
                      <span>
                        <span className="font-medium text-success">We say</span> “{e.say}”
                      </span>
                      <span className="text-muted-foreground">
                        <span className="font-medium text-destructive">Not</span> “{e.avoid}”
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
            <Section title="Typography">
              <ul className="divide-y">
                {g.typography.map((t) => (
                  <li key={t.role} className="flex items-baseline gap-4 py-3 first:pt-0">
                    <span className="w-20 shrink-0 text-[12px] text-muted-foreground">
                      {t.role}
                    </span>
                    <span
                      className="text-[22px] leading-none"
                      style={{ fontFamily: `"${t.font}", Helvetica, Arial, sans-serif` }}
                    >
                      {t.font}
                    </span>
                    <span className="ml-auto text-right text-[12px] text-muted-foreground">
                      {t.usage}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Logo usage">
              <Rules items={g.logoRules} />
            </Section>
            <Section title="Imagery & graphic elements">
              <Rules items={g.imagery} />
            </Section>
          </div>

          <Section title="Words the AI removes from generated copy">
            <div className="flex flex-wrap gap-1.5">
              {g.bannedWords.map((w) => (
                <span
                  key={w}
                  className="rounded-full border bg-muted/40 px-2.5 py-0.5 font-mono text-[12px] line-through decoration-destructive/60"
                >
                  {w}
                </span>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-5">
      <h3 className="mb-4 text-[14px] font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Rules({ items, tone }: { items: string[]; tone?: "do" | "dont" }) {
  return (
    <div>
      {tone && (
        <div
          className={cn(
            "mb-2 text-[12px] font-medium",
            tone === "do" ? "text-success" : "text-destructive",
          )}
        >
          {tone === "do" ? "Do" : "Don’t"}
        </div>
      )}
      <ul className="space-y-1.5 text-[13px]">
        {items.map((r) => (
          <li key={r} className="flex gap-2">
            <span
              className={cn(
                "mt-1.5 size-1.5 shrink-0 rounded-full",
                tone === "dont" ? "bg-destructive" : "bg-brand",
              )}
            />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact checklist of the brand rules a generation will apply. */
export function GuidelinesApplied({
  voice,
  templateLayout,
}: {
  voice?: VoiceReport | undefined;
  templateLayout?: "signature" | "classic";
}) {
  const brand = useActiveBrand();
  const g = brand.guidelines;
  if (!g) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-[12.5px] text-muted-foreground">
        No brand guidelines for {brand.name}.{" "}
        <Link
          to="/brand/$brandId"
          params={{ brandId: brand.id }}
          search={{ tab: "guidelines" }}
          className="underline"
        >
          Upload them
        </Link>{" "}
        to enforce voice and usage rules.
      </div>
    );
  }
  const removed = voice?.removed ?? [];
  const rows = [
    brand.logos?.primary
      ? "Official logo — reversed lockup on dark slides, primary on light"
      : "Logo — none uploaded, wordmark used",
    `Colour — ${g.colorUsage.map((c) => `${c.name} ${c.share}%`).join(" · ")}`,
    `Type — ${g.typography.map((t) => t.font).join(" · ")}`,
    removed.length
      ? `Voice — removed ${removed.map((r) => `“${r.word}”${r.count > 1 ? ` ×${r.count}` : ""}`).join(", ")}`
      : "Voice — no hedging or fluff found",
    ...(templateLayout === "signature" ? ["Layouts — the brand’s own presentation template"] : []),
  ];
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium">
        <BookCheck className="size-3.5 text-brand" />
        {g.fileName} applied
      </div>
      <ul className="space-y-1.5 text-[12px] text-muted-foreground">
        {rows.map((r) => (
          <li key={r} className="flex gap-1.5">
            <Check className="mt-0.5 size-3 shrink-0 text-success" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}
