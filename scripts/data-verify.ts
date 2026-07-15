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
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { STAT_ITEMS, type StatTarget } from "../src/data/statItems.ts";
import survivors from "../src/data/survivors.json" with { type: "json" };

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

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
  armor: number;
  jumpCount: number;
  baseAttackSpeed: number;
}

const SURVIVOR_TRUTH: Record<string, SurvivorTruth> = {
  "commando": { body: "CommandoBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "huntress": { body: "HuntressBody", health: [90, 27], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "bandit": { body: "Bandit2Body", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "mul-t": { body: "ToolbotBody", health: [200, 60], regen: [1, 0.2], damage: [11, 2.2], moveSpeed: 7, armor: 12, jumpCount: 1, baseAttackSpeed: 1 },
  "engineer": { body: "EngiBody", health: [130, 39], regen: [1, 0.2], damage: [14, 2.8], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "artificer": { body: "MageBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "mercenary": { body: "MercBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 20, jumpCount: 2, baseAttackSpeed: 1 },
  "rex": { body: "TreebotBody", health: [130, 39], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "loader": { body: "LoaderBody", health: [160, 48], regen: [2.5, 0.5], damage: [12, 2.4], moveSpeed: 7, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "acrid": { body: "CrocoBody", health: [160, 48], regen: [2.5, 0.5], damage: [15, 3], moveSpeed: 7, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "captain": { body: "CaptainBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "heretic": { body: "HereticBody", health: [440, 132], regen: [-6, -1.2], damage: [18, 3.6], moveSpeed: 8, armor: 0, jumpCount: 3, baseAttackSpeed: 1 },
  "railgunner": { body: "RailgunnerBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "void-fiend": { body: "VoidSurvivorBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "seeker": { body: "SeekerBody", health: [115, 34], regen: [0.75, 0.15], damage: [12, 2.4], moveSpeed: 7, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
  "false-son": { body: "FalseSonBody", health: [180, 54], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "chef": { body: "ChefBody", health: [110, 33], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "operator": { body: "DroneTechBody", health: [90, 27], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 0, jumpCount: 1, baseAttackSpeed: 1 },
  "drifter": { body: "DrifterBody", health: [170, 52], regen: [1, 0.2], damage: [12, 2.4], moveSpeed: 7, armor: 20, jumpCount: 1, baseAttackSpeed: 1 },
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
      ["baseArmor", t.armor, b.baseArmor],
      ["baseJumpCount", t.jumpCount, b.baseJumpCount],
      ["baseAttackSpeed", t.baseAttackSpeed, b.baseAttackSpeed],
    ];
    for (const [f, table, game] of cmp) {
      if (game === undefined) continue;
      if (r4(table) !== r4(game)) drift.push(`${id}.${f}: table ${table} vs game ${r4(game)}`);
    }
  }
  return drift;
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
  const drift = crossCheckBodies();
  if (!existsSync(BODIES)) {
    console.log("Live prefab cross-check: skipped (.gamedata/ absent — run scripts/extract-bodies.py locally).");
  } else if (drift.length === 0) {
    console.log("Live prefab cross-check: truth table matches a fresh extraction. ✓");
  } else {
    console.log("\n⚠ Live prefab cross-check — table differs from extraction (game patched?):");
    for (const d of drift) console.log(`  - ${d}`);
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
