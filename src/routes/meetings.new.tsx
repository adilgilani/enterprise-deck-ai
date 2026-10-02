import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, FileText, Layers, Loader2, Mic, Presentation, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { JobProgress } from "@/components/shared";
import { api, wsUrl } from "@/lib/api/client";
import { useJob } from "@/lib/api/hooks";
import type { Job, MeetingFull, WsTicket } from "@/lib/api/types";
import { startMic, startSimulated, type MicCapture } from "@/lib/audio";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/meetings/new")({
  head: () => ({ meta: [{ title: "Meeting Capture — VYRA" }] }),
  component: MeetingCapture,
});

type Phase = "setup" | "connecting" | "recording" | "stopping" | "choose" | "processing";
interface Seg { seq: number; speaker: string; text: string; start_ms: number }
interface Live {
  topics: { title: string }[];
  decisions: { text: string; owner?: string | null }[];
  action_items: { title: string; owner?: string | null; deadline?: string | null }[];
  questions: { text: string }[];
  risks: { text: string }[];
  numbers: { value: string; label: string }[];
}

const SPEAKER_COLORS = ["#2F5BD3", "#B45309", "#047857", "#9333EA", "#BE123C", "#0E7490"];

function fmtTime(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return [h, m, x].map((v) => String(v).padStart(2, "0")).join(":");
}

function MeetingCapture() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("setup");
  const [title, setTitle] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [person, setPerson] = useState("");
  const [agenda, setAgenda] = useState("");
  const [showAgenda, setShowAgenda] = useState(false);
  const [language, setLanguage] = useState<"en" | "ur-Latn" | "ur" | "auto">("en");
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const [provider, setProvider] = useState("");
  const [segments, setSegments] = useState<Seg[]>([]);
  const [partial, setPartial] = useState<{ speaker: string; text: string } | null>(null);
  const [live, setLive] = useState<Live | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [simulated, setSimulated] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [output, setOutput] = useState<string>("notes");
  const ws = useRef<WebSocket | null>(null);
  const mic = useRef<MicCapture | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const { job: polled } = useJob(job?.id);

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [segments, partial]);

  // waveform
  useEffect(() => {
    if (phase !== "recording") return;
    let raf = 0;
    const draw = () => {
      const c = canvas.current;
      const an = mic.current?.analyser;
      if (c) {
        const g = c.getContext("2d");
        if (g) {
          const w = (c.width = c.clientWidth * 2), h = (c.height = c.clientHeight * 2);
          g.clearRect(0, 0, w, h);
          const bars = 56;
          const data = new Uint8Array(an ? an.frequencyBinCount : 0);
          if (an) an.getByteTimeDomainData(data);
          for (let i = 0; i < bars; i++) {
            let amp: number;
            if (an) {
              const v = data[Math.floor((i / bars) * data.length)] ?? 128;
              amp = Math.min(1, Math.abs(v - 128) / 40 + 0.06);
            } else amp = 0.15 + 0.35 * Math.abs(Math.sin(Date.now() / 220 + i * 0.6)) * Math.abs(Math.sin(i * 1.7));
            const bh = Math.max(4, amp * h * 0.9);
            g.fillStyle = "#E11D48";
            g.globalAlpha = 0.35 + amp * 0.65;
            const bw = w / bars;
            g.beginPath();
            g.roundRect(i * bw + bw * 0.25, (h - bh) / 2, bw * 0.5, bh, bw * 0.25);
            g.fill();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  useEffect(() => () => {
    mic.current?.stop();
    ws.current?.close();
  }, []);

  useEffect(() => {
    if (polled?.status === "completed" && meetingId) {
      const pid = polled.result["presentation_id"] as string | undefined;
      if (output === "presentation" && pid) void navigate({ to: "/editor/$id", params: { id: pid } });
      else void navigate({ to: "/meetings/$id", params: { id: meetingId } });
    }
    if (polled?.status === "failed") toast.error("Processing failed", { description: polled.error ?? "" });
  }, [polled, meetingId, navigate, output]);

  const addPerson = () => {
    const p = person.trim();
    if (p && !people.includes(p)) setPeople([...people, p]);
    setPerson("");
  };

  const start = async (forceSim = false) => {
    setPhase("connecting");
    try {
      let id = meetingId;
      if (!id) {
        const m = await api<MeetingFull>("/meetings", { body: { title: title.trim() || `Meeting — ${new Date().toLocaleDateString()}`, participants: people.map((name) => ({ name })), agenda: agenda || null, language } });
        id = m.id;
        setMeetingId(id);
      }
      const ticket = await api<WsTicket>(`/meetings/${id}/start`, { method: "POST" });
      setProvider(ticket.provider);
      const sock = new WebSocket(wsUrl(ticket.url));
      sock.binaryType = "arraybuffer";
      ws.current = sock;
      sock.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
        if (msg["type"] === "segment") {
          setSegments((s) => [...s, msg as unknown as Seg]);
          setPartial(null);
        } else if (msg["type"] === "partial") setPartial({ speaker: String(msg["speaker"]), text: String(msg["text"]) });
        else if (msg["type"] === "insights") setLive(msg["data"] as Live);
        else if (msg["type"] === "error") toast.error(String(msg["message"]));
        else if (msg["type"] === "stopped") {
          sock.close();
          setPhase("choose");
        }
      };
      sock.onclose = () => setPhase((p) => (p === "recording" ? "choose" : p));
      await new Promise<void>((res, rej) => {
        sock.onopen = () => res();
        sock.onerror = () => rej(new Error("Could not connect to the live transcription service"));
      });
      const send = (pcm: ArrayBuffer) => sock.readyState === WebSocket.OPEN && sock.send(pcm);
      if (forceSim) {
        mic.current = startSimulated(send);
        setSimulated(true);
      } else {
        try {
          mic.current = await startMic(send);
        } catch {
          toast("Microphone unavailable — using simulated audio", { description: "Allow microphone access to capture a real meeting." });
          mic.current = startSimulated(send);
          setSimulated(true);
        }
      }
      setPhase("recording");
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("setup");
    }
  };

  const end = () => {
    setPhase("stopping");
    mic.current?.stop();
    mic.current = null;
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify({ type: "stop" }));
    else setPhase("choose");
  };

  const process = async (out: "notes" | "presentation" | "both") => {
    if (!meetingId) return;
    setOutput(out);
    setPhase("processing");
    try {
      setJob(await api<Job>(`/meetings/${meetingId}/end`, { body: { output: out } }));
    } catch (e) {
      toast.error((e as Error).message);
      setPhase("choose");
    }
  };

  // ---------------------------------------------------------------- render
  if (phase === "processing") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-8">
        <JobProgress title="Turning your meeting into intelligence" job={polled ?? job} eyebrow="Meeting processing" steps={["Finalizing transcript", "Extracting decisions, actions and risks", "Writing meeting notes", ...(output !== "notes" ? ["Designing branded presentation"] : [])]} />
      </div>
    );
  }

  if (phase === "choose") {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-8">
        <div className="w-full max-w-3xl animate-rise text-center">
          <div className="eyebrow">Meeting ended · {fmtTime(elapsed)} · {segments.length} transcript segments</div>
          <h1 className="mt-3 font-serif text-[48px] leading-tight">What would you like to create?</h1>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {([
              ["notes", FileText, "Meeting Notes", "Summary, decisions, action items, owners and deadlines."],
              ["presentation", Presentation, "Presentation", "A branded readout deck built from the meeting."],
              ["both", Layers, "Both", "Notes plus a ready-to-present deck."],
            ] as const).map(([k, Icon, label, desc]) => (
              <button key={k} onClick={() => void process(k)} className="surface surface-hover p-6 text-left">
                <div className={cn("grid size-11 place-items-center rounded-lg", k === "both" ? "bg-gradient-brand text-brand-foreground" : "border bg-muted/40")}><Icon className="size-5" /></div>
                <div className="mt-6 text-[17px] font-medium">{label}</div>
                <div className="mt-1 text-[13px] text-muted-foreground">{desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (phase === "setup" || phase === "connecting") {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="flex h-14 items-center px-6"><Button variant="ghost" size="sm" asChild><Link to="/meetings"><ArrowLeft />Meetings</Link></Button></div>
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 pb-20">
          <div className="eyebrow">Physical meeting</div>
          <h1 className="mt-2 font-serif text-[52px] leading-none">Meeting Capture</h1>
          <div className="mt-8 space-y-3">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting title — e.g. Q4 Strategy Meeting" className="h-12 text-[16px]" />
            <div className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
              {people.map((p) => <span key={p} className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[13px]">{p}<button onClick={() => setPeople(people.filter((x) => x !== p))} aria-label={`Remove ${p}`}><X className="size-3" /></button></span>)}
              <input value={person} onChange={(e) => setPerson(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addPerson(); } }} onBlur={addPerson} placeholder={people.length ? "Add participant" : "Participants — type a name and press Enter"} className="min-w-[180px] flex-1 bg-transparent px-1 text-[14px] outline-none" />
            </div>
            {showAgenda ? <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} placeholder="Agenda (one item per line)" className="min-h-[90px]" /> : <button onClick={() => setShowAgenda(true)} className="text-[13px] text-muted-foreground hover:text-foreground">+ Add agenda (optional)</button>}
            <div className="flex gap-1.5 pt-1">
              {([["en", "English"], ["ur-Latn", "Urdu · Roman"], ["ur", "اردو · Urdu script"], ["auto", "Auto-detect"]] as const).map(([k, l]) => <button key={k} onClick={() => setLanguage(k)} className={cn("rounded-full border px-3 py-1 text-[12.5px]", language === k ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground")}>{l}</button>)}
            </div>
          </div>
          <div className="mt-14 flex flex-col items-center">
            <button onClick={() => void start()} disabled={phase === "connecting"} className="relative grid size-36 place-items-center rounded-full bg-live text-white shadow-lift transition-transform hover:scale-[1.03] disabled:opacity-80" aria-label="Start listening">
              <span className="absolute inset-0 rounded-full bg-live animate-pulse-ring" />
              {phase === "connecting" ? <Loader2 className="size-10 animate-spin" /> : <Mic className="size-12" />}
            </button>
            <div className="mt-6 text-[18px] font-medium">Start Listening</div>
            <button onClick={() => void start(true)} className="mt-3 text-[12px] text-muted-foreground underline-offset-4 hover:underline">Demo without microphone</button>
          </div>
        </div>
      </div>
    );
  }

  // recording
  const speakers = Array.from(new Set(segments.map((s) => s.speaker)));
  const color = (sp: string) => SPEAKER_COLORS[Math.max(0, speakers.indexOf(sp)) % SPEAKER_COLORS.length];
  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-20 shrink-0 items-center gap-6 border-b px-8">
        <span className="flex items-center gap-2 rounded-full bg-live/10 px-3 py-1.5 text-[14px] font-semibold text-live"><span className="size-2.5 animate-pulse rounded-full bg-live" />Recording</span>
        <div className="font-mono text-[34px] font-medium tabular-nums tracking-tight">{fmtTime(elapsed)}</div>
        <canvas ref={canvas} className="h-12 flex-1" />
        <div className="text-right text-[12px] text-muted-foreground"><div className="font-medium text-foreground">{title || "Untitled meeting"}</div>{provider} STT{simulated && " · simulated audio"} · {language === "ur-Latn" ? "Roman Urdu" : language === "ur" ? "Urdu" : language === "auto" ? "Auto" : "English"}</div>
        <Button size="lg" variant="destructive" onClick={end} disabled={phase === "stopping"} className="h-12 px-6 text-[15px]">{phase === "stopping" ? <Loader2 className="animate-spin" /> : <Square className="fill-current" />}End Meeting</Button>
      </header>
      <div className="flex min-h-0 flex-1">
        <div ref={scroller} className="flex-1 overflow-y-auto px-10 py-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {segments.length === 0 && !partial && <div className="pt-24 text-center text-[18px] text-muted-foreground">Listening… the live transcript will appear here.</div>}
            {segments.map((s) => (
              <div key={s.seq} className="animate-rise">
                <div className="text-[13px] font-semibold" style={{ color: color(s.speaker) }}>{s.speaker}<span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">{fmtTime(Math.floor(s.start_ms / 1000))}</span></div>
                <div className="mt-1 text-[22px] leading-snug" dir="auto">{s.text}</div>
              </div>
            ))}
            {partial && <div><div className="text-[13px] font-semibold text-muted-foreground">{partial.speaker}</div><div className="mt-1 text-[22px] italic leading-snug text-muted-foreground" dir="auto">{partial.text}</div></div>}
          </div>
        </div>
        <aside className="w-[380px] shrink-0 overflow-y-auto border-l bg-muted/20 p-6">
          <div className="eyebrow mb-4 flex items-center gap-2"><span className="size-1.5 animate-pulse rounded-full bg-brand" />Live meeting AI</div>
          {!live && <div className="text-[13px] text-muted-foreground">Insights appear as the conversation progresses (updated every few seconds, only when something new is said).</div>}
          {live && (
            <div className="space-y-5">
              <InsightList title="Topics" items={live.topics.map((t) => t.title)} />
              <InsightList title="Decisions" accent items={live.decisions.map((d) => d.text)} />
              <InsightList title="Action items" items={live.action_items.map((a) => `${a.title}${a.owner ? ` — ${a.owner}` : ""}${a.deadline ? ` (${a.deadline})` : ""}`)} />
              <InsightList title="Questions" items={live.questions.map((q) => q.text)} />
              <InsightList title="Risks" items={live.risks.map((r) => r.text)} />
              {live.numbers.length > 0 && (
                <div>
                  <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Numbers</div>
                  <div className="grid grid-cols-2 gap-2">{live.numbers.slice(0, 6).map((n, i) => <div key={i} className="rounded-md border bg-card p-2.5"><div className="font-mono text-[18px] font-medium">{n.value}</div><div className="truncate text-[11.5px] text-muted-foreground">{n.label}</div></div>)}</div>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function InsightList({ title, items, accent }: { title: string; items: string[]; accent?: boolean }) {
  if (!items.length) return null;
  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">{title} <span className="font-mono">{items.length}</span></div>
      <ul className="space-y-1.5">
        {items.slice(0, 6).map((t, i) => <li key={i} className={cn("animate-rise rounded-md border bg-card px-3 py-2 text-[13px] leading-snug", accent && "border-l-2 border-l-brand")}>{t}</li>)}
      </ul>
    </div>
  );
}
