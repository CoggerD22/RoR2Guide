import { test, expect } from "vitest";
import { STAT_ITEMS, STAT_ITEM_IDS, type StatTarget } from "./statItems";
import { items as ITEMS } from "./items";

/**
 * `statItems.ts` says its values "mirror items.json" — and nothing enforced that.
 *
 * It is a second, hand-maintained copy of numbers that the verification programme keeps
 * correcting in `items.json`. Stone Flux Pauldron's movement penalty moved 50 -> 66.7 and
 * Plasma Shrimp's missile 50 -> 40 this session; had either been a Stat Lab item, the
 * calculator would have silently kept computing the old value while the codex showed the
 * new one. Two numbers for the same fact on the same site is exactly the failure this
 * project exists to prevent, so the mirror is now checked rather than trusted.
 */

/** Which items.json stacking `stat` label backs each Stat Lab target. */
const STAT_LABEL: Record<StatTarget, RegExp> = {
  healthFlat: /^Maximum health$/,
  healthPct: /^Maximum health \(%\)$/,
  regenFlat: /^Base health regen \(hp\/s\)$/,
  attackSpeedPct: /^Attack speed$/,
  moveSpeedPct: /^Movement speed$/,
  critChance: /^Critical strike chance$/,
  critDamagePct: /^Bonus critical strike damage \(%\)$/,
  jumpFlat: /^Extra jumps$/,
};

test("every Stat Lab item id exists in the codex", () => {
  for (const id of Object.keys(STAT_ITEMS)) {
    expect(ITEMS.find((i) => i.id === id), `unknown item id "${id}"`).toBeTruthy();
  }
  for (const id of STAT_ITEM_IDS) {
    expect(STAT_ITEMS[id], `"${id}" is offered in the picker but has no entry`).toBeTruthy();
  }
});

test("Stat Lab values match the verified numbers in items.json", () => {
  const drift: string[] = [];

  for (const [id, effects] of Object.entries(STAT_ITEMS)) {
    // Shaped Glass and Irradiant Pearl are deliberately empty — statMath handles their
    // non-linear behaviour directly, so there is nothing to mirror.
    if (effects.length === 0) continue;
    const item = ITEMS.find((i) => i.id === id);
    if (!item) continue;

    for (const e of effects) {
      const label = STAT_LABEL[e.target];
      const entry = item.stacking.find((s) => label.test(s.stat));
      if (!entry) {
        // Crit from Predatory Instincts / Harvester's Scythe is a flat rider stated in
        // the description rather than a stacking row; nothing to compare against.
        continue;
      }
      if (entry.base !== e.base || entry.perStack !== e.perStack) {
        drift.push(
          `${item.name} (${e.target}): Stat Lab has ${e.base}/+${e.perStack}, ` +
            `items.json has ${entry.base}/+${entry.perStack}`,
        );
      }
    }
  }

  expect(drift, drift.join("\n")).toEqual([]);
});
