/**
 * Sync items.json `unlock` with the code-verified unlock chain (PLAN §6A.7).
 *
 * Source of truth is .gamedata/achievements.json, built from:
 *   ItemDef.unlockableDef (asset) -> [RegisterAchievement] (code) -> ACHIEVEMENT_* (text)
 *
 * Only writes entries whose full chain resolved. An item whose unlockableDef has no
 * granting achievement is left alone and reported — an unresolved gate stays visibly
 * unresolved rather than being filled with a guess.
 *
 * Run: python scripts/extract-unlockables.py && python scripts/extract-achievements.py
 *      && node scripts/apply-unlocks.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const itemsPath = resolve(root, "src/data/items.json");
const items = JSON.parse(readFileSync(itemsPath, "utf8"));
const ach = JSON.parse(readFileSync(resolve(root, ".gamedata/achievements.json"), "utf8"));

const game = new Map();
for (const kind of ["items", "equipment"]) {
  for (const [name, v] of Object.entries(ach[kind])) game.set(name, v);
}

let added = 0, corrected = 0, unchanged = 0;
const skipped = [];

for (const item of items) {
  const g = game.get(item.name);
  if (!g) {
    // Not gated by the game. If we claim it is, that's a false lock — report it.
    if (item.unlock) skipped.push(`${item.name}: site marks locked, game does not gate it`);
    continue;
  }
  if (!g.challenge || !g.requirement) {
    skipped.push(`${item.name}: gate exists (${g.unlockable}) but no granting achievement — left unmarked`);
    continue;
  }
  const next = { challenge: g.challenge, requirement: g.requirement };
  if (!item.unlock) {
    item.unlock = next;
    added++;
  } else if (
    item.unlock.challenge !== next.challenge ||
    item.unlock.requirement !== next.requirement
  ) {
    item.unlock = next;
    corrected++;
  } else {
    unchanged++;
  }
}

writeFileSync(itemsPath, JSON.stringify(items, null, 2) + "\n");
console.log(
  `items.json unlocks: ${added} added, ${corrected} corrected, ${unchanged} already correct.`,
);
for (const s of skipped) console.log(`  ⚠ ${s}`);
