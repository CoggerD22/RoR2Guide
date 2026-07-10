import rawItems from "./items.json";
import type { Item, Tier, Dlc } from "./schema";

/** The full item dataset (validated at build time by `pnpm data:audit`). */
export const items = rawItems as unknown as Item[];

/** Display order for tier groupings in the codex. */
export const TIER_ORDER: Tier[] = [
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
];

export interface TierMeta {
  label: string;
  /** CSS color reference for this tier's identity (border/glow/text). */
  color: string;
}

export const TIER_META: Record<Tier, TierMeta> = {
  common: { label: "Common", color: "var(--tier-common)" },
  uncommon: { label: "Uncommon", color: "var(--tier-uncommon)" },
  legendary: { label: "Legendary", color: "var(--tier-legendary)" },
  boss: { label: "Boss", color: "var(--tier-boss)" },
  lunar: { label: "Lunar", color: "var(--tier-lunar)" },
  "void-common": { label: "Void · Common", color: "var(--tier-void)" },
  "void-uncommon": { label: "Void · Uncommon", color: "var(--tier-void)" },
  "void-legendary": { label: "Void · Legendary", color: "var(--tier-void)" },
  "void-boss": { label: "Void · Boss", color: "var(--tier-void)" },
  equipment: { label: "Equipment", color: "var(--tier-equipment)" },
  "lunar-equipment": { label: "Lunar Equipment", color: "var(--tier-lunar)" },
};

export const DLC_ORDER: Dlc[] = ["base", "sotv", "sots", "ac"];

export const DLC_META: Record<Dlc, { label: string; short: string }> = {
  base: { label: "Base game", short: "Base" },
  sotv: { label: "Survivors of the Void", short: "SotV" },
  sots: { label: "Seekers of the Storm", short: "SotS" },
  ac: { label: "Alloyed Collective", short: "AC" },
};

/** Every distinct category tag present in the dataset, sorted. */
export const ALL_TAGS: string[] = [...new Set(items.flatMap((it) => it.tags))].sort();

/** Tiers that actually have at least one item, in display order. */
export const PRESENT_TIERS: Tier[] = TIER_ORDER.filter((tier) =>
  items.some((it) => it.tier === tier),
);
