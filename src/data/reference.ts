import type { Dlc } from "./schema";

/**
 * Static reference data (PLAN §3 Phase 3). Facts only — sourced from
 * riskofrain2.wiki.gg. Artifacts carry their Bulwark's Ambry activation code
 * as a 3-row glyph string (● circle, ■ square, ▲ triangle, ♦ diamond).
 */

export interface ArtifactRef {
  name: string;
  effect: string;
  /** Ambry code as three space-separated rows, or null if not code-unlocked. */
  code: string | null;
  dlc: Dlc;
}

export const ARTIFACTS: ArtifactRef[] = [
  { name: "Artifact of Chaos", effect: "Friendly fire is enabled for both survivors and monsters alike.", code: "●▲● ●▲● ●▲●", dlc: "base" },
  { name: "Artifact of Command", effect: "Choose your items — item drops become a pickable selection of that tier.", code: "■■■ ■■■ ▲▲▲", dlc: "base" },
  { name: "Artifact of Death", effect: "When one player dies, everyone dies.", code: "●●● ■▲■ ●▲●", dlc: "base" },
  { name: "Artifact of Delusion", effect: "After the Teleporter event, risk your items in a test of memory to keep or double them.", code: "■●■ ●●● ■▲■", dlc: "base" },
  { name: "Artifact of Devotion", effect: "Replace broken drones with Lemurian Eggs that grow into permanent allies.", code: "▲♦▲ ■♦■ ♦▲♦", dlc: "base" },
  { name: "Artifact of Dissonance", effect: "Monsters can appear outside their usual environments.", code: "●■■ ■■■ ■■●", dlc: "base" },
  { name: "Artifact of Enigma", effect: "Spawn with a random equipment that changes every time it's activated.", code: "♦■■ ▲■▲ ●♦♦", dlc: "base" },
  { name: "Artifact of Evolution", effect: "Monsters gain items between stages.", code: "♦♦♦ ■■■ ●●●", dlc: "base" },
  { name: "Artifact of Frailty", effect: "Fall damage is doubled and lethal.", code: "●●● ▲●▲ ▲▲▲", dlc: "base" },
  { name: "Artifact of Glass", effect: "Allies deal 500% damage, but have 10% health.", code: "♦♦♦ ♦♦♦ ♦♦♦", dlc: "base" },
  { name: "Artifact of Honor", effect: "Enemies can only spawn as elites.", code: "■■■ ■▲■ ■■■", dlc: "base" },
  { name: "Artifact of Kin", effect: "Monsters will be of only one type per stage.", code: "●▲▲ ♦●▲ ♦♦●", dlc: "base" },
  { name: "Artifact of Metamorphosis", effect: "Players always spawn as a random survivor.", code: "♦■● ♦■● ♦■●", dlc: "base" },
  { name: "Artifact of Prestige", effect: "At least one Shrine of the Mountain spawns every stage.", code: "▲●● ■●▲ ●●■", dlc: "ac" },
  { name: "Artifact of Rebirth", effect: "Descend to Petrichor V with a gift from a previous life.", code: null, dlc: "sots" },
  { name: "Artifact of Sacrifice", effect: "Monsters drop items on death, but chests no longer spawn.", code: "▲▲▲ ▲▲▲ ▲♦▲", dlc: "base" },
  { name: "Artifact of Soul", effect: "Wisps emerge from defeated monsters.", code: "●■● ●♦● ■♦■", dlc: "base" },
  { name: "Artifact of Spite", effect: "Enemies drop multiple exploding bombs on death.", code: "▲●▲ ●●● ▲●▲", dlc: "base" },
  { name: "Artifact of Swarms", effect: "Monster spawns are doubled, but monster maximum health is halved.", code: "●●▲ ▲♦▲ ▲●●", dlc: "base" },
  { name: "Artifact of Vengeance", effect: "Your relentless doppelganger will invade every 10 minutes.", code: "♦■■ ♦●■ ♦■■", dlc: "base" },
];

export interface DreamRef {
  dream: string;
  stage: string;
  stageNumber: string;
}

export const BAZAAR_DREAMS: DreamRef[] = [
  { dream: "You dream of waves, crashing on cliffsides.", stage: "Distant Roost", stageNumber: "1" },
  { dream: "You dream of rolling hills.", stage: "Titanic Plains", stageNumber: "1" },
  { dream: "You dream of sweet fruits, and bitter promises.", stage: "Verdant Falls", stageNumber: "1" },
  { dream: "You dream of sand beneath your feet.", stage: "Abandoned Aqueduct", stageNumber: "2" },
  { dream: "You dream of twisting roots.", stage: "Wetland Aspect", stageNumber: "2" },
  { dream: "You dream of quiet snowfall.", stage: "Rallypoint Delta", stageNumber: "3" },
  { dream: "You dream of wind, blowing through trees.", stage: "Scorched Acres", stageNumber: "3" },
  { dream: "You dream of fire.", stage: "Abyssal Depths", stageNumber: "4" },
  { dream: "You dream of wind.", stage: "Siren's Call", stageNumber: "4" },
  { dream: "You dream of violent growth.", stage: "Sundered Grove", stageNumber: "4" },
  { dream: "You dream of serenity.", stage: "Sky Meadow", stageNumber: "5" },
  { dream: "You dream of wealth.", stage: "Gilded Coast (Hidden Realm)", stageNumber: "—" },
  { dream: "You dream of potential.", stage: "Void Locus (Hidden Realm)", stageNumber: "—" },
];

export interface ShrineRef {
  name: string;
  cost: string;
  effect: string;
}

export const SHRINES: ShrineRef[] = [
  {
    name: "Shrine of Chance",
    cost: "Escalating gold",
    effect: "Gamble for a random item or equipment — or nothing on a failed roll. Can be used repeatedly; cost rises each use. Luck (57 Leaf Clover) rerolls the outcome.",
  },
  {
    name: "Shrine of Blood",
    cost: "~½ current health",
    effect: "Pay a chunk of your current health for gold (amount scales with time). Repeatable while you have health to spend.",
  },
  {
    name: "Shrine of Combat",
    cost: "Free",
    effect: "Spawns a wave of monsters. Clearing it drops gold. Multiple can be triggered at once for a bigger fight.",
  },
  {
    name: "Shrine of the Mountain",
    cost: "Free",
    effect: "Each activation adds one extra Teleporter boss and increases the Teleporter event's item rewards. Stacks — the risk and loot both scale.",
  },
  {
    name: "Shrine of Order",
    cost: "1 Lunar Coin",
    effect: "Collapses each item tier in your inventory into the single item you hold the most of in that tier. High-variance, build-defining.",
  },
  {
    name: "Shrine of the Woods (Healing)",
    cost: "Gold",
    effect: "Activate to project a healing aura that regenerates nearby players. Cost scales; useful before a hard fight.",
  },
  {
    name: "Cleansing Pool",
    cost: "1 Lunar item",
    effect: "Trade a Lunar item to convert it into a random regular item of the same tier (removes the drawback).",
  },
  {
    name: "Altar of Gold",
    cost: "Large gold sum",
    effect: "Opens a portal to the Gilded Coast to fight Aurelionite for the Halcyon Seed. Appears occasionally; only worth it if you can afford it.",
  },
  {
    name: "Newt Altar",
    cost: "1 Lunar Coin",
    effect: "Opens a Blue Portal at the Teleporter that leads to the Bazaar Between Time (lunar shop + stage-selecting Seers).",
  },
];
