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
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  itemsFileSchema,
  survivorsFileSchema,
  skillsFileSchema,
  type Item,
} from "../src/data/schema.ts";
import { LOADOUT_UNLOCKS, ARTIFACTS } from "../src/data/reference.ts";

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
      if (entry.type !== "exponential" && entry.type !== "special" && entry.type !== "reciprocal") {
        continue;
      }
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
    for (const it of items) {
      const g = gated.get(it.name);
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
      }
    }
    const unverified = skillCount - procVerified;
    if (unverified) {
      warnings.push(
        `${unverified}/${skillCount} skills have no verified proc coefficient (proc:null) — see MATH-VERIFICATION.md Phase 5`,
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
