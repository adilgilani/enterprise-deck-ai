import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initials, team as seed } from "@/lib/mock-data";

export const Route = createFileRoute("/team")({
  head: () => ({ meta: [{ title: "Team — Enterprise AI" }] }),
  component: Team,
});

const roles = ["Owner", "Admin", "Brand manager", "Editor", "Viewer"];

function Team() {
  const [members, setMembers] = useState(seed);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  return (
    <Page>
      <PageHeader
        title="Team"
        subtitle="Members, roles and permissions across your workspace."
        actions={
          <Button onClick={() => setOpen(true)}>
            <UserPlus />
            Invite member
          </Button>
        }
      />
      <div className="surface overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b bg-muted/40 text-left text-muted-foreground">
            <tr>
              {["Member", "Department", "Role", "Last active"].map((h) => (
                <th key={h} className="px-4 py-2.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {members.map((m) => (
              <tr key={m.email} className="hover:bg-muted/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-[11px] font-semibold">
                      {initials(m.name)}
                    </span>
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-muted-foreground">{m.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{m.dept}</td>
                <td className="px-4 py-3">
                  <Select
                    value={m.role}
                    disabled={m.role === "Owner"}
                    onValueChange={(v) => {
                      setMembers((c) =>
                        c.map((x) => (x.email === m.email ? { ...x, role: v } : x)),
                      );
                      toast.success(`${m.name} is now ${v}`);
                    }}
                  >
                    <SelectTrigger className="h-8 w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.active}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Invite member</DialogTitle>
            <DialogDescription>They’ll join with Acme’s brand permissions.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setMembers((c) => [
                ...c,
                {
                  name: email
                    .split("@")[0]!
                    .replace(/\./g, " ")
                    .replace(/\b\w/g, (x) => x.toUpperCase()),
                  email,
                  role: "Viewer",
                  dept: "—",
                  active: "Invited",
                },
              ]);
              setOpen(false);
              setEmail("");
              toast.success("Invitation sent");
            }}
          >
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@acme.com"
            />
            <Button type="submit" className="w-full">
              Send invite
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
