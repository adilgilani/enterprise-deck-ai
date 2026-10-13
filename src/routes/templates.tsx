import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Page, PageHeader } from "@/components/app-shell";
import { Chip, StatusPill } from "@/components/shared";
import { SlideView } from "@/components/slide";
import { Button } from "@/components/ui/button";
import { templateCategories, templates } from "@/lib/mock-data";
import { toast } from "sonner";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Templates — Enterprise AI" },
      { name: "description", content: "Professionally designed, brand-approved templates." },
    ],
  }),
  component: Templates,
});

function Templates() {
  const [cat, setCat] = useState("All");
  const navigate = useNavigate();
  const list = templates.filter((t) => cat === "All" || t.category === cat);
  return (
    <Page>
      <PageHeader
        title="Templates"
        subtitle="Professionally designed layouts, governed by your brand system."
        actions={
          <Button
            variant="outline"
            onClick={() => toast("Import template", { description: "Drop a .pptx or .potx file." })}
          >
            Import template
          </Button>
        }
      />
      <div className="mb-8 flex flex-wrap gap-2">
        {templateCategories.map((c) => (
          <Chip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </Chip>
        ))}
      </div>
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((t) => (
          <div key={t.id} className="group">
            <div className="relative overflow-hidden rounded-lg border shadow-card transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lift">
              <SlideView kind={t.kind} theme={t.theme} title={t.name} />
              <div className="absolute inset-0 grid place-items-center bg-ink/50 opacity-0 backdrop-blur-[1px] transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <Button
                  size="sm"
                  disabled={t.status === "Restricted"}
                  onClick={() => {
                    toast.success("Template applied");
                    navigate({ to: "/presentations/new" });
                  }}
                >
                  {t.status === "Restricted" ? "Restricted" : "Use template"}
                </Button>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                <div className="text-[14px] font-medium">{t.name}</div>
                <div className="text-[12px] text-muted-foreground">
                  {t.category} · used {t.uses} times
                </div>
              </div>
              <StatusPill status={t.status} />
            </div>
          </div>
        ))}
      </div>
    </Page>
  );
}
