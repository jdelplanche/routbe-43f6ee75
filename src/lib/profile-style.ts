/**
 * Extra presentation preferences for the public link hub.
 *
 * These live inside the existing `profiles.business_info` JSON column under a
 * `style` key, so no schema migration is needed and the preferences are shared
 * across devices (they used to be localStorage-only and never rendered).
 */

export const TYPOGRAPHY_OPTIONS = [
  { id: "sans", label: "Modern (Sans)" },
  { id: "serif", label: "Classic (Serif)" },
  { id: "mono", label: "Technical (Mono)" },
] as const;

export const BACKGROUND_OPTIONS = [
  { id: "solid", label: "Solid" },
  { id: "grid", label: "Subtle grid" },
  { id: "gradient", label: "Soft gradient" },
] as const;

export type TypographyId = (typeof TYPOGRAPHY_OPTIONS)[number]["id"];
export type BackgroundId = (typeof BACKGROUND_OPTIONS)[number]["id"];

export interface ProfileStyle {
  typography: TypographyId;
  background: BackgroundId;
}

export const DEFAULT_PROFILE_STYLE: ProfileStyle = { typography: "sans", background: "solid" };

/** Reads the style object out of a `business_info` JSON value. Never throws. */
export function profileStyleOf(businessInfo: unknown): ProfileStyle {
  const style = (businessInfo as { style?: Record<string, unknown> } | null)?.style;
  const typography = String(style?.["typography"] ?? "");
  const background = String(style?.["background"] ?? style?.["backgroundStyle"] ?? "");
  return {
    typography: TYPOGRAPHY_OPTIONS.some((o) => o.id === typography)
      ? (typography as TypographyId)
      : DEFAULT_PROFILE_STYLE.typography,
    background: BACKGROUND_OPTIONS.some((o) => o.id === background)
      ? (background as BackgroundId)
      : DEFAULT_PROFILE_STYLE.background,
  };
}

/** Merges a style object back into an existing `business_info` payload. */
export function withProfileStyle(businessInfo: unknown, style: ProfileStyle) {
  const base =
    businessInfo && typeof businessInfo === "object" && !Array.isArray(businessInfo)
      ? (businessInfo as Record<string, unknown>)
      : {};
  return { ...base, style };
}

/** CSS font stack for a typography choice. */
export function fontFamilyFor(typography: TypographyId): string {
  if (typography === "serif") return 'Georgia, "Times New Roman", ui-serif, serif';
  if (typography === "mono") return 'ui-monospace, "SFMono-Regular", Menlo, monospace';
  return 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
}

/**
 * Background layer for a profile page, expressed as a CSS `background`
 * shorthand on top of the theme's base colour.
 */
export function backgroundFor(background: BackgroundId, bg: string, border: string): string {
  if (background === "grid") {
    return `repeating-linear-gradient(0deg, ${border} 0 1px, transparent 1px 40px), repeating-linear-gradient(90deg, ${border} 0 1px, transparent 1px 40px), ${bg}`;
  }
  if (background === "gradient") {
    return `radial-gradient(120% 80% at 50% 0%, ${border} 0%, ${bg} 60%)`;
  }
  return bg;
}
