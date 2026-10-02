import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({
    meta: [
      { title: "Editor — Enterprise AI" },
      { name: "description", content: "Editor in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Editor — Enterprise AI" },
      { property: "og:description", content: "Editor in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: EditorPage,
});

function EditorPage() {
  return (
    <Page>
      <PageHeader title="Editor" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
