import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Enterprise AI" },
      { name: "description", content: "Templates in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Templates — Enterprise AI" },
      { property: "og:description", content: "Templates in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <Page>
      <PageHeader title="Templates" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
