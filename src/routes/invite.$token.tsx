import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth-layout";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Join workspace — VYRA" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <AuthLayout title="You're invited." subtitle="Join your team's workspace. Your brand system and company knowledge are already set up.">
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await acceptInvite({ token, name, password });
            void navigate({ to: "/" });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="space-y-1.5"><Label>Your name</Label><Input required value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="space-y-1.5"><Label>Choose a password</Label><Input type="password" minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Join workspace</Button>
      </form>
    </AuthLayout>
  );
}
