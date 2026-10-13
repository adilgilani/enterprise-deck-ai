import { BrandScope } from "@/components/brand-scope";
import { SlideView } from "@/components/slide";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BrandSystem, DocTemplate } from "@/lib/brand-data";
import { buildMeetingDeck, sampleMeeting } from "@/lib/meeting-ai";

/** Which slides of the source deck each rebuilt layout comes from. */
const origin: Record<string, string> = {
  cover: "Slide 1 — title slide",
  overview: "Slide 2 — chart + highlights",
  cards: "Slides 3, 6, 20 — cards with accent bar",
  steps: "Slide 7 — numbered flow",
  table: "Slides 4, 18, 20 — banded table",
  "dark-cards": "Slide 17 — dark capability cards",
  groups: "Slide 19 — grouped lists",
  closing: "Slide 21 — closing summary",
};

export function TemplateLayoutsDialog({
  template,
  brand,
  open,
  onOpenChange,
}: {
  template: DocTemplate;
  brand: BrandSystem;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const deck = buildMeetingDeck(sampleMeeting, { brand, layout: "signature" });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            {template.sourceFile ? `Rebuilt from ${template.sourceFile}` : "Template layouts"} —
            every layout, shown with sample meeting content in {brand.name}’s logo, colours and
            typography.
          </DialogDescription>
        </DialogHeader>
        <BrandScope brand={brand}>
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            {deck.map((s, i) => (
              <figure key={s.id}>
                <div className="overflow-hidden rounded-md border shadow-card">
                  <SlideView slide={s} theme="signature" index={i} />
                </div>
                <figcaption className="mt-1.5 flex justify-between gap-2 text-[12px]">
                  <span className="font-medium">
                    {String(i + 1).padStart(2, "0")} ·{" "}
                    {s.kicker ? s.kicker.replace(/^./, (c) => c.toUpperCase()) : "Cover"}
                  </span>
                  <span className="text-muted-foreground">{origin[s.kind]}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </BrandScope>
      </DialogContent>
    </Dialog>
  );
}
