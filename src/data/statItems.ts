/**
 * Curated map of items that directly modify survivor stats, for the Stat Lab
 * (PLAN §2.3 / Phase 2). This is intentionally a small, hand-verified subset —
 * proc/damage-chain items and conditional effects are out of scope for v1.
 *
 * Values mirror items.json but are typed to concrete stat targets so the
 * calculator can apply them precisely. `base` is the value at 1 stack;
 * `perStack` the increment (linear). Shaped Glass and Irradiant Pearl are
 * handled specially in statMath (exponential / all-stats).
 */

export type StatTarget =
  | "healthFlat"
  | "healthPct"
  | "regenFlat"
  | "attackSpeedPct"
  | "moveSpeedPct"
  | "critChance"
  | "critDamagePct"
  | "jumpFlat";

export interface ItemStatEffect {
  target: StatTarget;
  base: number;
  perStack: number;
}

/** itemId → its stat effects (an item can hit several stats, e.g. Mocha). */
export const STAT_ITEMS: Record<string, ItemStatEffect[]> = {
  "soldiers-syringe": [{ target: "attackSpeedPct", base: 15, perStack: 15 }],
  mocha: [
    { target: "attackSpeedPct", base: 7.5, perStack: 7.5 },
    { target: "moveSpeedPct", base: 7, perStack: 7 },
  ],
  "pauls-goat-hoof": [{ target: "moveSpeedPct", base: 14, perStack: 14 }],
  "lens-makers-glasses": [{ target: "critChance", base: 10, perStack: 10 }],
  "predatory-instincts": [{ target: "critChance", base: 5, perStack: 0 }],
  "harvesters-scythe": [{ target: "critChance", base: 5, perStack: 0 }],
  "laser-scope": [{ target: "critDamagePct", base: 100, perStack: 100 }],
  "bison-steak": [{ target: "healthFlat", base: 25, perStack: 25 }],
  "titanic-knurl": [
    { target: "healthFlat", base: 40, perStack: 40 },
    { target: "regenFlat", base: 1.6, perStack: 1.6 },
  ],
  pearl: [{ target: "healthPct", base: 10, perStack: 10 }],
  transcendence: [{ target: "healthPct", base: 50, perStack: 25 }],
  "hopoo-feather": [{ target: "jumpFlat", base: 1, perStack: 1 }],
  // Special-cased in statMath (not linear):
  "shaped-glass": [],
  "irradiant-pearl": [],
};

/**
 * Items whose STACKING effect the calculator deliberately does not model, and why.
 *
 * Both of these grant a flat +5% critical chance that genuinely does not stack
 * (`if (count > 0) crit += 5f` — verified), so the calculator is arithmetically right to
 * show no change past one stack. But their *real* per-stack effects are conditional
 * events rather than static stats, so the picker silently implied that stacking them does
 * nothing at all. That is the same failure this project keeps correcting in the data:
 * an absent number reading as "no effect" rather than "not shown here".
 */
export const UNMODELED_STACKING: Record<string, string> = {
  "predatory-instincts":
    "Only the flat +5% crit is shown, and it does not stack. Stacking raises the cap on " +
    "attack speed gained from critical strikes (36%, +24% per stack) — a buff that builds " +
    "as you crit, so it has no fixed value to add to a static sheet.",
  "harvesters-scythe":
    "Only the flat +5% crit is shown, and it does not stack. Stacking increases the heal on " +
    "each critical strike (8, +4 per stack), which is an on-hit event rather than a stat.",
};

/** Ids the Stat Lab exposes in its item picker, in a sensible display order. */
export const STAT_ITEM_IDS: string[] = [
  "soldiers-syringe",
  "lens-makers-glasses",
  "predatory-instincts",
  "harvesters-scythe",
  "laser-scope",
  "pauls-goat-hoof",
  "mocha",
  "bison-steak",
  "titanic-knurl",
  "pearl",
  "hopoo-feather",
  "transcendence",
  "shaped-glass",
  "irradiant-pearl",
];
