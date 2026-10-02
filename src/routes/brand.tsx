import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Check, Copy, Loader2, MoreHorizontal, Plus, Save, ShieldCheck, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/dialogs";
import { SlideRenderer } from "@/components/slide";
import { CompliancePill } from "@/components/shared";
import { api, blobUrl } from "@/lib/api/client";
import { useBrands, useInvalidate, useTemplates } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth";
import type { Asset, Brand, BrandColor } from "@/lib/api/types";
import { STYLES, type Slide, type Theme } from "@/lib/deck/schema";
import { STYLE_INFO } from "@/lib/deck/theme";
import { brandToTheme } from "@/lib/deck/brand-theme";

const toTheme = brandToTheme;
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/brand")({
  head: () => ({ meta: [{ title: "Brand Studio — VYRA" }] }),
  validateSearch: (s: Record<string, unknown>): { welcome?: boolean; id?: string } => ({
    ...(s["welcome"] ? { welcome: true } : {}),
    ...(typeof s["id"] === "string" ? { id: s["id"] } : {}),
  }),
  component: BrandStudio,
});

const ROLES: BrandColor["role"][] = ["primary", "secondary", "accent", "background", "surface", "text", "muted", "extra"];
const FONTS = ["Instrument Serif", "Geist", "Geist Mono", "Inter", "Playfair Display", "IBM Plex Sans", "IBM Plex Mono", "Source Serif 4", "Manrope", "DM Sans"];
const SECTIONS = [["profile", "Company profile"], ["logo", "Logo"], ["colors", "Colors"], ["fonts", "Typography"], ["voice", "Tone of voice"], ["rules", "Visual rules"], ["guidelines", "Guidelines"], ["messaging", "Approved messaging"], ["templates", "Templates & style"]] as const;

const PREVIEW: Slide = {
  id: "p", layout: "metrics", eyebrow: "Brand preview", title: "Every output follows your brand system",
  elements: [{ type: "metric", value: "100%", label: "Brand compliant" }, { type: "metric", value: "3.2×", label: "Faster to first draft" }, { type: "metric", value: "0", label: "Off-brand decks" }],
};

function ListEditor({ items, onChange, placeholder }: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [v, setV] = useState("");
  return (
    <div className="space-y-1.5">
      {items.map((it, i) => <div key={i} className="flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-[13px]"><span className="flex-1">{it}</span><button aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}><X className="size-3.5 text-muted-foreground" /></button></div>)}
      <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onChange([...items, v.trim()]); setV(""); } }} className="flex gap-2"><Input value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} className="h-8" /><Button size="sm" variant="outline" type="submit"><Plus /></Button></form>
    </div>
  );
}

function BrandStudio() {
  const { data: brands } = useBrands();
  const { data: templates } = useTemplates();
  const { can } = useAuth();
  const { welcome, id } = Route.useSearch();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const selectedId = id ?? brands?.find((x) => x.is_default)?.id ?? brands?.[0]?.id;
  const data = brands?.find((x) => x.id === selectedId) ?? null;
  const [creating, setCreating] = useState(false);
  const [b, setB] = useState<Brand | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logo, setLogo] = useState<string | null>(null);
  const logoInput = useRef<HTMLInputElement | null>(null);
  const admin = can("admin");

  useEffect(() => {
    if (data) {
      setB(data);
      setDirty(false);
    }
  }, [data?.id, data?.updated_at]); // eslint-disable-line react-hooks/exhaustive-deps
  const select = (brandId: string) => {
    if (brandId === b?.id) return;
    if (dirty && !window.confirm("Discard unsaved changes to this brand?")) return;
    void navigate({ to: "/brand", search: { id: brandId }, replace: true });
  };
  useEffect(() => {
    if (b?.logo_asset_id) blobUrl(`/assets/${b.logo_asset_id}/file`).then(setLogo).catch(() => setLogo(null));
    else setLogo(null);
  }, [b?.logo_asset_id]);
  if (!b) return <Page><Loader2 className="animate-spin" /></Page>;
  const upd = (patch: Partial<Brand>) => { setB({ ...b, ...patch }); setDirty(true); };
  const prof = (patch: Partial<Brand["company_profile"]>) => upd({ company_profile: { ...b.company_profile, ...patch } });
  const tone = (patch: Partial<Brand["tone_of_voice"]>) => upd({ tone_of_voice: { ...b.tone_of_voice, ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      const out = await api<Brand>(`/brand/${b.id}`, { method: "PATCH", body: { name: b.name, brand_lock: b.brand_lock, colors: b.colors, fonts: b.fonts, logo_asset_id: b.logo_asset_id, guidelines: b.guidelines, visual_rules: b.visual_rules, tone_of_voice: b.tone_of_voice, company_profile: b.company_profile, approved_messaging: b.approved_messaging, default_style: b.default_style, default_template_id: b.default_template_id } });
      setB(out);
      setDirty(false);
      void invalidate("brand", "brands", "brand-context");
      toast.success("Brand system saved", { description: "Applied to all new presentations, proposals and meeting decks." });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setSaving(false);
  };
  const uploadLogo = async (f: File) => {
    const fd = new FormData();
    fd.append("file", f);
    fd.append("type", "logo");
    try {
      const a = await api<Asset>("/assets", { method: "POST", form: fd });
      upd({ logo_asset_id: a.id });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const theme = toTheme(b);
  const done = Object.values(b.completeness).filter(Boolean).length;

  return (
    <Page>
      {welcome && <div className="mb-6 rounded-lg border border-brand/30 bg-brand-soft p-4 text-[14px]"><b>Welcome!</b> Define your brand once — company profile, colors, fonts and tone. Every presentation, proposal and meeting deck will use it automatically.</div>}
      <PageHeader title="Brand Studio" subtitle="Define each brand once — presentations, proposals and meeting decks apply it automatically." actions={admin && <Button variant="outline" onClick={() => setCreating(true)}><Plus />New brand</Button>} />
      {!admin && <div className="mb-6 rounded-md border bg-muted/40 px-4 py-2.5 text-[13px] text-muted-foreground">Only admins can edit brand systems.</div>}

      <div className="mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {brands?.map((x) => <BrandCard key={x.id} brand={x} selected={x.id === b.id} admin={admin} onSelect={() => select(x.id)} onCreated={(nid) => void navigate({ to: "/brand", search: { id: nid }, replace: true })} />)}
        {admin && (
          <button onClick={() => setCreating(true)} className="flex min-h-[236px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-[13px] text-muted-foreground transition-colors hover:border-input hover:bg-muted/40 hover:text-foreground">
            <span className="grid size-10 place-items-center rounded-full border bg-card"><Plus className="size-4" /></span>
            New brand
            <span className="text-[12px]">Sub-brand, product line or client co-brand</span>
          </button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <div className="eyebrow">Editing brand guidelines</div>
          <div className="mt-1 flex items-center gap-2">
            <Input value={b.name} onChange={(e) => upd({ name: e.target.value })} disabled={!admin} className="h-9 w-80 text-[18px] font-semibold" />
            {b.is_default && <span className="rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">Default</span>}
          </div>
          <div className="mt-1 text-[12.5px] text-muted-foreground">{done}/{Object.keys(b.completeness).length} sections complete</div>
        </div>
        <div className="flex items-center gap-2"><CompliancePill />{admin && <Button onClick={() => void save()} disabled={!dirty || saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Save brand</Button>}</div>
      </div>
      <div className="grid gap-10 lg:grid-cols-[180px_1fr_380px]">
        <nav className="sticky top-20 hidden h-fit space-y-0.5 lg:block">{SECTIONS.map(([k, l]) => <a key={k} href={`#${k}`} className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-muted hover:text-foreground">{l}</a>)}</nav>
        <fieldset disabled={!admin} className="min-w-0 space-y-10">
          <S id="profile" title="Company profile">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={b.company_profile.name ?? ""} onChange={(e) => prof({ name: e.target.value })} placeholder="Company name" />
              <Input value={b.company_profile.industry ?? ""} onChange={(e) => prof({ industry: e.target.value })} placeholder="Industry" />
              <Input value={b.company_profile.website ?? ""} onChange={(e) => prof({ website: e.target.value })} placeholder="Website" />
              <Input value={b.company_profile.headquarters ?? ""} onChange={(e) => prof({ headquarters: e.target.value })} placeholder="Headquarters" />
              <Textarea className="min-h-[100px] sm:col-span-2" value={b.company_profile.description ?? ""} onChange={(e) => prof({ description: e.target.value })} placeholder="What the company does — used in every AI generation" />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Services</div><ListEditor items={b.company_profile.services ?? []} onChange={(v) => prof({ services: v })} placeholder="Add service" /></div>
              <div><div className="mb-1.5 text-[12px] font-medium text-muted-foreground">Differentiators</div><ListEditor items={b.company_profile.differentiators ?? []} onChange={(v) => prof({ differentiators: v })} placeholder="Add differentiator" /></div>
            </div>
          </S>
          <S id="logo" title="Logo">
            <div className="flex gap-4">
              {["#FFFFFF", theme.palette.secondary].map((bg) => <div key={bg} className="grid h-28 flex-1 place-items-center rounded-lg border" style={{ background: bg }}>{logo ? <img src={logo} alt="Logo" className="max-h-16 max-w-[70%]" /> : <span className="text-[12px] text-muted-foreground">No logo</span>}</div>)}
            </div>
            <input ref={logoInput} type="file" accept=".png,.jpg,.jpeg,.svg,.webp" hidden onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
            <Button variant="outline" size="sm" className="mt-3" onClick={() => logoInput.current?.click()}><Upload />Upload logo</Button>
          </S>
          <S id="colors" title="Colors">
            <div className="grid gap-2 sm:grid-cols-2">
              {b.colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-card p-2">
                  <input type="color" value={c.hex} onChange={(e) => upd({ colors: b.colors.map((x, j) => (j === i ? { ...x, hex: e.target.value.toUpperCase() } : x)) })} className="size-10 cursor-pointer rounded border-0 bg-transparent" />
                  <div className="min-w-0 flex-1"><Input value={c.name} onChange={(e) => upd({ colors: b.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} className="h-7 text-[13px]" /><div className="mt-1 font-mono text-[11px] text-muted-foreground">{c.hex}</div></div>
                  <Select value={c.role} onValueChange={(v) => upd({ colors: b.colors.map((x, j) => (j === i ? { ...x, role: v as BrandColor["role"] } : x)) })}><SelectTrigger className="h-7 w-28 text-[12px]"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
                  <button aria-label="Remove color" onClick={() => upd({ colors: b.colors.filter((_, j) => j !== i) })}><Trash2 className="size-3.5 text-muted-foreground" /></button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => upd({ colors: [...b.colors, { name: "New color", hex: "#888888", role: "extra" }] })}><Plus />Add color</Button>
          </S>
          <S id="fonts" title="Typography">
            <div className="grid gap-3 sm:grid-cols-3">
              {(["heading", "body", "mono"] as const).map((k) => (
                <div key={k}><div className="mb-1.5 text-[12px] font-medium capitalize text-muted-foreground">{k}</div>
                  <Select value={b.fonts[k] ?? ""} onValueChange={(v) => upd({ fonts: { ...b.fonts, [k]: v } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select>
                  <div className="mt-2 truncate text-[22px]" style={{ fontFamily: b.fonts[k] }}>Aa — The quick brown fox</div>
                </div>
              ))}
            </div>
          </S>
          <S id="voice" title="Tone of voice">
            <Textarea value={b.tone_of_voice.summary ?? ""} onChange={(e) => tone({ summary: e.target.value })} placeholder="How we sound" className="min-h-[70px]" />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div><div className="mb-1.5 text-[12px] font-medium text-success">Do</div><ListEditor items={b.tone_of_voice.do ?? []} onChange={(v) => tone({ do: v })} placeholder="Add guideline" /></div>
              <div><div className="mb-1.5 text-[12px] font-medium text-destructive">Don't</div><ListEditor items={b.tone_of_voice.dont ?? []} onChange={(v) => tone({ dont: v })} placeholder="Add guideline" /></div>
            </div>
          </S>
          <S id="rules" title="Visual rules"><ListEditor items={b.visual_rules.map((r) => r.rule)} onChange={(v) => upd({ visual_rules: v.map((rule, i) => ({ id: b.visual_rules[i]?.id ?? Math.random().toString(16).slice(2, 10), rule, category: b.visual_rules[i]?.category ?? "general" })) })} placeholder="e.g. Maximum 6 bullets per slide" /></S>
          <S id="guidelines" title="Brand guidelines"><Textarea value={b.guidelines} onChange={(e) => upd({ guidelines: e.target.value })} className="min-h-[180px] font-mono text-[12.5px]" /></S>
          <S id="messaging" title="Approved messaging"><ListEditor items={b.approved_messaging} onChange={(v) => upd({ approved_messaging: v })} placeholder="Add approved message or tagline" /></S>
          <S id="templates" title="Templates & visual style">
            <div className="grid grid-cols-4 gap-2">{STYLES.map((s) => <button key={s} type="button" onClick={() => upd({ default_style: s })} className={cn("overflow-hidden rounded-md border text-left", b.default_style === s && "ring-2 ring-foreground")}><SlideRenderer slide={PREVIEW} theme={{ ...theme, style: s }} /><div className="px-2 py-1 text-[12px] font-medium">{STYLE_INFO[s].label}</div></button>)}</div>
            <div className="mt-4 flex items-center gap-3"><span className="text-[13px] text-muted-foreground">Default template</span><Select value={b.default_template_id ?? ""} onValueChange={(v) => upd({ default_template_id: v })}><SelectTrigger className="w-72"><SelectValue placeholder="None" /></SelectTrigger><SelectContent>{(templates ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
            <label className="mt-4 flex items-center justify-between rounded-lg border bg-card p-4 text-[13px]"><div><div className="font-medium">Brand Lock</div><div className="text-muted-foreground">Enforce approved logo, colors, fonts, templates and style across all AI output.</div></div><Switch checked={b.brand_lock} onCheckedChange={(v) => upd({ brand_lock: v })} /></label>
          </S>
        </fieldset>
        <aside className="sticky top-20 h-fit space-y-3">
          <div className="eyebrow">Live preview</div>
          <div className="overflow-hidden rounded-lg border shadow-slide"><SlideRenderer slide={PREVIEW} theme={theme} index={2} total={12} /></div>
          <div className="overflow-hidden rounded-lg border shadow-card"><SlideRenderer slide={{ id: "h", layout: "hero", title: b.company_profile.name || "Your company", subtitle: b.approved_messaging[0] ?? "Approved tagline", background: "inverse", elements: [] }} theme={theme} /></div>
          <div className="flex gap-1">{b.colors.map((c, i) => <div key={i} className="h-8 flex-1 rounded" style={{ background: c.hex }} title={`${c.name} ${c.hex}`} />)}</div>
        </aside>
      </div>
      <NewBrandDialog open={creating} onOpenChange={setCreating} source={b} onCreated={(nid) => void navigate({ to: "/brand", search: { id: nid }, replace: true })} />
    </Page>
  );
}

function S({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section id={id} className="scroll-mt-20"><h2 className="mb-4 border-b pb-2 text-[15px] font-semibold">{title}</h2>{children}</section>;
}

function copyBody(src: Brand, name: string) {
  return {
    name,
    brand_lock: src.brand_lock,
    colors: src.colors,
    fonts: src.fonts,
    logo_asset_id: src.logo_asset_id,
    guidelines: src.guidelines,
    visual_rules: src.visual_rules,
    tone_of_voice: src.tone_of_voice,
    company_profile: src.company_profile,
    approved_messaging: src.approved_messaging,
    default_style: src.default_style,
    default_template_id: src.default_template_id,
  };
}

function BrandCard({ brand, selected, admin, onSelect, onCreated }: { brand: Brand; selected: boolean; admin: boolean; onSelect: () => void; onCreated: (id: string) => void }) {
  const invalidate = useInvalidate();
  const [del, setDel] = useState(false);
  const theme = toTheme(brand);
  const done = Object.values(brand.completeness).filter(Boolean).length;
  const total = Object.keys(brand.completeness).length || 1;
  const refresh = () => invalidate("brands", "brand", "brand-context");
  return (
    <div className={cn("surface group relative flex flex-col overflow-hidden transition-all", selected ? "ring-2 ring-foreground" : "surface-hover")}>
      <button onClick={onSelect} className="text-left">
        <div className="pointer-events-none">
          <SlideRenderer slide={{ id: "c", layout: "hero", title: brand.name.replace(/ Brand$/, ""), subtitle: brand.approved_messaging[0] ?? brand.tone_of_voice.summary ?? "", background: "inverse", elements: [] }} theme={theme} />
        </div>
        <div className="flex h-2">{brand.colors.slice(0, 7).map((c, i) => <div key={i} className="flex-1" style={{ background: c.hex }} />)}</div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 truncate text-[14px] font-medium">{brand.name}</div>
            {brand.is_default && <span className="flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10.5px] font-medium text-background"><Star className="size-2.5 fill-current" />Default</span>}
          </div>
          <div className="mt-0.5 truncate text-[12px] capitalize text-muted-foreground">{theme.fonts.heading} · {theme.fonts.body} · {brand.default_style}</div>
          <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted-foreground">
            {brand.brand_lock && <span className="flex items-center gap-1 text-success"><ShieldCheck className="size-3" />Brand Lock</span>}
            <span className="ml-auto font-mono">{done}/{total}</span>
            <div className="h-1 w-16 rounded-full bg-muted"><div className="h-1 rounded-full bg-success" style={{ width: `${(done / total) * 100}%` }} /></div>
          </div>
        </div>
      </button>
      {selected && <span className="absolute left-2 top-2 grid size-6 place-items-center rounded-full bg-foreground text-background"><Check className="size-3.5" /></span>}
      {admin && (
        <DropdownMenu>
          <DropdownMenuTrigger className="absolute right-2 top-2 grid size-7 place-items-center rounded-md bg-background/85 opacity-0 shadow-card backdrop-blur transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100" aria-label="Brand actions">
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onSelect}>Edit guidelines</DropdownMenuItem>
            {!brand.is_default && (
              <DropdownMenuItem
                onClick={async () => {
                  await api(`/brand/${brand.id}/default`, { method: "POST" });
                  toast.success(`${brand.name} is now the default brand`);
                  void refresh();
                }}
              >
                <Star />Set as default
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={async () => {
                try {
                  const out = await api<Brand>("/brand", { body: copyBody(brand, `${brand.name} (copy)`) });
                  toast.success("Brand duplicated");
                  await refresh();
                  onCreated(out.id);
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              <Copy />Duplicate
            </DropdownMenuItem>
            {!brand.is_default && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => setDel(true)}><Trash2 />Delete</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <ConfirmDialog
        open={del}
        onOpenChange={setDel}
        title={`Delete “${brand.name}”?`}
        body="Presentations and proposals that used this brand keep their current look."
        confirm="Delete brand"
        destructive
        onConfirm={async () => {
          await api(`/brand/${brand.id}`, { method: "DELETE" });
          toast("Brand deleted");
          await refresh();
        }}
      />
    </div>
  );
}

function NewBrandDialog({ open, onOpenChange, source, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; source: Brand; onCreated: (id: string) => void }) {
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"copy" | "blank">("copy");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setName("");
      setMode("copy");
    }
  }, [open]);
  const create = async () => {
    if (!name.trim()) return void toast.error("Give the brand a name");
    setBusy(true);
    try {
      const body = mode === "copy" ? copyBody(source, name.trim()) : { name: name.trim(), company_profile: { name: name.trim() } };
      const out = await api<Brand>("/brand", { body });
      await invalidate("brands");
      toast.success("Brand created", { description: "Fill in its guidelines below." });
      onOpenChange(false);
      onCreated(out.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New brand</DialogTitle>
          <DialogDescription>Each brand has its own colors, fonts, logo, tone of voice and guidelines. Pick it when creating a presentation or proposal.</DialogDescription>
        </DialogHeader>
        <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Ventures, Atlas product line" onKeyDown={(e) => e.key === "Enter" && void create()} />
        <div className="grid grid-cols-2 gap-2">
          {([["copy", "Start from current", `Copy “${source.name}”`], ["blank", "Start blank", "Default colors and fonts"]] as const).map(([k, l, d]) => (
            <button key={k} onClick={() => setMode(k)} className={cn("rounded-lg border p-3 text-left", mode === k ? "border-foreground bg-accent" : "hover:bg-muted/50")}>
              <div className="text-[13px] font-medium">{l}</div>
              <div className="truncate text-[12px] text-muted-foreground">{d}</div>
            </button>
          ))}
        </div>
        <Button onClick={() => void create()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Plus />}Create brand</Button>
      </DialogContent>
    </Dialog>
  );
}
