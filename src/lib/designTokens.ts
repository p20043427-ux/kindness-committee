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

/** Sequential Hospital Blue scale for building/group comparisons. */
export const BUILDING_COLORS = [
  "#0F3053",  // deepest
  "#124E89",  // primary-700
  "#0F5DAA",  // primary-600 — brand Hospital Blue
  "#2270B4",
  "#4C8CCB",
] as const;

/** Named chart palette for single-series and reference elements. */
export const CHART_COLORS = {
  primary:   "#0F5DAA",  // Hospital Blue — line charts, single series
  secondary: "#248688",  // brand Mint — reference line
  warning:   "#B05E07",  // brand orange (text-safe) — attention
  danger:    "#B02E2C",  // brand danger (text-safe) — critical
  neutral:   "#8493A5",  // surface-500 — no-data / unassigned
  purple:    "#6040A0",  // muted purple
} as const;

/** Returns a Tailwind className string encoding the score severity.
 *  HIS 준수: 배경색 없이 텍스트 색상 + 굵기만으로 표현.
 *  Green ≥ 80 %, Amber ≥ 50 %, Red < 50 %. */
export function scoreBand(val: number | undefined, max: number): string {
  if (!val || val <= 0) return "text-surface-400 font-mono tabular-nums";
  const pct = val / max;
  if (pct >= 0.8) return "text-green-700 font-semibold font-mono tabular-nums";
  if (pct >= 0.5) return "text-amber-700 font-semibold font-mono tabular-nums";
  return "text-red-600 font-semibold font-mono tabular-nums";
}
