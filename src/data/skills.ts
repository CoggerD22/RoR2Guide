import rawSkills from "./skills.json";
import type { SurvivorSkills, Skill } from "./schema";

/**
 * Survivor loadout skills + proc coefficients (MATH-VERIFICATION Phase 5).
 * Generated from the game's own bundles/assembly — see scripts/extract-loadouts.py
 * and scripts/build-skill-procs.mjs. A null `proc` means "not yet verified",
 * NOT "does not proc"; never render it as a number.
 */
export const survivorSkills = rawSkills as unknown as SurvivorSkills[];

export const skillsBySurvivor = new Map<string, Skill[]>(
  survivorSkills.map((s) => [s.survivor, s.skills]),
);

export const SLOT_LABEL: Record<Skill["slot"], string> = {
  primary: "Primary",
  secondary: "Secondary",
  utility: "Utility",
  special: "Special",
};

/** Short, human explanation of where a proc value came from. */
export function procProvenance(source: string): string {
  // The value is read from the firing state's own game data; only the link from
  // this skill to that state is a reviewed human judgement (see
  // scripts/build-skill-procs.mjs CURATED_DAMAGE_STATE).
  if (source.startsWith("curated-link")) return "game asset (hand-linked firing state)";
  if (source.startsWith("esc-via-transition")) return "game asset (via follow-up state)";
  if (source.startsWith("esc")) return "game asset (skill config)";
  if (source.startsWith("projectile")) return "game asset (projectile prefab)";
  if (source.startsWith("code:explicit")) return "game code (explicit value)";
  if (source.startsWith("code:default")) return "game code (attack default 1.0)";
  // `code:no-damage-path` is a VERIFIED ABSENCE, established by
  // scripts/classify-nondamaging-skills.py — Tactical Dive does not have an unknown proc
  // coefficient, it has no attack. schema.ts already says conflating the two "is the mirror
  // of this project's usual failure and just as misleading", and the Stat Lab was fixed for
  // it; this function was not, so 21 skills still described themselves as unverified here.
  if (source.startsWith("code:no-damage-path")) return "game code (no damage-dealing path)";
  // Everything else prefixed `code:` names the exact site the value was read from, e.g.
  // `code:FireSonicBoom.CalculateProcCoefficient=0f`. A proc of 0 that was READ is not a
  // proc that is unknown.
  if (source.startsWith("code:")) return `game code (${source.slice(5)})`;
  return "not yet verified";
}
