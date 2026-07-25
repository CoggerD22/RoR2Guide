import type { Dlc } from "./schema";

/**
 * Static reference data (PLAN §3 Phase 3). Facts only.
 *
 * Most of this file is now GENERATED from the game's own text rather than
 * transcribed from the wiki (PLAN §5.0) — run:
 *   python scripts/extract-reference.py   (+ extract-scenedefs.py for stage numbers)
 *   node   scripts/apply-reference.mjs
 * Artifact effects come from ARTIFACT_*_DESCRIPTION, the dreams table from
 * BAZAAR_SEER_* joined to SceneDef.stageOrder, and every skill unlock requirement
 * from its ACHIEVEMENT_*_DESCRIPTION. Text is verbatim, including the game's own
 * typos (e.g. "cavernouse depths") — the site quotes the game, it doesn't correct it.
 *
 * ⚠ IMPORTANT (PLAN §5.0.1): a _DESCRIPTION token proves what the game SAYS, not what
 * it DOES. Descriptions are frequently incomplete — Shrine of Blood's omits that its
 * cost compounds per purchase and that purchases are capped, both of which are only
 * visible in ShrineBloodBehavior + the shrine prefab's serialized fields. So:
 *   - SHRINES.description and ARTIFACTS.effect are **quoted text**, NOT verified
 *     mechanics, and the UI must present them as quotes.
 *   - The verified-mechanic layer (code formula + prefab constants) is still to be
 *     built; see PLAN §5.0.3 for the re-verification backlog.
 * BAZAAR_DREAMS is exempt — the Seer literally speaks those lines, so quoting IS the
 * fact, and the stage mapping is structural (token name + SceneDef.stageOrder).
 *
 * Still hand-entered / wiki-sourced: the Ambry codes (they live in asset prefabs,
 * not text). SHRINES.cost is OUR editorial summary, not game data.
 *
 * Artifacts carry their Bulwark's Ambry activation code as a 3-row glyph string
 * (● circle, ■ square, ▲ triangle, ♦ diamond).
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
  { name: "Artifact of Command", effect: "Choose your items.", code: "■■■ ■■■ ▲▲▲", dlc: "base" },
  { name: "Artifact of Death", effect: "When one player dies, everyone dies. Enable only if you want to truly put your teamwork and individual skill to the ultimate test.", code: "●●● ■▲■ ●▲●", dlc: "base" },
  { name: "Artifact of Delusion", effect: "Risk your items after completing the teleporter event in a test of memory to gain more items.", code: "■●■ ●●● ■▲■", dlc: "base" },
  { name: "Artifact of Devotion", effect: "Replace broken drones with Lemurian Eggs. Offer an item to gain followers.", code: "▲♦▲ ■♦■ ♦▲♦", dlc: "base" },
  { name: "Artifact of Dissonance", effect: "Monsters can appear outside their usual environments.", code: "●■■ ■■■ ■■●", dlc: "base" },
  { name: "Artifact of Enigma", effect: "Spawn with a random equipment that changes every time it's activated.", code: "♦■■ ▲■▲ ●♦♦", dlc: "base" },
  { name: "Artifact of Evolution", effect: "Monsters gain items between stages.", code: "♦♦♦ ■■■ ●●●", dlc: "base" },
  { name: "Artifact of Frailty", effect: "Fall damage is doubled and lethal.", code: "●●● ▲●▲ ▲▲▲", dlc: "base" },
  { name: "Artifact of Glass", effect: "Allies deal 500% damage, but have 10% health.", code: "♦♦♦ ♦♦♦ ♦♦♦", dlc: "base" },
  { name: "Artifact of Honor", effect: "Enemies can only spawn as elites.", code: "■■■ ■▲■ ■■■", dlc: "base" },
  { name: "Artifact of Kin", effect: "Monsters will be of only one type per stage.", code: "●▲▲ ♦●▲ ♦♦●", dlc: "base" },
  { name: "Artifact of Metamorphosis", effect: "Players always spawn as a random survivor.", code: "♦■● ♦■● ♦■●", dlc: "base" },
  { name: "Artifact of Prestige", effect: "At least one Shrine of the Mountain spawns every stage. Shrine of the Mountain effects are permanent.", code: "▲●● ■●▲ ●●■", dlc: "ac" },
  { name: "Artifact of Rebirth", effect: "Descend to Petrichor V with gifts from a previous life.", code: null, dlc: "sots" },
  { name: "Artifact of Sacrifice", effect: "Monsters drop items on death, but Chests no longer spawn.", code: "▲▲▲ ▲▲▲ ▲♦▲", dlc: "base" },
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
  { dream: "You dream of stabbing shards.", stage: "Disturbed Impact", stageNumber: "1" },
  { dream: "You dream of lost poetry.", stage: "Shattered Abodes", stageNumber: "1" },
  { dream: "You dream of fire and ice.", stage: "Siphoned Forest", stageNumber: "1" },
  { dream: "You dream of rolling hills.", stage: "Titanic Plains", stageNumber: "1" },
  { dream: "You dream of sweet fruits, and bitter promises.", stage: "Verdant Falls", stageNumber: "1" },
  { dream: "You dream of falls, erupting from the flora.", stage: "Viscous Falls", stageNumber: "1" },
  { dream: "You dream of sand beneath your feet.", stage: "Abandoned Aqueduct", stageNumber: "2" },
  { dream: "You dream of clarity.", stage: "Aphelian Sanctuary", stageNumber: "2" },
  { dream: "You dream of frost and metal.", stage: "Pretender's Precipice", stageNumber: "2" },
  { dream: "You dream of refuge.", stage: "Reformed Altar", stageNumber: "2" },
  { dream: "You dream of twisting roots.", stage: "Wetland Aspect", stageNumber: "2" },
  { dream: "You dream of golden leaves.", stage: "Golden Dieback", stageNumber: "3" },
  { dream: "You dream of attracting forces.", stage: "Iron Alluvium", stageNumber: "3" },
  { dream: "You dream of repelling forces.", stage: "Iron Auroras", stageNumber: "3" },
  { dream: "You dream of quiet snowfall.", stage: "Rallypoint Delta", stageNumber: "3" },
  { dream: "You dream of wind, blowing through trees.", stage: "Scorched Acres", stageNumber: "3" },
  { dream: "You dream of brimstone.", stage: "Sulfur Pools", stageNumber: "3" },
  { dream: "You dream of vines, cutting through the sky.", stage: "Treeborn Colony", stageNumber: "3" },
  { dream: "You dream of fire.", stage: "Abyssal Depths", stageNumber: "4" },
  { dream: "You dream of flowing power.", stage: "Conduit Canyon", stageNumber: "4" },
  { dream: "You dream of an oasis.", stage: "Repurposed Crater", stageNumber: "4" },
  { dream: "You dream of wind.", stage: "Siren's Call", stageNumber: "4" },
  { dream: "You dream of violent growth.", stage: "Sundered Grove", stageNumber: "4" },
  { dream: "You dream of worms.", stage: "Helminth Hatchery", stageNumber: "5" },
  { dream: "You dream of serenity.", stage: "Sky Meadow", stageNumber: "5" },
  { dream: "You dream of glass and dirt.", stage: "Commencement", stageNumber: "6" },
  { dream: "You dream of cavernouse depths.", stage: "Solutional Haunt", stageNumber: "—" },
  { dream: "You dream of wealth.", stage: "Hidden Realm: Gilded Coast", stageNumber: "—" },
  { dream: "You dream of rebirth.", stage: "Prime Meridian", stageNumber: "—" },
  { dream: "You dream of potential.", stage: "Hidden Realm: Void Locus", stageNumber: "—" },
];

export interface SkillUnlock {
  skill: string;
  slot: "Primary" | "Secondary" | "Utility" | "Special" | "Passive";
  challenge: string;
  /** Verbatim ACHIEVEMENT_*_DESCRIPTION. Empty only if the game defines none. */
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
      { skill: "Tactical Slide", slot: "Utility", challenge: "Godspeed", requirement: "As Commando, fully charge the first-stage teleporter before the timer hits 5 minutes." },
      { skill: "Frag Grenade", slot: "Special", challenge: "Incorruptible", requirement: "As Commando, clear 20 stages in a single run without picking up any Lunar items." },
      { skill: "Phase Blast", slot: "Secondary", challenge: "Rolling Thunder", requirement: "As Commando, land the killing blow on an Overloading Worm." },
    ],
  },
  {
    survivor: "Huntress",
    skills: [
      { skill: "Flurry", slot: "Primary", challenge: "Finishing Touch", requirement: "As Huntress, land a killing blow with every possible hit of a single glaive." },
      { skill: "Phase Blink", slot: "Utility", challenge: "One Shot, One Kill", requirement: "As Huntress, collect and carry 12 Crowbars at once." },
      { skill: "Ballista", slot: "Special", challenge: "Piercing Wind", requirement: "As Huntress, start and finish either Rallypoint Delta or Scorched Acres without falling below 100% health." },
    ],
  },
  {
    survivor: "MUL-T",
    skills: [
      { skill: "Power-Saw", slot: "Primary", challenge: "Gotcha!", requirement: "As MUL-T, land the killing blow on an Imp Overlord with the Preon Accumulator." },
      { skill: "Scrap Launcher", slot: "Primary", challenge: "Pest Control", requirement: "As MUL-T, defeat two Beetle Queens without leaving the teleporter zone." },
      { skill: "Power Mode", slot: "Special", challenge: "Seventh Day", requirement: "As MUL-T, clear the Void Fields on Stage 7 or later." },
    ],
  },
  {
    survivor: "Engineer",
    skills: [
      { skill: "Spider Mines", slot: "Secondary", challenge: "100% Calculated", requirement: "As Engineer, defeat the teleporter boss in less than 5 seconds after it spawns." },
      { skill: "TR58 Carbonizer Turret", slot: "Special", challenge: "Better With Friends", requirement: "As Engineer, recruit 12 minions at one time." },
      { skill: "Thermal Harpoons", slot: "Utility", challenge: "Zero Sum", requirement: "As Engineer, finish charging the teleporter with zero monsters remaining on the stage." },
    ],
  },
  {
    survivor: "Artificer",
    skills: [
      { skill: "Plasma Bolt", slot: "Primary", challenge: "Massacre", requirement: "As Artificer, perform a multikill of 20 enemies." },
      { skill: "Cast Nano-Spear", slot: "Secondary", challenge: "Chunked!", requirement: "As Artificer, fully defeat the teleporter boss in a one-second burst of damage." },
      { skill: "Ion Surge", slot: "Special", challenge: "Orbital Bombardment", requirement: "As Artificer, kill 15 enemies before touching the ground." },
    ],
  },
  {
    survivor: "Mercenary",
    skills: [
      { skill: "Rising Thunder", slot: "Secondary", challenge: "Demon of the Skies", requirement: "As Mercenary, don't touch the ground for 30 seconds." },
      { skill: "Slicing Winds", slot: "Special", challenge: "Ethereal", requirement: "As Mercenary, complete a Prismatic Trial without falling below 100% health." },
      { skill: "Focused Assault", slot: "Utility", challenge: "Flash of Blades", requirement: "As Mercenary, use 20 abilities in 10 seconds." },
    ],
  },
  {
    survivor: "Bandit",
    skills: [
      { skill: "Desperado", slot: "Special", challenge: "B&E", requirement: "As Bandit, kill the final boss with 'Lights Out'." },
      { skill: "Blast", slot: "Primary", challenge: "Classic Man", requirement: "As Bandit, successfully use 'Lights Out' to reset your cooldowns 15 times in a row." },
      { skill: "Serrated Shiv", slot: "Secondary", challenge: "Sadist", requirement: "As Bandit, kill a monster with 20 stacks of Hemorrhage." },
    ],
  },
  {
    survivor: "Loader",
    skills: [
      { skill: "Thunder Gauntlet", slot: "Utility", challenge: "Earthshatter", requirement: "As Loader, land a Charged Gauntlet hit at 300mph or higher." },
      { skill: "Spiked Fist", slot: "Secondary", challenge: "Swing By", requirement: "As Loader, reach and proceed through the Celestial Portal in 25 minutes or less." },
      { skill: "Thunderslam", slot: "Special", challenge: "The Thunderdome", requirement: "As Loader, kill three other Loaders in the Bulwark's Ambry." },
    ],
  },
  {
    survivor: "Acrid",
    skills: [
      { skill: "Ravenous Bite", slot: "Secondary", challenge: "Bad Medicine", requirement: "As Acrid, land the final blow on a Scavenger." },
      { skill: "Blight", slot: "Secondary", challenge: "Easy Prey", requirement: "As Acrid, land the killing blow on 50 total enemies that have 1 hit point left." },
      { skill: "Frenzied Leap", slot: "Utility", challenge: "Pandemic", requirement: "As Acrid, inflict Poison 1000 total times." },
    ],
  },
  {
    survivor: "Captain",
    skills: [
      { skill: "OGM-72 'DIABLO' Strike", slot: "Utility", challenge: "Smushed", requirement: "As Captain, kill the final boss using a Supply Beacon." },
      { skill: "Beacon: Resupply", slot: "Secondary", challenge: "Wanderlust", requirement: "As Captain, visit 10 different environments in a single run." },
      { skill: "Beacon: Hacking", slot: "Utility", challenge: "Worth Every Penny", requirement: "As Captain, repair and recruit a TC-280 Prototype." },
    ],
  },
  {
    survivor: "REX",
    skills: [
      { skill: "DIRECTIVE: Drill", slot: "Secondary", challenge: "Bushwhacked", requirement: "As REX, complete an entire teleporter event while under 50% health." },
      { skill: "DIRECTIVE: Harvest", slot: "Special", challenge: "Full of Life", requirement: "As REX, heal for 1000 health at once." },
      { skill: "Bramble Volley", slot: "Utility", challenge: "Dunked", requirement: "As REX, kill a Clay Dunestrider on Abandoned Aqueduct by throwing it into a pit." },
    ],
  },
  {
    survivor: "Railgunner",
    skills: [
      { skill: "HH44 Marksman", slot: "Secondary", challenge: "Marksman", requirement: "As Railgunner, fire 30 consecutive sniper shots without missing a Weak Point." },
      { skill: "Cryocharge", slot: "Special", challenge: "Trickshot", requirement: "As Railgunner, get 3 kills with a single Supercharge shot while airborne." },
    ],
  },
  {
    survivor: "Void Fiend",
    skills: [],
  },
  {
    survivor: "Seeker",
    skills: [
      { skill: "Soul Spiral", slot: "Secondary", challenge: "Airborne Souls", requirement: "As Seeker, hit three or more airborne enemies with a single use of the exploding third hit of Spirit Punch." },
      { skill: "Reprieve", slot: "Utility", challenge: "Scorched Earth", requirement: "Deal 500,000% damage with one use of Sojourn's explosion." },
      { skill: "Palm Blast", slot: "Special", challenge: "Clear Mind", requirement: "As Seeker, meditate 20 times consecutively without missing an input in a single run." },
    ],
  },
  {
    survivor: "Chef",
    skills: [
      { skill: "Ice Box", slot: "Secondary", challenge: "It's Getting Hot In Here!", requirement: "As CHEF apply 20 stacks of Burn at once to the final boss." },
      { skill: "Oil Spill", slot: "Utility", challenge: "You've Always Been Crazy", requirement: "As CHEF hit five airborne enemies with one instance of Roll." },
    ],
  },
  {
    survivor: "False Son",
    skills: [
      { skill: "Lunar Stakes", slot: "Secondary", challenge: "Protein Heavy Diet", requirement: "As False Son, gain 40 additional Lunar Spikes through Growth." },
      { skill: "Laser Burst", slot: "Special", challenge: "Stare Them Down", requirement: "As False Son, kill 15 enemies with one activation of Laser of the Father." },
    ],
  },
  {
    survivor: "Operator",
    skills: [
      { skill: "CMD-SWARM", slot: "Secondary", challenge: "That All You Got?", requirement: "As Operator, kill 4 different types of monsters with a single ricochet." },
      { skill: "FIREWALL", slot: "Utility", challenge: "Not So Different", requirement: "As Operator, defeat the Teleporter boss on Conduit Canyon without touching the ground." },
      { skill: "Amp Core", slot: "Special", challenge: "That Just Happened", requirement: "As Operator, keep an Elder Lemurian airborne for 10 seconds." },
    ],
  },
  {
    survivor: "Drifter",
    skills: [],
  },
];

export interface ShrineRef {
  name: string;
  /**
   * OUR editorial one-line cost summary — NOT game data, NOT code-verified.
   * Must be rendered visibly labelled as ours (PLAN §5.0.2, "Editorial").
   */
  cost: string;
  /**
   * The game's own SHRINE_*_DESCRIPTION, verbatim. This is a **Quoted text** claim:
   * it is what the game SAYS, not a verified account of what the game DOES
   * (PLAN §5.0.1). Descriptions are routinely incomplete — Shrine of Blood's omits
   * that its cost compounds per use and that uses are capped. The verified mechanic
   * layer (from `Shrine*Behavior` + prefab constants) is still to be added; until
   * then the UI must present this as a quote, never as "the mechanic".
   */
  description: string;
}

/**
 * Interactable shrines, names and effects taken verbatim from the game's own
 * description tokens (PLAN §5.0). Every entry is cross-checked against a live
 * behaviour class compiled into RoR2.dll, so cut content cannot sneak in.
 *
 * Deliberately EXCLUDED: "Shrine of Warding" (SHRINE_PROTECTION_NAME). It has name
 * and context tokens but no description and no behaviour class in RoR2.dll — the
 * same signature as the cut Artifact of Spirit. Not listed until it can be shown to
 * be live content.
 */
export const SHRINES: ShrineRef[] = [
  {
    name: "Shrine of Chance",
    cost: "Escalating gold",
    description: "When activated by a survivor the Shrine of Chance has a chance to drop an item of random rarity or a random equipment item.",
  },
  {
    name: "Shrine of Blood",
    cost: "A percentage of current health",
    description: "When activated by a survivor the Shrine of Blood consumes a percentage of the survivors health in exchange for gold equal to half the amount of HP taken.",
  },
  {
    name: "Shrine of Combat",
    cost: "Free",
    description: "When activated by a survivor a group of enemies already found in the stage will spawn around the Shrine of Combat.",
  },
  {
    name: "Shrine of the Mountain",
    cost: "Free",
    description: "When activated by a survivor the Teleporter Event will increase in difficulty and extra items will be given once the survivors kill all the Teleporter bosses.",
  },
  {
    name: "Shrine of Order",
    cost: "1 Lunar Coin",
    description: "When activated by a survivor the Shrine of Order randomly selects an item from each tier of rarity and turns all items of the same rarity into the selected item of that tier.",
  },
  {
    name: "Shrine of the Woods",
    cost: "Gold, repeatable",
    description: "When activated by a survivor the Shrine of the Woods will create a circular field around it that heals all allies when inside it.",
  },
  {
    name: "Shrine of Shaping",
    cost: "An offering of Soul",
    description: "An offering of Soul reduces all living Survivors' health by 30%, but revives all dead Survivors and gives an extra life to all living Survivors.",
  },
  {
    name: "Halcyon Shrine",
    cost: "Gold, siphoned from nearby survivors",
    description: "A Shrine created from a shard from Meridian imbued with Aurelionite's energy. When the Shrine is activated it begins siphoning gold from nearby Survivors up until a maximum gold amount has been stored. After the first tier has been reached, the player can interact with the Shrine early and ending the gold siphon or wait till the final tier is reached. Interacting with the Shrine summons a slumbering Halcyonite and on its defeat an Aurelionite Fragment will drop. Depending on the amount of gold drained the Fragment gains more options and allow more items to be selected from the Fragment.",
  },
  {
    name: "Shrine of Rebirth",
    cost: "One item, stored for the next run",
    description: "Praying at the Shrine of Rebirth allows the player to store an item in the Artifact of Rebirth. Storing an item in the Artifact of Rebirth replaces any item stored within. Activating the Artifact of Rebirth will gift the item to the Survivor upon descending to Petrichor V.",
  },
  {
    name: "Cleansing Pool",
    cost: "1 Lunar item or Lunar Equipment",
    description: "Allows survivors to sacrifice a random Lunar item or Lunar Equipment in exchange for a Pearl item.",
  },
  {
    name: "Altar of Gold",
    cost: "Large gold sum",
    description: "A rare and expensive shrine that will spawn a Gold Portal once the Teleporter Event has finished, allowing the player to travel to the Gilded Coast.",
  },
  {
    name: "Newt Altar",
    cost: "1 Lunar Coin",
    description: "Costs one Lunar Coin to activate and will spawn a blue portal after the Teleporter Event allowing the player to travel to the Bazaar Between Time.",
  },
];
