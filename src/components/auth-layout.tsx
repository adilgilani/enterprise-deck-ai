import type { ReactNode } from "react";
import { Logo } from "@/components/app-shell";
import { SlideRenderer } from "@/components/slide";
import type { Slide } from "@/lib/deck/schema";

const showcase: Slide = {
  id: "showcase",
  layout: "metrics",
  eyebrow: "Q3 Board Review",
  title: "A record quarter, on brand by default",
  elements: [
    { type: "metric", value: "$48M", label: "ARR", delta: "+38%", trend: "up", animation: { type: "scale" } },
    { type: "metric", value: "128%", label: "Net retention", animation: { type: "scale", delay_ms: 120 } },
    { type: "metric", value: "81%", label: "Gross margin", animation: { type: "scale", delay_ms: 240 } },
  ],
};

export function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-8 py-8 sm:px-14">
        <Logo />
        <div className="mx-auto my-auto w-full max-w-sm animate-rise py-12">
          <h1 className="font-serif text-[40px] leading-[1.05] tracking-tight">{title}</h1>
          <p className="mt-3 text-[14.5px] text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-[13px] text-muted-foreground">{footer}</div>}
        </div>
        <div className="text-[11.5px] text-muted-foreground">Enterprise AI Presentation Infrastructure · SOC 2-ready architecture</div>
      </div>
      <div className="relative hidden overflow-hidden border-l bg-gradient-hero lg:block">
        <div className="absolute inset-0 flex flex-col justify-center px-16">
          <div className="eyebrow">Define your brand once</div>
          <h2 className="mt-3 max-w-md font-serif text-[44px] leading-[1.05]">Presentations, proposals and meetings that look like your company.</h2>
          <div className="mt-10 w-full max-w-xl overflow-hidden rounded-xl border shadow-slide">
            <SlideRenderer slide={showcase} index={2} total={18} animate />
          </div>
          <div className="mt-6 flex gap-2 text-[12px] text-muted-foreground">
            {["Brand-locked AI", "Meeting intelligence", "Editable PPTX", "Private AI"].map((t) => (
              <span key={t} className="rounded-full border bg-card px-2.5 py-1">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
