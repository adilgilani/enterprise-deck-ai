import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Chip, JobProgress, UsingBrandPanel } from "@/components/shared";
import { BrandChooser } from "@/components/brand-chooser";
import { SlideRenderer } from "@/components/slide";
import { api } from "@/lib/api/client";
import { useJob, usePresentation } from "@/lib/api/hooks";
import type { GenerateOut } from "@/lib/api/types";
import { STYLES, type Style } from "@/lib/deck/schema";
import { STYLE_INFO } from "@/lib/deck/theme";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/presentations/new")({
  head: () => ({ meta: [{ title: "New presentation — VYRA" }] }),
  component: NewPresentation,
});

const TYPES = [
  ["investor", "Investor"], ["board", "Board"], ["sales", "Sales"], ["company_overview", "Company overview"], ["strategy", "Strategy"],
  ["product_launch", "Product launch"], ["annual_report", "Annual report"], ["training", "Training"], ["market_analysis", "Market analysis"], ["custom", "Custom"],
] as const;
const AUDIENCES = ["executives", "investors", "customers", "employees", "partners"] as const;
const TONES = [["executive", "Executive"], ["premium", "Premium"], ["minimal", "Minimal"], ["bold", "Bold"], ["data_driven", "Data-driven"], ["storytelling", "Storytelling"]] as const;
const COUNTS = [5, 8, 10, 12, 15];
const EXAMPLES = [
  "Create a 12-slide investor presentation about our fintech platform.",
  "Quarterly board review covering revenue, pipeline, risks and asks.",
  "Sales deck for tier-1 banks on AI-assisted customer onboarding.",
];
const STEPS = ["Reading company context", "Retrieving company knowledge", "Generating storyline", "Designing slides", "Applying brand system"];

function NewPresentation() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState<string>("investor");
  const [audience, setAudience] = useState<string>("investors");
  const [tone, setTone] = useState<string>("executive");
  const [count, setCount] = useState(10);
  const [custom, setCustom] = useState("");
  const [creative, setCreative] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [knowledge, setKnowledge] = useState(true);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState<GenerateOut | null>(null);
  const { job } = useJob(gen?.job.id);
  const done = job?.status === "completed";

  useEffect(() => {
    const m = /(\d{1,2})[- ]slide/i.exec(prompt);
    if (m) setCount(Math.min(40, Math.max(3, Number(m[1]))));
    for (const [k] of TYPES) if (prompt.toLowerCase().includes(k.replace("_", " "))) setType(k);
  }, [prompt]);

  const submit = async () => {
    if (prompt.trim().length < 3) return void toast.error("Describe the presentation you want");
    setBusy(true);
    try {
      const slides = custom ? Number(custom) : count;
      setGen(await api<GenerateOut>("/presentations/generate", { body: { prompt, deck_type: type, audience, tone, slide_count: slides, creative_mode: creative, use_knowledge: knowledge, brand_system_id: brandId } }));
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  if (gen && gen.presentation_id) {
    if (!done) {
      return (
        <div className="grid min-h-[calc(100vh-56px)] place-items-center px-8">
          <JobProgress title="Designing your presentation" job={job} steps={STEPS} eyebrow="Company brand system applied" />
        </div>
      );
    }
    return <ChooseStyle id={gen.presentation_id} onDone={() => navigate({ to: "/editor/$id", params: { id: gen.presentation_id as string } })} />;
  }

  return (
    <Page className="max-w-[1180px]">
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="eyebrow">New presentation</div>
          <h1 className="mt-2 font-serif text-[44px] leading-tight">What should we create?</h1>
          <div className="mt-6"><BrandChooser value={brandId} onChange={setBrandId} title="1 · Choose your brand guidelines" /></div>
          <div className="mt-8 text-[12.5px] font-medium text-muted-foreground">2 · Describe your presentation</div>
          <div className="surface mt-2 p-1">
            <Textarea autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Create a 12-slide investor presentation about our fintech platform…" className="min-h-[150px] resize-none border-0 text-[16px] shadow-none focus-visible:ring-0" onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit(); }} />
            <div className="flex flex-wrap gap-1.5 border-t px-3 py-2.5">
              {EXAMPLES.map((ex) => <button key={ex} onClick={() => setPrompt(ex)} className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11.5px] text-muted-foreground hover:text-foreground">{ex}</button>)}
            </div>
          </div>

          <Field label="Presentation type">{TYPES.map(([k, l]) => <Chip key={k} active={type === k} onClick={() => setType(k)}>{l}</Chip>)}</Field>
          <Field label="Audience">{AUDIENCES.map((a) => <Chip key={a} active={audience === a} onClick={() => setAudience(a)}><span className="capitalize">{a}</span></Chip>)}</Field>
          <Field label="Tone">{TONES.map(([k, l]) => <Chip key={k} active={tone === k} onClick={() => setTone(k)}>{l}</Chip>)}</Field>
          <Field label="Number of slides">
            {COUNTS.map((n) => <Chip key={n} active={!custom && count === n} onClick={() => { setCount(n); setCustom(""); }}>{n}</Chip>)}
            <Input value={custom} onChange={(e) => setCustom(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="Custom" className="h-8 w-24" />
          </Field>

          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" onClick={() => void submit()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}Generate presentation</Button>
            <span className="text-[12px] text-muted-foreground">⌘ + Enter</span>
            <Link to="/templates" className="ml-auto text-[13px] text-muted-foreground hover:text-foreground">Start from a template →</Link>
          </div>
        </div>
        <aside className="space-y-4 lg:pt-16">
          <UsingBrandPanel brandId={brandId} />
          <div className="surface divide-y text-[13px]">
            <label className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium">Brand Lock</div><div className="text-[12px] text-muted-foreground">Approved colors, fonts & layouts only</div></div><Switch checked={!creative} onCheckedChange={(v) => setCreative(!v)} /></label>
            <label className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium">Creative mode</div><div className="text-[12px] text-muted-foreground">More design freedom, still on-brand</div></div><Switch checked={creative} onCheckedChange={setCreative} /></label>
            <label className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium">Use company knowledge</div><div className="text-[12px] text-muted-foreground">Case studies, services & numbers from AI Library</div></div><Switch checked={knowledge} onCheckedChange={setKnowledge} /></label>
          </div>
        </aside>
      </div>
    </Page>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 text-[12.5px] font-medium text-muted-foreground">{label}</div>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function ChooseStyle({ id, onDone }: { id: string; onDone: () => void }) {
  const { data } = usePresentation(id);
  const [style, setStyle] = useState<Style | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (data && !style) setStyle((data.deck.theme.style as Style) ?? "executive");
  }, [data, style]);
  if (!data) return <div className="grid min-h-[60vh] place-items-center"><Loader2 className="animate-spin" /></div>;
  const slides = data.deck.slides;
  const previews = [slides[0], slides.find((s) => ["metrics", "chart"].includes(s.layout)) ?? slides[1], slides.find((s) => ["grid", "split", "comparison"].includes(s.layout)) ?? slides[2]];
  const apply = async () => {
    setSaving(true);
    try {
      await api(`/presentations/${id}`, { method: "PATCH", body: { style } });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
      setSaving(false);
    }
  };
  return (
    <Page className="max-w-[1180px]">
      <div className="flex items-end justify-between">
        <div>
          <div className="eyebrow flex items-center gap-1.5"><Check className="size-3 text-success" />{slides.length} slides generated · {data.title}</div>
          <h1 className="mt-2 font-serif text-[44px] leading-tight">Choose your visual direction</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">Same content, four brand-approved styles. You can switch any time in the editor.</p>
        </div>
        <Button size="lg" onClick={() => void apply()} disabled={!style || saving}>{saving ? <Loader2 className="animate-spin" /> : <Sparkles />}Open in editor<ArrowRight /></Button>
      </div>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {STYLES.map((s) => (
          <button key={s} onClick={() => setStyle(s)} className={cn("surface surface-hover p-3 text-left", style === s && "ring-2 ring-foreground")}>
            <div className="overflow-hidden rounded-md border shadow-card"><SlideRenderer slide={previews[0]} theme={{ ...data.deck.theme, style: s }} total={slides.length} /></div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {previews.slice(1).map((p, i) => <div key={i} className="overflow-hidden rounded border"><SlideRenderer slide={p} theme={{ ...data.deck.theme, style: s }} index={i + 1} total={slides.length} /></div>)}
            </div>
            <div className="mt-3 flex items-center justify-between px-1">
              <div><div className="text-[15px] font-medium">{STYLE_INFO[s].label}</div><div className="text-[12.5px] text-muted-foreground">{STYLE_INFO[s].blurb}</div></div>
              {style === s && <span className="grid size-6 place-items-center rounded-full bg-foreground text-background"><Check className="size-3.5" /></span>}
            </div>
          </button>
        ))}
      </div>
    </Page>
  );
}
