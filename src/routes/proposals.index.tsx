import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { FileSignature, Plus, UploadCloud } from "lucide-react";
import { Page, PageHeader } from "@/components/app-shell";
import { Chip, StatusPill } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { TemplateCard, UploadTemplateDialog } from "@/components/templates";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { templateTypes, type TemplateType } from "@/lib/brand-data";
import { initials, proposals, type ProposalStatus } from "@/lib/mock-data";
import { actions, useBrands, useDocTemplates } from "@/lib/store";

type Tab = "proposals" | "templates";

export const Route = createFileRoute("/proposals/")({
  validateSearch: (s: Record<string, unknown>): { tab?: Tab } =>
    s["tab"] === "templates" || s["tab"] === "proposals" ? { tab: s["tab"] } : {},
  head: () => ({
    meta: [
      { title: "Proposals — Enterprise AI" },
      {
        name: "description",
        content: "Create professional proposals using your company's complete brand system.",
      },
    ],
  }),
  component: ProposalsPage,
});

const statuses: ("All" | ProposalStatus)[] = [
  "All",
  "Draft",
  "Internal Review",
  "Ready",
  "Sent",
  "Won",
  "Lost",
];

function ProposalsPage() {
  const { tab = "proposals" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [upload, setUpload] = useState(false);
  return (
    <Page>
      <PageHeader
        title="Proposals"
        subtitle="Create professional proposals using your company's complete brand system — or start from your own templates."
        actions={
          <>
            <Button variant="outline" onClick={() => setUpload(true)}>
              <UploadCloud />
              Upload template
            </Button>
            <Button asChild>
              <Link to="/proposals/new">
                <Plus />
                Create proposal
              </Link>
            </Button>
          </>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ search: { tab: v as Tab }, replace: true })}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="proposals">
          <ProposalList />
        </TabsContent>
        <TabsContent value="templates">
          <TemplateLibrary onUpload={() => setUpload(true)} />
        </TabsContent>
      </Tabs>
      <UploadTemplateDialog
        open={upload}
        onOpenChange={setUpload}
        onCreated={() => navigate({ search: { tab: "templates" }, replace: true })}
      />
    </Page>
  );
}

function ProposalList() {
  const [f, setF] = useState<"All" | ProposalStatus>("All");
  const list = proposals.filter((p) => f === "All" || p.status === f);
  const pipeline = proposals
    .filter((p) => !["Lost", "Won"].includes(p.status))
    .reduce(
      (a, p) => a + parseFloat(p.value.replace(/[$MK]/g, "")) / (p.value.endsWith("K") ? 1000 : 1),
      0,
    );
  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Open pipeline", `$${pipeline.toFixed(1)}M`],
          ["Win rate (90d)", "43%"],
          ["Avg. time to draft", "6 min"],
        ].map(([k, v]) => (
          <div key={k} className="surface p-4">
            <div className="eyebrow">{k}</div>
            <div className="mt-2 font-mono text-[26px] tracking-tight">{v}</div>
          </div>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-2">
        {statuses.map((s) => (
          <Chip key={s} active={f === s} onClick={() => setF(s)}>
            {s}
          </Chip>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="surface grid place-items-center py-20 text-center">
          <FileSignature className="size-6 text-muted-foreground" />
          <div className="mt-3 font-medium">No {f.toLowerCase()} proposals</div>
          <Button variant="outline" className="mt-4" onClick={() => setF("All")}>
            Show all
          </Button>
        </div>
      ) : (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => (
            <Link
              key={p.id}
              to="/proposals/new"
              search={{ client: p.client }}
              className="group block"
            >
              <div className="overflow-hidden rounded-lg border shadow-card transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <SlideView
                  kind="title"
                  theme={p.theme}
                  slide={{
                    id: p.id,
                    kind: "title",
                    title: p.title,
                    subtitle: `Prepared for ${p.client}`,
                  }}
                />
              </div>
              <div className="mt-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium">{p.title}</div>
                  <div className="text-[12.5px] text-muted-foreground">{p.client}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[14px]">{p.value}</div>
                  <StatusPill status={p.status} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
                <span className="grid size-4 place-items-center rounded-full bg-muted text-[8px] font-semibold text-foreground">
                  {initials(p.by)}
                </span>
                {p.by} · {p.edited}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function TemplateLibrary({ onUpload }: { onUpload: () => void }) {
  const templates = useDocTemplates();
  const brands = useBrands();
  const [type, setType] = useState<"All" | TemplateType>("All");
  const [brandId, setBrandId] = useState("all");
  const list = templates.filter(
    (t) => (type === "All" || t.type === type) && (brandId === "all" || t.brandId === brandId),
  );
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["All", ...templateTypes] as const).map((t) => (
          <Chip key={t} active={type === t} onClick={() => setType(t)}>
            {t}
            {t !== "All" && (
              <span className="ml-1.5 font-mono text-[11px] opacity-60">
                {templates.filter((x) => x.type === t).length}
              </span>
            )}
          </Chip>
        ))}
      </div>
      <div className="mb-8 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
        Brand:
        <Chip active={brandId === "all"} onClick={() => setBrandId("all")}>
          All brands
        </Chip>
        {brands.map((b) => (
          <Chip key={b.id} active={brandId === b.id} onClick={() => setBrandId(b.id)}>
            <span
              className="mr-1.5 inline-block size-2 rounded-full"
              style={{ background: b.slide.b }}
            />
            {b.name}
          </Chip>
        ))}
      </div>
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        <button
          onClick={onUpload}
          className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed text-[13px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <span className="flex flex-col items-center gap-2">
            <UploadCloud className="size-5" />
            Upload a template<span className="font-mono text-[11px]">PPTX · KEY · PDF · DOCX</span>
          </span>
        </button>
        {list.map((t) => (
          <TemplateCard
            key={t.id}
            template={t}
            action={
              <Button asChild size="sm" variant="outline">
                <Link
                  to="/proposals/new"
                  search={{ template: t.id }}
                  onClick={() => actions.setActiveBrand(t.brandId)}
                >
                  Use template
                </Link>
              </Button>
            }
          />
        ))}
      </div>
    </>
  );
}
