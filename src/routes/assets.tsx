import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ImagePlus, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Chip } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assetCategories, assets as seed } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Assets — Enterprise AI" },
      { name: "description", content: "Enterprise asset library." },
    ],
  }),
  component: Assets,
});

function Assets() {
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [items, setItems] = useState(seed);
  const [drag, setDrag] = useState(false);
  const [uploading, setUploading] = useState(0);
  const list = useMemo(
    () =>
      items.filter(
        (a) =>
          (cat === "All" || a.category === cat) && a.name.toLowerCase().includes(q.toLowerCase()),
      ),
    [items, cat, q],
  );

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const n = files.length;
    setUploading(n);
    setTimeout(() => {
      setItems((cur) => [
        ...Array.from(files).map((f, i) => ({
          id: `u${Date.now()}${i}`,
          name: f.name.replace(/\.[^.]+$/, ""),
          category: cat === "All" ? "Images" : cat,
          size: `${(f.size / 1e6).toFixed(1)} MB`,
          hue: (i * 83) % 360,
        })),
        ...cur,
      ]);
      setUploading(0);
      toast.success(`${n} asset${n > 1 ? "s" : ""} uploaded`);
    }, 1000);
  };

  return (
    <Page>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFiles(e.dataTransfer.files);
        }}
        className="relative"
      >
        <PageHeader
          title="Assets"
          subtitle="Approved images, logos, charts and documents — one source of truth."
          actions={
            <label>
              <input type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
              <Button asChild>
                <span>
                  <UploadCloud />
                  Upload
                </span>
              </Button>
            </label>
          }
        />
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search assets"
              className="h-8 pl-8"
            />
          </div>
          {assetCategories.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
              {c}
            </Chip>
          ))}
        </div>
        {drag && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center rounded-xl border-2 border-dashed border-brand bg-brand-soft/80">
            <div className="flex items-center gap-2 text-brand">
              <ImagePlus />
              Drop to upload
            </div>
          </div>
        )}
        {list.length === 0 && !uploading ? (
          <div className="surface grid place-items-center py-20 text-center">
            <UploadCloud className="size-6 text-muted-foreground" />
            <div className="mt-3 font-medium">No assets found</div>
            <p className="text-[13px] text-muted-foreground">
              Drag files here or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: uploading }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
            {list.map((a) => (
              <button
                key={a.id}
                onClick={() => toast(a.name, { description: `${a.category} · ${a.size}` })}
                className="group text-left"
              >
                <div
                  className={cn(
                    "relative aspect-square overflow-hidden rounded-lg border shadow-card transition-all group-hover:-translate-y-0.5 group-hover:shadow-lift",
                  )}
                  style={{
                    background: `linear-gradient(135deg, oklch(0.93 0.04 ${a.hue}), oklch(0.8 0.08 ${a.hue + 40}))`,
                  }}
                >
                  <div className="absolute bottom-3 left-3 size-8 rounded-full bg-white/40" />
                  <div className="absolute right-3 top-3 h-px w-10 bg-white/60" />
                </div>
                <div className="mt-2 truncate text-[13px] font-medium">{a.name}</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {a.category} · {a.size}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
