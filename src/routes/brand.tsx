import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/brand")({
  head: () => ({
    meta: [
      { title: "Brand Studio — Enterprise AI" },
      { name: "description", content: "Brand Studio in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Brand Studio — Enterprise AI" },
      { property: "og:description", content: "Brand Studio in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: BrandPage,
});

function BrandPage() {
  return (
    <Page>
      <PageHeader title="Brand Studio" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
