import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth-layout";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — VYRA" }] }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => (typeof s["redirect"] === "string" ? { redirect: s["redirect"] } : {}),
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
      void navigate({ to: redirect && redirect.startsWith("/") && !redirect.startsWith("/login") ? redirect : "/" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back."
      subtitle="Sign in to your company workspace."
      footer={<>New company? <Link to="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">Create a workspace</Link></>}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Work email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">{error}</div>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Sign in</Button>
        <Button type="button" variant="outline" size="lg" className="w-full" disabled title="Configure SAML/OIDC in Settings → Security">Continue with SSO</Button>
      </form>
      {import.meta.env.DEV && (
        <button
          type="button"
          onClick={() => {
            setEmail("adil@acme.com");
            setPassword("AcmeDemo2026!");
          }}
          className="mt-6 w-full rounded-md border border-dashed px-3 py-2.5 text-left text-[12px] text-muted-foreground hover:bg-muted/40"
        >
          <span className="font-medium text-foreground">Demo workspace</span> — Acme Corporation (seeded). Click to fill <span className="font-mono">adil@acme.com</span>
          <div className="mt-0.5 font-mono text-[11px]">API: {API_URL}</div>
        </button>
      )}
    </AuthLayout>
  );
}
