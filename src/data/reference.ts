import type { Dlc } from "./schema";

/**
 * Static reference data (PLAN §3 Phase 3). Facts only — sourced from
 * riskofrain2.wiki.gg. Artifacts carry their Bulwark's Ambry activation code
 * as a 3-row glyph string (● circle, ■ square, ▲ triangle, ♦ diamond).
 */

export interface ArtifactRef {
  /** Stable slug, e.g. "artifact-of-command". */
  id: string;
  name: string;
  /** Icon path under /public, e.g. "/icons/artifacts/artifact-of-command.png". */
  icon: string;
  effect: string;
  /** Ambry code as three space-separated rows, or null if not code-unlocked. */
  code: string | null;
  dlc: Dlc;
}

/** Slug an artifact name into a filename-safe id ("Artifact of Command" → "artifact-of-command"). */
export function artifactSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/** Raw artifact facts; id + icon are derived from the name (PLAN §2.7 / §4.8). */
const rawArtifacts: Omit<ArtifactRef, "id" | "icon">[] = [
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

export const ARTIFACTS: ArtifactRef[] = rawArtifacts.map((a) => {
  const id = artifactSlug(a.name);
  return { ...a, id, icon: `/icons/artifacts/${id}.png` };
});

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

export interface SkillUnlock {
  skill: string;
  slot: "Primary" | "Secondary" | "Utility" | "Special" | "Passive";
  challenge: string;
  /** One-line requirement; empty when the wiki text was unreliable. */
  requirement: string;
}

export interface SurvivorLoadout {
  survivor: string;
  skills: SkillUnlock[];
}

/**
 * Challenge-unlocked ALTERNATE SKILLS for the base-game survivors (the
 * hard-to-find, mechanically-relevant unlocks). Skins are omitted — each
 * survivor's three skins follow the same pattern (Prime Meridian clear,
 * Monsoon mastery, and the Alloyed Collective accept/reject choice).
 */
export const LOADOUT_UNLOCKS: SurvivorLoadout[] = [
  {
    survivor: "Commando",
    skills: [
      { skill: "Tactical Slide", slot: "Utility", challenge: "Godspeed", requirement: "Charge the Stage 1 Teleporter in under 5 minutes." },
      { skill: "Frag Grenade", slot: "Special", challenge: "Incorruptible", requirement: "Clear 20 stages without picking up a Lunar item." },
      { skill: "Phase Blast", slot: "Secondary", challenge: "Rolling Thunder", requirement: "Kill an Overloading Worm." },
    ],
  },
  {
    survivor: "Huntress",
    skills: [
      { skill: "Flurry", slot: "Primary", challenge: "Finishing Touch", requirement: "Land the killing blow with every hit of a single glaive." },
      { skill: "Phase Blink", slot: "Utility", challenge: "One Shot, One Kill", requirement: "Carry 12 Crowbars at once." },
      { skill: "Ballista", slot: "Special", challenge: "Piercing Wind", requirement: "Complete Rallypoint Delta or Scorched Acres without dropping below 100% health." },
    ],
  },
  {
    survivor: "MUL-T",
    skills: [
      { skill: "Power-Saw", slot: "Primary", challenge: "Gotcha!", requirement: "Kill the Imp Overlord with the Preon Accumulator." },
      { skill: "Scrap Launcher", slot: "Primary", challenge: "Pest Control", requirement: "Defeat 2 Beetle Queens without leaving the Teleporter zone." },
      { skill: "Power Mode", slot: "Special", challenge: "Seventh Day", requirement: "Clear the Void Fields on Stage 7 or later." },
    ],
  },
  {
    survivor: "Engineer",
    skills: [
      { skill: "Spider Mines", slot: "Secondary", challenge: "100% Calculated", requirement: "Defeat a Teleporter boss in under 5 seconds." },
      { skill: "TR58 Carbonizer Turret", slot: "Special", challenge: "Better With Friends", requirement: "Have 12 minions active at once." },
      { skill: "Thermal Harpoons", slot: "Utility", challenge: "Zero Sum", requirement: "Finish charging a Teleporter with 0 monsters alive." },
    ],
  },
  {
    survivor: "Artificer",
    skills: [
      { skill: "Plasma Bolt", slot: "Primary", challenge: "Massacre", requirement: "" },
      { skill: "Cast Nano-Spear", slot: "Secondary", challenge: "Chunked!", requirement: "" },
      { skill: "Ion Surge", slot: "Special", challenge: "Orbital Bombardment", requirement: "" },
    ],
  },
  {
    survivor: "Mercenary",
    skills: [
      { skill: "Rising Thunder", slot: "Secondary", challenge: "Demon of the Skies", requirement: "Stay airborne for 30 seconds." },
      { skill: "Slicing Winds", slot: "Special", challenge: "Ethereal", requirement: "Complete a Prismatic Trial without dropping below 100% health." },
      { skill: "Focused Assault", slot: "Utility", challenge: "Flash of Blades", requirement: "Use 20 abilities within 10 seconds." },
    ],
  },
  {
    survivor: "Bandit",
    skills: [
      { skill: "Desperado", slot: "Special", challenge: "B&E", requirement: "Kill the final boss with 'Lights Out'." },
      { skill: "Blast", slot: "Primary", challenge: "Classic Man", requirement: "Reset cooldowns with 'Lights Out' 15 times in a row." },
      { skill: "Serrated Shiv", slot: "Secondary", challenge: "Sadist", requirement: "Kill a monster afflicted with 20 Hemorrhage stacks." },
    ],
  },
  {
    survivor: "Loader",
    skills: [
      { skill: "Thunder Gauntlet", slot: "Utility", challenge: "Earthshatter", requirement: "Land a Charged Gauntlet hit while moving 300 mph or faster." },
      { skill: "Spiked Fist", slot: "Secondary", challenge: "Swing By", requirement: "Reach the Celestial Portal in 25 minutes or less." },
      { skill: "Thunderslam", slot: "Special", challenge: "The Thunderdome", requirement: "Kill 3 Loaders in Bulwark's Ambry." },
    ],
  },
  {
    survivor: "Acrid",
    skills: [
      { skill: "Ravenous Bite", slot: "Secondary", challenge: "Bad Medicine", requirement: "Land the final blow on a Scavenger." },
      { skill: "Blight", slot: "Secondary", challenge: "Easy Prey", requirement: "Kill 50 enemies that have 1 HP remaining." },
      { skill: "Frenzied Leap", slot: "Utility", challenge: "Pandemic", requirement: "Inflict Poison 1000 times total." },
    ],
  },
  {
    survivor: "Captain",
    skills: [
      { skill: "OGM-72 'DIABLO' Strike", slot: "Utility", challenge: "Smushed", requirement: "Kill the final boss with the Supply Beacon." },
      { skill: "Beacon: Resupply", slot: "Secondary", challenge: "Wanderlust", requirement: "Visit 10 environments in a single run." },
      { skill: "Beacon: Hacking", slot: "Utility", challenge: "Worth Every Penny", requirement: "Repair the TC-280 Prototype." },
    ],
  },
  {
    survivor: "REX",
    skills: [
      { skill: "DIRECTIVE: Drill", slot: "Secondary", challenge: "Bushwhacked", requirement: "Complete a Teleporter event while under 50% health." },
      { skill: "DIRECTIVE: Harvest", slot: "Special", challenge: "Full of Life", requirement: "Heal 1000 health at once." },
      { skill: "Bramble Volley", slot: "Utility", challenge: "Dunked", requirement: "Kill a Clay Dunestrider by knocking it into the pit on Abandoned Aqueduct." },
    ],
  },
  {
    survivor: "Railgunner",
    skills: [
      { skill: "HH44 Marksman", slot: "Secondary", challenge: "Marksman", requirement: "" },
      { skill: "Cryocharge", slot: "Special", challenge: "Trickshot", requirement: "" },
    ],
  },
  {
    survivor: "Void Fiend",
    skills: [],
  },
  {
    survivor: "Seeker",
    skills: [
      { skill: "Soul Spiral", slot: "Secondary", challenge: "Airborne Souls", requirement: "" },
      { skill: "Reprieve", slot: "Utility", challenge: "Scorched Earth", requirement: "" },
      { skill: "Palm Blast", slot: "Special", challenge: "Clear Mind", requirement: "" },
    ],
  },
  {
    survivor: "Chef",
    skills: [
      { skill: "Ice Box", slot: "Secondary", challenge: "It's Getting Hot In Here!", requirement: "Apply 20 stacks of burn to Mithrix." },
      { skill: "Oil Spill", slot: "Utility", challenge: "You've Always Been Crazy", requirement: "" },
    ],
  },
  {
    survivor: "False Son",
    skills: [
      { skill: "Lunar Stakes", slot: "Secondary", challenge: "Protein Heavy Diet", requirement: "" },
      { skill: "Laser Burst", slot: "Special", challenge: "Stare Them Down", requirement: "" },
    ],
  },
  {
    survivor: "Operator",
    skills: [
      { skill: "CMD-SWARM", slot: "Secondary", challenge: "That All You Got?", requirement: "" },
      { skill: "FIREWALL", slot: "Utility", challenge: "Not So Different", requirement: "" },
      { skill: "Amp Core", slot: "Special", challenge: "That Just Happened", requirement: "" },
    ],
  },
  {
    survivor: "Drifter",
    skills: [],
  },
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
