import type { CSSProperties, ReactNode } from "react";
import { useScopedBrand } from "@/components/brand-scope";
import type { Slide } from "@/lib/mock-data";
import { itemsOf, tableOf, toSignatureKind } from "@/lib/slide-model";
import { cn } from "@/lib/utils";

/*
 * The Stixor presentation template (rebuilt from WorkAI_Platform_Technical_Deck.pptx),
 * styled by the active brand: colors from --slide-a (charcoal) / --slide-c (accent) /
 * --slide-d (background), fonts from --brand-serif (headings) / --brand-sans / --brand-mono.
 * Positions are the template's own, as % of the 16:9 frame. Font sizes are pt / 9.6 → cqw.
 */

const pt = (n: number) => `${(n / 9.6).toFixed(3)}cqw`;
const HEAD: CSSProperties = { fontFamily: "var(--brand-serif)" };
const MONO: CSSProperties = { fontFamily: "var(--brand-mono, ui-monospace, monospace)" };
const GRAY = "#6B6B6E";
const LINE = "#E0E0E0";

function Box({
  x,
  y,
  w,
  h,
  children,
  className,
  style,
}: {
  x: number;
  y: number;
  w?: number;
  h?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cn("absolute", className)}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: w != null ? `${w}%` : undefined,
        height: h != null ? `${h}%` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Header({ slide, dark }: { slide: Slide; dark?: boolean }) {
  return (
    <>
      {slide.kicker && (
        <Box x={3.8} y={4.7} w={75}>
          <div
            className="font-medium uppercase text-slide-c"
            style={{ ...MONO, fontSize: pt(11), letterSpacing: "0.2em" }}
          >
            {slide.kicker}
          </div>
        </Box>
      )}
      <Box x={3.8} y={8.3} w={92.2}>
        <div
          className={cn(
            "font-bold leading-[1.1] tracking-[-0.01em]",
            dark ? "text-white" : "text-slide-a",
          )}
          style={{ ...HEAD, fontSize: pt(slide.title.length > 60 ? 24 : 28) }}
        >
          {slide.title}
        </div>
      </Box>
      {slide.lead && (
        <Box x={3.8} y={19.6} w={92.2}>
          <p
            className="leading-[1.45]"
            style={{ fontSize: pt(13), color: dark ? "#C9C9CC" : "#3A3A3C" }}
          >
            {slide.lead}
          </p>
        </Box>
      )}
    </>
  );
}

function Footer({
  slide,
  index,
  dark,
}: {
  slide: Slide;
  index?: number | undefined;
  dark?: boolean;
}) {
  const brand = useScopedBrand();
  const right = [slide.footer, brand?.name].filter(Boolean).join("  ·  ");
  return (
    <>
      <Box x={3.8} y={94.9} w={45}>
        <div
          className="uppercase"
          style={{
            ...MONO,
            fontSize: pt(9),
            letterSpacing: "0.1em",
            color: dark ? "#8E8E92" : GRAY,
          }}
        >
          {slide.kicker}
        </div>
      </Box>
      <Box x={56} y={94.9} w={40}>
        <div className="text-right" style={{ fontSize: pt(9), color: dark ? "#8E8E92" : GRAY }}>
          {right}
          {index != null && <> · {String(index + 1).padStart(2, "0")}</>}
        </div>
      </Box>
    </>
  );
}

function Cover({ slide }: { slide: Slide }) {
  const brand = useScopedBrand();
  const logo = brand?.logos?.reversed ?? brand?.logos?.primary;
  const n = slide.title.length;
  const size = n <= 18 ? 60 : n <= 34 ? 46 : 38;
  return (
    <>
      <Box x={0} y={0} w={1.4} h={100} className="bg-slide-c" />
      <Box x={4.5} y={7.3} h={5.3} className="flex items-center">
        {logo ? (
          <img src={logo} alt="" draggable={false} className="h-full w-auto" />
        ) : (
          <span
            className="font-bold uppercase text-white"
            style={{ fontSize: pt(14), letterSpacing: "0.3em" }}
          >
            {brand?.name ?? "Brand"}
          </span>
        )}
      </Box>
      <div className="absolute left-[4.5%] w-[82.5%]" style={{ bottom: "28%" }}>
        {slide.kicker && (
          <div
            className="mb-[1.2cqw] font-medium uppercase text-slide-c"
            style={{ ...MONO, fontSize: pt(13), letterSpacing: "0.3em" }}
          >
            {slide.kicker}
          </div>
        )}
        <div
          className="font-bold leading-[1.04] tracking-[-0.02em] text-white"
          style={{ ...HEAD, fontSize: pt(size) }}
        >
          {slide.title}
        </div>
        {slide.subtitle && (
          <div className="mt-[1.6cqw] italic" style={{ fontSize: pt(18), color: "#C9C9CC" }}>
            {slide.subtitle}
          </div>
        )}
      </div>
      <Box x={4.5} y={78} w={42} className="h-px bg-white/15" />
      {(slide.meta ?? []).slice(0, 3).map((m, i) => (
        <Box key={m.label} x={[4.5, 33.8, 63][i]!} y={80.7} w={27}>
          <div
            className="font-medium uppercase text-slide-c"
            style={{ ...MONO, fontSize: pt(10), letterSpacing: "0.1em" }}
          >
            {m.label}
          </div>
          <div className="mt-[0.4cqw] text-white" style={{ fontSize: pt(15) }}>
            {m.value}
          </div>
        </Box>
      ))}
    </>
  );
}

function Doughnut({
  data,
  centerLabel,
}: {
  data: { label: string; value: number }[];
  centerLabel?: string | undefined;
}) {
  const total = data.reduce((a, d) => a + d.value, 0) || 1;
  const colors = ["var(--slide-c)", "var(--slide-a)", "#D6D6D8", GRAY];
  let acc = 0;
  const C = 2 * Math.PI * 38;
  return (
    <div className="flex h-full items-center gap-[2.5cqw]">
      <svg viewBox="0 0 100 100" className="h-[80%] shrink-0 -rotate-90">
        {data.map((d, i) => {
          const len = (d.value / total) * C;
          const el = (
            <circle
              key={d.label}
              cx="50"
              cy="50"
              r="38"
              fill="none"
              stroke={colors[i % 4]}
              strokeWidth="16"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-acc}
            />
          );
          acc += len;
          return el;
        })}
        <text
          x="50"
          y="-48"
          transform="rotate(90)"
          textAnchor="middle"
          className="fill-slide-a"
          style={{ ...HEAD, fontSize: 16, fontWeight: 700 }}
        >
          {total}
        </text>
        {centerLabel && (
          <text
            x="50"
            y="-37"
            transform="rotate(90)"
            textAnchor="middle"
            fill={GRAY}
            style={{ fontSize: 6.5 }}
          >
            {centerLabel}
          </text>
        )}
      </svg>
      <ul className="space-y-[1cqw]">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-[0.8cqw]" style={{ fontSize: pt(11) }}>
            <span
              className="size-[1cqw] shrink-0 rounded-[0.15cqw]"
              style={{ background: colors[i % 4] }}
            />
            <span className="text-slide-a">{d.label}</span>
            <span className="text-slide-a/60" style={MONO}>
              {d.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Overview({ slide }: { slide: Slide }) {
  const items = itemsOf(slide).slice(0, 4);
  const data = (slide.metrics ?? []).map((m) => ({
    label: m.label,
    value: Number.parseFloat(m.value) || 0,
  }));
  const top = slide.lead ? 34 : 24;
  const gap = (90 - top) / Math.max(items.length, 1);
  return (
    <>
      <Box x={3.8} y={top + 2} w={42} h={44}>
        {data.length ? (
          <Doughnut
            data={data}
            centerLabel={
              data.every((d) => Number.isInteger(d.value)) &&
              data.reduce((a, d) => a + d.value, 0) !== 100
                ? "outcomes"
                : undefined
            }
          />
        ) : null}
      </Box>
      {slide.callout && (
        <Box x={3.8} y={83.7} w={42}>
          <p className="italic" style={{ fontSize: pt(10.5), color: GRAY }}>
            {slide.callout}
          </p>
        </Box>
      )}
      {items.map((it, i) => (
        <Box key={i} x={48} y={top + 1 + i * gap} w={48}>
          <div className="flex gap-[1.4cqw]">
            <span className="mt-[0.5cqw] size-[1.05cqw] shrink-0 bg-slide-c" />
            <div>
              {it.title && (
                <div className="font-bold text-slide-a" style={{ ...HEAD, fontSize: pt(14) }}>
                  {it.title}
                </div>
              )}
              <p className="mt-[0.4cqw] leading-[1.4]" style={{ fontSize: pt(11), color: GRAY }}>
                {it.text}
              </p>
            </div>
          </div>
        </Box>
      ))}
    </>
  );
}

function Cards({ slide }: { slide: Slide }) {
  const items = itemsOf(slide).slice(0, 6);
  const rows = items.length > 3 ? 2 : 1;
  const cols = rows === 2 ? Math.ceil(items.length / 2) : Math.max(items.length, 1);
  const top = slide.lead ? 34 : 22;
  const bottom = slide.callout ? 70 : 88;
  const gapY = 2.7;
  const h = (bottom - top - gapY * (rows - 1)) / rows;
  const w = (92.4 - 1.5 * (cols - 1)) / cols;
  return (
    <>
      {items.map((it, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <Box
            key={i}
            x={3.8 + c * (w + 1.5)}
            y={top + r * (h + gapY)}
            w={w}
            h={h}
            className="overflow-hidden border bg-white"
            style={{ borderColor: LINE }}
          >
            <div className="absolute inset-y-0 left-0 w-[0.5cqw] bg-slide-c" />
            <div className="px-[1.8cqw] py-[1.7cqw]">
              {it.value && (
                <div className="font-bold text-slide-a" style={{ ...HEAD, fontSize: pt(26) }}>
                  {it.value}
                </div>
              )}
              {it.title && (
                <div
                  className="font-bold leading-[1.2] text-slide-a"
                  style={{ ...HEAD, fontSize: pt(cols > 3 ? 13 : 15) }}
                >
                  {it.title}
                </div>
              )}
              {it.text && (
                <p
                  className="mt-[0.7cqw] leading-[1.45]"
                  style={{ fontSize: pt(cols > 3 ? 10.5 : 11.5), color: GRAY }}
                >
                  {it.text}
                </p>
              )}
            </div>
          </Box>
        );
      })}
      {slide.callout && (
        <Box
          x={3.8}
          y={74}
          w={92.4}
          h={12.7}
          className="grid place-items-center bg-slide-a px-[3cqw]"
        >
          <p
            className="text-center font-bold italic leading-[1.35] text-white"
            style={{ ...HEAD, fontSize: pt(15) }}
          >
            {slide.callout}
          </p>
        </Box>
      )}
    </>
  );
}

function Steps({ slide }: { slide: Slide }) {
  const items = itemsOf(slide).slice(0, 5);
  const top = slide.lead ? 31 : 23.3;
  const rowH = Math.min(13.6, (91 - top) / Math.max(items.length, 1));
  return (
    <>
      {items.map((it, i) => (
        <div key={i}>
          <Box
            x={3.8}
            y={top + i * rowH + 0.7}
            w={5.2}
            className="grid aspect-square place-items-center rounded-full bg-slide-a"
          >
            <span className="font-bold text-slide-c" style={{ ...HEAD, fontSize: pt(18) }}>
              {String(i + 1).padStart(2, "0")}
            </span>
          </Box>
          <Box
            x={11.2}
            y={top + i * rowH}
            w={it.title ? 24.8 : 0}
            h={rowH - 2}
            className="flex items-center"
          >
            {it.title && (
              <div
                className="font-bold leading-[1.2] text-slide-a"
                style={{ ...HEAD, fontSize: pt(15) }}
              >
                {it.title}
              </div>
            )}
          </Box>
          <Box
            x={it.title ? 37.5 : 11.2}
            y={top + i * rowH}
            w={it.title ? 58.5 : 84.8}
            h={rowH - 2}
            className="flex items-center"
          >
            <p className="leading-[1.4]" style={{ fontSize: pt(12.5), color: GRAY }}>
              {it.text}
            </p>
          </Box>
          {i < items.length - 1 && (
            <Box
              x={3.8}
              y={top + (i + 1) * rowH - 0.6}
              w={92.2}
              className="h-px"
              style={{ background: LINE }}
            />
          )}
        </div>
      ))}
    </>
  );
}

const isDate = (v: string) =>
  /^(\d{1,2} )?(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* ?\d{0,2}$|^\d{4}-\d{2}-\d{2}$|^TBC$/i.test(
    v.trim(),
  );

function Table({ slide }: { slide: Slide }) {
  const t = tableOf(slide);
  const rows = t.rows.slice(0, 7);
  const top = slide.lead ? 31 : 20.7;
  const widths =
    t.widths ?? (t.head.length === 2 ? [27, 73] : t.head.length === 3 ? [20, 40, 40] : undefined);
  const rowH = `${Math.min(4.9, ((88 - top) * 0.5625) / (rows.length + 1)).toFixed(2)}cqw`;
  return (
    <>
      <Box x={3.8} y={top} w={92.2}>
        <table className="w-full border-collapse" style={{ fontSize: pt(11.5) }}>
          <colgroup>
            {t.head.map((_, i) => (
              <col key={i} style={widths?.[i] ? { width: `${widths[i]}%` } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-slide-a text-left text-white">
              {t.head.map((h) => (
                <th
                  key={h}
                  className="border px-[1.1cqw] py-[0.6cqw] font-semibold"
                  style={{ borderColor: LINE, height: rowH }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ background: i % 2 ? "#F0F0EE" : "#FFFFFF", height: rowH }}>
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={cn(
                      "border px-[1.1cqw] py-[0.85cqw] align-middle leading-[1.35]",
                      j === 0 ? "font-bold text-slide-a" : "",
                    )}
                    style={{
                      borderColor: LINE,
                      color: j === 0 ? undefined : "#3A3A3C",
                      ...(j === 0 ? HEAD : isDate(c) ? MONO : {}),
                    }}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      {slide.bullets?.length ? (
        <Box x={3.8} y={78} w={92.2}>
          <ul className="space-y-[0.6cqw]" style={{ fontSize: pt(12), color: "#3A3A3C" }}>
            {slide.bullets.slice(0, 3).map((b) => (
              <li key={b} className="flex gap-[1cqw]">
                <span className="text-slide-c">▪</span>
                {b}
              </li>
            ))}
          </ul>
        </Box>
      ) : null}
    </>
  );
}

function DarkCards({ slide }: { slide: Slide }) {
  const items = itemsOf(slide).slice(0, 3);
  const w = (92.4 - 1.5 * (items.length - 1)) / Math.max(items.length, 1);
  return (
    <>
      {items.map((it, i) => (
        <Box
          key={i}
          x={3.8 + i * (w + 1.5)}
          y={34}
          w={w}
          h={52}
          style={{ background: "color-mix(in srgb, white 9%, var(--slide-a))" }}
        >
          <div className="h-[1.1%] min-h-[2px] bg-slide-c" />
          <div className="px-[2.2cqw] pt-[2.6cqw]">
            {it.value && (
              <div
                className="font-bold leading-none text-white"
                style={{ ...HEAD, fontSize: pt(40) }}
              >
                {it.value}
              </div>
            )}
            {it.title && (
              <div
                className={cn("font-bold leading-[1.25] text-white", it.value && "mt-[1.2cqw]")}
                style={{ ...HEAD, fontSize: pt(it.value ? 13 : 16) }}
              >
                {it.title}
              </div>
            )}
            {it.text && (
              <p
                className="mt-[1cqw] leading-[1.45]"
                style={{ fontSize: pt(11.5), color: "#D6D6D8" }}
              >
                {it.text}
              </p>
            )}
          </div>
        </Box>
      ))}
    </>
  );
}

function Groups({ slide }: { slide: Slide }) {
  const items = itemsOf(slide).slice(0, 6);
  const rows = items.length > 3 ? 2 : 1;
  const top = slide.lead ? 31 : 20.7;
  const h = rows === 2 ? (92 - top - 3.3) / 2 : 40;
  return (
    <>
      {items.map((it, i) => (
        <Box
          key={i}
          x={3.8 + (i % 3) * 31.2}
          y={top + Math.floor(i / 3) * (h + 3.3)}
          w={29.8}
          h={h}
          className="border bg-white px-[1.8cqw] py-[1.7cqw]"
          style={{ borderColor: LINE }}
        >
          <div className="font-bold text-slide-c" style={{ ...HEAD, fontSize: pt(14) }}>
            {it.title}
          </div>
          <ul
            className="mt-[0.9cqw] space-y-[0.55cqw]"
            style={{ fontSize: pt(10.5), color: "#3A3A3C" }}
          >
            {(it.text ?? "")
              .split("\n")
              .filter(Boolean)
              .map((l) => (
                <li key={l} className="leading-[1.35]">
                  {l}
                </li>
              ))}
          </ul>
        </Box>
      ))}
    </>
  );
}

function Closing({ slide }: { slide: Slide }) {
  const items = itemsOf(slide).slice(0, 6);
  return (
    <>
      <Box x={0} y={0} w={1.4} h={100} className="bg-slide-c" />
      <Box x={4.5} y={6} w={75}>
        <div
          className="font-medium uppercase text-slide-c"
          style={{ ...MONO, fontSize: pt(11), letterSpacing: "0.2em" }}
        >
          {slide.kicker ?? "Closing"}
        </div>
      </Box>
      <Box x={4.3} y={9.6} w={82.5}>
        <div className="font-bold leading-[1.1] text-white" style={{ ...HEAD, fontSize: pt(32) }}>
          {slide.title}
        </div>
      </Box>
      {items.map((it, i) => (
        <Box key={i} x={i % 2 ? 52.1 : 4.5} y={23.3 + Math.floor(i / 2) * 24} w={44.6}>
          <div className="font-bold text-slide-c" style={{ ...HEAD, fontSize: pt(14) }}>
            {it.title}
          </div>
          <p
            className="mt-[0.6cqw] leading-[1.45]"
            style={{ fontSize: pt(11.5), color: "#D6D6D8" }}
          >
            {it.text}
          </p>
        </Box>
      ))}
      {slide.callout && (
        <Box x={4.5} y={89.5} w={90.8}>
          <p className="leading-[1.4]" style={{ fontSize: pt(10.5), color: "#9C9CA0" }}>
            {slide.callout}
          </p>
        </Box>
      )}
    </>
  );
}

export function SignatureSlide({
  slide,
  index,
  className,
}: {
  slide: Slide;
  index?: number | undefined;
  className?: string | undefined;
}) {
  const kind = toSignatureKind(slide.kind);
  const dark = kind === "cover" || kind === "closing" || kind === "dark-cards";
  const s: Slide =
    kind === "cards" && slide.kind === "quote" && !slide.callout
      ? { ...slide, callout: slide.title, title: slide.subtitle ?? "" }
      : slide;
  return (
    <div
      className={cn(
        "@container relative aspect-video w-full select-none overflow-hidden text-left",
        dark ? "bg-slide-a" : "bg-slide-d",
        className,
      )}
      style={{ fontFamily: "var(--brand-sans)" }}
    >
      {kind === "cover" ? (
        <Cover slide={s} />
      ) : kind === "closing" ? (
        <Closing slide={s} />
      ) : (
        <>
          <Header slide={s} dark={dark} />
          {kind === "overview" && <Overview slide={s} />}
          {kind === "cards" && <Cards slide={s} />}
          {kind === "steps" && <Steps slide={s} />}
          {kind === "table" && <Table slide={s} />}
          {kind === "dark-cards" && <DarkCards slide={s} />}
          {kind === "groups" && <Groups slide={s} />}
          <Footer slide={s} index={index} dark={dark} />
        </>
      )}
    </div>
  );
}
