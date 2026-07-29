/**
 * Where every displayed field actually comes from (PLAN §6A.2 / §6A.3 / §6B.3).
 *
 * `items.json` carries a per-record `confidence` because its records were verified
 * individually and diverge. The reference datasets do not: every artifact effect came
 * from the same token family, every dream from the same one, and so on. So their
 * provenance is declared ONCE per (dataset, field) here rather than copied onto 123
 * records, which would be churn without adding information.
 *
 * This exists to be *rendered*, not just documented. A field the site shows without
 * saying where it came from is a claim it cannot back — and about one in five records
 * examined so far has been wrong in a way transcription alone could not catch.
 */

/** Authority tiers, strongest first (PLAN §6A.2). */
export type SourceTier =
  /** Decompiled C# — what the game actually does. */
  | "code"
  /** Serialized asset/prefab fields — the constants that ship. */
  | "asset"
  /** `Language/en` tokens — authoritative for TEXT, never for behaviour. */
  | "langfile"
  /** riskofrain2.wiki.gg — a lead or cross-check, never a source of record. */
  | "wiki"
  /** Ours: a summary or judgement, not a claim about the game. */
  | "editorial";

export interface FieldSource {
  tier: SourceTier;
  /** How it was obtained — must be specific enough to re-check. */
  ref: string;
  /**
   * True when the tier is adequate for what the field ASSERTS. A description token is
   * a fine source for quoted text and an inadequate one for a mechanic (§5.0.1), so
   * this is what drives the "unverified" treatment in the UI.
   */
  adequate: boolean;
}

export const SHORT_LABEL: Record<SourceTier, string> = {
  code: "Code-verified",
  asset: "Asset-verified",
  langfile: "Game text",
  wiki: "Community wiki",
  editorial: "Our summary",
};

type DatasetSources = Record<string, FieldSource>;

export const REFERENCE_PROVENANCE: Record<string, DatasetSources> = {
  artifacts: {
    name: { tier: "langfile", ref: "ARTIFACT_*_NAME", adequate: true },
    effect: {
      tier: "langfile",
      ref: "ARTIFACT_*_DESCRIPTION",
      // Quoted text presented as a mechanic — §5.0.3 marks this INVALID until each
      // artifact is traced to its behaviour/manager class.
      adequate: false,
    },
    code: {
      tier: "code",
      // The game ships only SHA-256 hashes of the dialled sequence, so the codes are not
      // readable from the assets — but the search space is fully determined BY the assets:
      // 9 buttons (dialer prefab) x 5 ArtifactCompoundDef values (1/3/5/7/11) = 1,953,125.
      // scripts/crack-ambry-codes.py recovers all 19 and confirms every published code
      // against the hash the game itself validates against. Cryptographic, not transcribed.
      ref: "PortalDialerController.PerformActionServer -> Sha256HashAsset; all 19 recovered and matched by scripts/crack-ambry-codes.py",
      adequate: true,
    },
    icon: {
      tier: "asset",
      // Previously downloaded from the wiki. Now each emblem is the sprite from that
      // artifact's OWN ArtifactDef.smallIconSelectedSprite, keyed by its nameToken — so
      // icon/artifact correspondence is guaranteed by construction rather than trusted.
      ref: "ArtifactDef.smallIconSelectedSprite, keyed by ArtifactDef.nameToken",
      adequate: true,
    },
  },
  dreams: {
    dream: { tier: "langfile", ref: "BAZAAR_SEER_<STAGE> — the Seer literally speaks this line", adequate: true },
    stage: { tier: "langfile", ref: "MAP_<STAGE>_TITLE, joined via the seer token name", adequate: true },
    stageNumber: { tier: "asset", ref: "SceneDef.stageOrder", adequate: true },
  },
  shrines: {
    name: { tier: "langfile", ref: "SHRINE_*_NAME / NEWT_STATUE_NAME", adequate: true },
    description: { tier: "langfile", ref: "SHRINE_*_DESCRIPTION, quoted verbatim", adequate: true },
    mechanic: { tier: "code", ref: "Shrine*Behavior + the shrine prefab's serialized fields", adequate: true },
    cost: { tier: "editorial", ref: "our one-line summary; the game states cost in prose", adequate: false },
  },
  loadoutUnlocks: {
    skill: { tier: "asset", ref: "SkillFamily.variants[].skillDef", adequate: true },
    slot: { tier: "asset", ref: "SkillLocator slot the family is attached to", adequate: true },
    challenge: { tier: "code", ref: "[RegisterAchievement] -> ACHIEVEMENT_*_NAME", adequate: true },
    requirement: {
      tier: "langfile",
      ref: "ACHIEVEMENT_*_DESCRIPTION — the game's STATED condition, not the verified trigger",
      adequate: true,
    },
  },
};

/** Fields whose source is too weak for what they assert — these drive UI warnings. */
export function inadequateFields(dataset: keyof typeof REFERENCE_PROVENANCE): string[] {
  const ds = REFERENCE_PROVENANCE[dataset] ?? {};
  return Object.entries(ds)
    .filter(([, s]) => !s.adequate)
    .map(([field]) => field);
}
