import { cn } from "@/lib/utils";
import { useScopedBrand } from "@/components/brand-scope";
import type { TemplateType } from "@/lib/brand-data";

const copy: Record<string, string[]> = {
  "Executive Summary": [
    "We propose a phased, three-year programme that modernises core platforms while protecting day-to-day operations.",
    "The programme targets a 28% reduction in cost-to-serve and a measurable uplift in customer satisfaction within the first 12 months.",
  ],
  "Client Understanding": [
    "Your teams operate across 40+ legacy systems, slowing product launches and increasing operational risk.",
    "Leadership has prioritised digital transformation, cost reduction and a consistently excellent customer experience.",
  ],
  default: [
    "Our approach combines proven delivery methods with AI-native tooling, ensuring predictable outcomes and full transparency at every stage.",
    "Each workstream is owned by a senior lead, reviewed fortnightly with your steering committee, and measured against agreed KPIs.",
  ],
};

/**
 * A4 document page rendered from a template's structure: header, footer,
 * typography and colors come from the surrounding BrandScope.
 */
export function DocPage({
  type,
  title,
  section = "Cover",
  client = "ABC Bank",
  page = 1,
  className,
}: {
  type: TemplateType;
  title: string;
  section?: string | undefined;
  client?: string | undefined;
  page?: number;
  className?: string | undefined;
}) {
  const brand = useScopedBrand();
  const name = brand?.name ?? "Acme Corporation";
  const site = brand?.website ?? "acme.com";
  const paras = copy[section] ?? copy["default"]!;
  const serif = { fontFamily: "var(--brand-serif, 'Instrument Serif', Georgia, serif)" };
  const sans = { fontFamily: "var(--brand-sans, inherit)" };
  const Mark = ({ dark = false }: { dark?: boolean }) => {
    const src = dark ? (brand?.logos?.reversed ?? brand?.logos?.primary) : brand?.logos?.primary;
    if (src)
      return (
        <img
          src={src}
          alt=""
          className="h-[4.6cqw] w-auto max-w-full object-contain object-left"
          draggable={false}
        />
      );
    return (
      <span className="grid size-[5cqw] place-items-center rounded-[0.8cqw] bg-slide-b text-[2cqw] font-semibold text-white">
        {brand?.initials ?? "AC"}
      </span>
    );
  };
  const Lines = ({ n = 3 }: { n?: number }) => (
    <div className="space-y-[1.4cqw]">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="h-[0.9cqw] rounded-full bg-slide-a/10"
          style={{ width: `${92 - ((i * 17) % 30)}%` }}
        />
      ))}
    </div>
  );

  const mono = { fontFamily: "var(--brand-mono, ui-monospace, monospace)" };
  const hexes = brand?.guidelines?.imagery.some((r) => /hexagon/i.test(r));
  const letterhead = (
    <div className="text-center">
      <div className="flex justify-center [&_img]:h-[5.2cqw] [&_img]:object-center">
        <Mark />
      </div>
      <div className="mt-[1.4cqw] text-[1.45cqw] text-slide-a/55">
        {name} · {site} · Islamabad, Pakistan
      </div>
      <div className="mt-[2.2cqw] h-px bg-slide-c/70" />
    </div>
  );
  const header =
    type === "Letterhead" ? (
      letterhead
    ) : (
      <div className="flex items-center justify-between border-b border-slide-a/10 pb-[2.5cqw]">
        <div className="flex items-center gap-[1.6cqw]">
          <Mark />
          {!brand?.logos?.primary && <span className="text-[2.4cqw] font-semibold">{name}</span>}
        </div>
        <span className="text-[1.7cqw] text-slide-a/50" style={mono}>
          {title}
        </span>
      </div>
    );
  const footer = (
    <div className="mt-auto flex items-center justify-between border-t border-slide-a/10 pt-[2cqw] text-[1.6cqw] text-slide-a/50">
      <span style={type === "Letterhead" ? mono : undefined}>
        {type === "Letterhead"
          ? `www.${site}   ·   info@${site}   ·   +92 51 874 0326`
          : `Confidential · Prepared for ${client}`}
      </span>
      <span className="font-mono">{String(page).padStart(2, "0")}</span>
    </div>
  );

  return (
    <div
      className={cn(
        "@container relative aspect-[1/1.414] w-full overflow-hidden bg-white text-left text-slide-a select-none",
        className,
      )}
      style={sans}
    >
      {type === "Letterhead" && hexes && <HexPattern />}
      {type === "Proposal" && section === "Cover" ? (
        <div className="absolute inset-0 flex">
          <div className="w-[34%] bg-slide-a p-[6cqw] text-slide-d [&_img]:max-w-full">
            <Mark dark />
            <div className="mt-[70%] h-[0.6cqw] w-[10cqw] bg-slide-c" />
          </div>
          <div className="flex flex-1 flex-col p-[7cqw]">
            <span className="font-mono text-[1.8cqw] uppercase tracking-widest text-slide-a/50">
              Proposal
            </span>
            <div className="mt-[12cqw] text-[7cqw] leading-[1.05]" style={serif}>
              {title}
            </div>
            <div className="mt-[3cqw] text-[2.4cqw] text-slide-a/60">Prepared for {client}</div>
            <div className="mt-auto space-y-[0.6cqw] text-[1.8cqw] text-slide-a/60">
              <div className="font-semibold text-slide-a">{name}</div>
              <div>October 2026</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col p-[7cqw]">
          {header}
          {type === "Letterhead" ? (
            <div className="mt-[6cqw] space-y-[3cqw] text-[2.1cqw] leading-[1.6]">
              <div className="text-right text-slide-a/60">2 October 2026</div>
              <div>
                <div className="font-semibold">{client}</div>
                <div className="text-slide-a/60">Attn. Office of the CTO</div>
              </div>
              <div className="font-semibold">Re: {title}</div>
              {paras.map((p) => (
                <p key={p}>{p}</p>
              ))}
              <Lines n={4} />
              <div className="pt-[2cqw]">
                <div>Kind regards,</div>
                <div className="mt-[4cqw] text-[3.4cqw]" style={serif}>
                  Fawaz Ahmed
                </div>
                <div className="text-slide-a/60">{name}</div>
              </div>
            </div>
          ) : (
            <div className="mt-[6cqw] space-y-[3cqw]">
              <div className="font-mono text-[1.8cqw] text-slide-b">
                {type === "Business Document"
                  ? "DOCUMENT"
                  : `SECTION ${String(page).padStart(2, "0")}`}
              </div>
              <div className="text-[5.4cqw] leading-[1.1]" style={serif}>
                {section}
              </div>
              <div className="h-[0.5cqw] w-[10cqw] bg-slide-c" />
              {paras.map((p) => (
                <p key={p} className="text-[2.1cqw] leading-[1.6]">
                  {p}
                </p>
              ))}
              <div className="grid grid-cols-3 gap-[2cqw] pt-[1cqw]">
                {[
                  ["28%", "Lower cost-to-serve"],
                  ["36 mo", "Programme"],
                  ["+22", "NPS uplift"],
                ].map(([v, l]) => (
                  <div key={l} className="rounded-[0.8cqw] bg-slide-d p-[2cqw]">
                    <div className="font-mono text-[3.6cqw] text-slide-b">{v}</div>
                    <div className="text-[1.6cqw] text-slide-a/60">{l}</div>
                  </div>
                ))}
              </div>
              <Lines n={5} />
            </div>
          )}
          {footer}
        </div>
      )}
    </div>
  );
}

/** Outline hexagon graphic element (used when the brand's guidelines call for it). */
function HexPattern() {
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  const cells: [number, number][] = [
    [70, 40],
    [100, 57],
    [70, 74],
    [100, 91],
    [40, 91],
    [130, 74],
    [130, 40],
    [100, 23],
  ];
  return (
    <svg
      viewBox="0 0 160 120"
      className="pointer-events-none absolute -bottom-[2%] -right-[4%] w-[42%] opacity-40"
      aria-hidden
    >
      {cells.map(([x, y], i) => (
        <polygon
          key={i}
          points={hex(x, y, 17)}
          fill="none"
          stroke="var(--slide-c)"
          strokeWidth="0.8"
        />
      ))}
      <circle cx="85" cy="49" r="2.6" fill="var(--slide-c)" />
      <circle cx="55" cy="82" r="2" fill="var(--slide-c)" />
    </svg>
  );
}
