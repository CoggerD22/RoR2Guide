/**
 * pnpm data:diff — ground-truth check of items.json against the game's own
 * language files (PLAN §4.6). Reads the RoR2 install's
 *   .../StreamingAssets/Language/en/*.json
 * and, matching by item NAME, reports:
 *   - names in items.json not found in the game files (wrong/misspelled name)
 *   - pickup-text mismatches (verbatim compare)
 *   - numeric mismatches between our description and the game's (e.g. 70 vs 75)
 *
 * This is a local verification tool — the game files live on the player's
 * machine, not in the repo or CI. Point it at the language folder via the
 * ROR2_LANG_DIR env var or the first CLI arg; a sensible default is tried too.
 *
 * It is a REPORT (always exits 0) — a human decides which diffs are real.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { itemsFileSchema } from "../src/data/schema.ts";
import { ARTIFACTS, LOADOUT_UNLOCKS } from "../src/data/reference.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

const DEFAULT_DIR =
  "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data/StreamingAssets/Language/en";
const langDir = process.argv[2] ?? process.env.ROR2_LANG_DIR ?? DEFAULT_DIR;

// Files that hold item/equipment name+pickup+desc tokens.
const LANG_FILES = [
  "Items.json",
  "Equipment.json",
  "Artifacts.json",
  "Achievements.json",
  "DLC1.json",
  "DLC2.json",
  "DLC3.json",
];

function loadStrings(dir: string): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const f of LANG_FILES) {
    const p = join(dir, f);
    if (!existsSync(p)) continue;
    try {
      // DLC language files ship with a UTF-8 BOM that breaks JSON.parse.
      const text = readFileSync(p, "utf8").replace(/^﻿/, "");
      const data = JSON.parse(text) as { strings?: Record<string, string> };
      Object.assign(merged, data.strings ?? {});
    } catch (e) {
      console.error(`  ! could not parse ${f}: ${(e as Error).message}`);
    }
  }
  return merged;
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/\\[rn]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’′`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\.{2,}/g, ".") // collapse ".." / "..." (game has typo double-periods)
    .replace(/\s+/g, " ")
    .trim();

// Drop a leading "Survivor: " prefix — the game names skill challenges
// "Commando: Godspeed" while we display the bare challenge under a header.
const stripSurvivor = (s: string) => s.replace(/^[^:]+:\s*/, "");

const numbersOf = (s: string) => {
  const found = stripTags(s).match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.map((n) => n.replace(/\.0+$/, "")))].sort(
    (a, b) => Number(a) - Number(b),
  );
};

function main(): number {
  if (!existsSync(langDir)) {
    console.log(`data:diff — language folder not found:\n  ${langDir}`);
    console.log("Pass it as: pnpm data:diff \"<path-to>/Language/en\"  (or set ROR2_LANG_DIR)");
    return 0;
  }
  console.log(`data:diff — comparing against game files at:\n  ${langDir}\n`);

  const strings = loadStrings(langDir);

  // Build a name -> {pickup, desc} map from every *_NAME token.
  const gameByName = new Map<string, { pickup: string; desc: string }>();
  for (const key of Object.keys(strings)) {
    if (!key.endsWith("_NAME")) continue;
    const base = key.slice(0, -"_NAME".length);
    const name = strings[key];
    if (!name) continue;
    gameByName.set(norm(name), {
      pickup: strings[`${base}_PICKUP`] ?? "",
      desc: strings[`${base}_DESC`] ?? strings[`${base}_DESCRIPTION`] ?? "",
    });
  }
  const achievementNames = new Set<string>();
  for (const key of Object.keys(strings)) {
    if (key.startsWith("ACHIEVEMENT_") && key.endsWith("_NAME")) {
      achievementNames.add(norm(strings[key]));
      achievementNames.add(norm(stripSurvivor(strings[key])));
    }
  }
  console.log(
    `Loaded ${gameByName.size} named entries, ${achievementNames.size} challenge names.\n`,
  );

  const items = itemsFileSchema.parse(JSON.parse(readFileSync(resolve(root, "src/data/items.json"), "utf8")));

  const notFound: string[] = [];
  const pickupDiffs: string[] = [];
  const numberDiffs: string[] = [];

  for (const it of items) {
    if (it.subtype === "untiered") continue; // scrap / quest items: skip
    const g = gameByName.get(norm(it.name));
    if (!g) {
      notFound.push(`"${it.name}" (${it.id})`);
      continue;
    }
    if (g.pickup && norm(it.pickupText) !== norm(stripTags(g.pickup))) {
      pickupDiffs.push(
        `${it.name}\n     ours: ${it.pickupText}\n     game: ${stripTags(g.pickup)}`,
      );
    }
    if (g.desc) {
      const ours = new Set(numbersOf(it.description));
      const game = numbersOf(g.desc);
      // Only flag numbers the game shows that OURS is missing (real omissions).
      // Extra numbers on our side are usually the "Cooldown: Ns" we add to
      // equipment, which the game stores outside the description text.
      const missing = game.filter((n) => !ours.has(n));
      if (missing.length > 0) {
        numberDiffs.push(
          `${it.name}: missing ${missing.map((n) => `[${n}]`).join(" ")}  «${stripTags(g.desc)}»`,
        );
      }
    }
  }

  // --- Artifacts vs Artifacts.json (name + numbers) --------------------------
  const artifactDiffs: string[] = [];
  for (const a of ARTIFACTS) {
    const g = gameByName.get(norm(a.name));
    if (!g) {
      artifactDiffs.push(`${a.name}: name not found in game files`);
      continue;
    }
    if (g.desc) {
      const have = new Set(numbersOf(a.effect));
      const missing = numbersOf(g.desc).filter((n) => !have.has(n));
      if (missing.length > 0) {
        artifactDiffs.push(
          `${a.name}: missing ${missing.map((n) => `[${n}]`).join(" ")}  «${stripTags(g.desc)}»`,
        );
      }
    }
  }

  // --- Unlock challenge names vs the game's achievement names -----------------
  const challengeMisses: string[] = [];
  for (const it of items) {
    if (it.unlock && !achievementNames.has(norm(stripSurvivor(it.unlock)))) {
      challengeMisses.push(`item "${it.name}" unlock: "${it.unlock}"`);
    }
  }
  for (const s of LOADOUT_UNLOCKS) {
    for (const sk of s.skills) {
      if (!achievementNames.has(norm(stripSurvivor(sk.challenge)))) {
        challengeMisses.push(`${s.survivor} / ${sk.skill}: "${sk.challenge}"`);
      }
    }
  }

  const section = (title: string, list: string[]) => {
    console.log(`\n=== ${title} (${list.length}) ===`);
    for (const l of list) console.log(`  • ${l}`);
  };

  section("Names not found in game files (check spelling/exact name)", notFound);
  section("Pickup-text mismatches", pickupDiffs);
  section("Numeric mismatches (description numbers differ)", numberDiffs);
  section("Artifact mismatches", artifactDiffs);
  section("Unlock challenge names not found in game", challengeMisses);

  console.log(
    `\nSummary: ${items.length} items · ${notFound.length} name misses · ` +
      `${pickupDiffs.length} pickup diffs · ${numberDiffs.length} number diffs · ` +
      `${artifactDiffs.length} artifact diffs · ${challengeMisses.length} challenge misses.`,
  );
  console.log("(Numeric diffs include harmless cases — e.g. style/phrasing — so eyeball each.)");
  return 0;
}

process.exit(main());
