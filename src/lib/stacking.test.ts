import { describe, expect, it } from "vitest";
import { sparklinePoints, itemStackingTypes, stackingLabel } from "./stacking";
import type { StackingEntry } from "@/data/schema";

/**
 * §3j.157 — `stacking.ts` had no test at all, and the mutation sweep proved it mattered.
 *
 * Two deliberate bugs shipped green through typecheck, test:unit, data:audit, data:diff,
 * data:verify, build and all 92 browser tests:
 *   - shifting the sparkline curve by one stack, so every plotted point states the value for
 *     the wrong stack count;
 *   - dropping the de-duplication in `itemStackingTypes`, so an item with two linear rows
 *     renders "Linear" twice.
 *
 * Neither is caught by the browser suite, because a sparkline is an SVG path and a duplicated
 * badge is still a badge — nothing asserts what either one *says*.
 */
const entry = (over: Partial<StackingEntry> = {}): StackingEntry =>
  ({ stat: "Damage (%)", base: 75, perStack: 75, type: "linear", ...over }) as StackingEntry;

describe("sparklinePoints", () => {
  it("starts at the base value for one stack, not base + perStack", () => {
    // The off-by-one the sweep introduced: at n=1 an item has its BASE value. Crowbar is
    // +75% at one stack, not +150%.
    const pts = sparklinePoints(entry(), 4)!;
    expect(pts[0]).toEqual({ n: 1, v: 75 });
    expect(pts.map((p) => p.v)).toEqual([75, 150, 225, 300]);
  });

  it("numbers its points by stack count", () => {
    expect(sparklinePoints(entry(), 3)!.map((p) => p.n)).toEqual([1, 2, 3]);
  });

  it("respects maxStacks", () => {
    expect(sparklinePoints(entry(), 8)).toHaveLength(8);
    expect(sparklinePoints(entry(), 1)).toHaveLength(1);
  });

  it("handles a negative perStack without inventing a floor", () => {
    // Old War Stealthkit's cooldown falls; the curve must fall with it.
    const pts = sparklinePoints(entry({ base: 30, perStack: -5 }), 3)!;
    expect(pts.map((p) => p.v)).toEqual([30, 25, 20]);
  });

  /**
   * Only `linear` is plotted. Drawing a straight line through a hyperbolic row would assert
   * arithmetic the game does not do — the same failure §3j.60 found in the "N base, +M per
   * stack" sentence, which was false on 28 non-linear rows.
   */
  it.each(["hyperbolic", "exponential", "reciprocal", "special", "none"] as const)(
    "refuses to plot a %s row",
    (type) => {
      expect(sparklinePoints(entry({ type }))).toBeNull();
    },
  );
});

describe("itemStackingTypes", () => {
  it("de-duplicates, so one badge is rendered per distinct type", () => {
    const types = itemStackingTypes([entry(), entry(), entry({ type: "hyperbolic" })]);
    expect(types).toEqual(["linear", "hyperbolic"]);
  });

  it("preserves first-seen order", () => {
    expect(itemStackingTypes([entry({ type: "special" }), entry({ type: "linear" })])).toEqual([
      "special",
      "linear",
    ]);
  });

  it("returns nothing for an item with no stacking rows", () => {
    // 33 of 217 items have none (§3j.151).
    expect(itemStackingTypes([])).toEqual([]);
  });
});

describe("stackingLabel", () => {
  it("names every type the schema allows", () => {
    // A missing label renders `undefined` in the UI; the Record type catches an omission at
    // compile time, and this catches one that is present but empty.
    for (const type of ["linear", "hyperbolic", "exponential", "reciprocal", "special", "none"] as const) {
      expect(stackingLabel(type), `no label for ${type}`).toMatch(/\S/);
    }
  });
});
