/* ──────────────────────────────────────────────────────────────
 * Design Tokens — single source of truth for values that live
 * outside the CSS @theme block (chart fills, score helpers).
 * ────────────────────────────────────────────────────────────── */

/** Clinical muted palette for category bar/line fills.
 *  Dark enough for white text (WCAG AA), desaturated enough for HIS. */
export const CATEGORY_COLORS: Record<string, string> = {
  greeting:    "#A86800",  // muted amber-gold
  response:    "#1A6AAE",  // clinical steel-blue
  phone:       "#167A55",  // clinical forest-green
  appearance:  "#B83030",  // clinical crimson
  environment: "#6040A0",  // muted indigo-purple
};

/** Sequential clinical-blue scale for building/group comparisons. */
export const BUILDING_COLORS = [
  "#0F4888",  // deepest
  "#155CA8",  // primary clinical blue
  "#1E6DC5",
  "#2A83D8",
  "#3A9AE5",
] as const;

/** Named chart palette for single-series and reference elements. */
export const CHART_COLORS = {
  primary:   "#1558A0",  // clinical blue — line charts, single series
  secondary: "#16805A",  // clinical green — reference line
  warning:   "#B45309",  // muted amber — attention
  danger:    "#B83030",  // clinical crimson — critical
  neutral:   "#8899B0",  // cool blue-grey — no-data / unassigned
  purple:    "#6040A0",  // muted purple
} as const;

/** Returns a Tailwind className string encoding the score severity.
 *  Green ≥ 80 %, Amber ≥ 50 %, Red < 50 %. */
export function scoreBand(val: number | undefined, max: number): string {
  if (!val || val <= 0) return "text-surface-400";
  const pct = val / max;
  if (pct >= 0.8)
    return "inline-block px-1.5 rounded text-xs bg-green-50 text-green-700 font-semibold border border-green-200";
  if (pct >= 0.5)
    return "inline-block px-1.5 rounded text-xs bg-amber-50 text-amber-700 font-semibold border border-amber-200";
  return "inline-block px-1.5 rounded text-xs bg-red-50 text-red-700 font-semibold border border-red-200";
}
