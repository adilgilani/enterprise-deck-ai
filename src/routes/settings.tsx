import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { auditLog } from "@/lib/mock-data";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Enterprise AI" }] }),
  component: Settings,
});

function Row({ label, desc, on = true }: { label: string; desc?: string; on?: boolean }) {
  return (
    <label className="flex items-center justify-between gap-6 px-5 py-3.5">
      <span>
        <span className="block text-[13.5px] font-medium">{label}</span>
        {desc && <span className="block text-[12px] text-muted-foreground">{desc}</span>}
      </span>
      <Switch
        defaultChecked={on}
        onCheckedChange={(v) => toast(`${label}: ${v ? "enabled" : "disabled"}`)}
      />
    </label>
  );
}

function Settings() {
  return (
    <Page>
      <PageHeader
        title="Settings"
        subtitle="Workspace, security and AI governance."
        actions={
          <span className="flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-[12px] text-ink-foreground">
            <ShieldCheck className="size-3.5" />
            Enterprise AI
          </span>
        }
      />
      <Tabs defaultValue="workspace">
        <TabsList>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="ai">AI</TabsTrigger>
        </TabsList>
        <TabsContent value="workspace" className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="surface space-y-4 p-6">
            <h2 className="font-semibold">Company information</h2>
            <Input defaultValue="Acme Corporation" aria-label="Company" />
            <Input defaultValue="acme.com" aria-label="Domain" />
            <Button onClick={() => toast.success("Workspace updated")}>Save</Button>
          </section>
          <section className="surface divide-y">
            <div className="px-5 py-4 font-semibold">Brand systems</div>
            {["Acme Corporation (default)", "Acme EMEA", "Acme Ventures"].map((b) => (
              <div key={b} className="flex justify-between px-5 py-3 text-[13px]">
                {b}
                <span className="text-muted-foreground">Active</span>
              </div>
            ))}
          </section>
          <section className="surface lg:col-span-2 overflow-x-auto">
            <div className="px-5 py-4 font-semibold">Roles & permissions</div>
            <table className="w-full border-t text-[13px]">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Permission</th>
                  {["Owner", "Admin", "Brand manager", "Editor", "Viewer"].map((r) => (
                    <th key={r} className="px-3 py-2 font-medium">
                      {r}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ["Edit brand system", 1, 1, 1, 0, 0],
                  ["Create & edit content", 1, 1, 1, 1, 0],
                  ["Manage members", 1, 1, 0, 0, 0],
                  ["Export & share externally", 1, 1, 1, 1, 0],
                ].map(([p, ...v]) => (
                  <tr key={p as string}>
                    <td className="px-5 py-2.5">{p}</td>
                    {v.map((x, i) => (
                      <td key={i} className="px-3 py-2.5">
                        {x ? "✓" : <span className="text-subtle">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </TabsContent>
        <TabsContent value="security" className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="surface divide-y">
            <div className="px-5 py-4 font-semibold">Identity & access</div>
            <Row label="SSO (SAML / OIDC)" desc="Okta connected" />
            <Row label="SCIM provisioning" desc="Last sync 2h ago" />
            <Row label="Enforce MFA" />
            <Row label="IP access policy" on={false} />
          </section>
          <section className="surface divide-y">
            <div className="flex items-center gap-2 px-5 py-4 font-semibold">
              <Lock className="size-4" />
              Data protection
            </div>
            <Row label="Encryption at rest & in transit" desc="AES-256 · TLS 1.3" />
            <div className="flex items-center justify-between px-5 py-3.5 text-[13.5px]">
              <span className="font-medium">Data retention</span>
              <Select defaultValue="1y" onValueChange={(v) => toast(`Retention set to ${v}`)}>
                <SelectTrigger className="h-8 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90d">90 days</SelectItem>
                  <SelectItem value="1y">1 year</SelectItem>
                  <SelectItem value="7y">7 years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </section>
          <section className="surface lg:col-span-2">
            <div className="px-5 py-4 font-semibold">Audit logs</div>
            <ul className="divide-y border-t text-[13px]">
              {auditLog.map((l) => (
                <li key={l.what} className="flex justify-between px-5 py-3">
                  <span>
                    <strong className="font-medium">{l.who}</strong> {l.what}
                  </span>
                  <span className="text-muted-foreground">{l.when}</span>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>
        <TabsContent value="ai" className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="surface space-y-4 p-6">
            <h2 className="font-semibold">Models & instructions</h2>
            <Select defaultValue="atlas">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="atlas">Default model: Enterprise Atlas</SelectItem>
                <SelectItem value="fast">Enterprise Atlas Fast</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              defaultValue="Always write in a confident, clear tone. Never invent customer names or metrics. Cite approved case studies only."
              className="min-h-28"
              aria-label="Organization instructions"
            />
            <Button onClick={() => toast.success("Instructions saved")}>Save instructions</Button>
          </section>
          <section className="surface divide-y">
            <div className="px-5 py-4 font-semibold">Governance</div>
            <Row
              label="Private AI mode"
              desc="No data leaves your tenant; no training on your content"
            />
            <Row label="Restrict to approved visual styles" />
            <Row label="Content policy filtering" />
            <Row label="Require review before external share" on={false} />
          </section>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
