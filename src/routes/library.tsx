import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen,
  FileText,
  Loader2,
  Palette,
  Package,
  MessageSquareQuote,
  Briefcase,
  LayoutTemplate,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Chip } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { libraryDocs } from "@/lib/mock-data";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "AI Library — Enterprise AI" },
      { name: "description", content: "Company AI context used in every generation." },
    ],
  }),
  component: Library,
});

const ctx = [
  ["Documents", 148, FileText],
  ["Brand", 12, Palette],
  ["Products", 9, Package],
  ["Messaging", 24, MessageSquareQuote],
  ["Case Studies", 31, Briefcase],
  ["Templates", 18, LayoutTemplate],
] as const;
const kinds = [
  "All",
  "Company information",
  "Product information",
  "Case studies",
  "Sales materials",
  "Approved messaging",
  "Proposal examples",
  "Brand guidelines",
];

function Library() {
  const [k, setK] = useState("All");
  const [docs, setDocs] = useState(libraryDocs.map((d) => ({ ...d, on: true })));
  const [drop, setDrop] = useState(false);
  const list = docs.filter((d) => k === "All" || d.type === k);
  const add = (files: FileList | null) => {
    if (!files?.length) return;
    setDocs((c) => [
      ...Array.from(files).map((f) => ({
        name: f.name,
        type: "Company information",
        size: `${(f.size / 1e6).toFixed(1)} MB`,
        updated: "Just now",
        status: "Processing",
        on: true,
      })),
      ...c,
    ]);
    toast.success("Uploaded", { description: "Indexing for AI context…" });
  };
  return (
    <Page>
      <PageHeader
        title="AI Library"
        subtitle="Company AI Context — approved knowledge the AI draws on for every presentation and proposal."
        actions={
          <label>
            <input type="file" multiple hidden onChange={(e) => add(e.target.files)} />
            <Button asChild>
              <span>
                <UploadCloud />
                Upload knowledge
              </span>
            </Button>
          </label>
        }
      />
      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-6">
        {ctx.map(([l, n, Icon]) => (
          <div key={l} className="surface p-4">
            <Icon className="size-4 text-muted-foreground" />
            <div className="mt-4 font-mono text-[24px]">{n}</div>
            <div className="text-[12px] text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrop(true);
        }}
        onDragLeave={() => setDrop(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrop(false);
          add(e.dataTransfer.files);
        }}
        className={`mb-6 flex items-center gap-3 rounded-xl border border-dashed px-5 py-4 text-[13px] text-muted-foreground transition-colors ${drop ? "border-brand bg-brand-soft text-brand" : ""}`}
      >
        <BookOpen className="size-4" />
        Drop company information, product sheets, case studies, sales materials, approved messaging,
        previous decks, proposals or guidelines.
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {kinds.map((x) => (
          <Chip key={x} active={k === x} onClick={() => setK(x)}>
            {x}
          </Chip>
        ))}
      </div>
      <div className="surface divide-y overflow-hidden">
        {list.length === 0 && (
          <div className="px-6 py-14 text-center text-[13px] text-muted-foreground">
            No documents in this category yet.
          </div>
        )}
        {list.map((d) => (
          <div key={d.name} className="flex items-center gap-4 px-5 py-3.5 text-[13px]">
            <FileText className="size-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{d.name}</div>
              <div className="text-muted-foreground">
                {d.type} · {d.size} · {d.updated}
              </div>
            </div>
            <span
              className={`flex items-center gap-1.5 text-[12px] ${d.status === "Indexed" ? "text-success" : "text-warning"}`}
            >
              {d.status === "Processing" && <Loader2 className="size-3 animate-spin" />}
              {d.status}
            </span>
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              Use in AI
              <Switch
                checked={d.on}
                onCheckedChange={(v) =>
                  setDocs((c) => c.map((x) => (x.name === d.name ? { ...x, on: v } : x)))
                }
              />
            </label>
          </div>
        ))}
      </div>
    </Page>
  );
}
