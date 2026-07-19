/**
 * Build src/data/skills.json — each survivor's loadout skills with a verified proc
 * coefficient where one can be established, and an explicit `verified` flag.
 *
 * Inputs (both local, git-ignored — Gearbox data):
 *   .gamedata/loadouts.json                      (scripts/extract-loadouts.py: loadout
 *                                                 structure + ESC/projectile-resolved procs)
 *   .decompiled/full/RoR2.decompiled.cs          (scripts/decompile.sh, full assembly)
 *
 * Resolution, most-authoritative first:
 *   1. ESC proc field (procCoefficient / orbProcCoefficient / blastProcCoefficient / …)
 *   2. projectilePrefab -> projectile's procCoefficient
 *   3. code: explicit `.procCoefficient = <literal>` in the state
 *   4. code: state creates BulletAttack/OverlapAttack/BlastAttack and does NOT fire a
 *      projectile -> framework default 1.0 (BulletAttack/OverlapAttack/BlastAttack all
 *      initialise procCoefficient = 1f; verified in the decompile)
 * Anything else (charge/sub-state indirection, projectile fired from a code field,
 * genuinely non-damaging utility) is left proc:null, verified:false, source "review:*"
 * — NEVER guessed.
 *
 * Usage: node scripts/build-skill-procs.mjs   (after the two extractors have run)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LOAD = path.join(root, ".gamedata", "loadouts.json");
const DECOMP = path.join(root, ".decompiled", "full", "RoR2.decompiled.cs");
const OUT = path.join(root, "src", "data", "skills.json");

if (!fs.existsSync(LOAD)) {
  console.error(`Missing ${LOAD}. Run scripts/extract-loadouts.py first.`);
  process.exit(1);
}
const loadouts = JSON.parse(fs.readFileSync(LOAD, "utf8"));
const lines = fs.existsSync(DECOMP) ? fs.readFileSync(DECOMP, "utf8").split("\n") : null;

function classBody(fqType) {
  if (!lines) return null;
  const idx = fqType.lastIndexOf(".");
  const ns = fqType.slice(0, idx), cls = fqType.slice(idx + 1);
  const re = new RegExp(`\\bclass\\s+${cls}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    let nsLine = "";
    for (let j = i; j >= 0 && j > i - 4000; j--) {
      const m = lines[j].match(/^\s*namespace\s+([A-Za-z0-9_.]+)/);
      if (m) { nsLine = m[1]; break; }
    }
    if (nsLine !== ns) continue;
    let depth = 0, started = false, out = [];
    for (let k = i; k < lines.length; k++) {
      out.push(lines[k]);
      for (const ch of lines[k]) { if (ch === "{") { depth++; started = true; } else if (ch === "}") depth--; }
      if (started && depth === 0) return out.join("\n");
    }
  }
  return null;
}

const MELEE_HITSCAN = /\b(new BulletAttack|new OverlapAttack|new BlastAttack|FireMecanimHitboxes|\.Fire\(\))\b/;
const PROJECTILE = /\b(FireProjectile|ProjectileManager)\b/;

function classifyFromCode(state) {
  const body = classBody(state);
  if (body === null) return { proc: null, source: "review:class-not-found" };
  const lits = [...body.matchAll(/\.procCoefficient\s*=\s*([0-9]+(?:\.[0-9]+)?)f?\s*;/g)].map((m) => parseFloat(m[1]));
  if (lits.length) {
    const uniq = [...new Set(lits)];
    return uniq.length === 1 ? { proc: uniq[0], source: "code:explicit" } : { proc: null, source: `review:multi(${uniq.join("/")})` };
  }
  const proj = PROJECTILE.test(body), melee = MELEE_HITSCAN.test(body);
  if (melee && !proj) return { proc: 1, source: "code:default-1.0" };
  if (proj) return { proc: null, source: "review:code-projectile" };
  return { proc: null, source: "review:no-attack" };
}

const SLOTS = ["primary", "secondary", "utility", "special"];
const out = [];
let verified = 0, total = 0;
for (const [survivor, d] of Object.entries(loadouts)) {
  const skills = [];
  for (const slot of SLOTS) {
    for (const it of d.slots?.[slot] ?? []) {
      total++;
      let proc = it.proc, source = it.procSource;
      if (proc === null) ({ proc, source } = classifyFromCode(it.state));
      if (proc !== null) verified++;
      skills.push({
        slot,
        name: it.displayName || it.name,
        state: it.state,
        proc,
        procSource: source,
        verified: proc !== null,
      });
    }
  }
  out.push({ survivor, body: d.body, skills });
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + "\n");
console.log(`${OUT}: ${out.length} survivors, ${total} loadout skills, ${verified} with a verified proc, ${total - verified} left for review.`);
