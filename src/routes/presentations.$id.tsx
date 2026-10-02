import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/presentations/$id")({
  head: () => ({
    meta: [
      { title: "Presentation — Enterprise AI" },
      { name: "description", content: "Presentation in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Presentation — Enterprise AI" },
      { property: "og:description", content: "Presentation in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: DeckDetail,
});

function DeckDetail() {
  return (
    <Page>
      <PageHeader title="Presentation" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
