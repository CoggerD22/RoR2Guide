/**
 * pnpm data:verify — locks the Stat Lab's item coefficients to the values
 * transcribed from the game's decompiled CharacterBody.RecalculateStats()
 * (see MATH-VERIFICATION.md, Phase 2). Two layers:
 *
 *   1. Self-consistency (always, CI-safe): every entry in CODE_TRUTH below must
 *      match src/data/statItems.ts exactly. Editing a coefficient in statItems
 *      without updating CODE_TRUTH (i.e. without re-checking the code) fails the
 *      build. This is the regression guard.
 *   2. Live code grep (optional, local only): if the decompiled source is present
 *      (.decompiled/RoR2.CharacterBody.decompiled.cs, produced by
 *      scripts/decompile.sh and git-ignored), each entry's `code` pattern is
 *      searched for. A miss is advisory — it usually means the game patched and
 *      the coefficient needs re-verifying. Never fails CI (file isn't committed).
 *
 * CODE_TRUTH is the human transcription of the code; `source` cites the line in
 * RecalculateStats it came from so it can be re-checked after a patch.
 *
 * Exit code: non-zero if any self-consistency mismatch, else 0.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STAT_ITEMS, type StatTarget } from "../src/data/statItems.ts";
import survivors from "../src/data/survivors.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const ITEMS = join(root, "src", "data", "items.json");
/**
 * The game install. Same default and override as the Python extractors, so a machine with a
 * non-standard Steam library only has to set ROR2_DATA_DIR once.
 */
const GAME_DIR =
  process.env.ROR2_DATA_DIR ??
  "E:/SteamLibrary/steamapps/common/Risk of Rain 2/Risk of Rain 2_Data";

interface Truth {
  item: string;
  target: StatTarget;
  base: number;
  perStack: number;
  /** RecalculateStats() line the coefficient was read from. */
  source: string;
  /** Verbatim fragment expected in the decompiled method (advisory grep). */
  code?: string;
}

// Coefficients decoded from RoR2.CharacterBody.RecalculateStats(). Variable
// names (num10 = Syringe, num42 = Mocha, …) are the decompiler's; see
// .decompiled/ item→variable map at the top of the method.
const CODE_TRUTH: Truth[] = [
  { item: "soldiers-syringe", target: "attackSpeedPct", base: 15, perStack: 15,
    source: "num110 += num10 * 0.15f", code: "num10 * 0.15f" },
  { item: "mocha", target: "attackSpeedPct", base: 7.5, perStack: 7.5,
    source: "num110 += num42 * 0.075f", code: "num42 * 0.075f" },
  { item: "mocha", target: "moveSpeedPct", base: 7, perStack: 7,
    source: "num98 += num42 * 0.07f (move-speed block)" },
  { item: "pauls-goat-hoof", target: "moveSpeedPct", base: 14, perStack: 14,
    source: "num98 += num7 * 0.14f (move-speed block)" },
  { item: "lens-makers-glasses", target: "critChance", base: 10, perStack: 10,
    source: "num111 += num11 * 10f", code: "num11 * 10f" },
  { item: "predatory-instincts", target: "critChance", base: 5, perStack: 0,
    source: "if (num12 > 0) num111 += 5f" },
  { item: "harvesters-scythe", target: "critChance", base: 5, perStack: 0,
    source: "if (num14 > 0) num111 += 5f" },
  { item: "laser-scope", target: "critDamagePct", base: 100, perStack: 100,
    source: "critMultiplier = 2f + 1f * num44", code: "2f + 1f * (float)num44" },
  { item: "bison-steak", target: "healthFlat", base: 25, perStack: 25,
    source: "num78 += num37 * 25f (health block)" },
  { item: "titanic-knurl", target: "healthFlat", base: 40, perStack: 40,
    source: "num78 += num17 * 40f (health block)" },
  { item: "titanic-knurl", target: "regenFlat", base: 1.6, perStack: 1.6,
    source: "num86 = num17 * 1.6f * num85 (regen block, level-scaled)" },
  { item: "pearl", target: "healthPct", base: 10, perStack: 10,
    source: "num80 = 1 + num30 * 0.1f (health multiplier)" },
  { item: "hopoo-feather", target: "jumpFlat", base: 1, perStack: 1,
    source: "maxJumpCount = baseJumpCount + num9" },
];

// Behaviors that statMath handles specially (not linear coefficients).
const SPECIAL_NOTES = [
  { item: "shaped-glass", note: "damage num103 += Pow(2,num28)-1; health via Curse cursePenalty=Pow(2,num28) -> effHP x0.5^n" },
  { item: "irradiant-pearl", note: "+10%/stack to health/regen/move/attackSpd/crit/armor (num31 across all blocks)" },
];

const DECOMPILED = join(root, ".decompiled", "RoR2.CharacterBody.decompiled.cs");
const BODIES = join(root, ".gamedata", "bodies.json");

/**
 * Survivor base stats read out of the game's body PREFABS (asset bundles) by
 * scripts/extract-bodies.py — they are not in RoR2.dll, so this is their only
 * authoritative source. `body` is the GameObject name, proven from each
 * SurvivorDef's cachedName (note Operator's body is DroneTechBody).
 * Tuples are [base, perLevel]. Regenerate after a patch: run the extractor,
 * then `pnpm data:verify` cross-checks this table against the fresh dump.
 */
interface SurvivorTruth {
  body: string;
  health: [number, number];
  regen: [number, number];
  damage: [number, number];
  moveSpeed: number;
  acceleration: number;
  armor: number;
  jumpCount: number;
  baseAttackSpeed: number;
}

const SURVIVOR_TRUTH: Record<string, SurvivorTruth> = {
  "commando": { body: "CommandoBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "huntress": { body: "HuntressBody", health: [90, 27], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "bandit": { body: "Bandit2Body", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "mul-t": { body: "ToolbotBody", health: [200, 60], regen: [1, 0.2], damage: [11, 2.2], moveSpeed: 7, acceleration: 30, armor: 12, jumpCount: 1, baseAttackSpeed: 1 },
  "engineer": { body: "EngiBody", health: [130, 39], regen: [1, 0.2], damage: [14, 2.8], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "artificer": { body: "MageBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 40, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "mercenary": { body: "MercBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 20, jumpCount: 2, baseAttackSpeed: 1 },
  "rex": { body: "TreebotBody", health: [130, 39], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "loader": { body: "LoaderBody", health: [160, 48], regen: [2.5, 0.5], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "acrid": { body: "CrocoBody", health: [160, 48], regen: [2.5, 0.5], damage: [15, 3], moveSpeed: 7, acceleration: 80, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "captain": { body: "CaptainBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "heretic": { body: "HereticBody", health: [440, 132], regen: [-6, -1.2], damage: [18, 3.6], moveSpeed: 8, acceleration: 80, armor: 0, jumpCount: 3, baseAttackSpeed: 1 },
  "railgunner": { body: "RailgunnerBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "void-fiend": { body: "VoidSurvivorBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "seeker": { body: "SeekerBody", health: [115, 34], regen: [0.75, 0.15], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "false-son": { body: "FalseSonBody", health: [180, 54], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 50, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "chef": { body: "ChefBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "operator": { body: "DroneTechBody", health: [90, 27], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "drifter": { body: "DrifterBody", health: [170, 52], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, acceleration: 80, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
};

const r4 = (n: number) => Math.round(n * 10000) / 10000;

/** Layer 1: survivors.json must match the prefab-derived truth table. */
function checkSurvivors(): number {
  let bad = 0;
  for (const s of survivors) {
    const t = SURVIVOR_TRUTH[s.id];
    if (!t) {
      console.error(`✗ survivor "${s.id}" has no prefab truth entry (new survivor? re-run extract-bodies.py)`);
      bad++;
      continue;
    }
    const pairs: Array<[string, number, number]> = [
      ["health.base", s.health.base, t.health[0]],
      ["health.perLevel", s.health.perLevel, t.health[1]],
      ["regen.base", s.regen.base, t.regen[0]],
      ["regen.perLevel", s.regen.perLevel, t.regen[1]],
      ["damage.base", s.damage.base, t.damage[0]],
      ["damage.perLevel", s.damage.perLevel, t.damage[1]],
      ["moveSpeed", s.moveSpeed, t.moveSpeed],
      ["armor", s.armor, t.armor],
      ["jumpCount", s.jumpCount, t.jumpCount],
      ["baseAttackSpeed", s.baseAttackSpeed, t.baseAttackSpeed],
    ];
    for (const [label, mine, game] of pairs) {
      if (r4(mine) !== r4(game)) {
        console.error(`✗ ${s.id}.${label}: survivors.json has ${mine}, prefab ${t.body} has ${game}`);
        bad++;
      }
    }
  }
  return bad;
}

/** Layer 2 (local only): truth table vs a fresh extraction — catches patch drift. */
function crossCheckBodies(): string[] {
  if (!existsSync(BODIES)) return [];
  const dump = JSON.parse(readFileSync(BODIES, "utf8")) as Record<string, Record<string, number>>;
  const drift: string[] = [];
  for (const [id, t] of Object.entries(SURVIVOR_TRUTH)) {
    const b = dump[t.body];
    if (!b) {
      drift.push(`${id}: body ${t.body} missing from extraction`);
      continue;
    }
    const cmp: Array<[string, number, number]> = [
      ["baseMaxHealth", t.health[0], b.baseMaxHealth],
      ["levelMaxHealth", t.health[1], b.levelMaxHealth],
      ["baseRegen", t.regen[0], b.baseRegen],
      ["levelRegen", t.regen[1], b.levelRegen],
      ["baseDamage", t.damage[0], b.baseDamage],
      ["levelDamage", t.damage[1], b.levelDamage],
      ["baseMoveSpeed", t.moveSpeed, b.baseMoveSpeed],
      ["baseAcceleration", t.acceleration, b.baseAcceleration],
      ["baseArmor", t.armor, b.baseArmor],
      ["baseJumpCount", t.jumpCount, b.baseJumpCount],
      ["baseAttackSpeed", t.baseAttackSpeed, b.baseAttackSpeed],
    ];
    for (const [f, table, game] of cmp) {
      if (game === undefined) continue;
      if (r4(table) !== r4(game)) drift.push(`${id}.${f}: table ${table} vs game ${r4(game)}`);
    }

    // ARMOR IS MODELLED AS FLAT, and nothing checked that assumption until now.
    // `RecalculateStats` computes `armor = baseArmor + levelArmor * num72` — exactly the same
    // shape as health and damage. But `SURVIVOR_TRUTH` stores armor as a scalar and
    // `statMath.ts` uses `survivor.armor` directly rather than putting it through `scale()`.
    // That is correct today: of 241 extracted bodies only MegaDroneBody carries a non-zero
    // levelArmor (5), and no playable survivor does. It is correct by the luck of the data
    // rather than by construction, so a patch giving any survivor level-scaling armor would
    // silently make every Stat Lab armor figure wrong above level 1 (MATH-VERIFICATION
    // §3j.121).
    // EVERY stat statMath treats as non-scaling, checked rather than assumed.
    // `RecalculateStats` gives armor, attack speed, crit, move speed, jump power and shield
    // the same `base + level * factor` shape as health and damage. Our schema stores a scalar
    // for each, and `statMath` never puts them through `scale()`. That is right today —
    // all six are 0 across all 19 bodies — but right because of what the data happens to
    // contain, not because of anything the code does. A patch making any of them scale would
    // silently make the whole sheet wrong above level 1 (MATH-VERIFICATION §3j.121, §3j.124).
    const FLAT: Array<[string, string]> = [
      ["levelArmor", "armor"],
      ["levelAttackSpeed", "baseAttackSpeed"],
      ["levelCrit", "crit (statMath hardcodes a 1% base)"],
      ["levelMoveSpeed", "moveSpeed"],
      ["levelJumpPower", "jump power"],
      ["levelMaxShield", "shield (assumed 0 unless Transcendence converts health)"],
    ];
    for (const [field, modelled] of FLAT) {
      const v = b[field];
      if (v !== undefined && r4(v) !== 0) {
        drift.push(
          `${id}.${field}: game says ${r4(v)}, but ${modelled} is stored as a flat number and ` +
            `statMath does not scale it with level — it needs a [base, perLevel] pair before ` +
            `this survivor can be shown correctly above level 1`,
        );
      }
    }
  }
  return drift;
}

/**
 * Void corruption pairs, checked against the game rather than only against ourselves.
 *
 * `data:audit` already enforces that `corrupts` and `corruptedBy` agree (CLAUDE.md rule
 * #4) — but that is internal consistency only. A pair could be mutually consistent and
 * still not exist in the game, or the game could have a pair we never recorded, and
 * nothing would notice. Both directions are compared here.
 *
 * Local-only, like the prefab cross-check: `.gamedata/` is git-ignored, so this is silent
 * in CI and advisory on a dev machine.
 */
function crossCheckCorruption(): string[] {
  const defsPath = resolve(root, ".gamedata/itemdefs.json");
  if (!existsSync(defsPath)) return [];
  const defs = JSON.parse(readFileSync(defsPath, "utf8")) as {
    items: Array<{ cachedName: string; name: string }>;
    corruption?: Array<Record<string, string>>;
  };
  const itemsRaw = JSON.parse(
    readFileSync(resolve(root, "src/data/items.json"), "utf8"),
  ) as Array<{ id: string; name: string; corrupts?: string[] }>;

  const cachedToName = new Map(defs.items.map((d) => [d.cachedName, d.name]));
  const pairKey = (voidName: string, origName: string) => `${voidName} -> ${origName}`;

  const game = new Set<string>();
  for (const p of defs.corruption ?? []) {
    const vals = Object.values(p);
    const orig = cachedToName.get(p.original ?? vals[0]);
    const vd = cachedToName.get(p.void ?? vals[1]);
    if (orig && vd) game.add(pairKey(vd, orig));
  }

  const byId = new Map(itemsRaw.map((i) => [i.id, i]));
  const ours = new Set<string>();
  for (const i of itemsRaw) {
    for (const t of i.corrupts ?? []) {
      const o = byId.get(t);
      ours.add(pairKey(i.name, o ? o.name : t));
    }
  }

  const drift: string[] = [];
  for (const g of game) if (!ours.has(g)) drift.push(`missing pair the game has: ${g}`);
  for (const o of ours) if (!game.has(o)) drift.push(`pair we assert, game does not: ${o}`);
  return drift;
}

/**
 * Completeness: does the codex contain every item the game can actually drop?
 *
 * Every other check in this project asks whether what we HAVE is correct. None asked
 * whether anything was MISSING — and five real items were absent for the entire life of
 * the project: the Alloyed Collective FoodTier items (Hearty Stew, Quick Fix, Sautéed
 * Worms, Seared Steak, Ultimate Meal). They are fully localized and have their own drop
 * list (`Run.availableFoodTierDropList`), so nothing about them was speculative; they
 * simply were never added, and a codex that silently omits items is wrong in a way no
 * amount of per-record verification would ever surface.
 *
 * Compares against every ItemDef with a real name and a real tier. `NoTier` is excluded:
 * those cannot drop (StatsFromScrap, the *Suppressed variants, unreleased content).
 */
function crossCheckCompleteness(): string[] {
  const defsPath = resolve(root, ".gamedata/itemdefs.json");
  if (!existsSync(defsPath)) return [];
  const defs = JSON.parse(readFileSync(defsPath, "utf8")) as {
    items: Array<{ name: string; tier: string; dlc: string }>;
    equipment?: Array<{ name: string; canDrop: boolean; dlc: string }>;
  };
  const itemsRaw = JSON.parse(
    readFileSync(resolve(root, "src/data/items.json"), "utf8"),
  ) as Array<{ name: string }>;
  const ours = new Set(itemsRaw.map((i) => i.name));
  const gaps = defs.items
    .filter((d) => d.name && d.name !== "?" && d.tier && d.tier !== "NoTier")
    .filter((d) => !ours.has(d.name))
    .map((d) => `codex is missing "${d.name}" (${d.tier}, ${d.dlc})`);

  // Equipment lives in a separate list, and the first version of this check ignored it
  // entirely — a hole in the very check written to close a hole. `Run.cs` gates every
  // equipment drop pool on `if (equipmentDef.canDrop)`, so canDrop is the obtainability
  // test for anything that comes out of a chest or pod.
  for (const e of defs.equipment ?? []) {
    if (!e.name || e.name === "?" || !e.canDrop) continue;
    if (!ours.has(e.name)) gaps.push(`codex is missing equipment "${e.name}" (${e.dlc})`);
  }

  // canDrop:false equipment is obtainable ONLY if something else grants it — the elite
  // Aspects drop from elites via their EliteDef, which is why those are in the codex.
  // Everything below was checked individually and is genuinely unreachable in a run;
  // listing them here means a future DLC adding a new one gets flagged rather than
  // silently assumed to be cut.
  const REVIEWED_UNOBTAINABLE = new Set([
    "Beyond the Limits",       // EliteSecretSpeedEquipment — referenced NOWHERE in the assembly
    "Overloading Excavator",   // IrradiatingLaser — likewise, no references at all
    "Coven of Gold",           // JunkContent.EliteGoldEquipment
    "Jar of Souls",            // JunkContent.SoulJar
    "Reaper's Remorse",        // JunkContent.GhostGun
    "Elegy of Extinction",     // DLC1, implemented + enabled, but canDrop:false and in no
                               // pool; its lore is still a literal dev placeholder
    "G-Force Accelerator",     // DLC3, implemented + enabled, canDrop:false, in no pool
    "Seed of Life (Consumed)", // post-use state of an item we already carry
    "Trophy Hunter's Tricorn (Consumed)",
  ]);
  for (const e of defs.equipment ?? []) {
    // An unresolved token as the "name" (EQUIPMENT_SOULCORRUPTOR_NAME) means the def has
    // no English language entry at all, so it has no player-facing existence — the same
    // signal that correctly excludes StatsFromScrap (3j.23).
    if (!e.name || e.name === "?" || /^[A-Z][A-Z0-9_]+$/.test(e.name) || e.canDrop) continue;
    if (ours.has(e.name) || REVIEWED_UNOBTAINABLE.has(e.name)) continue;
    gaps.push(
      `equipment "${e.name}" (${e.dlc}) is neither in the codex nor in the reviewed ` +
        `unobtainable list — check whether something grants it`,
    );
  }
  return gaps;
}

/**
 * Equipment cooldowns vs `EquipmentDef.cooldown` on the game's own assets.
 *
 * 41 numbers that nothing checked. `data:diff` cannot: the game stores cooldowns OUTSIDE the
 * description text, which is why the site appends "Cooldown: Ns" itself. All 41 turned out
 * correct (MATH-VERIFICATION §3j.126) — the gap was that nothing would have said otherwise.
 *
 * The mapping is the awkward part. Display name comes from `EQUIPMENT_<X>_NAME` in the
 * language files, but `<X>` is NOT always the def's cachedName: Sawmerang's def is `Saw` and
 * Recycler's is `Recycle`, and the ten elite aspects are tokenised by COLOUR (`affixred`)
 * while their defs are named by ELEMENT (`EliteFireEquipment`). Those aliases are listed
 * explicitly below rather than guessed at by fuzzy matching, because misfiling one record
 * onto another item is a mistake this project has already made once (§3j.66).
 *
 * What makes the aspect pairing trustworthy rather than assumed: the cooldowns are NOT
 * uniform. They split 6/4 between 10s and 25s, and every aspect lands on the right one.
 */
const EQUIPMENT_TOKEN_ALIAS: Record<string, string> = {
  sawmerang: "saw",
  recycler: "recycle",
  affixred: "elitefireequipment",
  affixblue: "elitelightningequipment",
  affixwhite: "eliteiceequipment",
  affixhaunted: "elitehauntedequipment",
  affixbead: "elitebeadequipment",
  affixpoison: "elitepoisonequipment",
  affixearth: "eliteearthequipment",
  affixlunar: "elitelunarequipment",
  affixcollective: "elitecollectiveequipment",
  affixaurelionite: "eliteaurelioniteequipment",
};

function crossCheckCooldowns(): { drift: string[]; compared: number; total: number } {
  const drift: string[] = [];
  const fieldsPath = join(root, ".gamedata", "component-fields.json");
  const itemsRaw = JSON.parse(readFileSync(ITEMS, "utf8")) as Array<{
    name: string;
    cooldown?: number;
  }>;
  const withCooldown = itemsRaw.filter((i) => i.cooldown !== undefined);
  if (!existsSync(fieldsPath)) return { drift, compared: 0, total: withCooldown.length };

  const dump = JSON.parse(readFileSync(fieldsPath, "utf8")) as Record<
    string,
    Array<{ owner?: string; fields?: Record<string, number> }>
  >;
  const game = new Map<string, number>();
  for (const r of dump.cooldown ?? []) {
    const f = r.fields ?? {};
    // EquipmentDef-shaped: a cooldown alongside one of its own sibling flags.
    if (f.cooldown === undefined) continue;
    if (!("isLunar" in f) && !("enigmaCompatible" in f)) continue;
    if (r.owner) game.set(r.owner.toLowerCase(), f.cooldown);
  }
  if (game.size === 0) return { drift, compared: 0, total: withCooldown.length };

  const tokenOf = equipmentNameToToken();
  let compared = 0;
  for (const it of withCooldown) {
    const raw = tokenOf.get(it.name);
    if (!raw) continue;
    const key = EQUIPMENT_TOKEN_ALIAS[raw] ?? raw;
    const gameCd = game.get(key);
    if (gameCd === undefined) {
      drift.push(`${it.name}: no EquipmentDef found (token ${raw} -> ${key})`);
      continue;
    }
    compared++;
    if (r4(it.cooldown!) !== r4(gameCd)) {
      drift.push(`${it.name}.cooldown: ours ${it.cooldown} vs game ${r4(gameCd)}`);
    }
  }
  return { drift, compared, total: withCooldown.length };
}

/** Display name -> the `X` in `EQUIPMENT_X_NAME`, read from the game's language files. */
function equipmentNameToToken(): Map<string, string> {
  const out = new Map<string, string>();
  const dir = join(GAME_DIR, "StreamingAssets", "Language", "en");
  if (!existsSync(dir)) return out;
  for (const fn of readdirSync(dir)) {
    if (!fn.endsWith(".json")) continue;
    let strings: Record<string, unknown>;
    try {
      const raw = readFileSync(join(dir, fn), "utf8").replace(/^\uFEFF/, "");
      strings = (JSON.parse(raw).strings ?? {}) as Record<string, unknown>;
    } catch {
      continue;
    }
    for (const [k, v] of Object.entries(strings)) {
      const m = /^EQUIPMENT_([A-Z0-9_]+)_NAME$/.exec(k);
      if (m && typeof v === "string") out.set(v.trim(), m[1].toLowerCase());
    }
  }
  return out;
}

function main() {
  let mismatches = 0;
  const codeMiss: string[] = [];
  const source = existsSync(DECOMPILED) ? readFileSync(DECOMPILED, "utf8") : null;

  for (const t of CODE_TRUTH) {
    const effects = STAT_ITEMS[t.item];
    if (!effects) {
      console.error(`✗ ${t.item}: not present in statItems.ts`);
      mismatches++;
      continue;
    }
    const e = effects.find((x) => x.target === t.target);
    if (!e) {
      console.error(`✗ ${t.item}: missing ${t.target} effect (code: ${t.source})`);
      mismatches++;
      continue;
    }
    if (e.base !== t.base || e.perStack !== t.perStack) {
      console.error(
        `✗ ${t.item}.${t.target}: statItems has ${e.base}/${e.perStack}, code says ${t.base}/${t.perStack} (${t.source})`,
      );
      mismatches++;
    }
    if (source && t.code && !source.includes(t.code)) {
      codeMiss.push(`${t.item}.${t.target} — pattern "${t.code}" not found (${t.source})`);
    }
  }

  const verified = new Set(CODE_TRUTH.map((t) => t.item));
  console.log(`\n${CODE_TRUTH.length} coefficients checked across ${verified.size} items.`);
  console.log(`Special-cased (documented, not coefficient-checked): ${SPECIAL_NOTES.map((s) => s.item).join(", ")}`);

  if (source) {
    if (codeMiss.length === 0) {
      console.log("Live decompiled grep: all patterns still present. ✓");
    } else {
      console.log("\n⚠ Live decompiled grep — patterns not found (re-verify vs game code):");
      for (const m of codeMiss) console.log(`  - ${m}`);
    }
  } else {
    console.log("Live decompiled grep: skipped (.decompiled/ absent — run scripts/decompile.sh locally).");
  }

  // --- survivor base stats (prefab-derived truth) ---
  const survivorBad = checkSurvivors();
  const nSurv = Object.keys(SURVIVOR_TRUTH).length;
  console.log(`\n${nSurv} survivors x 10 base-stat fields checked against prefab truth.`);
  // --- equipment cooldowns vs EquipmentDef.cooldown ---
  const cd = crossCheckCooldowns();
  if (cd.compared === 0) {
    console.log(
      "Equipment cooldowns: skipped (needs .gamedata/component-fields.json — run " +
        "`python scripts/extract-component-fields.py cooldown` locally).",
    );
  } else if (cd.drift.length === 0) {
    console.log(`Equipment cooldowns: ${cd.compared}/${cd.total} checked against EquipmentDef. \u2713`);
  } else {
    console.log("\n\u26a0 Equipment cooldowns differ from the game:");
    for (const d of cd.drift) console.log(`  - ${d}`);
  }

  const drift = crossCheckBodies();
  if (!existsSync(BODIES)) {
    console.log("Live prefab cross-check: skipped (.gamedata/ absent — run scripts/extract-bodies.py locally).");
  } else if (drift.length === 0) {
    console.log("Live prefab cross-check: truth table matches a fresh extraction. ✓");
  } else {
    console.log("\n⚠ Live prefab cross-check — table differs from extraction (game patched?):");
    for (const d of drift) console.log(`  - ${d}`);
  }

  const corruptDrift = crossCheckCorruption();
  if (!existsSync(resolve(root, ".gamedata/itemdefs.json"))) {
    console.log("Void corruption cross-check: skipped (.gamedata/ absent).");
  } else if (corruptDrift.length === 0) {
    console.log("Void corruption cross-check: all pairs match the game, both ways. ✓");
  } else {
    console.log("\n⚠ Void corruption cross-check — our pairs differ from the game's:");
    for (const d of corruptDrift) console.log(`  - ${d}`);
  }

  const gaps = crossCheckCompleteness();
  if (!existsSync(resolve(root, ".gamedata/itemdefs.json"))) {
    console.log("Codex completeness: skipped (.gamedata/ absent).");
  } else if (gaps.length === 0) {
    console.log("Codex completeness: every droppable game item is present. ✓");
  } else {
    console.log("\n⚠ Codex completeness — the game has items we do not:");
    for (const g of gaps) console.log(`  - ${g}`);
  }

  const total = mismatches + survivorBad;
  if (total > 0) {
    console.error(`\n✗ ${total} mismatch(es) vs game truth (${mismatches} item coefficient, ${survivorBad} survivor stat).`);
    process.exit(1);
  }
  console.log("\n✓ statItems.ts matches the code-derived coefficients.");
  console.log("✓ survivors.json matches the game's body prefabs.");
}

main();
