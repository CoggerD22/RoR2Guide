/**
 * Reconcile the runtime proc dump (tools/ProcDumper -> BepInEx/proc-dump.csv)
 * against the statically-extracted proc data. This is the payoff of observing the
 * game directly: it can CONFIRM the static values, CONTRADICT them (which would be
 * a real bug), or resolve states static analysis never reached.
 *
 * Usage: node scripts/reconcile-proc-dump.mjs <path-to-proc-dump.csv>
 *
 * Reads only. Writes nothing — a human decides what to do with conflicts/new values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvArg = process.argv[2];
if (!csvArg) {
  console.error("usage: node scripts/reconcile-proc-dump.mjs <proc-dump.csv>");
  process.exit(2);
}
if (!fs.existsSync(csvArg)) {
  console.error(`No CSV at ${csvArg}. Run the ProcDumper plugin in-game first (see tools/ProcDumper/README.md).`);
  process.exit(1);
}

// --- observed: state -> { proc -> Set(kind) } ---------------------------------
const observed = new Map();
const rows = fs.readFileSync(csvArg, "utf8").trim().split(/\r?\n/).slice(1);
for (const line of rows) {
  const [kind, proc, , , state] = line.split(",");
  if (!state) continue;
  const p = Number(proc);
  if (!observed.has(state)) observed.set(state, new Map());
  const byProc = observed.get(state);
  if (!byProc.has(p)) byProc.set(p, new Set());
  byProc.get(p).add(kind);
}

// --- static truth: state -> proc (from .gamedata/procs.json stateProc) --------
const procsPath = path.join(root, ".gamedata", "procs.json");
const staticState = new Map();
if (fs.existsSync(procsPath)) {
  const p = JSON.parse(fs.readFileSync(procsPath, "utf8"));
  for (const [state, rec] of Object.entries(p.stateProc ?? {})) {
    if (rec && rec.proc != null) staticState.set(state, rec.proc);
  }
}

// --- loadout view: which shipped skills does an observed state back? -----------
const skills = JSON.parse(fs.readFileSync(path.join(root, "src/data/skills.json"), "utf8"));
const skillByState = new Map();
for (const d of skills) for (const k of d.skills) skillByState.set(k.state, `${d.survivor}/${k.name}`);

const r4 = (n) => Math.round(n * 10000) / 10000;
const confirm = [], conflict = [], novel = [], inconsistent = [];

for (const [state, byProc] of observed) {
  const procs = [...byProc.keys()];
  if (procs.length > 1) {
    inconsistent.push(`${state}: observed multiple procs ${procs.join(", ")} (conditional? investigate)`);
  }
  const obs = procs[0];
  const kinds = [...byProc.get(obs)].join("/");
  const loadout = skillByState.get(state) ? `  <- ${skillByState.get(state)}` : "";
  if (staticState.has(state)) {
    if (r4(staticState.get(state)) === r4(obs)) confirm.push(`${state}  ${obs} [${kinds}]`);
    else conflict.push(`${state}  static=${staticState.get(state)}  OBSERVED=${obs} [${kinds}]${loadout}`);
  } else {
    novel.push(`${state}  ${obs} [${kinds}]${loadout}`);
  }
}

const section = (title, arr) => {
  console.log(`\n### ${title} (${arr.length})`);
  if (arr.length) console.log(arr.map((x) => "  " + x).join("\n"));
};

console.log(`Reconciled ${rows.length} rows -> ${observed.size} distinct states fired.`);
section("CONFIRMED — runtime matches static extraction", confirm);
section("CONFLICT — runtime disagrees with static (investigate: one is wrong)", conflict);
section("NEW — states with no static value; runtime gives one", novel);
section("INCONSISTENT — a state fired with more than one proc", inconsistent);

if (conflict.length) {
  console.log("\n⚠ Conflicts found. Do NOT auto-apply — each needs a human to decide which source is right.");
  process.exit(1);
}
console.log("\nNo conflicts. Confirmed values strengthen the static data; NEW values are candidates to curate.");
