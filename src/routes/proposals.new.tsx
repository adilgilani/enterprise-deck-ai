import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { JobProgress, UsingBrandPanel } from "@/components/shared";
import { BrandChooser } from "@/components/brand-chooser";
import { api } from "@/lib/api/client";
import { useJob } from "@/lib/api/hooks";
import type { GenerateOut } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/proposals/new")({
  head: () => ({ meta: [{ title: "New proposal — VYRA" }] }),
  component: ProposalBuilder,
});

const SECTIONS: [string, string][] = [
  ["cover", "Cover"], ["executive_summary", "Executive Summary"], ["about_us", "About Us"], ["client_understanding", "Client Understanding"],
  ["challenges", "Challenges"], ["solution", "Proposed Solution"], ["architecture", "Architecture"], ["scope", "Scope"],
  ["implementation", "Implementation"], ["timeline", "Timeline"], ["team", "Team"], ["case_studies", "Case Studies"],
  ["commercial", "Commercial Proposal"], ["outcomes", "Expected Outcomes"], ["next_steps", "Next Steps"],
];

function ProposalBuilder() {
  const navigate = useNavigate();
  const [f, setF] = useState({ client: "", industry: "", contact_name: "", contact_email: "", opportunity: "", title: "", description: "", value: "", deadline: "" });
  const [prompt, setPrompt] = useState("");
  const [sections, setSections] = useState<string[]>(SECTIONS.map(([k]) => k));
  const [creative, setCreative] = useState(false);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [gen, setGen] = useState<GenerateOut | null>(null);
  const { job } = useJob(gen?.job.id);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (job?.status === "completed" && gen?.proposal_id) void navigate({ to: "/proposals/$id", params: { id: gen.proposal_id } });
  }, [job, gen, navigate]);

  const submit = async () => {
    if (!f.client.trim()) return void toast.error("Client is required");
    setBusy(true);
    try {
      setGen(
        await api<GenerateOut>("/proposals/generate", {
          body: {
            client: f.client, industry: f.industry || null, contact_name: f.contact_name || null, contact_email: f.contact_email || null,
            opportunity: f.opportunity || null, title: f.title || "Untitled proposal", description: f.description,
            value: f.value ? Number(f.value.replace(/[^\d.]/g, "")) : null, deadline: f.deadline || null,
            prompt: prompt || `Create a proposal for ${f.client}${f.opportunity ? ` for ${f.opportunity}` : ""}.`, sections, creative_mode: creative, brand_system_id: brandId,
          },
        }),
      );
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  };

  if (gen) {
    return (
      <div className="grid min-h-[calc(100vh-56px)] place-items-center px-8">
        <JobProgress title={`Writing the ${f.client} proposal`} job={job} eyebrow="Brand system & company knowledge applied" steps={["Loading brand system & company profile", "Retrieving case studies & services", `Writing proposal for ${f.client}`, "Applying brand & compliance checks"]} />
      </div>
    );
  }

  return (
    <Page className="max-w-[1180px]">
      <div className="grid gap-10 lg:grid-cols-[1fr_330px]">
        <div>
          <div className="eyebrow">Proposal builder</div>
          <h1 className="mt-2 font-serif text-[44px] leading-tight">Who is this proposal for?</h1>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <F label="Client *"><Input value={f.client} onChange={set("client")} placeholder="ABC Bank" /></F>
            <F label="Industry"><Input value={f.industry} onChange={set("industry")} placeholder="Banking" /></F>
            <F label="Contact"><Input value={f.contact_name} onChange={set("contact_name")} placeholder="Faisal Khan" /></F>
            <F label="Contact email"><Input type="email" value={f.contact_email} onChange={set("contact_email")} placeholder="faisal@abcbank.com" /></F>
            <F label="Opportunity"><Input value={f.opportunity} onChange={set("opportunity")} placeholder="Digital transformation program" /></F>
            <F label="Proposal title"><Input value={f.title} onChange={set("title")} placeholder="Digital Transformation Program" /></F>
            <F label="Estimated value (USD)"><Input value={f.value} onChange={set("value")} placeholder="2,400,000" inputMode="numeric" /></F>
            <F label="Deadline"><Input type="date" value={f.deadline} onChange={set("deadline")} /></F>
            <div className="sm:col-span-2"><F label="Description"><Textarea value={f.description} onChange={set("description")} placeholder="Context about the client and opportunity" className="min-h-[70px]" /></F></div>
          </div>
          <div className="mt-8"><BrandChooser value={brandId} onChange={setBrandId} title="Brand guidelines for this proposal" /></div>
          <div className="surface mt-6 p-1">
            <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Create a proposal for ABC Bank for a three-year digital transformation program using our previous banking projects." className="min-h-[120px] resize-none border-0 text-[15px] shadow-none focus-visible:ring-0" />
          </div>
          <div className="mt-6">
            <div className="mb-2 text-[12.5px] font-medium text-muted-foreground">Sections ({sections.length})</div>
            <div className="flex flex-wrap gap-1.5">
              {SECTIONS.map(([k, l]) => {
                const on = sections.includes(k);
                return <button key={k} onClick={() => setSections(on ? sections.filter((s) => s !== k) : SECTIONS.map(([x]) => x).filter((x) => x === k || sections.includes(x)))} className={cn("flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px]", on ? "border-foreground bg-foreground text-background" : "bg-card text-muted-foreground")}>{on && <Check className="size-3" />}{l}</button>;
              })}
            </div>
          </div>
          <Button size="lg" className="mt-8" onClick={() => void submit()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Wand2 />}Generate proposal</Button>
        </div>
        <aside className="space-y-4 lg:pt-16">
          <UsingBrandPanel brandId={brandId} />
          <div className="surface divide-y text-[13px]">
            <label className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium">Brand Lock: {creative ? "OFF" : "ON"}</div><div className="text-[12px] text-muted-foreground">Approved logo, colors, fonts, templates & style</div></div><Switch checked={!creative} onCheckedChange={(v) => setCreative(!v)} /></label>
            <label className="flex items-center justify-between gap-3 p-4"><div><div className="font-medium">Creative Mode</div><div className="text-[12px] text-muted-foreground">More design freedom within the brand system</div></div><Switch checked={creative} onCheckedChange={setCreative} /></label>
          </div>
        </aside>
      </div>
    </Page>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-[12.5px] text-muted-foreground">{label}</Label>{children}</div>;
}
