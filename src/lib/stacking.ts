import type { StackingEntry } from "@/data/schema";

export interface SparkPoint {
  n: number;
  v: number;
}

/**
 * Value of a linear stat at n stacks: base + perStack·(n−1).
 * Only linear entries are plotted; non-linear entries (hyperbolic /
 * exponential / special) rely on their `formula` string instead of a
 * potentially-misleading auto-drawn curve (see PLAN §2.2).
 */
export function sparklinePoints(entry: StackingEntry, maxStacks = 8): SparkPoint[] | null {
  if (entry.type !== "linear") return null;
  return Array.from({ length: maxStacks }, (_, i) => ({
    n: i + 1,
    v: entry.base + entry.perStack * i,
  }));
}

const STACKING_LABEL: Record<StackingEntry["type"], string> = {
  linear: "Linear",
  hyperbolic: "Hyperbolic",
  exponential: "Exponential",
  reciprocal: "Reciprocal",
  special: "Special",
  none: "No stacking",
};

export function stackingLabel(type: StackingEntry["type"]): string {
  return STACKING_LABEL[type];
}

/** Distinct stacking types present on an item, preserving first-seen order. */
export function itemStackingTypes(entries: StackingEntry[]): StackingEntry["type"][] {
  return [...new Set(entries.map((e) => e.type))];
}

/**
 * What an entry's `perStack` number actually MEANS, which is not the same thing for
 * every stacking type (PLAN §9.1).
 *
 * The detail panel used to render every row as "N base, +M per stack" — a sentence that
 * is only true for `linear`. On the 28 non-linear rows the same phrasing asserted
 * arithmetic the game does not do:
 *
 *   Mercurial Rachis   16 (+50) exponential  — reads as 66m at two stacks; it is 24m.
 *   Old War Stealthkit 30 (-50) exponential  — reads as -20s at two stacks; it is 15s.
 *   Tougher Times      15 (+15) hyperbolic   — reads as 30% at two stacks; it is 23.08%.
 *
 * Each row's `formula` said the right thing directly underneath. A reader who skims the
 * bold numbers and not the monospace paragraph got the wrong answer, which is precisely
 * the class of defect §9 exists to catch: correct data, false presentation.
 */
export function perStackMeaning(type: StackingEntry["type"]): string | null {
  switch (type) {
    case "linear":
      return null; // genuinely added once per extra stack
    case "hyperbolic":
      return "feeds a hyperbolic curve — each stack adds less than the last";
    case "exponential":
    case "reciprocal":
      return "is a multiplier applied per stack, not a number added";
    case "special":
      return "is one term in the formula below, not a number added";
    case "none":
      return null;
  }
}

/**
 * The true value of a hyperbolic row at n stacks. Only valid where `base === perStack`,
 * i.e. the row records a flat per-stack amplification fed to RoR2's universal
 * `Util.ConvertAmplificationPercentageIntoReductionPercentage`. Unstable Transmitter is
 * hyperbolic in a different shape (`perStack` is 0) and is excluded.
 */
export function hyperbolicCurve(
  entry: StackingEntry,
  stacks: readonly number[] = [1, 2, 3, 5, 10],
): { n: number; v: number }[] | null {
  if (entry.type !== "hyperbolic" || entry.perStack === 0 || entry.base !== entry.perStack) {
    return null;
  }
  return stacks.map((n) => ({ n, v: (1 - 100 / (100 + entry.perStack * n)) * 100 }));
}
