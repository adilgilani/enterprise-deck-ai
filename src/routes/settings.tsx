import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Enterprise AI" },
      { name: "description", content: "Settings in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Settings — Enterprise AI" },
      { property: "og:description", content: "Settings in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <Page>
      <PageHeader title="Settings" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
