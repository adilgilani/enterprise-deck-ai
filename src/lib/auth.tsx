import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, session } from "@/lib/api/client";
import type { Me, Role, TokenOut } from "@/lib/api/types";

type Status = "loading" | "anonymous" | "authenticated" | "offline";

interface AuthValue {
  status: Status;
  me: Me | null;
  error: string | null;
  login: (email: string, password: string) => Promise<Me>;
  register: (body: { email: string; password: string; name: string; company_name: string; industry?: string; website?: string }) => Promise<Me>;
  acceptInvite: (body: { token: string; name: string; password: string }) => Promise<Me>;
  logout: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  refresh: () => Promise<void>;
  can: (min: Role) => boolean;
}

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  // Always start in "loading" so server and first client render match (token lives in localStorage).
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!session.token) {
      setMe(null);
      setStatus("anonymous");
      return;
    }
    try {
      const m = await api<Me>("/auth/me");
      session.orgId = m.organization.id;
      setMe(m);
      setStatus("authenticated");
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 0) {
        setError(e.message);
        setStatus("offline");
        return;
      }
      session.clear();
      setMe(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    void refresh();
    const off = session.onUnauthorized(() => {
      setMe(null);
      setStatus("anonymous");
      qc.clear();
    });
    return () => {
      off();
    };
  }, [refresh, qc]);

  const accept = useCallback(
    (t: TokenOut) => {
      session.token = t.access_token;
      session.orgId = t.me.organization.id;
      qc.clear();
      setMe(t.me);
      setStatus("authenticated");
      setError(null);
      return t.me;
    },
    [qc],
  );

  const value = useMemo<AuthValue>(
    () => ({
      status,
      me,
      error,
      refresh,
      login: async (email, password) => accept(await api<TokenOut>("/auth/login", { body: { email, password }, auth: false })),
      register: async (body) => accept(await api<TokenOut>("/auth/register", { body, auth: false })),
      acceptInvite: async (body) => accept(await api<TokenOut>("/auth/accept-invite", { body, auth: false })),
      logout: async () => {
        try {
          await api("/auth/logout", { method: "POST" });
        } catch {
          /* already invalid */
        }
        session.clear();
        qc.clear();
        setMe(null);
        setStatus("anonymous");
      },
      switchOrg: async (orgId) => {
        session.orgId = orgId;
        qc.clear();
        await refresh();
      },
      can: (min) => (me ? RANK[me.role] >= RANK[min] : false),
    }),
    [status, me, error, refresh, accept, qc],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function firstName(name: string | undefined): string {
  return (name ?? "").split(" ")[0] ?? "";
}

export function initials(name: string | undefined | null): string {
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
