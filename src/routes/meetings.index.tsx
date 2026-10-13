import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  FileText,
  Mic,
  Plus,
  Presentation,
  ShieldCheck,
  Users,
  Wand2,
} from "lucide-react";
import { Page } from "@/components/app-shell";
import { MeetingWorkflow } from "@/components/meeting-workflow";
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
import { meetingHistory } from "@/lib/mock-data";

export const Route = createFileRoute("/meetings/")({
  head: () => ({
    meta: [
      { title: "Meeting Studio — Enterprise AI" },
      {
        name: "description",
        content: "Record in-house meetings and turn them into notes or on-brand presentations.",
      },
    ],
  }),
  component: MeetingStudio,
});

type Perm = "prompt" | "granted" | "denied" | "unknown";
const rooms = ["Boardroom — Level 12", "Conference Room A", "Conference Room B", "Huddle Space 3"];

function MeetingStudio() {
  const navigate = useNavigate();
  const [perm, setPerm] = useState<Perm>("unknown");
  const [asking, setAsking] = useState(false);
  const [title, setTitle] = useState("Q4 Strategy Meeting");
  const [room, setRoom] = useState(rooms[0]!);
  const [people, setPeople] = useState("6");

  useEffect(() => {
    navigator.permissions
      ?.query({ name: "microphone" as PermissionName })
      .then((r) => {
        setPerm(r.state as Perm);
        r.onchange = () => setPerm(r.state as Perm);
      })
      .catch(() => setPerm("prompt"));
  }, []);

  const go = () =>
    navigate({ to: "/meetings/live", search: { title: title.trim() || "Untitled meeting", room } });
  const start = async () => {
    if (perm !== "granted") {
      setAsking(true);
      try {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        setPerm("granted");
      } catch {
        setPerm("denied");
        setAsking(false);
        return;
      }
      setAsking(false);
    }
    go();
  };

  return (
    <Page>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">Meeting Studio</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight">
            Record, understand, present.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link to="/meetings/new">
              <Plus />
              Create meeting
            </Link>
          </Button>
          <BrandPicker label="Outputs use brand" />
        </div>
      </div>
      <MeetingWorkflow current={0} className="mb-6" />

      <section className="surface relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-hero opacity-70" />
        <div className="relative grid gap-0 lg:grid-cols-[1fr_340px]">
          <div className="px-6 py-14 text-center">
            <div className="eyebrow">In-house conference recording</div>
            <h2 className="mx-auto mt-3 max-w-xl font-serif text-[46px] leading-tight">
              Your AI meeting assistant is ready.
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-[15px] text-muted-foreground">
              Place this device in the room. We’ll record the full meeting, transcribe it live, and
              extract decisions, action items and requirements.
            </p>
            <button
              onClick={start}
              disabled={asking}
              aria-label="Start recording"
              className="relative mx-auto mt-10 grid size-28 place-items-center rounded-full bg-ink text-ink-foreground shadow-lift transition-transform hover:scale-105 active:scale-95"
            >
              <span className="absolute inset-0 animate-pulse-ring rounded-full border border-ink/40" />
              <Mic className="size-9" />
            </button>
            <div className="mt-6">
              <Button size="lg" onClick={start} disabled={asking}>
                <span className="size-2 rounded-full bg-live" />
                {asking ? "Waiting for permission…" : "Start recording"}
              </Button>
            </div>
            <div className="mt-5 flex items-center justify-center gap-2 text-[12.5px]">
              {perm === "granted" && (
                <span className="flex items-center gap-1.5 text-success">
                  <ShieldCheck className="size-3.5" />
                  Microphone access granted
                </span>
              )}
              {(perm === "prompt" || perm === "unknown") && (
                <span className="text-muted-foreground">
                  Microphone permission will be requested when you start
                </span>
              )}
              {perm === "denied" && (
                <span className="flex flex-col items-center gap-2 text-destructive">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="size-3.5" />
                    Microphone blocked — enable it in your browser settings
                  </span>
                  <Button variant="outline" size="sm" onClick={go}>
                    Continue with demo audio
                  </Button>
                </span>
              )}
            </div>
          </div>
          <div className="border-t bg-card/70 p-6 backdrop-blur lg:border-l lg:border-t-0">
            <div className="eyebrow mb-4">Meeting setup</div>
            <div className="space-y-4">
              <label className="block space-y-1.5 text-[12px] text-muted-foreground">
                Meeting title
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-foreground"
                />
              </label>
              <label className="block space-y-1.5 text-[12px] text-muted-foreground">
                Room
                <Select value={room} onValueChange={setRoom}>
                  <SelectTrigger className="text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block space-y-1.5 text-[12px] text-muted-foreground">
                Expected participants
                <Input
                  type="number"
                  min={2}
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="text-foreground"
                />
              </label>
            </div>
            <div className="mt-6 space-y-2.5 border-t pt-5 text-[12.5px]">
              <div className="eyebrow mb-1">After the meeting</div>
              {[
                [FileText, "Structured notes, decisions & action items"],
                [Users, "Owners and responsibilities assigned"],
                [Presentation, "Presentation from your chosen template"],
              ].map(([Icon, t]) => {
                const I = Icon as typeof FileText;
                return (
                  <div key={t as string} className="flex items-center gap-2 text-muted-foreground">
                    <I className="size-3.5 text-foreground" />
                    {t as string}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <Link
        to="/meetings/new"
        className="surface surface-hover group mt-6 flex items-center gap-4 p-5"
      >
        <div className="grid size-10 place-items-center rounded-md bg-gradient-brand text-brand-foreground">
          <Wand2 className="size-4" />
        </div>
        <div className="flex-1">
          <div className="text-[14.5px] font-medium">
            No recording? Create a meeting from its details
          </div>
          <p className="text-[13px] text-muted-foreground">
            Enter participants, agenda, decisions and action items — AI analyzes them and generates
            a branded presentation, saved to Generated Content.
          </p>
        </div>
        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      <section className="mt-12">
        <h2 className="mb-4 text-[17px] font-semibold tracking-tight">Recent meetings</h2>
        <div className="surface divide-y overflow-hidden">
          {meetingHistory.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-4 px-5 py-3.5 text-[13px] hover:bg-muted/40"
            >
              <div className="grid size-8 place-items-center rounded-md border bg-muted/50">
                <Mic className="size-4" />
              </div>
              <div className="flex-1">
                <div className="font-medium">{m.title}</div>
                <div className="text-muted-foreground">
                  {m.date} · {m.duration} · {m.people} participants
                </div>
              </div>
              {m.outputs.map((o) => (
                <span
                  key={o}
                  className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
                >
                  {o}
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    </Page>
  );
}
