import items from "../src/data/items.json" with { type: "json" };

/**
 * §3j.151 — the distinct states `ItemDetail` can render, and one real item for each.
 *
 * Every sweep in this suite visited `/items/crowbar` and nothing else, so the site's most
 * important component was measured through one narrow slice of itself. Crowbar is a common
 * item with one stacking row, an unlock, `confidence: "code"`, no cooldown, no corruption and
 * no description note — which means the equipment cooldown block, all three of its variants,
 * the no-stacking-table case, the void corruption pair, the description note and the
 * lower-confidence caveat had never been drawn under measurement at all.
 *
 * That is the §3j.149 shape: a deliberate defect placed in `TierGrid`'s empty state passed the
 * entire suite, because a default visit always has results.
 *
 * Representatives are DERIVED from items.json rather than hardcoded, so they cannot rot when
 * the data changes — if the chosen item stops exercising its branch, another is picked, and if
 * nothing exercises it the branch is reported as unreachable.
 */
type Item = (typeof items)[number] & {
  cooldown?: number;
  activated?: boolean;
  triggered?: unknown;
  consumedOnUse?: unknown;
  descriptionNote?: string;
  corrupts?: unknown;
  corruptedBy?: unknown;
  verified?: boolean;
  confidence?: string;
  stacking?: Array<{ cap?: unknown; formula?: unknown; perStack?: number }>;
};

const all = items as Item[];

/** Stacking rows, read through the fields these states care about. */
const rows = (i: Item): Array<{ cap?: unknown; formula?: unknown; perStack?: number }> =>
  (i.stacking ?? []) as Array<{ cap?: unknown; formula?: unknown; perStack?: number }>;

export interface Branch {
  /** What renders. Used in failure messages, so it reads as a sentence. */
  name: string;
  match: (i: Item) => boolean;
  /**
   * Set when NO item can reach the branch today. It is then a guard for future data rather
   * than a state a sweep can render, and saying so is the point — an unreachable branch that
   * looks covered is worse than one that is honestly listed.
   */
  unreachableOk?: boolean;
}

export const BRANCHES: Branch[] = [
  { name: "equipment cooldown row", match: (i) => i.cooldown !== undefined },
  { name: "cooldown: triggered variant", match: (i) => i.cooldown !== undefined && i.activated === false && !!i.triggered },
  { name: "cooldown: passive (activated false)", match: (i) => i.cooldown !== undefined && i.activated === false && !i.triggered },
  { name: "cooldown: consumed on use", match: (i) => i.cooldown !== undefined && i.activated !== false && !!i.consumedOnUse },
  { name: "no stacking table", match: (i) => !i.stacking || i.stacking.length === 0 },
  { name: "confidence below code/asset", match: (i) => !!i.verified && i.confidence !== "code" && i.confidence !== "asset" },
  { name: "void corruption pair", match: (i) => !!(i.corrupts || i.corruptedBy) },
  { name: "description note", match: (i) => !!i.descriptionNote },
  // `cap` is optional in the schema but absent from the JSON-inferred row type, so the rows are
  // read through an explicit shape rather than widening `Item` and losing the rest of it.
  { name: "a stacking entry with a cap", match: (i) => rows(i).some((s) => s.cap !== undefined) },
  { name: "a flat stacking entry (perStack 0)", match: (i) => rows(i).some((s) => s.perStack === 0) },
  { name: "unlock challenge shown", match: (i) => !!i.unlock },
  { name: "no unlock challenge", match: (i) => !i.unlock },
  { name: "DLC badge", match: (i) => !!i.dlc && i.dlc !== "base" },
  // §3j.172. 29 of 217 (18 items by ItemTag, 11 equipment by EquipmentDef.canDrop).
  { name: "not in any drop pool", match: (i) => !!(i as { dropExclusion?: unknown }).dropExclusion },
  // The `source` half is a guard for data that does not exist yet: how these items ARE obtained
  // has not been verified for any of the 29, and rule #1 forbids guessing at it, so every record
  // carries `cause` alone. The branch renders the fallback sentence until one is researched.
  {
    name: "drop exclusion with a verified source",
    match: (i) => !!(i as { dropExclusion?: { source?: string } }).dropExclusion?.source,
    unreachableOk: true,
  },

  /*
    Branches no item can reach today. They are listed rather than omitted: an unreachable
    branch that is simply absent from this list looks covered, which is the failure this whole
    file exists to prevent. Each is a guard for data that does not exist yet.
  */
  // `items.json` carries no `verified: false` at all — CLAUDE.md rule #1 treats a new one as a
  // signal, not a placeholder. The badge is a guard for that day.
  { name: "unverified badge", match: (i) => i.verified === false, unreachableOk: true },
  // 0 of 217 items have `flavor`. ItemDetail reads it twice and it has never rendered.
  { name: "flavour text", match: (i) => !!(i as { flavor?: string }).flavor, unreachableOk: true },
  // 217 of 217 have `wiki` and `pickupText`, so their absent-branches cannot render either.
  { name: "no wiki link", match: (i) => !(i as { wiki?: string }).wiki, unreachableOk: true },
  { name: "no pickup text", match: (i) => !(i as { pickupText?: string }).pickupText, unreachableOk: true },
];

/**
 * Fields `ItemDetail` may read without a conditional, so their absence is not a state.
 * Everything else it touches must appear in BRANCHES — see the guard in `stacking.test.ts`,
 * which reads the component rather than trusting this list. Six fields were missing from the
 * first version of BRANCHES, which is exactly why the guard derives from the source.
 */
export const ALWAYS_PRESENT = ["id", "name", "icon", "tier", "description", "tags", "wiki", "pickupText"];

/** Every branch, with how many items reach it and one representative id (null if none). */
export function branchCoverage(): Array<{ branch: Branch; count: number; example: string | null }> {
  return BRANCHES.map((branch) => {
    const hits = all.filter(branch.match);
    return { branch, count: hits.length, example: hits[0]?.id ?? null };
  });
}

/**
 * The smallest set of item ids that renders every reachable branch.
 *
 * Greedy set cover, so adding a branch does not necessarily add a panel: one item often
 * exercises several (Lens-Maker's Glasses covers both the corruption pair and a stacking cap).
 * Sorted for a stable order — a sweep that changes its panel list between runs cannot assert
 * its own denominator.
 */
export function representativeItems(): string[] {
  const remaining = branchCoverage().filter((b) => b.count > 0);
  const chosen: string[] = [];
  const covered = new Set<string>();
  while (covered.size < remaining.length) {
    let best: { id: string; gain: number } | null = null;
    for (const item of all) {
      const gain = remaining.filter((r) => !covered.has(r.branch.name) && r.branch.match(item)).length;
      if (gain > 0 && (!best || gain > best.gain)) best = { id: item.id, gain };
    }
    if (!best) break;
    chosen.push(best.id);
    const picked = all.find((i) => i.id === best!.id)!;
    for (const r of remaining) if (r.branch.match(picked)) covered.add(r.branch.name);
  }
  return chosen.sort();
}
