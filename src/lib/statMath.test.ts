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

test("Artifact of Glass — x5 damage, 10% health", () => {
  const s = compute("commando", 1, {}, true);
  expect(s.damage).toBeCloseTo(60, 5); // 12 * 5
  expect(s.maxHealth).toBeCloseTo(11, 5); // 110 * 0.1
});

test("Lens-Maker's Glasses — crit chance caps at 100%", () => {
  const s = compute("commando", 1, { "lens-makers-glasses": 12 });
  expect(s.critChance).toBe(100); // 1 + 120, capped
});

test("Irradiant Pearl — +10% to all stats per stack", () => {
  const s = compute("commando", 1, { "irradiant-pearl": 2 }); // +20%
  expect(s.damage).toBeCloseTo(14.4, 5); // 12 * 1.2
  expect(s.moveSpeed).toBeCloseTo(8.4, 5); // 7 * 1.2
  expect(s.maxHealth).toBeCloseTo(132, 5); // 110 * 1.2
  expect(s.healthRegen).toBeCloseTo(1.2, 5); // 1 * 1.2
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
