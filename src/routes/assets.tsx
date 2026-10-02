import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText, Film, Image as ImageIcon, Loader2, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Chip, EmptyState, ago, bytes } from "@/components/shared";
import { api, blobUrl, downloadFile } from "@/lib/api/client";
import { useAssets, useFolders, useInvalidate } from "@/lib/api/hooks";
import type { Asset } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assets")({
  head: () => ({ meta: [{ title: "Assets — Enterprise AI" }] }),
  component: AssetsPage,
});

const TYPES = [["", "All"], ["logo", "Logos"], ["image", "Images"], ["icon", "Icons"], ["video", "Videos"], ["document", "Documents"], ["chart", "Charts"], ["template", "Templates"]] as const;

function Thumb({ a, className }: { a: Asset; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (a.mime_type.startsWith("image/")) blobUrl(`/assets/${a.id}/file`).then(setSrc).catch(() => setSrc(null));
  }, [a.id, a.mime_type]);
  if (src) return <img src={src} alt={a.name} className={cn("size-full object-contain p-4", className)} />;
  const Icon = a.mime_type.startsWith("video/") ? Film : a.mime_type.startsWith("image/") ? ImageIcon : FileText;
  return <div className="grid size-full place-items-center"><Icon className="size-8 text-muted-foreground" /></div>;
}

function AssetsPage() {
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const [sel, setSel] = useState<Asset | null>(null);
  const [uploading, setUploading] = useState(false);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement | null>(null);
  const invalidate = useInvalidate();
  const { data: folders } = useFolders("assets");
  const { data, isLoading } = useAssets({ ...(type ? { type } : {}), ...(q ? { q } : {}), ...(folder ? { folder_id: folder } : {}) });

  const upload = async (files: FileList | File[]) => {
    setUploading(true);
    for (const f of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", f);
      if (type) fd.append("type", type);
      if (folder) fd.append("folder_id", folder);
      try {
        await api("/assets", { method: "POST", form: fd });
        toast.success(`Uploaded ${f.name}`);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setUploading(false);
    void invalidate("assets");
  };

  return (
    <Page>
      <PageHeader title="Assets" subtitle="Approved logos, imagery, icons, video and documents — stored in self-hosted object storage." actions={<><input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && void upload(e.target.files)} /><Button onClick={() => input.current?.click()} disabled={uploading}>{uploading ? <Loader2 className="animate-spin" /> : <Upload />}Upload</Button></>} />
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <div className="relative mr-2 w-56"><Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input className="h-8 pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets" /></div>
        {TYPES.map(([k, l]) => <Chip key={k} active={type === k} onClick={() => setType(k)}>{l}</Chip>)}
      </div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Chip active={!folder} onClick={() => setFolder(null)}>All folders</Chip>
        {folders?.map((f) => <Chip key={f.id} active={folder === f.id} onClick={() => setFolder(f.id)}>{f.name}</Chip>)}
      </div>
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); void upload(e.dataTransfer.files); }} className={cn("mb-6 rounded-lg border border-dashed px-6 py-6 text-center text-[13px] text-muted-foreground transition-colors", drag && "border-brand bg-brand-soft")}>
        Drag & drop files here · PNG, JPG, SVG, WebP, MP4, PDF, DOCX, PPTX · max 50 MB · content-type verified
      </div>
      {!isLoading && !data?.length && <EmptyState icon={ImageIcon} title="No assets" body="Upload logos, images and documents to reuse across every deck." />}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {data?.map((a) => (
          <button key={a.id} onClick={() => setSel(a)} className="surface surface-hover overflow-hidden text-left">
            <div className="aspect-[4/3] bg-muted/40"><Thumb a={a} /></div>
            <div className="border-t p-3"><div className="truncate text-[13px] font-medium">{a.name}</div><div className="text-[11.5px] capitalize text-muted-foreground">{a.type} · {bytes(a.size_bytes)}</div></div>
          </button>
        ))}
      </div>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-[420px] sm:max-w-[420px]">
          {sel && (
            <>
              <SheetHeader><SheetTitle>{sel.name}</SheetTitle></SheetHeader>
              <div className="mx-4 aspect-[4/3] rounded-lg border bg-muted/40"><Thumb a={sel} /></div>
              <dl className="mx-4 mt-4 grid grid-cols-[110px_1fr] gap-y-2 text-[13px]">
                {[["File", sel.filename], ["Type", sel.type], ["MIME", sel.mime_type], ["Size", bytes(sel.size_bytes)], ["Dimensions", sel.meta.width ? `${sel.meta.width} × ${sel.meta.height}` : "—"], ["Tags", (sel.meta.tags ?? []).join(", ") || "—"], ["Uploaded by", sel.uploaded_by?.name ?? "—"], ["Uploaded", ago(sel.created_at)]].map(([k, v]) => <><dt key={`k${k}`} className="text-muted-foreground">{k}</dt><dd key={`v${k}`} className="truncate">{v}</dd></>)}
              </dl>
              <div className="mx-4 mt-6 flex gap-2">
                <Button variant="outline" onClick={() => void downloadFile(`/assets/${sel.id}/file`, sel.filename, { query: { download: true } })}><Download />Download</Button>
                <Button variant="destructive" onClick={async () => { await api(`/assets/${sel.id}`, { method: "DELETE" }); toast("Asset deleted"); setSel(null); void invalidate("assets"); }}><Trash2 />Delete</Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </Page>
  );
}
