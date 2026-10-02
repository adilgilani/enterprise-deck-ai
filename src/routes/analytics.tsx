import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — Enterprise AI" },
      { name: "description", content: "Analytics in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Analytics — Enterprise AI" },
      { property: "og:description", content: "Analytics in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <Page>
      <PageHeader title="Analytics" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
