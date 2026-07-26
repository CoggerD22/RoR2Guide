import { describe, expect, it } from "vitest";
// The Zod-validated export, not the raw JSON — so these assertions run against the
// same typed data the app consumes.
import { items } from "./items";

/**
 * Regression tests for stacking values that were WRONG when derived from the game's
 * description text and are now code-verified (PLAN §6A). Each asserts the value the
 * decompiled C# actually produces, so a future re-import from description prose
 * cannot silently reintroduce the error.
 */
const byId = new Map(items.map((i) => [i.id, i]));

describe("code-verified stacking values", () => {
  it("Bandolier is 20.4% at one stack, not the description's 18%", () => {
    const b = byId.get("bandolier")!;
    // GlobalEventManager: LocalCheckRoll((1f - 1f / Mathf.Pow(n + 1, 0.33f)) * 100f, …)
    const chance = (n: number) => (1 - 1 / Math.pow(n + 1, 0.33)) * 100;
    expect(chance(1)).toBeCloseTo(20.4, 1);
    expect(b.stacking[0].base).toBeCloseTo(20.4, 1);
    expect(b.confidence).toBe("code");
    // The game's own description still says 18% — we quote it, and flag the difference.
    expect(b.description).toContain("18%");
    expect(b.stacking[0].formula).toMatch(/description says 18%/i);
  });

  it("Tougher Times is the hyperbolic ConvertAmp curve, not linear 15%/stack", () => {
    const t = byId.get("tougher-times")!;
    // HealthComponent: Util.ConvertAmplificationPercentageIntoReductionPercentage(15f * n)
    const block = (n: number) => (1 - 100 / (100 + 15 * n)) * 100;
    expect(block(1)).toBeCloseTo(13.04, 1);
    expect(block(10)).toBeCloseTo(60, 1);
    expect(t.stacking[0].type).toBe("hyperbolic");
    expect(t.confidence).toBe("code");
  });

  it("Crowbar is linear +75%/stack, gated above 90% health", () => {
    const c = byId.get("crowbar")!;
    // HealthComponent: num4 *= 1f + 0.75f * n, inside `if (num >= fullCombinedHealth * 0.9f)`
    expect(c.stacking[0].type).toBe("linear");
    expect(c.stacking[0].base).toBe(75);
    expect(c.stacking[0].perStack).toBe(75);
    expect(c.confidence).toBe("code");
  });

  it("Fuel Cell stacks linearly for charges and exponentially for cooldown", () => {
    const f = byId.get("fuel-cell")!;
    // Inventory: charges = 1 + n ; cooldownScale = Mathf.Pow(0.85f, n)
    expect(f.stacking.find((s) => s.type === "linear")?.perStack).toBe(1);
    expect(f.stacking.find((s) => s.type === "exponential")?.perStack).toBe(15);
    expect(Math.pow(0.85, 2)).toBeCloseTo(0.7225, 4);
    expect(f.confidence).toBe("code");
  });

  it("Alien Head is ×0.75 cooldown per stack", () => {
    const a = byId.get("alien-head")!;
    // CharacterBody.RecalculateStats: for (i < count) cooldown *= 0.75f
    expect(a.stacking[0].type).toBe("exponential");
    expect(a.stacking[0].perStack).toBe(25);
    expect(a.confidence).toBe("code");
  });
});

describe("code-verified corrections where the game's own description is wrong", () => {
  const byId2 = new Map(items.map((i) => [i.id, i]));

  it("Stone Flux Pauldron slows by 66.7% at one stack, not the described 50%", () => {
    const s = byId2.get("stone-flux-pauldron")!;
    // RecalculateStats adds the item count to the speed DIVISOR twice — verified at IL
    // level (two `ldloc 46; add` into the divisor; local 46 is stored only twice, a
    // zero-init and the item count, so it is not a reused slot).
    const speed = (n: number) => 1 / (1 + 2 * n);
    expect((1 - speed(1)) * 100).toBeCloseTo(66.7, 1);
    expect((1 - speed(2)) * 100).toBeCloseTo(80, 1);

    const entry = s.stacking.find((e) => e.type === "reciprocal")!;
    expect(entry.base).toBeCloseTo(66.7, 1);
    expect(s.confidence).toBe("code");
    // The game still says 50% — we quote it and flag the difference.
    expect(s.description).toContain("50%");
    expect(entry.formula).toMatch(/description says 50%/i);
  });

  it("Hiker's Boots' ceiling scales with stacks, so it carries no fixed capStacks", () => {
    const h = byId2.get("hikers-boots")!;
    const entry = h.stacking[0];
    // GlobalEventManager: num = 10 * itemCountEffective — +10% at 1 stack, +20% at 2.
    expect(entry.cap).toMatch(/10 x item count/i);
    expect(entry.capStacks).toBeUndefined();
    expect(h.confidence).toBe("code");
  });

  it("items with a fixed ceiling do carry capStacks, so the planner can warn", () => {
    expect(byId2.get("focused-convergence")!.stacking.every((e) => e.capStacks === 3)).toBe(true);
    expect(
      byId2.get("lens-makers-glasses")!.stacking.some((e) => e.capStacks === 10),
    ).toBe(true);
  });
});
