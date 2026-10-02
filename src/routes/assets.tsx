import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/assets")({
  head: () => ({
    meta: [
      { title: "Assets — Enterprise AI" },
      { name: "description", content: "Assets in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Assets — Enterprise AI" },
      { property: "og:description", content: "Assets in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: AssetsPage,
});

function AssetsPage() {
  return (
    <Page>
      <PageHeader title="Assets" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
