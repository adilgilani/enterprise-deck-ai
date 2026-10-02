import { useState } from "react";
import { FileText, Globe, Image as ImageIcon, Presentation, Sheet } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const formats = [
  { id: "pptx", label: "PowerPoint", ext: ".pptx", icon: Presentation },
  { id: "pdf", label: "PDF", ext: ".pdf", icon: FileText },
  { id: "web", label: "Web presentation", ext: "Link", icon: Globe },
  { id: "img", label: "Images", ext: ".png", icon: ImageIcon },
  { id: "gs", label: "Google Slides", ext: "Drive", icon: Sheet },
];

export function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [fmt, setFmt] = useState("pptx");
  const [busy, setBusy] = useState(false);
  const run = () => {
    setBusy(true);
    setTimeout(() => { setBusy(false); onOpenChange(false); toast.success("Export ready", { description: `Your ${formats.find((f) => f.id === fmt)?.label} file is downloading.` }); }, 1400);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export presentation</DialogTitle>
          <DialogDescription>Brand fonts and colors are embedded automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2">
          {formats.map((f) => (
            <button key={f.id} onClick={() => setFmt(f.id)} className={cn("flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all", fmt === f.id ? "border-foreground bg-accent" : "hover:bg-muted/50")}>
              <f.icon className="size-5" />
              <span className="text-[11.5px] font-medium leading-tight">{f.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{f.ext}</span>
            </button>
          ))}
        </div>
        <div className="divide-y rounded-lg border">
          {[["Include speaker notes", true], ["Include animations", true], ["High resolution", false], ["Editable elements", true]].map(([l, d]) => (
            <label key={l as string} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
              {l}<Switch defaultChecked={d as boolean} />
            </label>
          ))}
        </div>
        <Button onClick={run} disabled={busy} className="w-full">{busy ? "Preparing export…" : "Export presentation"}</Button>
      </DialogContent>
    </Dialog>
  );
}
