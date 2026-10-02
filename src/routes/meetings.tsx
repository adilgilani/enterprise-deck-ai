import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/meetings")({
  head: () => ({
    meta: [
      { title: "Meetings — Enterprise AI" },
      { name: "description", content: "Meetings in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Meetings — Enterprise AI" },
      { property: "og:description", content: "Meetings in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: MeetingsPage,
});

function MeetingsPage() {
  return (
    <Page>
      <PageHeader title="Meetings" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
