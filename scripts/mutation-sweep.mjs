/**
 * What can change in this project without a single check failing?
 *
 * Every audit front so far asked "is surface X sound?". This asks the inverse, and it is the
 * only honest form of "nothing can go wrong": deliberately corrupt a real artefact, run the
 * gate, and record whether anything noticed. A mutation that SURVIVES is a hole — a change a
 * careless edit or a bad merge could make, that ships green.
 *
 * It also records WHICH layer caught each one, because that is not a detail:
 *   - `test:unit` runs in CI.
 *   - `data:audit`/`data:diff`/`data:verify` need the game install for their strongest checks,
 *     and CI has none (.decompiled/ and .gamedata/ are Gearbox's data and never committed).
 * So a mutation caught ONLY by a game cross-check is caught locally and NOT in CI. That is a
 * real risk surface, and this prints it rather than leaving it to be assumed.
 *
 * Usage: node scripts/mutation-sweep.mjs [--only <substring>]
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;

/**
 * --ci simulates the deploy environment: no `.gamedata/`, no `.decompiled/`, no game install.
 * That is what actually gates production, and it is a strictly weaker gate than the local one —
 * `.decompiled/` and `.gamedata/` are Gearbox's data and are never committed (CLAUDE.md rule),
 * so every game cross-check skips there. A mutation caught only locally can still reach the
 * deployed site, which is worth knowing as a number rather than as an assumption.
 *
 * The directories are RENAMED, not deleted, and restored in a finally — they cost hours to
 * regenerate.
 */
const CI_MODE = process.argv.includes("--ci");
const HIDDEN = [".gamedata", ".decompiled"];
const hide = () => {
  for (const d of HIDDEN) {
    const from = path.join(root, d);
    if (fs.existsSync(from)) fs.renameSync(from, path.join(root, `${d}.hidden-by-sweep`));
  }
};
/**
 * Restoring is the dangerous half, and it failed for real (§3j.169): a gate stage had just
 * read 12 MB out of `.decompiled/`, Windows still held the handle, and the rename came back
 * EPERM. The sweep then exited leaving the extractions hidden — which is the §3j.148 failure
 * rebuilt by our own tooling, because every local cross-check would report SKIPPED from then
 * on and a skipped check reads as a pass. A silent `renameSync` is not good enough here.
 */
const unhide = () => {
  const stuck = [];
  for (const d of HIDDEN) {
    const from = path.join(root, `${d}.hidden-by-sweep`);
    if (!fs.existsSync(from)) continue;
    let ok = false;
    for (let attempt = 0; attempt < 20 && !ok; attempt++) {
      try {
        fs.renameSync(from, path.join(root, d));
        ok = true;
      } catch {
        // Busy-wait rather than sleep: this runs from process-exit handlers, where async
        // work is not guaranteed to be flushed.
        const until = Date.now() + 100;
        while (Date.now() < until) {/* spin */}
      }
    }
    if (!ok) stuck.push(d);
  }
  if (stuck.length) {
    console.error(
      `\n!! COULD NOT RESTORE ${stuck.join(", ")} — they are still at "<name>.hidden-by-sweep".\n` +
        `!! Rename them back BEFORE trusting any local check: while they are missing,\n` +
        `!! data:audit and data:verify skip every game cross-check and still exit 0.\n`,
    );
    process.exitCode = 1;
  }
};

/** Gate stages, cheapest first. `ci` marks the ones that run with no game data. */
const GATES = [
  { name: "test:unit", cmd: "pnpm test:unit", ci: true },
  { name: "data:audit", cmd: "pnpm data:audit", ci: true },
  { name: "data:diff", cmd: "pnpm data:diff", ci: true },
  { name: "data:verify", cmd: "pnpm data:verify", ci: true },
  // Expensive, so only reached for a mutation the cheap stages missed. Running 4 of the 6
  // stages and calling the rest "holes" would have been the §3j.129 mistake: believing a block
  // of defects from an instrument that had not looked everywhere.
  { name: "build", cmd: "pnpm build", ci: true, slow: true },
  { name: "playwright", cmd: "npx playwright test", ci: true, slow: true },
];

const read = (f) => fs.readFileSync(path.join(root, f), "utf8");
const json = (f) => JSON.parse(read(f));

/** Replace the first occurrence, asserting it applied — a mutation that does not apply looks
 *  exactly like a guard that works (§3j.148). */
const sub = (s, a, b) => {
  if (!s.includes(a)) throw new Error(`mutation target not found: ${a.slice(0, 60)}`);
  return s.replace(a, b);
};

/** Edit one item in items.json by id. */
const editItem = (id, fn) => (src) => {
  const items = JSON.parse(src);
  const it = items.find((i) => i.id === id);
  if (!it) throw new Error(`no item ${id}`);
  fn(it);
  return JSON.stringify(items, null, 2) + "\n";
};

const MUTATIONS = [
  // ---- items.json: the product itself ----
  { file: "src/data/items.json", name: "a stacking base value is wrong", cls: "data/number",
    apply: editItem("crowbar", (i) => { i.stacking[0].base = 80; }) },
  { file: "src/data/items.json", name: "a stacking perStack value is wrong", cls: "data/number",
    apply: editItem("crowbar", (i) => { i.stacking[0].perStack = 50; }) },
  { file: "src/data/items.json", name: "a verbatim description is reworded", cls: "data/text",
    apply: editItem("crowbar", (i) => { i.description = i.description.replace("Deal", "Deals"); }) },
  { file: "src/data/items.json", name: "an item's tier is wrong", cls: "data/classification",
    apply: editItem("crowbar", (i) => { i.tier = "legendary"; }) },
  { file: "src/data/items.json", name: "an item's DLC is wrong", cls: "data/classification",
    apply: editItem("delicate-watch", (i) => { i.dlc = "base"; }) },
  { file: "src/data/items.json", name: "an item is marked unverified", cls: "data/provenance",
    apply: editItem("crowbar", (i) => { i.verified = false; }) },
  { file: "src/data/items.json", name: "confidence is downgraded to wiki", cls: "data/provenance",
    apply: editItem("crowbar", (i) => { i.confidence = "wiki"; }) },
  { file: "src/data/items.json", name: "an equipment cooldown is wrong", cls: "data/number",
    apply: editItem("disposable-missile-launcher", (i) => { i.cooldown = 99; }) },
  { file: "src/data/items.json", name: "a void corruption pair is broken one-way", cls: "data/integrity",
    apply: editItem("lens-makers-glasses", (i) => { delete i.corruptedBy; }) },
  { file: "src/data/items.json", name: "an icon path points at a missing file", cls: "data/asset",
    apply: editItem("crowbar", (i) => { i.icon = "/icons/not-a-real-icon.png"; }) },
  // §3j.169. A note citing a game field must agree with what the game holds for it. The
  // second of these is the one worth keeping: 40 IS a real serialized `baseRadius` — on
  // HoldoutZone — so a check that only asks "does this value exist anywhere?" passes it.
  // Only comparing against the component the note actually names catches it.
  { file: "src/data/items.json", name: "a note states a field value the game does not have", cls: "data/provenance",
    apply: editItem("his-reassurance", (i) => {
      i.descriptionNote = i.descriptionNote.replace("maxTargets is 1", "maxTargets is 7");
    }) },
  { file: "src/data/items.json", name: "a note attributes another component's value to the one it names", cls: "data/provenance",
    apply: editItem("helfire-tincture", (i) => {
      i.descriptionNote = i.descriptionNote.replace("baseRadius = 15", "baseRadius = 40");
    }) },
  { file: "src/data/items.json", name: "an item name is misspelled", cls: "data/text",
    apply: editItem("crowbar", (i) => { i.name = "Crowbaar"; }) },
  { file: "src/data/items.json", name: "an item is deleted outright", cls: "data/completeness",
    apply: (src) => JSON.stringify(JSON.parse(src).filter((i) => i.id !== "crowbar"), null, 2) + "\n" },
  { file: "src/data/items.json", name: "a proc-coefficient claim in a formula is reworded", cls: "data/provenance",
    apply: (src) => {
      const items = JSON.parse(src);
      const hit = items.find((i) => (i.stacking ?? []).some((r) => (r.formula ?? "").includes("procCoefficient")));
      if (!hit) throw new Error("no stacking formula cites procCoefficient");
      const row = hit.stacking.find((r) => (r.formula ?? "").includes("procCoefficient"));
      row.formula = row.formula.replace("procCoefficient", "proc coefficient");
      return JSON.stringify(items, null, 2) + "\n";
    } },

  // ---- skills.json (shape: [{ survivor, body, skills: [...] }]) ----
  { file: "src/data/skills.json", name: "a skill proc coefficient is wrong", cls: "data/number",
    apply: (src) => { const r = JSON.parse(src); r[0].skills[0].proc = 7; return JSON.stringify(r, null, 2) + "\n"; } },
  { file: "src/data/skills.json", name: "a skill's proc provenance is erased", cls: "data/provenance",
    apply: (src) => { const r = JSON.parse(src); delete r[0].skills[0].procSource; return JSON.stringify(r, null, 2) + "\n"; } },
  { file: "src/data/skills.json", name: "a skill is claimed verified with no source", cls: "data/provenance",
    apply: (src) => { const r = JSON.parse(src); const s0 = r[0].skills[0]; s0.verified = true; s0.procSource = ""; return JSON.stringify(r, null, 2) + "\n"; } },
  { file: "src/data/skills.json", name: "a loadout skill is deleted", cls: "data/completeness",
    apply: (src) => { const r = JSON.parse(src); r[0].skills.splice(0, 1); return JSON.stringify(r, null, 2) + "\n"; } },

  // ---- survivors.json ----
  { file: "src/data/survivors.json", name: "a survivor's base health is wrong", cls: "data/number",
    apply: (src) => { const s = JSON.parse(src); s[0].health.base = 999; return JSON.stringify(s, null, 2) + "\n"; } },
  { file: "src/data/survivors.json", name: "a survivor's acceleration is wrong", cls: "data/number",
    apply: (src) => { const s = JSON.parse(src); s[0].acceleration = 12; return JSON.stringify(s, null, 2) + "\n"; } },
  { file: "src/data/survivors.json", name: "a survivor is deleted", cls: "data/completeness",
    apply: (src) => { const s = JSON.parse(src); s.splice(1, 1); return JSON.stringify(s, null, 2) + "\n"; } },

  // ---- reference.ts ----
  { file: "src/data/reference.ts", name: "an Ambry code glyph is changed", cls: "data/number",
    apply: (src) => {
      const m = src.match(/code: "([^"]+)"/);
      if (!m) throw new Error("no Ambry code string found");
      const swapped = m[1].replace("▲", "■");
      if (swapped === m[1]) throw new Error("code has no triangle to swap");
      return sub(src, m[0], `code: "${swapped}"`);
    } },

  // ---- the stat engine ----
  { file: "src/data/statItems.ts", name: "a stat coefficient is wrong", cls: "engine",
    apply: (src) => {
      const m = src.match(/perStack:\s*(-?[\d.]+)/);
      return sub(src, m[0], `perStack: ${Number(m[1]) + 3}`);
    } },

  /*
    ---- APPLICATION LOGIC ----

    The first 28 mutations were weighted almost entirely to data and docs: exactly one touched
    code. But the question this file asks applies just as much to the app — can the URL encoder,
    the stat engine or the search ranking change without a test failing? Seven lib/store modules
    have no dedicated test at all, which is not the same as untested; this is how to find out.

    Each is a plausible bug, and several are the exact traps the code documents in its own
    comments — the best mutations are the ones a careful reader already worried about.
  */
  { file: "src/lib/asset.ts", name: "asset() drops the base path", cls: "code/deploy",
    apply: (src) => sub(src, "return import.meta.env.BASE_URL + path.replace(/^\\//, \"\");", "return path;") },
  { file: "src/lib/statMath.ts", name: "negative armor uses the naive shortcut", cls: "code/engine",
    apply: (src) => sub(src,
      "return armor >= 0 ? 1 - armor / (armor + 100) : 2 - 100 / (100 - armor);",
      "return 100 / (100 + armor);") },
  { file: "src/lib/stacking.ts", name: "sparkline curve is off by one stack", cls: "code/engine",
    apply: (src) => sub(src, "v: entry.base + entry.perStack * i,", "v: entry.base + entry.perStack * (i + 1),") },
  { file: "src/lib/stacking.ts", name: "stacking types stop being de-duplicated", cls: "code/display",
    apply: (src) => sub(src, "return [...new Set(entries.map((e) => e.type))];", "return entries.map((e) => e.type);") },
  { file: "src/lib/filterPipeline.ts", name: "the locked-only filter is inverted", cls: "code/filter",
    apply: (src) => sub(src, "if (filters.lockedOnly && !it.unlock) return false;", "if (filters.lockedOnly && it.unlock) return false;") },
  { file: "src/lib/filterPipeline.ts", name: "the tier filter stops applying", cls: "code/filter",
    apply: (src) => sub(src, "if (filters.tiers.size > 0 && !filters.tiers.has(it.tier)) return false;", "") },
  { file: "src/lib/planUrl.ts", name: "an out-of-range goal is accepted from a share link", cls: "code/validation",
    apply: (src) => sub(src,
      "Number.isInteger(parsed) && parsed >= MIN_GOAL && parsed <= MAX_GOAL ? parsed : undefined;",
      "Number.isInteger(parsed) ? parsed : undefined;") },
  { file: "src/lib/search.ts", name: "one-character queries lose the prefix path", cls: "code/search",
    apply: (src) => sub(src, "if (q.length < 2) {", "if (false) {") },
  { file: "src/lib/utils.ts", name: "cn() stops de-duplicating conflicting classes", cls: "code/display",
    apply: (src) => sub(src, "return twMerge(clsx(inputs));", "return clsx(inputs);") },
  { file: "src/store/planner.ts", name: "the goal clamp in setGoal is removed", cls: "code/validation",
    apply: (src) => sub(src,
      "else nextEntry.goal = Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.floor(goal)));",
      "else nextEntry.goal = goal;") },
  { file: "src/store/planner.ts", name: "persisted state stops being sanitised on hydrate", cls: "code/validation",
    apply: (src) => sub(src,
      "merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),",
      "merge: (persisted, current) => ({ ...current, ...(persisted as object) }),") },

  /*
    ---- THE VALIDATION LAYER, AND THE MODULES NOTHING TESTS ----

    `schema.ts` is what every other check trusts: `data:audit` and `data:diff` both parse
    through it, so a loosened rule there weakens them silently rather than loudly. And
    `display.ts`, `nav.ts` and `clipboard.ts` are the modules left with no dedicated test after
    §3j.157 — not the same as untested, which is the point of asking.
  */
  { file: "src/data/schema.ts", name: "a `special` row no longer needs a formula", cls: "schema",
    apply: (src) => sub(src, '.refine((e) => e.type !== "special" || !!e.formula, {', ".refine(() => true, {") },
  { file: "src/data/schema.ts", name: "a capped row no longer needs its cap stated", cls: "schema",
    apply: (src) => sub(src, ".refine((e) => !e.capStacks || !!e.cap, {", ".refine(() => true, {") },
  { file: "src/data/schema.ts", name: "an item may ship an empty description", cls: "schema",
    apply: (src) => sub(src, "    description: z.string().min(1),", "    description: z.string(),") },
  { file: "src/data/schema.ts", name: "confidence accepts any string, not the four tiers", cls: "schema",
    apply: (src) => sub(src,
      'export const confidenceSchema = z.enum(["code", "asset", "langfile", "wiki"]);',
      "export const confidenceSchema = z.string();") },
  { file: "src/store/display.ts", name: "the density grid loses its responsive columns", cls: "code/display",
    apply: (src) => sub(src,
      '  dense: "grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 2xl:grid-cols-24",',
      '  dense: "grid-cols-6 gap-1.5",') },
  { file: "src/store/display.ts", name: "the persisted display key changes, silently resetting everyone", cls: "code/state",
    apply: (src) => sub(src, 'name: "ror2-display",', 'name: "ror2-display-v2",') },
  { file: "src/lib/nav.ts", name: "a nav section disappears", cls: "code/nav",
    apply: (src) => sub(src, '    path: "/planner",', '    path: "/planner-disabled",') },
  { file: "src/lib/clipboard.ts", name: "copyText reports success when it failed", cls: "code/state",
    apply: (src) => sub(src, "    return ok;", "    return true;") },

  // ---- app code the guards claim to cover ----
  { file: "src/components/reference/ReferencePage.tsx", name: "a heading level is skipped", cls: "a11y",
    apply: (src) => sub(src, '<h2 className="sr-only">', '<h3 className="sr-only">') },
  { file: "src/components/layout/Footer.tsx", name: "the non-affiliation disclaimer is removed", cls: "legal",
    apply: (src) => src.replace(/not affiliated[\s\S]{0,120}?[.<]/i, "") },

  // ---- documentation that the guards pin ----
  { file: "CLAUDE.md", name: "a Status count contradicts the data", cls: "docs",
    apply: (src) => sub(src, "217", "216") },
  { file: "AUDIT-BACKLOG.md", name: "a CLOSED row loses its denominator", cls: "docs",
    apply: (src) => sub(src, "| 217 items, 208 code/asset-traced |", "| checked |") },

  // ---- build + deploy ----
  { file: "scripts/prerender-og.mjs", name: "the 404 catch-all stops being written", cls: "deploy",
    apply: (src) => sub(src, '"404.html"', '"404-disabled.html"') },
  { file: "vite.config.ts", name: "the deploy base path changes", cls: "deploy",
    apply: (src) => sub(src, '"/RoR2Guide/"', '"/ror2/"') },
];

const targets = only ? MUTATIONS.filter((m) => (m.name + m.file + m.cls).includes(only)) : MUTATIONS;
if (!targets.length) {
  console.error(`no mutations match --only ${only}`);
  process.exit(2);
}

const run = (cmd) => {
  try {
    execSync(cmd, { cwd: root, stdio: "pipe" });
    return 0;
  } catch (e) {
    return e.status ?? 1;
  }
};

console.log(`Mutation sweep: ${targets.length} mutations${CI_MODE ? " (CI MODE — game data hidden)" : ""}\n`);
const results = [];

if (CI_MODE) {
  hide();
  // Restore on any exit path. These directories cost hours to regenerate and are git-ignored,
  // so losing them to a crashed sweep would be a self-inflicted version of the very thing this
  // script exists to prevent.
  process.on("exit", unhide);
  process.on("SIGINT", () => {
    unhide();
    process.exit(130);
  });
}

try {
for (const m of targets) {
  const abs = path.join(root, m.file);
  const original = fs.readFileSync(abs, "utf8");
  let caught = null;
  let applyError = null;
  try {
    const mutated = m.apply(original);
    if (mutated === original) throw new Error("mutation produced identical content");
    fs.writeFileSync(abs, mutated);
    for (const g of GATES) {
      if (run(g.cmd) !== 0) {
        caught = g;
        break;
      }
    }
  } catch (e) {
    applyError = e.message;
  } finally {
    fs.writeFileSync(abs, original);
  }
  results.push({ ...m, caught, applyError });
  const tag = applyError ? "SKIP " : caught ? "ok   " : "SURVIVED";
  console.log(`  ${tag.padEnd(9)} ${m.cls.padEnd(18)} ${m.name}${caught ? `  <- ${caught.name}` : ""}${applyError ? `  (${applyError})` : ""}`);
}

} finally {
  if (CI_MODE) unhide();
}

const survived = results.filter((r) => !r.caught && !r.applyError);
const skipped = results.filter((r) => r.applyError);
const ciBlind = results.filter((r) => r.caught && !r.caught.ci);

console.log(`\n${"=".repeat(74)}`);
console.log(`APPLIED:   ${results.length - skipped.length} of ${results.length}`);
console.log(`CAUGHT:    ${results.length - skipped.length - survived.length}`);
console.log(`SURVIVED:  ${survived.length}   <- every one of these is a hole`);
if (skipped.length) console.log(`SKIPPED:   ${skipped.length} (mutation could not be applied — fix the mutation, not the code)`);
if (ciBlind.length) console.log(`CI-BLIND:  ${ciBlind.length} caught only by a stage CI cannot run`);
for (const s of survived) console.log(`\n  SURVIVED  [${s.cls}] ${s.name}\n            ${s.file}`);
process.exitCode = survived.length ? 1 : 0;
