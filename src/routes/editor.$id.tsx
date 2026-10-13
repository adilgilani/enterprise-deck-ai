import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Play,
  Redo2,
  Share2,
  Sparkles,
  Undo2,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-dialog";
import { MotionPanel } from "@/components/motion-panel";
import { ShareDialog } from "@/components/share-dialog";
import { BrandBadge, Chip } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { signatureLayouts } from "@/lib/slide-model";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { decks, deckSlides, layouts, meetingSlides, type Slide, type Theme } from "@/lib/mock-data";
import { builtinDeckTemplates } from "@/lib/brand-data";
import { MeetingWorkflow } from "@/components/meeting-workflow";
import {
  actions,
  useActiveBrand,
  useBrand,
  useDocTemplates,
  useGenerated,
  useHydrated,
} from "@/lib/store";
import { BrandScope, useScopedBrand } from "@/components/brand-scope";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor/$id")({
  validateSearch: (
    s: Record<string, unknown>,
  ): { from?: "meeting"; present?: boolean; template?: string } => ({
    ...(s["from"] === "meeting" && { from: "meeting" as const }),
    ...(typeof s["template"] === "string" && { template: s["template"] }),
    ...((s["present"] === true || s["present"] === "true") && { present: true }),
  }),
  head: () => ({ meta: [{ title: "Editor — Enterprise AI" }] }),
  component: EditorRoute,
});

interface EditorDoc {
  title: string;
  slides: Slide[];
  theme: Theme;
  /** Set when editing an item from the Generated Content library — edits are saved back to it. */
  genId?: string;
  source?: string;
  templateName?: string;
}

function EditorRoute() {
  const { id } = Route.useParams();
  const { from, template: templateId } = Route.useSearch();
  const hydrated = useHydrated();
  const gen = useGenerated(id);
  const genBrand = useBrand(gen?.brandId);
  const docTemplates = useDocTemplates();
  const template =
    docTemplates.find((t) => t.id === templateId) ??
    builtinDeckTemplates.find((t) => t.id === templateId);

  if (!gen && id.startsWith("gen-")) {
    return (
      <div className="grid h-screen place-items-center bg-muted/40 text-center">
        {hydrated ? (
          <div>
            <div className="font-medium">This item is no longer in your library</div>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/generated">Open Generated Content</Link>
            </Button>
          </div>
        ) : (
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  const fromMeeting = from === "meeting" || id === "meeting-q4";
  const deck = decks.find((d) => d.id === id);
  const doc: EditorDoc = gen
    ? {
        title: gen.name,
        slides: gen.slides ?? deckSlides,
        theme: gen.theme,
        genId: gen.id,
        templateName: gen.templateName,
        ...(gen.source && { source: gen.source }),
      }
    : {
        title: fromMeeting
          ? "Q4 Strategy Meeting — Deck"
          : (deck?.title ?? "Untitled presentation"),
        slides: fromMeeting ? meetingSlides : deckSlides,
        theme: template?.theme ?? (fromMeeting ? "brand" : (deck?.theme ?? "light")),
        ...(fromMeeting && { source: "Meeting · Q4 Strategy Meeting" }),
        ...(template && { templateName: template.name }),
      };
  // Remount after hydration so persisted library edits replace the server snapshot.
  const editor = <Editor key={`${id}-${hydrated}`} doc={doc} />;
  return genBrand ? <BrandScope brand={genBrand}>{editor}</BrandScope> : editor;
}

const aiActions = [
  "Make more visual",
  "Simplify",
  "Make more premium",
  "Improve storytelling",
  "Add chart",
  "Add image",
  "Rewrite",
  "Change layout",
];
const meetingActions = [
  "Improve design",
  "Condense",
  "Add visuals",
  "Add charts",
  "Rewrite",
  "Create executive version",
  "Create client-safe version",
];

function Editor({ doc }: { doc: EditorDoc }) {
  const { id } = Route.useParams();
  const { from, present, template: templateId } = Route.useSearch();
  const navigate = useNavigate();
  const fromMeeting = !!doc.source?.startsWith("Meeting");
  const deck = decks.find((d) => d.id === id);
  const activeBrand = useActiveBrand();
  const brand = useScopedBrand() ?? activeBrand;
  const [theme, setTheme] = useState<Theme>(doc.theme);
  const [history, setHistory] = useState<Slide[][]>([doc.slides]);
  const [cursor, setCursor] = useState(0);
  const [active, setActive] = useState(0);
  const [exp, setExp] = useState(false);
  const [share, setShare] = useState(false);
  const [showPresent, setShowPresent] = useState(!!present);
  const [banner, setBanner] = useState(fromMeeting);
  const [saved, setSaved] = useState<"saved" | "saving">("saved");
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [animKey, setAnimKey] = useState(0);

  const slides = history[cursor]!;
  const slide = slides[Math.min(active, slides.length - 1)]!;

  // Library items save every edit (including undo/redo and theme) back to the library.
  useEffect(() => {
    if (doc.genId) actions.updateGenerated(doc.genId, { slides, theme });
  }, [doc.genId, slides, theme]);

  const commit = useCallback(
    (next: Slide[]) => {
      setHistory((h) => [...h.slice(0, cursor + 1), next]);
      setCursor((c) => c + 1);
      setSaved("saving");
      setTimeout(() => setSaved("saved"), 900);
    },
    [cursor],
  );
  const patch = (p: Partial<Slide>) =>
    commit(slides.map((s, i) => (i === active ? { ...s, ...p } : s)));
  const undo = useCallback(() => setCursor((c) => Math.max(0, c - 1)), []);
  const redo = useCallback(
    () => setCursor((c) => Math.min(history.length - 1, c + 1)),
    [history.length],
  );

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (typing || showPresent) return;
      if (e.key === "ArrowDown" || e.key === "ArrowRight")
        setActive((a) => Math.min(slides.length - 1, a + 1));
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") setActive((a) => Math.max(0, a - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, redo, slides.length, showPresent]);

  const runAi = (action: string) => {
    setBusy(action);
    setTimeout(() => {
      setBusy(null);
      const bullets = slide.bullets?.slice(0, Math.max(2, (slide.bullets?.length ?? 3) - 1));
      const items = slide.items?.slice(0, Math.max(2, slide.items.length - 1));
      if (action === "Simplify" || action === "Condense")
        patch({ ...(bullets && { bullets }), ...(items && { items, lead: undefined }) });
      else if (action === "Make more visual" || action === "Add image" || action === "Add visuals")
        patch({ kind: "split" });
      else if (action === "Add chart" || action === "Add charts")
        patch({ kind: "chart", subtitle: "Quarterly trend, $M" });
      else if (action === "Change layout")
        patch({ kind: slide.kind === "grid" ? "timeline" : "grid" });
      else patch({ subtitle: slide.subtitle ?? "Refined by AI" });
      setAnimKey((k) => k + 1);
      toast.success(`${action} applied`, {
        description: `Slide ${active + 1} updated · brand rules preserved.`,
        action: { label: "Undo", onClick: undo },
      });
    }, 1100);
  };

  if (showPresent)
    return (
      <PresentMode
        slides={slides}
        theme={theme}
        start={active}
        onExit={() => {
          setShowPresent(false);
          navigate({
            to: "/editor/$id",
            params: { id },
            search: {
              ...(from && { from }),
              ...(templateId && { template: templateId }),
            },
            replace: true,
          });
        }}
      />
    );

  const title = doc.title;
  const meetingName = doc.source?.replace(/^Meeting · /, "");

  return (
    <div className="flex h-screen flex-col bg-muted/40">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-background px-3">
        <Button asChild variant="ghost" size="icon" aria-label="Back">
          {doc.genId ? (
            <Link to="/generated">
              <ArrowLeft />
            </Link>
          ) : (
            <Link to="/presentations/$id" params={{ id: deck?.id ?? "q3-board-review" }}>
              <ArrowLeft />
            </Link>
          )}
        </Button>
        <div className="text-[13px] font-medium">{title}</div>
        <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          {saved === "saving" ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Check className="size-3 text-success" />
              {doc.genId ? "Saved to library" : "Saved"}
            </>
          )}
        </span>
        <div className="mx-3 h-5 w-px bg-border" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={undo}
              disabled={cursor === 0}
              aria-label="Undo"
            >
              <Undo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Undo ⌘Z</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={redo}
              disabled={cursor >= history.length - 1}
              aria-label="Redo"
            >
              <Redo2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Redo ⇧⌘Z</TooltipContent>
        </Tooltip>
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowPresent(true)}>
            <Play />
            Present
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShare(true)}>
            <Share2 />
            Share
          </Button>
          <Button size="sm" onClick={() => setExp(true)}>
            <Download />
            Export
          </Button>
        </div>
      </header>

      {banner && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b bg-brand-soft px-4 py-2 text-[13px]">
          <Sparkles className="size-4 text-brand" />
          <span className="whitespace-nowrap font-medium">Generated from {meetingName}</span>
          {doc.templateName && (
            <span className="whitespace-nowrap rounded-full border bg-card px-2.5 py-1 text-[12px]">
              Template: <strong className="font-medium">{doc.templateName}</strong>
            </span>
          )}
          <BrandBadge className="ml-1" />
          <div className="ml-auto flex flex-wrap gap-1.5">
            {meetingActions.map((a) => (
              <button
                key={a}
                onClick={() => runAi(a)}
                className="rounded-md border bg-card px-2 py-1 text-[12px] hover:bg-accent"
              >
                {a}
              </button>
            ))}
          </div>
          <button
            aria-label="Dismiss"
            onClick={() => setBanner(false)}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {fromMeeting && (
        <div className="flex items-center justify-between gap-4 border-b bg-background px-4 py-2">
          <MeetingWorkflow current={5} />
          <span className="hidden text-[12px] text-muted-foreground lg:inline">
            Review every slide, then Export when ready.
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          className="w-48 shrink-0 overflow-y-auto border-r bg-background p-3"
          aria-label="Slides"
        >
          <div className="space-y-3">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className="group flex w-full items-start gap-2 text-left"
              >
                <span className="w-4 pt-1 font-mono text-[10px] text-muted-foreground">
                  {i + 1}
                </span>
                <span
                  className={cn(
                    "flex-1 overflow-hidden rounded border transition-all",
                    i === active ? "ring-2 ring-brand" : "opacity-80 group-hover:opacity-100",
                  )}
                >
                  <SlideView slide={s} theme={theme} index={i} />
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-auto p-8">
          <div className="w-full max-w-4xl overflow-hidden rounded-lg border shadow-slide">
            <div key={animKey} className={animKey ? "animate-rise" : ""}>
              <SlideView slide={slide} theme={theme} index={Math.min(active, slides.length - 1)} />
            </div>
          </div>
          <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Previous slide"
              onClick={() => setActive((a) => Math.max(0, a - 1))}
            >
              <ChevronLeft />
            </Button>
            Slide {active + 1} of {slides.length}
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Next slide"
              onClick={() => setActive((a) => Math.min(slides.length - 1, a + 1))}
            >
              <ChevronRight />
            </Button>
          </div>
          {busy && (
            <div className="flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-[12px] shadow-card">
              <Loader2 className="size-3.5 animate-spin text-brand" />
              {busy}…
            </div>
          )}
        </main>

        <aside className="w-80 shrink-0 overflow-y-auto border-l bg-background">
          <Tabs defaultValue="ai">
            <TabsList className="m-3 grid grid-cols-3">
              <TabsTrigger value="ai">AI Designer</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="motion">Motion</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="space-y-4 px-4 pb-6">
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Make this slide more visual and reduce the text by 40%."
                className="min-h-24 text-[13px]"
              />
              <Button
                className="w-full"
                disabled={!prompt.trim() || !!busy}
                onClick={() => {
                  runAi("Custom edit");
                  setPrompt("");
                }}
              >
                <Sparkles />
                Apply to slide
              </Button>
              <div className="eyebrow">Suggested</div>
              <div className="flex flex-wrap gap-1.5">
                {aiActions.map((a) => (
                  <Chip key={a} onClick={() => runAi(a)}>
                    {a}
                  </Chip>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="design" className="space-y-5 px-4 pb-6">
              <label className="block space-y-1.5 text-[12px]">
                <span className="text-muted-foreground">Slide title</span>
                <Input value={slide.title} onChange={(e) => patch({ title: e.target.value })} />
              </label>
              <div>
                <div className="eyebrow mb-2">Layout</div>
                <div className="grid grid-cols-3 gap-2">
                  {(theme === "signature" ? signatureLayouts : layouts).map((l) => (
                    <button
                      key={l.id}
                      onClick={() => patch({ kind: l.kind })}
                      className={cn(
                        "rounded-md border p-1 text-center transition-all",
                        slide.kind === l.kind ? "border-foreground" : "hover:bg-muted/50",
                      )}
                    >
                      <SlideView
                        slide={{ ...slide, kind: l.kind }}
                        theme={theme}
                        className="pointer-events-none rounded-sm"
                      />
                      <div className="mt-1 text-[10.5px]">{l.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="eyebrow mb-2">Theme (brand-approved)</div>
                <div className="flex flex-wrap gap-1.5">
                  {(["signature", "light", "ink", "brand", "editorial"] as Theme[]).map((t) => (
                    <Chip key={t} active={theme === t} onClick={() => setTheme(t)}>
                      {t === "signature" ? "Brand template" : t}
                    </Chip>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="motion" className="pb-6">
              <MotionPanel onPreview={() => setAnimKey((k) => k + 1)} />
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <ExportDialog
        open={exp}
        onOpenChange={setExp}
        content={{ kind: "deck", title, slides, theme, brand }}
      />
      <ShareDialog open={share} onOpenChange={setShare} title="Share presentation" />
    </div>
  );
}

function PresentMode({
  slides,
  theme,
  start,
  onExit,
}: {
  slides: Slide[];
  theme: Theme;
  start: number;
  onExit: () => void;
}) {
  const [i, setI] = useState(start);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExit();
      if (e.key === "ArrowRight" || e.key === " ") setI((x) => Math.min(slides.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [slides.length, onExit]);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black">
      <div key={i} className="w-[min(100vw,177vh)] animate-rise">
        <SlideView slide={slides[i]} theme={theme} index={i} />
      </div>
      <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-full bg-white/10 px-4 py-1.5 font-mono text-[11px] text-white/70 backdrop-blur">
        {i + 1} / {slides.length} · ← → to navigate · Esc to exit
      </div>
      <button
        onClick={onExit}
        aria-label="Exit presentation"
        className="absolute right-4 top-4 grid size-8 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
