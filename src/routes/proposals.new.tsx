import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  Lock,
  Plus,
  Sparkles,
  Unlock,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { DocPage } from "@/components/doc-page";
import { BrandBadge, Chip, CompliancePill, GenerationSteps } from "@/components/shared";
import { SlideView } from "@/components/slide";
import {
  BrandPicker,
  TemplateCard,
  TemplatePreview,
  TemplateTypeBadge,
  UploadTemplateDialog,
} from "@/components/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ExportDialog } from "@/components/export-dialog";
import {
  isSlideTemplate,
  templateTypes,
  type DocTemplate,
  type TemplateType,
} from "@/lib/brand-data";
import {
  proposalAiActions,
  proposalClientIntel,
  proposalSections,
  type SlideKind,
} from "@/lib/mock-data";
import { actions, useActiveBrand, useDocTemplates } from "@/lib/store";
import { fileTypeFor, newGeneratedId } from "@/lib/generated-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proposals/new")({
  validateSearch: (s: Record<string, unknown>): { client?: string; template?: string } => ({
    ...(typeof s["client"] === "string" && { client: s["client"] }),
    ...(typeof s["template"] === "string" && { template: s["template"] }),
  }),
  head: () => ({ meta: [{ title: "Create proposal — Enterprise AI" }] }),
  component: NewProposal,
});

const buildSteps = [
  "Reading client brief",
  "Retrieving company knowledge",
  "Loading template structure",
  "Applying brand lock",
  "Drafting narrative",
  "Building solution architecture",
  "Pricing & timeline",
  "Template fidelity check",
];
const prompt0 =
  "Create a proposal for ABC Bank for a three-year digital transformation program. Include our company overview, understanding of their challenges, proposed solution, implementation roadmap, team, timeline, pricing and expected outcomes.";
const fidelity = [
  "Layout",
  "Branding",
  "Typography",
  "Colors",
  "Headers & footers",
  "Visual structure",
];
const kindFor = (n: string): SlideKind =>
  /Cover/.test(n)
    ? "title"
    : /Roadmap|Timeline/.test(n)
      ? "timeline"
      : /Commercial|Outcomes/.test(n)
        ? "metrics"
        : /Challenges/.test(n)
          ? "comparison"
          : /Team|Case/.test(n)
            ? "grid"
            : /Architecture/.test(n)
              ? "agenda"
              : "split";

function NewProposal() {
  const { client: qc, template: qt } = Route.useSearch();
  const all = useDocTemplates();
  const brand = useActiveBrand();
  const preselected = all.find((t) => t.id === qt);
  const [phase, setPhase] = useState<"template" | "brief" | "building" | "result">(
    preselected ? "brief" : "template",
  );
  const [templateId, setTemplateId] = useState<string | null>(preselected?.id ?? null);
  const template = all.find((t) => t.id === templateId) ?? null;

  // A template always generates in its own brand.
  useEffect(() => {
    if (template && template.brandId !== brand.id) actions.setActiveBrand(template.brandId);
  }, [template, brand.id]);

  const [f, setF] = useState({
    client: qc ?? "ABC Bank",
    industry: "Banking",
    contact: "Hassan Ali, CTO",
    title: "Digital Transformation Program",
    opp: "ABC-2026-DT",
  });
  const [prompt, setPrompt] = useState("");

  if (phase === "template")
    return (
      <TemplateStep
        selected={templateId}
        onSelect={setTemplateId}
        onContinue={() => setPhase("brief")}
      />
    );
  if (phase === "building")
    return (
      <Page className="grid min-h-[70vh] place-items-center">
        <GenerationSteps
          title="Building your proposal"
          steps={buildSteps}
          onDone={() => setPhase("result")}
        />
      </Page>
    );
  if (phase === "result") return <ProposalResult template={template} f={f} />;

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const fields: [keyof typeof f, string][] = [
    ["client", "Client / company"],
    ["industry", "Industry"],
    ["contact", "Contact"],
    ["title", "Proposal title"],
    ["opp", "Opportunity name"],
  ];
  const Num = ({ n }: { n: number }) => (
    <span className="grid size-5 place-items-center rounded-full bg-foreground text-[11px] text-background">
      {n}
    </span>
  );
  return (
    <Page className="max-w-5xl">
      <div className="eyebrow">New proposal</div>
      <h1 className="mt-2 font-serif text-[40px]">Create a proposal</h1>
      <div className="mt-6 flex items-center gap-3 rounded-lg border bg-success-soft px-4 py-3 text-[13px]">
        <Check className="size-4 text-success" />
        <span>
          <strong className="font-medium">{brand.name}</strong> logo, colors, fonts, guidelines,
          templates and company profile are already connected — nothing to upload.
        </span>
      </div>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-medium">
          <span className="grid size-5 place-items-center rounded-full bg-success text-white">
            <Check className="size-3" />
          </span>
          Template
        </div>
        <div className="surface flex items-center gap-5 p-4">
          <div
            className={cn(
              "shrink-0 overflow-hidden rounded border shadow-card",
              template && !isSlideTemplate(template) ? "w-16" : "w-32",
            )}
          >
            {template ? (
              <TemplatePreview template={template} />
            ) : (
              <SlideView kind="title" theme="brand" title="Brand default" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium">
              {template?.name ?? `${brand.name} default proposal layout`}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
              {template ? (
                <>
                  <TemplateTypeBadge type={template.type} />
                  <span className="font-mono">{template.format}</span>
                </>
              ) : (
                "Brand system default"
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setPhase("template")}>
            Change template
          </Button>
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-medium">
          <Num n={2} />
          Who is this proposal for?
        </div>
        <div className="surface grid gap-4 p-5 sm:grid-cols-2">
          {fields.map(([k, l]) => (
            <label
              key={k}
              className={cn(
                "space-y-1.5 text-[12px] text-muted-foreground",
                k === "opp" && "sm:col-span-2",
              )}
            >
              {l}
              <Input value={f[k]} onChange={set(k)} className="text-foreground" />
            </label>
          ))}
        </div>
      </section>
      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-medium">
          <Num n={3} />
          What are you proposing?
        </div>
        <div className="surface p-1.5">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={prompt0}
            className="min-h-32 resize-none border-0 text-[15px] shadow-none focus-visible:ring-0"
            aria-label="Proposal brief"
          />
          <div className="px-3 pb-2">
            <button
              className="text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => setPrompt(prompt0)}
            >
              Use example prompt
            </button>
          </div>
        </div>
      </section>
      <section className="mt-10">
        <div className="mb-3 flex items-center gap-2 text-[15px] font-medium">
          <Num n={4} />
          Client intelligence
        </div>
        <div className="surface grid gap-5 p-5 sm:grid-cols-3">
          <div>
            <div className="eyebrow">Industry</div>
            <div className="mt-1.5 text-[14px]">{proposalClientIntel.industry}</div>
          </div>
          <div>
            <div className="eyebrow">Company size</div>
            <div className="mt-1.5 text-[14px]">{proposalClientIntel.size}</div>
          </div>
          <div>
            <div className="eyebrow">Key priorities</div>
            <ul className="mt-1.5 space-y-1 text-[14px]">
              {proposalClientIntel.priorities.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
          <p className="border-t pt-4 text-[12.5px] text-muted-foreground sm:col-span-3">
            AI adapts the narrative to these priorities while keeping the {brand.name} brand system
            {template ? ` and the “${template.name}” layout` : ""} intact.
          </p>
        </div>
      </section>
      <div className="mt-10 flex items-center justify-between">
        <BrandBadge />
        <Button size="lg" disabled={prompt.trim().length < 10} onClick={() => setPhase("building")}>
          <Sparkles />
          Generate proposal
        </Button>
      </div>
    </Page>
  );
}

function TemplateStep({
  selected,
  onSelect,
  onContinue,
}: {
  selected: string | null;
  onSelect: (id: string | null) => void;
  onContinue: () => void;
}) {
  const brand = useActiveBrand();
  const all = useDocTemplates();
  const [type, setType] = useState<"All" | TemplateType>("All");
  const [upload, setUpload] = useState(false);
  const mine = useMemo(() => all.filter((t) => t.brandId === brand.id), [all, brand.id]);
  const list = mine.filter((t) => type === "All" || t.type === type);
  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">New proposal · Step 1 of 4</div>
          <h1 className="mt-2 font-serif text-[40px] leading-tight">Choose a template</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            The AI keeps the template's layout, branding, typography, colors, headers and footers —
            and writes the content for you.
          </p>
        </div>
        <BrandPicker label="Templates from" />
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        {(["All", ...templateTypes] as const).map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {t}
          </Chip>
        ))}
      </div>
      <div className="mt-6 grid gap-x-5 gap-y-8 pb-10 sm:grid-cols-2 lg:grid-cols-3">
        <button
          onClick={() => setUpload(true)}
          className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed text-[13px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <span className="flex flex-col items-center gap-2">
            <UploadCloud className="size-5" />
            Upload your own template
            <span className="font-mono text-[11px]">PPTX · KEY · PDF · DOCX</span>
          </span>
        </button>
        {list.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            selected={selected === t.id}
            onSelect={() => onSelect(selected === t.id ? null : t.id)}
          />
        ))}
        {list.length === 0 && (
          <div className="grid aspect-[4/3] place-items-center rounded-lg border bg-muted/30 px-6 text-center text-[13px] text-muted-foreground">
            No {type === "All" ? "" : type.toLowerCase() + " "}templates for {brand.name} yet.
          </div>
        )}
      </div>
      <div
        className="sticky bottom-0 z-20 -mx-8 -mb-10 border-t bg-background/90 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-between gap-4 px-8 py-3">
          <span className="text-[13px] text-muted-foreground">
            {selected ? (
              <>
                Selected:{" "}
                <strong className="font-medium text-foreground">
                  {all.find((t) => t.id === selected)?.name}
                </strong>
              </>
            ) : (
              `No template — the ${brand.name} default proposal layout will be used.`
            )}
          </span>
          <Button onClick={onContinue}>
            {selected ? "Continue with template" : "Continue without template"}
            <ArrowRight />
          </Button>
        </div>
      </div>
      <UploadTemplateDialog
        open={upload}
        onOpenChange={setUpload}
        defaultBrandId={brand.id}
        onCreated={(t) => {
          if (t.brandId === brand.id) onSelect(t.id);
        }}
      />
    </Page>
  );
}

function ProposalResult({
  template,
  f,
}: {
  template: DocTemplate | null;
  f: { client: string; title: string; opp: string };
}) {
  const navigate = useNavigate();
  const brand = useActiveBrand();
  const [sections, setSections] = useState(proposalSections);
  const [sel, setSel] = useState(0);
  const [lock, setLock] = useState(true);
  const [exp, setExp] = useState(false);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rev, setRev] = useState(0);
  const doc = template && !isSlideTemplate(template);
  const docType: TemplateType =
    template?.type === "Letterhead" || template?.type === "Business Document"
      ? template.type
      : "Proposal";
  const slideTheme = lock ? (template?.theme ?? "brand") : "editorial";

  // Saved to the Generated Content library as soon as it's generated; structure edits stay in sync.
  const [genId] = useState(newGeneratedId);
  const savedRef = useRef(false);
  useEffect(() => {
    const name = `${f.title} — ${f.client}`;
    const base = {
      name,
      brandId: brand.id,
      templateName: template?.name ?? `${brand.name} default`,
      theme: slideTheme,
      ...(doc
        ? { doc: { type: docType, client: f.client, sections } }
        : {
            slides: sections.map((s, i) => ({
              id: `p${i}`,
              kind: kindFor(s),
              title: s === "Cover" ? f.title : s,
              subtitle: `Prepared for ${f.client}`,
              bullets: [
                "Aligned to digital transformation",
                "Cost reduction at scale",
                "Customer experience uplift",
                "Phased 36-month rollout",
              ],
            })),
          }),
    };
    if (!savedRef.current) {
      savedRef.current = true;
      actions.addGenerated({
        id: genId,
        kind: docType === "Proposal" ? "Proposal" : "Document",
        fileType: fileTypeFor(template?.format, doc ? "Proposal" : "Presentation"),
        createdAt: new Date().toISOString(),
        status: "Ready",
        ...base,
      });
      toast.success("Saved to Generated Content", {
        description: name,
        action: { label: "View library", onClick: () => navigate({ to: "/generated" }) },
      });
    } else actions.updateGenerated(genId, base);
  }, [sections, slideTheme]); // eslint-disable-line react-hooks/exhaustive-deps

  const move = (i: number, d: number) =>
    setSections((s) => {
      const n = [...s];
      const j = i + d;
      if (j < 0 || j >= n.length) return s;
      [n[i], n[j]] = [n[j]!, n[i]!];
      setSel(j);
      return n;
    });
  const remove = (i: number) => {
    setSections((s) => s.filter((_, x) => x !== i));
    setSel(0);
  };
  const add = () => {
    if (!adding.trim()) return;
    setSections((s) => [...s, adding.trim()]);
    setAdding("");
  };
  const runAi = (a: string) => {
    setBusy(a);
    setTimeout(() => {
      setBusy(null);
      setRev((r) => r + 1);
      toast.success(a, {
        description: `Applied to “${sections[sel]}”. Template and brand rules ${lock ? "enforced" : "respected"}.`,
      });
    }, 1000);
  };
  const render = (s: string, i: number) =>
    doc ? (
      <DocPage
        type={docType}
        title={f.title}
        section={docType === "Proposal" ? s : `${s}`}
        client={f.client}
        page={i + 1}
      />
    ) : (
      <SlideView
        kind={kindFor(s)}
        theme={slideTheme}
        slide={{
          id: s,
          kind: kindFor(s),
          title: s === "Cover" ? f.title : s,
          subtitle: `Prepared for ${f.client}`,
          bullets: [
            "Aligned to digital transformation",
            "Cost reduction at scale",
            "Customer experience uplift",
            "Phased 36-month rollout",
          ],
        }}
      />
    );

  return (
    <div className="mx-auto grid max-w-[1400px] animate-rise gap-6 px-6 py-8 lg:grid-cols-[260px_1fr_300px]">
      <aside className="space-y-4">
        <div className="surface p-4">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Brand lock</div>
            <Switch
              checked={lock}
              onCheckedChange={(v) => {
                setLock(v);
                toast(v ? "Brand Lock: ON" : "Creative mode unlocked", {
                  description: v
                    ? "Logo, colors, type and templates are enforced."
                    : "AI may explore new designs within brand boundaries.",
                });
              }}
              aria-label="Brand lock"
            />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[15px] font-medium">
            {lock ? <Lock className="size-4" /> : <Unlock className="size-4" />}Brand Lock:{" "}
            {lock ? "ON" : "OFF"}
          </div>
          {lock ? (
            <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
              {[
                "Approved logo",
                "Company colors enforced",
                "Typography follows guidelines",
                "Approved templates only",
                "Consistent visual language",
              ].map((x) => (
                <li key={x} className="flex items-center gap-1.5">
                  <Check className="size-3 text-success" />
                  {x}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[12.5px] text-muted-foreground">
              Creative mode: AI explores new layouts and imagery within defined brand boundaries.
            </p>
          )}
          <div className="mt-4">
            <CompliancePill />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            onClick={() => setLock((l) => !l)}
          >
            {lock ? (
              <>
                <Unlock />
                Unlock creative mode
              </>
            ) : (
              <>
                <Lock />
                Re-lock brand
              </>
            )}
          </Button>
        </div>
        <div className="surface p-4">
          <div className="eyebrow">Template</div>
          <div className="mt-2 text-[13.5px] font-medium">
            {template?.name ?? `${brand.name} default`}
          </div>
          {template && (
            <div className="mt-1.5">
              <TemplateTypeBadge type={template.type} />
            </div>
          )}
          <ul className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[12px] text-muted-foreground">
            {fidelity.map((x) => (
              <li key={x} className="flex items-center gap-1.5">
                <Check className="size-3 text-success" />
                {x}
              </li>
            ))}
          </ul>
        </div>
        <div className="surface p-4">
          <div className="eyebrow mb-2">Structure</div>
          <ol className="space-y-0.5">
            {sections.map((s, i) => (
              <li
                key={s + i}
                className={cn(
                  "group flex items-center gap-1 rounded-md pr-1 text-[13px]",
                  sel === i ? "bg-accent font-medium" : "hover:bg-muted/60",
                )}
              >
                <button className="flex-1 truncate px-2 py-1.5 text-left" onClick={() => setSel(i)}>
                  <span className="mr-2 font-mono text-[10px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s}
                </button>
                <span className="hidden gap-0.5 group-hover:flex group-focus-within:flex">
                  <button
                    aria-label={`Move ${s} up`}
                    onClick={() => move(i, -1)}
                    className="rounded p-0.5 hover:bg-background"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    aria-label={`Move ${s} down`}
                    onClick={() => move(i, 1)}
                    className="rounded p-0.5 hover:bg-background"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                  <button
                    aria-label={`Remove ${s}`}
                    onClick={() => remove(i)}
                    className="rounded p-0.5 hover:bg-background"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <form
            className="mt-3 flex gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
          >
            <Input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Add section"
              className="h-8 text-[12px]"
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              className="size-8"
              aria-label="Add section"
            >
              <Plus />
            </Button>
          </form>
        </div>
      </aside>

      <main className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="eyebrow">
              {f.client} · {f.opp}
            </div>
            <h1 className="font-serif text-[32px] leading-tight">{f.title}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => toast.success("Saved as draft")}>
              Save draft
            </Button>
            <Button onClick={() => setExp(true)}>Export</Button>
          </div>
        </div>
        <div
          className={cn(
            "rounded-xl border bg-muted/40",
            doc ? "grid place-items-center p-6" : "overflow-hidden",
          )}
        >
          <div
            key={`${sel}-${rev}`}
            className={cn(
              "animate-rise overflow-hidden",
              doc ? "w-full max-w-[520px] rounded-[3px] shadow-slide" : "shadow-slide",
            )}
          >
            {render(sections[sel] ?? "", sel)}
          </div>
        </div>
        <div className={cn("grid gap-2", doc ? "grid-cols-8" : "grid-cols-6")}>
          {sections.slice(0, doc ? 16 : 12).map((s, i) => (
            <button
              key={s + i}
              onClick={() => setSel(i)}
              aria-label={s}
              className={cn(
                "overflow-hidden rounded border transition-all",
                sel === i ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100",
              )}
            >
              {render(s, i)}
            </button>
          ))}
        </div>
      </main>

      <aside className="space-y-4">
        <div className="surface p-4">
          <div className="flex items-center gap-1.5 text-[13px] font-medium">
            <Sparkles className="size-3.5 text-brand" />
            Proposal AI
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">Acting on “{sections[sel]}”</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {proposalAiActions.map((a) => (
              <Chip key={a} onClick={() => runAi(a)}>
                {a}
              </Chip>
            ))}
          </div>
          {busy && <div className="mt-3 animate-pulse text-[12px] text-brand">{busy}…</div>}
        </div>
        <div className="surface space-y-3 p-4 text-[13px]">
          <div className="eyebrow">Client intelligence</div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Industry</span>
            {proposalClientIntel.industry}
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Size</span>Enterprise
          </div>
          <div>
            <div className="text-muted-foreground">Key priorities</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {proposalClientIntel.priorities.map((p) => (
                <span
                  key={p}
                  className="rounded-full bg-brand-soft px-2 py-0.5 text-[11.5px] text-brand"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => navigate({ to: "/proposals" })}
        >
          Back to proposals
        </Button>
      </aside>
      <ExportDialog
        open={exp}
        onOpenChange={setExp}
        content={
          doc
            ? { kind: "doc", title: f.title, client: f.client, sections, type: docType, brand }
            : {
                kind: "deck",
                title: f.title,
                theme: slideTheme,
                brand,
                slides: sections.map((s, i) => ({
                  id: `p${i}`,
                  kind: kindFor(s),
                  title: s === "Cover" ? f.title : s,
                  subtitle: `Prepared for ${f.client}`,
                })),
              }
        }
      />
    </div>
  );
}
