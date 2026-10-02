import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "AI Library — Enterprise AI" },
      { name: "description", content: "AI Library in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "AI Library — Enterprise AI" },
      { property: "og:description", content: "AI Library in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: LibraryPage,
});

function LibraryPage() {
  return (
    <Page>
      <PageHeader title="AI Library" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
