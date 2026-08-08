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
  /**
   * The game's own ARTIFACT_*_DESCRIPTION, quoted verbatim. Authoritative for WORDING and
   * invalid as a source for behaviour (PLAN §5.0.1) — which is why `mechanic` exists.
   */
  effect: string;
  /**
   * What the artifact actually does, read from its code. Separate from `effect` for the
   * same reason the shrines are: the description is a quote, this is the verified fact,
   * and several of these descriptions omit numbers that decide whether you enable it.
   * Present on every artifact: each one was read from its implementation, and in each case
   * the code turned out to contradict or materially extend the description (PLAN §9.1).
   */
  mechanic?: string;
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
  { name: "Artifact of Chaos", effect: "Friendly fire is enabled for both survivors and monsters alike.", mechanic: "FriendlyFireArtifactManager sets FriendlyFireManager.friendlyFireMode to FriendlyFire, which turns three boolean gates (ShouldDamageProceed, ShouldDirectHitProceed, ShouldSeekingProceed) from blocking same-team damage to allowing it. Those gates apply NO multiplier: the class's one damage-scale field, friendlyFireDamageScale = 0.5f, has zero callers anywhere in RoR2.dll (checked at IL level), so friendly fire lands at full damage.", code: "●▲● ●▲● ●▲●", dlc: "base" },
  { name: "Artifact of Command", effect: "Choose your items.", mechanic: "CommandArtifactManager replaces item drops with a choice cube, and — undocumented — strips the stage's interactable pool of everything that already offered a choice: on OnGenerateInteractableCardSelection it removes every card whose prefab has a ShopTerminalBehavior, MultiShopController or ScrapperController. Multishops and scrappers therefore stop spawning entirely while Command is on.", code: "■■■ ■■■ ▲▲▲", dlc: "base" },
  { name: "Artifact of Death", effect: "When one player dies, everyone dies. Enable only if you want to truly put your teamwork and individual skill to the ultimate test.", mechanic: "TeamDeathArtifactManager kills the team on a player death — but only if that player had no revive available: the check skips the team kill when the victim holds Dio's Best Friend or a Pluripotent Larva, has the ExtraLifeBuff, is holding a Seed of Life (EquipmentDef HealAndRevive), or is a Seeker with self-revive remaining. In those cases they simply revive and the run continues.", code: "●●● ■▲■ ●▲●", dlc: "base" },
  { name: "Artifact of Delusion", effect: "Risk your items after completing the teleporter event in a test of memory to gain more items.", mechanic: "DelusionChestController offers three pickups per chest (DELUSION_PICKUP_INDEXES_NUMBER = 3): the chest's real item plus two decoys drawn from the items YOU ALREADY HOLD, falling back to random valid items only if you hold fewer than two eligible ones. Guess right and the item drops; guess wrong and ChestBehavior calls RemoveDelusionChoice, which does RemoveItemPermanent on the item you picked — so a wrong answer deletes one of your own items rather than merely forfeiting the reward. Decoys are drawn only from items that are scrappable, removable, non-hidden, and not Scrap or WorldUnique.", code: "■●■ ●●● ■▲■", dlc: "base" },
  { name: "Artifact of Devotion", effect: "Replace broken drones with Lemurian Eggs. Offer an item to gain followers.", mechanic: "DevotionInventoryController: offering an item raises a follower's Devotion level. Level 1 grants a low-tier elite buff, level 2 transforms it into a Lemurian Bruiser (clearing its elite equipment), level 3 grants a high-tier elite buff. Stats come as hidden BoostHp/BoostDamage items — 10 of each at levels 0 and 2, 20 at levels 1 and 3, then 20 + (level - 3) beyond — and each one is +10% health and +10% damage, so a level-1 follower is already at +200% of both. Followers also inherit the items in the shared devotion inventory.", code: "▲♦▲ ■♦■ ♦▲♦", dlc: "base" },
  { name: "Artifact of Dissonance", effect: "Monsters can appear outside their usual environments.", mechanic: "ClassicStageInfo.HandleMixEnemyArtifact does not widen the stage's normal pool — it REPLACES it with RoR2Content.mixEnemyMonsterCards and then trims each category down to three random cards: 3 Basic Monsters, 3 Minibosses, 3 Champions. So a Dissonance stage draws from nine monster types total, chosen fresh per stage, and the stage's usual residents are not guaranteed to be among them.", code: "●■■ ■■■ ■■●", dlc: "base" },
  { name: "Artifact of Enigma", effect: "Spawn with a random equipment that changes every time it's activated.", mechanic: "EnigmaArtifactManager fills every empty equipment slot at spawn from EquipmentCatalog.enigmaEquipmentList — every equipment flagged enigmaCompatible whose expansion is enabled — and re-rolls on each activation via OnServerEquipmentActivated. MUL-T is special-cased to two slots (toolbotBodyIndex ? 2 : 1); everyone else gets one.", code: "♦■■ ▲■▲ ●♦♦", dlc: "base" },
  { name: "Artifact of Evolution", effect: "Monsters gain items between stages.", mechanic: "MonsterTeamGainsItemsArtifactManager keeps the target count at stageClearCount + 1, drawn from a fixed repeating 5-step pattern of drop tables — Tier1, Tier1, Tier2, Tier2, Tier3 — so item quality cycles rather than being random each stage. The +1 is not a rounding detail: monsters already hold one item on the first stage, before anything has been cleared. Items accumulate in a single shared monster-team Inventory, and each monster copies the whole of it at spawn (AddItemsFrom on TeamIndex.Monster only), so every monster on a stage carries the same list and nothing is lost when one dies. The count is topped up at run start, at every stage begin AND on scene pre-populate, by a loop that grants as many items as needed to catch up rather than exactly one. Its RNG is seeded once from the run seed, so the sequence of items is fixed for a given run.", code: "♦♦♦ ■■■ ●●●", dlc: "base" },
  { name: "Artifact of Frailty", effect: "Fall damage is doubled and lethal.", mechanic: "GlobalEventManager: fall damage (normally maxHealth * impact/60) is doubled and the NonLethal flag is cleared, so it can kill. Undocumented: it also sets BypassOneShotProtection, and the identical effect applies to players at Eclipse 3 and above even with the artifact disabled.", code: "●●● ▲●▲ ▲▲▲", dlc: "base" },
  { name: "Artifact of Glass", effect: "Allies deal 500% damage, but have 10% health.", mechanic: "CharacterBody.RecalculateStats: damage *= 5f, and the health loss is applied as cursePenalty *= 10f rather than a direct cut — so it divides maximum health by ten and composes multiplicatively with other curse sources such as Shaped Glass.", code: "♦♦♦ ♦♦♦ ♦♦♦", dlc: "base" },
  { name: "Artifact of Honor", effect: "Enemies can only spawn as elites.", mechanic: "Two separate effects. ClassicStageInfo removes every monster card that forbids elites from the stage pool, and EliteOnlyArtifactManager promotes each spawn — but only ever into one of FOUR elite types: eliteDefs = { Elites.Fire, Elites.Lightning, Elites.Ice, Elites.Earth } — the four entries in that static array, which is the whole of the search. Malachite, Celestine, Void and Perfected have no entry in it, so Honor never produces them. PromoteIfHonorAndApplyStats grants the elite's stat boost as BoostHp/BoostDamage items rounded from the elite def's own coefficients: (coefficient - 1) x 10 items.", code: "■■■ ■▲■ ■■■", dlc: "base" },
  { name: "Artifact of Kin", effect: "Monsters will be of only one type per stage.", mechanic: "ClassicStageInfo.HandleSingleMonsterTypeArtifact collapses the pool to one card, chosen from those the stage can afford: a budget of 40 x difficultyCoefficient credits, skipping cards that need more than 5 spawns and fewer than 1. Void Fields (the 'arena' scene) uses 50 x difficultyCoefficient, a limit of 6 and a minimum of 2. If no card passes the affordability filter, the filter is dropped rather than the artifact.", code: "●▲▲ ♦●▲ ♦♦●", dlc: "base" },
  { name: "Artifact of Metamorphosis", effect: "Players always spawn as a random survivor.", mechanic: "CharacterMaster.Respawn re-rolls the body on EVERY respawn, not once per run, using the run-seeded randomSurvivorOnRespawnRng. The pool is uniform over survivors that are not hidden, whose expansion is enabled, and that THIS PLAYER has unlocked (SurvivorIsUnlockedAndAvailable checks networkUser.unlockables) — so it can never hand you a survivor you have not earned, and never Heretic.", code: "♦■● ♦■● ♦■●", dlc: "base" },
  { name: "Artifact of Prestige", effect: "At least one Shrine of the Mountain spawns every stage. Shrine of the Mountain effects are permanent.", mechanic: "Two mechanisms. SceneDirector force-spawns a Shrine of the Mountain when a stage generated none, and permanence is literal state: TeleporterInteraction stores the teleporter's shrineBonusStacks into Run.prestiegeArtifactMountainValue, and each new stage's teleporter calls SetShrineStack with that value — so mountain stacks carry across stages instead of resetting.", code: "▲●● ■●▲ ●●■", dlc: "ac" },
  { name: "Artifact of Rebirth", effect: "Descend to Petrichor V with gifts from a previous life.", mechanic: "Run.ServerGiveRebirthItems runs once at run start and gives each player exactly ONE item: the item they banked at a Shrine of Rebirth in a previous run, or, if they banked none, a single roll from rebirthDropTable. The banked item is consumed (NetworkrebirthItem is cleared), so it is one gift per run, not a growing stash.", code: null, dlc: "sots" },
  { name: "Artifact of Sacrifice", effect: "Monsters drop items on death, but Chests no longer spawn.", mechanic: "SacrificeArtifactManager: monsters roll an item drop on death and chest-type interactables are skipped (InteractableSpawnCard.skipSpawnWhenSacrificeArtifactEnabled). The drop chance is NOT flat — it is Util.GetExpAdjustedDropChancePercent(5f, victim), which returns 5 x log2(spawnValue + 1) percent, where spawnValue is the monster's DeathRewards worth. So 5% is only the value for a monster worth 1; anything the director pays more for drops considerably more often, and the log means the gain flattens as monsters get bigger. Per-monster spawnValue lives on body prefabs that are not in the extracted asset set, so the exact chance per monster type is not established here. Three further effects the artifact's text does not mention: the stage's interactable budget is halved (sceneDirector.onPopulateCreditMultiplier *= 0.5f); surviving non-chest interactables are re-weighted by each card's weightScalarWhenSacrificeArtifactEnabled, so the mix changes and not just the amount; and a monster killed by its own team drops nothing if it belongs to someone (the roll requires attackerTeam != victimTeam or no owner master), which stops minion infighting from farming drops. The drop RNG is reseeded from the run's treasureRng at every stage start.", code: "▲▲▲ ▲▲▲ ▲♦▲", dlc: "base" },
  { name: "Artifact of Soul", effect: "Wisps emerge from defeated monsters.", mechanic: "GlobalEventManager summons a Wisp Soul on every monster death except another wisp's, ignoring the team member limit. The WispSoulBody prefab carries 35 health (+10/level) and 3.5 damage (+0.7/level) — and a NEGATIVE regen of -3/s (-0.6/level), so the wisps bleed out and expire on their own rather than accumulating.", code: "●■● ●♦● ■♦■", dlc: "base" },
  { name: "Artifact of Spite", effect: "Enemies drop multiple exploding bombs on death.", mechanic: "BombArtifactManager: each monster death drops bombs dealing 150% of the VICTIM's damage (bombDamageCoefficient 1.5) in a 7m blast, fusing after 8s. The count is min(30, ceil(bestFitRadius x extraBombPerRadius x spite_bomb_coefficient)) with extraBombPerRadius = 4 and the cheat-flagged ConVar defaulting to 0.5 — so in normal play roughly TWO bombs per unit of the victim's radius, and big targets reach the cap of 30. Bombs scatter inside a sphere of (3 + bestFitRadius x 4) metres, which is a separate constant from the count and a much larger number. Three properties of the blast that the text does not give: falloffModel is None, so each bomb deals its full damage anywhere inside its 7m; procCoefficient is 0.75, so bombs do trigger on-hit items but at three-quarters rate; and crit is hard-set to false, so they can never critically strike. Bombs are dropped by a raycast that steps up 8m and falls up to 60m; anything that would fall further is discarded.", code: "▲●▲ ●●● ▲●▲", dlc: "base" },
  { name: "Artifact of Swarms", effect: "Monster spawns are doubled, but monster maximum health is halved.", mechanic: "SwarmsArtifactManager hooks SpawnCard.onSpawnedServerGlobal with swarmSpawnCount = 2: it re-fires the same spawn request once more (guarded by an inSpawn flag so the copy cannot recurse). Each spawned master is given the CutHp item permanently, and RecalculateStats divides the max-health accumulator by (CutHp count + 1) — exactly half at one copy. NOT mentioned in the artifact's text: the same handler divides that monster's DeathRewards spawnValue, expReward and goldReward by 2, so each kill is worth half the XP and gold and the doubled count roughly cancels out. Player-team spawns and any spawn whose placement rule sets IgnoreSwarmsArtifact are skipped entirely. Deployable limits for summons also double (CharacterMaster.GetDeployableSameSlotLimit). That halved spawnValue reaches further than XP: Artifact of Sacrifice computes its drop chance as 5 x log2(spawnValue + 1), so running both artifacts lowers each individual kill's chance of dropping an item while doubling the number of kills. Neither artifact's description hints that they share an input.", code: "●●▲ ▲♦▲ ▲●●", dlc: "base" },
  { name: "Artifact of Vengeance", effect: "Your relentless doppelganger will invade every 10 minutes.", mechanic: "DoppelgangerInvasionManager: invasionInterval = 600f, so the invasion count is floor(runStopwatch / 600) — one wave per 10 minutes of run time. DoppelgangerSpawnCard copies the player's master WITH items and equipment and then adds the hidden InvadingDoppelganger item, which RecalculateStats reads twice and which the description never hints at: num78 *= 10f (TEN TIMES your maximum health) and num101 *= 0.04f (FOUR PERCENT of your damage). Its AI is pointed at the player it was copied from. On death it drops an item — but only if it had no revive available, skipping the drop when it carries Dio's Best Friend, a Pluripotent Larva, the ExtraLifeBuff or a Seed of Life, exactly as Artifact of Death does.", code: "♦■■ ♦●■ ♦■■", dlc: "base" },
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
  /**
   * The loadout slot, from SkillFamily.variants. Omitted for skills that are
   * unlockable but are NOT variants of the four slots — Captain's Supply Drop
   * beacons. Omitting is deliberate: inventing a slot would be false information.
   */
  slot?: "Primary" | "Secondary" | "Utility" | "Special" | "Passive";
  challenge: string;
  /** Verbatim ACHIEVEMENT_*_DESCRIPTION. Empty only if the game defines none. */
  requirement: string;
  /**
   * True when the variant carries no unlockableDef — an alternate that is selectable
   * from the start (e.g. MUL-T's Rebar Puncher). Distinct from "we don't know".
   */
  noUnlockRequired?: boolean;
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
      { skill: "Phase Blast", slot: "Secondary", challenge: "Commando: Rolling Thunder", requirement: "As Commando, land the killing blow on an Overloading Worm." },
      { skill: "Tactical Slide", slot: "Utility", challenge: "Commando: Godspeed", requirement: "As Commando, fully charge the first-stage teleporter before the timer hits 5 minutes." },
      { skill: "Frag Grenade", slot: "Special", challenge: "Commando: Incorruptible", requirement: "As Commando, clear 20 stages in a single run without picking up any Lunar items." },
    ],
  },
  {
    survivor: "Huntress",
    skills: [
      { skill: "Flurry", slot: "Primary", challenge: "Huntress: Finishing Touch", requirement: "As Huntress, land a killing blow with every possible hit of a single glaive." },
      { skill: "Phase Blink", slot: "Utility", challenge: "Huntress: One Shot, One Kill", requirement: "As Huntress, collect and carry 12 Crowbars at once." },
      { skill: "Ballista", slot: "Special", challenge: "Huntress: Piercing Wind", requirement: "As Huntress, start and finish either Rallypoint Delta or Scorched Acres without falling below 100% health." },
    ],
  },
  {
    survivor: "MUL-T",
    skills: [
      { skill: "Power-Saw", slot: "Primary", challenge: "MUL-T: Gotcha!", requirement: "As MUL-T, land the killing blow on an Imp Overlord with the Preon Accumulator." },
      { skill: "Rebar Puncher", slot: "Primary", challenge: "", requirement: "", noUnlockRequired: true },
      { skill: "Scrap Launcher", slot: "Primary", challenge: "MUL-T: Pest Control", requirement: "As MUL-T, defeat two Beetle Queens without leaving the teleporter zone." },
      { skill: "Power Mode", slot: "Special", challenge: "MUL-T: Seventh Day", requirement: "As MUL-T, clear the Void Fields on Stage 7 or later." },
    ],
  },
  {
    survivor: "Engineer",
    skills: [
      { skill: "Spider Mines", slot: "Secondary", challenge: "Engineer: 100% Calculated", requirement: "As Engineer, defeat the teleporter boss in less than 5 seconds after it spawns." },
      { skill: "Thermal Harpoons", slot: "Utility", challenge: "Engineer: Zero Sum", requirement: "As Engineer, finish charging the teleporter with zero monsters remaining on the stage." },
      { skill: "TR58 Carbonizer Turret", slot: "Special", challenge: "Engineer: Better With Friends", requirement: "As Engineer, recruit 12 minions at one time." },
    ],
  },
  {
    survivor: "Artificer",
    skills: [
      { skill: "Plasma Bolt", slot: "Primary", challenge: "Artificer: Massacre", requirement: "As Artificer, perform a multikill of 20 enemies." },
      { skill: "Cast Nano-Spear", slot: "Secondary", challenge: "Artificer: Chunked!", requirement: "As Artificer, fully defeat the teleporter boss in a one-second burst of damage." },
      { skill: "Ion Surge", slot: "Special", challenge: "Artificer: Orbital Bombardment", requirement: "As Artificer, kill 15 enemies before touching the ground." },
    ],
  },
  {
    survivor: "Mercenary",
    skills: [
      { skill: "Rising Thunder", slot: "Secondary", challenge: "Mercenary: Demon of the Skies", requirement: "As Mercenary, don't touch the ground for 30 seconds." },
      { skill: "Focused Assault", slot: "Utility", challenge: "Mercenary: Flash of Blades", requirement: "As Mercenary, use 20 abilities in 10 seconds." },
      { skill: "Slicing Winds", slot: "Special", challenge: "Mercenary: Ethereal", requirement: "As Mercenary, complete a Prismatic Trial without falling below 100% health." },
    ],
  },
  {
    survivor: "Bandit",
    skills: [
      { skill: "Blast", slot: "Primary", challenge: "Bandit: Classic Man", requirement: "As Bandit, successfully use 'Lights Out' to reset your cooldowns 15 times in a row." },
      { skill: "Serrated Shiv", slot: "Secondary", challenge: "Bandit: Sadist", requirement: "As Bandit, kill a monster with 20 stacks of Hemorrhage." },
      { skill: "Desperado", slot: "Special", challenge: "Bandit: B&E", requirement: "As Bandit, kill the final boss with 'Lights Out'." },
    ],
  },
  {
    survivor: "Loader",
    skills: [
      { skill: "Spiked Fist", slot: "Secondary", challenge: "Loader: Swing By", requirement: "As Loader, reach and proceed through the Celestial Portal in 25 minutes or less." },
      { skill: "Thunder Gauntlet", slot: "Utility", challenge: "Loader: Earthshatter", requirement: "As Loader, land a Charged Gauntlet hit at 300mph or higher." },
      { skill: "Thunderslam", slot: "Special", challenge: "Loader: The Thunderdome", requirement: "As Loader, kill three other Loaders in the Bulwark's Ambry." },
    ],
  },
  {
    survivor: "Acrid",
    skills: [
      { skill: "Ravenous Bite", slot: "Secondary", challenge: "Acrid: Bad Medicine", requirement: "As Acrid, land the final blow on a Scavenger." },
      { skill: "Frenzied Leap", slot: "Utility", challenge: "Acrid: Pandemic", requirement: "As Acrid, inflict Poison 1000 total times." },
      { skill: "Blight", slot: "Passive", challenge: "Acrid: Easy Prey", requirement: "As Acrid, land the killing blow on 50 total enemies that have 1 hit point left." },
    ],
  },
  {
    survivor: "Captain",
    skills: [
      { skill: "OGM-72 'DIABLO' Strike", slot: "Utility", challenge: "Captain: Smushed", requirement: "As Captain, kill the final boss using a Supply Beacon." },
      { skill: "Beacon: Hacking", challenge: "Captain: Worth Every Penny", requirement: "As Captain, repair and recruit a TC-280 Prototype." },
      { skill: "Beacon: Resupply", challenge: "Captain: Wanderlust", requirement: "As Captain, visit 10 different environments in a single run." },
    ],
  },
  {
    survivor: "REX",
    skills: [
      { skill: "DIRECTIVE: Drill", slot: "Secondary", challenge: "REX: Bushwhacked", requirement: "As REX, complete an entire teleporter event while under 50% health." },
      { skill: "Bramble Volley", slot: "Utility", challenge: "REX: Dunked", requirement: "As REX, kill a Clay Dunestrider on Abandoned Aqueduct by throwing it into a pit." },
      { skill: "DIRECTIVE: Harvest", slot: "Special", challenge: "REX: Full of Life", requirement: "As REX, heal for 1000 health at once." },
    ],
  },
  {
    survivor: "Heretic",
    /** Verified against SkillFamily.variants: this survivor genuinely has no alternates. */
    skills: [],
  },
  {
    survivor: "Railgunner",
    skills: [
      { skill: "HH44 Marksman", slot: "Secondary", challenge: "Railgunner: Marksman", requirement: "As Railgunner, fire 30 consecutive sniper shots without missing a Weak Point." },
      { skill: "Polar Field Device", slot: "Utility", challenge: "Railgunner: Annihilator", requirement: "As Railgunner, deal 1,000,000 damage in one shot." },
      { skill: "Cryocharge", slot: "Special", challenge: "Railgunner: Trickshot", requirement: "As Railgunner, get 3 kills with a single Supercharge shot while airborne." },
    ],
  },
  {
    survivor: "Void Fiend",
    /** Verified against SkillFamily.variants: this survivor genuinely has no alternates. */
    skills: [],
  },
  {
    survivor: "Seeker",
    skills: [
      { skill: "Soul Spiral", slot: "Secondary", challenge: "Seeker: Airborne Souls", requirement: "As Seeker, hit three or more airborne enemies with a single use of the exploding third hit of Spirit Punch." },
      { skill: "Reprieve", slot: "Utility", challenge: "Seeker: Scorched Earth", requirement: "Deal 500,000% damage with one use of Sojourn's explosion." },
      { skill: "Palm Blast", slot: "Special", challenge: "Seeker: Clear Mind", requirement: "As Seeker, meditate 20 times consecutively without missing an input in a single run." },
    ],
  },
  {
    survivor: "Chef",
    skills: [
      { skill: "Ice Box", slot: "Secondary", challenge: "CHEF: It's Getting Hot In Here!", requirement: "As CHEF apply 20 stacks of Burn at once to the final boss." },
      { skill: "Oil Spill", slot: "Utility", challenge: "CHEF: You've Always Been Crazy", requirement: "As CHEF hit five airborne enemies with one instance of Roll." },
      { skill: "Yes, CHEF!", slot: "Special", challenge: "CHEF: Barbecued Bison Recipe Complete", requirement: "As CHEF complete 10 recipes by searing an oiled bison with Sear." },
    ],
  },
  {
    survivor: "False Son",
    skills: [
      { skill: "Lunar Stakes", slot: "Secondary", challenge: "False Son: Protein Heavy Diet", requirement: "As False Son, gain 40 additional Lunar Spikes through Growth." },
      { skill: "Meridian's Will", slot: "Utility", challenge: "False Son: Family Bonding", requirement: "As False Son, have Aurelionite kill the final boss while the final boss is inflicted with at least one Lunar Ruin." },
      { skill: "Laser Burst", slot: "Special", challenge: "False Son: Stare Them Down", requirement: "As False Son, kill 15 enemies with one activation of Laser of the Father." },
    ],
  },
  {
    survivor: "Operator",
    skills: [
      { skill: "CMD-SWARM", slot: "Secondary", challenge: "Operator: That All You Got?", requirement: "As Operator, kill 4 different types of monsters with a single ricochet." },
      { skill: "FIREWALL", slot: "Utility", challenge: "Operator: Not So Different", requirement: "As Operator, defeat the Teleporter boss on Conduit Canyon without touching the ground." },
      { skill: "Amp Core", slot: "Special", challenge: "Operator: That Just Happened", requirement: "As Operator, keep an Elder Lemurian airborne for 10 seconds." },
    ],
  },
  {
    survivor: "Drifter",
    skills: [
      { skill: "Junk Cube", slot: "Secondary", challenge: "Drifter: Trash Compactor", requirement: "As Drifter, carry 20 temporary items at once." },
      { skill: "Tornado Slam", slot: "Utility", challenge: "Drifter: In The Bag", requirement: "As Drifter, defeat a boss from the challenge of the Mountain by tossing a Shrine of the Mountain." },
      { skill: "Tinker", slot: "Special", challenge: "Drifter: Leave No Trace", requirement: "As Drifter, claim the contents of the lost backpack in the vault of Solutional Haunt." },
    ],
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
  /**
   * The VERIFIED mechanic — code formula + prefab constants (PLAN §5.0.4). This is the
   * layer the in-game description often omits, and it is the one the UI presents as
   * fact. Absent until that shrine has been traced; absent means "not yet verified",
   * never "nothing more to say".
   */
  mechanic?: string;
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
    cost: "17 gold, x1.4 per success (max 2)",
    description: "When activated by a survivor the Shrine of Chance has a chance to drop an item of random rarity or a random equipment item.",
  },
  {
    name: "Shrine of Blood",
    cost: "50% -> 75% -> 93.75% of max health (max 3)",
    description: "When activated by a survivor the Shrine of Blood consumes a percentage of the survivors health in exchange for gold equal to half the amount of HP taken.",
    // ShrineBloodBehavior (code) + the shrineblood prefab (constants):
    //   maxPurchaseCount = 3, goldToPaidHpRatio = 0.5, costMultiplierPerPurchase = 2,
    //   PurchaseInteraction.cost = 50, costType = PercentHealth
    //   Networkcost = 100 * (1 - (1 - cost/100)^costMultiplierPerPurchase)
    mechanic:
      "Costs a percentage of MAXIMUM health, and that cost compounds after each use: " +
      "50%, then 75%, then 93.75%. Limited to 3 uses, after which the shrine is spent. " +
      "Gold gained is half the health paid — 25%, 37.5%, then 46.9% of your max health " +
      "converted to gold. The in-game description mentions neither the escalation nor the cap.",
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
    cost: "25 gold, x1.5 per use (max 3)",
    description: "When activated by a survivor the Shrine of the Woods will create a circular field around it that heals all allies when inside it.",
  },
  {
    name: "Shrine of Shaping",
    cost: "An offering of Soul",
    description: "An offering of Soul reduces all living Survivors' health by 30%, but revives all dead Survivors and gives an extra life to all living Survivors.",
  },
  {
    name: "Halcyon Shrine",
    cost: "Siphons gold within 30m; tiers at 75 / 150 / 300 (scales with difficulty)",
    description: "A Shrine created from a shard from Meridian imbued with Aurelionite's energy. When the Shrine is activated it begins siphoning gold from nearby Survivors up until a maximum gold amount has been stored. After the first tier has been reached, the player can interact with the Shrine early and ending the gold siphon or wait till the final tier is reached. Interacting with the Shrine summons a slumbering Halcyonite and on its defeat an Aurelionite Fragment will drop. Depending on the amount of gold drained the Fragment gains more options and allow more items to be selected from the Fragment.",
  },
  {
    name: "Shrine of Rebirth",
    cost: "One item, stored for the next run",
    description: "Praying at the Shrine of Rebirth allows the player to store an item in the Artifact of Rebirth. Storing an item in the Artifact of Rebirth replaces any item stored within. Activating the Artifact of Rebirth will gift the item to the Survivor upon descending to Petrichor V.",
  },
  {
    name: "Cleansing Pool",
    cost: "1 Lunar item or equipment",
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
