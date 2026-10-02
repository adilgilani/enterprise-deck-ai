import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { usePresentation } from "@/lib/api/hooks";

export const Route = createFileRoute("/presentations/$id")({
  head: () => ({ meta: [{ title: "Presentation — Enterprise AI" }] }),
  component: DeckDetail,
});

/** Presentation permalink → opens the editor (or waits while it is still generating). */
function DeckDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { data, refetch } = usePresentation(id);
  useEffect(() => {
    if (!data) return;
    if (data.status === "generating") {
      const t = setTimeout(() => void refetch(), 1500);
      return () => clearTimeout(t);
    }
    void navigate({ to: "/editor/$id", params: { id }, replace: true });
    return undefined;
  }, [data, id, navigate, refetch]);
  return <div className="grid min-h-[60vh] place-items-center text-sm text-muted-foreground"><Loader2 className="animate-spin" /></div>;
}
