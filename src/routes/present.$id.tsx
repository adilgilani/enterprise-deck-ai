import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { Presenter } from "@/components/presenter";
import { usePresentation } from "@/lib/api/hooks";
import { api } from "@/lib/api/client";
import { normalizeTheme } from "@/lib/deck/schema";

export const Route = createFileRoute("/present/$id")({
  head: () => ({ meta: [{ title: "Present — VYRA" }] }),
  validateSearch: (s: Record<string, unknown>): { start?: number } => (s["start"] != null ? { start: Number(s["start"]) || 0 } : {}),
  component: PresentPage,
});

function PresentPage() {
  const { id } = Route.useParams();
  const { start } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = usePresentation(id);
  useEffect(() => {
    void api(`/presentations/${id}/present`, { method: "POST" }).catch(() => undefined);
  }, [id]);
  if (!data) return <div className="grid min-h-screen place-items-center bg-black text-white"><Loader2 className="animate-spin" /></div>;
  return <Presenter deck={{ ...data.deck, theme: normalizeTheme(data.deck.theme) }} start={start ?? 0} onExit={() => void navigate({ to: "/editor/$id", params: { id } })} />;
}
