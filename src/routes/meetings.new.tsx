import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Check, FileText, Plus, Sparkles, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import {
  DeckTemplateGrid,
  useBrandDefaultDeckTemplate,
  useDeckTemplate,
} from "@/components/deck-template-picker";
import { GuidelinesApplied } from "@/components/guidelines";
import { MeetingWorkflow } from "@/components/meeting-workflow";
import { BrandBadge, GenerationSteps } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { BrandPicker } from "@/components/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { builtinDeckTemplates } from "@/lib/brand-data";
import { fileTypeFor, newGeneratedId } from "@/lib/generated-data";
import {
  analyzeMeeting,
  buildMeetingDeck,
  sampleMeeting,
  type MeetingInput,
} from "@/lib/meeting-ai";
import { initials } from "@/lib/mock-data";
import { actions, useActiveBrand } from "@/lib/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings/new")({
  validateSearch: (s: Record<string, unknown>): { template?: string } =>
    typeof s["template"] === "string" ? { template: s["template"] } : {},
  head: () => ({ meta: [{ title: "Create meeting — Meeting Studio" }] }),
  component: CreateMeeting,
});

const classicOutline = [
  "Meeting Overview",
  "Objectives",
  "Key Discussion Points",
  "Decisions Made",
  "Important Insights",
  "Action Items",
  "Owners & Responsibilities",
  "Next Steps",
];
const flow = ["Meeting details", "AI analysis", "Select template", "Generate", "Saved to library"];
const analyzeSteps = [
  "Reading meeting details",
  "Identifying objectives",
  "Clustering discussion themes",
  "Extracting decisions",
  "Mapping owners & responsibilities",
  "Detecting key numbers",
  "Planning presentation structure",
];
const buildSteps = [
  "Writing slide content",
  "Applying brand logo, colors & typography",
  "Laying out in your template",
  "Building insight charts",
  "Saving to Generated Content",
];

interface Form {
  title: string;
  date: string;
  participants: string[];
  objective: string;
  agenda: string;
  discussion: string;
  decisions: string;
  nextSteps: string;
  actions: { task: string; owner: string; due: string }[];
}

const toForm = (m: MeetingInput): Form => ({
  title: m.title,
  date: m.date,
  participants: m.participants,
  objective: m.objective,
  agenda: m.agenda.join("\n"),
  discussion: m.discussion.join("\n"),
  decisions: m.decisions.join("\n"),
  nextSteps: m.nextSteps.join("\n"),
  actions: m.actions,
});
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const toInput = (f: Form): MeetingInput => ({
  title: f.title.trim(),
  date: f.date,
  participants: f.participants,
  objective: f.objective.trim(),
  agenda: lines(f.agenda),
  discussion: lines(f.discussion),
  decisions: lines(f.decisions),
  nextSteps: lines(f.nextSteps),
  actions: f.actions.filter((a) => a.task.trim()),
});
const blank: Form = {
  title: "",
  date: new Date().toISOString().slice(0, 10),
  participants: [],
  objective: "",
  agenda: "",
  discussion: "",
  decisions: "",
  nextSteps: "",
  actions: [{ task: "", owner: "", due: "" }],
};

function CreateMeeting() {
  const navigate = useNavigate();
  const brand = useActiveBrand();
  const [phase, setPhase] = useState<"details" | "analyzing" | "review" | "building">("details");
  const [f, setF] = useState<Form>(() => toForm(sampleMeeting));
  const { template: requested } = Route.useSearch();
  const defaultTemplate = useBrandDefaultDeckTemplate();
  const [templateId, setTemplateId] = useState(requested ?? defaultTemplate);
  // Switching brand switches to that brand's own default template.
  const [seenDefault, setSeenDefault] = useState(defaultTemplate);
  if (seenDefault !== defaultTemplate) {
    setSeenDefault(defaultTemplate);
    setTemplateId(defaultTemplate);
  }
  const template = useDeckTemplate(templateId);
  const input = useMemo(() => toInput(f), [f]);
  const analysis = useMemo(() => analyzeMeeting(input, brand), [input, brand]);
  const deck = useMemo(
    () => buildMeetingDeck(input, { brand, layout: template.layout }),
    [input, brand, template.layout],
  );

  const checks: [string, boolean][] = [
    ["Meeting title", !!input.title],
    ["At least 2 participants", input.participants.length >= 2],
    ["Objective", !!input.objective],
    ["Discussion points", input.discussion.length > 0],
    ["Key decisions", input.decisions.length > 0],
    ["Action items with owners", input.actions.length > 0 && input.actions.every((a) => a.owner)],
    ["Next steps", input.nextSteps.length > 0],
  ];
  const ready = checks.every(([, ok]) => ok);

  const generate = () => {
    const id = newGeneratedId();
    actions.addGenerated({
      id,
      name: `${input.title} — Presentation`,
      kind: "Presentation",
      fileType: fileTypeFor(template.format, "Presentation"),
      brandId: brand.id,
      templateName: template.name,
      createdAt: new Date().toISOString(),
      status: "Ready",
      source: `Meeting · ${input.title}`,
      theme: template.theme,
      slides: deck,
    });
    toast.success("Saved to Generated Content", {
      description: `${input.title} — Presentation`,
      action: { label: "View library", onClick: () => navigate({ to: "/generated" }) },
    });
    navigate({ to: "/editor/$id", params: { id } });
  };

  if (phase === "analyzing" || phase === "building") {
    return (
      <Page>
        <MeetingWorkflow steps={flow} current={phase === "analyzing" ? 1 : 3} className="mb-6" />
        <div className="grid min-h-[60vh] place-items-center">
          <GenerationSteps
            title={
              phase === "analyzing"
                ? "Analyzing your meeting"
                : "Generating your branded presentation"
            }
            steps={phase === "analyzing" ? analyzeSteps : buildSteps}
            interval={phase === "analyzing" ? 450 : 520}
            onDone={phase === "analyzing" ? () => setPhase("review") : generate}
          />
        </div>
      </Page>
    );
  }

  if (phase === "review") {
    return (
      <Page>
        <MeetingWorkflow steps={flow} current={2} className="mb-6" />
        <button
          onClick={() => setPhase("details")}
          className="mb-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3" />
          Edit meeting details
        </button>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="eyebrow">AI analysis complete</div>
            <h1 className="mt-1 font-serif text-[40px] leading-tight">{input.title}</h1>
          </div>
          <BrandPicker label="Presentation brand" />
        </div>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <div className="surface p-6">
            <div className="eyebrow mb-2">Summary</div>
            <p className="text-[15px] leading-relaxed">{analysis.summary}</p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {analysis.insights.map((m) => (
                <div key={m.title + m.value} className="rounded-lg border bg-muted/30 p-3">
                  <div className="font-mono text-[22px] tracking-tight">{m.value}</div>
                  <div className="mt-1 text-[12px] font-medium leading-snug">{m.title}</div>
                  <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-muted-foreground">
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="surface p-6">
            <div className="eyebrow mb-3">Owners & responsibilities</div>
            <ul className="space-y-3">
              {Object.entries(analysis.owners).map(([o, ts]) => (
                <li key={o} className="flex gap-3 text-[13px]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                    {initials(o)}
                  </span>
                  <div>
                    <div className="font-medium">{o}</div>
                    <div className="text-muted-foreground">{ts.join(" · ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-tight">Presentation structure</h2>
          <p className="text-[13px] text-muted-foreground">
            {deck.length} slides, written from your meeting — previewed in{" "}
            <strong className="font-medium text-foreground">{template.name}</strong>
            {template.sourceFile && <> (built from {template.sourceFile})</>}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {deck.map((s, i) => (
              <div key={s.id}>
                <div className="overflow-hidden rounded-md border shadow-card">
                  <SlideView slide={s} theme={template.theme} index={i} />
                </div>
                <div className="mt-1.5 text-[12px]">
                  <span className="mr-1.5 font-mono text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.kicker ? s.kicker.replace(/^./, (c) => c.toUpperCase()) : classicOutline[i]}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div>
            <h2 className="mb-4 text-[17px] font-semibold tracking-tight">
              Select a presentation template
            </h2>
            <DeckTemplateGrid selected={templateId} onSelect={setTemplateId} />
          </div>
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="surface space-y-3 p-5">
              <div className="eyebrow">Ready to generate</div>
              <dl className="space-y-2 text-[13px]">
                {[
                  ["Brand", brand.name],
                  ["Template", template.name],
                  ["Slides", String(deck.length)],
                  ["Saves to", "Generated Content"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <BrandBadge />
              <GuidelinesApplied voice={analysis.voice} templateLayout={template.layout} />
              <Button className="w-full" size="lg" onClick={() => setPhase("building")}>
                <Sparkles />
                Generate presentation
              </Button>
            </div>
          </aside>
        </section>
      </Page>
    );
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Page>
      <MeetingWorkflow steps={flow} current={0} className="mb-6" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/meetings"
            className="mb-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" />
            Meeting Studio
          </Link>
          <h1 className="font-serif text-[40px] leading-tight">Create a meeting</h1>
          <p className="mt-1 text-[14px] text-muted-foreground">
            Enter the meeting details — AI analyzes them and generates a branded presentation.
          </p>
        </div>
        <BrandPicker label="Presentation brand" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 rounded-lg border bg-brand-soft px-4 py-3 text-[13px]">
        <Wand2 className="size-4 text-brand" />
        <span className="flex-1">
          Sample meeting loaded:{" "}
          <strong className="font-medium">Product Launch Planning Meeting</strong>. Edit anything,
          or start from scratch.
        </span>
        <Button size="sm" variant="outline" onClick={() => setF(toForm(sampleMeeting))}>
          Load sample
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setF(blank)}>
          Clear all
        </Button>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card title="Meeting">
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <Field label="Meeting title">
                <Input
                  value={f.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="e.g. Product Launch Planning Meeting"
                />
              </Field>
              <Field label="Date">
                <Input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} />
              </Field>
            </div>
            <Field label="Participants" className="mt-4">
              <Participants value={f.participants} onChange={(v) => set("participants", v)} />
            </Field>
            <Field label="Objectives — one per line" className="mt-4">
              <Textarea
                value={f.objective}
                onChange={(e) => set("objective", e.target.value)}
                placeholder="Launch scope — Agree what ships in the release"
                className="min-h-24"
              />
            </Field>
          </Card>
          <Card title="Agenda & discussion">
            <div className="grid gap-4 sm:grid-cols-2">
              <Lines label="Agenda" value={f.agenda} onChange={(v) => set("agenda", v)} />
              <Lines
                label="Discussion points"
                value={f.discussion}
                onChange={(v) => set("discussion", v)}
                hint="Numbers are detected as key insights"
              />
            </div>
          </Card>
          <Card title="Outcomes">
            <div className="grid gap-4 sm:grid-cols-2">
              <Lines
                label="Key decisions"
                value={f.decisions}
                onChange={(v) => set("decisions", v)}
              />
              <Lines label="Next steps" value={f.nextSteps} onChange={(v) => set("nextSteps", v)} />
            </div>
            <div className="mt-6">
              <div className="mb-2 flex items-center justify-between text-[12px] text-muted-foreground">
                Action items<span className="font-mono">{input.actions.length}</span>
              </div>
              <div className="space-y-2">
                {f.actions.map((a, i) => (
                  <div key={i} className="grid grid-cols-[1fr_170px_110px_32px] gap-2">
                    <Input
                      value={a.task}
                      placeholder="Task"
                      aria-label={`Action ${i + 1} task`}
                      onChange={(e) =>
                        set(
                          "actions",
                          f.actions.map((x, j) => (j === i ? { ...x, task: e.target.value } : x)),
                        )
                      }
                    />
                    <Select
                      value={a.owner}
                      onValueChange={(v) =>
                        set(
                          "actions",
                          f.actions.map((x, j) => (j === i ? { ...x, owner: v } : x)),
                        )
                      }
                    >
                      <SelectTrigger aria-label={`Action ${i + 1} owner`}>
                        <SelectValue placeholder="Owner" />
                      </SelectTrigger>
                      <SelectContent>
                        {f.participants.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={a.due}
                      placeholder="Due"
                      aria-label={`Action ${i + 1} due`}
                      onChange={(e) =>
                        set(
                          "actions",
                          f.actions.map((x, j) => (j === i ? { ...x, due: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9"
                      aria-label={`Remove action ${i + 1}`}
                      onClick={() =>
                        set(
                          "actions",
                          f.actions.filter((_, j) => j !== i),
                        )
                      }
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => set("actions", [...f.actions, { task: "", owner: "", due: "" }])}
              >
                <Plus />
                Add action item
              </Button>
            </div>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="eyebrow">AI pre-check</div>
            </div>
            <ul className="space-y-2 p-4 text-[13px]">
              {checks.map(([l, ok]) => (
                <li
                  key={l}
                  className={cn("flex items-center gap-2", !ok && "text-muted-foreground")}
                >
                  {ok ? (
                    <Check className="size-3.5 text-success" />
                  ) : (
                    <AlertCircle className="size-3.5 text-warning" />
                  )}
                  {l}
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t p-4 text-[12.5px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="size-3.5" />
                Generates 8 slides: overview → next steps
              </div>
              <BrandBadge />
            </div>
            <div className="border-t p-4">
              <Button
                className="w-full"
                size="lg"
                disabled={!ready}
                onClick={() => setPhase("analyzing")}
              >
                <Sparkles />
                Analyze meeting
              </Button>
              {!ready && (
                <p className="mt-2 text-center text-[11.5px] text-muted-foreground">
                  Complete the highlighted items to continue.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="surface p-6">
      <h2 className="mb-4 text-[15px] font-semibold">{title}</h2>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "block space-y-1.5 text-[12px] text-muted-foreground [&_input]:text-foreground [&_textarea]:text-foreground",
        className,
      )}
    >
      <span>{label}</span>
      {children}
    </label>
  );
}
function Lines({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="block space-y-1.5 text-[12px] text-muted-foreground">
      <span className="flex justify-between">
        {label}
        <span className="font-mono">{lines(value).length}</span>
      </span>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="One per line"
        className="min-h-32 text-[13px] text-foreground"
      />
      <span className="text-[11px]">
        {hint ?? "One per line · “Headline — detail” sets the slide headline"}
      </span>
    </label>
  );
}
function Participants({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const n = draft.trim();
    if (n && !value.includes(n)) onChange([...value, n]);
    setDraft("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-card p-1.5 focus-within:ring-2 focus-within:ring-ring/30">
      {value.map((p) => (
        <span
          key={p}
          className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-1 pr-2 text-[12.5px] text-foreground"
        >
          <span className="grid size-5 place-items-center rounded-full bg-background text-[9px] font-semibold">
            {initials(p)}
          </span>
          {p}
          <button
            type="button"
            aria-label={`Remove ${p}`}
            onClick={() => onChange(value.filter((x) => x !== p))}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
          if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        placeholder={value.length ? "Add person…" : "Type a name and press Enter"}
        className="min-w-36 flex-1 bg-transparent px-1.5 py-1 text-[13px] text-foreground outline-none"
        aria-label="Add participant"
      />
    </div>
  );
}
