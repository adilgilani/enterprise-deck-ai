import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, Eye, Loader2, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SlideRenderer } from "@/components/slide";
import { Chip } from "@/components/shared";
import { api } from "@/lib/api/client";
import { useInvalidate, useTemplate, useTemplates } from "@/lib/api/hooks";
import type { PresentationFull, Template } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/templates")({
  head: () => ({ meta: [{ title: "Templates — Enterprise AI" }] }),
  component: TemplatesPage,
});

const CATS = ["investor", "board", "sales", "consulting", "finance", "marketing", "product", "strategy", "hr", "government", "proposal", "meeting"];

function TemplatesPage() {
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [favs, setFavs] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data } = useTemplates({ ...(cat ? { category: cat } : {}), ...(favs ? { favorites: true } : {}) });
  const items = (data ?? []).filter((t) => !q || t.name.toLowerCase().includes(q.toLowerCase()));

  const use = async (t: Template) => {
    setBusy(t.id);
    try {
      const p = await api<PresentationFull>("/presentations", { body: { title: t.name, template_id: t.id } });
      void navigate({ to: "/editor/$id", params: { id: p.id } });
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };
  const upload = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("name", f.name.replace(/\.[^.]+$/, ""));
    fd.append("category", cat ?? "strategy");
    try {
      await api("/templates/upload", { method: "POST", form: fd });
      toast.success("Template uploaded");
      void invalidate("templates");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Page>
      <PageHeader title="Templates" subtitle="Approved, on-brand starting points for every kind of presentation." actions={<><input ref={file} type="file" accept=".pptx,.json" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} /><Button variant="outline" onClick={() => file.current?.click()}><Upload />Upload template</Button></>} />
      <div className="mb-6 flex flex-wrap items-center gap-1.5">
        <Input className="mr-2 h-8 w-56" placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
        <Chip active={!cat} onClick={() => setCat(null)}>All</Chip>
        {CATS.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}><span className="capitalize">{c === "hr" ? "HR" : c}</span></Chip>)}
        <Chip active={favs} onClick={() => setFavs(!favs)}><Star className="mr-1 inline size-3" />Favorites</Chip>
      </div>
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div key={t.id} className="group">
            <div className="relative overflow-hidden rounded-lg border shadow-card">
              <SlideRenderer slide={t.cover} theme={t.theme} total={t.slide_count} />
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
                <Button size="sm" variant="secondary" onClick={() => setPreview(t.id)}><Eye />Preview</Button>
                <Button size="sm" onClick={() => void use(t)} disabled={busy === t.id}>{busy === t.id ? <Loader2 className="animate-spin" /> : null}Use template</Button>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2">
              <div className="min-w-0 flex-1"><div className="truncate text-[14px] font-medium">{t.name}</div><div className="text-[12px] capitalize text-muted-foreground">{t.category} · {t.slide_count} slides · used {t.usage_count}×</div></div>
              <button aria-label="Duplicate" className="rounded p-1 hover:bg-accent" onClick={async () => { await api(`/templates/${t.id}/duplicate`, { method: "POST" }); toast.success("Duplicated"); void invalidate("templates"); }}><Copy className="size-3.5 text-muted-foreground" /></button>
              <button aria-label="Favorite" className="rounded p-1 hover:bg-accent" onClick={async () => { await api(`/templates/${t.id}/favorite`, { method: "PUT", query: { on: !t.is_favorite } }); void invalidate("templates"); }}><Star className={cn("size-3.5", t.is_favorite ? "fill-warning text-warning" : "text-muted-foreground")} /></button>
            </div>
            <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">{t.description}</p>
          </div>
        ))}
      </div>
      <PreviewDialog id={preview} onClose={() => setPreview(null)} onUse={(t) => void use(t)} />
    </Page>
  );
}

function PreviewDialog({ id, onClose, onUse }: { id: string | null; onClose: () => void; onUse: (t: Template) => void }) {
  const { data } = useTemplate(id);
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>{data?.name ?? "Template"}</DialogTitle></DialogHeader>
        {!data ? <Loader2 className="animate-spin" /> : (
          <>
            <div className="grid max-h-[65vh] grid-cols-3 gap-3 overflow-y-auto pr-1">
              {data.schema.slides.map((s, i) => <div key={i} className="overflow-hidden rounded border"><SlideRenderer slide={s} theme={data.schema.theme} index={i} total={data.schema.slides.length} /></div>)}
            </div>
            <Button onClick={() => onUse(data)}>Use this template</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
