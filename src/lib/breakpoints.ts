/**
 * Breakpoint math (PLAN §4.3) — "how many stacks to reach X".
 *
 * Facts only, computed from the game's own formulas. Every value here is derived,
 * not hand-entered, so it can't drift from the mechanics. The two hyperbolic
 * anchors (Tougher Times, Old Guillotine) were verified against the decompiled
 * `Util.ConvertAmplificationPercentageIntoReductionPercentage` and
 * `RecalculateStats` (see MATH-VERIFICATION.md §3b/§3d); crit chance likewise.
 */

/**
 * RoR2's universal "chance that approaches but never reaches 100%" curve:
 *   Util.ConvertAmplificationPercentageIntoReductionPercentage(amp) = (1 − 100/(100+amp))·100
 * `amp` is the summed per-stack amplification. For an item with base==perStack
 * (all of them), amp at n stacks = base·n.
 * Verified exact: Tougher Times 15%/stack → 13.04% @1, 60% @10.
 */
export function hyperbolicChance(perStackAmp: number, stacks: number): number {
  if (stacks <= 0) return 0;
  const amp = perStackAmp * stacks;
  return (1 - 100 / (100 + amp)) * 100;
}

/** Exponential multiplier stacking, e.g. cooldown ×m per stack. Returns the % reduction. */
export function exponentialReduction(multiplierPerStack: number, stacks: number): number {
  return (1 - Math.pow(multiplierPerStack, stacks)) * 100;
}

/**
 * Cooldown reduction %, general form: remaining fraction = first · mult^(n−1).
 * Covers the plain case (first == mult, e.g. Fuel Cell 0.85·0.85ⁿ⁻¹ = 0.85ⁿ) and
 * Gesture of the Drowned's special first stack (0.5 · 0.85ⁿ⁻¹). All code-verified
 * in CalculateEquipmentCooldownScale / RecalculateStats (MATH-VERIFICATION §3b).
 */
export function cooldownReduction(firstStackScale: number, mult: number, stacks: number): number {
  if (stacks <= 0) return 0;
  return (1 - firstStackScale * Math.pow(mult, stacks - 1)) * 100;
}

export interface CooldownItem {
  id: string;
  stat: string;
  firstStackScale: number;
  mult: number;
  verified: Verification;
}

/** Cooldown-reduction items, all with multipliers confirmed in the decompile. */
export const COOLDOWN_ITEMS: CooldownItem[] = [
  { id: "alien-head", stat: "Skill cooldown", firstStackScale: 0.75, mult: 0.75, verified: "code" },
  { id: "fuel-cell", stat: "Equipment cooldown", firstStackScale: 0.85, mult: 0.85, verified: "code" },
  { id: "gesture-of-the-drowned", stat: "Equipment cooldown", firstStackScale: 0.5, mult: 0.85, verified: "code" },
];

/**
 * §3j.164 — the worked example that two components use to explain hyperbolic stacking,
 * computed rather than typed.
 *
 * `ItemDetail` and `Breakpoints` both illustrate the input-vs-outcome gap with the same item:
 * "reads 15% per stack but blocks 13% at one stack". Both had those numbers written into the
 * prose, tied to `items.json` by nothing — so a balance patch that changed the item would leave
 * two components asserting the old figures, in the very sentence warning readers not to trust a
 * stated number. §3j.125 found and removed four duplications of exactly this kind; these two
 * survived that pass.
 *
 * Returns null rather than inventing an example if the item or its hyperbolic row is gone.
 */
export function hyperbolicExample(
  id: string,
  lookup: (id: string) => { stacking: Array<{ type: string; base: number }> } | undefined,
): { stated: number; actual: number } | null {
  const row = lookup(id)?.stacking.find((s) => s.type === "hyperbolic");
  if (!row) return null;
  return { stated: row.base, actual: Math.round(hyperbolicChance(row.base, 1)) };
}

/** Linear stat at n stacks: base + perStack·(n−1). */
export function linearAt(base: number, perStack: number, stacks: number): number {
  return stacks <= 0 ? 0 : base + perStack * (stacks - 1);
}

/**
 * Fewest stacks of a linear crit-chance item to reach a target (default 100%),
 * starting from a survivor's base crit (1% for everyone in vanilla).
 * Lens-Maker's Glasses (+10%/stack, code-verified): 1% + 10n ≥ 100 → 10 glasses.
 */
export function stacksToCritCap(
  perStack: number,
  baseCrit = 1,
  target = 100,
  flatBonus = 0,
): number {
  const need = target - baseCrit - flatBonus;
  if (need <= 0) return 0;
  return Math.ceil(need / perStack);
}

export type Verification = "code" | "convention";

export interface HyperbolicRow {
  item: string;
  stat: string;
  perStackAmp: number;
  /** "code" = mechanic confirmed in the decompile; "convention" = RoR2's universal
   *  proc-chance stacking, consistent but not individually decompiled. */
  verified: Verification;
}

/** Value of a hyperbolic mechanic at the standard milestone stack counts. */
export const MILESTONES = [1, 2, 3, 4, 5, 10] as const;

export function hyperbolicTable(row: HyperbolicRow): { stacks: number; value: number }[] {
  return MILESTONES.map((n) => ({ stacks: n, value: hyperbolicChance(row.perStackAmp, n) }));
}
