import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowDown, ArrowLeft, ArrowUp, Copy, Download, Loader2, Play, Plus, Redo2, Save, Share2, Sparkles, Trash2, Undo2, Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SlideRenderer } from "@/components/slide";
import { ExportDialog } from "@/components/export-dialog";
import { ShareDialog } from "@/components/share-dialog";
import { CompliancePill, StatusPill } from "@/components/shared";
import { api } from "@/lib/api/client";
import { useInvalidate, usePresentation } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth";
import { LAYOUTS, LAYOUT_LABELS, STYLES, blankSlide, newId, normalizeTheme, type AnimationType, type Deck, type Layout, type Slide, type Style } from "@/lib/deck/schema";
import { STYLE_INFO } from "@/lib/deck/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor — VYRA" }] }),
  component: EditorPage,
});

const AI_COMMANDS = [
  "Make this more visual", "Reduce text by 40%", "Make this more premium", "Simplify", "Rewrite", "Add a chart",
  "Add an image", "Improve storytelling", "Change layout", "Create a stronger headline",
];

function setIn<T>(obj: T, path: (string | number)[], value: unknown): T {
  if (!path.length) return value as T;
  const [head, ...rest] = path;
  const copy: Record<string | number, unknown> | unknown[] = Array.isArray(obj) ? [...obj] : { ...(obj as Record<string, unknown>) };
  (copy as Record<string | number, unknown>)[head as string | number] = setIn((obj as Record<string | number, unknown>)[head as string | number], rest, value);
  return copy as T;
}

function EditorPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data, isLoading } = usePresentation(id);
  const invalidate = useInvalidate();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [past, setPast] = useState<Deck[]>([]);
  const [future, setFuture] = useState<Deck[]>([]);
  const [sel, setSel] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [aiLog, setAiLog] = useState<{ cmd: string; text: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [share, setShare] = useState(false);
  const [exp, setExp] = useState(false);
  const [playKey, setPlayKey] = useState(0);
  const loaded = useRef(false);

  useEffect(() => {
    if (data && !loaded.current) {
      loaded.current = true;
      setDeck({ ...data.deck, theme: normalizeTheme(data.deck.theme), slides: data.deck.slides.map((s) => ({ ...s, id: s.id || newId() })) });
    }
  }, [data]);

  const update = useCallback((fn: (d: Deck) => Deck) => {
    setDeck((d) => {
      if (!d) return d;
      setPast((p) => [...p.slice(-60), d]);
      setFuture([]);
      setDirty(true);
      return fn(d);
    });
  }, []);

  const save = useCallback(async () => {
    if (!deck) return;
    setSaving(true);
    try {
      await api(`/presentations/${id}`, { method: "PATCH", body: { deck, title: deck.title } });
      setDirty(false);
      void invalidate("presentations", "presentation");
      toast.success("Saved");
    } catch (e) {
      toast.error("Save failed", { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }, [deck, id, invalidate]);

  const undo = () => setPast((p) => {
    if (!p.length || !deck) return p;
    setFuture((f) => [deck, ...f]);
    setDeck(p[p.length - 1] ?? deck);
    setDirty(true);
    return p.slice(0, -1);
  });
  const redo = () => setFuture((f) => {
    if (!f.length || !deck) return f;
    setPast((p) => [...p, deck]);
    setDeck(f[0] ?? deck);
    setDirty(true);
    return f.slice(1);
  });

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const editing = (e.target as HTMLElement)?.isContentEditable || ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName);
      if (mod && e.key === "s") { e.preventDefault(); void save(); }
      if (editing) return;
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if (e.key === "ArrowDown" || e.key === "ArrowRight") setSel((s) => Math.min((deck?.slides.length ?? 1) - 1, s + 1));
      if (e.key === "ArrowUp" || e.key === "ArrowLeft") setSel((s) => Math.max(0, s - 1));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  if (isLoading || !deck) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></div>;
  if (data?.status === "generating") return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground"><div className="flex items-center gap-2"><Loader2 className="animate-spin" />Still generating…</div></div>;

  const slide = deck.slides[sel] ?? deck.slides[0];
  const editable = can("editor");
  const patchSlide = (fn: (s: Slide) => Slide) => update((d) => ({ ...d, slides: d.slides.map((s, i) => (i === sel ? fn(s) : s)) }));
  const addSlide = (layout: Layout) => {
    update((d) => ({ ...d, slides: [...d.slides.slice(0, sel + 1), blankSlide(layout), ...d.slides.slice(sel + 1)] }));
    setSel(sel + 1);
  };
  const duplicate = () => {
    if (!slide) return;
    update((d) => ({ ...d, slides: [...d.slides.slice(0, sel + 1), { ...structuredClone(slide), id: newId() }, ...d.slides.slice(sel + 1)] }));
    setSel(sel + 1);
  };
  const remove = () => {
    if (deck.slides.length <= 1) return void toast.error("A presentation needs at least one slide");
    update((d) => ({ ...d, slides: d.slides.filter((_, i) => i !== sel) }));
    setSel(Math.max(0, sel - 1));
  };
  const move = (dir: -1 | 1) => {
    const j = sel + dir;
    if (j < 0 || j >= deck.slides.length) return;
    update((d) => {
      const s = [...d.slides];
      const [a] = s.splice(sel, 1);
      if (a) s.splice(j, 0, a);
      return { ...d, slides: s };
    });
    setSel(j);
  };
  const runAI = async (command: string) => {
    if (!slide) return;
    setAiBusy(command);
    try {
      const r = await api<{ slide: Slide; explanation: string }>(`/presentations/${id}/ai-edit`, { body: { slide, command } });
      patchSlide(() => r.slide);
      setAiLog((l) => [{ cmd: command, text: r.explanation }, ...l].slice(0, 8));
      setPlayKey((k) => k + 1);
    } catch (e) {
      toast.error("AI edit failed", { description: (e as Error).message });
    } finally {
      setAiBusy(null);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-muted/30">
      {/* toolbar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background px-3">
        <Button variant="ghost" size="icon" asChild><Link to="/presentations" aria-label="Back"><ArrowLeft /></Link></Button>
        <input value={deck.title} onChange={(e) => update((d) => ({ ...d, title: e.target.value }))} className="w-72 truncate rounded-md bg-transparent px-2 py-1 text-[14px] font-medium outline-none hover:bg-muted focus:bg-muted" />
        <StatusPill status={data?.status ?? "draft"} />
        <span className="text-[12px] text-muted-foreground">{saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="mx-2 h-5 w-px bg-border" />
        <Tip label="Undo (⌘Z)"><Button variant="ghost" size="icon" onClick={undo} disabled={!past.length}><Undo2 /></Button></Tip>
        <Tip label="Redo (⌘⇧Z)"><Button variant="ghost" size="icon" onClick={redo} disabled={!future.length}><Redo2 /></Button></Tip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" disabled={!editable}><Plus />Add slide</Button></DropdownMenuTrigger>
          <DropdownMenuContent className="grid max-h-96 w-56 grid-cols-2 overflow-y-auto">
            {LAYOUTS.map((l) => <DropdownMenuItem key={l} onClick={() => addSlide(l)}>{LAYOUT_LABELS[l]}</DropdownMenuItem>)}
          </DropdownMenuContent>
        </DropdownMenu>
        <Tip label="Duplicate slide"><Button variant="ghost" size="icon" onClick={duplicate} disabled={!editable}><Copy /></Button></Tip>
        <Tip label="Delete slide"><Button variant="ghost" size="icon" onClick={remove} disabled={!editable}><Trash2 /></Button></Tip>
        <div className="ml-auto flex items-center gap-2">
          <CompliancePill />
          <Button variant="ghost" size="sm" onClick={() => setShare(true)}><Share2 />Share</Button>
          <Button variant="ghost" size="sm" onClick={() => setExp(true)}><Download />Export</Button>
          <Button variant="outline" size="sm" onClick={async () => { if (dirty) await save(); void navigate({ to: "/present/$id", params: { id }, search: { start: sel } as never }); }}><Play />Present</Button>
          <Button size="sm" onClick={() => void save()} disabled={saving || !dirty || !editable}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save</Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* thumbnails */}
        <aside className="w-[208px] shrink-0 overflow-y-auto border-r bg-background p-3">
          <div className="space-y-3">
            {deck.slides.map((s, i) => (
              <div key={s.id} className="group flex gap-2">
                <span className="w-4 pt-1 text-right font-mono text-[10px] text-muted-foreground">{i + 1}</span>
                <button onClick={() => setSel(i)} className={cn("relative flex-1 overflow-hidden rounded-md border transition-all", i === sel ? "ring-2 ring-brand ring-offset-1" : "opacity-90 hover:opacity-100")}>
                  <SlideRenderer slide={s} theme={deck.theme} index={i} total={deck.slides.length} />
                </button>
              </div>
            ))}
            <button onClick={() => addSlide("split")} disabled={!editable} className="ml-6 flex aspect-video w-[calc(100%-1.5rem)] items-center justify-center rounded-md border border-dashed text-[12px] text-muted-foreground hover:bg-muted"><Plus className="mr-1 size-3.5" />Add slide</button>
          </div>
        </aside>

        {/* canvas */}
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center overflow-auto p-8">
          <div className="w-full max-w-[1000px]">
            <div key={`${slide?.id}-${playKey}`} className="overflow-hidden rounded-lg shadow-slide ring-1 ring-black/5">
              <SlideRenderer slide={slide} theme={deck.theme} index={sel} total={deck.slides.length} editable={editable} animate={playKey > 0} onEdit={(path, value) => patchSlide((s) => setIn(s, path, value))} />
            </div>
            <div className="mt-3 flex items-center justify-between text-[12px] text-muted-foreground">
              <span>{LAYOUT_LABELS[slide?.layout ?? "split"]} layout · click any text to edit</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => move(-1)} disabled={sel === 0}><ArrowUp />Move up</Button>
                <Button variant="ghost" size="sm" onClick={() => move(1)} disabled={sel === deck.slides.length - 1}><ArrowDown />Move down</Button>
                <Button variant="ghost" size="sm" onClick={() => setPlayKey((k) => k + 1)}><Play />Preview animation</Button>
              </div>
            </div>
          </div>
        </main>

        {/* right panel */}
        <aside className="w-[328px] shrink-0 overflow-y-auto border-l bg-background">
          <Tabs defaultValue="ai" className="gap-0">
            <TabsList className="m-3 grid w-[calc(100%-1.5rem)] grid-cols-3">
              <TabsTrigger value="ai"><Sparkles className="size-3.5" />AI Designer</TabsTrigger>
              <TabsTrigger value="design">Design</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="space-y-4 px-4 pb-6">
              <p className="text-[12.5px] text-muted-foreground">Tell the AI Designer what to change on slide {sel + 1}. Your brand system is always enforced.</p>
              <div className="grid grid-cols-2 gap-1.5">
                {AI_COMMANDS.map((c) => (
                  <button key={c} onClick={() => void runAI(c)} disabled={!!aiBusy || !editable} className="flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-2 text-left text-[12px] leading-tight transition-colors hover:border-input hover:bg-accent disabled:opacity-50">
                    {aiBusy === c ? <Loader2 className="size-3 shrink-0 animate-spin" /> : <Wand2 className="size-3 shrink-0 text-brand" />}{c}
                  </button>
                ))}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) { void runAI(prompt.trim()); setPrompt(""); } }} className="space-y-2">
                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Turn this into a 3-step process" className="min-h-[72px] text-[13px]" />
                <Button type="submit" size="sm" className="w-full" disabled={!!aiBusy || !prompt.trim()}><Sparkles />Apply</Button>
              </form>
              {aiLog.length > 0 && (
                <div className="space-y-2">
                  <div className="eyebrow">History · undo with ⌘Z</div>
                  {aiLog.map((l, i) => <div key={i} className="rounded-md border bg-muted/30 p-2.5 text-[12px]"><div className="font-medium">{l.cmd}</div><div className="text-muted-foreground">{l.text}</div></div>)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="design" className="space-y-5 px-4 pb-6">
              <Labeled label="Visual style">
                <div className="grid grid-cols-2 gap-1.5">
                  {STYLES.map((s) => (
                    <button key={s} onClick={() => update((d) => ({ ...d, theme: { ...d.theme, style: s as Style } }))} className={cn("overflow-hidden rounded-md border text-left", deck.theme.style === s && "ring-2 ring-foreground")}>
                      <SlideRenderer slide={deck.slides[0]} theme={{ ...deck.theme, style: s }} />
                      <div className="px-2 py-1 text-[11.5px] font-medium">{STYLE_INFO[s].label}</div>
                    </button>
                  ))}
                </div>
              </Labeled>
              <Labeled label="Layout">
                <Select value={slide?.layout ?? "split"} onValueChange={(v) => patchSlide((s) => ({ ...s, layout: v as Layout }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{LAYOUTS.map((l) => <SelectItem key={l} value={l}>{LAYOUT_LABELS[l]}</SelectItem>)}</SelectContent>
                </Select>
              </Labeled>
              <Labeled label="Background">
                <div className="grid grid-cols-3 gap-1.5">
                  {(["default", "inverse", "brand"] as const).map((b) => <button key={b} onClick={() => patchSlide((s) => ({ ...s, background: b }))} className={cn("rounded-md border px-2 py-1.5 text-[12px] capitalize", (slide?.background ?? "default") === b && "border-foreground bg-accent")}>{b === "inverse" ? "Dark" : b}</button>)}
                </div>
              </Labeled>
              <Labeled label="Slide transition">
                <div className="grid grid-cols-4 gap-1.5">
                  {(["none", "fade", "dissolve", "slide"] as const).map((t) => <button key={t} onClick={() => patchSlide((s) => ({ ...s, transition: { type: t, duration_ms: 500 } }))} className={cn("rounded-md border px-2 py-1.5 text-[12px] capitalize", (slide?.transition?.type ?? "fade") === t && "border-foreground bg-accent")}>{t}</button>)}
                </div>
              </Labeled>
              <Labeled label="Element animations">
                <div className="space-y-1.5">
                  {slide?.elements.map((el, i) => (
                    <div key={i} className="flex items-center gap-2 text-[12px]">
                      <span className="w-20 truncate capitalize text-muted-foreground">{el.type}</span>
                      <Select value={el.animation?.type ?? "none"} onValueChange={(v) => patchSlide((s) => setIn(s, ["elements", i, "animation"], { ...(el.animation ?? {}), type: v as AnimationType }))}>
                        <SelectTrigger className="h-7 flex-1 text-[12px]"><SelectValue /></SelectTrigger>
                        <SelectContent>{(["none", "fade", "slide", "scale", "reveal", "stagger", "progressive"] as const).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
                      </Select>
                      <button aria-label="Remove element" onClick={() => patchSlide((s) => ({ ...s, elements: s.elements.filter((_, j) => j !== i) }))} className="rounded p-1 text-muted-foreground hover:bg-accent"><Trash2 className="size-3" /></button>
                    </div>
                  ))}
                  {!slide?.elements.length && <div className="text-[12px] text-muted-foreground">No elements on this slide.</div>}
                </div>
                <Button variant="outline" size="sm" className="mt-2 w-full" onClick={() => setPlayKey((k) => k + 1)}><Play />Preview</Button>
              </Labeled>
            </TabsContent>
            <TabsContent value="notes" className="px-4 pb-6">
              <Labeled label="Speaker notes">
                <Textarea value={slide?.notes ?? ""} onChange={(e) => patchSlide((s) => ({ ...s, notes: e.target.value }))} className="min-h-[220px] text-[13px]" placeholder="What to say on this slide…" />
              </Labeled>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
      <ShareDialog kind="presentations" id={id} title={deck.title} open={share} onOpenChange={setShare} />
      <ExportDialog presentationId={id} title={deck.title} open={exp} onOpenChange={setExp} beforeExport={dirty ? save : undefined} />
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-2 text-[12px] font-medium text-muted-foreground">{label}</div>{children}</div>;
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>;
}
