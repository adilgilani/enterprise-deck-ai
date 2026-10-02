import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize, StickyNote, X } from "lucide-react";
import { SlideRenderer } from "@/components/slide";
import type { Deck } from "@/lib/deck/schema";
import { cn } from "@/lib/utils";

/** Full-screen web presenter: keyboard navigation, slide transitions, element animations, speaker notes. */
export function Presenter({ deck, start = 0, onExit }: { deck: Deck; start?: number; onExit?: () => void }) {
  const [i, setI] = useState(Math.min(start, deck.slides.length - 1));
  const [notes, setNotes] = useState(false);
  const total = deck.slides.length;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (["ArrowRight", "PageDown", " ", "Enter"].includes(e.key)) setI((x) => Math.min(total - 1, x + 1));
      if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) setI((x) => Math.max(0, x - 1));
      if (e.key === "Home") setI(0);
      if (e.key === "End") setI(total - 1);
      if (e.key === "n") setNotes((n) => !n);
      if (e.key === "f") void document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (e.key === "Escape" && !document.fullscreenElement) onExit?.();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [total, onExit]);
  const slide = deck.slides[i];
  const tr = slide?.transition?.type ?? "fade";
  return (
    <div className="group fixed inset-0 flex flex-col bg-black text-white">
      <div className="flex min-h-0 flex-1 items-center justify-center p-4" onClick={() => setI((x) => Math.min(total - 1, x + 1))}>
        <div className="w-full" style={{ maxWidth: "calc((100vh - 6rem) * 16 / 9)" }}>
          <div key={i} className={cn(tr !== "none" && `tr-${tr}`)} style={{ ["--tr" as string]: `${slide?.transition?.duration_ms ?? 500}ms` }}>
            <SlideRenderer slide={slide} theme={deck.theme} index={i} total={total} animate />
          </div>
        </div>
      </div>
      {notes && slide?.notes && <div className="mx-auto mb-2 max-w-3xl rounded-md bg-white/10 px-4 py-3 text-[14px] text-white/90">{slide.notes}</div>}
      <div className="flex h-12 items-center gap-2 px-4 text-[12px] text-white/60 opacity-0 transition-opacity group-hover:opacity-100">
        {onExit && <button onClick={onExit} className="rounded p-1.5 hover:bg-white/10" aria-label="Exit"><X className="size-4" /></button>}
        <span className="truncate">{deck.title}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setNotes((n) => !n)} className="rounded p-1.5 hover:bg-white/10" aria-label="Notes"><StickyNote className="size-4" /></button>
          <button onClick={() => setI((x) => Math.max(0, x - 1))} className="rounded p-1.5 hover:bg-white/10" aria-label="Previous"><ChevronLeft className="size-4" /></button>
          <span className="w-14 text-center font-mono">{i + 1} / {total}</span>
          <button onClick={() => setI((x) => Math.min(total - 1, x + 1))} className="rounded p-1.5 hover:bg-white/10" aria-label="Next"><ChevronRight className="size-4" /></button>
          <button onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)} className="rounded p-1.5 hover:bg-white/10" aria-label="Fullscreen"><Maximize className="size-4" /></button>
        </div>
      </div>
      <div className="h-0.5 bg-white/10"><div className="h-full bg-white/70 transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} /></div>
    </div>
  );
}
