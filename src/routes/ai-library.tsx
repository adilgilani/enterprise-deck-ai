import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Brain, CheckCircle2, FileText, Loader2, Plus, RefreshCw, Search, Trash2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Chip, EmptyState, ago, bytes } from "@/components/shared";
import { api } from "@/lib/api/client";
import { useDocument, useDocuments, useInvalidate } from "@/lib/api/hooks";
import type { SearchHit } from "@/lib/api/types";

export const Route = createFileRoute("/ai-library")({
  head: () => ({ meta: [{ title: "AI Library — VYRA" }] }),
  component: AILibrary,
});

const CATS: [string, string][] = [["company", "Company"], ["product", "Product"], ["services", "Services"], ["case_study", "Case studies"], ["sales", "Sales"], ["presentation", "Presentations"], ["proposal", "Proposals"], ["messaging", "Messaging"], ["brand_guidelines", "Brand guidelines"], ["other", "Other"]];
const label = (c: string) => CATS.find(([k]) => k === c)?.[1] ?? c;

function AILibrary() {
  const [cat, setCat] = useState<string | null>(null);
  const [uploadCat, setUploadCat] = useState("auto");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [textOpen, setTextOpen] = useState(false);
  const [text, setText] = useState({ title: "", text: "", category: "messaging" });
  const input = useRef<HTMLInputElement | null>(null);
  const invalidate = useInvalidate();
  const { data: all } = useDocuments(undefined, true);
  const docs = (all ?? []).filter((d) => !cat || d.category === cat);
  const chunks = (all ?? []).reduce((a, d) => a + d.chunk_count, 0);
  const processing = (all ?? []).some((d) => d.status === "queued" || d.status === "processing");

  const upload = async (files: FileList) => {
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("category", uploadCat);
      try {
        await api("/documents", { method: "POST", form: fd });
        toast.success(`${f.name} added — processing`);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    void invalidate("documents", "brand-context");
  };
  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearching(true);
    try {
      setHits(await api<SearchHit[]>("/documents/search", { body: { query, k: 6 } }));
    } catch (err) {
      toast.error((err as Error).message);
    }
    setSearching(false);
  };

  return (
    <Page>
      <PageHeader title="AI Library" subtitle="Your Company AI Context. Documents are parsed, chunked, embedded into pgvector and retrieved automatically when generating proposals, presentations and meeting follow-ups." actions={<>
        <Select value={uploadCat} onValueChange={setUploadCat}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto-classify</SelectItem>{CATS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={() => setTextOpen(true)}><Plus />Paste text</Button>
        <input ref={input} type="file" multiple accept=".pdf,.docx,.pptx,.txt,.md,.csv" hidden onChange={(e) => e.target.files && void upload(e.target.files)} />
        <Button onClick={() => input.current?.click()}><Upload />Upload documents</Button>
      </>} />
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {[["Documents", all?.length ?? 0], ["Indexed chunks", chunks], ["Categories", new Set((all ?? []).map((d) => d.category)).size], ["Status", processing ? "Processing…" : "Up to date"]].map(([l, v]) => <div key={l as string} className="surface p-5"><div className="text-[12.5px] text-muted-foreground">{l}</div><div className="mt-2 font-mono text-[26px] font-medium">{v}</div></div>)}
      </div>
      <form onSubmit={search} className="surface mb-8 p-4">
        <div className="mb-2 flex items-center gap-2 text-[13px] font-medium"><Brain className="size-4 text-brand" />Test retrieval — what will the AI find?</div>
        <div className="flex gap-2"><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. previous banking projects and onboarding results" /><Button type="submit" disabled={searching}>{searching ? <Loader2 className="animate-spin" /> : <Search />}Search</Button></div>
        {hits && (
          <div className="mt-4 space-y-2">
            {hits.length === 0 && <div className="text-[13px] text-muted-foreground">No matching knowledge.</div>}
            {hits.map((h, i) => <div key={i} className="rounded-md border bg-muted/20 p-3 text-[13px]"><div className="flex justify-between text-[12px]"><span className="font-medium">{h.title} · <span className="text-muted-foreground">{label(h.category)}</span></span><span className="font-mono text-muted-foreground">{h.score.toFixed(3)}</span></div><p className="mt-1 line-clamp-3 text-muted-foreground">{h.content}</p></div>)}
          </div>
        )}
      </form>
      <div className="mb-4 flex flex-wrap gap-1.5"><Chip active={!cat} onClick={() => setCat(null)}>All</Chip>{CATS.map(([k, l]) => <Chip key={k} active={cat === k} onClick={() => setCat(k)}>{l}</Chip>)}</div>
      {docs.length === 0 ? <EmptyState icon={FileText} title="No documents yet" body="Upload company profiles, case studies, services and approved messaging." /> : (
        <div className="surface divide-y">
          <div className="grid grid-cols-[1fr_140px_120px_90px_110px] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><span>Document</span><span>Category</span><span>Status</span><span>Chunks</span><span>Added</span></div>
          {docs.map((d) => (
            <button key={d.id} onClick={() => setOpen(d.id)} className="grid w-full grid-cols-[1fr_140px_120px_90px_110px] items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-muted/30">
              <div className="min-w-0"><div className="truncate font-medium">{d.title}</div><div className="truncate text-[12px] text-muted-foreground">{d.summary ?? d.filename} </div></div>
              <span>{label(d.category)}</span>
              <span className="flex items-center gap-1.5">{d.status === "ready" ? <CheckCircle2 className="size-3.5 text-success" /> : d.status === "failed" ? <XCircle className="size-3.5 text-destructive" /> : <Loader2 className="size-3.5 animate-spin text-brand" />}<span className="capitalize">{d.status}</span></span>
              <span className="font-mono">{d.chunk_count}</span>
              <span className="text-muted-foreground">{ago(d.created_at)}</span>
            </button>
          ))}
        </div>
      )}
      <DocSheet id={open} onClose={() => setOpen(null)} />
      <Dialog open={textOpen} onOpenChange={setTextOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add text to the AI Library</DialogTitle></DialogHeader>
          <Input placeholder="Title" value={text.title} onChange={(e) => setText({ ...text, title: e.target.value })} />
          <Select value={text.category} onValueChange={(v) => setText({ ...text, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
          <Textarea className="min-h-[180px]" placeholder="Paste approved messaging, a case study, service description…" value={text.text} onChange={(e) => setText({ ...text, text: e.target.value })} />
          <Button onClick={async () => { try { await api("/documents/text", { body: text }); toast.success("Added — processing"); setTextOpen(false); setText({ title: "", text: "", category: "messaging" }); void invalidate("documents"); } catch (e) { toast.error((e as Error).message); } }}>Add to library</Button>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

function DocSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: d } = useDocument(id);
  const invalidate = useInvalidate();
  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-[520px] overflow-y-auto sm:max-w-[520px]">
        {d && (
          <>
            <SheetHeader><SheetTitle>{d.title}</SheetTitle></SheetHeader>
            <div className="space-y-5 px-4 pb-6 text-[13px]">
              <div className="text-muted-foreground">{d.filename} · {bytes(d.size_bytes)} · {d.chunk_count} chunks · {label(d.category)}</div>
              {d.meta.error && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-destructive">{d.meta.error}</div>}
              {d.summary && <div><div className="eyebrow mb-1">AI summary</div><p>{d.summary}</p></div>}
              {(d.meta.key_points ?? []).length > 0 && <div><div className="eyebrow mb-1">Key points</div><ul className="list-disc space-y-1 pl-4">{(d.meta.key_points ?? []).map((k) => <li key={k}>{k}</li>)}</ul></div>}
              <div><div className="eyebrow mb-1">Extracted text</div><pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-[11.5px]">{d.extracted_text}</pre></div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={async () => { await api(`/documents/${d.id}/reprocess`, { method: "POST" }); toast("Reprocessing"); void invalidate("documents", "document"); }}><RefreshCw />Reprocess</Button>
                <Button variant="destructive" size="sm" onClick={async () => { await api(`/documents/${d.id}`, { method: "DELETE" }); toast("Deleted"); onClose(); void invalidate("documents"); }}><Trash2 />Delete</Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
