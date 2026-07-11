import type { Survivor, StatScaling } from "@/data/schema";
import { STAT_ITEMS, type StatTarget } from "@/data/statItems";

export interface StatInputs {
  survivor: Survivor;
  /** 1–99 */
  level: number;
  /** itemId → quantity */
  items: Record<string, number>;
  artifactOfGlass: boolean;
}

export interface DerivedStats {
  maxHealth: number;
  effectiveHealth: number;
  healthRegen: number;
  damage: number;
  attackSpeed: number;
  /** attacks-per-second-adjusted damage proxy incl. crit (PLAN §2.3). */
  dps: number;
  moveSpeed: number;
  armor: number;
  /** capped at 100 */
  critChance: number;
  /** damage multiplier on a crit (2x base, +Laser Scope) */
  critMultiplier: number;
  jumps: number;
}

function scale(s: StatScaling, level: number): number {
  return s.base + s.perLevel * (level - 1);
}

/** Sum of a linear stat target across all selected items. */
function sumTarget(items: Record<string, number>, target: StatTarget): number {
  let total = 0;
  for (const [id, effects] of Object.entries(STAT_ITEMS)) {
    const q = items[id] ?? 0;
    if (q <= 0) continue;
    for (const e of effects) {
      if (e.target === target) total += e.base + e.perStack * (q - 1);
    }
  }
  return total;
}

export function computeStats({ survivor, level, items, artifactOfGlass }: StatInputs): DerivedStats {
  const lvl = Math.max(1, Math.min(99, Math.round(level)));

  const baseHealth = scale(survivor.health, lvl);
  const baseRegen = scale(survivor.regen, lvl);
  const baseDamage = scale(survivor.damage, lvl);

  const q = (id: string) => items[id] ?? 0;

  const shapedGlass = q("shaped-glass");
  // Irradiant Pearl: +10% to ALL stats per stack.
  const allStatsPct = 10 * q("irradiant-pearl");

  // --- Health ---
  const healthFlat = sumTarget(items, "healthFlat"); // Bison Steak, Titanic Knurl
  const healthPct = sumTarget(items, "healthPct") + allStatsPct; // Pearl, Transcendence, Irradiant
  let maxHealth = (baseHealth + healthFlat) * (1 + healthPct / 100);
  maxHealth *= Math.pow(0.5, shapedGlass); // Shaped Glass halves max HP per stack
  if (artifactOfGlass) maxHealth *= 0.1; // Artifact of Glass: 10% max health

  // --- Regen ---
  const healthRegen = (baseRegen + sumTarget(items, "regenFlat")) * (1 + allStatsPct / 100);

  // --- Damage ---
  let damage = baseDamage * Math.pow(2, shapedGlass); // Shaped Glass doubles base damage per stack
  if (artifactOfGlass) damage *= 5; // Artifact of Glass: deal 500% damage
  damage *= 1 + allStatsPct / 100;

  // --- Attack / move speed ---
  const attackSpeed = survivor.baseAttackSpeed * (1 + (sumTarget(items, "attackSpeedPct") + allStatsPct) / 100);
  const moveSpeed = survivor.moveSpeed * (1 + (sumTarget(items, "moveSpeedPct") + allStatsPct) / 100);

  // --- Armor ---
  const armor = survivor.armor * (1 + allStatsPct / 100);

  // --- Crit ---
  const critChance = Math.min(100, 1 + sumTarget(items, "critChance"));
  const critMultiplier = 2 + sumTarget(items, "critDamagePct") / 100; // 2x base, +1x per Laser Scope
  const avgCritFactor = 1 + (critChance / 100) * (critMultiplier - 1);

  // --- Derived ---
  const effectiveHealth = maxHealth * (100 + armor) / 100; // positive-armor formula
  const dps = damage * attackSpeed * avgCritFactor;
  const jumps = survivor.jumpCount + sumTarget(items, "jumpFlat");

  return {
    maxHealth,
    effectiveHealth,
    healthRegen,
    damage,
    attackSpeed,
    dps,
    moveSpeed,
    armor,
    critChance,
    critMultiplier,
    jumps,
  };
}
