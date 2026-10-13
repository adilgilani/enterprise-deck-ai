import { cn } from "@/lib/utils";
import { useScopedBrand } from "@/components/brand-scope";
import { SignatureSlide } from "@/components/signature-slide";
import type { SlideKind, Theme, Slide } from "@/lib/mock-data";
import { toClassic } from "@/lib/slide-model";

const themes: Record<
  Exclude<Theme, "signature">,
  { bg: string; fg: string; mute: string; accent: string; line: string; panel: string }
> = {
  ink: {
    bg: "bg-slide-a",
    fg: "text-slide-d",
    mute: "text-slide-d/60",
    accent: "bg-slide-c",
    line: "bg-slide-d/15",
    panel: "bg-slide-d/8",
  },
  light: {
    bg: "bg-card",
    fg: "text-slide-a",
    mute: "text-slide-a/55",
    accent: "bg-slide-b",
    line: "bg-slide-a/10",
    panel: "bg-slide-d",
  },
  brand: {
    bg: "bg-slide-b",
    fg: "text-slide-d",
    mute: "text-slide-d/70",
    accent: "bg-slide-c",
    line: "bg-slide-d/20",
    panel: "bg-slide-d/10",
  },
  editorial: {
    bg: "bg-slide-d",
    fg: "text-slide-a",
    mute: "text-slide-a/55",
    accent: "bg-slide-c",
    line: "bg-slide-a/12",
    panel: "bg-card",
  },
};

/**
 * Renders a realistic slide with container-query sizing so it scales from
 * thumbnail to canvas. All sizes use cqw units.
 */
export function SlideView({
  slide,
  kind,
  theme = "light",
  title,
  className,
  index,
}: {
  slide?: Slide | undefined;
  kind?: SlideKind | undefined;
  theme?: Theme | undefined;
  title?: string | undefined;
  className?: string | undefined;
  /** Slide position, shown in template footers. */
  index?: number | undefined;
}) {
  if (theme === "signature") {
    const base: Slide = slide ?? {
      id: "preview",
      kind: kind ?? "cover",
      title: title ?? "Untitled",
    };
    return (
      <SignatureSlide
        slide={title ? { ...base, title } : base}
        index={index}
        className={className}
      />
    );
  }
  return (
    <ClassicSlide
      slide={slide && toClassic(slide)}
      kind={kind}
      theme={theme}
      title={title}
      className={className}
    />
  );
}

function ClassicSlide({
  slide,
  kind,
  theme,
  title,
  className,
}: {
  slide?: Slide | undefined;
  kind?: SlideKind | undefined;
  theme: Exclude<Theme, "signature">;
  title?: string | undefined;
  className?: string | undefined;
}) {
  const t = themes[theme];
  const k = (slide?.kind ??
    (kind && toClassic({ id: "", kind, title: "" }).kind) ??
    "title") as SlideKind;
  const heading = title ?? slide?.title ?? "Untitled";
  const serif = theme === "editorial" || theme === "ink";
  const scoped = useScopedBrand();
  const wordmark = (scoped?.name.split(" ")[0] ?? "Acme").toUpperCase();
  const darkSlide = theme === "ink" || theme === "brand";
  const logo = darkSlide
    ? (scoped?.logos?.reversed ?? scoped?.logos?.primary)
    : scoped?.logos?.primary;
  return (
    <div
      className={cn(
        "@container relative aspect-video w-full overflow-hidden select-none",
        t.bg,
        t.fg,
        className,
      )}
    >
      <div className="absolute inset-0 flex flex-col p-[6cqw]">
        <div className="flex items-center justify-between">
          {logo ? (
            <img src={logo} alt="" className="h-[2.8cqw] w-auto object-contain" draggable={false} />
          ) : (
            <div className="flex items-center gap-[1cqw]">
              <div className={cn("size-[2.2cqw] rounded-[0.4cqw]", t.accent)} />
              <span className="text-[1.6cqw] font-semibold tracking-wide">{wordmark}</span>
            </div>
          )}
          <span className={cn("font-mono text-[1.3cqw]", t.mute)}>
            {k === "title" ? "2026" : "03"}
          </span>
        </div>
        <Body k={k} t={t} heading={heading} slide={slide} serif={serif} wordmark={wordmark} />
      </div>
    </div>
  );
}

function H({
  children,
  serif,
  size = "4.6cqw",
}: {
  children: React.ReactNode;
  serif: boolean;
  size?: string;
}) {
  return (
    <div
      className={cn("leading-[1.05]", serif ? "font-serif" : "font-semibold tracking-tight")}
      style={{
        fontSize: size,
        fontFamily: serif
          ? "var(--brand-serif, 'Instrument Serif', Georgia, serif)"
          : "var(--brand-sans, inherit)",
      }}
    >
      {children}
    </div>
  );
}

function Body({
  k,
  t,
  heading,
  slide,
  serif,
  wordmark,
}: {
  k: SlideKind;
  t: (typeof themes)[Exclude<Theme, "signature">];
  heading: string;
  slide?: Slide | undefined;
  serif: boolean;
  wordmark: string;
}) {
  const bullets = slide?.bullets ?? [
    "Enterprise momentum",
    "Operational efficiency",
    "Platform expansion",
    "Talent density",
  ];
  switch (k) {
    case "title":
      return (
        <div className="mt-auto max-w-[75%]">
          <div className={cn("mb-[2cqw] h-[0.4cqw] w-[8cqw]", t.accent)} />
          <H serif={serif} size="7cqw">
            {heading}
          </H>
          <p className={cn("mt-[2cqw] text-[1.9cqw]", t.mute)}>
            {slide?.subtitle ?? "Prepared for the leadership team"}
          </p>
        </div>
      );
    case "metrics": {
      const m = slide?.metrics ?? [
        { label: "ARR", value: "$48M" },
        { label: "NRR", value: "128%" },
        { label: "Margin", value: "81%" },
      ];
      return (
        <div className="mt-[5cqw] flex flex-1 flex-col">
          <H serif={serif}>{heading}</H>
          <div className="mt-auto grid grid-cols-3 gap-[2.5cqw]">
            {m.map((x) => (
              <div key={x.label} className={cn("border-t pt-[1.5cqw]", "border-current/20")}>
                <div className="font-mono text-[5.5cqw] font-medium tracking-tight">{x.value}</div>
                <div className={cn("mt-[0.5cqw] text-[1.5cqw]", t.mute)}>{x.label}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "chart": {
      const bars = [32, 41, 38, 52, 60, 71, 84];
      return (
        <div className="mt-[5cqw] flex flex-1 flex-col">
          <H serif={serif}>{heading}</H>
          <p className={cn("mt-[1cqw] text-[1.5cqw]", t.mute)}>
            {slide?.subtitle ?? "Quarterly, $M"}
          </p>
          <div className="mt-auto flex h-[45%] items-end gap-[2cqw]">
            {bars.map((b, i) => (
              <div
                key={i}
                className="flex flex-1 flex-col items-center justify-end gap-[0.8cqw] h-full"
              >
                <div
                  className={cn(
                    "w-full rounded-t-[0.3cqw]",
                    i === bars.length - 1 ? t.accent : t.line,
                  )}
                  style={{ height: `${b}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "split":
      return (
        <div className="mt-[5cqw] grid flex-1 grid-cols-2 gap-[4cqw]">
          <div className="flex flex-col">
            <H serif={serif}>{heading}</H>
            <ul className="mt-auto space-y-[1.4cqw]">
              {bullets.slice(0, 3).map((b) => (
                <li key={b} className="flex items-start gap-[1cqw] text-[1.7cqw]">
                  <span
                    className={cn("mt-[0.7cqw] size-[0.8cqw] shrink-0 rounded-full", t.accent)}
                  />
                  {b}
                </li>
              ))}
            </ul>
          </div>
          <div className={cn("relative overflow-hidden rounded-[0.8cqw]", t.panel)}>
            <div
              className={cn(
                "absolute -bottom-[20%] -right-[10%] size-[70%] rounded-full opacity-80",
                t.accent,
              )}
            />
            <div className={cn("absolute left-[12%] top-[15%] h-[0.5cqw] w-[40%]", t.line)} />
            <div className={cn("absolute left-[12%] top-[25%] h-[0.5cqw] w-[28%]", t.line)} />
          </div>
        </div>
      );
    case "timeline":
      return (
        <div className="mt-[5cqw] flex flex-1 flex-col">
          <H serif={serif}>{heading}</H>
          <div className="relative mt-auto">
            <div className={cn("absolute left-0 right-0 top-[1cqw] h-[0.25cqw]", t.line)} />
            <div className="grid grid-cols-4 gap-[2cqw]">
              {bullets.slice(0, 4).map((b, i) => (
                <div key={b}>
                  <div
                    className={cn(
                      "relative size-[2.2cqw] rounded-full",
                      i === 0 ? t.accent : t.line,
                    )}
                  />
                  <div className="mt-[1.5cqw] text-[1.6cqw] font-medium">{b.split(" — ")[0]}</div>
                  <div className={cn("text-[1.4cqw]", t.mute)}>
                    {b.split(" — ")[1] ?? "Milestone"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "quote":
      return (
        <div className="m-auto max-w-[80%] text-center">
          <div
            className="font-serif text-[5cqw] leading-[1.1]"
            style={{ fontFamily: "var(--brand-serif, 'Instrument Serif', Georgia, serif)" }}
          >
            {heading}
          </div>
          <div
            className={cn("mt-[2.5cqw] font-mono text-[1.4cqw] uppercase tracking-widest", t.mute)}
          >
            {slide?.subtitle ?? "Customer"}
          </div>
        </div>
      );
    case "grid":
      return (
        <div className="mt-[5cqw] flex flex-1 flex-col">
          <H serif={serif}>{heading}</H>
          <div className="mt-auto grid grid-cols-4 gap-[1.6cqw]">
            {bullets.slice(0, 4).map((b, i) => (
              <div key={b} className={cn("rounded-[0.6cqw] p-[1.6cqw]", t.panel)}>
                <div className="font-mono text-[1.3cqw] opacity-60">0{i + 1}</div>
                <div className="mt-[4cqw] text-[1.8cqw] font-medium">{b}</div>
              </div>
            ))}
          </div>
        </div>
      );
    case "agenda":
      return (
        <div className="mt-[5cqw] grid flex-1 grid-cols-[1fr_1.4fr] gap-[4cqw]">
          <H serif={serif} size="6cqw">
            {heading}
          </H>
          <ol className="space-y-[1.2cqw] self-end">
            {bullets.slice(0, 5).map((b, i) => (
              <li
                key={b}
                className={cn(
                  "flex items-baseline gap-[2cqw] border-b pb-[1cqw] text-[1.8cqw]",
                  "border-current/15",
                )}
              >
                <span className={cn("font-mono text-[1.3cqw]", t.mute)}>0{i + 1}</span>
                {b}
              </li>
            ))}
          </ol>
        </div>
      );
    case "comparison":
      return (
        <div className="mt-[5cqw] flex flex-1 flex-col">
          <H serif={serif}>{heading}</H>
          <div className="mt-auto grid grid-cols-2 gap-[2cqw]">
            {[wordmark.charAt(0) + wordmark.slice(1).toLowerCase(), "Others"].map((col, ci) => (
              <div key={col} className={cn("rounded-[0.6cqw] p-[1.8cqw]", ci === 0 ? t.panel : "")}>
                <div className="text-[1.6cqw] font-semibold">{col}</div>
                {bullets.slice(0, 3).map((b) => (
                  <div
                    key={b}
                    className={cn(
                      "mt-[1cqw] flex items-center gap-[1cqw] text-[1.5cqw]",
                      ci === 1 && t.mute,
                    )}
                  >
                    <span
                      className={cn("size-[1cqw] rounded-full", ci === 0 ? t.accent : t.line)}
                    />
                    {b}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    case "list": {
      const rows = (
        slide?.bullets ?? [
          "Sara — Launch runbook",
          "Omar — Support enablement",
          "Priya — Pricing page",
        ]
      ).slice(0, 5);
      return (
        <div className="mt-[5cqw] flex flex-1 flex-col">
          <H serif={serif}>{heading}</H>
          <div className="mt-auto">
            {rows.map((r, i) => {
              const [left, right] = r.split(" — ");
              return (
                <div
                  key={`${i}-${r}`}
                  className="grid grid-cols-[28%_1fr] gap-[2cqw] border-b border-current/15 py-[1.1cqw] text-[1.6cqw]"
                >
                  <span className="font-medium">{left}</span>
                  <span className={t.mute}>{right ?? ""}</span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
