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
