import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, KeyRound, Loader2, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ago, describeActivity } from "@/components/shared";
import { api } from "@/lib/api/client";
import { useAISettings, useApiKeys, useAuditLogs, useInvalidate, useMembers, useSessions } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth";
import type { AISettings, ApiKey } from "@/lib/api/types";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — VYRA" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { me, can, refresh } = useAuth();
  const admin = can("admin");
  const [name, setName] = useState(me?.organization.name ?? "");
  const [slug, setSlug] = useState(me?.organization.slug ?? "");
  return (
    <Page className="max-w-[1000px]">
      <PageHeader title="Settings" subtitle="Workspace, members, security, AI and integrations." />
      <Tabs defaultValue="workspace">
        <TabsList><TabsTrigger value="workspace">Workspace</TabsTrigger><TabsTrigger value="members">Members</TabsTrigger><TabsTrigger value="security">Security</TabsTrigger><TabsTrigger value="ai">AI</TabsTrigger><TabsTrigger value="integrations">Integrations</TabsTrigger></TabsList>
        <TabsContent value="workspace" className="mt-6 space-y-6">
          <Card title="Workspace">
            <fieldset disabled={!admin} className="grid gap-3 sm:grid-cols-2">
              <div><L>Company / workspace name</L><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div><L>Workspace URL</L><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
            </fieldset>
            {admin && <Button className="mt-4" onClick={async () => { try { await api("/settings/workspace", { method: "PATCH", body: { name, slug } }); toast.success("Workspace updated"); void refresh(); } catch (e) { toast.error((e as Error).message); } }}>Save</Button>}
          </Card>
          <Card title="Branding"><p className="text-[13px] text-muted-foreground">Logo, colors, fonts, tone of voice and templates live in the Brand System.</p><Button variant="outline" className="mt-3" asChild><Link to="/brand">Open Brand Studio</Link></Button></Card>
          <Card title="Plan"><p className="text-[13px] capitalize">{me?.organization.plan} · {me?.organization.seats} seats</p></Card>
        </TabsContent>
        <TabsContent value="members" className="mt-6"><MembersCompact /></TabsContent>
        <TabsContent value="security" className="mt-6 space-y-6">
          <Card title="Single sign-on (SSO)"><div className="flex items-center justify-between text-[13px]"><div><div className="font-medium">SAML 2.0 / OpenID Connect</div><div className="text-muted-foreground">Okta, Azure AD / Entra ID, Google Workspace. Auth is provider-pluggable on the backend.</div></div><Button variant="outline" disabled>Configure</Button></div></Card>
          {admin && <ApiKeys />}
          <Sessions />
          {admin && <Audit />}
        </TabsContent>
        <TabsContent value="ai" className="mt-6"><AITab admin={admin} /></TabsContent>
        <TabsContent value="integrations" className="mt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {[["Google Drive", "Import documents into the AI Library and export decks."], ["Microsoft 365", "OneDrive, SharePoint and PowerPoint round-trip."], ["Slack", "Share meeting notes and decks to channels."], ["Microsoft Teams", "Capture Teams meetings and post summaries."], ["Salesforce / HubSpot CRM", "Pre-fill proposals from opportunities; sync status."]].map(([n, d]) => (
              <div key={n} className="surface flex items-start justify-between gap-4 p-5"><div><div className="text-[14px] font-medium">{n}</div><div className="mt-1 text-[12.5px] text-muted-foreground">{d}</div></div><Button size="sm" variant="outline" onClick={() => toast("Integration requested", { description: `${n} connector is on the roadmap.` })}>Connect</Button></div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="surface p-5"><div className="mb-3 text-[14px] font-semibold">{title}</div>{children}</div>;
}
function L({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[12px] font-medium text-muted-foreground">{children}</div>;
}

function MembersCompact() {
  const { data } = useMembers();
  return <Card title="Members"><div className="divide-y text-[13px]">{data?.map((m) => <div key={m.id} className="flex justify-between py-2.5"><span>{m.user.name} <span className="text-muted-foreground">· {m.user.email}</span></span><span className="capitalize text-muted-foreground">{m.role}</span></div>)}</div><Button variant="outline" className="mt-3" asChild><Link to="/team">Manage team & roles</Link></Button></Card>;
}

function ApiKeys() {
  const { data } = useApiKeys();
  const invalidate = useInvalidate();
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  return (
    <Card title="API keys">
      {created && <div className="mb-3 rounded-md border border-warning/40 bg-warning-soft p-3 text-[12.5px]"><div className="font-medium">Copy your key now — it won't be shown again.</div><div className="mt-2 flex gap-2"><Input readOnly value={created} className="font-mono text-[12px]" /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(created).then(() => toast("Copied"))}><Copy /></Button></div></div>}
      <div className="divide-y text-[13px]">{data?.map((k) => <div key={k.id} className="flex items-center gap-3 py-2.5"><KeyRound className="size-3.5 text-muted-foreground" /><span className="flex-1">{k.name} <span className="font-mono text-muted-foreground">{k.prefix}…</span></span><span className="text-muted-foreground">{k.revoked_at ? "revoked" : k.last_used_at ? `used ${ago(k.last_used_at)}` : "never used"}</span>{!k.revoked_at && <button aria-label="Revoke" onClick={async () => { await api(`/settings/api-keys/${k.id}`, { method: "DELETE" }); void invalidate("api-keys"); }}><Trash2 className="size-3.5 text-muted-foreground" /></button>}</div>)}</div>
      <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (!name) return; const k = await api<ApiKey>("/settings/api-keys", { body: { name } }); setCreated(k.key ?? null); setName(""); void invalidate("api-keys"); }}><Input placeholder="Key name, e.g. CRM sync" value={name} onChange={(e) => setName(e.target.value)} /><Button type="submit">Create key</Button></form>
    </Card>
  );
}

function Sessions() {
  const { data } = useSessions();
  const invalidate = useInvalidate();
  return <Card title="Active sessions"><div className="divide-y text-[13px]">{data?.map((s) => <div key={s.id} className="flex items-center gap-3 py-2.5"><Shield className="size-3.5 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{s.user_agent?.slice(0, 70) ?? "Unknown device"} {s.current && <span className="ml-1 rounded bg-success-soft px-1.5 text-[11px] text-success">this device</span>}</span><span className="text-muted-foreground">{s.ip_address} · {ago(s.last_seen_at)}</span>{!s.current && <Button size="sm" variant="ghost" onClick={async () => { await api(`/auth/sessions/${s.id}`, { method: "DELETE" }); void invalidate("sessions"); }}>Revoke</Button>}</div>)}</div></Card>;
}

function Audit() {
  const { data } = useAuditLogs();
  return <Card title="Audit log"><div className="max-h-96 divide-y overflow-y-auto text-[12.5px]">{data?.map((a) => <div key={a.id} className="grid grid-cols-[140px_1fr_110px] gap-3 py-2"><span className="font-mono text-[11.5px] text-muted-foreground">{new Date(a.created_at).toLocaleString()}</span><span><b className="font-medium">{a.user?.name ?? "System"}</b> {describeActivity(a)}</span><span className="text-right font-mono text-[11px] text-muted-foreground">{a.ip_address}</span></div>)}</div></Card>;
}

function AITab({ admin }: { admin: boolean }) {
  const { data } = useAISettings();
  const invalidate = useInvalidate();
  const [s, setS] = useState<AISettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setS(data); }, [data]);
  if (!s) return <Loader2 className="animate-spin" />;
  return (
    <div className="space-y-6">
      <Card title="Provider">
        <div className="grid gap-3 text-[13px] sm:grid-cols-2">
          {[["LLM provider", `${s.provider} · ${s.provider_model}`], ["Status", s.configured ? "Configured (keys stored server-side only)" : "Not configured"], ["English speech-to-text", s.stt_provider_en], ["Urdu speech-to-text", s.stt_provider_ur], ["Embeddings (pgvector)", s.embedding_provider]].map(([k, v]) => <div key={k} className="rounded-md border bg-muted/20 px-3 py-2"><div className="text-[11.5px] text-muted-foreground">{k}</div><div className="font-mono">{v}</div></div>)}
        </div>
      </Card>
      <Card title="Generation settings">
        <fieldset disabled={!admin} className="space-y-5">
          <div><L>Model override (optional)</L><Input value={s.model ?? ""} onChange={(e) => setS({ ...s, model: e.target.value || null })} placeholder={s.provider_model} /></div>
          <div><L>System instructions (applied to every generation)</L><Textarea value={s.system_instructions} onChange={(e) => setS({ ...s, system_instructions: e.target.value })} className="min-h-[110px]" /></div>
          <div><L>Temperature · {s.temperature.toFixed(2)}</L><Slider value={[s.temperature]} min={0} max={1.2} step={0.05} onValueChange={(v) => setS({ ...s, temperature: v[0] ?? 0.4 })} /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><L>Default slide count</L><Input type="number" value={s.default_slide_count} onChange={(e) => setS({ ...s, default_slide_count: Number(e.target.value) })} /></div><div><L>Default tone</L><Input value={s.default_tone} onChange={(e) => setS({ ...s, default_tone: e.target.value })} /></div></div>
          <label className="flex items-center justify-between text-[13px]">Creative mode by default<Switch checked={s.creative_mode_default} onCheckedChange={(v) => setS({ ...s, creative_mode_default: v })} /></label>
          <label className="flex items-center justify-between text-[13px]">Use company knowledge (RAG) by default<Switch checked={s.use_knowledge_default} onCheckedChange={(v) => setS({ ...s, use_knowledge_default: v })} /></label>
        </fieldset>
        {admin && <Button className="mt-5" disabled={saving} onClick={async () => { setSaving(true); try { await api("/settings/ai", { method: "PUT", body: { model: s.model, system_instructions: s.system_instructions, temperature: s.temperature, default_slide_count: s.default_slide_count, default_tone: s.default_tone, creative_mode_default: s.creative_mode_default, use_knowledge_default: s.use_knowledge_default } }); toast.success("AI settings saved"); void invalidate("ai-settings"); } catch (e) { toast.error((e as Error).message); } setSaving(false); }}>Save AI settings</Button>}
      </Card>
    </div>
  );
}
