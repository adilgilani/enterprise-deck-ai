import { Link } from "@tanstack/react-router";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { SlideView } from "@/components/slide";
import { StatusPill } from "@/components/shared";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { initials, type Deck } from "@/lib/mock-data";

export function DeckCard({ deck }: { deck: Deck }) {
  return (
    <div className="group">
      <Link to="/presentations/$id" params={{ id: deck.id }} className="block overflow-hidden rounded-lg border shadow-card transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
        <SlideView kind={deck.cover} theme={deck.theme} title={deck.title} />
      </Link>
      <div className="mt-3 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/presentations/$id" params={{ id: deck.id }} className="block truncate text-[14px] font-medium hover:underline">{deck.title}</Link>
          <div className="mt-1 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span className="grid size-4 place-items-center rounded-full bg-muted text-[8px] font-semibold text-foreground">{initials(deck.author)}</span>
            {deck.author} · {deck.edited}
          </div>
        </div>
        <StatusPill status={deck.status} />
        <DropdownMenu>
          <DropdownMenuTrigger className="grid size-6 place-items-center rounded hover:bg-accent" aria-label="More"><MoreHorizontal className="size-4" /></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild><Link to="/editor/$id" params={{ id: deck.id }}>Edit</Link></DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast.success("Duplicated", { description: deck.title })}>Duplicate</DropdownMenuItem>
            <DropdownMenuItem onClick={() => toast("Link copied")}>Copy link</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
