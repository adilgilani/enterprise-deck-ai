import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Chip } from "@/components/shared";

const presets: Record<
  string,
  { transition: string; element: string; duration: number; rows: [string, number, number][] }
> = {
  Smooth: {
    transition: "Fade",
    element: "Rise",
    duration: 0.6,
    rows: [
      ["Title", 0, 40],
      ["Body", 15, 50],
      ["Visual", 30, 60],
    ],
  },
  Cinematic: {
    transition: "Push",
    element: "Reveal",
    duration: 1.2,
    rows: [
      ["Title", 0, 55],
      ["Body", 30, 55],
      ["Visual", 15, 85],
    ],
  },
  Executive: {
    transition: "Dissolve",
    element: "Fade",
    duration: 0.5,
    rows: [
      ["Title", 0, 30],
      ["Body", 20, 40],
      ["Visual", 25, 50],
    ],
  },
  Dynamic: {
    transition: "Slide",
    element: "Scale",
    duration: 0.8,
    rows: [
      ["Title", 0, 35],
      ["Body", 10, 45],
      ["Visual", 5, 55],
    ],
  },
  Minimal: {
    transition: "None",
    element: "Fade",
    duration: 0.3,
    rows: [
      ["Title", 0, 20],
      ["Body", 10, 25],
      ["Visual", 10, 30],
    ],
  },
};
const transitions = ["None", "Fade", "Dissolve", "Push", "Slide"];
const elements = ["Fade", "Rise", "Reveal", "Scale"];

/** `onPreview` lets the editor replay the slide's entrance animation. */
export function MotionPanel({ onPreview }: { onPreview: (preset: string) => void }) {
  const [preset, setPreset] = useState("Executive");
  const [tr, setTr] = useState(presets["Executive"]!.transition);
  const [el, setEl] = useState(presets["Executive"]!.element);
  const [dur, setDur] = useState([presets["Executive"]!.duration]);
  const [rows, setRows] = useState(presets["Executive"]!.rows);
  const [playing, setPlaying] = useState(false);
  const [head, setHead] = useState(0);
  const raf = useRef<number>(0);

  const choose = (p: string) => {
    const c = presets[p]!;
    setPreset(p);
    setTr(c.transition);
    setEl(c.element);
    setDur([c.duration]);
    setRows(c.rows);
  };

  useEffect(() => {
    if (!playing) return;
    const total = Math.max(1200, dur[0]! * 2200);
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / total);
      setHead(p * 100);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, dur]);

  return (
    <div className="space-y-5 p-4">
      <div>
        <div className="eyebrow mb-2">Presets</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(presets).map((p) => (
            <Chip key={p} active={preset === p} onClick={() => choose(p)}>
              {p}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-[12px]">
        <label className="space-y-1.5">
          <span className="text-muted-foreground">Slide transition</span>
          <Select value={tr} onValueChange={setTr}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {transitions.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-1.5">
          <span className="text-muted-foreground">Element animation</span>
          <Select value={el} onValueChange={setEl}>
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {elements.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
      <div>
        <div className="mb-2 flex justify-between text-[12px]">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-mono">{dur[0]!.toFixed(1)}s</span>
        </div>
        <Slider value={dur} min={0.2} max={2} step={0.1} onValueChange={setDur} />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="eyebrow">Sequence</div>
          <span className="font-mono text-[11px] text-muted-foreground">
            {(dur[0]! * 2.2).toFixed(1)}s total
          </span>
        </div>
        <div className="relative rounded-lg border bg-muted/30 p-2.5">
          <div className="mb-1.5 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>0s</span>
            <span>0.5</span>
            <span>1.0</span>
            <span>1.5</span>
            <span>2.0</span>
          </div>
          <div className="space-y-1.5">
            {rows.map(([name, start, w], i) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-10 text-[11px] text-muted-foreground">{name}</span>
                <div className="relative h-5 flex-1 rounded bg-background">
                  <div
                    className="absolute inset-y-0.5 rounded bg-brand/80 transition-all duration-500"
                    style={{
                      left: `${start}%`,
                      width: `${Math.min((w * dur[0]!) / 0.8, 100 - start)}%`,
                      opacity: 1 - i * 0.15,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div
            className="pointer-events-none absolute bottom-2.5 top-7 w-px bg-foreground"
            style={{ left: `calc(3.25rem + ${head} * (100% - 3.75rem) / 100)` }}
          />
        </div>
      </div>
      <Button
        className="w-full"
        variant="outline"
        onClick={() => {
          setHead(0);
          setPlaying((p) => !p);
          if (!playing) onPreview(el);
        }}
      >
        {playing ? (
          <>
            <Pause />
            Stop
          </>
        ) : (
          <>
            <Play />
            Preview animation
          </>
        )}
      </Button>
    </div>
  );
}
