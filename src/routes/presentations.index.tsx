import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LayoutGrid, List, Plus, Search, Presentation } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { DeckCard } from "@/components/deck-card";
import { Chip, StatusPill } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decks } from "@/lib/mock-data";

export const Route = createFileRoute("/presentations/")({
  head: () => ({
    meta: [
      { title: "Presentations — Enterprise AI" },
      { name: "description", content: "All presentations in your workspace." },
    ],
  }),
  component: PresentationsPage,
});

const filters = ["All", "Draft", "In review", "Approved", "Presented"];

function PresentationsPage() {
  const [q, setQ] = useState("");
  const [f, setF] = useState("All");
  const [view, setView] = useState<"grid" | "list">("grid");
  const list = useMemo(
    () =>
      decks.filter(
        (d) => (f === "All" || d.status === f) && d.title.toLowerCase().includes(q.toLowerCase()),
      ),
    [q, f],
  );
  return (
    <Page>
      <PageHeader
        title="Presentations"
        subtitle="Every deck is generated and governed by your brand system."
        actions={
          <Button asChild>
            <Link to="/presentations/new">
              <Plus />
              Create presentation
            </Link>
          </Button>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter presentations"
            className="h-8 pl-8"
          />
        </div>
        {filters.map((x) => (
          <Chip key={x} active={f === x} onClick={() => setF(x)}>
            {x}
          </Chip>
        ))}
        <div className="ml-auto flex rounded-md border p-0.5">
          {(
            [
              ["grid", LayoutGrid],
              ["list", List],
            ] as const
          ).map(([v, Icon]) => (
            <button
              key={v}
              aria-label={v}
              onClick={() => setView(v)}
              className={`grid size-7 place-items-center rounded ${view === v ? "bg-accent" : "text-muted-foreground"}`}
            >
              <Icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>
      {list.length === 0 ? (
        <div className="surface grid place-items-center px-6 py-20 text-center">
          <div className="grid size-11 place-items-center rounded-lg border bg-muted/50">
            <Presentation className="size-5 text-muted-foreground" />
          </div>
          <div className="mt-4 font-medium">No presentations match</div>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Try a different filter, or create a new deck.
          </p>
          <Button
            className="mt-5"
            variant="outline"
            onClick={() => {
              setQ("");
              setF("All");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : view === "grid" ? (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((d) => (
            <DeckCard key={d.id} deck={d} />
          ))}
        </div>
      ) : (
        <div className="surface divide-y overflow-hidden">
          {list.map((d) => (
            <Link
              key={d.id}
              to="/presentations/$id"
              params={{ id: d.id }}
              className="flex items-center gap-4 px-4 py-3 hover:bg-muted/40"
            >
              <div className="w-28 overflow-hidden rounded border">
                <SlideView kind={d.cover} theme={d.theme} title={d.title} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-medium">{d.title}</div>
                <div className="text-[12px] text-muted-foreground">
                  {d.author} · {d.slides} slides
                </div>
              </div>
              <span className="text-[12px] text-muted-foreground">{d.edited}</span>
              <StatusPill status={d.status} />
            </Link>
          ))}
        </div>
      )}
    </Page>
  );
}
