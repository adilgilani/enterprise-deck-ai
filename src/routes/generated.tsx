import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Download,
  Eye,
  FileText,
  FolderClock,
  Globe,
  LayoutGrid,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Presentation,
  RotateCw,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { BrandMark, BrandScope } from "@/components/brand-scope";
import { DocPage } from "@/components/doc-page";
import { ExportDialog } from "@/components/export-dialog";
import { Chip, StatusPill } from "@/components/shared";
import { SlideView } from "@/components/slide";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { BrandSystem } from "@/lib/brand-data";
import { downloadHtml, printAsPdf, toExportContent } from "@/lib/export-html";
import type { GeneratedItem } from "@/lib/generated-data";
import { actions, useBrands, useGeneratedList, useHydrated } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/generated")({
  head: () => ({
    meta: [
      { title: "Generated Content — Enterprise AI" },
      {
        name: "description",
        content:
          "Every presentation and document AI has generated — view, open and download any time.",
      },
    ],
  }),
  component: GeneratedLibrary,
});

type KindFilter = "All" | "Presentations" | "Documents";

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function Thumb({
  item,
  brand,
  className,
}: {
  item: GeneratedItem;
  brand: BrandSystem | undefined;
  className?: string;
}) {
  const inner = item.slides ? (
    <SlideView slide={item.slides[0]} theme={item.theme} />
  ) : (
    <div className="grid aspect-video place-items-center bg-muted/60 py-[4%]">
      <div
        className="h-full overflow-hidden rounded-[2px] shadow-card"
        style={{ aspectRatio: "1 / 1.414" }}
      >
        <DocPage
          type={item.doc?.type ?? "Proposal"}
          title={item.name}
          section={item.doc?.sections[0]}
          client={item.doc?.client}
        />
      </div>
    </div>
  );
  return (
    <div className={cn("relative overflow-hidden rounded-md border", className)}>
      {brand ? <BrandScope brand={brand}>{inner}</BrandScope> : inner}
      {item.status !== "Ready" && (
        <div className="absolute inset-0 grid place-items-center bg-background/70 backdrop-blur-[1px]">
          {item.status === "Generating" ? (
            <Loader2 className="size-4 animate-spin text-brand" />
          ) : (
            <span className="text-[11px] font-medium text-destructive">Generation failed</span>
          )}
        </div>
      )}
    </div>
  );
}

function GeneratedLibrary() {
  const items = useGeneratedList();
  const brands = useBrands();
  const hydrated = useHydrated();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<KindFilter>("All");
  const [brandId, setBrandId] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [preview, setPreview] = useState<GeneratedItem | null>(null);
  const [exportItem, setExportItem] = useState<GeneratedItem | null>(null);
  const [deleting, setDeleting] = useState<GeneratedItem | null>(null);
  const brandOf = (id: string) => brands.find((b) => b.id === id);

  const list = useMemo(
    () =>
      items
        .filter((g) =>
          kind === "All"
            ? true
            : kind === "Presentations"
              ? g.kind === "Presentation"
              : g.kind !== "Presentation",
        )
        .filter((g) => brandId === "all" || g.brandId === brandId)
        .filter((g) =>
          `${g.name} ${g.templateName} ${g.source ?? ""}`.toLowerCase().includes(q.toLowerCase()),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items, kind, brandId, q],
  );
  const weekAgo = Date.now() - 7 * 864e5;
  const stats: [string, number][] = [
    ["Total generated", items.length],
    ["Presentations", items.filter((g) => g.kind === "Presentation").length],
    ["Proposals & documents", items.filter((g) => g.kind !== "Presentation").length],
    ["Last 7 days", items.filter((g) => new Date(g.createdAt).getTime() > weekAgo).length],
  ];

  const open = (g: GeneratedItem) => {
    if (g.status !== "Ready") return;
    if (g.slides) navigate({ to: "/editor/$id", params: { id: g.id } });
    else setPreview(g);
  };
  const quick = (g: GeneratedItem, how: "html" | "pdf") => {
    const b = brandOf(g.brandId);
    if (!b) return;
    if (how === "html") {
      downloadHtml(toExportContent(g, b));
      toast.success("Downloaded", { description: `${g.name}.html` });
    } else if (!printAsPdf(toExportContent(g, b))) {
      toast.error("Pop-up blocked", { description: "Allow pop-ups for this site to save as PDF." });
    }
  };
  const retry = (g: GeneratedItem) => {
    actions.updateGenerated(g.id, { status: "Generating" });
    setTimeout(() => {
      actions.updateGenerated(g.id, { status: "Ready" });
      toast.success("Regenerated", { description: g.name });
    }, 1600);
  };

  const Actions = ({ g }: { g: GeneratedItem }) => (
    <div className="flex items-center justify-end gap-1">
      {g.status === "Failed" ? (
        <Button size="sm" variant="outline" onClick={() => retry(g)}>
          <RotateCw />
          Retry
        </Button>
      ) : (
        <>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`Preview ${g.name}`}
            disabled={g.status !== "Ready"}
            onClick={() => setPreview(g)}
          >
            <Eye />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                aria-label={`Download ${g.name}`}
                disabled={g.status !== "Ready"}
              >
                <Download />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Download
              </DropdownMenuLabel>
              <DropdownMenuItem onClick={() => quick(g, "html")}>
                <Globe />
                {g.slides ? "Web presentation" : "Web document"} (.html)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => quick(g, "pdf")}>
                <FileText />
                PDF (Save as PDF)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setExportItem(g)}>More formats…</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            aria-label={`More actions for ${g.name}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={g.status !== "Ready"} onClick={() => open(g)}>
            <Pencil />
            {g.slides ? "Open in editor" : "Open"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              actions.addGenerated({
                ...g,
                id: `gen-${Date.now().toString(36)}`,
                name: `${g.name} (copy)`,
                createdAt: new Date().toISOString(),
              });
              toast.success("Duplicated");
            }}
          >
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => setDeleting(g)}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  return (
    <Page>
      <PageHeader
        title="Generated Content"
        subtitle="Every presentation and document AI has generated — saved automatically. View, open and download any time without regenerating."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/meetings/new">
                <Plus />
                Meeting → Presentation
              </Link>
            </Button>
            <Button asChild>
              <Link to="/presentations/new">
                <Plus />
                Create presentation
              </Link>
            </Button>
          </>
        }
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(([k, v]) => (
          <div key={k} className="surface p-4">
            <div className="eyebrow">{k}</div>
            <div className="mt-2 font-mono text-[26px] tracking-tight">{hydrated ? v : "—"}</div>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, template, meeting"
            className="h-8 pl-8"
            aria-label="Search generated content"
          />
        </div>
        {(["All", "Presentations", "Documents"] as const).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => setKind(k)}>
            {k}
          </Chip>
        ))}
        <div className="mx-1 h-5 w-px bg-border" />
        <Chip active={brandId === "all"} onClick={() => setBrandId("all")}>
          All brands
        </Chip>
        {brands.map((b) => (
          <Chip key={b.id} active={brandId === b.id} onClick={() => setBrandId(b.id)}>
            <span
              className="mr-1.5 inline-block size-2 rounded-full"
              style={{ background: b.slide.b }}
            />
            {b.name}
          </Chip>
        ))}
        <div className="ml-auto flex rounded-md border p-0.5">
          {(
            [
              ["list", List],
              ["grid", LayoutGrid],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              aria-label={`${v} view`}
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "grid size-7 place-items-center rounded",
                view === v ? "bg-accent" : "text-muted-foreground",
              )}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      {!hydrated ? (
        <div className="surface grid place-items-center py-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : list.length === 0 ? (
        <div className="surface grid place-items-center px-6 py-20 text-center">
          <div className="grid size-11 place-items-center rounded-lg border bg-muted/50">
            <FolderClock className="size-5 text-muted-foreground" />
          </div>
          <div className="mt-4 font-medium">
            {items.length ? "Nothing matches these filters" : "Nothing generated yet"}
          </div>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Presentations, proposals and meeting decks are saved here automatically as soon as
            they're generated.
          </p>
          {items.length ? (
            <Button
              className="mt-5"
              variant="outline"
              onClick={() => {
                setQ("");
                setKind("All");
                setBrandId("all");
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Button className="mt-5" asChild>
              <Link to="/meetings/new">Create a meeting</Link>
            </Button>
          )}
        </div>
      ) : view === "list" ? (
        <div className="surface overflow-x-auto">
          <table className="w-full min-w-[960px] text-[13px]">
            <thead className="border-b bg-muted/40 text-left text-muted-foreground">
              <tr>
                {["", "Name", "Type", "Brand", "Template", "Created", "Status", ""].map((h, i) => (
                  <th key={i} className="px-3 py-2.5 font-medium first:pl-4">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.map((g) => {
                const b = brandOf(g.brandId);
                return (
                  <tr key={g.id} className="group hover:bg-muted/30">
                    <td className="w-28 py-2.5 pl-4 pr-2">
                      <button
                        className="block w-24 text-left"
                        onClick={() => open(g)}
                        aria-label={`Open ${g.name}`}
                      >
                        <Thumb item={g} brand={b} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="w-[210px] xl:w-[250px]">
                        <button
                          className="block max-w-full truncate text-left font-medium hover:underline"
                          onClick={() => open(g)}
                          title={g.name}
                        >
                          {g.name}
                        </button>
                        <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground">
                          {g.kind === "Presentation" ? (
                            <Presentation className="size-3 shrink-0" />
                          ) : (
                            <FileText className="size-3 shrink-0" />
                          )}
                          <span className="truncate">
                            {g.kind}
                            {g.source && <> · {g.source}</>}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded border bg-card px-1.5 py-0.5 font-mono text-[11px]">
                        {g.fileType}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {b && (
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <BrandMark brand={b} className="size-5 text-[8px]" />
                          {b.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      <div className="w-32 truncate" title={g.templateName}>
                        {g.templateName}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                      {when(g.createdAt)}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusPill status={g.status} />
                    </td>
                    <td className="px-3 py-2.5">
                      <Actions g={g} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => {
            const b = brandOf(g.brandId);
            return (
              <div key={g.id} className="group">
                <button
                  className="block w-full transition-all duration-300 group-hover:-translate-y-0.5"
                  onClick={() => open(g)}
                  aria-label={`Open ${g.name}`}
                >
                  <Thumb item={g} brand={b} className="shadow-card group-hover:shadow-lift" />
                </button>
                <div className="mt-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium">{g.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
                      <span className="font-mono">{g.fileType}</span> · {b?.name} ·{" "}
                      {when(g.createdAt)}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">
                      Template: {g.templateName}
                    </div>
                  </div>
                  <StatusPill status={g.status} />
                </div>
                <div className="mt-2">
                  <Actions g={g} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PreviewDialog
        item={preview}
        onClose={() => setPreview(null)}
        brand={preview ? brandOf(preview.brandId) : undefined}
        onDownload={quick}
        onExport={(g) => setExportItem(g)}
      />
      <ExportDialog
        key={exportItem?.id ?? "none"}
        open={!!exportItem}
        onOpenChange={(o) => !o && setExportItem(null)}
        content={
          exportItem && brandOf(exportItem.brandId)
            ? toExportContent(exportItem, brandOf(exportItem.brandId)!)
            : undefined
        }
      />
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be removed from the Generated Content library. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleting) actions.removeGenerated(deleting.id);
                toast("Deleted", { description: deleting?.name });
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Page>
  );
}

function PreviewDialog({
  item,
  brand,
  onClose,
  onDownload,
  onExport,
}: {
  item: GeneratedItem | null;
  brand: BrandSystem | undefined;
  onClose: () => void;
  onDownload: (g: GeneratedItem, how: "html" | "pdf") => void;
  onExport: (g: GeneratedItem) => void;
}) {
  const [i, setI] = useState(0);
  const navigate = useNavigate();
  if (!item) return <Dialog open={false} />;
  const pages = item.slides ?? item.doc?.sections ?? [];
  const idx = Math.min(i, pages.length - 1);
  const big = item.slides ? (
    <SlideView slide={item.slides[idx]} theme={item.theme} />
  ) : (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-[3px] shadow-slide">
      <DocPage
        type={item.doc?.type ?? "Proposal"}
        title={item.name}
        section={item.doc?.sections[idx]}
        client={item.doc?.client}
        page={idx + 1}
      />
    </div>
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) {
          onClose();
          setI(0);
        }
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
          <DialogDescription>
            {item.kind} · {item.fileType} · {brand?.name} · Template: {item.templateName}
            {item.source ? ` · ${item.source}` : ""}
          </DialogDescription>
        </DialogHeader>
        {brand ? (
          <BrandScope brand={brand}>
            <div
              className={cn(
                item.slides
                  ? "overflow-hidden rounded-lg border shadow-slide"
                  : "rounded-lg bg-muted/50 p-6",
              )}
            >
              {big}
            </div>
          </BrandScope>
        ) : (
          big
        )}
        <div
          className={cn(
            "grid gap-2",
            item.slides ? "grid-cols-5 sm:grid-cols-8" : "grid-cols-6 sm:grid-cols-10",
          )}
        >
          {brand && (
            <BrandScope brand={brand}>
              {pages.slice(0, 16).map((p, n) => (
                <button
                  key={n}
                  onClick={() => setI(n)}
                  aria-label={`Page ${n + 1}`}
                  className={cn(
                    "overflow-hidden rounded border transition-all",
                    n === idx ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100",
                  )}
                >
                  {item.slides ? (
                    <SlideView slide={p as (typeof item.slides)[number]} theme={item.theme} />
                  ) : (
                    <DocPage
                      type={item.doc?.type ?? "Proposal"}
                      title={item.name}
                      section={p as string}
                      client={item.doc?.client}
                      page={n + 1}
                    />
                  )}
                </button>
              ))}
            </BrandScope>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={() => onDownload(item, "pdf")}>
            <FileText />
            Save as PDF
          </Button>
          <Button variant="outline" onClick={() => onDownload(item, "html")}>
            <Download />
            Download .html
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onClose();
              onExport(item);
            }}
          >
            More formats…
          </Button>
          {item.slides && (
            <Button
              onClick={() => {
                onClose();
                navigate({ to: "/editor/$id", params: { id: item.id } });
              }}
            >
              <Pencil />
              Open in editor
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
