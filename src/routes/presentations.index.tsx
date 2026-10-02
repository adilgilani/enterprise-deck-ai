import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FolderPlus, LayoutGrid, List, Plus, Presentation, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeckCard, DeckMenu } from "@/components/deck-card";
import { SlideRenderer } from "@/components/slide";
import { Avatar, EmptyState, StatusPill, ago } from "@/components/shared";
import { RenameDialog } from "@/components/dialogs";
import { useFolders, useInvalidate, usePresentations } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/presentations/")({
  head: () => ({ meta: [{ title: "Presentations — VYRA" }] }),
  component: PresentationsPage,
});

const STATUSES = ["all", "draft", "in_review", "approved", "presented"] as const;

function PresentationsPage() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState("updated");
  const [folder, setFolder] = useState<string | null>(null);
  const [favorites, setFavorites] = useState(false);
  const [newFolder, setNewFolder] = useState(false);
  const { data: folders } = useFolders();
  const invalidate = useInvalidate();
  const { data, isLoading } = usePresentations({ sort, ...(status !== "all" ? { status } : {}), ...(folder ? { folder_id: folder } : {}), ...(favorites ? { favorites: true } : {}) });
  const items = useMemo(() => (data ?? []).filter((d) => !q || d.title.toLowerCase().includes(q.toLowerCase())), [data, q]);

  return (
    <Page>
      <PageHeader
        title="Presentations"
        subtitle="Every deck in your workspace — generated, branded and ready to present."
        actions={<Button asChild><Link to="/presentations/new"><Plus />Create presentation</Link></Button>}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-64"><Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input className="h-8 pl-8" placeholder="Search presentations" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex rounded-md border bg-card p-0.5">
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setStatus(s)} className={cn("h-7 rounded px-2.5 text-[12.5px] capitalize", status === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{s.replace("_", " ")}</button>
          ))}
        </div>
        <Button variant={favorites ? "default" : "outline"} size="sm" onClick={() => setFavorites((f) => !f)}><Star />Favorites</Button>
        <div className="ml-auto flex items-center gap-2">
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="updated">Recently edited</SelectItem><SelectItem value="created">Newest</SelectItem><SelectItem value="title">Title A–Z</SelectItem></SelectContent>
          </Select>
          <div className="flex rounded-md border bg-card p-0.5">
            <button aria-label="Grid" onClick={() => setView("grid")} className={cn("grid size-7 place-items-center rounded", view === "grid" && "bg-accent")}><LayoutGrid className="size-3.5" /></button>
            <button aria-label="List" onClick={() => setView("list")} className={cn("grid size-7 place-items-center rounded", view === "list" && "bg-accent")}><List className="size-3.5" /></button>
          </div>
        </div>
      </div>
      <div className="mb-8 flex flex-wrap gap-2">
        <button onClick={() => setFolder(null)} className={cn("rounded-md border px-3 py-1.5 text-[12.5px]", !folder ? "border-foreground bg-foreground text-background" : "bg-card")}>All folders</button>
        {folders?.map((f) => (
          <button key={f.id} onClick={() => setFolder(f.id)} className={cn("rounded-md border px-3 py-1.5 text-[12.5px]", folder === f.id ? "border-foreground bg-foreground text-background" : "bg-card")}>{f.name}</button>
        ))}
        <button onClick={() => setNewFolder(true)} className="flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-[12.5px] text-muted-foreground"><FolderPlus className="size-3.5" />New folder</button>
      </div>

      {!isLoading && items.length === 0 && <EmptyState icon={Presentation} title="No presentations here yet" body="Generate one from a prompt in under a minute." action={<Button asChild><Link to="/presentations/new"><Plus />Create presentation</Link></Button>} />}
      {view === "grid" ? (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading && Array.from({ length: 6 }).map((_, i) => <div key={i} className="aspect-video animate-pulse rounded-lg bg-muted" />)}
          {items.map((d) => <DeckCard key={d.id} deck={d} />)}
        </div>
      ) : (
        <div className="surface divide-y">
          {items.map((d) => (
            <div key={d.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30">
              <Link to="/editor/$id" params={{ id: d.id }} className="w-28 shrink-0 overflow-hidden rounded border"><SlideRenderer slide={d.cover} theme={d.theme} total={d.slide_count} /></Link>
              <div className="min-w-0 flex-1">
                <Link to="/editor/$id" params={{ id: d.id }} className="block truncate text-[14px] font-medium hover:underline">{d.is_favorite && <Star className="mr-1 inline size-3 fill-warning text-warning" />}{d.title}</Link>
                <div className="text-[12px] text-muted-foreground">{d.slide_count} slides · {String(d.options["deck_type"] ?? "custom").replace("_", " ")} · {d.style}</div>
              </div>
              <div className="flex w-40 items-center gap-2 text-[12px] text-muted-foreground"><Avatar name={d.author?.name} />{d.author?.name}</div>
              <div className="w-24 text-[12px] text-muted-foreground">{ago(d.updated_at)}</div>
              <StatusPill status={d.status} />
              <DeckMenu deck={d} />
            </div>
          ))}
        </div>
      )}
      <RenameDialog
        open={newFolder}
        onOpenChange={setNewFolder}
        value=""
        title="New folder"
        onSave={async (name) => {
          await api("/folders", { body: { name, kind: "presentations" } });
          toast.success("Folder created");
          void invalidate("folders");
        }}
      />
    </Page>
  );
}
