import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Page } from "@/components/app-shell";
import { BrandBadge, Chip, GenerationSteps } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { audiences, lengths, presentationTypes, tones, visualStyles } from "@/lib/mock-data";
import { BrandMark } from "@/components/brand-scope";
import { BrandPicker } from "@/components/templates";
import { cn } from "@/lib/utils";
import { newGeneratedId } from "@/lib/generated-data";
import { deckSlides } from "@/lib/mock-data";
import { actions, useActiveBrand } from "@/lib/store";

export const Route = createFileRoute("/presentations/new")({
  head: () => ({ meta: [{ title: "Create presentation — Enterprise AI" }] }),
  component: NewPresentation,
});

const steps = [
  "Understanding your brief",
  "Creating story structure",
  "Applying brand identity",
  "Designing layouts",
  "Generating visuals",
  "Creating charts",
  "Applying motion",
  "Final quality check",
];
const placeholder =
  "Create a 12-slide investor presentation for our fintech company explaining our market opportunity, product, traction, business model, competitive advantage and fundraising plans.";
const brandAssets = [
  "Logo",
  "Brand colors",
  "Typography",
  "Brand guidelines",
  "Approved templates",
  "Visual style",
];

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[13px] font-medium">{label}</div>
      {children}
    </div>
  );
}

function NewPresentation() {
  const navigate = useNavigate();
  const brand = useActiveBrand();
  const activeBrand = brand;
  const [phase, setPhase] = useState<"brief" | "building" | "style">("brief");
  const [prompt, setPrompt] = useState("");
  const [type, setType] = useState("Investor Deck");
  const [len, setLen] = useState("12 slides");
  const [aud, setAud] = useState("Investors");
  const [tone, setTone] = useState("Premium");
  const [useDefault, setUseDefault] = useState(true);
  const [picked, setPicked] = useState("executive");

  if (phase === "building") {
    return (
      <Page className="grid min-h-[70vh] place-items-center">
        <GenerationSteps
          title="Building your presentation"
          steps={steps}
          onDone={() => setPhase("style")}
        />
      </Page>
    );
  }

  if (phase === "style") {
    return (
      <Page>
        <div className="eyebrow">Step 2 of 2</div>
        <h1 className="mt-2 font-serif text-[40px]">Choose your visual direction</h1>
        <p className="mt-1 text-[14px] text-muted-foreground">
          Same story, four design languages — all inside the {brand.name} brand system.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {visualStyles.map((s) => (
            <div
              key={s.id}
              onClick={() => setPicked(s.id)}
              className={cn(
                "surface cursor-pointer p-4 transition-all",
                picked === s.id ? "ring-2 ring-brand" : "surface-hover",
              )}
            >
              <div className="grid grid-cols-[1.6fr_1fr] gap-2">
                <div className="row-span-2 overflow-hidden rounded-md border">
                  <SlideView kind={s.kinds[0]} theme={s.themes[0]} title={type} />
                </div>
                <div className="overflow-hidden rounded-md border">
                  <SlideView kind={s.kinds[1]} theme={s.themes[1]} title="Market opportunity" />
                </div>
                <div className="overflow-hidden rounded-md border">
                  <SlideView kind={s.kinds[2]} theme={s.themes[2]} title="Traction" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-medium">{s.name}</div>
                  <div className="text-[12.5px] text-muted-foreground">{s.blurb}</div>
                </div>
                {picked === s.id && <Check className="size-4 text-brand" />}
              </div>
              <div className="mt-4 flex gap-2">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    const id = newGeneratedId();
                    const name = `${type} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                    actions.addGenerated({
                      id,
                      name,
                      kind: "Presentation",
                      fileType: "PPTX",
                      brandId: activeBrand.id,
                      templateName: `${s.name} style`,
                      createdAt: new Date().toISOString(),
                      status: "Ready",
                      theme: s.themes[0]!,
                      slides: deckSlides.map((sl, i) =>
                        i === 0
                          ? {
                              ...sl,
                              title: type,
                              subtitle: `For ${aud.toLowerCase()} · ${tone} tone`,
                            }
                          : sl,
                      ),
                    });
                    toast.success("Saved to Generated Content", {
                      description: `${name} · ${s.name} style`,
                    });
                    navigate({ to: "/editor/$id", params: { id } });
                  }}
                >
                  Use this style
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPicked(s.id);
                    toast("Customize opens in the editor", {
                      description: "Adjust layouts, motion and density.",
                    });
                  }}
                >
                  Customize
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
        <div className="space-y-8">
          <div>
            <div className="eyebrow">New presentation</div>
            <h1 className="mt-2 font-serif text-[40px]">What do you want to create?</h1>
          </div>
          <div className="surface p-1.5 focus-within:ring-2 focus-within:ring-ring/30">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={placeholder}
              className="min-h-40 resize-none border-0 text-[15px] shadow-none focus-visible:ring-0"
              aria-label="Presentation brief"
            />
            <div className="flex items-center justify-between px-3 pb-2 text-[12px] text-muted-foreground">
              <button className="hover:text-foreground" onClick={() => setPrompt(placeholder)}>
                Use example prompt
              </button>
              <span className="font-mono">{prompt.length} chars</span>
            </div>
          </div>
          <Group label="Presentation type">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {presentationTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={cn(
                    "rounded-lg border p-3 text-left text-[13px] transition-all",
                    type === t
                      ? "border-foreground bg-accent font-medium"
                      : "bg-card hover:bg-muted/50",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Group>
          <Group label="Length">
            <div className="flex flex-wrap gap-2">
              {lengths.map((x) => (
                <Chip key={x} active={len === x} onClick={() => setLen(x)}>
                  {x}
                </Chip>
              ))}
            </div>
          </Group>
          <Group label="Audience">
            <div className="flex flex-wrap gap-2">
              {audiences.map((x) => (
                <Chip key={x} active={aud === x} onClick={() => setAud(x)}>
                  {x}
                </Chip>
              ))}
            </div>
          </Group>
          <Group label="Tone">
            <div className="flex flex-wrap gap-2">
              {tones.map((x) => (
                <Chip key={x} active={tone === x} onClick={() => setTone(x)}>
                  {x}
                </Chip>
              ))}
            </div>
          </Group>
          <Group label="Brand">
            <div className="surface p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <BrandMark brand={brand} />
                  <div>
                    <div className="text-[14px] font-medium">Brand: {brand.name}</div>
                    <div className="text-[12px] text-muted-foreground">
                      Connected · logo, colors & fonts applied automatically
                    </div>
                  </div>
                </div>
                <BrandPicker label="Change brand" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-3">
                {brandAssets.map((a) => (
                  <div key={a} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-success" />
                    {a}
                  </div>
                ))}
              </div>
              <label className="mt-4 flex items-center justify-between border-t pt-3 text-[13px]">
                Use company default brand
                <Switch checked={useDefault} onCheckedChange={setUseDefault} />
              </label>
            </div>
          </Group>
        </div>

        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="surface overflow-hidden">
            <div className="border-b px-4 py-3">
              <div className="eyebrow">Live AI configuration</div>
            </div>
            <div className="p-4">
              <SlideView
                kind="title"
                theme="brand"
                title={prompt ? prompt.slice(0, 42) + (prompt.length > 42 ? "…" : "") : type}
                className="rounded-md border"
              />
            </div>
            <dl className="space-y-2.5 border-t px-4 py-4 text-[13px]">
              {[
                ["Type", type],
                ["Length", len],
                ["Audience", aud],
                ["Tone", tone],
                ["Brand", useDefault ? `${brand.name} (default)` : brand.name],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t p-4 space-y-3">
              <BrandBadge />
              <Button
                className="w-full"
                size="lg"
                disabled={prompt.trim().length < 10}
                onClick={() => setPhase("building")}
              >
                <Sparkles />
                Generate presentation
              </Button>
              {prompt.trim().length < 10 && (
                <p className="text-center text-[11.5px] text-muted-foreground">
                  Describe your deck to enable generation.
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </Page>
  );
}
