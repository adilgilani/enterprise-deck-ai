import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Minus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, ago, describeActivity } from "@/components/shared";
import { api } from "@/lib/api/client";
import { useActivity, useInvalidate, useInvitations, useMembers } from "@/lib/api/hooks";
import { useAuth } from "@/lib/auth";
import type { Invitation, Role } from "@/lib/api/types";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — VYRA" }] }),
  component: TeamPage,
});

const ROLES: Role[] = ["owner", "admin", "editor", "viewer"];
const PERMS: [string, boolean[]][] = [
  ["View presentations, proposals & meetings", [true, true, true, true]],
  ["Create & edit with AI", [true, true, true, false]],
  ["Capture meetings", [true, true, true, false]],
  ["Edit Brand System & templates", [true, true, false, false]],
  ["Invite members & manage roles", [true, true, false, false]],
  ["API keys, AI settings & audit logs", [true, true, false, false]],
  ["Delete workspace, manage owners", [true, false, false, false]],
];

function TeamPage() {
  const { can, me } = useAuth();
  const admin = can("admin");
  const { data: members } = useMembers();
  const { data: invites } = useInvitations(admin);
  const { data: activity } = useActivity();
  const invalidate = useInvalidate();
  const [open, setOpen] = useState(false);
  const [inv, setInv] = useState({ email: "", role: "editor" as Role, department: "" });
  const [link, setLink] = useState<string | null>(null);
  const depts = Object.entries((members ?? []).reduce<Record<string, number>>((a, m) => ({ ...a, [m.department ?? "Unassigned"]: (a[m.department ?? "Unassigned"] ?? 0) + 1 }), {}));

  return (
    <Page>
      <PageHeader title="Team" subtitle={`${members?.length ?? 0} members · roles, permissions and activity`} actions={admin && <Button onClick={() => { setLink(null); setOpen(true); }}><UserPlus />Invite member</Button>} />
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="surface divide-y">
            <div className="grid grid-cols-[1fr_140px_130px_120px_32px] gap-3 px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"><span>Member</span><span>Role</span><span>Department</span><span>Last active</span><span /></div>
            {members?.map((m) => (
              <div key={m.id} className="grid grid-cols-[1fr_140px_130px_120px_32px] items-center gap-3 px-4 py-3 text-[13px]">
                <div className="flex min-w-0 items-center gap-3"><Avatar name={m.user.name} className="size-8 text-[11px]" /><div className="min-w-0"><div className="truncate font-medium">{m.user.name}{m.user.id === me?.user.id && <span className="ml-1.5 text-[11px] text-muted-foreground">(you)</span>}</div><div className="truncate text-[12px] text-muted-foreground">{m.user.email} · {m.title}</div></div></div>
                {admin && m.user.id !== me?.user.id ? (
                  <Select value={m.role} onValueChange={async (v) => { try { await api(`/team/members/${m.id}`, { method: "PATCH", body: { role: v } }); toast.success("Role updated"); void invalidate("members"); } catch (e) { toast.error((e as Error).message); } }}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <span className="capitalize">{m.role}</span>}
                <span className="text-muted-foreground">{m.department ?? "—"}</span>
                <span className="text-muted-foreground">{ago(m.last_active_at)}</span>
                {admin && m.user.id !== me?.user.id ? <button aria-label="Remove" onClick={async () => { try { await api(`/team/members/${m.id}`, { method: "DELETE" }); void invalidate("members"); } catch (e) { toast.error((e as Error).message); } }}><Trash2 className="size-3.5 text-muted-foreground" /></button> : <span />}
              </div>
            ))}
          </div>
          {admin && invites && invites.length > 0 && (
            <div><h2 className="mb-3 text-[15px] font-semibold">Pending invitations</h2><div className="surface divide-y">{invites.map((i: Invitation) => <div key={i.id} className="flex items-center gap-3 px-4 py-3 text-[13px]"><span className="flex-1">{i.email}</span><span className="capitalize text-muted-foreground">{i.role}</span><span className="text-muted-foreground">expires {new Date(i.expires_at).toLocaleDateString()}</span><Button variant="ghost" size="sm" onClick={async () => { await api(`/team/invitations/${i.id}`, { method: "DELETE" }); void invalidate("invitations"); }}>Revoke</Button></div>)}</div></div>
          )}
          <div>
            <h2 className="mb-3 text-[15px] font-semibold">Roles & permissions</h2>
            <div className="surface overflow-hidden">
              <table className="w-full text-[13px]"><thead><tr className="border-b bg-muted/30"><th className="px-4 py-2 text-left font-medium">Permission</th>{ROLES.map((r) => <th key={r} className="px-3 py-2 font-medium capitalize">{r}</th>)}</tr></thead>
                <tbody>{PERMS.map(([p, v]) => <tr key={p} className="border-b last:border-0"><td className="px-4 py-2.5">{p}</td>{v.map((ok, i) => <td key={i} className="text-center">{ok ? <Check className="mx-auto size-4 text-success" /> : <Minus className="mx-auto size-4 text-subtle" />}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>
        <aside className="space-y-6">
          <div><h2 className="mb-3 text-[15px] font-semibold">Departments</h2><div className="surface divide-y">{depts.map(([d, n]) => <div key={d} className="flex justify-between px-4 py-2.5 text-[13px]"><span>{d}</span><span className="font-mono text-muted-foreground">{n}</span></div>)}</div></div>
          <div><h2 className="mb-3 text-[15px] font-semibold">Activity</h2><div className="space-y-3">{activity?.slice(0, 12).map((a) => <div key={a.id} className="flex gap-2.5 text-[12.5px]"><Avatar name={a.user?.name} /><div><span className="font-medium">{a.user?.name ?? "System"}</span> <span className="text-muted-foreground">{describeActivity(a)}</span><div className="text-[11px] text-muted-foreground">{ago(a.created_at)}</div></div></div>)}</div></div>
        </aside>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Invite a teammate</DialogTitle></DialogHeader>
          {link ? (
            <div className="space-y-3 text-[13px]"><p>Invitation created. Share this secure link (valid 14 days):</p><div className="flex gap-2"><Input readOnly value={link} className="font-mono text-[12px]" /><Button variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast("Copied"))}><Copy /></Button></div></div>
          ) : (
            <div className="space-y-3">
              <Input placeholder="name@company.com" type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
              <Select value={inv.role} onValueChange={(v) => setInv({ ...inv, role: v as Role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROLES.filter((r) => r !== "owner" || can("owner")).map((r) => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}</SelectContent></Select>
              <Input placeholder="Department (optional)" value={inv.department} onChange={(e) => setInv({ ...inv, department: e.target.value })} />
              <Button className="w-full" onClick={async () => { try { const r = await api<Invitation>("/team/invitations", { body: { email: inv.email, role: inv.role, department: inv.department || null } }); setLink(r.invite_url ?? null); void invalidate("invitations"); } catch (e) { toast.error((e as Error).message); } }}>Send invitation</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Page>
  );
}
