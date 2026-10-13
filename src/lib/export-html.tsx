// Client-side export of generated content to a standalone, branded HTML file.
// Slides and pages are rendered with the same React components as the app and the app's
// stylesheet is inlined, so the file matches the editor exactly (logo, palette, fonts, layouts).
// "Web presentation" downloads this file; "PDF" opens it for the browser's Save-as-PDF.
// PPTX / Google Slides need a server-side export service (not wired yet).
import { renderToStaticMarkup } from "react-dom/server";
import { BrandScope } from "@/components/brand-scope";
import { DocPage } from "@/components/doc-page";
import { SlideView } from "@/components/slide";
import type { BrandSystem, TemplateType } from "@/lib/brand-data";
import type { GeneratedItem } from "@/lib/generated-data";
import type { Slide, Theme } from "@/lib/mock-data";

export type ExportContent =
  | { kind: "deck"; title: string; slides: Slide[]; theme: Theme; brand: BrandSystem }
  | {
      kind: "doc";
      title: string;
      client: string;
      sections: string[];
      type: TemplateType;
      brand: BrandSystem;
    };

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

/** Every stylesheet the app uses: same-origin rules inlined, cross-origin (fonts) kept as @import. */
function collectCss() {
  const imports: string[] = [];
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      rules.push(Array.from(sheet.cssRules, (r) => r.cssText).join("\n"));
    } catch {
      if (sheet.href) imports.push(`@import url("${sheet.href}");`);
    }
  }
  return [...imports, ...rules].join("\n");
}

export function contentToHtml(c: ExportContent) {
  const deck = c.kind === "deck";
  const body = renderToStaticMarkup(
    <BrandScope brand={c.brand}>
      {deck
        ? c.slides.map((s, i) => (
            <section key={s.id} className="export-page">
              <SlideView slide={s} theme={c.theme} index={i} />
            </section>
          ))
        : c.sections.map((s, i) => (
            <section key={`${i}-${s}`} className="export-page">
              <DocPage type={c.type} title={c.title} section={s} client={c.client} page={i + 1} />
            </section>
          ))}
    </BrandScope>,
  );
  const page = deck
    ? `.export-page{width:min(1280px,100vw - 32px);margin:24px auto;box-shadow:0 10px 30px rgba(0,0,0,.25)}
       @page{size:13.333in 7.5in;margin:0}
       @media print{body{background:#fff}.export-page{width:13.333in;margin:0;box-shadow:none;break-after:page}}`
    : `.export-page{width:min(794px,100vw - 32px);margin:24px auto;box-shadow:0 10px 30px rgba(0,0,0,.18)}
       @page{size:A4;margin:0}
       @media print{body{background:#fff}.export-page{width:210mm;margin:0;box-shadow:none;break-after:page}}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(c.title)} — ${esc(c.brand.name)}</title>
<style>${collectCss()}
body{margin:0;background:${deck ? "#1a1a1a" : "#e9e9e7"};-webkit-print-color-adjust:exact;print-color-adjust:exact}
${page}</style></head>
<body>${body}</body></html>`;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "export";

export function downloadHtml(c: ExportContent) {
  const blob = new Blob([contentToHtml(c)], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug(c.title)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Opens the export in a new tab and triggers the print dialog (Save as PDF). Returns false if blocked. */
export function printAsPdf(c: ExportContent) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.open();
  w.document.write(contentToHtml(c));
  w.document.close();
  // Wait for fonts so the PDF uses the brand typefaces.
  const go = () => void w.document.fonts.ready.then(() => setTimeout(() => w.print(), 200));
  if (w.document.readyState === "complete") go();
  else w.addEventListener("load", go);
  return true;
}

export function toExportContent(g: GeneratedItem, brand: BrandSystem): ExportContent {
  return g.slides
    ? { kind: "deck", title: g.name, slides: g.slides, theme: g.theme, brand }
    : {
        kind: "doc",
        title: g.name,
        client: g.doc?.client ?? "",
        sections: g.doc?.sections ?? [],
        type: g.doc?.type ?? "Proposal",
        brand,
      };
}
