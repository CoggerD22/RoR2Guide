import { survivors } from "@/data/survivors";
import { skillsBySurvivor } from "@/data/skills";
import { LOADOUT_UNLOCKS } from "@/data/reference";
import type { Survivor, Skill } from "@/data/schema";

/**
 * Joins the three verified survivor datasets into one view (PLAN §4.1):
 *   survivors.json   base stats, read from the game's body prefabs
 *   skills.json      loadout skills + proc coefficients, from assets/assembly
 *   LOADOUT_UNLOCKS  which variants are locked behind a challenge
 *
 * All three are facts. Nothing here ranks or recommends — that belongs in /guides.
 */
export interface SkillRow extends Skill {
  /** Unlock challenge name, when this variant is locked behind one. */
  challenge?: string;
  requirement?: string;
}

export interface SurvivorDetail {
  survivor: Survivor;
  slots: Array<{ slot: Skill["slot"]; label: string; skills: SkillRow[] }>;
  /** Loadout variants we have an unlock for but couldn't match to a skill. */
  unmatchedUnlocks: Array<{ skill: string; slot: string; challenge: string; requirement: string }>;
}

const SLOT_ORDER: Array<{ slot: Skill["slot"]; label: string }> = [
  { slot: "primary", label: "Primary" },
  { slot: "secondary", label: "Secondary" },
  { slot: "utility", label: "Utility" },
  { slot: "special", label: "Special" },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function getSurvivorDetail(id: string): SurvivorDetail | null {
  const survivor = survivors.find((s) => s.id === id);
  if (!survivor) return null;

  const skills = skillsBySurvivor.get(id) ?? [];
  const unlockEntry = LOADOUT_UNLOCKS.find((u) => u.survivor === survivor.name);
  const unlocks = unlockEntry?.skills ?? [];
  const used = new Set<string>();

  const slots = SLOT_ORDER.map(({ slot, label }) => ({
    slot,
    label,
    skills: skills
      .filter((s) => s.slot === slot)
      .map((s): SkillRow => {
        const match = unlocks.find((u) => norm(u.skill) === norm(s.name));
        if (match) used.add(match.skill);
        return match ? { ...s, challenge: match.challenge, requirement: match.requirement } : s;
      }),
  })).filter((g) => g.skills.length > 0);

  return {
    survivor,
    slots,
    unmatchedUnlocks: unlocks.filter((u) => !used.has(u.skill)),
  };
}

/** Stat rows for the detail page: base value plus per-level growth where it scales. */
export function statRows(s: Survivor): Array<{ label: string; base: string; perLevel?: string }> {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ""));
  // Signed growth: "+33", "-1.2" — a "+" prefix on a negative (Heretic's regen)
  // would read "+-1.2".
  const g = (v: number) => (v < 0 ? n(v) : `+${n(v)}`);
  return [
    { label: "Health", base: n(s.health.base), perLevel: g(s.health.perLevel) },
    { label: "Health regen", base: `${n(s.regen.base)}/s`, perLevel: `${g(s.regen.perLevel)}/s` },
    { label: "Damage", base: n(s.damage.base), perLevel: g(s.damage.perLevel) },
    { label: "Move speed", base: `${n(s.moveSpeed)} m/s` },
    { label: "Armor", base: n(s.armor) },
    { label: "Jumps", base: n(s.jumpCount) },
    { label: "Attack speed", base: `${n(s.baseAttackSpeed)}x` },
  ];
}
