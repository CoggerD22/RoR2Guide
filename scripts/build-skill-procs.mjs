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

// Global map of EntityState -> proc resolved from assets (all states, not just
// loadout ones), so a charge state that transitions into an ESC-configured fire
// state (e.g. FireCaptainShotgun = 0.75) can inherit it.
const PROCS = path.join(root, ".gamedata", "procs.json");
const escProc = new Map();
if (fs.existsSync(PROCS)) {
  const p = JSON.parse(fs.readFileSync(PROCS, "utf8"));
  for (const [state, rec] of Object.entries(p.stateProc ?? {})) {
    if (rec && rec.proc !== null && rec.proc !== undefined) escProc.set(state, rec.proc);
  }
}

/** Returns {body, base} for a type; `ns` match optional so short names resolve too. */
function classInfo(fqType, requireNs = true) {
  if (!lines) return null;
  const idx = fqType.lastIndexOf(".");
  const ns = idx >= 0 ? fqType.slice(0, idx) : "";
  const cls = idx >= 0 ? fqType.slice(idx + 1) : fqType;
  const re = new RegExp(`\\bclass\\s+${cls}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    if (requireNs) {
      let nsLine = "";
      for (let j = i; j >= 0 && j > i - 4000; j--) {
        const m = lines[j].match(/^\s*namespace\s+([A-Za-z0-9_.]+)/);
        if (m) { nsLine = m[1]; break; }
      }
      if (nsLine !== ns) continue;
    }
    // base type from `class X : Base, IFoo`
    const decl = lines[i].match(new RegExp(`class\\s+${cls}\\s*:\\s*([A-Za-z0-9_.]+)`));
    const base = decl ? decl[1] : null;
    let depth = 0, started = false, out = [];
    for (let k = i; k < lines.length; k++) {
      out.push(lines[k]);
      for (const ch of lines[k]) { if (ch === "{") { depth++; started = true; } else if (ch === "}") depth--; }
      if (started && depth === 0) return { body: out.join("\n"), base };
    }
  }
  return null;
}

function classBody(fqType) {
  const ci = classInfo(fqType);
  return ci ? ci.body : null;
}

const MELEE_HITSCAN = /\b(new BulletAttack|new OverlapAttack|new BlastAttack|FireMecanimHitboxes|\.Fire\(\))\b/;
const PROJECTILE = /\b(FireProjectile|ProjectileManager)\b/;

/** Namespace of a class by short name, or null. Used to tell states from other types. */
function namespaceOf(shortName) {
  if (!lines) return null;
  const re = new RegExp(`\\bclass\\s+${shortName}\\b`);
  for (let i = 0; i < lines.length; i++) {
    if (!re.test(lines[i])) continue;
    for (let j = i; j >= 0 && j > i - 4000; j--) {
      const m = lines[j].match(/^\s*namespace\s+([A-Za-z0-9_.]+)/);
      if (m) return m[1];
    }
  }
  return null;
}

/**
 * An entry/charge state often deals no damage itself and hands off to the state
 * that does. The handoff takes at least three shapes in this codebase:
 *   outer.SetNextState(new FireX())          — direct
 *   return new ArrowRain();                  — factory method (BeginArrowRain)
 *   EntityState s = cond ? new A() : new B(); outer.SetNextState(s);  — via variable
 * So rather than pattern-match the call, follow ANY `new X()` whose class lives in
 * an EntityStates namespace. That covers all three and can't wander into unrelated
 * types like DamageInfo or Vector3.
 */
function nextStates(body, ns) {
  const out = new Set();
  for (const m of body.matchAll(/\bnew\s+([A-Z][A-Za-z0-9_]*(?:\.[A-Z][A-Za-z0-9_]*)*)\s*\(/g)) {
    const t = m[1];
    if (t.includes(".")) {
      if (t.startsWith("EntityStates.")) out.add(t);
      continue;
    }
    // same namespace first (cheap + most common), else any EntityStates class
    if (classInfo(`${ns}.${t}`)) out.add(`${ns}.${t}`);
    else {
      const found = namespaceOf(t);
      if (found && found.startsWith("EntityStates")) out.add(`${found}.${t}`);
    }
  }
  return [...out];
}

function classifyFromCode(state, escProc, depth = 0, seen = new Set()) {
  if (seen.has(state) || depth > 3) return { proc: null, source: "review:no-attack" };
  seen.add(state);
  // a followed-to state may itself be ESC-configured
  if (depth > 0 && escProc && escProc.has(state)) {
    return { proc: escProc.get(state), source: `esc-via-transition:${state.split(".").pop()}` };
  }
  const ci = classInfo(state) ?? classInfo(state.split(".").pop(), false);
  if (ci === null) return { proc: null, source: "review:class-not-found" };
  const body = ci.body;
  const lits = [...body.matchAll(/\.procCoefficient\s*=\s*([0-9]+(?:\.[0-9]+)?)f?\s*;/g)].map((m) => parseFloat(m[1]));
  if (lits.length) {
    const uniq = [...new Set(lits)];
    if (uniq.length === 1) {
      return { proc: uniq[0], source: depth ? `code:explicit-via-transition` : "code:explicit" };
    }
    return { proc: null, source: `review:multi(${uniq.join("/")})` };
  }
  const proj = PROJECTILE.test(body), melee = MELEE_HITSCAN.test(body);
  if (melee && !proj) {
    return { proc: 1, source: depth ? "code:default-1.0-via-transition" : "code:default-1.0" };
  }
  if (proj) return { proc: null, source: "review:code-projectile" };
  // no attack here — follow transitions into a state that does attack
  const ns = state.slice(0, state.lastIndexOf("."));
  for (const nxt of nextStates(body, ns)) {
    const r = classifyFromCode(nxt, escProc, depth + 1, seen);
    if (r.proc !== null) return r;
  }
  // still nothing — the attack may live in the BASE state class (e.g. Merc's
  // melee states extend BaseMeleeAttack, which builds the OverlapAttack).
  if (ci.base && !/^(BaseSkillState|BaseState|EntityState|GenericCharacterMain)$/.test(ci.base)) {
    const baseFq = ci.base.includes(".") ? ci.base : `${ns}.${ci.base}`;
    const r = classifyFromCode(baseFq, escProc, depth + 1, seen);
    if (r.proc !== null) return { ...r, source: `${r.source}-via-base` };
  }
  return { proc: null, source: "review:unresolved" };
}

/*
 * DELIBERATELY NOT IMPLEMENTED: automatic "this skill deals no damage" labelling.
 *
 * Tried and rejected. The idea was to walk a state (plus its transitions and base
 * classes) for any damage evidence and, finding none, mark the skill "no proc" so
 * the UI could say that instead of the vaguer "unverified".
 *
 * It produced false negatives on skills that obviously deal damage — Huntress's
 * Ballista and Railgunner's M99 Sniper both came back "no damage evidence". Their
 * damage sits behind multi-hop handoffs the walk loses (BeginArrowSnipe ->
 * AimArrowSnipe -> FireArrowSnipe). Three separate traversal gaps were found and
 * patched before this one; each was only caught because a human recognised the
 * skill. Absence of evidence here is not evidence of absence.
 *
 * A wrong "no proc" is worse than an honest "unverified": it tells a player a
 * skill can't trigger on-hit items when it can. So unresolved skills stay
 * verified:false. Any future attempt needs positive proof of non-damage (or
 * hand-curation), not a failed search.
 */

const SLOTS = ["primary", "secondary", "utility", "special"];
const out = [];
let verified = 0, total = 0;
for (const [survivor, d] of Object.entries(loadouts)) {
  const skills = [];
  for (const slot of SLOTS) {
    for (const it of d.slots?.[slot] ?? []) {
      total++;
      let proc = it.proc, source = it.procSource;
      if (proc === null) ({ proc, source } = classifyFromCode(it.state, escProc));
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
console.log(`${OUT}: ${out.length} survivors, ${total} loadout skills, ${verified} with a verified proc, ${total - verified} unverified.`);
