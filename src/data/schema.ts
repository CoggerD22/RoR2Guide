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
     * For LINEAR effects these fully describe the curve:
     *   value(n) = base + perStack*(n-1)
     *
     * For non-linear types `formula` is authoritative and `base` means different
     * things by type — a distinction worth stating, because conflating them has
     * already produced real bugs:
     *
     * - HYPERBOLIC: `base` is the **amplification input**, not the value a player
     *   sees. Tougher Times stores base 15 and blocks **13.04%** at one stack
     *   (`ConvertAmplificationPercentageIntoReductionPercentage(15n)`). The gap is
     *   the entire point of the type. `data:audit` therefore skips hyperbolic when
     *   cross-checking formula prose against `base`.
     * - EXPONENTIAL / RECIPROCAL / SPECIAL: `base` is the **actual value at one
     *   stack**, which is NOT always the number in the game's description —
     *   Safer Spaces is described as "15 seconds" but recharges in 13.5s at one
     *   stack, and Bandolier is described as 18% but rolls 20.4%.
     *
     * The in-game wording is preserved separately in `description`; where the two
     * disagree, `formula` says so explicitly rather than silently overriding it.
     */
    base: z.number(),
    perStack: z.number(),
    type: stackingTypeSchema,
    /** Exact formula string — REQUIRED for "special", useful elsewhere. */
    formula: z.string().min(1).optional(),
    /** Human note on any hard cap, e.g. "100% crit at 10 stacks". */
    cap: z.string().min(1).optional(),
    /**
     * Machine-readable hard ceiling: the stack count past which further copies do
     * NOTHING. Set only when a single fixed number is genuinely correct, because the
     * planner uses it to warn that a goal is wasted (PLAN §5.8b).
     *
     * Deliberately absent when a cap SCALES with stacks — Hiker's Boots caps its buff
     * at 10 × item count, so no single number exists and claiming one would be false.
     * Such items keep the prose `cap` only.
     */
    capStacks: z.number().int().positive().optional(),
  })
  .strict()
  .refine((e) => e.type !== "special" || !!e.formula, {
    message: 'stacking entries of type "special" must include a `formula`',
    path: ["formula"],
  })
  .refine((e) => !e.capStacks || !!e.cap, {
    message: "capStacks requires the human-readable `cap` note explaining it",
    path: ["cap"],
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
  // FoodTier — a real first-class tier (ItemTier.FoodTier = 10) with its own
  // Run.availableFoodTierDropList and a weight in BasicPickupDropTable, not a subtype.
  "food",
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
    /**
     * Shown directly beneath `description` when the game's own text disagrees with the
     * verified numbers.
     *
     * `description` is the game's wording, kept verbatim; `stacking` carries what the code
     * actually does. Where those differ we were rendering BOTH, with the description's
     * numbers highlighted as though authoritative and nothing telling the reader which to
     * trust — Wax Quail said "10m" three lines above a verified 5m. Publishing a number we
     * have proved wrong is not excused by publishing the right one nearby.
     *
     * `data:audit` requires this whenever a verified stacking value cannot be found in the
     * description, so the two can never silently drift apart again.
     */
    descriptionNote: z.string().min(1).optional(),
    /** Logbook flavour quote (optional; can be long). */
    flavor: z.string().min(1).optional(),
    /**
     * Equipment only: recharge time in seconds, straight from the EquipmentDef asset.
     *
     * A first-class field rather than prose, because the cooldown was previously stated
     * only inside `description` and nothing could check it — which is how Seed of Life
     * came to publish "Cooldown: 60s" for an equipment whose asset says 0 and whose own
     * in-game description mentions no cooldown at all. `data:audit` now cross-checks the
     * two, so the number can never drift from the sentence again.
     *
     * 0 is meaningful: consumed-on-use equipment (Seed of Life, Trophy Hunter's Tricorn)
     * genuinely has no cooldown, so this is optional-but-not-nullable and omitted only
     * for non-equipment.
     */
    cooldown: z.number().nonnegative().optional(),
    /**
     * Equipment only: does pressing the equipment key actually do anything?
     *
     * `EquipmentSlot.PerformEquipmentAction` ends in `return func?.Invoke() ?? false`,
     * and the caller only runs `OnEquipmentExecuted` — which spends the charge and
     * starts the cooldown — when that is true. Equipment with no handler therefore
     * cannot be activated at all, and its `cooldown` never runs even though the
     * EquipmentDef carries one.
     *
     * The nine elite Aspects are exactly this: zero references in EquipmentSlot. Stating
     * their asset cooldown as if it were operative is misleading, so `data:audit`
     * forbids it when this is false.
     */
    activated: z.boolean().optional(),
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
    /** Readable name, e.g. "Void Fiend". May be NORMALISED — see `gameName`. */
    name: z.string().min(1),
    /**
     * The survivor's exact in-game string, when it differs from `name`.
     *
     * Two survivors are stylised in the language files and nowhere carry a plain form:
     * Void Fiend is `「V??oid Fiend』` in every token including its achievements, and Chef
     * is `CHEF`. Displaying those verbatim would wreck search and readability, so the
     * codex normalises them — but silently normalising is still altering game data, and
     * rule #1 does not have a "cosmetic" exemption. Recording the original keeps the
     * normalisation a documented decision instead of an invisible one.
     */
    gameName: z.string().min(1).optional(),
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
    /**
     * False when the skill's state has NO damage-dealing path at all — a dash, a stance
     * swap, an aim state, a turret placement.
     *
     * Distinct from `proc: null`, which means "we could not establish a value". Conflating
     * them made the Stat Lab report 21 skills as unverified when 19 of them have nothing to
     * verify: Tactical Dive does not have an unknown proc coefficient, it has no attack.
     * Reporting a known thing as unknown is the mirror of this project's usual failure and
     * just as misleading.
     *
     * Established by scripts/classify-nondamaging-skills.py, which is deliberately
     * conservative — any reference to a damage API, in the state or one transition onward,
     * keeps a skill out of this category.
     */
    damaging: z.boolean().optional(),
    /** For item-granted kits (Heretic): the item that grants this skill. */
    grantedBy: z.string().min(1).optional(),
  })
  .strict()
  .refine((s) => s.damaging === false || (s.proc === null) === !s.verified, {
    message: "`verified` must be true exactly when `proc` is non-null (unless damaging:false)",
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
