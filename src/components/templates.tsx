import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronsUpDown,
  FileText,
  Loader2,
  Presentation,
  UploadCloud,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark, BrandScope } from "@/components/brand-scope";
import { DocPage } from "@/components/doc-page";
import { SlideView } from "@/components/slide";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  classifyTemplate,
  formatOf,
  isSlideTemplate,
  templateTypes,
  type DocTemplate,
  type TemplateType,
} from "@/lib/brand-data";
import { actions, useActiveBrand, useBrand, useBrands } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Renders a template's first page in its own brand — never the active one. */
export function TemplatePreview({
  template,
  title,
  section,
  client,
  className,
}: {
  template: Pick<DocTemplate, "type" | "theme" | "brandId" | "name">;
  title?: string;
  section?: string;
  client?: string;
  className?: string;
}) {
  const brand = useBrand(template.brandId);
  const inner = isSlideTemplate(template) ? (
    <SlideView
      kind="title"
      theme={template.theme}
      title={title ?? template.name}
      className={className}
    />
  ) : (
    <DocPage
      type={template.type}
      title={title ?? template.name}
      section={section ?? (template.type === "Proposal" ? "Cover" : "Executive Summary")}
      client={client}
      className={className}
    />
  );
  return brand ? <BrandScope brand={brand}>{inner}</BrandScope> : inner;
}

export function TemplateTypeBadge({ type }: { type: TemplateType }) {
  const Icon = isSlideTemplate({ type }) ? Presentation : FileText;
  return (
    <span className="inline-flex h-5 items-center gap-1 rounded-full border bg-card px-2 text-[11px] text-muted-foreground">
      <Icon className="size-3" />
      {type}
    </span>
  );
}

export function TemplateCard({
  template,
  selected,
  onSelect,
  action,
}: {
  template: DocTemplate;
  selected?: boolean;
  onSelect?: () => void;
  action?: React.ReactNode;
}) {
  const brand = useBrand(template.brandId);
  const slide = isSlideTemplate(template);
  return (
    <div className="group">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "relative grid w-full place-items-center overflow-hidden rounded-lg border bg-muted/40 p-4 transition-all duration-300",
          selected
            ? "ring-2 ring-brand"
            : "shadow-card group-hover:-translate-y-0.5 group-hover:shadow-lift",
          slide ? "aspect-[4/3]" : "aspect-[4/3]",
        )}
      >
        <div
          className={cn("overflow-hidden rounded-[3px] shadow-slide", slide ? "w-full" : "w-[52%]")}
        >
          <TemplatePreview template={template} />
        </div>
        {selected && (
          <span className="absolute right-2.5 top-2.5 grid size-6 place-items-center rounded-full bg-brand text-brand-foreground">
            <Check className="size-3.5" />
          </span>
        )}
      </button>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{template.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
            {brand && (
              <span className="size-2 rounded-full" style={{ background: brand.slide.b }} />
            )}
            {brand?.name} · <span className="font-mono">{template.format}</span> · {template.pages}{" "}
            {slide ? "slides" : template.pages === 1 ? "page" : "pages"}
          </div>
        </div>
        <TemplateTypeBadge type={template.type} />
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

const analyzeSteps = [
  "Reading file",
  "Detecting page layout",
  "Extracting typography",
  "Extracting colors",
  "Detecting headers & footers",
  "Classifying template type",
];
const accept = ".pptx,.ppt,.potx,.key,.pdf,.docx,.doc,.dotx";
const samples = [
  "Stixor_Letterhead_2026.docx",
  "Furviax_Proposal_Template.pdf",
  "Q4_Board_Deck.pptx",
  "Company_Pitch.key",
];

/** Upload → analyze → review & classify. Wire `analyze` to a template-parsing API later. */
export function UploadTemplateDialog({
  open,
  onOpenChange,
  onCreated,
  defaultBrandId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated?: (t: DocTemplate) => void;
  defaultBrandId?: string;
}) {
  const active = useActiveBrand();
  const brands = useBrands();
  const [stage, setStage] = useState<"pick" | "analyze" | "review">("pick");
  const [file, setFile] = useState("");
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<TemplateType>("Proposal");
  const [detected, setDetected] = useState<TemplateType>("Proposal");
  const [brandId, setBrandId] = useState(active.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const brand = brands.find((b) => b.id === brandId) ?? active;

  useEffect(() => {
    if (open) {
      setStage("pick");
      setI(0);
      setBrandId(defaultBrandId ?? active.id);
    }
  }, [open, active.id, defaultBrandId]);
  useEffect(() => {
    if (stage !== "analyze") return;
    if (i >= analyzeSteps.length) {
      setStage("review");
      return;
    }
    const t = setTimeout(() => setI((x) => x + 1), 380);
    return () => clearTimeout(t);
  }, [stage, i]);

  const begin = (fileName: string) => {
    const auto = classifyTemplate(fileName);
    const named = brands.find((b) =>
      fileName.toLowerCase().includes(b.name.split(" ")[0]!.toLowerCase()),
    );
    if (named) setBrandId(named.id);
    setFile(fileName);
    setDetected(auto);
    setType(auto);
    setName(fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
    setI(0);
    setStage("analyze");
  };
  const save = () => {
    const t: DocTemplate = {
      id: `up-${Date.now()}`,
      name: name.trim() || file,
      type,
      format: formatOf(file),
      brandId,
      pages: isSlideTemplate({ type }) ? 12 : type === "Letterhead" ? 1 : 8,
      updated: "Just now",
      by: "You",
      source: "Uploaded",
      theme: type === "PowerPoint" ? "ink" : type === "Presentation" ? "brand" : "light",
    };
    actions.addTemplate(t);
    onOpenChange(false);
    toast.success("Template ready", { description: `${t.name} · ${type} · ${brand.name}` });
    onCreated?.(t);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload template</DialogTitle>
          <DialogDescription>
            Proposal documents, letterheads, presentations, PowerPoint and business documents.
            Layout, fonts, colors and headers/footers are preserved.
          </DialogDescription>
        </DialogHeader>

        {stage === "pick" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const f = e.dataTransfer.files[0];
                if (f) begin(f.name);
              }}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              className={cn(
                "grid cursor-pointer place-items-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors",
                drag ? "border-brand bg-brand-soft" : "hover:bg-muted/40",
              )}
            >
              <UploadCloud className="size-6 text-muted-foreground" />
              <div className="mt-3 text-[14px] font-medium">Drop a template or click to browse</div>
              <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                PPTX · PPT · POTX · KEY · PDF · DOCX · DOTX
              </div>
              <input
                ref={inputRef}
                type="file"
                accept={accept}
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) begin(f.name);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
              Try a sample:
              {samples.map((s) => (
                <button
                  key={s}
                  onClick={() => begin(s)}
                  className="rounded-md border bg-card px-2 py-1 font-mono text-[11px] text-foreground hover:bg-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {stage === "analyze" && (
          <div className="py-4">
            <div className="flex items-center gap-2 text-[13px]">
              <FileText className="size-4" />
              <span className="font-mono">{file}</span>
            </div>
            <ol className="mt-5 space-y-2.5">
              {analyzeSteps.map((s, idx) => (
                <li
                  key={s}
                  className={cn("flex items-center gap-3 text-[13.5px]", idx > i && "text-subtle")}
                >
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full border",
                      idx < i && "border-foreground bg-foreground text-background",
                      idx === i && "border-brand text-brand",
                    )}
                  >
                    {idx < i ? (
                      <Check className="size-3" />
                    ) : idx === i ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : null}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        )}

        {stage === "review" && (
          <div className="grid gap-6 sm:grid-cols-[1fr_220px]">
            <div className="space-y-4">
              <label className="block space-y-1.5 text-[12px] text-muted-foreground">
                Template name
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-foreground"
                />
              </label>
              <label className="block space-y-1.5 text-[12px] text-muted-foreground">
                <span className="flex items-center justify-between">
                  Template type{" "}
                  {type === detected ? (
                    <span className="flex items-center gap-1 text-brand">
                      <Wand2 className="size-3" />
                      Auto-detected
                    </span>
                  ) : (
                    <span>Manually set</span>
                  )}
                </span>
                <Select value={type} onValueChange={(v) => setType(v as TemplateType)}>
                  <SelectTrigger className="text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {templateTypes.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-[12px] text-muted-foreground">
                Brand
                <Select value={brandId} onValueChange={setBrandId}>
                  <SelectTrigger className="text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <div className="divide-y rounded-lg border text-[12.5px]">
                {[
                  ["Layout", isSlideTemplate({ type }) ? "16:9 slide masters" : "A4 portrait"],
                  ["Typography", `${brand.headingFont} / ${brand.bodyFont}`],
                  [
                    "Headers & footers",
                    type === "Presentation" || type === "PowerPoint"
                      ? "Slide footer detected"
                      : "Detected",
                  ],
                  ["Format", formatOf(file)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between px-3 py-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="flex items-center gap-1.5">
                      <Check className="size-3 text-success" />
                      {v}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-muted-foreground">Colors</span>
                  <span className="flex gap-1">
                    {brand.colors.slice(0, 4).map((c) => (
                      <span
                        key={c.hex}
                        className="size-3.5 rounded-full border"
                        style={{ background: c.hex }}
                      />
                    ))}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <div className="eyebrow mb-2">Preview</div>
              <div className="overflow-hidden rounded border shadow-slide">
                <TemplatePreview
                  template={{
                    type,
                    theme: type === "PowerPoint" ? "ink" : "brand",
                    brandId,
                    name: name || file,
                  }}
                />
              </div>
              <Button className="mt-4 w-full" onClick={save}>
                Save template
              </Button>
              <Button variant="ghost" className="mt-1 w-full" onClick={() => setStage("pick")}>
                Choose another file
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function BrandPicker({
  label = "Brand",
  align = "end",
}: {
  label?: string;
  align?: "start" | "end";
}) {
  const brands = useBrands();
  const active = useActiveBrand();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-md border bg-card px-2 text-left text-[13px] shadow-card hover:bg-accent">
        <BrandMark brand={active} className="size-6 text-[9px]" />
        <span className="leading-tight">
          <span className="block text-[10.5px] text-muted-foreground">{label}</span>
          <span className="font-medium">{active.name}</span>
        </span>
        <ChevronsUpDown className="ml-1 size-3.5 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Generate with brand
        </DropdownMenuLabel>
        {brands.map((b) => (
          <DropdownMenuItem
            key={b.id}
            onClick={() => {
              actions.setActiveBrand(b.id);
              toast(`${b.name} brand selected`, {
                description: "Only this brand's assets and templates will be used.",
              });
            }}
            className="gap-2"
          >
            <BrandMark brand={b} className="size-6 text-[9px]" />
            <span className="flex-1">{b.name}</span>
            {b.id === active.id && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/brand">Manage brands</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
