import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Check,
  FileText,
  ImagePlus,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { BrandMark, BrandScope } from "@/components/brand-scope";
import { Chip } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { TemplateCard, UploadTemplateDialog } from "@/components/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  brandAssetCategories,
  type BrandAsset,
  type BrandAssetCategory,
  type BrandSystem,
  logoSlots,
  isSlideTemplate,
  paletteOf,
  type DocTemplate,
} from "@/lib/brand-data";
import { actions, useActiveBrand, useBrand, useBrandAssets, useDocTemplates } from "@/lib/store";
import { DocPage } from "@/components/doc-page";
import { GuidelinesPanel } from "@/components/guidelines";
import { TemplateLayoutsDialog } from "@/components/template-layouts-dialog";
import { cn } from "@/lib/utils";

type Tab = "system" | "guidelines" | "assets" | "templates";

export const Route = createFileRoute("/brand/$brandId")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    s["tab"] === "assets" ||
    s["tab"] === "templates" ||
    s["tab"] === "system" ||
    s["tab"] === "guidelines"
      ? { tab: s["tab"] }
      : {},
  head: () => ({ meta: [{ title: "Brand workspace — Enterprise AI" }] }),
  component: BrandWorkspaceRoute,
});

function BrandWorkspaceRoute() {
  const { brandId } = Route.useParams();
  const brand = useBrand(brandId);
  if (!brand) {
    return (
      <Page>
        <div className="surface p-12 text-center">
          <div className="font-medium">Brand not found</div>
          <p className="mt-1 text-[13px] text-muted-foreground">It may have been removed.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/brand">Back to Brand Studio</Link>
          </Button>
        </div>
      </Page>
    );
  }
  // Keyed so switching brands resets every draft field.
  return <BrandWorkspace key={brand.id} brand={brand} />;
}

function BrandWorkspace({ brand }: { brand: BrandSystem }) {
  const { tab = "system" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const active = useActiveBrand();
  const [draft, setDraft] = useState(brand);
  const [dirty, setDirty] = useState(false);
  const edit = (p: Partial<BrandSystem>) => {
    setDraft((d) => ({ ...d, ...p }));
    setDirty(true);
  };
  const save = () => {
    const { logos: _logos, guidelines: _guidelines, ...rest } = draft;
    actions.updateBrand(brand.id, { ...rest, slide: paletteOf(draft.colors) });
    setDirty(false);
    toast.success(`${brand.name} brand system saved`, {
      description: "All new output for this brand will use these settings.",
    });
  };

  return (
    <Page>
      <div className="mb-3 text-[12px] text-muted-foreground">
        <Link to="/brand" className="hover:text-foreground">
          Brand Studio
        </Link>{" "}
        / {brand.name}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
        <div className="flex items-center gap-4">
          <BrandMark brand={{ ...draft, logos: brand.logos }} className="size-12 text-[15px]" />
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">{brand.name}</h1>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <ShieldCheck className="size-3.5 text-success" />
              Isolated workspace — {brand.name} assets are never mixed with other brands.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty && <span className="text-[12px] text-warning">Unsaved changes</span>}
          {active.id === brand.id ? (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-success-soft px-3 text-[13px] font-medium text-success">
              <Check className="size-3.5" />
              Active brand
            </span>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                actions.setActiveBrand(brand.id);
                toast.success(`${brand.name} is now the active brand`, {
                  description: "New presentations, proposals and meetings will use it.",
                });
              }}
            >
              Use for generation
            </Button>
          )}
          {tab === "system" && (
            <Button onClick={save} disabled={!dirty}>
              Save Brand System
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="system">Brand system</TabsTrigger>
          <TabsTrigger value="guidelines">
            Guidelines
            {!brand.guidelines && <span className="ml-1.5 size-1.5 rounded-full bg-warning" />}
          </TabsTrigger>
          <TabsTrigger value="assets">Asset library</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="system">
          <BrandSystemForm draft={{ ...draft, logos: brand.logos }} edit={edit} />
        </TabsContent>
        <TabsContent value="guidelines">
          <GuidelinesPanel brand={brand} />
        </TabsContent>
        <TabsContent value="assets">
          <AssetLibrary brand={brand} />
        </TabsContent>
        <TabsContent value="templates">
          <BrandTemplates brand={brand} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/* ---------------- Brand system (profile, identity, colors, type, style) ---------------- */

const fonts = [
  "Helvetica Neue",
  "Inter",
  "DM Mono",
  "Instrument Serif",
  "Fraunces",
  "Space Grotesk",
  "Geist",
  "Geist Mono",
];
const uploads = ["Primary logo", "Dark logo", "Light logo", "Favicon", "Brand guidelines PDF"];
const sliderRows = ["Corner radius", "Shadow intensity", "Spacing"];
const selects: [string, string[]][] = [
  ["Image treatment", ["Natural", "Duotone", "Monochrome"]],
  ["Chart style", ["Minimal", "Detailed", "Bold"]],
  ["Icon style", ["Line", "Solid", "Duotone"]],
  ["Photography style", ["Editorial", "Candid", "Abstract"]],
];

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5 text-[12px] text-muted-foreground", className)}>
      {label}
      {children}
    </label>
  );
}
function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface p-6">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      {desc && <p className="mt-0.5 text-[13px] text-muted-foreground">{desc}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function BrandSystemForm({
  draft,
  edit,
}: {
  draft: BrandSystem;
  edit: (p: Partial<BrandSystem>) => void;
}) {
  const [vals, setVals] = useState<Record<string, number[]>>({
    "Corner radius": [8],
    "Shadow intensity": [30],
    Spacing: [60],
  });
  const [sel, setSel] = useState<Record<string, string>>({
    "Image treatment": "Natural",
    "Chart style": draft.chartStyle,
    "Icon style": "Line",
    "Photography style": draft.imageStyle,
  });
  const [uploaded, setUploaded] = useState<string[]>(draft.description ? uploads : []);
  const preview: BrandSystem = { ...draft, slide: paletteOf(draft.colors) };
  const text = (k: "name" | "industry" | "website" | "tagline" | "tone") => ({
    value: draft[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => edit({ [k]: e.target.value }),
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card
          title="Company profile"
          desc="The AI grounds every document for this brand in this information."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name">
              <Input {...text("name")} className="text-foreground" />
            </Field>
            <Field label="Industry">
              <Input {...text("industry")} className="text-foreground" />
            </Field>
            <Field label="Website">
              <Input {...text("website")} className="text-foreground" />
            </Field>
            <Field label="Company positioning">
              <Input {...text("tagline")} className="text-foreground" />
            </Field>
            <Field label="Products">
              <Input
                defaultValue={
                  draft.id === "stixor"
                    ? "Custom software, AI agents, Cloud platforms"
                    : draft.id === "furviax"
                      ? "Home, Travel, Accessories"
                      : "Atlas Platform, Atlas Insights"
                }
                className="text-foreground"
              />
            </Field>
            <Field label="Services">
              <Input
                defaultValue={
                  draft.id === "furviax"
                    ? "Retail partnerships, Corporate gifting"
                    : "Implementation, Managed AI, Advisory"
                }
                className="text-foreground"
              />
            </Field>
            <Field label="Target audience">
              <Input
                defaultValue={
                  draft.id === "furviax"
                    ? "Design-led consumers, premium retailers"
                    : "Enterprise banking, telecom, government"
                }
                className="text-foreground"
              />
            </Field>
            <Field label="Preferred tone of voice">
              <Input {...text("tone")} className="text-foreground" />
            </Field>
            <Field label="Company description">
              <Textarea
                value={draft.description}
                onChange={(e) => edit({ description: e.target.value })}
                className="text-foreground"
              />
            </Field>
            <Field label="Company mission">
              <Textarea
                value={draft.mission}
                onChange={(e) => edit({ mission: e.target.value })}
                className="text-foreground"
              />
            </Field>
          </div>
        </Card>

        <LogoManager brand={draft} />

        <Card
          title="Brand guidelines"
          desc="The AI reads your guidelines to follow tone, spacing and usage rules."
        >
          <button
            onClick={() => {
              const has = uploaded.includes("Brand guidelines PDF");
              setUploaded((x) =>
                has
                  ? x.filter((y) => y !== "Brand guidelines PDF")
                  : [...x, "Brand guidelines PDF"],
              );
              toast(has ? "Guidelines removed" : "Guidelines uploaded", {
                description: `${draft.name} brand guidelines.pdf`,
              });
            }}
            className="flex w-full items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-left text-[13px] transition-all hover:border-foreground hover:bg-muted/40"
          >
            {uploaded.includes("Brand guidelines PDF") ? (
              <FileText className="size-5" />
            ) : (
              <Upload className="size-5 text-muted-foreground" />
            )}
            <span className="flex-1">
              {uploaded.includes("Brand guidelines PDF")
                ? `${draft.id}-brand-guidelines.pdf`
                : "Upload brand guidelines PDF"}
              <span className="block text-[11.5px] text-muted-foreground">
                {uploaded.includes("Brand guidelines PDF")
                  ? "Indexed for AI · click to replace"
                  : "Click or drop file"}
              </span>
            </span>
          </button>
        </Card>

        <Card
          title="Colors"
          desc="Click a swatch to edit. Roles decide where each colour is used on slides and documents."
        >
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            {draft.colors.map((c, i) => (
              <div key={c.name + i}>
                <label
                  className="relative block h-20 cursor-pointer overflow-hidden rounded-lg border shadow-card"
                  style={{ background: c.hex }}
                >
                  <input
                    type="color"
                    aria-label={`${c.name} color`}
                    value={c.hex}
                    onChange={(e) =>
                      edit({
                        colors: draft.colors.map((x, j) =>
                          j === i ? { ...x, hex: e.target.value.toUpperCase() } : x,
                        ),
                      })
                    }
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                </label>
                <div className="mt-2 text-[13px] font-medium">{c.name}</div>
                {c.role && (
                  <div className="text-[11px] capitalize text-muted-foreground">{c.role}</div>
                )}
                <div className="font-mono text-[11.5px] text-muted-foreground">{c.hex}</div>
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() =>
              edit({
                colors: [
                  ...draft.colors,
                  {
                    name: `Custom ${draft.colors.filter((x) => x.role === "custom").length + 1}`,
                    hex: "#8B8B8B",
                    role: "custom",
                  },
                ],
              })
            }
          >
            + Add custom color
          </Button>
        </Card>

        <Card title="Typography">
          <div className="grid gap-4 sm:grid-cols-3">
            {(
              [
                ["Heading font", "headingFont"],
                ["Body font", "bodyFont"],
                ["Data / numbers font", "dataFont"],
              ] as const
            ).map(([l, k]) => (
              <Field key={k} label={l}>
                <Select value={draft[k]} onValueChange={(v) => edit({ [k]: v })}>
                  <SelectTrigger className="text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fonts.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div
                  className="pt-2 text-[22px] text-foreground"
                  style={{ fontFamily: `"${draft[k]}", serif` }}
                >
                  {k === "dataFont" ? "$48.2M 128%" : "Aa Brand"}
                </div>
              </Field>
            ))}
          </div>
        </Card>

        <Card title="Visual style">
          <div className="grid gap-6 sm:grid-cols-2">
            {sliderRows.map((r) => (
              <div key={r}>
                <div className="mb-2 flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{r}</span>
                  <span className="font-mono">{vals[r]![0]}</span>
                </div>
                <Slider
                  value={vals[r]!}
                  max={100}
                  onValueChange={(v) => setVals({ ...vals, [r]: v })}
                  aria-label={r}
                />
              </div>
            ))}
            {selects.map(([l, opts]) => (
              <Field key={l} label={l}>
                <Select
                  value={sel[l]!}
                  onValueChange={(v) => {
                    setSel({ ...sel, [l]: v });
                    if (l === "Chart style") edit({ chartStyle: v });
                    if (l === "Photography style") edit({ imageStyle: v });
                  }}
                >
                  <SelectTrigger className="text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opts.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ))}
          </div>
        </Card>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="surface overflow-hidden">
          <div className="flex items-center gap-1.5 border-b px-4 py-3">
            <Sparkles className="size-3.5 text-brand" />
            <span className="eyebrow">AI-generated Brand DNA</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-4">
            <BrandScope brand={preview}>
              <div className="col-span-2 overflow-hidden rounded-md border">
                <SlideView
                  kind="title"
                  theme="brand"
                  title={draft.name}
                  slide={{ id: "p", kind: "title", title: draft.name, subtitle: draft.tagline }}
                />
              </div>
              <div className="overflow-hidden rounded-md border">
                <SlideView kind="metrics" theme="light" title="Results" />
              </div>
              <div className="overflow-hidden rounded-md border">
                <SlideView kind="chart" theme="ink" title="Growth" />
              </div>
            </BrandScope>
          </div>
          <dl className="space-y-2.5 border-t px-4 py-4 text-[13px]">
            {(
              [
                ["Primary color", draft.colors[0]!.hex],
                ["Typography", draft.headingFont],
                ["Visual tone", "Premium / Professional"],
                ["Image style", draft.imageStyle],
                ["Chart style", draft.chartStyle],
                ["Preferred layouts", "Structured / Spacious"],
                ["Tone of voice", draft.tone],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="flex items-center gap-1.5 text-right font-medium">
                  {k === "Primary color" && (
                    <span className="size-3 rounded-full border" style={{ background: v }} />
                  )}
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </aside>
    </div>
  );
}

/* ---------------- Brand-scoped asset library ---------------- */

const ext = (n: string) => n.split(".").pop()?.toUpperCase() ?? "";

function AssetThumb({ asset, brand }: { asset: BrandAsset; brand: BrandSystem }) {
  if (asset.category === "Logos") {
    const dark = asset.name.includes("dark");
    return (
      <div className={cn("grid h-full place-items-center", dark ? "bg-[#111]" : "bg-white")}>
        <div className="flex items-center gap-2">
          <BrandMark brand={brand} className="size-8 text-[10px]" />
          <span
            className={cn("text-[13px] font-semibold", dark ? "text-white" : "text-foreground")}
          >
            {brand.name.split(" ")[0]}
          </span>
        </div>
      </div>
    );
  }
  if (asset.category === "Images") {
    return (
      <div
        className="relative h-full"
        style={{
          background: `linear-gradient(140deg, ${brand.slide.d}, ${brand.slide.b} 70%, ${brand.slide.a})`,
        }}
      >
        <div
          className="absolute bottom-3 left-3 size-8 rounded-full"
          style={{ background: brand.slide.c, opacity: 0.85 }}
        />
        <div className="absolute right-3 top-3 h-px w-10 bg-white/60" />
      </div>
    );
  }
  if (asset.category === "Icons") {
    return (
      <div className="grid h-full grid-cols-4 place-items-center gap-1 bg-white p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className={cn("size-4 border-[1.5px]", i % 3 === 0 ? "rounded-full" : "rounded-[3px]")}
            style={{ borderColor: brand.slide.b }}
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-muted/50">
      <FileText className="size-7" style={{ color: brand.slide.b }} />
      <span
        className="rounded px-1.5 font-mono text-[10px] text-white"
        style={{ background: brand.slide.a }}
      >
        {ext(asset.name)}
      </span>
    </div>
  );
}

function AssetLibrary({ brand }: { brand: BrandSystem }) {
  const all = useBrandAssets();
  const [cat, setCat] = useState<"All" | BrandAssetCategory>("All");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState(false);
  const mine = useMemo(() => all.filter((a) => a.brandId === brand.id), [all, brand.id]);
  const list = mine.filter(
    (a) => (cat === "All" || a.category === cat) && a.name.toLowerCase().includes(q.toLowerCase()),
  );
  const upload = (files: FileList | null) => {
    if (!files?.length) return;
    const guess = (n: string): BrandAssetCategory =>
      /logo/i.test(n)
        ? "Logos"
        : /\.(png|jpe?g|webp|gif)$/i.test(n)
          ? "Images"
          : /\.svg$/i.test(n)
            ? "Icons"
            : /\.(pptx?|key)$/i.test(n)
              ? "Presentation assets"
              : /guideline/i.test(n)
                ? "Guidelines"
                : "Document assets";
    actions.addAssets(
      Array.from(files).map((f, i) => ({
        id: `${brand.id}-up-${Date.now()}-${i}`,
        brandId: brand.id,
        name: f.name,
        category: cat === "All" ? guess(f.name) : cat,
        size: `${(f.size / 1e6).toFixed(1)} MB`,
        hue: 0,
      })),
    );
    toast.success(`${files.length} asset${files.length > 1 ? "s" : ""} added to ${brand.name}`);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        upload(e.dataTransfer.files);
      }}
      className="relative"
    >
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {brandAssetCategories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(cat === c ? "All" : c)}
            className={cn(
              "surface p-3 text-left transition-all",
              cat === c ? "ring-2 ring-brand" : "hover:bg-muted/40",
            )}
          >
            <div className="font-mono text-[20px]">
              {mine.filter((a) => a.category === c).length}
            </div>
            <div className="text-[12px] text-muted-foreground">{c}</div>
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${brand.name} assets`}
            className="h-8 pl-8"
          />
        </div>
        <Chip active={cat === "All"} onClick={() => setCat("All")}>
          All
        </Chip>
        {brandAssetCategories.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
        <label className="ml-auto">
          <input
            type="file"
            multiple
            hidden
            onChange={(e) => {
              upload(e.target.files);
              e.target.value = "";
            }}
          />
          <Button asChild size="sm">
            <span>
              <UploadCloud />
              Upload to {brand.name}
            </span>
          </Button>
        </label>
      </div>
      {drag && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-brand bg-brand-soft/80">
          <div className="flex items-center gap-2 text-brand">
            <ImagePlus />
            Drop to add to {brand.name}
          </div>
        </div>
      )}
      {list.length === 0 ? (
        <div className="surface grid place-items-center py-20 text-center">
          <UploadCloud className="size-6 text-muted-foreground" />
          <div className="mt-3 font-medium">
            No {cat === "All" ? "" : cat.toLowerCase() + " "}assets for {brand.name} yet
          </div>
          <p className="text-[13px] text-muted-foreground">Drag files here or use Upload.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() =>
                toast(a.name, { description: `${brand.name} · ${a.category} · ${a.size}` })
              }
              className="group text-left"
            >
              <div className="aspect-[4/3] overflow-hidden rounded-lg border shadow-card transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <AssetThumb asset={a} brand={brand} />
              </div>
              <div className="mt-2 truncate text-[13px] font-medium">{a.name}</div>
              <div className="text-[11.5px] text-muted-foreground">
                {a.category} · {a.size}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BrandTemplates({ brand }: { brand: BrandSystem }) {
  const all = useDocTemplates();
  const [open, setOpen] = useState(false);
  const [layouts, setLayouts] = useState<DocTemplate | null>(null);
  const list = all.filter((t) => t.brandId === brand.id);
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Proposal, letterhead, presentation, PowerPoint and business-document templates owned by{" "}
          {brand.name}.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <UploadCloud />
          Upload template
        </Button>
      </div>
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            action={
              <div className="flex flex-wrap items-center gap-2">
                {isSlideTemplate(t) ? (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/meetings/new"
                      search={{ template: t.id }}
                      onClick={() => actions.setActiveBrand(brand.id)}
                    >
                      Use for meeting deck
                    </Link>
                  </Button>
                ) : (
                  <Button asChild size="sm" variant="outline">
                    <Link
                      to="/proposals/new"
                      search={{ template: t.id }}
                      onClick={() => actions.setActiveBrand(brand.id)}
                    >
                      Use template
                    </Link>
                  </Button>
                )}
                {t.theme === "signature" && (
                  <Button size="sm" variant="ghost" onClick={() => setLayouts(t)}>
                    View layouts
                  </Button>
                )}
                {t.isDefault && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                    Default
                  </span>
                )}
              </div>
            }
          />
        ))}
      </div>
      {layouts && (
        <TemplateLayoutsDialog
          template={layouts}
          brand={brand}
          open
          onOpenChange={(o) => !o && setLayouts(null)}
        />
      )}
      <UploadTemplateDialog open={open} onOpenChange={setOpen} defaultBrandId={brand.id} />
    </div>
  );
}

/* ---------------- Logo management ---------------- */

const LOGO_TYPES = ["image/svg+xml", "image/png", "image/jpeg", "image/webp"];
const MAX_LOGO_BYTES = 1_000_000;

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

/** Upload, replace, preview and remove each logo variant. Saved immediately — and applied to all output for this brand. */
function LogoManager({ brand: draft }: { brand: BrandSystem }) {
  const brand = useBrand(draft.id) ?? draft;
  const [dragSlot, setDragSlot] = useState<string | null>(null);
  const previewBrand: BrandSystem = { ...draft, logos: brand.logos };

  const accept = async (slot: (typeof logoSlots)[number], file: File | undefined) => {
    if (!file) return;
    if (!LOGO_TYPES.includes(file.type)) {
      toast.error("Unsupported file", { description: "Use SVG, PNG, JPG or WebP." });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error("Logo is too large", { description: "Keep logo files under 1 MB." });
      return;
    }
    const had = !!brand.logos?.[slot.key];
    actions.setLogo(brand.id, slot.key, await readAsDataUrl(file));
    toast.success(`${slot.label} ${had ? "replaced" : "uploaded"}`, {
      description: `Applied to every new ${brand.name} presentation and document.`,
    });
  };

  return (
    <Card
      title="Logos"
      desc={`Upload or replace ${brand.name}'s logos. They're applied automatically to everything generated with this brand.`}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        {logoSlots.map((slot) => {
          const src = brand.logos?.[slot.key];
          const dark = slot.key === "reversed";
          const inputId = `logo-${brand.id}-${slot.key}`;
          return (
            <div key={slot.key}>
              <label
                htmlFor={inputId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragSlot(slot.key);
                }}
                onDragLeave={() => setDragSlot(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragSlot(null);
                  void accept(slot, e.dataTransfer.files[0]);
                }}
                className={cn(
                  "group relative grid h-32 cursor-pointer place-items-center overflow-hidden rounded-lg border transition-all",
                  dark
                    ? "bg-[#14161b]"
                    : "bg-[repeating-conic-gradient(#f4f4f2_0%_25%,#fff_0%_50%)] bg-[length:16px_16px]",
                  dragSlot === slot.key ? "ring-2 ring-brand" : src ? "" : "border-dashed",
                )}
              >
                {src ? (
                  <img
                    src={src}
                    alt={`${brand.name} ${slot.label}`}
                    className={cn(
                      "max-h-16 max-w-[80%] object-contain",
                      slot.key === "favicon" && "max-h-14",
                    )}
                  />
                ) : (
                  <span
                    className={cn(
                      "flex flex-col items-center gap-1.5 text-[12px]",
                      dark ? "text-white/60" : "text-muted-foreground",
                    )}
                  >
                    <Upload className="size-5" />
                    Click or drop to upload
                  </span>
                )}
                {src && (
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                    Click or drop to replace
                  </span>
                )}
                <input
                  id={inputId}
                  type="file"
                  accept={LOGO_TYPES.join(",")}
                  className="sr-only"
                  onChange={(e) => {
                    void accept(slot, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <div className="mt-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-medium">{slot.label}</div>
                  <div className="text-[11.5px] text-muted-foreground">{slot.hint}</div>
                </div>
                {src && (
                  <button
                    onClick={() => {
                      actions.setLogo(brand.id, slot.key, undefined);
                      toast(`${slot.label} removed`);
                    }}
                    className="text-[12px] text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 border-t pt-5">
        <div className="eyebrow mb-3">Applied automatically</div>
        <BrandScope brand={previewBrand}>
          <div className="grid grid-cols-[1fr_1fr_0.42fr] items-start gap-3">
            <div className="overflow-hidden rounded-md border">
              <SlideView kind="title" theme="brand" title={`${brand.name} Strategy`} />
            </div>
            <div className="overflow-hidden rounded-md border">
              <SlideView kind="metrics" theme="light" title="Results" />
            </div>
            <div className="overflow-hidden rounded-[2px] border shadow-card">
              <DocPage type="Letterhead" title="Partnership" />
            </div>
          </div>
        </BrandScope>
      </div>
    </Card>
  );
}
