import { useState } from "react";
import { Copy, Globe, Lock, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/shared";
import { team, initials } from "@/lib/mock-data";

const audiences = ["Team", "Department", "Executives", "Specific people"];

export function ShareDialog({
  open,
  onOpenChange,
  title = "Share",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title?: string;
}) {
  const [aud, setAud] = useState("Team");
  const [people, setPeople] = useState<string[]>(["Sara Malik"]);
  const [pw, setPw] = useState(false);
  const [dl, setDl] = useState(false);
  const link = "https://present.acme.com/s/q4-strategy-7Hk2x";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Control who can view, and for how long.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="internal">
          <TabsList className="w-full">
            <TabsTrigger value="internal" className="flex-1">
              <Users className="mr-1.5 size-3.5" />
              Internal
            </TabsTrigger>
            <TabsTrigger value="external" className="flex-1">
              <Globe className="mr-1.5 size-3.5" />
              External link
            </TabsTrigger>
          </TabsList>
          <TabsContent value="internal" className="mt-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              {audiences.map((a) => (
                <Chip key={a} active={aud === a} onClick={() => setAud(a)}>
                  {a}
                </Chip>
              ))}
            </div>
            {aud === "Specific people" && (
              <div className="max-h-44 divide-y overflow-y-auto rounded-lg border">
                {team.map((t) => {
                  const on = people.includes(t.name);
                  return (
                    <button
                      key={t.name}
                      onClick={() =>
                        setPeople((p) => (on ? p.filter((x) => x !== t.name) : [...p, t.name]))
                      }
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-muted/50"
                    >
                      <span className="grid size-6 place-items-center rounded-full bg-muted text-[9px] font-semibold">
                        {initials(t.name)}
                      </span>
                      <span className="flex-1">
                        {t.name}
                        <span className="ml-2 text-muted-foreground">{t.email}</span>
                      </span>
                      <span className={on ? "text-success" : "text-transparent"}>✓</span>
                    </button>
                  );
                })}
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                toast.success("Shared internally", {
                  description: `${aud === "Specific people" ? people.length + " people" : aud} can now view.`,
                });
              }}
            >
              Share with {aud.toLowerCase()}
            </Button>
          </TabsContent>
          <TabsContent value="external" className="mt-4 space-y-4">
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-[12px]" />
              <Button variant="outline" onClick={() => toast("Secure link copied")}>
                <Copy />
                Copy
              </Button>
            </div>
            <div className="divide-y rounded-lg border text-[13px]">
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span>Access</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[12px]">View only</span>
              </div>
              <label className="flex items-center justify-between px-3.5 py-2.5">
                Allow download
                <Switch checked={dl} onCheckedChange={setDl} />
              </label>
              <label className="flex items-center justify-between px-3.5 py-2.5">
                <span className="flex items-center gap-1.5">
                  <Lock className="size-3.5" />
                  Password protected
                </span>
                <Switch checked={pw} onCheckedChange={setPw} />
              </label>
              {pw && (
                <div className="px-3.5 py-2.5">
                  <Input type="password" placeholder="Set a password" />
                </div>
              )}
              <div className="flex items-center justify-between px-3.5 py-2.5">
                <span>Expiration date</span>
                <Input type="date" defaultValue="2026-11-02" className="h-8 w-40" />
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                toast.success("Secure link created", {
                  description: pw ? "Password protected · expires Nov 2" : "Expires Nov 2",
                });
              }}
            >
              Create secure link
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
