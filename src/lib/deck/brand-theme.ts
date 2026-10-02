import type { Brand } from "@/lib/api/types";
import type { Theme } from "@/lib/deck/schema";

/** Brand System → slide Theme (the same mapping the backend applies when generating). */
export function brandToTheme(b: Brand): Theme {
  const p: Record<string, string> = {};
  for (const c of b.colors) if (c.role !== "extra") p[c.role] = c.hex;
  return {
    style: (b.default_style as Theme["style"]) ?? "executive",
    palette: {
      primary: p["primary"] ?? "#2F5BD3",
      secondary: p["secondary"] ?? "#1B2A4A",
      accent: p["accent"] ?? "#E3B866",
      background: p["background"] ?? "#FFFFFF",
      surface: p["surface"] ?? "#F6F4EF",
      text: p["text"] ?? "#1C1D21",
      muted: p["muted"] ?? "#6B6F7A",
    },
    fonts: { heading: b.fonts.heading ?? "Instrument Serif", body: b.fonts.body ?? "Geist", mono: b.fonts.mono ?? "Geist Mono" },
    logo_text: (b.company_profile.short_name || b.company_profile.name || b.name || "ACME").split(" ")[0]?.toUpperCase() ?? "ACME",
  };
}
