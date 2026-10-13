import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Pencil, Play, Share2 } from "lucide-react";
import { Page } from "@/components/app-shell";
import { ExportDialog } from "@/components/export-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { Score, StatusPill } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { Button } from "@/components/ui/button";
import { brand, deckSlides, decks } from "@/lib/mock-data";

export const Route = createFileRoute("/presentations/$id")({
  loader: ({ params }) => {
    const deck = decks.find((d) => d.id === params.id);
    if (!deck) throw notFound();
    return deck;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.title ?? "Presentation"} — Enterprise AI` }],
  }),
  notFoundComponent: () => (
    <Page>
      <div className="surface p-12 text-center">
        <div className="font-medium">Presentation not found</div>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/presentations">Back to presentations</Link>
        </Button>
      </div>
    </Page>
  ),
  component: Detail,
});

function Detail() {
  const deck = Route.useLoaderData();
  const [exp, setExp] = useState(false);
  const [share, setShare] = useState(false);
  const [active, setActive] = useState(0);
  const meta = [
    ["Last edited", deck.edited],
    ["Created by", deck.author],
    ["Brand system", brand.name],
    ["Slides", String(deck.slides)],
    ["Last presented", deck.lastPresented ?? "Never"],
  ];
  return (
    <Page>
      <div className="mb-2 text-[12px] text-muted-foreground">
        <Link to="/presentations" className="hover:text-foreground">
          Presentations
        </Link>{" "}
        / {deck.title}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-[44px] leading-tight">{deck.title}</h1>
          <div className="mt-2">
            <StatusPill status={deck.status} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/editor/$id" params={{ id: deck.id }}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/editor/$id" params={{ id: deck.id }} search={{ present: true }}>
              <Play />
              Present
            </Link>
          </Button>
          <Button variant="outline" onClick={() => setShare(true)}>
            <Share2 />
            Share
          </Button>
          <Button variant="outline" onClick={() => setExp(true)}>
            <Download />
            Export
          </Button>
        </div>
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div>
          <div className="overflow-hidden rounded-xl border shadow-slide">
            <SlideView slide={deckSlides[active]} theme={deck.theme} className="transition-all" />
          </div>
          <div className="mt-4 grid grid-cols-5 gap-3">
            {deckSlides.slice(0, 10).map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={`overflow-hidden rounded-md border transition-all ${active === i ? "ring-2 ring-brand" : "opacity-70 hover:opacity-100"}`}
              >
                <SlideView slide={s} theme={deck.theme} />
              </button>
            ))}
          </div>
        </div>
        <aside className="space-y-6">
          <div className="surface divide-y">
            {meta.map(([k, v]) => (
              <div key={k} className="flex justify-between px-4 py-2.5 text-[13px]">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="surface space-y-4 p-4">
            <div className="eyebrow">AI insights</div>
            <Score label="Story structure" value={92} />
            <Score label="Content density" value={78} />
            <Score label="Brand consistency" value={100} />
            <Score label="Visual consistency" value={94} />
            <Score label="Readability" value={88} />
            <p className="border-t pt-3 text-[12.5px] text-muted-foreground">
              Slides 6 and 9 are text-heavy. Consider converting to a timeline layout.
            </p>
          </div>
        </aside>
      </div>
      <ExportDialog open={exp} onOpenChange={setExp} />
      <ShareDialog open={share} onOpenChange={setShare} title={`Share “${deck.title}”`} />
    </Page>
  );
}
