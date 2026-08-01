import { test, expect } from "vitest";
import { computeStats } from "./statMath";
import { survivors } from "@/data/survivors";

const byId = (id: string) => {
  const s = survivors.find((x) => x.id === id);
  if (!s) throw new Error(`no survivor ${id}`);
  return s;
};

const compute = (id: string, level: number, items: Record<string, number> = {}, glass = false) =>
  computeStats({ survivor: byId(id), level, items, artifactOfGlass: glass });

test("Commando level 1, no items — base line", () => {
  const s = compute("commando", 1);
  expect(s.maxHealth).toBeCloseTo(110, 5);
  expect(s.effectiveHealth).toBeCloseTo(110, 5); // armor 0
  expect(s.healthRegen).toBeCloseTo(1, 5);
  expect(s.damage).toBeCloseTo(12, 5);
  expect(s.attackSpeed).toBeCloseTo(1, 5);
  expect(s.moveSpeed).toBeCloseTo(7, 5);
  expect(s.armor).toBe(0);
  expect(s.critChance).toBe(1);
  expect(s.jumps).toBe(1);
  expect(s.dps).toBeCloseTo(12.12, 2); // 12 * 1 * (1 + 0.01)
});

test("Mercenary level 35 with 3x Syringe/Glasses/Goat Hoof/Bison Steak", () => {
  const s = compute("mercenary", 35, {
    "soldiers-syringe": 3,
    "lens-makers-glasses": 3,
    "pauls-goat-hoof": 3,
    "bison-steak": 3,
  });
  expect(s.maxHealth).toBeCloseTo(1307, 5); // 110 + 33*34 + 3*25
  expect(s.effectiveHealth).toBeCloseTo(1568.4, 1); // *1.2 (armor 20)
  expect(s.healthRegen).toBeCloseTo(7.8, 5); // 1 + 0.2*34
  expect(s.damage).toBeCloseTo(93.6, 5); // 12 + 2.4*34
  expect(s.attackSpeed).toBeCloseTo(1.45, 5); // 1 + 3*0.15
  expect(s.moveSpeed).toBeCloseTo(9.94, 5); // 7 * 1.42
  expect(s.armor).toBe(20);
  expect(s.critChance).toBe(31); // 1 + 3*10
  expect(s.jumps).toBe(2);
  expect(s.dps).toBeCloseTo(177.79, 1); // 93.6 * 1.45 * 1.31
});

test("Shaped Glass — exponential: x2 damage, x0.5 health per stack", () => {
  const s = compute("commando", 1, { "shaped-glass": 2 });
  expect(s.damage).toBeCloseTo(48, 5); // 12 * 2^2
  expect(s.maxHealth).toBeCloseTo(27.5, 5); // 110 * 0.5^2
});

/**
 * Shaped Glass is an ADDITIVE `2^n - 1` term in the damage pool, not a separate
 * multiplier: `num103 += Mathf.Pow(2f, num28) - 1f` sits in the same running total as
 * Irradiant Pearl's `+= num31 * 0.1f`. Modelling it as its own multiplier gave 2.2x
 * where the game gives 2.1x.
 */
test("Shaped Glass shares the damage pool with Irradiant Pearl (2.1x, not 2.2x)", () => {
  const s = compute("commando", 1, { "shaped-glass": 1, "irradiant-pearl": 1 });
  expect(s.damage).toBeCloseTo(12 * (2 + 0.1), 5);
  // Health, by contrast, is two separate steps: pct pool, then the cursePenalty divisor.
  expect(s.maxHealth).toBeCloseTo((110 * 1.1) / 2, 5);
});

/**
 * Transcendence is a CONVERSION. The Stat Lab used to model it as "+50% max health",
 * reporting a health total the survivor does not have — max health is set to exactly 1
 * and the pool becomes shield, which healing cannot restore.
 */
test("Transcendence — max health becomes 1 and the pool moves to shield", () => {
  const s = compute("commando", 1, { transcendence: 1 });
  expect(s.maxHealth).toBe(1);
  expect(s.maxShield).toBeCloseTo(165, 5); // 110 * 1.5
  expect(s.shieldOnly).toBe(true);
  expect(s.combinedHealth).toBeCloseTo(166, 5);
});

test("Transcendence stacks +25% and compounds with Pearl rather than adding to it", () => {
  const s = compute("commando", 1, { transcendence: 3, pearl: 1 });
  // Game: (110 * 1.1) * (1.5 + 0.25*2) = 121 * 2 = 242.
  // The old additive model gave 110 * (1 + 0.10 + 1.00) = 231.
  expect(s.maxShield).toBeCloseTo(242, 5);
  expect(s.maxHealth).toBe(1);
});

test("Shaped Glass halves shield too — cursePenalty divides both pools", () => {
  const s = compute("commando", 1, { transcendence: 1, "shaped-glass": 1 });
  expect(s.maxShield).toBeCloseTo(82.5, 5); // 165 / 2
  expect(s.maxHealth).toBeCloseTo(0.5, 5); // 1 / 2
});

test("Effective HP counts shield, which is consumed before health", () => {
  const s = compute("loader", 1, { transcendence: 1 });
  expect(s.effectiveHealth).toBeCloseTo((s.maxHealth + s.maxShield) * (1 + s.armor / 100), 5);
  expect(s.maxShield).toBeGreaterThan(0);
});

test("Artifact of Glass — x5 damage, 10% health", () => {
  const s = compute("commando", 1, {}, true);
  expect(s.damage).toBeCloseTo(60, 5); // 12 * 5
  expect(s.maxHealth).toBeCloseTo(11, 5); // 110 * 0.1
});

test("Lens-Maker's Glasses — crit chance caps at 100%", () => {
  const s = compute("commando", 1, { "lens-makers-glasses": 12 });
  expect(s.critChance).toBe(100); // 1 + 120, capped
});

test("Irradiant Pearl — +10% to all stats per stack (incl. crit)", () => {
  const s = compute("commando", 1, { "irradiant-pearl": 2 }); // +20%
  expect(s.damage).toBeCloseTo(14.4, 5); // 12 * 1.2
  expect(s.moveSpeed).toBeCloseTo(8.4, 5); // 7 * 1.2
  expect(s.maxHealth).toBeCloseTo(132, 5); // 110 * 1.2
  expect(s.healthRegen).toBeCloseTo(1.2, 5); // 1 + 0.1*2 (level factor 1 at lvl 1)
  expect(s.critChance).toBe(21); // 1 + 2*10 (RecalculateStats: ShinyPearl * 10)
});

test("Item regen scales with level — verified vs RecalculateStats", () => {
  const s = compute("commando", 35, { "titanic-knurl": 2 });
  // base regen 1 + 0.2*34 = 7.8; item regen (2*1.6=3.2) * (1 + 0.2*34 = 7.8) = 24.96
  expect(s.healthRegen).toBeCloseTo(32.76, 1);
  expect(s.maxHealth).toBeCloseTo(1312, 5); // 110 + 33*34 + 2*40
});

test("Titanic Knurl — flat health + regen", () => {
  const s = compute("commando", 1, { "titanic-knurl": 2 });
  expect(s.maxHealth).toBeCloseTo(190, 5); // 110 + (40 + 40)
  expect(s.healthRegen).toBeCloseTo(4.2, 5); // 1 + (1.6 + 1.6)
});

test("Laser Scope — raises crit multiplier and DPS", () => {
  const s = compute("commando", 1, { "lens-makers-glasses": 5, "laser-scope": 1 });
  expect(s.critChance).toBe(51); // 1 + 50
  expect(s.critMultiplier).toBeCloseTo(3, 5); // 2 + 100/100
  expect(s.dps).toBeCloseTo(24.24, 2); // 12 * 1 * (1 + 0.51*2)
});
