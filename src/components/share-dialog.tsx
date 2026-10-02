import { useState } from "react";
import { Building2, Copy, Globe, Link2, Lock, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { useInvalidate, useShares } from "@/lib/api/hooks";
import type { Share } from "@/lib/api/types";
import { ago } from "@/components/shared";
import { cn } from "@/lib/utils";

type Kind = "presentations" | "proposals" | "meetings";

/** Internal / external secure links with view-only, download permission, password and expiry. */
export function ShareDialog({ kind, id, title, open, onOpenChange }: { kind: Kind; id: string; title: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [audience, setAudience] = useState<"internal" | "external">("external");
  const [download, setDownload] = useState(false);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState("");
  const [expiry, setExpiry] = useState("14");
  const [busy, setBusy] = useState(false);
  const { data: shares } = useShares(kind, open ? id : undefined);
  const invalidate = useInvalidate();

  const create = async () => {
    if (usePassword && password.length < 4) return void toast.error("Password must be at least 4 characters");
    setBusy(true);
    try {
      const s = await api<Share>(`/${kind}/${id}/share`, {
        body: { audience, allow_download: download, password: usePassword ? password : null, expires_in_days: expiry === "never" ? null : Number(expiry) },
      });
      await navigator.clipboard?.writeText(s.url).catch(() => undefined);
      toast.success("Secure link created and copied", { description: s.url });
      setPassword("");
      void invalidate("shares");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (s: Share) => {
    await api(`/public/shares/${s.id}`, { method: "DELETE" });
    toast("Link revoked");
    void invalidate("shares");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{title}”</DialogTitle>
          <DialogDescription>Links are view-only. Branding, fonts and colors are preserved.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["internal", Building2, "Internal", "Workspace members only"],
            ["external", Globe, "External secure link", "Anyone with the link"],
          ] as const).map(([v, Icon, label, desc]) => (
            <button key={v} onClick={() => setAudience(v)} className={cn("rounded-lg border p-3 text-left transition-all", audience === v ? "border-foreground bg-accent" : "hover:bg-muted/50")}>
              <Icon className="size-4" />
              <div className="mt-2 text-[13px] font-medium">{label}</div>
              <div className="text-[12px] text-muted-foreground">{desc}</div>
            </button>
          ))}
        </div>
        <div className="divide-y rounded-lg border text-[13px]">
          <label className="flex items-center justify-between px-3.5 py-2.5">View only<Switch checked disabled /></label>
          <label className="flex items-center justify-between px-3.5 py-2.5">Allow download<Switch checked={download} onCheckedChange={setDownload} /></label>
          <div className="px-3.5 py-2.5">
            <label className="flex items-center justify-between">Require password<Switch checked={usePassword} onCheckedChange={setUsePassword} /></label>
            {usePassword && <Input className="mt-2" type="password" placeholder="Link password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </div>
          <div className="flex items-center justify-between px-3.5 py-2">
            Expires
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">In 1 day</SelectItem>
                <SelectItem value="7">In 7 days</SelectItem>
                <SelectItem value="14">In 14 days</SelectItem>
                <SelectItem value="30">In 30 days</SelectItem>
                <SelectItem value="never">Never</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={create} disabled={busy}><Link2 />{busy ? "Creating…" : "Create secure link"}</Button>
        {shares && shares.length > 0 && (
          <div>
            <div className="eyebrow mb-2">Active links</div>
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {shares.map((s) => (
                <div key={s.id} className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-[12px]">
                  {s.audience === "internal" ? <Building2 className="size-3.5 text-muted-foreground" /> : <Globe className="size-3.5 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono">{s.url}</div>
                    <div className="text-muted-foreground">
                      {s.view_count} views · {s.has_password && <><Lock className="mb-0.5 inline size-3" /> · </>}{s.allow_download ? "downloads on" : "view only"} · {s.expires_at ? `expires ${ago(s.expires_at).replace(" ago", "")}` : "no expiry"}
                    </div>
                  </div>
                  <button aria-label="Copy" className="rounded p-1 hover:bg-accent" onClick={() => void navigator.clipboard.writeText(s.url).then(() => toast("Copied"))}><Copy className="size-3.5" /></button>
                  <button aria-label="Revoke" className="rounded p-1 text-destructive hover:bg-destructive/10" onClick={() => void revoke(s)}><Trash2 className="size-3.5" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
