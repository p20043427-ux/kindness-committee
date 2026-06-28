/* ──────────────────────────────────────────────────────────────
 * Design Tokens — single source of truth for values that live
 * outside the CSS @theme block (chart fills, score helpers).
 * ────────────────────────────────────────────────────────────── */

/** Category fill colors — used in Recharts Bar/Line and legend. */
export const CATEGORY_COLORS: Record<string, string> = {
  greeting:    "#FBBF24",
  response:    "#38BDF8",
  phone:       "#10B981",
  appearance:  "#F43F5E",
  environment: "#A78BFA",
};

/** Named chart palette for multi-series charts. */
export const CHART_COLORS = {
  primary:   "#1E6DC5",
  secondary: "#10B981",
  warning:   "#F59E0B",
  danger:    "#EF4444",
  neutral:   "#94A3B8",
  purple:    "#8B5CF6",
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
