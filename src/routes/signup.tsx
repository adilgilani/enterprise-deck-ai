import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth-layout";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "Create workspace — Enterprise AI" }] }),
  component: SignupPage,
});

function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ company_name: "", industry: "", website: "", name: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <AuthLayout
      title="Create your company workspace."
      subtitle="Define your brand once — every presentation, proposal and meeting deck will follow it."
      footer={<>Already have a workspace? <Link to="/login" className="font-medium text-foreground underline-offset-4 hover:underline">Sign in</Link></>}
    >
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          try {
            await register({ ...f, ...(f.industry ? {} : { industry: undefined }), ...(f.website ? {} : { website: undefined }) } as never);
            void navigate({ to: "/brand", search: { welcome: true } as never });
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5"><Label>Company name</Label><Input required value={f.company_name} onChange={set("company_name")} placeholder="Acme Corporation" /></div>
          <div className="space-y-1.5"><Label>Industry</Label><Input value={f.industry} onChange={set("industry")} placeholder="Financial services" /></div>
          <div className="space-y-1.5"><Label>Website</Label><Input value={f.website} onChange={set("website")} placeholder="acme.com" /></div>
        </div>
        <div className="space-y-1.5"><Label>Your name</Label><Input required value={f.name} onChange={set("name")} /></div>
        <div className="space-y-1.5"><Label>Work email</Label><Input type="email" required value={f.email} onChange={set("email")} /></div>
        <div className="space-y-1.5"><Label>Password</Label><Input type="password" minLength={10} required value={f.password} onChange={set("password")} placeholder="At least 10 characters" /></div>
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Create workspace</Button>
      </form>
    </AuthLayout>
  );
}
