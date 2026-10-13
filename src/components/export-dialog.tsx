import { useState } from "react";
import { FileText, Globe, Image as ImageIcon, Presentation, Sheet } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { downloadHtml, printAsPdf, type ExportContent } from "@/lib/export-html";
import { cn } from "@/lib/utils";

const formats = [
  { id: "pptx", label: "PowerPoint", ext: ".pptx", icon: Presentation },
  { id: "pdf", label: "PDF", ext: ".pdf", icon: FileText },
  { id: "web", label: "Web presentation", ext: ".html", icon: Globe },
  { id: "img", label: "Images", ext: ".png", icon: ImageIcon },
  { id: "gs", label: "Google Slides", ext: "Drive", icon: Sheet },
];

/**
 * With `content`, "Web presentation" downloads a real branded .html file and "PDF"
 * opens it for Save-as-PDF. Other formats await the server-side export service.
 */
export function ExportDialog({
  open,
  onOpenChange,
  content,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  content?: ExportContent | undefined;
}) {
  const [fmt, setFmt] = useState(content ? "web" : "pptx");
  const [busy, setBusy] = useState(false);
  const label = formats.find((f) => f.id === fmt)?.label;
  const run = () => {
    if (content && fmt === "web") {
      downloadHtml(content);
      onOpenChange(false);
      toast.success("Downloaded", { description: `${content.title}.html — opens in any browser.` });
      return;
    }
    if (content && fmt === "pdf") {
      const ok = printAsPdf(content);
      onOpenChange(false);
      if (ok)
        toast.success("Ready to save as PDF", {
          description: "Choose “Save as PDF” in the print dialog.",
        });
      else
        toast.error("Pop-up blocked", {
          description: "Allow pop-ups for this site to export PDF.",
        });
      return;
    }
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      onOpenChange(false);
      toast.success("Export queued", {
        description: `${label} export is prepared by the export service and appears in your downloads.`,
      });
    }, 1400);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {content?.kind === "doc" ? "Export document" : "Export presentation"}
          </DialogTitle>
          <DialogDescription>
            Brand logo, fonts and colors are embedded automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => setFmt(f.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all",
                fmt === f.id ? "border-foreground bg-accent" : "hover:bg-muted/50",
              )}
            >
              <f.icon className="size-5" />
              <span className="text-[11.5px] font-medium leading-tight">{f.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{f.ext}</span>
            </button>
          ))}
        </div>
        <div className="divide-y rounded-lg border">
          {[
            ["Include speaker notes", true],
            ["Include animations", true],
            ["High resolution", false],
            ["Editable elements", true],
          ].map(([l, d]) => (
            <label
              key={l as string}
              className="flex items-center justify-between px-3.5 py-2.5 text-[13px]"
            >
              {l}
              <Switch defaultChecked={d as boolean} />
            </label>
          ))}
        </div>
        <Button onClick={run} disabled={busy} className="w-full">
          {busy
            ? "Preparing export…"
            : content && (fmt === "web" || fmt === "pdf")
              ? `Download ${label}`
              : "Export presentation"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
