import { createFileRoute } from "@tanstack/react-router";
import { Page, PageHeader } from "@/components/app-shell";

export const Route = createFileRoute("/proposals/new")({
  head: () => ({
    meta: [
      { title: "Create a proposal — Enterprise AI" },
      { name: "description", content: "Create a proposal in Enterprise AI Presentation Infrastructure." },
      { property: "og:title", content: "Create a proposal — Enterprise AI" },
      { property: "og:description", content: "Create a proposal in Enterprise AI Presentation Infrastructure." },
    ],
  }),
  component: NewProposal,
});

function NewProposal() {
  return (
    <Page>
      <PageHeader title="Create a proposal" subtitle="This section is coming next." />
      <div className="surface p-10 text-center text-sm text-muted-foreground">Not built yet.</div>
    </Page>
  );
}
