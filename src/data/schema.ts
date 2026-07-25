import { z } from "zod";

/**
 * RoR2 Companion — data schema (PLAN §5, CLAUDE.md rules #1, #3, #4).
 *
 * Facts only. No ranking / "best item" language ever enters this dataset
 * (CLAUDE.md rule #7) — opinions live in /content/guides/*.md.
 *
 * Every number here must trace to riskofrain2.wiki.gg or the game's language
 * files. Anything unverifiable gets `verified: false` and is surfaced by the
 * audit script (`pnpm data:audit`); never invent a plausible value.
 */

/** How an item's effect scales with additional stacks (PLAN §2.2). */
export const stackingTypeSchema = z.enum([
  "linear", // base + perStack * x
  "hyperbolic", // 1 - 1/(1 + perStack * x)  — approaches but never reaches a cap
  "exponential", // compounding, e.g. perStack^x (Shaped Glass, Fuel Cell cooldown)
  "reciprocal", // a/x — diminishing; strongest at 1 stack (Light Flux, Corpsebloom cap)
  "special", // bespoke formula; describe it in `formula`
  "none", // does not stack / single-shot effect
]);
export type StackingType = z.infer<typeof stackingTypeSchema>;

/**
 * One scaling stat. An item can have SEVERAL of these with different types
 * (CLAUDE.md rule #3 — Fuel Cell: linear +1 charge AND exponential -15% cooldown),
 * so `Item.stacking` is an array, never flattened to an enum.
 */
export const stackingEntrySchema = z
  .object({
    /** Human label for the stat, e.g. "Damage bonus", "Cooldown reduction". */
    stat: z.string().min(1),
    /**
     * The per-stack numbers exactly as written in the in-game description
     * (Crowbar: base 75, perStack 75). For LINEAR effects these fully describe
     * the curve: value(n) = base + perStack*(n-1). For non-linear types the
     * numbers are the game's displayed nominal and `formula` is authoritative
     * (e.g. Tougher Times shows "15% (+15% per stack)" but is hyperbolic).
     */
    base: z.number(),
    perStack: z.number(),
    type: stackingTypeSchema,
    /** Exact formula string — REQUIRED for "special", useful elsewhere. */
    formula: z.string().min(1).optional(),
    /** Human note on any hard cap, e.g. "100% crit at 10 stacks". */
    cap: z.string().min(1).optional(),
  })
  .strict()
  .refine((e) => e.type !== "special" || !!e.formula, {
    message: 'stacking entries of type "special" must include a `formula`',
    path: ["formula"],
  });
export type StackingEntry = z.infer<typeof stackingEntrySchema>;

/** Item tier (colour identity). Void sub-tiers matter for Command drop pools. */
export const tierSchema = z.enum([
  "common",
  "uncommon",
  "legendary",
  "boss",
  "lunar",
  "void-common",
  "void-uncommon",
  "void-legendary",
  "void-boss",
  "equipment",
  "lunar-equipment",
]);
export type Tier = z.infer<typeof tierSchema>;

/** Edge-case variants that get filtered out of the default codex view (PLAN §2.1). */
export const subtypeSchema = z.enum(["consumed", "temporary", "untiered"]);
export type Subtype = z.infer<typeof subtypeSchema>;

/** Which release an item comes from. */
export const dlcSchema = z.enum([
  "base", // 1.0
  "sotv", // Survivors of the Void
  "sots", // Seekers of the Storm
  "ac", // Alloyed Collective
]);
export type Dlc = z.infer<typeof dlcSchema>;

const slug = z
  .string()
  .regex(/^[a-z0-9-]+$/, "id must be a lowercase kebab-case slug");

/**
 * How strongly a record's numbers are sourced (MATH-VERIFICATION.md §1), best first.
 * Wiki-only data has been wrong repeatedly in this project, so the distinction is
 * surfaced rather than implied by a bare `verified: true`.
 *   code     — checked against the decompiled assembly (formulas/coefficients)
 *   asset    — checked against the game's own asset bundles (prefab values)
 *   langfile — checked against the game's language files (names/pickups/numbers)
 *   wiki     — riskofrain2.wiki.gg only; not yet confirmed against game data
 */
export const confidenceSchema = z.enum(["code", "asset", "langfile", "wiki"]);
export type Confidence = z.infer<typeof confidenceSchema>;

export const itemSchema = z
  .object({
    /** Internal token-ish slug, e.g. "crowbar". Matches the icon filename. */
    id: slug,
    /** Exact in-game name, e.g. "Crowbar". */
    name: z.string().min(1),
    tier: tierSchema,
    subtype: subtypeSchema.optional(),
    dlc: dlcSchema,
    /** Short in-game pickup line. */
    pickupText: z.string().min(1),
    /** Full description with numbers. */
    description: z.string().min(1),
    /** Logbook flavour quote (optional; can be long). */
    flavor: z.string().min(1).optional(),
    stacking: z.array(stackingEntrySchema),
    /** Search/category tags: "damage","on-hit","healing","drone", … */
    tags: z.array(z.string().min(1)),
    /** Void item → ids of the normal items it corrupts. */
    corrupts: z.array(slug).nonempty().optional(),
    /** Normal item → the void id that corrupts it. */
    corruptedBy: slug.optional(),
    /**
     * If the item is locked behind a Challenge: its name plus the one-line
     * requirement (PLAN §2.6). `requirement` is the verbatim in-game achievement
     * description; it is omitted ONLY when it can't be verified — never guessed.
     */
    unlock: z
      .object({
        challenge: z.string().min(1),
        requirement: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
    /** Icon path, e.g. "/icons/crowbar.png". */
    icon: z.string().regex(/^\/icons\/[a-z0-9-]+\.png$/, "icon must be /icons/<slug>.png"),
    /** Canonical wiki.gg URL. */
    wiki: z.url(),
    /** True only when every value traces to an approved source (rule #1). */
    verified: z.boolean(),
    /** Strength of that sourcing (see confidenceSchema). */
    confidence: confidenceSchema.optional(),
  })
  .strict()
  .refine((it) => !(it.corrupts && it.corruptedBy), {
    message: "an item cannot both corrupt and be corrupted",
    path: ["corruptedBy"],
  })
  .refine((it) => !it.corrupts || it.tier.startsWith("void-"), {
    message: "only void-tier items may declare `corrupts`",
    path: ["corrupts"],
  });
export type Item = z.infer<typeof itemSchema>;

/** The whole items.json payload. */
export const itemsFileSchema = z.array(itemSchema);
export type ItemsFile = z.infer<typeof itemsFileSchema>;

/**
 * Survivor stats (PLAN §2.3). `base`/`perLevel` scale as
 * stat(level) = base + perLevel*(level-1). Regen values are the standard
 * (Rainstorm) difficulty figures; move speed, armor, and jumps are flat.
 */
export const statScalingSchema = z
  .object({ base: z.number(), perLevel: z.number() })
  .strict();
export type StatScaling = z.infer<typeof statScalingSchema>;

export const survivorSchema = z
  .object({
    id: slug,
    name: z.string().min(1),
    dlc: dlcSchema,
    health: statScalingSchema,
    regen: statScalingSchema,
    damage: statScalingSchema,
    moveSpeed: z.number(),
    armor: z.number(),
    jumpCount: z.number().int(),
    baseAttackSpeed: z.number(),
    wiki: z.url(),
    verified: z.boolean(),
    /** Strength of that sourcing (see confidenceSchema). */
    confidence: confidenceSchema.optional(),
  })
  .strict();
export type Survivor = z.infer<typeof survivorSchema>;

export const survivorsFileSchema = z.array(survivorSchema);
export type SurvivorsFile = z.infer<typeof survivorsFileSchema>;

/**
 * Survivor loadout skills + proc coefficients (MATH-VERIFICATION Phase 5).
 * Generated by scripts/extract-loadouts.py + scripts/build-skill-procs.mjs from
 * the game's own bundles/assembly — never hand-entered.
 *
 * `proc` is null when no value could be established from game data; `verified`
 * mirrors that. A null proc means "not yet verified", NOT "does not proc" —
 * the UI must not render it as a number. `procSource` records provenance
 * (esc:<field> / projectile:<name> / code:* / review:*).
 */
export const skillSchema = z
  .object({
    slot: z.enum(["primary", "secondary", "utility", "special"]),
    name: z.string().min(1),
    state: z.string().min(1),
    proc: z.number().nullable(),
    procSource: z.string().min(1),
    verified: z.boolean(),
    /** For item-granted kits (Heretic): the item that grants this skill. */
    grantedBy: z.string().min(1).optional(),
  })
  .strict()
  .refine((s) => (s.proc === null) === !s.verified, {
    message: "`verified` must be true exactly when `proc` is non-null",
    path: ["verified"],
  });
export type Skill = z.infer<typeof skillSchema>;

export const survivorSkillsSchema = z
  .object({
    survivor: slug,
    body: z.string().min(1),
    skills: z.array(skillSchema),
  })
  .strict();
export type SurvivorSkills = z.infer<typeof survivorSkillsSchema>;

export const skillsFileSchema = z.array(survivorSkillsSchema);
export type SkillsFile = z.infer<typeof skillsFileSchema>;
