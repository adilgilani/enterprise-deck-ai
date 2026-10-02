import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { FileText, Globe, Presentation } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { runExport } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";

const formats = [
  { id: "pptx", label: "PowerPoint", ext: ".pptx · editable", icon: Presentation },
  { id: "pdf", label: "PDF", ext: ".pdf · vector", icon: FileText },
  { id: "web", label: "Web presentation", ext: "Present / link", icon: Globe },
] as const;

/** Real export: queues a backend job (python-pptx / reportlab), polls it, then downloads the file. */
export function ExportDialog({ open, onOpenChange, presentationId, title, beforeExport }: { open: boolean; onOpenChange: (o: boolean) => void; presentationId?: string; title?: string; beforeExport?: (() => Promise<void>) | undefined }) {
  const [fmt, setFmt] = useState<(typeof formats)[number]["id"]>("pptx");
  const [notes, setNotes] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const navigate = useNavigate();

  const run = async () => {
    if (!presentationId) return;
    if (fmt === "web") {
      onOpenChange(false);
      void navigate({ to: "/present/$id", params: { id: presentationId } });
      return;
    }
    try {
      setBusy("Saving…");
      await beforeExport?.();
      setBusy("Queued…");
      await runExport(`/presentations/${presentationId}/export`, { format: fmt, include_notes: notes }, `${title ?? "presentation"}.${fmt}`, (j) => setBusy(j.step ?? "Rendering…"));
      toast.success("Export ready", { description: `${title ?? "Presentation"}.${fmt} downloaded` });
      onOpenChange(false);
    } catch (e) {
      toast.error("Export failed", { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Export presentation</DialogTitle>
          <DialogDescription>Brand fonts and colors are applied automatically. PowerPoint output uses native, editable text, charts and tables.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {formats.map((f) => (
            <button key={f.id} onClick={() => setFmt(f.id)} className={cn("flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all", fmt === f.id ? "border-foreground bg-accent" : "hover:bg-muted/50")}>
              <f.icon className="size-5" />
              <span className="text-[12px] font-medium leading-tight">{f.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{f.ext}</span>
            </button>
          ))}
        </div>
        {fmt === "pptx" && (
          <div className="divide-y rounded-lg border text-[13px]">
            <label className="flex items-center justify-between px-3.5 py-2.5">Include speaker notes<Switch checked={notes} onCheckedChange={setNotes} /></label>
            <div className="flex items-center justify-between px-3.5 py-2.5 text-muted-foreground">Slide transitions mapped to PowerPoint<span className="text-[12px]">fade · dissolve · push</span></div>
          </div>
        )}
        <Button onClick={() => void run()} disabled={!!busy || !presentationId} className="w-full">{busy ?? (fmt === "web" ? "Open web presentation" : "Export presentation")}</Button>
      </DialogContent>
    </Dialog>
  );
}
