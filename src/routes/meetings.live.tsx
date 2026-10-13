import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  FileText,
  Mic,
  MicOff,
  Pause,
  Play,
  Presentation,
  Share2,
  Sparkles,
  Square,
  Star,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { ExportDialog } from "@/components/export-dialog";
import { MeetingWorkflow } from "@/components/meeting-workflow";
import { ShareDialog } from "@/components/share-dialog";
import { BrandBadge, GenerationSteps } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { BrandPicker, TemplateCard } from "@/components/templates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Page } from "@/components/app-shell";
import { builtinDeckTemplates, isSlideTemplate } from "@/lib/brand-data";
import {
  actionItems,
  decisions,
  meetingSlides,
  openQuestions,
  quotes,
  risks,
  transcriptScript,
  type Theme,
} from "@/lib/mock-data";
import { actions, useActiveBrand } from "@/lib/store";
import {
  DeckTemplateGrid,
  useBrandDefaultDeckTemplate,
  useDeckTemplate,
} from "@/components/deck-template-picker";
import { GuidelinesApplied } from "@/components/guidelines";
import { buildMeetingDeck, q4Meeting } from "@/lib/meeting-ai";
import { fileTypeFor, newGeneratedId } from "@/lib/generated-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings/live")({
  validateSearch: (s: Record<string, unknown>): { title?: string; room?: string } => ({
    ...(typeof s["title"] === "string" && { title: s["title"] }),
    ...(typeof s["room"] === "string" && { room: s["room"] }),
  }),
  head: () => ({ meta: [{ title: "Recording — Meeting Studio" }] }),
  component: LiveMeeting,
});

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (s: number) =>
  `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
const processSteps = [
  "Finalising recording",
  "Transcribing conversation",
  "Identifying speakers",
  "Extracting decisions",
  "Extracting action items & owners",
  "Identifying requirements",
  "Building meeting summary",
];
const buildSteps = [
  "Analysing transcript",
  "Structuring storyline",
  "Loading template layouts",
  "Applying brand system",
  "Writing concise slide content",
  "Creating charts from key numbers",
  "Final quality check",
];
const times = [
  "10:14",
  "10:15",
  "10:15",
  "10:16",
  "10:17",
  "10:18",
  "10:19",
  "10:20",
  "10:21",
  "10:22",
  "10:23",
];
const requirements = [
  "Onboarding must complete within 21 days for new enterprise customers",
  "EU customers require in-region data processing (Private AI until the EU region ships)",
  "Two additional solutions engineers budgeted at ~$380K",
  "ABC Bank proposal must include a phased implementation roadmap",
];
const nextSteps = [
  "Finance confirms hiring budget (Oct 9)",
  "ABC Bank proposal sent (Oct 7)",
  "Leadership progress review (Oct 16)",
  "Onboarding playbook live (Oct 30)",
];

type Stage = "live" | "processing" | "ready" | "template" | "building";
type Choice = "notes" | "presentation" | "both";

function LiveMeeting() {
  const { title = "Q4 Strategy Meeting", room = "Boardroom — Level 12" } = Route.useSearch();
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("live");
  const [secs, setSecs] = useState(37 * 60 + 42);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [lines, setLines] = useState(2);
  const [marked, setMarked] = useState<number[]>([]);
  const [notes, setNotes] = useState<string[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [choice, setChoice] = useState<Choice>("both");
  const [result, setResult] = useState<Choice>("both");
  const defaultTemplate = useBrandDefaultDeckTemplate();
  const [templateId, setTemplateId] = useState<string>(defaultTemplate);
  const [seenDefault, setSeenDefault] = useState(defaultTemplate);
  if (seenDefault !== defaultTemplate) {
    setSeenDefault(defaultTemplate);
    setTemplateId(defaultTemplate);
  }
  const [share, setShare] = useState(false);
  const [exp, setExp] = useState(false);
  const [levels, setLevels] = useState<number[]>(Array(48).fill(0.1));
  const scroller = useRef<HTMLDivElement>(null);
  const brand = useActiveBrand();
  const deckTemplate = useDeckTemplate(templateId);

  useEffect(() => {
    if (stage !== "live" || paused) return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [stage, paused]);
  useEffect(() => {
    if (stage !== "live" || paused) return;
    const t = setInterval(() => setLines((l) => Math.min(transcriptScript.length, l + 1)), 2800);
    return () => clearInterval(t);
  }, [stage, paused]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 1e5, behavior: "smooth" });
  }, [lines, notes.length]);

  // Real mic level when permitted; otherwise a simulated waveform.
  useEffect(() => {
    if (stage !== "live") return;
    let timer = 0,
      stream: MediaStream | undefined,
      ctx: AudioContext | undefined,
      analyser: AnalyserNode | undefined;
    const data = new Uint8Array(64);
    const sim = () =>
      Array.from(
        { length: 48 },
        (_, i) => 0.12 + Math.abs(Math.sin(Date.now() / 260 + i * 0.5)) * Math.random() * 0.9,
      );
    navigator.mediaDevices
      ?.getUserMedia({ audio: true })
      .then((s) => {
        stream = s;
        ctx = new AudioContext();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        ctx.createMediaStreamSource(s).connect(analyser);
      })
      .catch(() => undefined);
    const loop = () => {
      if (paused || muted) setLevels(Array(48).fill(0.06));
      else if (analyser) {
        analyser.getByteFrequencyData(data);
        setLevels(
          Array.from({ length: 48 }, (_, i) =>
            Math.max(0.08, (data[Math.floor((i * 64) / 48)]! / 255) * 1.4),
          ),
        );
      } else setLevels(sim());
      timer = window.setTimeout(loop, 90);
    };
    loop();
    return () => {
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      void ctx?.close();
    };
  }, [stage, paused, muted]);

  const shown = transcriptScript.slice(0, lines);
  const stats = [
    ["Decisions", Math.min(3, Math.ceil(lines / 3.5))],
    ["Action Items", Math.min(7, Math.ceil(lines * 0.65))],
    ["Topics", Math.min(5, Math.ceil(lines / 2.2))],
    ["Questions", Math.min(4, Math.ceil(lines / 3))],
    ["Risks", lines > 7 ? 2 : lines > 4 ? 1 : 0],
    ["Key Numbers", Math.min(8, lines)],
  ] as const;

  const endMeeting = () => {
    setConfirm(false);
    setResult(choice);
    setStage("processing");
  };

  if (stage === "processing")
    return (
      <Centered step={2}>
        <GenerationSteps
          title="Turning your meeting into something useful"
          steps={processSteps}
          onDone={() => setStage(result === "presentation" ? "template" : "ready")}
          interval={600}
        />
      </Centered>
    );
  if (stage === "building")
    return (
      <Centered step={4}>
        <GenerationSteps
          title="Generating your presentation"
          steps={buildSteps}
          onDone={() => {
            const id = newGeneratedId();
            actions.addGenerated({
              id,
              name: `${title} — Deck`,
              kind: "Presentation",
              fileType: fileTypeFor(deckTemplate.format, "Presentation"),
              brandId: brand.id,
              templateName: deckTemplate.name,
              createdAt: new Date().toISOString(),
              status: "Ready",
              source: `Meeting · ${title}`,
              theme: deckTemplate.theme,
              slides: buildMeetingDeck(q4Meeting(title), { brand, layout: deckTemplate.layout }),
            });
            toast.success("Saved to Generated Content", { description: `${title} — Deck` });
            navigate({ to: "/editor/$id", params: { id }, search: { from: "meeting" } });
          }}
          interval={550}
        />
      </Centered>
    );
  if (stage === "template")
    return (
      <TemplateSelect
        title={title}
        selected={templateId}
        onSelect={setTemplateId}
        onBack={() => setStage("ready")}
        onGenerate={() => setStage("building")}
      />
    );

  if (stage === "ready") {
    const showNotes = result !== "presentation";
    const byOwner = actionItems.reduce<Record<string, string[]>>(
      (a, x) => ({ ...a, [x.owner]: [...(a[x.owner] ?? []), x.task] }),
      {},
    );
    return (
      <div className="min-h-screen bg-background">
        <Page>
          <MeetingWorkflow current={3} className="mb-8" />
          <div className="eyebrow flex items-center gap-1.5">
            <Check className="size-3.5 text-success" />
            Recorded, transcribed and analysed
          </div>
          <h1 className="mt-2 font-serif text-[44px]">Your meeting is ready.</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            {title} · {room} · 6 participants · {fmt(secs)}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setShare(true)}>
              <Share2 />
              Share meeting summary
            </Button>
            <Button variant="outline" onClick={() => setExp(true)}>
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                toast.success("Sent to team", { description: "6 participants notified." })
              }
            >
              Send to team
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/meetings">Done</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            {showNotes ? (
              <article className="surface space-y-8 p-8">
                <div className="flex items-center gap-2 text-[15px] font-medium">
                  <FileText className="size-4" />
                  Meeting Notes
                </div>
                <Section title="Meeting summary">
                  <p>
                    The team aligned on an enterprise-first Q4. Onboarding must fall from 41 to 21
                    days, requiring two additional solutions engineers. Banking pipeline is up 34%,
                    led by ABC Bank ($2.4M). The EU data region slips to January, so Private AI mode
                    will anchor European positioning.
                  </p>
                </Section>
                <Section title="Key discussion points">
                  <ul className="list-disc space-y-1.5 pl-5">
                    <li>Enterprise focus and narrowing the ideal customer profile</li>
                    <li>Implementation speed as the primary growth constraint</li>
                    <li>Banking pipeline momentum (+34%)</li>
                    <li>EU data residency timeline</li>
                  </ul>
                </Section>
                <Section title="Decisions made">
                  <ul className="list-disc space-y-1.5 pl-5">
                    {decisions.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Action items">
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-[13px]">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-medium">Task</th>
                          <th className="px-3 py-2 font-medium">Owner</th>
                          <th className="px-3 py-2 font-medium">Deadline</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {actionItems.map((a) => (
                          <tr key={a.task}>
                            <td className="px-3 py-2">{a.task}</td>
                            <td className="px-3 py-2">{a.owner}</td>
                            <td className="px-3 py-2 font-mono text-[12px]">{a.due}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
                <Section title="Assigned responsibilities">
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(byOwner).map(([o, ts]) => (
                      <div key={o} className="rounded-lg border p-3">
                        <div className="text-[13px] font-medium">{o}</div>
                        <ul className="mt-1 space-y-0.5 text-[12.5px] text-muted-foreground">
                          {ts.map((t) => (
                            <li key={t}>· {t}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title="Important requirements">
                  <ul className="list-disc space-y-1.5 pl-5">
                    {requirements.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Open questions">
                  <ul className="list-disc space-y-1.5 pl-5">
                    {openQuestions.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Risks">
                  <ul className="list-disc space-y-1.5 pl-5">
                    {risks.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </Section>
                <Section title="Next steps">
                  <ol className="list-decimal space-y-1.5 pl-5">
                    {nextSteps.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ol>
                </Section>
                <Section title="Important quotes">
                  {quotes.map((q) => (
                    <blockquote
                      key={q.text}
                      className="border-l-2 border-brand pl-4 font-serif text-[18px]"
                    >
                      “{q.text}”
                      <footer className="mt-1 font-sans text-[12px] text-muted-foreground">
                        — {q.who}
                      </footer>
                    </blockquote>
                  ))}
                </Section>
              </article>
            ) : (
              <div />
            )}
            <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              <div className="surface overflow-hidden">
                <div className="bg-gradient-brand p-6 text-brand-foreground">
                  <Presentation className="size-5" />
                  <div className="mt-6 font-serif text-[26px] leading-tight">
                    Generate presentation from meeting
                  </div>
                  <p className="mt-2 text-[13px] opacity-80">
                    AI turns the discussion and decisions into a 10-slide deck, using the template
                    you choose.
                  </p>
                </div>
                <ol className="space-y-2 border-b p-5 text-[13px]">
                  {[
                    "Select a presentation template",
                    "AI structures the transcript into slides",
                    "Review & edit, then export",
                  ].map((s, i) => (
                    <li key={s} className="flex items-center gap-2.5">
                      <span className="grid size-5 place-items-center rounded-full border font-mono text-[10px]">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ))}
                </ol>
                <div className="space-y-3 p-5">
                  <BrandBadge />
                  <Button className="w-full" size="lg" onClick={() => setStage("template")}>
                    <Sparkles />
                    Generate presentation
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Page>
        <ShareDialog open={share} onOpenChange={setShare} title="Share meeting summary" />
        <ExportDialog open={exp} onOpenChange={setExp} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-14 items-center gap-4 border-b px-6">
        <div className="font-medium">{title}</div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium",
            paused ? "bg-warning-soft text-warning" : "bg-destructive/10 text-live",
          )}
        >
          <span className={cn("size-2 rounded-full bg-current", !paused && "animate-pulse")} />
          {paused ? "Paused" : "Recording"}
        </span>
        <span className="hidden text-[12px] text-muted-foreground md:inline">{room}</span>
        <MeetingWorkflow current={0} className="ml-6 hidden xl:flex" />
        <span className="ml-auto font-mono text-[18px] tabular-nums" aria-label="Elapsed time">
          {fmt(secs)}
        </span>
      </header>

      <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_300px]">
        <main className="flex min-h-0 flex-col">
          <div className="grid place-items-center border-b px-6 py-8">
            <div className="flex h-24 items-center gap-[3px]" aria-hidden>
              {levels.map((l, i) => (
                <span
                  key={i}
                  className="w-[3px] rounded-full bg-foreground transition-[height] duration-100"
                  style={{ height: `${Math.max(4, l * 96)}px`, opacity: 0.25 + l * 0.75 }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Sparkles className="size-3.5 text-brand" />
              {paused
                ? "Recording paused"
                : muted
                  ? "Microphone muted"
                  : "AI is listening and transcribing"}
            </div>
          </div>
          <div
            ref={scroller}
            className="flex-1 space-y-5 overflow-y-auto px-6 py-6"
            style={{ maxHeight: "calc(100vh - 340px)" }}
            aria-live="polite"
          >
            <div className="eyebrow">Live transcript</div>
            {shown.map((l, i) => (
              <div key={i} className="animate-rise">
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">{l.who}</span>— {times[i]}
                  {marked.includes(i) && <Star className="size-3 fill-warning text-warning" />}
                </div>
                <p
                  className={cn(
                    "mt-1 text-[16px] leading-relaxed",
                    marked.includes(i) && "rounded bg-warning-soft px-2 py-1",
                  )}
                >
                  “{l.text}”
                </p>
              </div>
            ))}
            {notes.map((n, i) => (
              <div
                key={i}
                className="animate-rise rounded-md border border-dashed bg-muted/40 px-3 py-2 text-[13px]"
              >
                <StickyNote className="mr-1.5 inline size-3.5" />
                Note: {n}
              </div>
            ))}
          </div>
        </main>
        <aside className="border-l bg-sidebar p-5">
          <div className="eyebrow mb-4">Meeting AI · live extraction</div>
          <div className="grid grid-cols-2 gap-3">
            {stats.map(([k, v]) => (
              <div key={k} className="surface p-3">
                <div className="font-mono text-[28px] leading-none tabular-nums">{v}</div>
                <div className="mt-1.5 text-[12px] text-muted-foreground">{k}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-2 text-[12.5px]">
            <div className="eyebrow">Latest decisions</div>
            {decisions.slice(0, stats[0][1]).map((d) => (
              <div key={d} className="animate-rise rounded-md border bg-card p-2.5">
                {d}
              </div>
            ))}
            {stats[0][1] === 0 && (
              <div className="text-muted-foreground">Nothing yet — listening…</div>
            )}
          </div>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t bg-background px-6 py-3">
        <Button variant="outline" onClick={() => setPaused((p) => !p)}>
          {paused ? (
            <>
              <Play />
              Resume
            </>
          ) : (
            <>
              <Pause />
              Pause
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => setMuted((m) => !m)}>
          {muted ? (
            <>
              <MicOff />
              Unmute
            </>
          ) : (
            <>
              <Mic />
              Mute
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => setNoteOpen(true)}>
          <StickyNote />
          Add note
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setMarked((m) => [...m, lines - 1]);
            toast("Marked as important", { description: shown[lines - 1]?.text });
          }}
        >
          <Star />
          Mark important
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setPaused(true);
            setConfirm(true);
          }}
        >
          <Square />
          End Meeting
        </Button>
      </footer>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
            <DialogDescription>Attached to the transcript at {fmt(secs)}.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (noteText.trim()) {
                setNotes((n) => [...n, noteText.trim()]);
                setNoteText("");
                setNoteOpen(false);
              }
            }}
            className="space-y-4"
          >
            <Input
              autoFocus
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Type a note…"
            />
            <DialogFooter>
              <Button type="submit" disabled={!noteText.trim()}>
                Save note
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirm}
        onOpenChange={(o) => {
          setConfirm(o);
          if (!o) setPaused(false);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>End this meeting?</DialogTitle>
            <DialogDescription>
              AI will process the conversation and prepare your meeting outputs.
            </DialogDescription>
          </DialogHeader>
          <div className="text-[13px] font-medium">What would you like to create?</div>
          <RadioGroup
            value={choice}
            onValueChange={(v) => setChoice(v as Choice)}
            className="gap-2"
          >
            {(
              [
                ["notes", "Meeting notes", FileText],
                ["presentation", "Presentation", Presentation],
                ["both", "Both", Sparkles],
              ] as const
            ).map(([v, l, Icon]) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-[14px] transition-all",
                  choice === v ? "border-foreground bg-accent" : "hover:bg-muted/50",
                )}
              >
                <RadioGroupItem value={v} />
                <Icon className="size-4" />
                {l}
              </label>
            ))}
          </RadioGroup>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setConfirm(false);
                setPaused(false);
              }}
            >
              Keep recording
            </Button>
            <Button onClick={endMeeting}>End Meeting</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Centered({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background px-6">
      <MeetingWorkflow current={step} className="mx-auto pt-8" />
      <div className="grid flex-1 place-items-center">{children}</div>
    </div>
  );
}

function TemplateSelect({
  title,
  selected,
  onSelect,
  onBack,
  onGenerate,
}: {
  title: string;
  selected: string;
  onSelect: (id: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}) {
  const { theme, layout } = useDeckTemplate(selected);
  const brand = useActiveBrand();
  const preview = useMemo(
    () => buildMeetingDeck(q4Meeting(title), { brand, layout }),
    [title, brand, layout],
  );
  return (
    <div className="min-h-screen bg-background">
      <Page>
        <MeetingWorkflow current={3} className="mb-8" />
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <button
              onClick={onBack}
              className="mb-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" />
              Back to meeting outputs
            </button>
            <h1 className="font-serif text-[40px] leading-tight">Select a presentation template</h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              The AI will analyse “{title}” and build the deck inside this template's layout and
              visual hierarchy.
            </p>
          </div>
          <BrandPicker label="Brand" />
        </div>
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <DeckTemplateGrid selected={selected} onSelect={onSelect} />
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <div className="surface overflow-hidden">
              <div className="border-b px-4 py-3">
                <div className="eyebrow">Preview · meeting content in template</div>
              </div>
              <div className="space-y-2 p-4">
                <div className="overflow-hidden rounded border">
                  <SlideView slide={preview[0]} theme={theme} index={0} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {preview.slice(3, 7).map((s, i) => (
                    <div key={s.id} className="overflow-hidden rounded border">
                      <SlideView slide={s} theme={theme} index={i + 3} />
                    </div>
                  ))}
                </div>
                <GuidelinesApplied templateLayout={layout} />
              </div>
              <div className="space-y-3 border-t p-4">
                <BrandBadge />
                <Button className="w-full" size="lg" onClick={onGenerate}>
                  <Sparkles />
                  Generate presentation
                </Button>
                <p className="text-center text-[11.5px] text-muted-foreground">
                  You’ll review and edit every slide before export.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </Page>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-serif text-[22px]">{title}</h3>
      <div className="space-y-2 text-[14px] leading-relaxed text-foreground/85">{children}</div>
    </section>
  );
}
