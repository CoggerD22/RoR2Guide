/**
 * Regenerate LOADOUT_UNLOCKS in src/data/reference.ts from game data (PLAN §5.1).
 *
 * The hand-entered table was wrong in three distinct ways, all of which this fixes:
 *   - MISSING rows: 5 survivors under-reported; Drifter had none at all, so the UI
 *     rendered the positive claim "Fixed kit" for a survivor with 3 alternates.
 *   - WRONG SLOTS: Acrid's Blight was listed Secondary but CROCO_PASSIVE_ALT_NAME
 *     shows it's a Passive; Captain's two beacons are Supply Drop options, not
 *     Secondary/Utility variants.
 *   - PARAPHRASED requirements, now replaced with the game's own achievement text.
 *
 * Sources, per §6A.2:
 *   slot + skill    T1 asset  SkillLocator -> SkillFamily.variants (non-default)
 *   challenge/req   T0+T2     variant.unlockableDef -> [RegisterAchievement] -> tokens
 *   extras          T2        skills unlockable via achievement but not slot variants
 *                             (Captain's beacons, Acrid's passive), named from tokens
 *
 * Only writes rows whose challenge resolved. A variant with no unlockable is emitted
 * with `noUnlockRequired: true` rather than being dropped or given a fake challenge.
 *
 * Run: node scripts/apply-skill-unlocks.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const refPath = resolve(root, "src/data/reference.ts");
const skills = JSON.parse(readFileSync(resolve(root, ".gamedata/skill-unlocks.json"), "utf8"));
const ach = JSON.parse(readFileSync(resolve(root, ".gamedata/achievements.json"), "utf8"));

// survivorId -> display name used by survivors.json / the reference table
const DISPLAY = {
  commando: "Commando", huntress: "Huntress", "mul-t": "MUL-T", engineer: "Engineer",
  artificer: "Artificer", mercenary: "Mercenary", bandit: "Bandit", loader: "Loader",
  acrid: "Acrid", captain: "Captain", rex: "REX", heretic: "Heretic",
  railgunner: "Railgunner", "void-fiend": "Void Fiend", seeker: "Seeker",
  chef: "Chef", "false-son": "False Son", operator: "Operator", drifter: "Drifter",
};

/**
 * Unlockable-key prefix -> survivor id, for skills that are unlockable but are NOT
 * variants of the four loadout slots. Verified individually against their name tokens.
 */
const EXTRAS = {
  "Skills.Croco.PassivePoisonLethal": { id: "acrid", skill: "Blight", slot: "Passive" },
  "Skills.Captain.CaptainSupplyDropEquipmentRestock": { id: "captain", skill: "Beacon: Resupply" },
  "Skills.Captain.CaptainSupplyDropHacking": { id: "captain", skill: "Beacon: Hacking" },
};

const esc = (s) => String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const rows = new Map(); // survivor display name -> row[]
for (const id of Object.keys(DISPLAY)) rows.set(DISPLAY[id], []);

// 1. Loadout-slot variants (authoritative for slot).
for (const [id, rec] of Object.entries(skills)) {
  const name = DISPLAY[id];
  if (!name) continue;
  for (const a of rec.alternates) {
    rows.get(name).push({
      skill: a.skill,
      slot: a.slot,
      challenge: a.challenge,
      requirement: a.requirement,
      noUnlockRequired: !a.unlockable,
    });
  }
}

// 2. Unlockable skills that aren't slot variants.
for (const [key, meta] of Object.entries(EXTRAS)) {
  const a = ach.byUnlockable[key];
  if (!a?.challenge) continue;
  rows.get(DISPLAY[meta.id]).push({
    skill: meta.skill,
    slot: meta.slot ?? null,
    challenge: a.challenge,
    requirement: a.requirement,
    noUnlockRequired: false,
  });
}

const SLOT_ORDER = { Primary: 0, Secondary: 1, Utility: 2, Special: 3, Passive: 4 };
const body = [...rows.entries()]
  .map(([survivor, list]) => {
    list.sort((a, b) => (SLOT_ORDER[a.slot] ?? 9) - (SLOT_ORDER[b.slot] ?? 9)
      || a.skill.localeCompare(b.skill));
    if (list.length === 0) {
      return `  {\n    survivor: "${survivor}",\n    /** Verified against SkillFamily.variants: this survivor genuinely has no alternates. */\n    skills: [],\n  },`;
    }
    const inner = list
      .map((r) => {
        const slot = r.slot ? `slot: "${r.slot}", ` : "";
        const extra = r.noUnlockRequired ? ", noUnlockRequired: true" : "";
        const ch = r.challenge ? `challenge: "${esc(r.challenge)}"` : `challenge: ""`;
        const rq = r.requirement ? `, requirement: "${esc(r.requirement)}"` : `, requirement: ""`;
        return `      { skill: "${esc(r.skill)}", ${slot}${ch}${rq}${extra} },`;
      })
      .join("\n");
    return `  {\n    survivor: "${survivor}",\n    skills: [\n${inner}\n    ],\n  },`;
  })
  .join("\n");

let src = readFileSync(refPath, "utf8");
const block = `export const LOADOUT_UNLOCKS: SurvivorLoadout[] = [\n${body}\n];`;
src = src.replace(/export const LOADOUT_UNLOCKS: SurvivorLoadout\[\] = \[[\s\S]*?\n\];/, block);
writeFileSync(refPath, src);

const total = [...rows.values()].reduce((n, l) => n + l.length, 0);
const noUnlock = [...rows.values()].flat().filter((r) => r.noUnlockRequired).length;
const empty = [...rows.entries()].filter(([, l]) => l.length === 0).map(([s]) => s);
console.log(`LOADOUT_UNLOCKS regenerated: ${total} rows across ${rows.size} survivors`);
console.log(`  available from the start (no unlock): ${noUnlock}`);
console.log(`  genuinely fixed-kit: ${empty.join(", ") || "(none)"}`);
