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
  if (source.startsWith("esc-via-transition")) return "game asset (via follow-up state)";
  if (source.startsWith("esc")) return "game asset (skill config)";
  if (source.startsWith("projectile")) return "game asset (projectile prefab)";
  if (source.startsWith("code:explicit")) return "game code (explicit value)";
  if (source.startsWith("code:default")) return "game code (attack default 1.0)";
  return "not yet verified";
}
