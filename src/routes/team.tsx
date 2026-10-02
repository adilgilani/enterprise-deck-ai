import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — Enterprise AI" },
      { name: "description", content: "Team in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Team — Enterprise AI" },
      { property: "og:description", content: "Team in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <Page>
      <PageHeader title="Team" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
