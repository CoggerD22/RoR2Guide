/**
 * pnpm data:roster — completeness check of items.json against the game's OWN item
 * roster, extracted from the bundles by scripts/extract-itemdefs.py.
 *
 * data:diff verifies the items we HAVE (names/pickups/numbers vs the language files).
 * This checks the other direction — does the game have a pickup we're MISSING, or do
 * we have an entry the game doesn't back — which is how a new-DLC item would slip
 * through. (Both real bugs this project caught, Heretic's kit and the loadout slots,
 * came from cross-checking datasets rather than re-reading one.)
 *
 * FATAL (exit 1):
 *   - a game item with a normal DROPPABLE tier (Tier1/2/3, Lunar, Boss, Void*) is not
 *     in items.json — an unambiguous missing pickup.
 *   - an items.json entry matches no game def — stale / renamed.
 * REVIEW (exit 0, printed): equipment we don't have. Equipment is deliberately not
 *   fatal: elite aspects (canDrop=false) are legitimately in our codex, while cut
 *   content lives in the files too, so "missing equipment" needs a human eye.
 *
 * Reads .gamedata/itemdefs.json; if absent (e.g. CI), passes with a note.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { itemsFileSchema } from "../src/data/schema.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const DEFS = join(root, ".gamedata", "itemdefs.json");
const ITEMS = join(root, "src", "data", "items.json");

const DROPPABLE = new Set([
  "Tier1", "Tier2", "Tier3", "Lunar", "Boss",
  "VoidTier1", "VoidTier2", "VoidTier3", "VoidBoss",
]);

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

interface ItemDef { name: string; token: string; tier: string; cachedName: string; dlc: string | null }
interface EquipDef { name: string; cachedName: string; isConsumed: boolean; dlc: string | null }

function main(): number {
  if (!existsSync(DEFS)) {
    console.log("data:roster — .gamedata/itemdefs.json absent; run scripts/extract-itemdefs.py locally. Passing.");
    return 0;
  }

  const defs = JSON.parse(readFileSync(DEFS, "utf8")) as { items: ItemDef[]; equipment: EquipDef[] };
  const ours = itemsFileSchema.parse(JSON.parse(readFileSync(ITEMS, "utf8")));
  const ourByName = new Set(ours.map((i) => norm(i.name)));
  const allDefs = [...defs.items, ...defs.equipment];
  const gameByName = new Set(allDefs.map((d) => norm(d.name)));
  // DLC from the bundle prefix (ror2-base/dlc1/dlc2/dlc3) — authoritative per asset.
  const dlcByName = new Map(allDefs.filter((d) => d.name !== "?" && d.dlc).map((d) => [norm(d.name), d.dlc!]));

  const errors: string[] = [];
  const review: string[] = [];

  // Missing droppable-tier items = unambiguous gaps.
  for (const d of defs.items) {
    if (d.name === "?" || !DROPPABLE.has(d.tier)) continue;
    if (!ourByName.has(norm(d.name))) errors.push(`MISSING item [${d.tier}] "${d.name}" (${d.cachedName})`);
  }

  // Our entries with no game def = stale/renamed; and wrong DLC vs the bundle.
  for (const o of ours) {
    if (!gameByName.has(norm(o.name))) {
      errors.push(`STALE entry "${o.name}" [${o.tier}] has no game ItemDef/EquipmentDef`);
      continue;
    }
    const gameDlc = dlcByName.get(norm(o.name));
    if (gameDlc && gameDlc !== o.dlc) {
      errors.push(`DLC wrong for "${o.name}": ours="${o.dlc}", game bundle="${gameDlc}"`);
    }
  }

  // Equipment we don't have — review only (aspects vs cut content).
  for (const e of defs.equipment) {
    if (e.name === "?" || e.isConsumed) continue; // consumed variants excluded by design
    if (!ourByName.has(norm(e.name))) review.push(`equipment not in codex: "${e.name}" (${e.cachedName})`);
  }

  console.log(
    `data:roster — ${defs.items.length} ItemDefs / ${defs.equipment.length} EquipmentDefs vs ${ours.length} codex entries.`,
  );
  if (review.length) {
    console.log(`\n${review.length} equipment for review (elite aspect vs cut content — human call):`);
    for (const r of review) console.log(`  · ${r}`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} roster error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    return 1;
  }
  console.log("\n✓ Every droppable-tier game item is in the codex, and every codex entry is backed by a game def.");
  return 0;
}

process.exit(main());
