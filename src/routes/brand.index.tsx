import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, MoreHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { BrandMark, BrandScope } from "@/components/brand-scope";
import { SlideView } from "@/components/slide";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { BrandSystem } from "@/lib/brand-data";
import { actions, useActiveBrand, useBrandAssets, useBrands, useDocTemplates } from "@/lib/store";

export const Route = createFileRoute("/brand/")({
  head: () => ({
    meta: [
      { title: "Brand Studio — Enterprise AI" },
      {
        name: "description",
        content: "Separate brand workspaces for every company and brand you manage.",
      },
    ],
  }),
  component: BrandStudio,
});

function BrandStudio() {
  const brands = useBrands();
  const active = useActiveBrand();
  const assets = useBrandAssets();
  const templates = useDocTemplates();
  const [open, setOpen] = useState(false);
  return (
    <Page>
      <PageHeader
        title="Brand Studio"
        subtitle="Your company's visual identity becomes the foundation for everything AI creates. Each brand keeps its own isolated workspace."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus />
            New brand
          </Button>
        }
      />
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {brands.map((b) => {
          const nA = assets.filter((a) => a.brandId === b.id).length;
          const nT = templates.filter((t) => t.brandId === b.id).length;
          return (
            <div key={b.id} className="surface surface-hover group relative overflow-hidden">
              <Link
                to="/brand/$brandId"
                params={{ brandId: b.id }}
                className="absolute inset-0 z-0"
                aria-label={`Open ${b.name}`}
              />
              <div className="pointer-events-none grid grid-cols-[1.5fr_1fr] gap-1.5 bg-muted/40 p-4">
                <BrandScope brand={b}>
                  <div className="row-span-2 overflow-hidden rounded-md border">
                    <SlideView
                      kind="title"
                      theme="brand"
                      title={b.name}
                      slide={{ id: b.id, kind: "title", title: b.name, subtitle: b.tagline }}
                    />
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    <SlideView kind="metrics" theme="light" title="Performance" />
                  </div>
                  <div className="overflow-hidden rounded-md border">
                    <SlideView kind="split" theme="ink" title="Strategy" />
                  </div>
                </BrandScope>
              </div>
              <div className="pointer-events-none p-5">
                <div className="flex items-start gap-3">
                  <BrandMark brand={b} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[15px] font-semibold">
                      {b.name}
                      {b.id === active.id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[10.5px] font-medium text-success">
                          <Check className="size-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[12.5px] text-muted-foreground">
                      {b.industry} · {b.website}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-1.5">
                  {b.colors.map((c) => (
                    <span
                      key={c.name}
                      title={`${c.name} ${c.hex}`}
                      className="size-5 rounded-full border shadow-card"
                      style={{ background: c.hex }}
                    />
                  ))}
                  <span
                    className="ml-auto text-[12px] text-muted-foreground"
                    style={{ fontFamily: `"${b.headingFont}", serif` }}
                  >
                    {b.headingFont}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-3 border-t pt-3 text-[12px]">
                  <div>
                    <div className="font-mono text-[15px]">{nA}</div>
                    <div className="text-muted-foreground">Assets</div>
                  </div>
                  <div>
                    <div className="font-mono text-[15px]">{nT}</div>
                    <div className="text-muted-foreground">Templates</div>
                  </div>
                  <div>
                    <div className="text-[13px]">{b.updated}</div>
                    <div className="text-muted-foreground">Updated</div>
                  </div>
                </div>
              </div>
              <div className="absolute right-3 top-3 z-10 flex gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="grid size-7 place-items-center rounded-md border bg-card/90 backdrop-blur hover:bg-card"
                    aria-label={`${b.name} options`}
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                      <Link to="/brand/$brandId" params={{ brandId: b.id }}>
                        Open workspace
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={b.id === active.id}
                      onClick={() => {
                        actions.setActiveBrand(b.id);
                        toast.success(`${b.name} is now the active brand`);
                      }}
                    >
                      Set as active brand
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <ArrowRight className="pointer-events-none absolute bottom-5 right-5 size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
            </div>
          );
        })}
        <button
          onClick={() => setOpen(true)}
          className="grid min-h-64 place-items-center rounded-lg border border-dashed text-[13px] text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <span className="flex flex-col items-center gap-2">
            <Plus className="size-5" />
            Add a brand<span className="text-[12px]">Subsidiary, client or product brand</span>
          </span>
        </button>
      </div>
      <NewBrandDialog open={open} onOpenChange={setOpen} />
    </Page>
  );
}

function NewBrandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [industry, setIndustry] = useState("");
  const [site, setSite] = useState("");
  const [primary, setPrimary] = useState("#4F46E5");
  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const id =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") || `brand-${Date.now()}`;
    const b: BrandSystem = {
      id,
      name,
      initials: name
        .split(/\s+/)
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
      industry: industry || "—",
      website: site || `${id}.com`,
      tagline: "",
      description: "",
      mission: "",
      colors: [
        { name: "Primary", hex: primary.toUpperCase(), role: "primary" },
        { name: "Text", hex: "#16181D", role: "text" },
        { name: "Accent", hex: "#E5C07B", role: "accent" },
        { name: "Background", hex: "#F7F7F5", role: "background" },
      ],
      headingFont: "Instrument Serif",
      bodyFont: "Inter",
      dataFont: "Geist Mono",
      slide: { a: "#16181D", b: primary, c: "#E5C07B", d: "#F4F4F1" },
      tone: "Clear / Professional",
      imageStyle: "Editorial",
      chartStyle: "Minimal",
      updated: "Just now",
    };
    actions.addBrand(b);
    onOpenChange(false);
    setName("");
    setIndustry("");
    setSite("");
    toast.success(`${name} brand created`, {
      description: "Upload logos, guidelines and templates to complete it.",
    });
    navigate({ to: "/brand/$brandId", params: { brandId: id } });
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New brand</DialogTitle>
          <DialogDescription>
            Creates an isolated workspace — its assets are never mixed with other brands.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={create} className="space-y-3">
          <Input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Brand name"
            aria-label="Brand name"
          />
          <Input
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="Industry"
            aria-label="Industry"
          />
          <Input
            value={site}
            onChange={(e) => setSite(e.target.value)}
            placeholder="Website"
            aria-label="Website"
          />
          <label className="flex items-center justify-between rounded-md border px-3 py-2 text-[13px]">
            Primary color
            <span className="flex items-center gap-2 font-mono text-[12px]">
              {primary}
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="size-6 cursor-pointer rounded border-0 bg-transparent"
                aria-label="Primary color"
              />
            </span>
          </label>
          <Button type="submit" className="w-full" disabled={!name.trim()}>
            Create brand
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
