import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { MoreHorizontal, Star } from "lucide-react";
import { toast } from "sonner";
import { SlideRenderer } from "@/components/slide";
import { Avatar, StatusPill, ago } from "@/components/shared";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShareDialog } from "@/components/share-dialog";
import { ExportDialog } from "@/components/export-dialog";
import { RenameDialog, ConfirmDialog } from "@/components/dialogs";
import { api } from "@/lib/api/client";
import { useInvalidate } from "@/lib/api/hooks";
import type { PresentationFull, PresentationSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function usePresentationActions(deck: PresentationSummary) {
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const refresh = () => invalidate("presentations", "presentation");
  return {
    duplicate: async () => {
      const copy = await api<PresentationFull>(`/presentations/${deck.id}/duplicate`, { method: "POST" });
      toast.success("Duplicated", { description: copy.title });
      void refresh();
    },
    favorite: async () => {
      await api(`/presentations/${deck.id}/favorite`, { method: "PUT", query: { on: !deck.is_favorite } });
      void refresh();
    },
    rename: async (title: string) => {
      await api(`/presentations/${deck.id}`, { method: "PATCH", body: { title } });
      toast.success("Renamed");
      void refresh();
    },
    remove: async () => {
      await api(`/presentations/${deck.id}`, { method: "DELETE" });
      toast("Presentation deleted", { description: deck.title });
      void refresh();
    },
    move: async (folderId: string | null) => {
      await api(`/presentations/${deck.id}`, { method: "PATCH", body: folderId ? { folder_id: folderId } : { clear_folder: true } });
      void refresh();
    },
    present: () => navigate({ to: "/present/$id", params: { id: deck.id } }),
    edit: () => navigate({ to: "/editor/$id", params: { id: deck.id } }),
  };
}

export function DeckMenu({ deck, trigger }: { deck: PresentationSummary; trigger?: React.ReactNode }) {
  const a = usePresentationActions(deck);
  const [share, setShare] = useState(false);
  const [exp, setExp] = useState(false);
  const [rename, setRename] = useState(false);
  const [del, setDel] = useState(false);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="grid size-6 place-items-center rounded hover:bg-accent" aria-label="More">{trigger ?? <MoreHorizontal className="size-4" />}</DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => void a.edit()}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void a.present()}>Present</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRename(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void a.duplicate()}>Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={() => void a.favorite()}>{deck.is_favorite ? "Remove favorite" : "Add to favorites"}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShare(true)}>Share…</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setExp(true)}>Export…</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={() => setDel(true)}>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ShareDialog kind="presentations" id={deck.id} title={deck.title} open={share} onOpenChange={setShare} />
      <ExportDialog presentationId={deck.id} title={deck.title} open={exp} onOpenChange={setExp} />
      <RenameDialog open={rename} onOpenChange={setRename} value={deck.title} onSave={a.rename} title="Rename presentation" />
      <ConfirmDialog open={del} onOpenChange={setDel} title={`Delete “${deck.title}”?`} body="This permanently deletes the presentation and its slides." confirm="Delete" destructive onConfirm={a.remove} />
    </>
  );
}

export function DeckCard({ deck }: { deck: PresentationSummary }) {
  const a = usePresentationActions(deck);
  const generating = deck.status === "generating";
  return (
    <div className="group">
      <Link
        to={generating ? "/presentations/$id" : "/editor/$id"}
        params={{ id: deck.id }}
        className="relative block overflow-hidden rounded-lg border shadow-card transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift"
      >
        <SlideRenderer slide={deck.cover} theme={deck.theme} total={deck.slide_count || 1} title={deck.title} />
        <button
          onClick={(e) => {
            e.preventDefault();
            void a.favorite();
          }}
          aria-label="Favorite"
          className={cn("absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-background/85 opacity-0 shadow-card backdrop-blur transition-opacity group-hover:opacity-100", deck.is_favorite && "opacity-100")}
        >
          <Star className={cn("size-3.5", deck.is_favorite ? "fill-warning text-warning" : "text-muted-foreground")} />
        </button>
        <span className="absolute bottom-2 right-2 rounded bg-background/85 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">{deck.slide_count} slides</span>
      </Link>
      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/editor/$id" params={{ id: deck.id }} className="block truncate text-[14px] font-medium hover:underline">{deck.title}</Link>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Avatar name={deck.author?.name} className="size-4 text-[8px] ring-0" />
            <span className="truncate">{deck.author?.name ?? "—"} · {ago(deck.updated_at)}</span>
          </div>
        </div>
        <StatusPill status={deck.status} />
        <DeckMenu deck={deck} />
      </div>
    </div>
  );
}
