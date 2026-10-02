import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/presentations/new")({
  head: () => ({
    meta: [
      { title: "Create presentation — Enterprise AI" },
      { name: "description", content: "Create presentation in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Create presentation — Enterprise AI" },
      { property: "og:description", content: "Create presentation in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: NewPresentation,
});

function NewPresentation() {
  return (
    <Page>
      <PageHeader title="Create presentation" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
