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

  if (mismatches > 0) {
    console.error(`\n✗ ${mismatches} coefficient mismatch(es) vs code truth. Re-check statItems.ts.`);
    process.exit(1);
  }
  console.log("\n✓ statItems.ts matches the code-derived coefficients.");
}

main();
