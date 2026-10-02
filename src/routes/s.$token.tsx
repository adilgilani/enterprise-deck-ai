import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Lock, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlideRenderer } from "@/components/slide";
import { Presenter } from "@/components/presenter";
import { Logo } from "@/components/app-shell";
import { api, ApiError, downloadFile } from "@/lib/api/client";
import { normalizeTheme, type Deck } from "@/lib/deck/schema";
import type { MeetingIntelligence } from "@/lib/api/types";

export const Route = createFileRoute("/s/$token")({
  head: () => ({ meta: [{ title: "Shared — VYRA" }] }),
  component: SharedView,
});

interface Shared {
  resource_type: "presentation" | "meeting" | "proposal";
  allow_download: boolean;
  organization: string;
  title: string;
  deck?: Deck;
  intelligence?: Partial<MeetingIntelligence>;
  action_items?: { title: string; owner: string | null; deadline: string | null }[];
  participants?: string[];
  client?: string;
  schema?: { sections?: { title: string; blocks: { type: string; text?: string; items?: string[] }[] }[] };
}

function SharedView() {
  const { token } = Route.useParams();
  const [data, setData] = useState<Shared | null>(null);
  const [needPw, setNeedPw] = useState(false);
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [present, setPresent] = useState(false);

  const load = async (password?: string) => {
    setError(null);
    try {
      setData(await api<Shared>(`/public/shares/${token}`, { auth: !!localStorage.getItem("eai.token"), headers: password ? { "X-Share-Password": password } : {} }));
      setNeedPw(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401 && (e.message === "password_required" || e.message === "Incorrect password")) {
        setNeedPw(true);
        if (password) setError("Incorrect password");
      } else setError((e as Error).message);
    }
  };
  useEffect(() => { void load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (needPw) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <form onSubmit={(e) => { e.preventDefault(); void load(pw); }} className="surface w-full max-w-sm p-6 text-center">
          <Lock className="mx-auto size-5" /><h1 className="mt-3 text-[18px] font-semibold">Password protected</h1>
          <Input type="password" className="mt-4" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus placeholder="Enter password" />
          {error && <div className="mt-2 text-[13px] text-destructive">{error}</div>}
          <Button className="mt-4 w-full" type="submit">View</Button>
        </form>
      </div>
    );
  }
  if (error) return <div className="grid min-h-screen place-items-center px-6 text-center"><div><Logo /><p className="mt-6 text-[15px]">{error}</p></div></div>;
  if (!data) return <div className="grid min-h-screen place-items-center"><Loader2 className="animate-spin" /></div>;
  const headers = pw ? { "X-Share-Password": pw } : {};
  const dl = (fmt: string) => void downloadFile(`/public/shares/${token}/download`, `${data.title}.${fmt}`, { query: { format: fmt }, headers, auth: !!localStorage.getItem("eai.token") });

  if (data.deck && present) return <Presenter deck={{ ...data.deck, theme: normalizeTheme(data.deck.theme) }} onExit={() => setPresent(false)} />;

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex h-14 items-center gap-3 border-b bg-background px-6">
        <Logo compact /><span className="text-[14px] font-medium">{data.title}</span><span className="text-[12px] text-muted-foreground">Shared by {data.organization} · view only</span>
        <div className="ml-auto flex gap-2">
          {data.deck && <Button size="sm" onClick={() => setPresent(true)}><Play />Present</Button>}
          {data.allow_download && (data.resource_type === "presentation" ? <><Button size="sm" variant="outline" onClick={() => dl("pptx")}><Download />PPTX</Button><Button size="sm" variant="outline" onClick={() => dl("pdf")}><Download />PDF</Button></> : <Button size="sm" variant="outline" onClick={() => dl("pdf")}><Download />PDF</Button>)}
        </div>
      </header>
      <main className="mx-auto max-w-4xl space-y-6 px-6 py-10">
        {data.deck?.slides.map((s, i) => <div key={i} className="overflow-hidden rounded-lg shadow-slide"><SlideRenderer slide={s} theme={data.deck?.theme} index={i} total={data.deck?.slides.length ?? 1} /></div>)}
        {data.resource_type === "meeting" && (
          <article className="surface space-y-6 p-10">
            <h1 className="font-serif text-[40px]">{data.title}</h1>
            <p className="font-serif text-[20px] leading-snug">{data.intelligence?.summary}</p>
            <div><div className="eyebrow mb-2">Decisions</div><ul className="list-disc space-y-1 pl-5 text-[14px]">{data.intelligence?.decisions?.map((d, i) => <li key={i}>{d.text}</li>)}</ul></div>
            <div><div className="eyebrow mb-2">Action items</div><ul className="space-y-1 text-[14px]">{data.action_items?.map((a, i) => <li key={i}>☐ {a.title} — <span className="text-muted-foreground">{a.owner ?? "Unassigned"}{a.deadline ? ` · ${a.deadline}` : ""}</span></li>)}</ul></div>
            <div><div className="eyebrow mb-2">Next steps</div><ul className="list-disc space-y-1 pl-5 text-[14px]">{data.intelligence?.next_steps?.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
          </article>
        )}
        {data.resource_type === "proposal" && (
          <article className="surface space-y-8 p-10">
            <div><div className="eyebrow">Proposal for {data.client}</div><h1 className="mt-2 font-serif text-[40px]">{data.title}</h1></div>
            {data.schema?.sections?.map((s, i) => <section key={i}><h2 className="font-serif text-[26px]">{s.title}</h2>{s.blocks.map((b, j) => b.type === "paragraph" ? <p key={j} className="mt-2 text-[14.5px]">{b.text}</p> : b.type === "bullets" ? <ul key={j} className="mt-2 list-disc pl-5 text-[14px]">{b.items?.map((x) => <li key={x}>{x}</li>)}</ul> : null)}</section>)}
          </article>
        )}
      </main>
    </div>
  );
}
