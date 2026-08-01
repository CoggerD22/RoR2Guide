import type { Survivor, StatScaling } from "@/data/schema";
import { STAT_ITEMS, type StatTarget } from "@/data/statItems";

/**
 * Difficulty is not cosmetic to a stat sheet. `Run.cs` hands every player a hidden item at
 * spawn — `DrizzlePlayerHelper` on Easy, `MonsoonPlayerHelper` on anything with
 * `countsAsHardMode` — and `RecalculateStats` reads both. Rainstorm alone gets neither, so
 * a sheet with no difficulty control is silently a Rainstorm sheet.
 */
export type Difficulty = "drizzle" | "rainstorm" | "monsoon";

export interface StatInputs {
  survivor: Survivor;
  /** 1–99 */
  level: number;
  /** itemId → quantity */
  items: Record<string, number>;
  artifactOfGlass: boolean;
  /** Defaults to Rainstorm, the difficulty that grants no helper item. */
  difficulty?: Difficulty;
}

export interface DerivedStats {
  maxHealth: number;
  /**
   * Regenerating shield. Zero for every survivor at base — no player body has a
   * `baseMaxShield` (checked across all 241 extracted bodies; only SolusVendorBody
   * has one) — so this is entirely item-granted. Transcendence is the only source
   * the Stat Lab models.
   */
  maxShield: number;
  /** True when Transcendence has moved the survivor's pool into shield. */
  shieldOnly: boolean;
  /** maxHealth + maxShield, before armor. What actually has to be chewed through. */
  combinedHealth: number;
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

/**
 * Fraction of incoming damage that gets through, from `HealthComponent`:
 *
 *   `num7 = (armor >= 0f) ? (1f - armor / (armor + 100f)) : (2f - 100f / (100f - armor));`
 *
 * Armor has TWO branches and only the positive one was implemented here — as the algebraic
 * shortcut `(100 + armor) / 100`, which is exactly right above zero and nonsense below it
 * (at −100 armor it reports zero effective HP rather than double damage taken). Nothing in
 * the picker can currently drive armor negative, so this was a trap rather than a live bug:
 * the first armor-reducing item added to the Stat Lab would have sprung it silently. Both
 * branches are cheap, so both are here (PLAN §9.1).
 */
export function damageTakenMultiplier(armor: number): number {
  return armor >= 0 ? 1 - armor / (armor + 100) : 2 - 100 / (100 - armor);
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

export function computeStats({
  survivor,
  level,
  items,
  artifactOfGlass,
  difficulty = "rainstorm",
}: StatInputs): DerivedStats {
  const lvl = Math.max(1, Math.min(99, Math.round(level)));

  const baseHealth = scale(survivor.health, lvl);
  const baseRegen = scale(survivor.regen, lvl);
  const baseDamage = scale(survivor.damage, lvl);

  const q = (id: string) => items[id] ?? 0;

  const shapedGlass = q("shaped-glass");
  // Irradiant Pearl: +10% to ALL stats per stack.
  const allStatsPct = 10 * q("irradiant-pearl");

  // --- Health and shield ---
  // RecalculateStats order, verified line by line:
  //   maxHealth = (base + level + flat items) * (1 + pct items)
  //   if (Transcendence) { maxShield += maxHealth * (1.5 + 0.25*(n-1)); maxHealth = 1 }
  //   cursePenalty = 2^ShapedGlass, x10 under Artifact of Glass
  //   maxHealth /= cursePenalty; maxShield /= cursePenalty
  // The order matters: Transcendence multiplies the FINISHED health pool, so it
  // compounds with Pearl rather than adding to it, and it is a conversion — the
  // survivor is left on literally 1 HP.
  const healthFlat = sumTarget(items, "healthFlat"); // Bison Steak, Titanic Knurl
  const healthPct = sumTarget(items, "healthPct") + allStatsPct; // Pearl, Irradiant Pearl
  let maxHealth = (baseHealth + healthFlat) * (1 + healthPct / 100);

  const transcendence = q("transcendence");
  let maxShield = 0;
  if (transcendence > 0) {
    maxShield += maxHealth * (1.5 + 0.25 * (transcendence - 1));
    maxHealth = 1;
  }

  // Shaped Glass and Artifact of Glass are one `cursePenalty` divisor applied to
  // BOTH pools, after the conversion above.
  const cursePenalty = Math.pow(2, shapedGlass) * (artifactOfGlass ? 10 : 1);
  maxHealth /= cursePenalty;
  maxShield /= cursePenalty;

  // --- Regen ---
  // Verified against CharacterBody.RecalculateStats: regen FROM ITEMS scales with
  // level by (1 + 0.2*(level-1)); Irradiant Pearl adds +0.1 hp/s per stack into
  // that same level-scaled pool. Base regen already carries its own level growth.
  // Difficulty multiplies the FINISHED regen total, base included:
  //   `num96 = (num83 + items * levelFactor) * num94`, where num94 is
  //   1 + 0.5 on Drizzle, 1 - 0.4 on Monsoon, and 1 on Rainstorm.
  const regenDifficulty = difficulty === "drizzle" ? 1.5 : difficulty === "monsoon" ? 0.6 : 1;
  const regenLevelFactor = 1 + 0.2 * (lvl - 1);
  const healthRegen =
    (baseRegen + (sumTarget(items, "regenFlat") + allStatsPct / 100) * regenLevelFactor) *
    regenDifficulty;

  // --- Damage ---
  // One additive pool: `num103 = 1 + 0.1*Irradiant + (2^ShapedGlass - 1)`, then
  // `x5` separately for Artifact of Glass. Shaped Glass does NOT multiply the
  // percentage items — at 1 glass + 1 Irradiant the game gives 2.1x, not 2.2x.
  const damageMult = Math.pow(2, shapedGlass) + allStatsPct / 100;
  let damage = baseDamage * damageMult;
  if (artifactOfGlass) damage *= 5; // Artifact of Glass: deal 500% damage

  // --- Attack / move speed ---
  const attackSpeed = survivor.baseAttackSpeed * (1 + (sumTarget(items, "attackSpeedPct") + allStatsPct) / 100);
  const moveSpeed = survivor.moveSpeed * (1 + (sumTarget(items, "moveSpeedPct") + allStatsPct) / 100);

  // --- Armor ---
  // Drizzle's +70 lands AFTER the percentage multiplier (`armor *= 1f + 0.1f * num31;`
  // then `armor += num26 * 70f;`), so Irradiant Pearl does not scale it.
  const armor = survivor.armor * (1 + allStatsPct / 100) + (difficulty === "drizzle" ? 70 : 0);

  // --- Crit ---
  // Base 1% + item crit; Irradiant Pearl also adds +10% crit chance per stack
  // (RecalculateStats: num111 += ShinyPearl * 10). Effective crit caps at 100%.
  const critChance = Math.min(100, 1 + sumTarget(items, "critChance") + allStatsPct);
  const critMultiplier = 2 + sumTarget(items, "critDamagePct") / 100; // 2x base, +1x per Laser Scope
  const avgCritFactor = 1 + (critChance / 100) * (critMultiplier - 1);

  // --- Derived ---
  // Armor applies to whatever pool is being hit, and shield is consumed before
  // health, so the armor-adjusted figure is over the COMBINED pool — which is what
  // `HealthComponent.fullCombinedHealth` sums.
  const combinedHealth = maxHealth + maxShield;
  const effectiveHealth = combinedHealth / damageTakenMultiplier(armor);
  const dps = damage * attackSpeed * avgCritFactor;
  const jumps = survivor.jumpCount + sumTarget(items, "jumpFlat");

  return {
    maxHealth,
    maxShield,
    shieldOnly: transcendence > 0,
    combinedHealth,
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
