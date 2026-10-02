import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/presentations/")({
  head: () => ({
    meta: [
      { title: "Presentations — Enterprise AI" },
      { name: "description", content: "Presentations in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Presentations — Enterprise AI" },
      { property: "og:description", content: "Presentations in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: PresentationsPage,
});

function PresentationsPage() {
  return (
    <Page>
      <PageHeader title="Presentations" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
