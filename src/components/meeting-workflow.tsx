import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const meetingWorkflow = [
  "Record",
  "Transcribe",
  "Extract insights",
  "Select template",
  "Generate",
  "Review & edit",
  "Export",
];

/** Record → Transcribe → Extract → Select template → Generate → Review & edit → Export */
export function MeetingWorkflow({
  current,
  className,
  steps = meetingWorkflow,
}: {
  current: number;
  className?: string;
  steps?: string[];
}) {
  return (
    <ol
      className={cn("flex flex-wrap items-center gap-y-2 text-[12px]", className)}
      aria-label="Meeting workflow"
    >
      {steps.map((s, i) => (
        <li key={s} className="flex items-center" aria-current={i === current ? "step" : undefined}>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors",
              i === current
                ? "bg-foreground text-background"
                : i < current
                  ? "text-foreground"
                  : "text-subtle",
            )}
          >
            <span
              className={cn(
                "grid size-4 place-items-center rounded-full border text-[9px]",
                i < current
                  ? "border-success bg-success text-white"
                  : i === current
                    ? "border-background/40"
                    : "border-current",
              )}
            >
              {i < current ? <Check className="size-2.5" /> : i + 1}
            </span>
            {s}
          </span>
          {i < steps.length - 1 && (
            <span className={cn("mx-1 h-px w-4", i < current ? "bg-foreground/40" : "bg-border")} />
          )}
        </li>
      ))}
    </ol>
  );
}
