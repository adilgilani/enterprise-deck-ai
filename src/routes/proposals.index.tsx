import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/proposals/")({
  head: () => ({
    meta: [
      { title: "Proposals — Enterprise AI" },
      { name: "description", content: "Proposals in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Proposals — Enterprise AI" },
      { property: "og:description", content: "Proposals in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: ProposalsPage,
});

function ProposalsPage() {
  return (
    <Page>
      <PageHeader title="Proposals" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
