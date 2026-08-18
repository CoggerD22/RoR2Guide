/**
 * pnpm data:audit — schema + integrity checks over /src/data (PLAN §5.5).
 *
 * FATAL (exit 1) — CI must block these:
 *   - items.json fails the Zod schema (CLAUDE.md rule #1/#3)
 *   - duplicate item ids
 *   - dangling or non-bidirectional void corruption pairs (rule #4)
 *   - one challenge unlocking items with conflicting requirement text (§4.7)
 *
 * WARNINGS (exit 0) — reported but expected mid-milestone:
 *   - items with "verified": false (rule #1 — intermediate state)
 *   - missing icon files under /public/icons
 *   - locked items whose unlock requirement is not yet verified (§4.7)
 *
 * If items.json is absent (pre-data), the audit passes with a note.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  itemsFileSchema,
  survivorsFileSchema,
  skillsFileSchema,
  type Item,
} from "../src/data/schema.ts";
import { LOADOUT_UNLOCKS, ARTIFACTS } from "../src/data/reference.ts";
import { extractFieldClaims } from "../src/lib/fieldClaims.ts";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const itemsPath = resolve(root, "src/data/items.json");
const survivorsPath = resolve(root, "src/data/survivors.json");
const skillsPath = resolve(root, "src/data/skills.json");

const errors: string[] = [];
const warnings: string[] = [];

function main(): number {
  if (!existsSync(itemsPath)) {
    console.log(
      "data:audit — no dataset yet (src/data/items.json absent). Nothing to validate; passing.",
    );
    return 0;
  }

  // --- Parse + schema validation ------------------------------------------
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(itemsPath, "utf8"));
  } catch (e) {
    console.error(`data:audit — items.json is not valid JSON: ${(e as Error).message}`);
    return 1;
  }

  const parsed = itemsFileSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("data:audit — schema validation failed:\n");
    for (const issue of parsed.error.issues) {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      console.error(`  ✗ ${path}: ${issue.message}`);
    }
    return 1;
  }
  const items = parsed.data;
  const byId = new Map<string, Item>();

  // --- Duplicate ids -------------------------------------------------------
  for (const it of items) {
    if (byId.has(it.id)) {
      errors.push(`duplicate id "${it.id}"`);
    } else {
      byId.set(it.id, it);
    }
  }

  // --- Corruption pairs: bidirectional + non-dangling (rule #4) ------------
  for (const it of items) {
    if (it.corrupts) {
      for (const target of it.corrupts) {
        const other = byId.get(target);
        if (!other) {
          errors.push(`"${it.id}" corrupts "${target}", which does not exist`);
        } else if (other.corruptedBy !== it.id) {
          errors.push(
            `"${it.id}" corrupts "${target}", but "${target}".corruptedBy is ` +
              `${other.corruptedBy ? `"${other.corruptedBy}"` : "unset"} (expected "${it.id}")`,
          );
        }
      }
    }
    if (it.corruptedBy) {
      const voidItem = byId.get(it.corruptedBy);
      if (!voidItem) {
        errors.push(`"${it.id}".corruptedBy points to "${it.corruptedBy}", which does not exist`);
      } else if (!voidItem.corrupts?.includes(it.id)) {
        errors.push(
          `"${it.id}".corruptedBy is "${it.corruptedBy}", but that item does not list "${it.id}" in corrupts`,
        );
      }
    }
  }

  // --- Warnings: unverified items + missing icons -------------------------
  for (const it of items) {
    if (!it.verified) warnings.push(`unverified: "${it.id}" (${it.name})`);
    const iconPath = resolve(root, "public" + it.icon); // it.icon "/icons/x.png" → public/icons/x.png
    if (!existsSync(iconPath)) warnings.push(`missing icon: ${it.icon} for "${it.id}"`);
  }

  // --- Unlock challenges (PLAN §4.7) --------------------------------------
  // A locked item with no requirement text is an honest "not yet verified" gap
  // (warning). A single challenge that unlocks several items must describe them
  // identically — divergent text means one was hand-edited/drifted (error).
  const requirementByChallenge = new Map<string, { id: string; requirement: string }>();
  for (const it of items) {
    if (!it.unlock) continue;
    if (!it.unlock.requirement) {
      warnings.push(`locked item "${it.id}" has no verified unlock requirement (challenge: ${it.unlock.challenge})`);
      continue;
    }
    const seen = requirementByChallenge.get(it.unlock.challenge);
    if (seen && seen.requirement !== it.unlock.requirement) {
      errors.push(
        `challenge "${it.unlock.challenge}" has conflicting requirements: ` +
          `"${seen.id}" says "${seen.requirement}" but "${it.id}" says "${it.unlock.requirement}"`,
      );
    } else if (!seen) {
      requirementByChallenge.set(it.unlock.challenge, { id: it.id, requirement: it.unlock.requirement });
    }
  }

  // --- Formula prose vs the recorded base (PLAN §6A / MATH-VERIFICATION §3j.6) ---
  // For NON-LINEAR entries the sparkline deliberately refuses to plot, so the formula
  // STRING is the only thing the UI shows — it is data, not documentation. Two real
  // bugs lived there undetected: Egocentrism/Zoea listed values from a different curve,
  // and Safer Spaces' `base` (15) contradicted its own formula (13.5 at one stack).
  // Heuristic, warn-only: if a formula states a "<x> at 1 stack" style value, it must
  // agree with `base`.
  //
  // HYPERBOLIC is excluded by design. For those entries `base` is the *amplification
  // input* fed to ConvertAmplificationPercentageIntoReductionPercentage, not the value
  // the player sees: Tougher Times stores base 15 and blocks 13.04% at one stack. That
  // divergence is the whole point of the type, so comparing the two is meaningless.
  const ONE_STACK = /([0-9]+(?:\.[0-9]+)?)\s*(?:%|s|m)?\s*(?:at|@)\s*(?:1|one)\s*stack/i;
  for (const it of items) {
    for (const entry of it.stacking) {
      // HYPERBOLIC stays excluded for the reason given above — its `base` is an
      // amplification input, not the value the player sees, so the comparison is meaningless.
      // Everything else is now checked, LINEAR INCLUDED. Restricting this to non-linear rows
      // inspected 7 rows while skipping 33, and the two errors it was best placed to catch —
      // Electric Boomerang's 120-vs-124 and Resonance Disc's 1000-vs-4000 — were both on
      // linear rows (MATH-VERIFICATION §3j.120).
      if (entry.type === "hyperbolic") continue;
      if (!entry.formula) continue;
      const m = ONE_STACK.exec(entry.formula);
      if (!m) continue;
      const stated = Number(m[1]);
      if (Number.isFinite(stated) && Math.abs(stated - entry.base) > 0.51) {
        warnings.push(
          `"${it.id}" (${entry.stat}): formula says ${stated} at 1 stack but base is ${entry.base}`,
        );
      }
    }
  }

  // --- What counts as "our prose" (ONE definition, shared) ------------------
  // The coined-term rule and the internal-name-collision rule below both police the text we
  // WRITE, as opposed to the game text we transcribe. They used to build that list
  // separately and disagreed: collisions read reference.ts, coined terms did not, so 26
  // camelCase identifiers in the artifact and shrine `mechanic` strings had never been
  // checked against the decompile — and one of them, `cutHpCount` on Artifact of Swarms, was
  // a coinage of mine dressed as a game field (MATH-VERIFICATION §3j.112).
  //
  // Two guards disagreeing about their own subject is the same failure as a narrow selector
  // (§3j.109) and is fixed the same way: define the surface once, in one place, and make
  // every rule read it. Adding a prose field to the schema means adding it HERE, once.
  const referenceSrc = existsSync(resolve(root, "src/data/reference.ts"))
    ? readFileSync(resolve(root, "src/data/reference.ts"), "utf8")
    : "";
  const quoted = (field: string) =>
    [...referenceSrc.matchAll(new RegExp(`${field}:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "g"))].map(
      (m) => m[1],
    );
  let skillProse: Array<{ name: string; prose: string }> = [];
  try {
    const rawSkills = JSON.parse(readFileSync(skillsPath, "utf8")) as Array<{
      survivor: string;
      skills?: Array<{ name?: string; procSource?: string }>;
    }>;
    skillProse = rawSkills.flatMap((w) =>
      (w.skills ?? []).map((sk) => ({
        name: `skill ${w.survivor}/${sk.name ?? "?"}`,
        prose: sk.procSource ?? "",
      })),
    );
  } catch {
    // skills.json is validated properly further down; a parse failure is reported there.
  }
  const PROSE_RECORDS: Array<{ name: string; prose: string }> = [
    ...items.map((it) => ({
      name: it.name,
      prose: [
        it.descriptionNote ?? "",
        ...it.stacking.map((s) => s.formula ?? ""),
        ...it.stacking.map((s) => s.cap ?? ""),
      ]
        .join("\n")
        .trim(),
    })),
    ...quoted("mechanic").map((t, i) => ({ name: `reference.ts mechanic #${i + 1}`, prose: t })),
    ...quoted("cost").map((t, i) => ({ name: `reference.ts cost #${i + 1}`, prose: t })),
    ...skillProse,
  ].filter((r) => r.prose);

  // Coverage floor for the shared surface, in the spirit of the `guard coverage` block in
  // stacking.test.ts (§3j.110). Both rules below can pass by inspecting nothing, and nothing
  // else in this file would notice. This fails if the surface silently shrinks — a dataset
  // dropped from the list, a field renamed, reference.ts moved — rather than letting the
  // rules report a clean run over a fraction of what they claim to cover.
  // 343 records today: ~185 items with prose, 33 reference.ts strings, 125 skill procSources.
  // The floor has to sit above (343 - smallest dataset) or it cannot detect that dataset
  // vanishing — at 300 it would have missed reference.ts dropping out entirely, which is the
  // precise failure this exists to catch. 335 leaves room for a few records to be removed
  // legitimately while still failing if any one source stops being read.
  const PROSE_FLOOR = 335;
  if (PROSE_RECORDS.length < PROSE_FLOOR) {
    errors.push(
      `prose surface shrank to ${PROSE_RECORDS.length} records (floor ${PROSE_FLOOR}). The ` +
        `coined-term and internal-name rules police this list; a smaller list means they now ` +
        `pass over text nobody is checking. Either a data file stopped being read or a prose ` +
        `field was renamed.`,
    );
  }

  // --- Coined terms (MATH-VERIFICATION §3j.97) -----------------------------
  // `levelScale` was a word I invented, used in seven records, that asserted a mechanism in
  // its own name and read as verified because nothing distinguishes a token copied out of
  // the game from one made up. It was wrong — it conflated a level factor with the Quick Fix
  // multiplier — and it survived months of review.
  //
  // So: every camelCase token in our prose must either exist in the decompiled source or be
  // an ACKNOWLEDGED coinage. Deliberate shorthand is fine and often clearer than the game's
  // `num79`; what is not fine is coining silently.
  const COINED_OK = new Set([
    // Ours, and named after what sets them rather than after a mechanism they assert.
    "quickFixMultiplier",
    "levelFactor",
    "healthMultiplier",
    // Readable stand-ins for real parameters, checked against their call sites.
    "hitDamage", // damageInfo.damage
    "bodyDamage", // characterBody.damage
    "previousFrac", // Monitor's previousHealthFraction
    "irradiantPearls", // the ShinyPearl count
    "maxGuards",
    "beadLevels",
    // Asset names. Real game identifiers that live in bundles, not in the assembly.
    "dtLockbox",
    "dtVoidLockbox",
    "dtVoidChest",
    "cscMinorConstructOnKill",
    "bdBugWings",
  ]);
  const decompiledDir = resolve(root, ".decompiled");
  let haystack = "";
  if (existsSync(decompiledDir)) {
    const collect = (dir: string) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = resolve(dir, e.name);
        if (e.isDirectory()) collect(p);
        else if (e.name.endsWith(".cs")) haystack += readFileSync(p, "utf8");
      }
    };
    collect(decompiledDir);
    const unacknowledged = new Map<string, string[]>();
    for (const rec of PROSE_RECORDS) {
      for (const m of rec.prose.matchAll(/\b([a-z]+[A-Z][A-Za-z0-9]*)\b/g)) {
        const t = m[1];
        if (COINED_OK.has(t) || haystack.includes(t)) continue;
        if (!unacknowledged.has(t)) unacknowledged.set(t, []);
        unacknowledged.get(t)!.push(rec.name);
      }
    }
    for (const [term, where] of unacknowledged) {
      errors.push(
        `"${term}" appears in published prose (${[...new Set(where)].slice(0, 3).join(", ")}) but ` +
          `exists nowhere in the decompiled source — if it is deliberate shorthand, add it to ` +
          `COINED_OK in data-audit.ts; if it names a mechanism, that name is an unverified claim`,
      );
    }
  } else {
    warnings.push("coined terms not checked (.decompiled absent — run scripts/decompile.sh)");
  }

  // --- Values attributed to a named game field (MATH-VERIFICATION §3j.169) -------------
  // The check above proves a cited identifier EXISTS. It says nothing about the number next
  // to it, and 9 notes attach one — "healFraction 0.05", "dotDuration = 3", "tickRate 0.5".
  //
  // Interstellar Desk Plant is why that gap matters. Its note read "(DeskplantWard:
  // healFraction 0.05, interval 0.5)", and the DeskplantWard prefab's healFraction is 0 —
  // the 0.05 is assigned in code when the plant blooms. The number was right and the
  // citation sent a reader somewhere that contradicts it, which under rule #1 is the whole
  // ballgame: provenance is the claim. It is §3j.168 inverted — there a real value looked
  // unverifiable, here a verified value looked fabricated.
  //
  // So: a `fieldName <number>` pair in our prose must match what the game holds for that
  // field, in a serialized component, a state config, or as a literal in the C#. Only the
  // FIRST mention of a field per note is a claim about its value; later ones are usually the
  // field appearing inside a derived formula ("healthFractionPerSecond x dotDuration = 15%"),
  // which asserts nothing about `dotDuration` and must not be read as if it did.
  //
  // Local-only: the extractions are git-ignored, so CI reports this SKIPPED, not passed.
  const compPath = resolve(root, ".gamedata/component-fields.json");
  const statePath = resolve(root, ".gamedata/state-fields.json");
  if (haystack && existsSync(compPath) && existsSync(statePath)) {
    const known = new Map<string, Set<number>>();
    const add = (k: string, v: unknown) => {
      if (typeof v !== "number" || !Number.isFinite(v)) return;
      if (!known.has(k)) known.set(k, new Set());
      known.get(k)!.add(v);
    };
    const walk = (node: unknown) => {
      if (Array.isArray(node)) return node.forEach(walk);
      if (!node || typeof node !== "object") return;
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (typeof v === "number") add(k, v);
        else if (typeof v === "string" && v !== "" && Number.isFinite(Number(v))) add(k, Number(v));
        else walk(v);
      }
    };
    walk(JSON.parse(readFileSync(compPath, "utf8")));
    walk(JSON.parse(readFileSync(statePath, "utf8")));

    // Owner-scoped values, so "DeskplantWard: healFraction 0.05" can be checked against
    // DeskplantWard rather than against every component in the game that has a healFraction.
    // Without this the global check passes it — 0.05 is a real healFraction somewhere, and is
    // a real code literal — which is precisely how the misattribution survived.
    const byOwner = new Map<string, Map<string, Set<number>>>();
    const compRaw = JSON.parse(readFileSync(compPath, "utf8")) as Record<
      string,
      { owner?: string; fields?: Record<string, unknown> }[]
    >;
    for (const recs of Object.values(compRaw)) {
      for (const r of recs) {
        if (!r.owner || !r.fields) continue;
        if (!byOwner.has(r.owner)) byOwner.set(r.owner, new Map());
        const m = byOwner.get(r.owner)!;
        for (const [k, v] of Object.entries(r.fields)) {
          if (typeof v !== "number" || !Number.isFinite(v)) continue;
          if (!m.has(k)) m.set(k, new Set());
          m.get(k)!.add(v);
        }
      }
    }

    // Tokenised, not escaped: the `\b`-is-BACKSPACE trap has now cost five separate passes
    // (§3j.116, §3j.148, §3j.155, §3j.167) and hit this very check while it was being written,
    // where it reported "0 of 0" (§3j.169). There is nothing to escape here.
    const near = (a: number, b: number) => Math.abs(a - b) < Math.max(1e-4, Math.abs(b) * 1e-5);
    // Delimited forms only. `"dotDuration = 3"` is a substring of `"dotDuration = 30f"`, which
    // is §3j.160's bug (a 2s telegraph "found" inside `Cooldown: 25s`) in a new rule — the
    // undelimited version let five claims out of the owner-scoped check by accident.
    const codeForms = (name: string, v: number) => [
      `${name} = ${v}f`,
      `${name} = ${v};`,
      `${name} = ${v} `,
    ];
    /*
      A field is "verified from code" when the decompile assigns it and the stated number appears
      in that assignment — not only when the assignment is a bare literal.

      The bare-literal version reported two defects that were not defects. Bustling Fungus has
      `mushroomHealingWard.healFraction = (0.045f + 0.0225f * (num - 1)) * interval`, and Growth
      Nectar has `maxGrowthNectarBuffCount = num67 * 4`. Both numbers are right there in the
      source; both were called absent because they sit inside an expression. Read the statement,
      not the pattern.
    */
    const inCode = (name: string, v: number) => {
      if (codeForms(name, v).some((f) => haystack.includes(f))) return true;
      const needle = `${name} = `;
      const lit = String(v);
      for (let i = haystack.indexOf(needle); i >= 0; i = haystack.indexOf(needle, i + 1)) {
        const end = haystack.indexOf(";", i);
        if (end < 0 || end - i > 300) continue;
        const stmt = haystack.slice(i + needle.length, end);
        // Token-compare so `4` does not match inside `48` — the §3j.160 substring bug again.
        if ((stmt.match(/-?[0-9]+(?:\.[0-9]+)?/g) ?? []).some((t) => near(Number(t), v) && t === lit))
          return true;
      }
      return false;
    };

    const vocab = {
      fields: new Set(known.keys()),
      owners: new Set(byOwner.keys()),
      ownerDeclares: (o: string, f: string) => byOwner.get(o)?.has(f) ?? false,
    };

    // C# field initialisers, for the §3j.170 leg below.
    const initialiser = new Map<string, number>();
    for (const m of haystack.matchAll(
      /\b(?:public|protected|internal)\s+(?:readonly\s+)?(?:float|int|uint|double)\s+([A-Za-z_]\w*)\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)f?\s*;/g,
    )) {
      if (!initialiser.has(m[1])) initialiser.set(m[1], Number(m[2]));
    }

    /*
      OUR PROSE IS NOT JUST THE NOTE (§3j.170). §3j.169 scanned `descriptionNote` and stopped
      there, which missed 291 `stacking[].formula` strings — and the formulas are where Frost
      Relic's wrong numbers lived. For a non-linear row the formula is the only thing the UI
      shows, so it is data, not documentation (see the ONE_STACK rule above, which learned the
      same lesson).
    */
    const fragments: { id: string; where: string; text: string }[] = [];
    for (const it of items) {
      if (it.descriptionNote) fragments.push({ id: it.id, where: "descriptionNote", text: it.descriptionNote });
      for (const s of it.stacking) {
        if (s.formula) fragments.push({ id: it.id, where: `formula[${s.stat}]`, text: s.formula });
      }
    }

    let checked = 0;
    let scopedChecked = 0;
    let defaultChecked = 0;
    for (const frag of fragments) {
      const it = { id: frag.id, descriptionNote: frag.text };
      const note = frag.text;
      // Owners named anywhere in this fragment, for the initialiser leg.
      const namedOwners = (note.match(/[A-Za-z][A-Za-z0-9]*/g) ?? []).filter((t) => byOwner.has(t));
      for (const claim of extractFieldClaims(note, vocab)) {
        const { field: name, stated } = claim;
        checked++;

        // A note may legitimately cite CODE for a field whose asset says something else — that
        // is the Desk Plant case, and explaining it is the fix, not a violation. The
        // discriminator is evidence: to claim a value comes from code, quote the assignment.
        // If the note contains the literal AND the decompile contains it too, the note is
        // citing code and the owner-scoped rule does not apply. Naming a component and
        // asserting a number it does not hold, with no code shown, still fails.
        const quotesCode = codeForms(name, stated).some(
          (f) => note.includes(f) && haystack.includes(f),
        );
        const scoped = claim.owner && !quotesCode ? byOwner.get(claim.owner)?.get(name) : undefined;
        if (scoped) {
          scopedChecked++;
          if (![...scoped].some((v) => near(stated, v))) {
            errors.push(
              `${it.id}: descriptionNote attributes "${name} ${stated}" to ${claim.owner}, but ` +
                `${claim.owner} serializes ${name} = [${[...scoped].join(", ")}]. If the value is ` +
                `set in code rather than on the asset, say so — citing the asset for a code ` +
                `constant sends a reader somewhere that contradicts us (§3j.169)`,
            );
          }
          continue;
        }

        const vals = known.get(name)!;
        const ok =
          [...vals].some((v) => near(stated, v) || near(stated / 100, v) || near(stated * 100, v)) ||
          inCode(name, stated);
        if (!ok) {
          errors.push(
            `${it.id} (${frag.where}) states "${name} ${stated}", but the game holds no such ` +
              `value for that field — serialized values are [${[...vals].slice(0, 6).join(", ")}] ` +
              `and no literal assignment matches in the decompiled source`,
          );
          continue;
        }

        /*
          THE INITIALISER LEG (§3j.170). `public float icicleBaseRadius = 10f;` reads like the
          value and is only the default. Frost Relic's own prefab serializes 6, and the record
          published 22m/+6m "correcting" a game description of 18m/+12m that was right — three
          numbers wrong, all traced to reading initialisers and never opening the prefab.

          Signal: the stated value IS the initialiser, and some prefab serializes something else.
          Then the prose must name a component that declares the field, so the claim is pinned to
          a prefab rather than to a default that may not be in play.

          Restricted to fields carried by at most 5 distinct owners. `procCoefficient` and
          `damageCoefficient` sit on hundreds of prefabs with every value under the sun; "proc
          coefficient 1" for one attack is not a claim about a default, and without this bound
          the leg produced 13 false positives and 1 true one.
        */
        const def = initialiser.get(name);
        if (def === undefined || !near(stated, def)) continue;
        const owners = [...byOwner.entries()].filter(([, m]) => m.has(name));
        if (owners.length === 0 || owners.length > 5) continue;
        if (!owners.some(([, m]) => [...m.get(name)!].some((v) => !near(v, def)))) continue;
        defaultChecked++;
        // Named anywhere in the fragment, not necessarily before the number: prose explaining
        // "the initialiser is X, the prefab overrides it with Y" must state X first, and a
        // guard that forbade that would be dictating the sentence rather than the fact.
        if (namedOwners.some((o) => byOwner.get(o)!.has(name))) continue;
        errors.push(
          `${it.id} (${frag.where}) states "${name} ${stated}", which is the C# field ` +
            `INITIALISER — and ${owners.map(([o]) => o).join(", ")} serialize ` +
            `[${owners.map(([o, m]) => `${o}=${[...m.get(name)!].join("/")}`).join(", ")}]. ` +
            `A serialized value overrides the initialiser, so name the prefab this figure is ` +
            `read from (§3j.170)`,
        );
      }
    }
    console.log(
      `  field-value claims cross-checked: ${checked} across ${fragments.length} prose ` +
        `fragments (${scopedChecked} against the component named; ${defaultChecked} tested ` +
        `for a prefab-overridden C# initialiser)`,
    );
  } else {
    warnings.push(
      "field-value claims not checked (.decompiled / .gamedata component+state extractions absent)",
    );
  }

  // --- Name collisions in our own prose (MATH-VERIFICATION §3j.77) ---------
  // Four times now an internal `cachedName` has been read as belonging to the item whose
  // page it was about, and the fourth reached production: Executive Card carried
  // FireVendingMachine's subcooldown and raycast for two passes, because
  // EQUIPMENT_VENDINGMACHINE_NAME is Remote Caffeinator. Tests went green over it — the
  // test asserted the wrong value against the wrong item.
  //
  // "Resolve the token before writing" was the rule each time and it kept being skipped, so
  // it is a check now. A formula may cite another item's internal name freely — comparisons
  // are often the clearest way to explain a mechanic — but it must NAME that item too, so a
  // reader (and this rule) can see the reference is deliberate.
  const defsPath = resolve(root, ".gamedata/itemdefs.json");
  if (existsSync(defsPath)) {
    const defs = JSON.parse(readFileSync(defsPath, "utf8")) as {
      items: Array<{ name: string; cachedName: string; tags?: string[] }>;
      equipment: Array<{ name: string; cachedName: string; tags?: string[] }>;
    };

    /*
      DROP-POOL EXCLUSION, BOTH DIRECTIONS (§3j.172).

      `Run.BuildDropTable()` adds an item to its tier's `available*DropList` only when it lacks
      `WorldUnique`, and skips `IgnoreForDropList` outright. An item excluded there is in no pool,
      so no chest, printer or scrapper can produce it.

      `dropExclusion` is optional, which means its ABSENCE is a claim — "this drops normally" —
      and an absent field is exactly what nobody notices. So the two sets must match exactly:
      every tagged item carries the field with the right tags, and no untagged item carries it.
      A patch that made an item droppable, or made a new one undroppable, fails here rather than
      leaving the codex quietly wrong and the planner offering an impossible target.
    */
    const EXCLUSION_TAGS = ["WorldUnique", "IgnoreForDropList"];
    const tagsByName = new Map(defs.items.map((d) => [d.name, d.tags ?? []]));
    const canDropByName = new Map(
      (defs.equipment as Array<{ name: string; canDrop?: boolean }>).map((d) => [d.name, d.canDrop]),
    );

    /*
      Which catalog a record belongs to is decided by TIER, not by name. 45 names exist in both
      ItemCatalog and EquipmentCatalog, and one of them is real: "Faulty Conductor" is a Boss item
      (`ShockDamageAura`) AND an equipment (`DroneShockDamage`, canDrop = false). Matching by name
      alone would have marked our boss item — which drops perfectly normally — as impossible to
      find. That is §3j.77's internal-name-collision class, and it very nearly landed a false
      claim on a page.
    */
    const isEquipment = (t: string) => t === "equipment" || t === "lunar-equipment";

    let excludedChecked = 0;
    for (const it of items) {
      let expectedCause: string[];
      if (isEquipment(it.tier)) {
        const canDrop = canDropByName.get(it.name);
        if (canDrop === undefined) continue;
        expectedCause = canDrop === false ? ["EquipmentDef.canDrop = false"] : [];
      } else {
        const gameTags = tagsByName.get(it.name);
        if (!gameTags) continue;
        expectedCause = EXCLUSION_TAGS.filter((t) => gameTags.includes(t)).map((t) => `ItemTag.${t}`);
      }
      excludedChecked++;
      const expected = expectedCause;
      const declared = it.dropExclusion?.cause ?? [];
      const same =
        expected.length === declared.length && expected.every((t) => declared.includes(t));
      if (same) continue;
      if (expected.length && !declared.length) {
        errors.push(
          `"${it.id}" is excluded from the game's drop tables by ${expected.join("+")}, so ` +
            `BuildDropTable never adds it to a pool and no chest, printer or scrapper can ` +
            `produce it — but the record declares no dropExclusion, which reads as "drops normally"`,
        );
      } else if (!expected.length && declared.length) {
        errors.push(
          `"${it.id}" declares dropExclusion [${declared.join(", ")}] but the game excludes it ` +
            `from nothing — this CAN drop, and saying otherwise is a false claim on the page`,
        );
      } else {
        errors.push(
          `"${it.id}" declares dropExclusion [${declared.join(", ")}] but the game says ` +
            `[${expected.join(", ")}]`,
        );
      }
    }
    console.log(
      `  drop-pool exclusion: ${excludedChecked} record(s) cross-checked against the game ` +
        `(ItemTag for items, EquipmentDef.canDrop for equipment); ` +
        `${items.filter((i) => i.dropExclusion).length} excluded from every pool`,
    );
    const ours = new Set(items.map((i) => i.name));
    const byCachedName = new Map<string, string>();
    for (const d of [...defs.items, ...defs.equipment]) {
      // Only names for things in OUR dataset: a hidden internal item like BoostHp has no
      // page to be confused with, and flagging it would be noise.
      if (d.cachedName && ours.has(d.name)) byCachedName.set(d.cachedName, d.name);
    }
    // Everything we publish as prose, not just items.json. The artifact and shrine
    // `mechanic` strings are dense with internal names — thirteen of the artifact ones were
    // written in a single pass — and were never covered: the first sweep over reference.ts
    // found an unscoped negative AND a bare "Lightning" in Artifact of Honor. A guard that
    // only watches the file it was born in is a guard with a blind spot the size of the
    // rest of the dataset.

    for (const it of PROSE_RECORDS) {
      const prose = it.prose;
      if (!prose) continue;
      // Display names come out FIRST, longest first. Otherwise a short cachedName that is a
      // substring of a display name we deliberately wrote fires a false positive — naming
      // "Tri-Tip Dagger" tripped the rule for Ceremonial Dagger, whose cachedName is
      // "Dagger". Searching the remainder means only unlabelled references survive.
      // Apostrophes are normalised first. Writing "Paul’s Goat Hoof" with a typographic
      // quote left the straight-quoted display name unmatched, so the strip missed it and
      // "Hoof" was reported as an unlabelled reference to Paul's Goat Hoof — a false
      // positive produced purely by punctuation. The dataset uses straight quotes; prose
      // written by hand does not always.
      const flat = (s: string) => s.replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"');
      const flatProse = flat(prose);
      let stripped = flatProse;
      for (const display of [...ours].sort((a, b) => b.length - a.length)) {
        const d = flat(display);
        if (stripped.includes(d)) stripped = stripped.split(d).join(" ");
      }
      for (const [cachedName, display] of byCachedName) {
        if (display === it.name) continue;
        // A DOTTED reference is self-disambiguating and always allowed: `Elites.Lightning`,
        // `Buffs.BugWings`, `Items.BoostHp` name their namespace, so no reader can mistake
        // them for an item page. Only a bare token is ambiguous. Without this the rule
        // flagged Artifact of Honor's `Elites.Lightning` as a reference to Royal Capacitor,
        // whose cachedName happens to be "Lightning".
        // Also excludes a preceding hyphen: "Power-Saw" is MUL-T's skill, not a bare
        // citation of Sawmerang's `Saw`. A hyphen joins a compound word; it does not start
        // a new token the way whitespace does.
        if (!new RegExp(`(?<![-.\\w])${cachedName}\\b`).test(stripped)) continue;
        if (flatProse.includes(flat(display))) continue; // deliberate, and labelled
        errors.push(
          `${it.name}: cites the internal name "${cachedName}", which belongs to ` +
            `"${display}" — either this is the wrong item's mechanic, or name "${display}" ` +
            `in the text so the cross-reference is visible`,
        );
      }
    }
  } else {
    warnings.push(
      "internal-name collisions not checked (.gamedata/itemdefs.json absent — run extract-itemdefs.py)",
    );
  }

  // --- Unlock gating vs the game's own defs (PLAN §6A.7) -------------------
  // An item the game gates but we show as free is false information by omission —
  // the player is told it's obtainable when it isn't. Verified against the chain
  // ItemDef.unlockableDef -> [RegisterAchievement] -> ACHIEVEMENT_* tokens.
  // Runs only when the extraction is present, so contributors without a game
  // install aren't blocked; CI has the extraction and enforces it.
  const achPath = resolve(root, ".gamedata/achievements.json");
  if (existsSync(achPath)) {
    const ach = JSON.parse(readFileSync(achPath, "utf8")) as {
      items: Record<string, { challenge: string | null; requirement: string | null }>;
      equipment: Record<string, { challenge: string | null; requirement: string | null }>;
    };
    const gated = new Map<string, { challenge: string | null; requirement: string | null }>();
    for (const kind of ["items", "equipment"] as const) {
      for (const [name, v] of Object.entries(ach[kind])) gated.set(name, v);
    }
    // A check that reports success must report its DENOMINATOR. `data:verify`'s first
    // cooldown pass printed "0 mismatches" over a comparison set of size ZERO, because a name
    // lookup returned nothing for every single item (MATH-VERIFICATION §3j.126). "All checks
    // passed" and "nothing was compared" must not look identical from outside. This loop is
    // partly self-protecting — an empty `gated` map would error on all 49 locked items — but
    // partly is not the same as provably, so the number is printed.
    let gatingCompared = 0;
    for (const it of items) {
      const g = gated.get(it.name);
      if (g?.challenge || it.unlock) gatingCompared++;
      if (g?.challenge) {
        if (!it.unlock) {
          errors.push(`"${it.id}" is gated in-game (challenge "${g.challenge}") but has no unlock — the site shows it as freely available`);
        } else if (it.unlock.challenge !== g.challenge) {
          errors.push(`"${it.id}" unlock challenge is "${it.unlock.challenge}", game says "${g.challenge}"`);
        } else if (g.requirement && it.unlock.requirement !== g.requirement) {
          errors.push(`"${it.id}" unlock requirement does not match the game's achievement text`);
        }
      } else if (it.unlock && !gated.has(it.name)) {
        errors.push(`"${it.id}" is marked locked but no ItemDef/EquipmentDef gates it`);
      }
    }
    console.log(
      `  unlock gating: ${gatingCompared} item(s) cross-checked against the game's achievements.`,
    );
  } else {
    warnings.push("unlock gating not cross-checked (.gamedata/achievements.json absent — run extract-unlockables.py + extract-achievements.py)");
  }

  // --- Artifact icons (PLAN §4.8) -----------------------------------------
  for (const a of ARTIFACTS) {
    const iconPath = resolve(root, "public" + a.icon);
    if (!existsSync(iconPath)) warnings.push(`missing artifact icon: ${a.icon} for "${a.id}"`);
  }

  // --- Survivors (if present) ---------------------------------------------
  let survivorCount = 0;
  const survivorIdList: string[] = [];
  if (existsSync(survivorsPath)) {
    let sraw: unknown;
    try {
      sraw = JSON.parse(readFileSync(survivorsPath, "utf8"));
    } catch (e) {
      console.error(`data:audit — survivors.json is not valid JSON: ${(e as Error).message}`);
      return 1;
    }
    const sParsed = survivorsFileSchema.safeParse(sraw);
    if (!sParsed.success) {
      console.error("data:audit — survivors schema validation failed:\n");
      for (const issue of sParsed.error.issues) {
        const path = issue.path.length ? issue.path.join(".") : "(root)";
        console.error(`  ✗ ${path}: ${issue.message}`);
      }
      return 1;
    }
    survivorCount = sParsed.data.length;
    const seen = new Set<string>();
    for (const s of sParsed.data) {
      survivorIdList.push(s.id);
      if (seen.has(s.id)) errors.push(`duplicate survivor id "${s.id}"`);
      seen.add(s.id);
      if (!s.verified) warnings.push(`unverified survivor: "${s.id}" (${s.name})`);
    }
  }

  // --- Skills / proc coefficients (if present) ------------------------------
  let skillCount = 0;
  let procVerified = 0;
  let noAttack = 0;
  if (existsSync(skillsPath)) {
    let kraw: unknown;
    try {
      kraw = JSON.parse(readFileSync(skillsPath, "utf8"));
    } catch (e) {
      console.error(`data:audit — skills.json is not valid JSON: ${(e as Error).message}`);
      return 1;
    }
    const kParsed = skillsFileSchema.safeParse(kraw);
    if (!kParsed.success) {
      console.error("data:audit — skills schema validation failed:\n");
      for (const issue of kParsed.error.issues) {
        const path = issue.path.length ? issue.path.join(".") : "(root)";
        console.error(`  ✗ ${path}: ${issue.message}`);
      }
      return 1;
    }
    const survivorIds = new Set(survivorIdList);
    for (const entry of kParsed.data) {
      if (survivorIds.size && !survivorIds.has(entry.survivor)) {
        errors.push(`skills.json references unknown survivor "${entry.survivor}"`);
      }
      for (const sk of entry.skills) {
        skillCount++;
        if (sk.verified) procVerified++;
        // A skill with no damage path has nothing to verify; counting it as unverified
        // overstates the gap, which is how 21 skills were reported when only 2 were
        // genuinely unknown (MATH-VERIFICATION §3j.47).
        else if (sk.damaging === false) noAttack++;
      }
    }
    const unverified = skillCount - procVerified - noAttack;
    if (unverified) {
      warnings.push(
        `${unverified}/${skillCount} skills have an unknown proc coefficient — see MATH-VERIFICATION.md Phase 5`,
      );
    }
    if (noAttack) {
      console.log(
        `  ${noAttack}/${skillCount} skills have no damage path at all (proc not applicable)`,
      );
    }
  }

  // --- Loadout unlocks cross-referenced against extracted game data ---------
  // These were hand-entered from the wiki and drifted: 18 rows had the wrong slot
  // and 12 more never joined at all because DLC survivors were named
  // "Railgunner (SotV)" instead of "Railgunner". Both are silent failures — the
  // page just renders nothing — so they're checked here now.
  if (existsSync(skillsPath) && survivorIdList.length) {
    const skillsRaw = skillsFileSchema.safeParse(
      JSON.parse(readFileSync(skillsPath, "utf8")),
    );
    const survivorsByName = new Map(
      survivorsFileSchema
        .parse(JSON.parse(readFileSync(survivorsPath, "utf8")))
        .map((s) => [s.name, s.id]),
    );
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (skillsRaw.success) {
      for (const entry of LOADOUT_UNLOCKS) {
        const sid = survivorsByName.get(entry.survivor);
        if (!sid) {
          errors.push(
            `LOADOUT_UNLOCKS survivor "${entry.survivor}" does not match any survivors.json name`,
          );
          continue;
        }
        const gameSkills = skillsRaw.data.find((x) => x.survivor === sid)?.skills ?? [];
        for (const u of entry.skills) {
          const hit = gameSkills.find((k) => norm(k.name) === norm(u.skill));
          if (!hit) continue; // not a loadout-slot skill (e.g. Captain's beacon options)
          const gameSlot = hit.slot.charAt(0).toUpperCase() + hit.slot.slice(1);
          if (gameSlot !== u.slot) {
            errors.push(
              `LOADOUT_UNLOCKS "${entry.survivor} / ${u.skill}" slot is "${u.slot}", game says "${gameSlot}"`,
            );
          }
        }
      }
    }
  }

  // --- Loadout unlocks: the right challenge, with the game's exact wording ---
  // `data:diff` confirms each challenge NAME exists somewhere in the game, and the block
  // above confirms slots. Neither confirms that a given skill is paired with the *right*
  // challenge, or that the requirement text is the game's — so a skill could carry another
  // skill's unlock condition and nothing would notice. Local-only: .gamedata is git-ignored.
  const skillUnlockPath = resolve(root, ".gamedata/skill-unlocks.json");
  if (existsSync(skillUnlockPath)) {
    const dump = JSON.parse(readFileSync(skillUnlockPath, "utf8")) as Record<
      string,
      { alternates?: Array<{ skill: string; challenge: string; requirement?: string }> }
    >;
    const game = new Map<string, { challenge: string; requirement?: string }>();
    for (const v of Object.values(dump)) {
      for (const a of v.alternates ?? []) {
        game.set(a.skill, { challenge: a.challenge, requirement: a.requirement });
      }
    }
    if (game.size === 0) {
      warnings.push("skill-unlocks.json parsed to 0 pairs — extractor output shape changed?");
    } else {
      for (const entry of LOADOUT_UNLOCKS) {
        for (const u of entry.skills) {
          const g = game.get(u.skill);
          // Skills outside the SkillFamily variant list (Acrid's Blight passive, Captain's
          // beacon options) legitimately are not in the dump; they are verified against
          // Achievements.json by hand and recorded in MATH-VERIFICATION §3j.44.
          if (!g) continue;
          if (u.challenge && g.challenge !== u.challenge) {
            errors.push(
              `LOADOUT_UNLOCKS "${u.skill}": challenge is "${u.challenge}", game says ` +
                `"${g.challenge}"`,
            );
          } else if (u.requirement && g.requirement && u.requirement !== g.requirement) {
            errors.push(
              `LOADOUT_UNLOCKS "${u.skill}": requirement text differs from the game's ` +
                `achievement description`,
            );
          }
        }
      }
    }
  }

  // --- Verified numbers must not silently contradict the description --------
  // `description` is the game's own wording and `stacking` is what the code does. When a
  // sweep corrects a stacking value the description keeps the old number, and the UI was
  // rendering both — with the description's figures highlighted as though authoritative.
  // Wax Quail displayed "10m" three lines above a verified 5m. Either the description
  // contains the verified number, or `descriptionNote` has to explain why it does not.
  for (const it of items) {
    if (it.confidence !== "code" && it.confidence !== "asset") continue;
    if (it.descriptionNote) continue;
    const orphans: string[] = [];
    for (const s of it.stacking) {
      for (const [k, v] of [
        ["base", s.base],
        ["perStack", s.perStack],
      ] as const) {
        if (v == null || v === 0) continue;
        // Accept the rounded form too: 20.4 may legitimately read as "20" in prose.
        const forms = [String(v), String(Math.round(v)), String(Math.abs(v))];
        /*
          Compare NUMERIC TOKENS, not substrings (§3j.160).

          `description.includes("2")` is true of "Cooldown: 25s" and of "150%", so this rule
          passed on numbers the description never states. Aurelionite's Blessing's 2s telegraph
          was "found" inside the cooldown sentence, and its 7.5m radius inside "8 gold" — both
          silent until the cooldown suffix was removed and the coincidence went with it.
          Tokenising surfaces exactly 2 real orphans across 217 items.
        */
        const tokens = new Set(it.description.match(/\d+(?:\.\d+)?/g) ?? []);
        if (!forms.some((f) => tokens.has(f))) {
          orphans.push(`${s.stat}.${k}=${v}`);
        }
      }
    }
    if (orphans.length) {
      errors.push(
        `${it.name}: verified value(s) ${orphans.join(", ")} do not appear in the ` +
          `description, and there is no \`descriptionNote\` explaining the discrepancy — ` +
          `the page would show the game's number and ours side by side with no indication ` +
          `which is right`,
      );
      continue;
    }
    // "Number appears somewhere" is a weak test: Plasma Shrimp's description says
    // "+50% per stack" while the verified value is 40, and passed the check above purely
    // because "40" occurs earlier in the same sentence. So also read the per-stack figures
    // the description states outright and require one of them to match.
    // Units may carry a slash or a space ("+1.6 hp/s per stack"), so the unit class has to
    // allow both — without it Titanic Knurl reported a phantom mismatch.
    const stated = [...it.description.matchAll(/\(\+?(-?\d+(?:\.\d+)?)\s*[a-z%/ ]*per stack\)/gi)]
      .map((m) => Math.abs(Number(m[1])));
    if (stated.length) {
      const verified = it.stacking
        .map((s) => s.perStack)
        .filter((v): v is number => v != null && v !== 0)
        .map(Math.abs);
      const unmatched = verified.filter((v) => !stated.some((d) => Math.abs(d - v) < 1e-6));
      if (unmatched.length && verified.length) {
        errors.push(
          `${it.name}: description states "+${stated.join("/")} per stack" but the ` +
            `verified per-stack value(s) are ${unmatched.join(", ")}, with no ` +
            `\`descriptionNote\` to flag it`,
        );
      }
    }
  }

  // --- Equipment cooldown: field must agree with the sentence ---------------
  // The cooldown used to live only inside `description`, where nothing could check it,
  // and Seed of Life published "Cooldown: 60s" for an equipment whose EquipmentDef says
  // 0 and whose in-game text mentions no cooldown at all. Now that `cooldown` is a real
  // field sourced from the asset, prose that disagrees with it is a hard error.
  for (const it of items) {
    const isEquipment = it.tier === "equipment" || it.tier === "lunar-equipment";
    if (!isEquipment) {
      if (it.cooldown !== undefined) {
        errors.push(`${it.name}: cooldown is set but the item is not equipment`);
      }
      continue;
    }
    const stated = /Cooldown: (\d+(?:\.\d+)?)s\./.exec(it.description);
    // Passive equipment cannot be activated at all, so its EquipmentDef cooldown never
    // runs. Stating it reads as an operative number and is worse than saying nothing —
    // this rule exists because I appended asset cooldowns to the nine elite Aspects and
    // produced "Passive (no cooldown). Cooldown: 10s." in the same sentence.
    // `triggered` is the exception: no handler, but an in-world event spends the charge and
    // starts the cooldown anyway (Executive Card — see §3j.76). For those the stated cooldown
    // is operative, so the rule must not fire; everything else keeps failing closed.
    if (it.activated === false && !it.triggered) {
      if (stated) {
        errors.push(
          `${it.name}: states a cooldown, but it has no EquipmentSlot handler — ` +
            `activating it does nothing and the cooldown never runs`,
        );
      }
      continue;
    }
    if (it.triggered && it.activated !== false) {
      errors.push(
        `${it.name}: marked \`triggered\` but not \`activated: false\` — the flag exists ` +
          `precisely for equipment whose key does nothing`,
      );
    }
    if (it.cooldown === undefined) {
      warnings.push(`${it.name}: equipment has no cooldown field (asset value not recorded)`);
      // Tolerance, not equality: these come from float32 assets, so Executive Card's
      // 0.1s deserializes as 0.10000000149011612.
    } else if (stated && Math.abs(Number(stated[1]) - it.cooldown) > 1e-4) {
      errors.push(
        `${it.name}: description says "Cooldown: ${stated[1]}s" but the EquipmentDef ` +
          `value is ${it.cooldown}s`,
      );
      /*
        §3j.160 — the description is NOT where the cooldown has to be stated.

        This rule once warned when an equipment's description omitted its cooldown, from a time
        when `description` was the only place the number could live. It is not any more: the
        cooldown is a structured field, cross-checked 41/41 against EquipmentDef by
        `data:verify` (§3j.126, §3j.130) and rendered in its own block in the drawer (§3j.151).

        Keeping the warning had a cost that outweighed it. Satisfying it meant appending
        "Cooldown: Ns." to a field `schema.ts` documents as "the game's wording, kept verbatim",
        for 41 items whose in-game text says no such thing — so a rule meant to protect the
        reader was quietly forcing every equipment description to stop being a quotation, and
        printing the number twice on the page.

        What survives is the half that catches a real defect: if a description DOES state a
        cooldown, it must agree with the asset value (the branch above). Some game descriptions
        genuinely include one, and a stale number there is a lie about the game.
      */
    } else if (stated && it.cooldown === 0) {
      errors.push(
        `${it.name}: description states a cooldown but the EquipmentDef value is 0 ` +
          `(consumed-on-use equipment has none)`,
      );
    }
    // A bare 0 is ambiguous where it matters most: on its own it reads as "reusable
    // instantly" when in every real case so far it means "there is nothing to recharge".
    // Now that the detail page renders the cooldown, that ambiguity would be published
    // rather than merely stored (PLAN §9.1).
    // (`activated: false` already `continue`d above, so anything reaching here is activatable.)
    if (it.cooldown === 0 && !it.consumedOnUse) {
      errors.push(
        `${it.name}: activated equipment with a 0s cooldown must set \`consumedOnUse\` ` +
          `— a bare 0 renders as "reusable instantly"`,
      );
    }
    if (it.consumedOnUse && it.cooldown !== 0) {
      errors.push(
        `${it.name}: marked consumedOnUse but carries a ${it.cooldown}s cooldown`,
      );
    }
  }

  // --- Coverage ratchet (PLAN §6B.2) ---------------------------------------
  // Verification must only ever go UP. Without this, a future import or refactor can
  // silently downgrade records and nothing notices — which is exactly how 161 items
  // came to be presented with the same confidence as the verified ones.
  const verifiedCount = items.filter(
    (it) => it.confidence === "code" || it.confidence === "asset",
  ).length;
  const floorPath = resolve(root, "src/data/coverage-floor.json");
  const floor = existsSync(floorPath)
    ? (JSON.parse(readFileSync(floorPath, "utf8")) as { items: number })
    : { items: 0 };
  if (verifiedCount < floor.items) {
    errors.push(
      `coverage regression: ${verifiedCount} items are code/asset-verified but the ` +
        `floor is ${floor.items}. Verification must not go backwards — if a downgrade ` +
        `is genuinely correct, lower src/data/coverage-floor.json deliberately and say why.`,
    );
  } else if (verifiedCount > floor.items) {
    warnings.push(
      `coverage rose to ${verifiedCount}/${items.length} (floor is ${floor.items}) — ` +
        `raise src/data/coverage-floor.json to lock it in`,
    );
  }

  // --- Report --------------------------------------------------------------
  console.log(
    `data:audit — ${items.length} item(s), ${survivorCount} survivor(s), ` +
      `${skillCount} skill(s) [${procVerified} with verified proc] checked.`,
  );
  if (warnings.length) {
    console.log(`\n${warnings.length} warning(s):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }
  if (errors.length) {
    console.error(`\n${errors.length} error(s):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    return 1;
  }
  console.log(warnings.length ? "\nNo fatal errors." : "All checks passed.");
  return 0;
}

process.exit(main());
