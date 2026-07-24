import { expect, test } from "vitest";
import {
  hyperbolicChance,
  exponentialReduction,
  linearAt,
  stacksToCritCap,
  cooldownReduction,
} from "./breakpoints";

// Anchored to values verified against the decompiled game (MATH-VERIFICATION §3b/§3d).
test("Tougher Times block matches ConvertAmp(15n): 13.04% @1, 60% @10", () => {
  expect(hyperbolicChance(15, 1)).toBeCloseTo(13.043, 2);
  expect(hyperbolicChance(15, 2)).toBeCloseTo(23.077, 2);
  expect(hyperbolicChance(15, 10)).toBeCloseTo(60, 4); // 150 amp -> exactly 60%
});

test("Old Guillotine execute is ConvertAmp(13n): ~11.5% @1, not the 13% tooltip", () => {
  expect(hyperbolicChance(13, 1)).toBeCloseTo(11.504, 2);
  expect(hyperbolicChance(13, 2)).toBeCloseTo(20.635, 2);
});

test("hyperbolic never reaches 100%", () => {
  expect(hyperbolicChance(20, 100)).toBeLessThan(100);
  expect(hyperbolicChance(20, 100)).toBeGreaterThan(95);
});

test("zero stacks = zero", () => {
  expect(hyperbolicChance(15, 0)).toBe(0);
  expect(linearAt(10, 10, 0)).toBe(0);
});

test("crit cap: 10 Lens-Maker's Glasses from 1% base (1% + 10n >= 100)", () => {
  expect(stacksToCritCap(10)).toBe(10);
  // 9 glasses = 91%, not capped; 10 = 101% -> capped.
  expect(1 + linearAt(10, 10, 9)).toBe(91);
  expect(1 + linearAt(10, 10, 10)).toBe(101);
});

test("crit cap accounts for flat crit sources (Predatory + Harvester's = +10%)", () => {
  // 1% base + 10% flat -> need 90 more -> 9 glasses.
  expect(stacksToCritCap(10, 1, 100, 10)).toBe(9);
});

test("exponential cooldown: Fuel Cell ×0.85/stack reductions compound", () => {
  expect(exponentialReduction(0.85, 1)).toBeCloseTo(15, 4);
  expect(exponentialReduction(0.85, 2)).toBeCloseTo(27.75, 2); // 1 - 0.7225
});

test("cooldown reduction, code-verified multipliers", () => {
  // Alien Head 0.75^n: 25% @1, 43.75% @2, ~94.4% @10.
  expect(cooldownReduction(0.75, 0.75, 1)).toBeCloseTo(25, 4);
  expect(cooldownReduction(0.75, 0.75, 2)).toBeCloseTo(43.75, 2);
  // Fuel Cell 0.85^n: 15% @1, ~80.3% @10.
  expect(cooldownReduction(0.85, 0.85, 1)).toBeCloseTo(15, 4);
  expect(cooldownReduction(0.85, 0.85, 10)).toBeCloseTo(80.31, 1);
  // Gesture 0.5 * 0.85^(n-1): 50% @1, 57.5% @2.
  expect(cooldownReduction(0.5, 0.85, 1)).toBeCloseTo(50, 4);
  expect(cooldownReduction(0.5, 0.85, 2)).toBeCloseTo(57.5, 2);
});
