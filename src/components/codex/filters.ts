import type { Tier, Dlc, StackingType } from "@/data/schema";

export interface FilterState {
  tiers: Set<Tier>;
  dlcs: Set<Dlc>;
  stacking: Set<StackingType>;
  tags: Set<string>;
  /** Hide scrap / consumed / temporary variants (on by default, PLAN §3). */
  hideVariants: boolean;
  /** Show only items locked behind an unlock challenge (PLAN §4.7). */
  lockedOnly: boolean;
}

export const STACKING_TYPES: StackingType[] = [
  "linear",
  "hyperbolic",
  "exponential",
  "reciprocal",
  "special",
  "none",
];

export function emptyFilters(): FilterState {
  return {
    tiers: new Set(),
    dlcs: new Set(),
    stacking: new Set(),
    tags: new Set(),
    hideVariants: true,
    lockedOnly: false,
  };
}

export function hasActiveFilter(f: FilterState): boolean {
  return (
    f.tiers.size > 0 || f.dlcs.size > 0 || f.stacking.size > 0 || f.tags.size > 0 || f.lockedOnly
  );
}

/** Toggle a value inside a Set immutably (returns a new Set). */
export function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}
