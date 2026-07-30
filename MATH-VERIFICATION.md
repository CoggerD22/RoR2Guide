# Math Verification & Validation — Mini-Project Plan

Goal: **prove every number, percentage, and formula the site uses matches Risk of
Rain 2 exactly** — no wrong values, no missing effects, no hand-waved order of
operations — and lock it so future patches can't silently break it.

This plan is grounded in the strongest sources available and is explicit about
what each step actually *proves* (verification) vs. merely checks (consistency).

---

## 1. Source hierarchy (ground truth, most authoritative first)

| # | Source | What it proves | Access |
|---|--------|----------------|--------|
| **1** | **`RoR2.dll` decompiled** — `RoR2/Risk of Rain 2_Data/Managed/RoR2.dll` (5.9 MB) | The *actual* formulas the game runs: `CharacterBody.RecalculateStats()` (exact stat order), each item's stacking constants + function, buff/proc/crit math, survivor base stats. **Definitive.** | On disk (E:). Decompile with `ilspycmd` (.NET 9 SDK is installed). |
| **2** | **In-game stat panel / logbook** | End-to-end truth: what the player actually sees for a given build. Catches anything transcription missed. | Human (you), in-game. |
| **3** | **Language files** — `StreamingAssets/Language/en/*.json` | Displayed text & the numbers embedded in it. | Already wired into `pnpm data:diff`. |
| **4** | **riskofrain2.wiki.gg** — [Item Stacking](https://riskofrain2.wiki.gg/wiki/Item_Stacking), per-item pages, stat/armor pages | Community transcription of the code. Documents the 4+ stacking categories and per-item formulas. Good cross-check, not primary. | Web. |

**Legal/ethical guardrail (non-negotiable):** decompiled game code is copyrighted.
We use it *locally for verification only*. We **never commit or redistribute the
decompiled source** — the repo continues to hold only the factual numbers/formulas
(which are facts, exactly as the wiki publishes them) plus provenance citations.
Decompiled output goes in a git-ignored directory.

---

## 2. Scope — everything numeric the site asserts

- **Item stacking** (212 items): every `base`, `perStack`, stacking **type**
  (linear / hyperbolic / exponential / **reciprocal** / special), and hard `cap`.
- **Stat-calculation engine** (Stat Lab): the exact order of operations in
  `RecalculateStats`, the armor formula (incl. **negative armor**), crit chance &
  multiplier, attack speed, movement speed, regen, jumps, shields/barrier, and
  **every** stat-affecting item (not just today's ~14).
- **Survivor stats** (19): base + per-level growth for health, regen, damage,
  armor, move speed, jumps, base attack speed, crit — including the oddballs
  (Heretic negative regen, REX HP-cost, MUL-T/Loader armor, Void Fiend forms).
- **Reference numbers**: artifact numeric effects (Glass 500%/10%, Swarms, etc.),
  shrine costs/odds, Bazaar seeding.
- **Proc coefficients** (PLAN §4.3): per-skill proc coefficients — the single most
  scattered piece of RoR2 math — extracted to a dataset.
- **The "DPS proxy"**: decide whether to make it defensible or clearly re-scope /
  remove it (it is currently an invented relative metric).

---

## 3. Phases

### Phase 0 — Ground-truth pipeline (tooling)
1. `dotnet tool install -g ilspycmd`; decompile `RoR2.dll` → `./.decompiled/` (git-ignored).
2. Confirm the key symbols are readable:
   - `RoR2.CharacterBody.RecalculateStats()` — the master stat method.
   - `RoR2.Items.*` / item body components + `RoR2.CharacterBody` stat fields.
   - `RoR2.CharacterMaster`, `BuffCatalog`, elite/aspect defs, `RoR2.HealthComponent`.
3. Write extraction scripts (`scripts/extract/*.ts` or `.py`) that parse the
   decompiled C# for the constants/formulas we need and emit machine-readable JSON.
4. Add `.decompiled/` to `.gitignore`. Document the decompile step so it's
   reproducible (and re-runnable after a patch).

**Proves:** we have the authoritative formulas in a diffable form.

### Phase 1 — Item stacking verification
1. Extract per-item: base value, per-stack value, stacking function, cap.
2. New tool `pnpm data:verify` diffs the extracted truth against `items.json`
   `stacking[]` (values **and** the type classification).
3. Fix every mismatch. Promote **reciprocal** to a first-class stacking type in the
   schema (today it hides inside "special"); re-tag affected items.
4. Each `stacking` entry gains a provenance note (source symbol).

**Proves:** every item's numbers and stacking behavior match the code.

### Phase 2 — Stat-calculation engine
1. Transcribe `RecalculateStats()` step-by-step: the exact sequence base → level
   scaling → additive → multiplicative → buffs, per stat.
2. Rebuild `statMath.ts` to mirror that order **exactly** (fixes the current
   combined-stacking-order approximation — the real weak point).
3. Model **all** stat-affecting items, not ~14.
4. Fix edge cases: negative-armor curve, crit base multiplier, shield/barrier,
   Transcendence, Corpsebloom cap, etc.
5. Resolve the DPS proxy: either compute a defensible number with documented
   assumptions (proc coefficients, base attack interval) or clearly present it as a
   non-authoritative relative index.

**Proves:** the calculator reproduces the game's stat math, combinations included.

### Phase 3 — Survivor stats
1. Extract base stats + growth for all 19 bodies from the decompiled body defs.
2. Diff vs `survivors.json`; fix; add non-default fields (base attack speed, base
   crit, sprint multipliers) where they differ per survivor.

**Proves:** survivor inputs to the calculator are code-accurate.

### Phase 4 — In-game empirical validation (you)
1. Define a sample matrix that exercises every stat and stacking type **and their
   combinations**: e.g. Commando@1 baseline; Merc@35 + linear items; Shaped Glass +
   Bison Steak (order interaction); crit cap; negative armor; Transcendence; a
   drone/proc build.
2. For each, you load the build in-game and read the stat panel; we reconcile the
   engine to the readings until they match to rounding.

**Proves:** end-to-end correctness against what the player actually sees — the one
check code-transcription alone can't give.

### Phase 5 — Reference & proc data
1. Verify artifact numeric effects and shrine costs/odds against the code.
2. Extract per-skill **proc coefficients** → dataset; surface in the codex/tools.

### Phase 6 — Lock-in & regression
1. `pnpm data:verify` (code-diff) + expanded `pnpm test:unit` (engine vs
   code-derived and in-game expected values). Unit tests run in CI always.
2. Every dataset number carries **provenance** (`source` + symbol) and a
   **confidence** tag: `code-verified` › `in-game-verified` › `wiki-only`.
3. Ties into PLAN §4.6 patch-survival: after a game update, re-decompile,
   re-run `data:verify`, and anything changed flips to `verified:false` until re-checked.

---

## 3b. Progress log

- **Phase 0 — done.** `scripts/decompile.sh` (ilspycmd 9.1.0.7988) emits
  `RecalculateStats()` etc. to `.decompiled/` (git-ignored). Committed `826cc41`.
- **Phase 2 — done for modeled stats.** Read `RecalculateStats()` block by block and
  reconciled `statMath.ts`. Most already matched the code exactly (health order,
  damage `×2^ShapedGlass` / `×5` glass, attack-speed coefficients, crit multiplier
  `2 + LaserScope`, move speed, jumps, armor). **Two real bugs fixed** (`2f29b65`):
  item regen scales with level `(1 + 0.2·(level−1))`; Irradiant Pearl also grants
  +10% crit chance/stack. Shaped Glass health confirmed to be the Curse system
  (`cursePenalty = 2^stacks` → effective HP `×0.5^n`), which the engine already did.
- **Phase 1 — partial.** `reciprocal` promoted to a first-class stacking type and 7
  items re-tagged; Light Flux's attack-speed reduction is code-confirmed reciprocal
  (`/(stacks+1)`). Committed `d07e01c`. Item *numbers* remain verified against the
  game language files (`pnpm data:diff`, 0 diffs). Non-linear formulas spot-checked
  against decompiled behavior classes: Tougher Times block = `ConvertAmp(15n)` →
  13.04%@1/60%@10 (note was already right); Safer Spaces = `15·0.9^count` (clarified);
  Genesis Loop `30/(1+n)` retagged special→reciprocal; **Old Guillotine corrected** —
  `ConvertAmp(13n)` is ~11.5%@1 stack, not the 13% amplification input the tooltip
  shows. `ConvertAmplificationPercentageIntoReductionPercentage(x) = (1−100/(100+x))·100`.
  Still TODO: Sentient Meat Hook / Tentabauble proc chances (in GlobalEventManager).
- **Phase 6 — started.** `pnpm data:verify` (`scripts/data-verify.ts`) locks the 13
  Stat Lab coefficients to the values transcribed from `RecalculateStats()` (each with
  a source-line citation) and fails CI on drift; when `.decompiled/` is present locally
  it also greps the live method for each pattern to catch post-patch changes. Still
  TODO: wire into CI, and add per-number provenance/confidence tags across the datasets.
- **Phase 3 — done, via asset extraction.** Survivor base stats are *not* in
  `RoR2.dll` (verified: `CharacterBody` declares `baseMaxHealth`/`levelRegen`/… as
  plain public fields and **no code assigns them** — they're serialized per body
  prefab). They are, however, fully extractable from the Addressables bundles.
  `scripts/extract-bodies.py` (UnityPy) reads every `CharacterBody`'s serialized
  stats in ~15s, plus the `SurvivorDef` roster. Both assets are located by **field
  signature**, not MonoScript class name, because script pointers live in separate
  `*_monoscripts_*` bundles and don't resolve.
  - Roster confirmed against the game: exactly **19 SurvivorDefs**, matching
    `survivors.json` 1:1. Notably **Operator's body is `DroneTechBody`**
    (`DRONETECH_BODY_NAME`, cachedName `DroneTech`) — proven from the SurvivorDef,
    not inferred from stat-matching.
  - **Result: 19 survivors × 10 fields = 190 comparisons, 0 mismatches.** The
    wiki-sourced values were correct — but they are now *asset-verified* rather than
    trusted. `pnpm data:verify` locks them (CI-safe table + live cross-check).
  - *Earlier this doc claimed Phase 3 was "in-game-only" because the values
    "can't be decompiled". That conclusion was untested and wrong: not-in-the-DLL
    does not mean not-extractable.*
- **Phase 4 — largely obsolete.** With formulas code-verified (Phase 2) and base
  stats asset-verified (Phase 3), every input and every operation now traces to game
  data. `docs/stat-validation.md` is retained only as an *optional* end-to-end
  spot-check; it is no longer a prerequisite for trusting the numbers.

---

## 3c. Phase 5 (proc coefficients) — extraction proven, join scoped

Same asset-extraction path that solved Phase 3 also reaches proc data (correcting
the earlier "unreachable, defer" call). `scripts/extract-procs.py` pulls, in ~30s:
- **485 SkillDefs** (name token → English, `activationState._typeName`, recharge, stock).
- **85 EntityStateConfiguration `procCoefficient` values** (31 of them survivor skills;
  authoritative shipped values, e.g. Commando FireShotgunBlast 0.5, Captain shotgun 0.75).
- **350 projectile-prefab `procCoefficient` values.**

A *correct* per-skill table needs three resolution paths, not one:
1. ESC-direct — the 31 above (done, verifiable).
2. Projectile skills — the ESC holds a `projectilePrefab` PPtr (confirmed on
   `Mage.Weapon.FireFireBolt`); resolve PathID → projectile → its proc.
3. Hitscan skills — proc is hardcoded in C# (`bulletAttack.procCoefficient = 1f`,
   e.g. `Commando…FirePistol2`); a decompile grep, no ESC/projectile.
   (Many remaining skills are non-damaging — Captain beacons, Smoke Bomb — and
   correctly have no proc at all.)

Status: extractor resolves paths 1+2 automatically — **236 EntityStates resolved**
(85 ESC-direct + 151 via same-bundle `projectilePrefab` PPtr → projectile's
`procCoefficient`; the PPtr is FileID 0, so it resolves within the survivor's own
bundle, e.g. `Mage.Weapon.FireFireBolt` → `MageFireboltBasic` → 1.0). Raw truth in
git-ignored `.gamedata/procs.json`.

Two facts learned that shape the UI build:
- **Path 3 is mostly implicit.** Hitscan skills like `Commando…FirePistol2` set *no*
  explicit `procCoefficient`; they inherit `BulletAttack`'s framework default of 1.0.
  So the only *interesting* (non-1.0) procs are the ESC/projectile overrides already
  captured — but "unresolved" must not be blindly defaulted to 1.0, because…
- **…non-damaging skills have no proc at all** (Captain beacons, Smoke Bomb, dashes),
  and the 188 raw survivor SkillDefs are polluted with intermediate Setup/Prep/Charge
  sub-states and duplicates.

Therefore the per-skill dataset is keyed on each survivor's **loadout structure**
(body → SkillLocator → SkillFamily variants), not raw SkillDefs.

Pipeline (all reproducible, inputs git-ignored):
- `extract-loadouts.py` → 125 loadout variants across 19 survivors, each variant's
  proc resolved in-bundle from its ESC. Key correction: proc lives under *type-specific*
  field names — `procCoefficient` (bullet), `orbProcCoefficient` (Huntress arrows = 1),
  `glaiveProcCoefficient` (Laser Glaive = 0.8, which corrected a wrong memory of 1.0),
  `blastProcCoefficient`, etc. — or on the `projectilePrefab`.
- `build-skill-procs.mjs` fills the rest from the decompile: explicit
  `.procCoefficient = <literal>`, or the framework default 1.0 when a state creates a
  BulletAttack/OverlapAttack/BlastAttack without firing a projectile (all three
  initialise `procCoefficient = 1f` — verified in the decompile). Emits
  `src/data/skills.json`.

**Coverage: 87/125 skills have a verified proc + provenance; 38 are left `verified:false`
(proc:null), NOT guessed.** Spot-checks pass: Double Tap 1.0, Phase Blast 0.5, Frag
Grenade 1.0, Strafe 1.0, Laser Glaive 0.8, Arrow Rain 1.0, Eviscerate 1.0, Vulcan
Shotgun 0.75.

Entry states hand off to the state that actually attacks, in at least three shapes:
`SetNextState(new FireX())`, `return new ArrowRain()` (factory), and assign-to-variable
then `SetNextState(v)`. Matching the *call* missed two of the three, so the resolver now
follows any `new X()` whose class lives in an `EntityStates` namespace — that covers all
three and can't wander into unrelated types. Base state classes are followed too
(Merc's melee states inherit their OverlapAttack from `BaseMeleeAttack`).

### Rejected: automatic "deals no damage" labelling

Tried, and deliberately reverted. The plan was to mark skills with no damage evidence as
"no proc" so the UI could stop saying "unverified" for dashes and beacons. It produced
**false negatives on Huntress's Ballista and Railgunner's M99 Sniper** — both obviously
damaging, both reported clean because their damage sits behind multi-hop handoffs the
walk loses (`BeginArrowSnipe → AimArrowSnipe → FireArrowSnipe`). Three earlier traversal
gaps had already been found and patched the same way: each surfaced only because a human
recognised the skill.

Absence of evidence is not evidence of absence here. A wrong "no proc" tells a player a
skill cannot trigger on-hit items when it can — worse than admitting we don't know. Any
future attempt needs positive proof of non-damage or hand-curation, not a failed search.
The reasoning is recorded in `scripts/build-skill-procs.mjs` so it isn't retried blindly.

## 3d. Phase 5b (artifacts + shrines) — verified against code/assets, clean

Every numeric claim in `reference.ts` checked against the decompiled behavior classes
and prefabs. All correct as written; no corrections needed.
- Artifact of Glass "500% damage, 10% health": `num101 *= 5f` (damage) and
  `cursePenalty *= 10f` → effective HP ÷10 (CharacterBody.RecalculateStats, flag7).
- Artifact of Swarms "spawns doubled, health halved": `SwarmsArtifactManager.
  swarmSpawnCount = 2`; spawned monsters get `RoR2Content.Items.CutHp`, which in
  RecalculateStats does `maxHealth /= (count+1)` → halved.
- Artifact of Frailty (`weakAssKneesArtifactDef`) "fall damage doubled and lethal":
  on hit-ground, `damageInfo.damage *= 2f` and the `NonLethal` flag is cleared.
- Shrine of Blood "~½ current health": prefab `PurchaseInteraction.cost = 50` with
  `costType = PercentHealth` (extracted from ror2-base-shrineblood bundle). Exactly 50%.
Remaining shrine copy is intentionally qualitative prose (no hard numbers to verify).

> **CORRECTION (see §3j).** The two claims above are wrong, and the error is
> instructive. "Exactly 50%" is only the **first** purchase: `ShrineBloodBehavior`
> recomputes the cost after every use via
> `Networkcost = 100 · (1 − (1 − cost/100)^costMultiplierPerPurchase)`, and the prefab
> sets `costMultiplierPerPurchase = 2`, `maxPurchaseCount = 3` — so the real sequence is
> **50% → 75% → 93.75% of MAX health, capped at 3 uses**. And "no hard numbers to
> verify" was false: the numbers were in the prefab all along, just not looked for.
> Reading one field (`cost`) and stopping is how a partial check becomes a confident
> wrong answer.

## 3e. Phase 6 (provenance) — done

Every item/survivor record now carries a `confidence` tag (code > asset > langfile
> wiki) alongside `verified`, surfaced as an understated badge in the codex detail
drawer. Populated from what was actually checked, not aspirationally:
- **20 items `code`** — Stat Lab coefficients locked by `data:verify`, plus the
  non-linear formulas verified against behavior classes (Tougher Times, Old
  Guillotine, Safer Spaces, Genesis Loop, Light Flux, Unstable Transmitter).
- **192 items `langfile`** — name/pickup/numbers match the game's language files
  (`data:diff`, 0 diffs).
- **19 survivors `asset`** — 190/190 field comparisons against the body prefabs.

Nothing is tagged `wiki` any more: every record has been confirmed against game
data. The tag exists so that if future data lands wiki-only, it is visibly weaker
rather than silently equal.

## 3f. The last 21 procs — static analysis is exhausted here

After the curated-link pass and the Heretic fix (**104/125**), I traced every remaining
skill through the decompile (transitions, base classes, virtual overrides). None yield a
*clean* value, and the reasons are worth recording so they aren't re-drilled — each is a
real limit, not a missed grep.

(The tracing also found Heretic's four "Nevermore" slots were a placeholder, not real
skills — her kit is item-granted; see §3g. Modelling it correctly resolved 3 more and is
why this is now 21, not 25.)

**Movement / stance / utility — no attack construct (13).** Tactical Dive/Slide,
Blink, Phase Blink, Retool, Power Mode, Shadowfade, Trespass, Sojourn, Ascent Protocol,
ADMIN-OVERRIDE, Salvage, Repossess. These build no BulletAttack/OverlapAttack/etc.
They almost certainly have *no proc*, but that is a negative static analysis can't
prove (see the reverted "no-damage" detector, §3c).

**Entity spawners — the spawned thing procs, not the skill (3).** Engineer's TR12 and
TR58 turrets, Captain's Orbital Supply Beacon. The turret/drone has its own body and
proc (e.g. `EngiTurretWeapon.FireBeam` = 3); "the proc of the skill that places it" is
arguably a category error, not a missing number.

**Damaging but value not statically determinable (5).** REX's DIRECTIVE: Disperse
(`FireSonicBoom.procCoefficient` has no initializer, no ESC config, and no assignment
anywhere found — origin genuinely unclear); REX's Tangling Growth (a projectile plus a
separate `procCoefficient = 0f` direct hit); Operator's CMD-SWARM (`DroneTech…Paint.Fire`
delivers via a `FireMissile()` helper); False Son's Meridian's Will; Seeker's Reprieve.

**Resolution: the runtime dumper, not more inference.** `tools/ProcDumper` observes the
actual proc each hitscan/melee attack fires with. It settles the movement/stance "does it
even proc" question that static analysis provably can't, reads the ambiguous values
directly, and cross-checks the existing verified ones. That is the correct next step for
these 21, and it needs one modded in-game session.

## 3g. Heretic — placeholder vs. real kit

The survivor page first showed Heretic with four identical "Nevermore" skills. Tracing
confirmed this is not an extraction bug: `HereticBody`'s SkillLocator genuinely holds one
placeholder (`EntityStates.Heretic.Weapon.Squawk`, token `HERETIC_DEFAULT_SKILL_NAME` =
"Nevermore") in all four slots, because her real skills are granted at runtime by the four
Heresy lunar items (`RoR2Content.Items.Lunar{Primary,Secondary,Utility,Special}Replacement`).
`scripts/build-skill-procs.mjs` now substitutes her true kit — Hungering Gaze (0.1),
Slicing Maelstrom (1), Shadowfade (—, intangible dash), Ruin (1) — verified from the game's
own `SKILL_LUNAR_*_REPLACEMENT` tokens and SkillDefs, procs from the same global data as
every other skill. The page carries a note that she has no fixed kit.

## 3h. Roster completeness — every game item is in the codex

`data:diff` checks the items we *have*; it never asked whether the game has one we're
*missing* (how a new-DLC item would slip through). `scripts/extract-itemdefs.py` pulls
every ItemDef/EquipmentDef from the bundles (237 items, 60 equipment) and
`pnpm data:roster` diffs both directions.

**Result: complete and clean.** All 170 droppable-tier game items (Tier1/2/3, Lunar,
Boss, Void*) are in items.json, and all 212 codex entries are backed by a real game
def — 0 missing, 0 stale.

Eight equipment exist in the files but not the codex; each was run down and is
correctly excluded — none is a real gap, but the reasoning is recorded so a future
patch's genuine additions stand out:
- **Cut content** — Reaper's Remorse (`JunkContent.Equipment.GhostGun`), plus Beyond
  the Limits and Overloading Excavator (zero code references — dead assets).
- **Consumed variants** — Seed of Life (Consumed), Trophy Hunter's Tricorn (Consumed):
  we carry the base items and hide consumed forms by design.
- **Unresolved / internal** — SoulCorruptor (name token doesn't resolve).
- **Flagged for a human/in-game check (not added):** G-Force Accelerator (loads from
  `RoR2/DLC3/…`) and Elegy of Extinction (`DLC1Content` with a live use-handler) are
  active-DLC-referenced but `canDrop=false`; Coven of Gold (Gilded aspect) and Jar of
  Souls have single references. Whether any is a *currently obtainable* codex pickup
  needs the in-game logbook — `canDrop` alone can't decide it, since the elite aspects
  we already include (Her Biting Embrace, Ifrit's Distinction) are also `canDrop=false`.

## 3i. DLC assignment — 4 items were mislabelled

Each item's `dlc` field (base/sotv/sots/ac) was hand-entered, and CLAUDE.md flags DLC
knowledge as the stalest thing in training data. The game is authoritative: every asset
ships in a bundle named by origin (`ror2-base-*`, `ror2-dlc1-*` = SotV, `ror2-dlc2-*` =
SotS, `ror2-dlc3-*` = AC). `extract-itemdefs.py` now records that, and `data:roster`
checks it.

**Four were wrong**, each confirmed by three independent signals (content-pack
declaration, `.Items.X` usage, and the physical bundle):
- Delicate Watch, Power Elixir, Roll of Pennies: base → **sotv**
- Planula: sotv → **base**

The other 208 were already correct; all 212 now match the game's own bundle
organisation, and `data:roster` fails on any future drift (tested).

**Tier** is checked the same way (game `ItemTier` for items, `isLunar` for equipment).
One error: **Shared Design** was `equipment`; it's the *lunar* elite aspect
(`EliteLunarEquipment` / `EQUIPMENT_AFFIXLUNAR`, `isLunar=true`, like every other
lunar equipment we carry) → `lunar-equipment`. The check is kind-aware: Alloyed
Collective ships a Boss *item* AND a drone *equipment* both named "Faulty Conductor",
so each codex entry is matched to the game def of its own kind — our Boss item was
correct and an early cross-kind version of the check false-flagged it.

## 3j. Void corruption — 17 missing pairs (rule #4)

Rule #4 requires void corruption to be bidirectional *and correct*. `data:audit` only
enforced the first half — that any pair we *declare* points back — so an entirely
*absent* relationship was invisible to it. The game's single `ItemRelationshipProvider`
(ContagiousItem, 31 pairs after dedupe) is authoritative; `extract-itemdefs.py` now
resolves it (the item refs are external PPtrs, resolved via a global Addressables
path_id → cachedName index) and `data:roster` checks it both directions.

**Newly Hatched Zoea (`VoidMegaCrabItem`) corrupts all 17 boss-tier items — and our
codex recorded none of it.** `newly-hatched-zoea.corrupts` was empty and all 17 boss
items lacked `corruptedBy`. Added both directions (Titanic Knurl, Shatterspleen,
Queen's Gland, Planula, Pearl, Irradiant Pearl, the four SotS/AC boss items, Yellow
Scrap, etc.). The other 13 void items — including Singularity Band corrupting *both*
Bands — were already exact. `data:roster` now fails on any corruption drift (tested).

## 4. Definition of done

- 100% of item stacking values + types **code-verified** (`data:verify` clean).
- `statMath` order of operations provably mirrors `RecalculateStats`.
- All 19 survivors' stats code-verified.
- The in-game sample matrix matches the engine to rounding.
- Artifacts/shrines numeric data code-verified; proc-coefficient dataset exists.
- Regression automation in place; every number is provenance-tagged.

## 5. Risks & constraints

- **Copyright:** decompiled source stays local & git-ignored; only facts are committed.
- **Decompilation quality:** RoR2 isn't heavily obfuscated, but some values live in
  Unity asset bundles (prefab component fields) rather than C# constants — those may
  need a secondary extraction path (AssetRipper / in-game readout) and are the most
  likely to fall back to Phase 4.
- **Effort:** multi-session. Phases 0–1 are the backbone; 2–4 are the depth.
- **Patch drift:** the whole pipeline is re-runnable so a new patch is an afternoon,
  not a rebuild.

## 6. Suggested sequencing

`Phase 0` → `Phase 1` (biggest correctness win) → `Phase 3` (cheap, feeds the engine)
→ `Phase 2` (rebuild engine to code) → `Phase 4` (empirical lock) → `Phase 5` → `Phase 6`.

## 3j. Code-verifying item stacking — the 192 (PLAN §6A)

The `verified: true` flag on all 212 items was never the guarantee it read as. Splitting
it by what was actually checked: **20 `code`** (numbers and curve traced to decompiled
C#) versus **192 `langfile`** (numbers *and stacking curve* read out of the description
prose). `data:diff`'s "0 numeric mismatches" compares items.json to the language file,
so it proves transcription, not truth — a circular check.

**Tooling.** `scripts/extract-item-code.py`. Every item effect is gated on reading its
count — `GetItemCountEffective(RoR2Content.Items.<X>)` — so the reference sites are
exactly where the curve lives. 204/212 items resolve to code (449 sites); the other 8
implement their effect in a prefab behaviour with no direct count read.

It deliberately does **not** infer curves by regex. A pattern guessing at arithmetic
produces precisely the plausible-but-unchecked answer this whole effort exists to
remove. It extracts evidence; a human classifies.

Two traps found while building it, both now handled:
- **Second hop.** Many items read their count into a local or an `ItemCounts` field and
  apply it much later (Alien Head → `num16` → `cooldown *= 0.75f` 700 lines on;
  Corpsebloom → `itemCounts.repeatHeal`). The reference site alone shows nothing.
- **Name collision.** "Faulty Conductor" is *both* a Boss item (`ShockDamageAura`) and a
  drone equipment (`DroneShockDamage`). A name-keyed map silently verifies one against
  the other's implementation. Now keyed by `(kind, name)` — the same bug `data:roster`
  had to fix earlier.

### Corrections found

| Item | Recorded | Code says |
|---|---|---|
| **Bandolier** | 18% at 1 stack (from the description) | `(1 − 1/(n+1)^0.33)·100` → **20.4%** (30.4 / 36.7 / 54.7 at 2 / 3 / 10) |
| **Shrine of Blood** | "Exactly 50%" (§3d) | **50% → 75% → 93.75%** of max HP, **capped at 3 uses** |

### Verified this pass (langfile → code)

| Item | Evidence |
|---|---|
| Crowbar | `HealthComponent`: `num4 *= 1f + 0.75f·n`, gated on `num >= fullCombinedHealth * 0.9f` |
| Fuel Cell | `Inventory`: charges `1 + n`; `CalculateEquipmentCooldownScale` `Mathf.Pow(0.85f, n)` |
| Alien Head | `CharacterBody.RecalculateStats`: `cooldown *= 0.75f` per stack |
| Bandolier | `GlobalEventManager`: formula above |
| Gesture of the Drowned | `Inventory`: `0.5f · Mathf.Pow(0.85f, n−1)` |
| Tentabauble | `GlobalEventManager`: `ConvertAmplificationPercentageIntoReductionPercentage(5n · procCoefficient)` |
| Corpsebloom | `HealthComponent`: reserve `amount · (1 + n)`; restore rate `0.1f / n` — reciprocal, so more stacks heal **slower** |
| Neutronium Weight | `CharacterBody.RecalculateStats`: `0.7f · Mathf.Pow(0.9f, n−1)`; armor `35 + 15(n−1)` |

**28 / 212 code-verified.** The remaining 184 are honestly labelled `langfile`, which now
means "transcribed correctly, curve unconfirmed" rather than "verified".

Sequencing is by blast radius (PLAN §6A.4): non-linear curves first, because the
sparkline only auto-plots `linear` entries and non-linear ones rely on their `formula`
string — a wrong curve there is a wrong claim with nothing to correct it. Two of the
first handful examined were wrong, so the expectation is that more remain.

### 3j.1 Second pass — hard caps are the dangerous omission

Verified this pass (all correct as recorded; formulas added citing the source):

| Item | Evidence |
|---|---|
| H3AD-5T v2 | `HeadstompersCooldown.OnEnter`: `duration /= n` — reciprocal, 10s / 5s / 3.3s |
| Old War Stealthkit | `PhasingBodyBehavior`: `30 × Mathf.Pow(0.5f, n−1)` — exponential, 30 / 15 / 7.5 |
| Focused Convergence | `HoldoutZoneController`: `rate ×= 1 + 0.3n`; `radius /= 2n` |

**31 / 212 code-verified.**

**The finding that matters: hard caps.** Only three items recorded a `cap`, and a hard
cap is the single most actionable fact a stacking table can carry — past it, every
further copy of the item is wasted. Scanning all 449 extracted code sites for
`Mathf.Min` / `Clamp` / `cap` / `maxStacks` against item counts surfaced two real ones:

- **Focused Convergence — `cap = 3`.** A 4th stack does nothing, for either the charge
  rate or the zone shrink. Now recorded.
- **Longstanding Solitude — free unlocks capped at 3.**
  `CharacterBody.AddFreeChestBuff` grants the buff in a loop bounded by `i < 3`, while
  the item description reads "+1 per stack" with no limit implied. A 4th stack grants
  no extra unlock. Separately `CharacterMaster.GiveMoneyWithOnLevelUpFreeUnlock` clamps
  the stack count to `maxStacks = 8` for the gold→XP factor `0.12 + 0.0125(n−1)`.

Longstanding Solitude is also a worked example of **not over-claiming**: its
"gold costs +50% per stack" entry has *not* been traced, so the record keeps
`confidence: "langfile"` even though its cap is now code-sourced. Confidence is
per-record while claims are per-field — the tension §6A.3 exists to resolve. Until
that lands, the rule is: **the record's confidence reflects its weakest field.**

### 3j.2 Hard-cap sweep — and the cap that isn't a number

Caps are the objective half of "how many should I take?" (PLAN §5.8b): past one, every
further copy does literally nothing. Only 5 of 212 items recorded a cap, so
`scripts/scan-item-caps.py` sweeps for them properly.

**The scan needed a second hop.** Looking near each `GetItemCountEffective(...)` misses
most caps, because the count is read into a local or an `ItemCounts` field and clamped
much later — which is exactly why Longstanding Solitude's `i < 3` went unnoticed until
it was traced by hand. So the scanner records the variable each count lands in, then
looks forward for that variable inside a capping construct (`Math.Min`, `Mathf.Clamp`,
a bounded grant loop, a ternary clamp, `maxStacks`).

**Precision beat recall, deliberately.** The first run returned 20 items / 22 sites,
mostly false: decompiled code reuses generic names (`num`, `itemCountEffective`,
`result`) for *different* items in one file, so shared lines were attributed to every
candidate — `timedBuffs[num].timer = Mathf.Min(a, max)` "capped" five unrelated items.
Two filters fixed it: drop any variable that holds counts of more than one item in a
file, and only look forward within a method-sized window. Result: **5 sites, reviewable
by hand.** A false "this item is capped" is a wrong claim shipped to players; a miss is
just a known gap.

Of those 5: two are null-guards (`(!inventory) ? 1 : count`), one is Fuel Cell's
255-charge ceiling (real, unreachable), one is the known Longstanding Solitude clamp,
and Pocket I.C.B.M.'s `(num5 <= 0) ? 1 : 3` is a binary effect, not a stacking cap.
**Conclusion: RoR2 has very few hard stacking caps, and we now have the meaningful
ones.** That negative result is worth recording — it's evidence, not an absence of
looking.

**Hiker's Boots was wrong, and instructively so.** Recorded cap: "Buff stacks up to 10
times," quoted from the description. The code:

```csharp
int num = 10 * itemCountEffective;                 // ceiling SCALES with item count
for (int i = 0; i < itemCountEffective; i++)
    characterBody.AddTimedBuff(CritChanceAndDamage, 10f, num);
// each buff stack: num111 += buffCount5;  critMultiplier += 0.01f * buffCount5;
```

So each stack grants +1% crit chance **and** +1% crit damage, and the ceiling is
**10 × item count** — +10% at one stack, +20% at two. "Up to 10 times" describes buff
stacks at one item and reads as a flat ceiling. Corrected and code-verified.

This produced a schema distinction worth keeping: `capStacks` (machine-readable, drives
the planner's warning) is set **only where a single fixed number is genuinely true**.
Hiker's Boots gets the prose `cap` but no `capStacks`, because no single number is
correct — a scaling ceiling asserted as a fixed one would be exactly the kind of
confident-and-wrong claim this programme exists to prevent. **32 / 212 code-verified.**

### 3j.3 Stone Flux Pauldron — the description is wrong, confirmed at IL level

Recorded (from the description): *"Reduce movement speed by 50% (+50% per stack)."*
The decompiled `RecalculateStats` adds the item count to the speed **divisor twice**:

```csharp
num99 += (float)num46;          // num46 = Stone Flux count
...
num99 += (float)num46 * 1f;
num97 *= num98 / num99;         // speed = base × bonuses / penalties
```

Divisor `1 + 2n` gives **66.7%** slower at one stack, not 50%. Since `1 + n` would
give exactly the described 50%, the duplicate looked like a decompiler artifact — and
ILSpy *does* reuse local slots, which had already produced false attributions in the
cap sweep (§3j.2). Guessing either way was unacceptable, so this was settled in **IL**:

```
IL_03ef: stloc.s 46          // ← the only non-zero store: HalfSpeedDoubleHealth count
IL_11a6: ldloc.s 46 ; conv.r4 ; add ; stloc.s 112          // divisor += n
IL_11e5: ldloc.s 46 ; conv.r4 ; ldc.r4 1 ; mul ; add       // divisor += n × 1
```

Local 46 is stored exactly twice — a zero-init and the item count — so it is **not** a
reused slot, and both additions genuinely target the same divisor (local 112). The
double application is real.

Corrected to the code-verified curve (66.7% / 80% / 85.7% at 1 / 2 / 3 stacks), with the
formula stating plainly that the in-game description disagrees. **33 / 212 code-verified.**

**Method note:** when the C# reading and the description disagree *and* the discrepancy
could plausibly be a decompiler artifact, the C# is not sufficient evidence. IL settles
it, and it is cheap (`ilspycmd -il`). This is now the escalation path for any conflict
of this shape — three of the corrections so far (Tougher Times, Bandolier, this) came
from exactly the pattern "the description sounds right, the code says otherwise".

### 3j.4 Second batch — and a missing effect on Purity

Verified langfile → code (all correct as recorded; formulas added citing the source):

| Item | Evidence |
|---|---|
| Sentient Meat Hook | `GlobalEventManager`: chance `(1 − 100/(100 + 20n))·100`; `maxTargets = 5 + 5n` |
| Faulty Conductor | `DroneShockDamageBodyBehavior`: `15f × Mathf.Pow(0.8f, stack − 1)` |
| Spare Drone Parts | Grants n `DroneWeaponsBoost` to minions; `attackSpeedPerStack = 0.25f` (linear) and `cooldownReductionPerStack = 0.75f` applied per-stack (exponential) |
| 57 Leaf Clover | `RecalculateStats`: `luck += Clover` |
| Purity | `RecalculateStats`: cooldown `2 + 1(n−1)`; `luck −= Purity` |

**Purity was missing an entire effect.** Its description states two: a cooldown reduction
*and* "all random effects are rolled +1 times for an unfavorable outcome". The dataset
carried only the cooldown — so on a Lunar item whose whole point is a trade-off, the
**downside was invisible**. Added as a second stacking entry. Worth noting the failure
mode: this is not a wrong number, it's an absent one, which no numeric diff can catch
because there was nothing to compare. `data:diff` reported 0 mismatches throughout.

**The luck mechanic is now exact.** `Util.CheckRoll` rolls `1 + ceil(|luck|)` times and
keeps `Mathf.Min` (best) when luck > 0, `Mathf.Max` (worst) when negative:

```
effective chance = 1 − (1 − p)^(1 + L)     for L > 0
                 = p^(1 − L)               for L < 0
```

So a 10% proc becomes 19.0% with one Clover and 27.1% with two — and drops to ~1% with
one Purity. This is precisely the "marginal value of the next stack" arithmetic §5.8b
Part 2 calls for: objective, derived, and stated with its assumptions. **38 / 212.**

### 3j.5 Elusive Antlers — three errors in a single item

The worst record found so far, and a good argument for checking every entry rather than
spot-checking an item and moving on.

| Entry | Recorded | Code / prefab |
|---|---|---|
| Orb spawn interval | "reduced 10% per stack (multiplicative), min 2s" → 10, **9**, 8.1 | `10 − (1 − 3/(n+2))·8` → 10, **8**, 6.8, 6, asymptotic to 2s |
| Max orbs | 3 (+3/stack) ✅ | `GetElusiveAntlersCurrentMaxStack`: `3 + 3(n−1)` |
| Speed per orb | 12%, flat ✅ | `RecalculateStats`: `num98 += 0.12f × buffCount` |
| **Barrier per orb** | **absent** | prefab: `10 + 7(n−1)` |

Two things worth separating out:

**The interval was wrong at every stack above one.** "10% multiplicative" is a plausible
*shape* — it is how several other RoR2 items behave — which is exactly why it survived:
a wrong model that looks like a familiar one is far harder to notice than a wrong number.

**The barrier is a second Purity-class omission** (§3j.4): an effect the dataset simply
did not have, and one the in-game description never mentions either. It only surfaced by
reading the pickup prefab. Note the escalation this required — code gave the *shape*
(`baseBarrierAmount + additionalBarrierAmountPerAdditionalItemStack × (n−1)`) but the
*values* live in the asset, exactly as §5.0.2 says: **code for the formula, prefab for
the constants; neither alone is sufficient.**

One discrepancy is recorded but not "corrected", because it is the game's own text that
disagrees: the description says the speed buff lasts **12s**, while the prefab sets
`shardPickupBuffTimeSeconds = 7.0` (single component instance, verified). The verified
7s is stated in the formula; the description is still quoted verbatim.

**39 / 212 code-verified.**

### 3j.6 Reciprocal sweep — a systematic error in the formula strings

Egocentrism and Newly Hatched Zoea shared a defect that was *not* in their numbers but in
their **prose**: both are correctly typed `reciprocal` with the correct `base`, but their
formula strings listed example values from a different curve.

| Item | Code | Recorded examples | Real |
|---|---|---|---|
| Egocentrism | `projectileTimer > 3f / stack` | "3s, ~2s, 1.5s" | 3, **1.5**, 1, 0.75s |
| Newly Hatched Zoea | `spawnTimer > 60f / stack` | "60s, ~40s, 30s" | 60, **30**, 20, 15s |

The `~40s` and `~2s` are the tell: nothing in `base/n` produces them. The type and base
were right, so every schema check and numeric diff passed — the wrong values lived only
in human-readable text, which nothing validates. **Prose is unverified data too**, and
for non-linear entries it is the *only* thing the UI shows, since the sparkline
deliberately refuses to plot non-linear curves.

Auditing all 8 reciprocal entries at once surfaced this pattern immediately and also
flagged **Light Flux Pauldron**, marked `code` but carrying a formula with no citation
and no values. Re-checked because it is Stone Flux Pauldron's sibling and Stone Flux had
just turned out to apply its penalty twice (§3j.3):

```csharp
num110 /= (float)(num45 + 1);          // Light Flux: attack speed, divided ONCE
for (int j = 0; j < num45; j++)        // cooldown x0.5 per stack
    num113 *= 0.5f;
```

Light Flux is correct as recorded — 50% / 66.7% / 75% attack-speed reduction — and
applies its divisor **once**. That asymmetry is useful evidence in both directions: it
confirms the sibling items use genuinely different code paths, and it makes Stone Flux's
double application much less likely to be a decompiler artifact.

**41 / 212 code-verified.** Corrections so far: Tougher Times, Bandolier, Shrine of Blood,
Stone Flux, Purity (missing effect), Elusive Antlers ×3, Hiker's Boots, Egocentrism,
Zoea — roughly **one in five** of everything examined.

### 3j.7 Formula prose is now audited — and a documented `base` convention

Following §3j.6, the remaining non-linear formula strings were audited arithmetically.
Most check out (Tougher Times, Old Guillotine, Meat Hook, Bandolier, Gesture, Stealthkit,
Faulty Conductor, Light Flux, Neutronium Weight all reproduce their stated values). Two
did not:

| Item | Finding |
|---|---|
| **Safer Spaces** | `HealthComponent`: `15f × Mathf.Pow(0.9f, itemCount)` — the exponent applies from the **first** stack, so one stack recharges in **13.5s**, not the described 15s. `base` corrected 15 → 13.5. |
| **Mercurial Rachis** | `16f × Mathf.Pow(1.5f, stack − 1)` → 16 / 24 / 36 / 54 m. Correct as recorded; citation added. |

**`data:audit` now cross-checks formula prose against `base`.** Where a formula states a
"<x> at 1 stack" value, it must agree with the recorded `base`. Verified to fire by
deliberately corrupting Egocentrism's formula (`9s at 1 stack` vs `base 3`) and
confirming the warning, then restoring.

Building that check surfaced an **undocumented convention** that had been carried
implicitly and is a genuine trap:

- **Hyperbolic** `base` is the *amplification input*, not the displayed value — Tougher
  Times stores `base: 15` and blocks **13.04%** at one stack. The divergence is the
  point of the type, so the audit deliberately skips hyperbolic entries.
- **Exponential / reciprocal / special** `base` is the *actual value at one stack*, which
  is often **not** the number in the game's description (Safer Spaces 15 → 13.5,
  Bandolier 18 → 20.4).

Both are now written into `schema.ts` at the field definition, where the requirement is
visible at the point of use rather than living in someone's memory. **42 / 212.**

### 3j.8 The linear block — triage tooling, and Brilliant Behemoth

153 entries were marked `linear` on the strength of "the description says +X (+X per
stack)". Reading all of them by hand is slow and error-prone, so
`scripts/scan-linear-coefficients.py` narrows the field: for each entry it derives the
literals the code would plausibly use for the recorded value (`20`, `20f`, `0.2f`) and
searches the item's implementation for that literal applied to the item's own count —
including the **second hop** through the local the count is stored in, which is what hid
Alien Head's `0.75f` and Corpsebloom's `0.1f`.

**113 unverified linear items triaged: 60 with a coefficient match in code, 53 needing a
manual read.** It reports candidates, never conclusions — the match still has to be read
in context, which is exactly how the one error in this batch surfaced.

First batch confirmed (all correct as recorded):

| Item | Code |
|---|---|
| Armor-Piercing Rounds | `num4 *= 1f + 0.2f * n` |
| AtG Missile Mk. 1 | `damageCoefficient = 3f * n` |
| Brainstalks | `AddTimedBuff(NoCooldowns, n * 4f)` |
| Brittle Crown | `n * 2f * Run.difficultyCoefficient` |
| Ceremonial Dagger | `1.5f * n` |
| Charged Perforator | `5f * n` |
| Bundle of Fireworks | `4 + n * 4` |
| Berzerker's Pauldron | `2f + 4f * n` |

Two of those carry a nuance the flat number hides, now recorded in their formulas:
**Brittle Crown**'s gold also multiplies by `Run.difficultyCoefficient`, so "2 gold" is
only the stage-1 value; **Bundle of Fireworks** is `4 + 4n`, i.e. 8 at one stack.

**Brilliant Behemoth was wrong.**

```csharp
float num = (1.5f + 2.5f * (float)itemCountEffective) * damageInfo.procCoefficient;
… BlastAttack { radius = num }
```

The description says "4m (+1.5m per stack)". The first number is right and the second is
not: the code adds **2.5m** per stack — 4 / 6.5 / 9m, where the description implies
4 / 5.5 / 7m. Corrected. The same line also shows the radius is multiplied by the
triggering attack's **proc coefficient**, so a 0.5-proc hit explodes at half size — a
dependency the dataset had no way to express and now states in the formula.

**51 / 212 code-verified.**

### 3j.9 Oddly-shaped Opal — the game contradicts itself

Reported as possibly wrong. It is not our error, and the investigation is worth keeping
because it identifies a class of problem no existing check covered.

The game ships **two** strings per item, and here they describe **different mechanics**:

| Token | Text |
|---|---|
| `ITEM_OUTOFCOMBATARMOR_PICKUP` | "Reduce damage the first time you are hit." |
| `ITEM_OUTOFCOMBATARMOR_DESC` | "Increase armor by 100 (+100 per stack) while out of danger." |

Our transcription of both is verbatim and correct — `data:diff` was right to pass. The
code settles which is true:

```csharp
// CharacterBody.RecalculateStats
armor += (HasBuff(DLC1Content.Buffs.OutOfCombatArmorBuff) ? (100f * (float)num51) : 0f);

// OutOfCombatArmorBehavior — the buff simply tracks outOfDanger
private void FixedUpdate() { SetProvidingBuff(body.outOfDanger); }
```

A persistent +100 armour per stack while out of danger. **The description is accurate;
the pickup line is stale legacy text** from an earlier version of the item.

Scanning all 212 items for pickup/description concept overlap found Opal as the one
genuine contradiction — the other low-overlap pairs are flavour text ("…and his music
was electric") or the same mechanic reworded ("Double the strength of healing" vs
"Heal +100% more"). So this is rare, but it is real, and it means the two strings must
not be presented as co-equal claims: `pickupText` is flavour/summary, `description` is
mechanical, and the code-verified layer outranks both (PLAN §6B.4).

**52 / 212 code-verified.**

### 3j.10 Whole-path extraction — verifying by mechanism instead of by item (§6B.1)

`scripts/extract-recalculate-stats.py` reads `CharacterBody.RecalculateStats` **once**
(933 lines) and extracts every item constant in it: 64 single-item locals, **41 items
with a stat contribution across 56 sites**. Diffed wholesale against `items.json`
instead of item-by-item.

Three passes: item→local (locals holding two different items are dropped, not
mis-attributed), local→coefficient→accumulator, and accumulator→stat by walking back
from the final `maxHealth = num78` / `attackSpeed = num109` assignments.

**Getting the accumulator→stat walk right took two corrections, both caught by a sanity
check against known assignments** — worth recording because a mislabelling tool is worse
than no tool:

- Propagating *forward* (an RHS stat leaking to an unrelated LHS) labelled `num110`, the
  attack-speed accumulator, as `maxHealth`. Backward-only fixed it.
- Following only `=` then lost the chain entirely, because attack speed is composed as
  `num109 *= num110`. Following `=`, `*=`, `/=` — while never labelling a known
  item-count local — gives 38/56 sites labelled with **zero** false labels.

**Result: 19 of 26 codex-matched items agreed on the first pass**, and all 7 flagged
turned out to be representation or attribution differences rather than errors:

- Laser Scope's `2f` is the *base* crit multiplier, not its own coefficient.
- Shaped Glass's `2`/`0.5` multipliers are our `100%`/`50%`.
- Hopoo Feather, Light Flux and Stone Flux add the count with no literal.
- Item Scrap Red/White's `0.3f`/`0.06f` belong to **`StatsFromScrap`** — a `NoTier`
  item with an unresolved name token, i.e. hidden internal content, correctly outside
  the codex. Our scrap entries having no stacking is right.

Eight langfile items were then confirmed and upgraded — Tri-Tip Dagger, Red Whip, Energy
Drink, Rose Buckler, Personal Shield Generator, Growth Nectar, Bolstering Lantern,
Kinetic Dampener — taking the total to **60 / 212**. That is **more items verified in one
pass than the previous several sessions combined**, which is the whole argument for
§6B.1.

**A third missing effect.** Kinetic Dampener's description states it "Grants a shield for
4% of your max health", and the dataset had no entry for it. The code confirms the shape
matters: `(n > 0) ? 0.04f * maxHealth : 0f` is **flat**, not per-stack, so a second copy
adds armour but no further shield. Added as a `none`-type entry. Purity, Elusive Antlers,
and now this: **missing effects are the most common defect class found so far**, and no
numeric diff can see them.

### 3j.11 Proc paths — the second mechanism sweep (§6B.1)

`scripts/extract-proc-paths.py` does for `GlobalEventManager` what §3j.10 did for
`RecalculateStats`: reads `ProcessHitEnemy` (824 lines), `OnCharacterDeath` (565) and
`OnHitAll` once and extracts every item constant — **33 items across 46 sites**. These
have no stat accumulators, so sites are classified by the *kind* of quantity instead
(chance / damage / duration / healing / count), which is what has to be checked.

**27 of 31 codex-matched items agreed.** Verified and upgraded: Topaz Brooch
(`AddBarrier(15f × n)`), Kjaro's Band (`3f × n`), Chronobauble (`AddTimedBuff(Slow60,
2f × n)`), Sticky Bomb (`LocalCheckRoll(5f × n × procCoefficient)`), plus Ukulele below.
**65 / 212.**

**Ukulele's chain range was off by one stack.** `LightningOrb.range` defaults to `20f`
and Ukulele does `range += 2 * n`, giving **22m at one stack**, not the 20 recorded. Its
target count is right (`bouncesRemaining = 2n` → `1 + 2n` targets = 3/5/7). This is the
same defect as Safer Spaces: the increment applies **from the first stack**, while the
description ("within 20m (+2m per stack)") reads as though one stack were the bare base.
That pattern has now produced three errors — Safer Spaces, Bandolier, this — and is
worth treating as a standing suspicion whenever a description reads "X (+Y per stack)".

**Two left open rather than guessed:**

- **Electric Boomerang.** `damage6 = characterBody.damage × 0.4f × n` is only a scalar
  handed to the projectile; the `StunAndPierceBoomerang` prefab carries *two* damage
  components (`damageCoefficient` 3.1 and 1.0). `0.4 × 3.1 = 124%` against a recorded
  120%, which is suggestive — but mapping those two components onto the described
  "impact" and "damage over time" is not something the evidence settles, so the record
  is unchanged and stays `langfile`.
- **Monster Tooth.** The healing (`fractionalHealing = 0.02f × n`) matches, but the same
  block computes `Mathf.Pow(n, 0.25f)` — an unrecorded term whose role is untraced.

**A near-miss worth recording.** An ad-hoc display script printed one item's sites under
another's heading, which looked exactly like a mis-attribution bug in the extractor. It
was the throwaway script, not the tool — but chasing it surfaced something real:
`itemCountEffective16` means **LightningStrikeOnHit** in `ProcessHitEnemy` and
**BleedOnHitAndExplode** in `OnCharacterDeath`. Scoping the local→item map per method,
rather than per file, is what keeps that from becoming a genuine false verification.

### 3j.12 Provenance for the reference datasets, and a coverage ratchet (§6B.2/§6B.3)

An audit of *every* data surface — not just items — found the gap: `items.json`,
`survivors.json` and `skills.json` all carried provenance, while the four reference
datasets carried **none at all** and displayed none.

| Surface | Records | Provenance before |
|---|---|---|
| `items.json` | 212 | per-record `confidence`, rendered |
| `survivors.json` | 19 | `confidence: asset` |
| `skills.json` | 125 procs | per-skill `verified` |
| **ARTIFACTS / DREAMS / SHRINES / LOADOUT_UNLOCKS** | **123** | **none** |

So a wiki-sourced Ambry code and a code-verified shrine mechanic rendered identically.

`src/data/provenance.ts` declares provenance **per (dataset, field)** rather than per
record, because within these datasets the sourcing genuinely is uniform — every artifact
effect came from the same token family. Copying it onto 123 records would be churn
without information. Each entry carries `tier`, a `ref` specific enough to re-check, and
an **`adequate`** flag: a description token is a fine source for quoted text and an
inadequate one for a mechanic, and that distinction is what drives the UI warning.

Rendered by `SourceNote` on all four tabs. Artifacts and Shrines correctly show a
"not yet verified" callout (artifact `effect` is description-as-mechanic, `code` is still
wiki-sourced; shrine `cost` is our own editorial summary), while Dreams and Loadout
Unlocks show none — the marker has to be absent somewhere or it carries no information.

**The ratchet.** `data:audit` now **fails** if the count of code/asset-verified items
drops below `src/data/coverage-floor.json`. Verified by downgrading two records and
confirming the error, then restoring:

```
✗ coverage regression: 63 items are code/asset-verified but the floor is 65.
```

This is the part that addresses *future* data rather than past: without it, an import or
refactor can silently downgrade records and nothing notices — which is precisely how 161
items came to be displayed with the same confidence as the verified ones.

### 3j.13 Behaviour-class sweep — the third mechanism path (§6B.5)

`scripts/extract-item-behaviours.py` covers the ~60 `BaseItemBodyBehavior` /
`CharacterBody.ItemBehavior` subclasses, where an item's own logic lives. This is where
Old War Stealthkit's `rechargeReductionMultiplierPerStack`, Faulty Conductor's
`durationStack` and Egocentrism's `secondsPerProjectile` were each found *individually*;
doing all of them at once is the point.

These classes are unusually safe to attribute — each declares its own item via
`[ItemDefAssociation] GetItemDef()`, so **the class is the item** and there is no
local-reuse ambiguity to guard against. 19 classes with 96 named constants.

All five unverified items with a constant match were confirmed correct and upgraded —
**70 / 212**:

| Item | Evidence |
|---|---|
| Queen's Gland | `int num = stack` — 1 Guard per stack; the 30s resummon is flat, not per-stack |
| Faraday Spur | `4f + 2.8f × (stack − 1)`; radius `0.2 × (charge − 1) + 5 + 7.5n` |
| Bustling Fungus | `baseHealFractionPerSecond 0.045` + `0.0225` per stack |
| Networked Suffering | `baseMaxTargets 4`, `stackMaxTargets 2` |
| Little Disciple | `body.damage × damageCoefficient(3) × stack` |

**Faraday Spur is the useful one, because I was wrong about it.** The constants read
`auraRadiusStartSize 5`, `maxRadiusGrowth 20`, `radiusGrowthPerStack 7.5`, which implies
`5 + 20 + 7.5 = 32.5` at one stack against a recorded **32.3** — so I expected another
correction. The formula is `auraRadiusPerCharge × (charge − 1f)`, and at the 100 charge
limit that is `0.2 × 99 = 19.8`, **not** 20. `19.8 + 5 + 7.5 = 32.3`, exactly as recorded.

That is worth recording as a caution in the other direction: **constants alone are not
the formula**. An off-by-one inside the expression moved the answer by 0.2m, and reading
only the named values — which is precisely what an automated matcher does — would have
produced a confident "correction" that broke correct data.

Bustling Fungus makes the same point more gently: its ward radius is
`body.radius + 1.5 + 1.5n`, and the recorded `3/1.5` is the **item's** contribution, with
the survivor's own hitbox added on top. Both records are right; both would look wrong to
a naive comparison.

### 3j.14 Prefab sweep — a low-yield path, recorded as such

`scripts/extract-item-prefabs.py` covers §6B.5 step 4: constants that live in assets
rather than code. Bundles are named after their item (`ror2-dlc2-items-speedboostpickup_*`
→ `SpeedBoostPickup`), giving a clean prefab→item mapping with no guessing. 81 item
bundles scanned, 42 items with serialized constants.

**It produced zero upgrades, and that is the finding.**

The first pass matched eight items, all falsely: item bundles are overwhelmingly *visual*
assets, so excluding known Unity noise still let hundreds of rendering fields through and
`vfxPriority: 2`, `boldSpacing: 7` and `curveInterpolation: 4` collided with recorded
values by coincidence. Inverting the filter — requiring a *tuning* vocabulary
(`damage|duration|radius|chance|stack|cooldown|…`) minus presentation words — cut 435
fields to 118 and removed every false match.

What remains is genuine but almost entirely **effect** tuning: VFX durations of 0.2s,
particle radii of 30–70. None of it is the per-stack arithmetic the codex records.

The conclusion is worth stating plainly: **an item's bundle is not where its tuning
constants live.** The two prefab findings that mattered came from elsewhere —
Elusive Antlers' barrier from a *pickup* component (`ElusiveAntlersPickup`), and Shrine
of Blood's escalation from a *shrine* prefab, neither of which is an `items-*` bundle.
Electric Boomerang makes the point exactly: its item bundle holds `radius`, `travelSpeed`
and `distanceMultiplier`, while the damage coefficients that would settle its open
question sit in `StunAndPierceBoomerang` under the **Projectiles** bundle.

So the next step for asset-backed constants is **following `projectilePrefab` and
component references from the code**, not scanning bundles by name. The tool is kept
because that traversal will reuse its extraction, and because a documented negative
result stops the same ground being re-covered later.

### 3j.15 Why the remaining 139 are unverified — measured, not assumed

"Unverified" had been carrying two very different meanings, and the distinction matters
because only one of them is a limit on what is *knowable*. Classifying every unverified
item by **cause** rather than by item:

```
   8  no code site at all
  74  a code site exists, but no numeric literal near it
  46  sits in a path already swept, not yet read line-by-line
  12  has code sites in a path not yet swept
```

The 74-item bucket looked like the hard one. It is not. It is an artefact of how
`extract-item-code.py` works: it records where an item's **count is read**, and takes a
few lines of context. But RoR2 reads all item counts in one block near the top of a
method and uses them hundreds of lines later, so the literal is routinely outside the
window. Four probes, four resolutions:

| Item | Count read | Value used | Result |
| --- | --- | --- | --- |
| Backup Magazine | `CharacterBody.cs:4128` | `:4775` | `SetBonusStockFromBody(n + extraSecondaryFromSkill)` — +1/stack, **no literal anywhere** |
| Cautious Slug | `:4112` | `:4328` | `(outOfDanger ? 3n : 0) x (1 + 0.2(level-1))` |
| Repulsion Armor Plate | `HealthComponent.cs:257` | `:1390` | `max(1, damage - 5n)`, applied **after** armor |
| Gasoline | — | — | not in `GlobalEventManager`; genuinely elsewhere |

All three recorded values were already correct, and each gained a fact its description
omits: Cautious Slug's 3 hp/s is *item* regen and therefore scales with level (the
description's "base health regeneration" wording is loose — it is not added to
`baseRegen`); Repulsion Armor Plate subtracts after the armor multiplier, so the order
matters at high armor, and its 1-damage floor is a real clamp. Backup Magazine is the
instructive case: **+1 per stack carried entirely by variable arithmetic**, so no
literal-hunting tool of any design would ever have found it.

Upgraded to `code`: Backup Magazine, Cautious Slug, Repulsion Armor Plate. **73/212.**

The correction to the method: an extractor must **follow the count variable to its use
site**, not report the read site. That is a def-use trace over the decompiled locals —
the same backward-propagation discipline §3j.7 already needed for `RecalculateStats` —
and it is what the next sweep should build, ahead of the projectile-reference work.

The honest bottom line: of 139 unverified items, roughly **131 are limited by the reach
of my tooling, not by the data being unknowable.** Only the 8 with no code site need a
different source entirely. That is a much better position than "139 unknown", and it is
also a reason not to describe the remaining gap as inherent.

### 3j.16 The def-use tracer, and the first batch it unlocked (§6B.6)

`scripts/extract-item-defuse.py` implements the correction from §3j.15: instead of
reporting where an item's count is *read*, it follows that local forward to every line
where the value participates in arithmetic, then follows aliases up to three hops.

Two details are what make it correct rather than merely plausible:

- **Scope comes from the declaration, not the assignment.** The first version got this
  wrong and found nothing for two of its three test items. In `RecalculateStats` every
  count is declared once at the top (`int num21 = 0;`) and assigned much later inside
  `if (inventory) { … }`; bounding the walk by the *assignment's* block stops it at the
  end of that if-block, hundreds of lines before the value is used. Bounding by the
  declaration's block gives the real lifetime — and still cannot leak across methods,
  which is the failure §3j.7 had to fix.
- **It does not require a numeric literal.** Arithmetic *participation* is the signal.

Validated against the three items traced by hand in §3j.15 before being trusted: it
reproduces all three at exactly +647, +216 and +1133 lines. Across the corpus it finds
**408 use sites for 133 items, 186 of them more than 12 lines from the count read** —
i.e. invisible to the previous extractor by construction.

**16 items verified from the first review pass, all matching what was already recorded:**

| Item | Code |
| --- | --- |
| Monster Tooth | `flatHealing 8f`, `fractionalHealing = 0.02f * n` |
| Medkit | `Heal(20f + maxHealth * 0.05f * n)` |
| Warbanner | `Networkradius = 8f + 8f * n` |
| War Horn | `AddTimedBuff(Energized, 8 + 4 * (n - 1))` |
| Razorwire | `5 + 2(n-1)` targets, `25f + 10f(n-1)` radius |
| Will-o'-the-wisp | `3.5f * (1f + (n-1) * 0.8f)`, radius `12f + 2.4f(n-1)` |
| Runald's Band | `2.5f * n` damage, `Slow80` for `3f * n` |
| Death Mark | `7f * n`, gated `if (num >= 4)` debuffs |
| Infusion | `maxHpValue = n`, cap `n * 100` |
| Delicate Watch | `damage *= 1f + n * 0.2f` |
| Focus Crystal | same, gated `sqrMagnitude <= 169f` |
| Squid Polyp | `10 * (n-1)` BoostAttackSpeed items, `+0.1f` each |
| Hunter's Harpoon | `1f + (n-1) * 0.5f` |
| Ignition Tank | `1 + 3 * n` on damageMultiplier and totalDamage |
| Happiest Mask | `TryToCreateGhost(…, n * 30)` |
| Rejuvenation Rack | `amount *= 1f + n` |

**73 -> 89 of 212.** Three of these also resolved or added a fact:

- **Monster Tooth's open question is closed.** The `Mathf.Pow(n, 0.25f)` sitting beside
  its heal is the orb's `transform.localScale` — a visual size curve, not a healing one.
  It had been flagged as possibly meaning the heal scaled with a fourth root. It does not.
- **Ignition Tank**: the Oiled debuff (DLC2) counts as an extra stack *and* triggers the
  burn upgrade at **zero** Ignition Tanks (`if (itemCountEffective > 0 || flag)`). Neither
  appears in the description.
- **Focus Crystal**: `169f` confirms the 13m range exactly (compared squared, no sqrt).

**Not upgraded — Wax Quail.** Its trace is
`Mathf.Sqrt(10f * n / (acceleration * airControl))`, used as a *velocity* multiplier on
the jump, not a distance. The `10f * n` strongly suggests the description's "10m per
stack" is the designed input, but the conversion from that velocity to a travelled
distance depends on the air-drag model and I could not derive it from this snippet. The
claim may well be right; it is not *verified*, so it stays `langfile`. Recording it as an
open question rather than rounding up to a graduation is the point of the exercise —
the tracer's job is to produce evidence, not to convert reach into confidence.

### 3j.17 Def-use batch 2 — 14 more items, and a fourth instance of the same defect

| Item | Code | Result |
| --- | --- | --- |
| Shattering Justice | `AddTimedBuff(Pulverized, 8f * n)` | confirmed |
| Aegis | `overheal x (n * 0.5f)` | confirmed |
| Pocket I.C.B.M. | `Mathf.Max(1f, 1f + 0.5f * (n-1))` | confirmed |
| Shatterspleen | `4f * (1 + (n-1))`, `0.15f * (1 + (n-1))` of max HP | confirmed |
| Molten Perforator | `3f * n` | confirmed |
| Planula | `Heal(n * 15f)` | confirmed |
| Needletick | `procCoefficient * n * 10f` | confirmed |
| Polylute | `totalStrikes = 3 * n` | confirmed |
| Singularity Band | `1f * n` | confirmed |
| Benthic Bloom | `n * 3` | confirmed |
| **Sonorous Whispers** | `LocalCheckRoll(4f + 1f * n)` | **CORRECTED 4% -> 5%** |
| Noxious Thorn | `targets = n`, radius `20f + 5f(n-1)` | confirmed |
| Breaching Fin | `SetBuffCount(KnockUpHitEnemies, 2 + (n-1))` | confirmed |
| Defiant Gouge | `40f * entryDifficultyCoefficient * n` | confirmed |

**89 -> 103 of 212.**

**Sonorous Whispers is the fourth instance of defect class (d)** — the increment applying
from the first stack while the description reads as though it does not. The roll is
`4f + 1f * n` inside a `count > 0` guard, so one stack is **5%**, not 4%; two is 6%. The
description states the constant, not the value you get. Bandolier, Ukulele and Safer
Spaces were the same shape. Four independent occurrences is no longer a coincidence:
**`base` should be treated as suspect whenever a description reads `X (+Y per stack)` and
the code is `X + Y*n` rather than `X + Y*(n-1)`.** Both forms are common — Warbanner is
`8f + 8f * n` (16m at one stack, description agrees), Razorwire is `5 + 2*(n-1)`
(description agrees) — so the only way to know is to read the expression.

Two undocumented facts also surfaced:

- **Needletick**: the Void elite buff adds **10 to the effective stack count**
  (`n += HasBuff(EliteVoid) ? 10 : 0`), which is why Void elites collapse so reliably.
- **Pocket I.C.B.M.**: the extra missiles are `(n <= 0) ? 1 : 3` — a flat +2 that does
  **not** scale with stacks, while only the damage multiplier does. The description's
  odd-looking "+0%" base is literally correct.

### 3j.18 Def-use batch 3 — Frost Relic was wrong in both directions

| Item | Code | Result |
| --- | --- | --- |
| Leeching Seed | `Heal(n * procCoefficient)` | confirmed + proc scaling |
| Symbiotic Scorpion | `for j<n` stacks, `armor -= buffCount * 2f` | confirmed |
| Soulbound Catalyst | `DeductActiveEquipmentCooldown(2f + n * 2f)` | confirmed |
| Wake of Vultures | `duration = 3f + 5f * n` | confirmed |
| Hardlight Afterburner | `SetBonusStockFromBody(n * 2)` | confirmed |
| **Frost Relic** | see below | **CORRECTED, restructured** |

**103 -> 109 of 212.**

**Frost Relic** recorded a max storm radius of "18m (+12m per stack)". Neither number is
right, and this one could not be caught by comparing against a literal because the real
value is assembled from four constants in a different class:

```
maxIcicleCount = baseIcicleMax + (n-1) * icicleMaxPerStack   = 6 + 3(n-1)
radius         = characterBody.radius + icicleBaseRadius(10f) + icicleRadiusPerIcicle(2f) * icicles
```

At the cap that is **22m + the survivor's collider radius, and +6m per stack** — three
extra icicles at 2m each, not the 12m claimed. The description's "grows the radius by 2m"
is the one part that was exactly right.

The record is now split into `Max icicles` (6, +3 — exact and character-independent) and
`Max storm radius (m)` (22, +6). The listed radius deliberately **excludes** the collider
term: `characterBody.radius` is read from each body's CapsuleCollider (`radius = 1f` then
overridden, CharacterBody:3454), so it genuinely differs per survivor and there is no one
true number. Stating 22 and naming the missing term is honest; inventing 22.5 by assuming
a hull would not be — `HullDef` exists with radii 0.5/1.8/5, but it is not what feeds this
field, and asserting otherwise would have been exactly the kind of plausible-sounding
value this programme exists to prevent.

Two undocumented proc-coefficient dependencies also surfaced, both of which make the item
weaker than its description implies:

- **Leeching Seed** heals `n x procCoefficient`, so a 0-proc hit heals nothing.
- **Symbiotic Scorpion** rolls `100f * procCoefficient` per stack, so despite "100% chance
  on hit" a low-proc hit applies fewer than n stacks.

### 3j.19 Wax Quail — 10m is 5m. Retracting "unverifiable".

§3j.16 left this item at `langfile` on the grounds that converting its velocity term into
a distance "needs the air-drag model, which this snippet does not give". That reasoning
was wrong: the air-drag model is `CharacterMotor.PreMove`, which is in the same
decompile. Nothing was missing except the effort to go and read it.

Having read it, the item's recorded value is **wrong by a factor of two**.

```
GenericCharacterMain:199   a  = acceleration * airControl (0.25f)
                           n2 = Mathf.Sqrt(10f * n / a)
                           n3 = moveSpeed / a
                           horizontalBonus = (n2 + n3) / n3
ApplyJumpVelocity          velocity.xz = moveDirection * moveSpeed * horizontalBonus
CharacterMotor.PreMove     target = moveDirection * walkSpeed ; target.y = velocity.y
                           velocity = MoveTowards(velocity, target, a * deltaTime)
```

Launch speed is `moveSpeed + a*sqrt(10n/a)` = `moveSpeed + sqrt(10na)`, i.e. an excess of
`sqrt(10na)` over the target the motor immediately starts pulling back to. `MoveTowards`
bleeds that off at exactly `a` m/s^2 — constant deceleration — so the extra ground covered
is

    excess^2 / (2a)  =  10na / (2a)  =  **5n metres**

independent of both `moveSpeed` and `acceleration`. The "10" in the description is the
literal inside the square root, not a distance. `disableAirControlUntilCollision` would
zero the decay, but it is set only by specific leap/knockback states and never by a normal
jump, and `Items.JumpBoost` has exactly one reference in the whole assembly, so there is no
second path.

Confirmed by replaying the motor loop at 60 Hz rather than trusting the algebra —
`scripts/verify-wax-quail.mjs`, kept in the repo precisely because this claim contradicts
the game's own text and therefore has to be checkable by someone else. It reproduces
+4.88m at one stack against a predicted 5m, and shows the delta is unchanged at sprint
speed, as the derivation requires.

**Corrected: base 10 -> 5, perStack 10 -> 5.** One genuine caveat is now recorded with it:
the boost needs `sqrt(10n/a)` seconds to bleed off against a 1.0s standard jump
(jumpPower 15, gravity -30), so low-acceleration survivors land early and get less —
MUL-T (`a` = 7.5) gains 15.4m at five stacks where Commando gains 21.3m.

The general lesson, and it applies to the whole remaining backlog: **"I cannot derive it
from this snippet" is a statement about how far I read, not about what is knowable.** The
decompile contains the whole engine. An item is only genuinely unverifiable when the
information is absent from every source, which is far rarer than my first pass assumed.

### 3j.20 Def-use batch 4 — Plasma Shrimp corrected, and a tracer bug that could have caused a FALSE verification

| Item | Code | Result |
| --- | --- | --- |
| Gasoline | `8f + 4f*n + victimBody.radius`; burn `(1+n) * 0.75f * damage` | confirmed |
| Roll of Pennies | `(n * 3) * difficultyCoefficient` | confirmed |
| Eclipse Lite | `maxHealth * (0.01f + 0.0025f*(n-1)) * baseRechargeInterval` | confirmed |
| **Plasma Shrimp** | `damageCoefficient = 0.4f * n` | **CORRECTED +50% -> +40%** |
| Voidsent Flame | `2.6f * (1f + (n-1) * 0.6f)`, radius `12f + 2.4f(n-1)` | confirmed |
| Lysate Cell | `SetBonusStockFromBody(n + extraSpecialFromSkill)` | confirmed + new effect |

**110 -> 116 of 212.**

**Plasma Shrimp** is `0.4f * n` — 40%, 80%, 120%. Both our data and the in-game
description claimed +50% per stack. The code is unambiguous, and unlike Sonorous Whispers
this is not an off-by-one in the base: the *increment itself* was wrong.

**Lysate Cell raises Engineer's turret limit from 2 to 3** —
`CharacterMaster.GetDeployableSameSlotLimit`, `DeployableSlot.EngiTurret`:
`(GetItemCountEffective(EquipmentMagazineVoid) <= 0) ? 2 : 3`. Any single stack does it and
further stacks do nothing, so it is recorded as a `special` entry. It is in neither the
description nor our data, and it is **not** shared with Fuel Cell, which Lysate Cell
corrupts — Fuel Cell has no deployable-limit entry at all.

**Gasoline** turned out to have an undocumented term too: the ignite radius is
`8f + 4f*n + victimBody.radius`, so the burst is genuinely larger around big enemies. The
150% impact blast is a fixed `damage * 1.5f` and does not stack; only the burn does.

#### The tracer bug

Finding Lysate Cell's turret effect also exposed a real defect in the tracer. Its count is
read into `result` inside `case DeployableSlot.EngiTurret:`, and `result` is reassigned in
a dozen **unrelated** cases below — Beetle Gland, Incubator, Lunar Sun. Brace depth does
not separate switch cases, so the walk happily reported *other items' code* under Lysate
Cell's name.

That is the most dangerous class of failure this programme can have: not a missing
verification, but a **false** one. Had I trusted the trace instead of reading the lines,
Lysate Cell would now claim Beetle Gland's formula with a `code` badge on it.

Fixed by stopping the walk at `break;` / `case` / `default:` / `goto` at or below the
read's own depth. Corpus-wide this removed 13 use sites (408 -> 395) — all of them false.
The lesson is the one already written into these extractors' docstrings and now paid for:
**a tracer produces evidence, not verdicts, and every line still gets read by a human.**

### 3j.21 Def-use batch 5 — six confirmed, plus an undocumented Prayer Beads stat

| Item | Code | Result |
| --- | --- | --- |
| N'kuhana's Opinion | `Min(pool + heal * n, fullCombinedHealth)` | confirmed |
| Prayer Beads | `levels * levelStat * (0.2f + 0.05f*(n-1))` | confirmed + extra stat |
| Chronic Expansion | `stacks * (0.035f + 0.01f*(n-1))`, cap `(int)(10f + (n-1)*5f)` | confirmed |
| Luminous Shot | cap `4 + n`; damage `1.75f + (n-1)*0.5f` | confirmed |
| Warped Echo | `hits = 2 + n`, stored damage `num5 * 0.9f` | confirmed |
| Chance Doll | `Util.CheckRoll(30 + n * 10)` | confirmed |

**116 -> 122 of 212.**

**Prayer Beads grants shield as well.** `CalculateAppliedBeadStats` is called four times —
`levelMaxHealth`, **`levelMaxShield`**, `levelRegen`, `levelDamage` — while the description
lists only "health, regeneration, and damage". The 20% / +5% figures are exactly right.

Its XP path has a curiosity worth noting even though we publish no XP claim: the bonus
experience is `amount * (ulong)(0.25f * (n - 1))`, and the **cast to `ulong` truncates**,
so the multiplier is a step function — 0 extra at one *and* two stacks, and only from five
stacks does it reach 1. Nothing is recorded about it because we make no claim there, but
it is flagged here so a future reader does not "discover" it and record 25% per stack.

**N'kuhana's Opinion** stores healing uncapped per-hit but the pool itself is clamped to
`fullCombinedHealth`. **Warped Echo** splits `damage * 0.9f` evenly and marks only
`k == hits - 1` lethal, matching its description exactly; if the reduced damage is smaller
than the hit count the count is lowered so no hit is fractional.

#### Tracer: inline reads

Chronic Expansion's stack cap is
`return (int)(10f + (GetItemCountEffective(X) - 1) * 5f);` — a count read used inline, with
no local to follow. The tracer only recognised reads that were *assigned* to something, so
it missed this entirely and the cap had to be found by hand. Reads that participate in
arithmetic on their own line are now emitted directly, taking the corpus from 133 traced
items to **143**.

### 3j.22 Def-use batch 6 — four undocumented caps, and a party-wide effect

| Item | Code | Result |
| --- | --- | --- |
| Runic Lens | `3f + overspill * (3f + 3f(n-1))`; `20f + overspill * (1.5f + 0.5f(n-1))` | confirmed + 2 caps |
| Hooks of Heresy | `3f * n` root; `n * baseRechargeInterval` x asset `= 5` | confirmed |
| Longstanding Solitude | `i < n && i < 3`; `1f + partyCount * 0.5f` | confirmed + party-wide |
| Eulogy Zero | `rng < 0.05f * n` | confirmed |
| Functional Coupler | inventory array grown by the count | confirmed |
| Empathy Cores | `damageMultiplier += (allies) * n * 1f` | confirmed |

**122 -> 128 of 212.** Every recorded number was right; what was missing were limits.

**Runic Lens has two hard caps, neither documented.** The activation chance is clamped to
**75%** (`meteorChanceThreshold`) and the damage multiplier to **75x** — so the meteor can
never exceed 7500% base damage no matter how much overspill feeds it. The blast also has
`procCoefficient = 0.5` and a 10m radius. For an item whose entire design is "the harder
you hit, the bigger the meteor", a ceiling on both halves is exactly the kind of fact a
player needs and the description withholds.

**Longstanding Solitude's cost increase is party-wide.**
`GetLongstandingSolitudeItemCostScale = 1f + LongstandingSolitudesInParty() * 0.5f`, and
`LongstandingSolitudesInParty` sums the item across **every player on the team**. The
+50%/stack figure is right, but it applies to *everyone*, driven by *everyone's* stacks —
so one player taking three of these raises the whole lobby's prices by 150%. Its free
purchases are separately capped at 3 (`i < n && i < 3`), which our `capStacks` already had,
and the gold-to-experience conversion caps at 8 effective stacks.

Finding this is also a small process lesson. The cost code lives in `TeamManager`, and my
first sweep grep for `OnLevelUpFreeUnlock` "found nothing", because I read the hits and
skipped the one that mattered — the def-use trace had surfaced `TeamManager:367` all along.
The evidence was correct; I was the bottleneck.

#### Hooks of Heresy — the first claim settled by code AND asset together

`LunarSecondaryReplacementSkill.GetRechargeInterval` returns
`GetItemCountEffective(LunarSecondaryReplacement) * baseRechargeInterval`. The code proves
the shape (`n x interval`) and nothing else; the constant is a serialized field on the
SkillDef. New extractor `scripts/extract-skilldefs.py` pulls those (483 SkillDefs), giving
`LunarSecondaryReplacement.baseRechargeInterval = 5` — hence 5s, +5s per stack. This is
§5.0.2 exactly: neither source alone was sufficient.

The extractor repeated a mistake already solved once: Unity ships
`baseRechargeInterval: Infinity` for skills that never recharge, which `json.dump` writes
as bare `Infinity` — valid Python, invalid JSON. `extract-item-prefabs.py` had already been
fixed for this and the guard should have been carried over.

### 3j.23 Def-use batch 7 — proving that scrap does nothing, and a whole class of constants that live only in assets

| Item | Source | Result |
| --- | --- | --- |
| Lepton Daisy | team-summed `TPHealingNova` count = pulse count | confirmed, team-wide |
| Shipping Request Form | `0.79`, `0.20n`, `0.01n^2` weights | confirmed, quadratic |
| Collector's Compulsion | `return 3 + 2 * (n - 1)` | confirmed |
| Resonance Disc | `damage * n` x asset coefficients `3.0` / `10.0` | confirmed |
| Bottled Chaos | `for (i = 0; i < n; i++)` | confirmed |
| Item Scrap x4 + Regenerating Scrap | see below | **proved inert** |

**128 -> 138 of 212.**

#### Proving a negative

The five scrap items make no numeric claim — their claim is that they do *nothing*. That
is verifiable, and the def-use trace is what makes it so. All four scrap counts are read in
`RecalculateStats`, and every single use is multiplied by `num61`:

```
num98 += (float)(num61 * num62) * 0.06f;      // white
num95  = (float)(num61 * num63) * 3f * num85; // green + Regenerating
num110 += (float)(num61 * num64) * 0.3f;      // red
for (int m = 0; m < num65 * num61; m++)       // yellow
```

`num61` is `DLC3Content.Items.StatsFromScrap`, which is `NoTier`, has **no English language
entry at all** (`ITEM_STATSFROMSCRAP_NAME` is unresolved), and therefore cannot drop. With
`num61 == 0` every one of those terms is zero. Scrap is inert **because of an unreleased
item**, not because the game never mentions it — which is a much stronger statement than
"we found no code", and it is exactly the kind of claim that a grep-for-literals approach
can never make.

**Regenerating Scrap** is fully confirmed on all three of its claims:
`OnServerStageBegin -> TryRegenerateScrap()` transforms `RegeneratingScrapConsumed` back
(the stage-start regeneration); `CostTypeCatalog` swaps it to the Consumed variant instead
of destroying it; and its printer priority is real — the payment code drains three weighted
buckets in order, **`PriorityScrap` -> `Scrap` -> everything else**, and `extract-itemdefs.py`
now extracts tags, confirming Regenerating Scrap holds `PriorityScrap` while the four plain
scraps hold `Scrap`. Previously the *mechanism* was verifiable but its application to this
specific item was not; tags close that gap.

#### `scripts/extract-state-fields.py` — constants with no value in the C#

Resonance Disc looked unverifiable for a bad reason. `FireMainBeamState` declares

```csharp
public static float mainBeamDamageCoefficient;   // no initialiser, anywhere
```

and the value is injected at runtime from an `EntityStateConfiguration` asset. Grepping the
decompile finds only the declaration — the number does not exist in the code at all. This is
the same shape as Hooks of Heresy (§3j.22) and it is not rare: the new extractor finds
**1,109 state types carrying 5,042 numeric fields.** `extract-procs.py` had been reading
exactly one of them (`procCoefficient`) for months.

For Resonance Disc it gives `mainBeamDamageCoefficient = 3.0` and
`secondBombDamageCoefficient = 10.0` against `GetDamage() = ownerBody.damage * n`, so
300%/+300% and 1000%/+1000% are both exact — and `killChargesRequired = 4`,
`killChargeDuration = 7` confirm "4 enemies in 7 seconds" from the same asset.

**Shipping Request Form** turned out more interesting than recorded: the rarity weights are
`0.79`, `0.20n`, `0.01n^2`, summed across **all players**. Red scales quadratically and
white not at all, so the split runs 79/20/1 -> 64.2/32.5/3.3 -> 53.4/40.5/6.1. The
description's "increases rarity chances per stack" undersells a quadratic term.

Also team-wide, and undocumented as such: **Lepton Daisy** (pulse count summed over the
team) and **Eulogy Zero** (§3j.22, global item count).

### 3j.24 Equipment — a whole class the item tracer structurally could not see, and false data found

61 items had "no code site at all", and **31 of them are equipment**. That was never a
property of the data: the def-use tracer keys on `GetItemCountEffective`, and equipment
does not stack, so it never appears in that read. Equipment lives behind a separate
dispatch in `EquipmentSlot`:

```csharp
if (equipmentDef == RoR2Content.Equipment.Meteor) { func = FireMeteor; }
...
private bool FireMeteor() { ... }
```

which is as explicit as the `[ItemDefAssociation]` attribute that made the behaviour-class
sweep reliable. `scripts/extract-equipment-code.py` reads that dispatch table and extracts
each handler body: **38 equipment dispatched, 37 handler bodies located.**

#### The cooldown was published from prose and nothing checked it

Every equipment record states "Cooldown: Ns." inside its `description`. `EquipmentDef`
carries the real value — and `extract-itemdefs.py` was already reading `cooldown` **to
identify** an EquipmentDef and then throwing it away. Keeping it and cross-checking all 43
found one outright falsehood:

> **Seed of Life** published "Cooldown: 60s." Its `EquipmentDef.cooldown` is **0**, it is
> consumed on use, and its in-game description mentions no cooldown at all. The number was
> not in any game file — it came from prose.

Corrected by deleting the sentence. Ten more equipment had a real cooldown their
description never stated, now added from the asset: the nine elite Aspects (10s or 25s)
and The Crowdfunder (5s).

`cooldown` is now a **first-class schema field**, not a phrase, and `data:audit` fails the
build if the field and the sentence disagree — in either direction, including "states a
cooldown when the asset says 0". A claim nothing can check is a claim that will eventually
be wrong.

Two smaller things worth recording because both have now bitten twice:

- **Name joins keep re-introducing the Faulty Conductor collision.** It is a Boss item
  (`ShockDamageAura`) *and* a drone-only equipment (`DroneShockDamage`, `canDrop:false`,
  60s). `extract-item-code.py` was fixed for this months ago; my first cross-check script
  joined on display name and cheerfully attributed the drone's cooldown to the boss item.
  The join is now on `cachedName`.
- **Float32.** `Executive Card` deserializes 0.1s as `0.10000000149011612`. Stored values
  are rounded to 4dp and the audit compares with tolerance rather than equality.

The one remaining warning is honest: **Fuel Array** has a 60s cooldown the description does
not state. It is a single-use objective item that kills you, so the cooldown is arguably
meaningless — but rather than decide that silently, the audit says so out loud.

### 3j.25 Equipment batch 1 — 12 verified, and Spinel Tonic's downside was understated

**138 -> 150 of 212.** Ten equipment matched their descriptions exactly:

| Equipment | Evidence |
| --- | --- |
| Jade Elephant | `AddTimedBuff(ElephantArmorBoost, 5f)`; `armor += 500f` |
| Ocular HUD | `AddTimedBuff(FullCrit, 8f)`; `crit += 100f` |
| Foreign Fruit | `HealFraction(0.5f)` |
| Super Massive Leech | `AddTimedBuff(LifeSteal, 8f)`; heal `= damage * 0.2f` |
| Royal Capacitor | `damageValue = characterBody.damage * 30f` |
| Gorag's Opus | `TeamWarCry 7f` on self and every team member; `moveSpeed += 0.5f`, `attackSpeed += 1f` |
| Eccentric Vase | `maxDistance = 1000f`; `DestroyOnTimer.duration = 30f` |
| The Back-up | `sliceCount = 4`; lifetime `25f` |
| Disposable Missile Launcher | `remainingMissiles += 12` |
| Helfire Tincture | `AddHelfireDuration(12f)` |

Two needed rewriting.

**Spinel Tonic** — the buff was right on all six stats (`maxHealth *= 1.5f`,
`attackSpeed *= 1.7f`, `moveSpeed *= 1.3f`, `armor += 20f`, `damage *= 2f`,
`regen *= 4f`) and `tonicBuffDuration = 20f`. It also does `maxShield *= 1.5f`, which the
description omitted. The **downside was materially understated**:

```csharp
if (num27 > 0 && !flag2)                    // TonicAffliction count, and NOT tonic-buffed
{
    float num125 = Mathf.Pow(0.95f, num27);
    attackSpeed *= num125; moveSpeed *= num125; damage *= num125; regen *= num125;
    cursePenalty += 0.1f * (float)num27;
}
```

Three corrections in one block. It is **`0.95^n`, compounding**, not "-5% per stack". It hits
**four** stats, not "all stats" — armor and health are untouched by that multiplier. And
there is an entirely undocumented **10% curse per stack**, which lowers maximum health.
Offsetting that, the Affliction is **suspended while a Tonic buff is active** (`!flag2`), so
chain-drinking hides the penalty — also unmentioned anywhere. An item whose whole decision
is "is the downside worth it" was describing that downside wrongly in both directions.

**Deus Ex Machina** said "briefly enter a countering stance". The window is
`AddTimedBuff(Parrying, 0.5f)` — half a second, which is the entire skill-expression of the
item and worth stating. Its other two claims check out exactly:
`DeductActiveEquipmentCooldown(equipmentDef.cooldown * 0.75f)` and `AddBuff(SureProc)`.

### 3j.26 Correcting my own error: an asset value is not automatically a true claim

§3j.24 added asset cooldowns to ten equipment whose descriptions omitted one. For nine of
them — the elite Aspects — that was **wrong**, and it produced descriptions that
contradicted themselves in a single breath:

> "Gain Blazing Elite powers… **Passive (no cooldown). Cooldown: 10s.**"

The original text was right and I overrode it with a number from the asset.

```csharp
// EquipmentSlot.PerformEquipmentAction
return func?.Invoke() ?? false;

// caller, EquipmentSlot:462
if (equipment.charges > 0 && subcooldownTimer <= 0f && PerformEquipmentAction(equipmentDef))
{
    OnEquipmentExecuted(...);   // spends the charge and starts the cooldown
}
```

All nine Aspects have **zero references anywhere in `EquipmentSlot`**, so `func` is null,
`PerformEquipmentAction` returns false, `OnEquipmentExecuted` never runs, and the cooldown
never starts. The `EquipmentDef.cooldown` of 10 or 25 is real *as a field* and inert *as
behaviour*. Aurelionite's Blessing is the one Aspect that does have a handler
(`FireAurelioniteSpike`), and its 25s is genuine.

Reverted on all nine, and a new schema field `activated` records the distinction, with
`data:audit` failing the build if passive equipment states a cooldown. I verified the rule
by reintroducing the bad text and watching it fail, rather than assuming it worked.

The lesson is worth more than the fix. My standing rule has been "prefer the asset over the
prose", and it produced a falsehood here because **the asset answers a different question
than the description does**. `cooldown` is what the field is called; "how long until you can
use this again" is what a reader takes it to mean, and those coincide only when the
equipment can be used at all. §5.0.1 already says a description proves what the game *says*,
not what it *does* — this is the mirror image, and it now sits beside it: **a serialized
value proves what the game stores, not what the player experiences.** Provenance is
necessary for a claim to be true; it is not sufficient.

`The Crowdfunder`, `Executive Card` and `Fuel Array` also lack a dispatch handler but are
genuinely activatable — Crowdfunder runs through `UpdateGoldGat()`, a continuous-fire path
rather than a one-shot handler. "No handler" was therefore not usable as an automatic test
for passivity, and `activated` is set from evidence per item rather than derived, precisely
because the cheap heuristic would have mislabelled those three.

### 3j.27 Elite Aspects batch 1 — Shared Design's shield was badly wrong

**150 -> 154 of 212.**

**Ifrit's Distinction** was exact: `totalDamage = damageInfo.damage * 0.5f` for the burn,
and `itemAvailability.hasFireTrail = HasBuff(AffixRed)` for the trail.

**Shared Design (Perfected)** said "+25% max health converted to shields". The code is

```csharp
bool num74 = num15 > 0 || HasBuff(RoR2Content.Buffs.AffixLunar);   // num15 = Transcendence
if (num74) {
    num81 += maxHealth * (1.5f + (float)(num15 - 1) * 0.25f);
    maxHealth = 1f;
}
```

The Aspect enters **Transcendence's own code path**. With no Transcendence, `num15` is 0, so
the multiplier is `1.5 + (0-1) * 0.25 = 1.25` and `maxHealth` is set to **1**. So *all* of
your health becomes a regenerating shield worth **125%** of it — not "25% of max health
converted". Someone read the 1.25 as "+25%" and wrote a sentence that describes a partial
conversion of a quarter of your health, which is a completely different item. Its other
three claims are exact: `Cripple` for 3s, `num = 4` missiles on a `>= 10f` recharge at
`damage * 0.3f` each, `moveSpeed += 0.3f` — plus the undocumented restriction that the
bombs only fire **while in combat** (`!outOfCombat`).

**Her Biting Embrace** was right but thin. The slow is
`AddTimedBuff(Slow80, 1.5f * damageInfo.procCoefficient * n)`, so the *duration* scales with
proc coefficient — a weak hit slows for proportionally less, which changes how the Aspect
plays on multi-hit weapons and was nowhere in the text. The death blast radius is
`12f + victimBody.radius`.

**Silence Between Two Strikes** was qualitative ("your attacks explode after a delay"); the
stake is a flat `damageCoefficient = 0.5f`, so 50% TOTAL damage, now stated. Its shield
claim was exactly right — `num82 = maxHealth * 0.5f; maxHealth -= num82; shield += maxHealth`.

Five Aspects remain (Spectral Circlet, His Spiteful Boon, N'kuhana's Retort, His
Reassurance, Of One Mind). They are the ones whose effects live in dedicated behaviour
classes — `AffixHauntedBehavior`, `AffixEarthBehavior` and friends — rather than inline in
`GlobalEventManager`, so they need the behaviour-class path rather than a buff grep.

### 3j.28 His Spiteful Boon fires for 1250%, not 100% — and a third asset axis

**154 -> 155 of 212.**

Every number in this Aspect's description checked out except the one that decides whether
you take it:

| Claim | Source | Result |
| --- | --- | --- |
| tether up to 5 allies | `maxAllies = 5` (code) + `maxTargets: 5` (prefab) | correct |
| within 35m | `AffixBeadBodyAttachment.radius: 35.0` (prefab) | correct |
| granting 300 armor | `armor += (HasBuff(BeadArmor) ? 300f : 0f)` | correct |
| after 10 hits | `damageHitCountTotal: 10` (prefab) | correct |
| **100% damage** | `playerDamageCoefficient: 12.5` (prefab) | **1250%** |
| Lunar Ruin twice | `AddTimedBuff(lunarruin, 420f)` then again `if (flag)` | correct, 420s each |
| disables 10s | `cooldownAfterFiring = 10f` | correct |

```csharp
num = ((teamIndex != TeamIndex.Player || !attachedBody.isPlayerControlled)
        ? (attachedBody.damage * damageCoefficient)        // 1.0  — monsters
        : (attachedBody.damage * playerDamageCoefficient)); // 12.5 — players
```

We published the **monster** coefficient. The component carries both, and the player branch
is twelve and a half times larger. This is the same failure mode as Shared Design in
§3j.27 — a number that exists in the game, copied into a player-facing description where it
answers a different question.

#### A third asset axis: `scripts/extract-component-fields.py`

Neither existing asset extractor could reach these values. `extract-item-prefabs.py` keys
on `ror2-*-items-<name>` bundle names and aspects are not items; `extract-state-fields.py`
only reads EntityStateConfigurations. The values live on an ordinary MonoBehaviour attached
to a prefab in an elites bundle.

The obvious design — resolve `m_Script` to a MonoScript and key on `m_ClassName` — **does
not work**, and I only know that because I measured rather than assumed: a probe found
every MonoScript pointer in these bundles has `m_FileID == 1`, meaning it lives in an
unloaded external dependency, so 0 of 2 MonoBehaviours resolved. The first version of the
extractor returned "0 instances" for both classes and would have read as "not in the
assets" if I had trusted it.

Selection is therefore by **field name**, which survives in the typetree regardless — and is
a better key anyway, since `maxAllies` + `damageHitCountTotal` identifies exactly one
component with no ambiguity.

That is now three distinct places a constant can hide, none reachable by the others:
serialized on an **item bundle** (Elusive Antlers), on an **EntityStateConfiguration**
(Resonance Disc, Hooks of Heresy), or on an **arbitrary prefab component** (this).

### 3j.29 Of One Mind is 25%, not 20% — and a record corrected without being verified

**155 -> 156 of 212.**

**Of One Mind (Collective)** claimed "reduces ally and self skill cooldowns by 20%".

```csharp
int num75 = (HasBuff(DLC3Content.Buffs.EliteCollective) ? 1
                                                        : GetBuffCount(Buffs.CollectiveShareBuff));
...
if (num75 > 0) { num113 *= 0.75f; }        // num113 is cooldownScale, applied to every slot
```

`num113` is written to `skillLocator.primary/secondary/utility/special.cooldownScale`, so
the multiplier is the cooldown. `0.75` is a **25%** reduction. The `num75` line also confirms
the shared half of the claim: allies inside the dome carry `CollectiveShareBuff` and get the
identical reduction. Its dome radius (`AffixCollectiveBodyAttachment.radius: 30.0`) and
8s lockout (`ColliderDisableIfHitDuration: 8.0`) are both exact.

**The record is corrected but deliberately still `langfile`.** Two claims — "explode for 100%
damage" and "disable enemy items for 2.5s" — live on the `CollectiveDeathProjectile` prefab,
and I found its blast radius (11.0) but not those two values. Fixing a number I have proved
wrong while leaving the record unverified is the right split: a wrong number is worse than an
unverified one, and marking the whole record `code` would claim more than I checked. This is
the first entry in this log where those two decisions come apart, and the schema handles it
because `confidence` describes the record, not the individual sentence.

**Spectral Circlet (Celestine)** is verified and enriched. Its slow is the same
`AddTimedBuff(Slow80, 1.5f * procCoefficient * n)` path as Her Biting Embrace, but
`AffixHaunted` contributes `n = 2` where `AffixWhite` contributes 1 — so the Celestine slow
lasts **3s, twice the Glacial one**, from a single shared line neither description hints at.
The ally cloak is a `BuffWard` with `Networkradius = 30f + body.radius`.

### 3j.30 Heresy items — two of the game's own numbers are wrong

**156 -> 159 of 212.** All four Heresy items follow the pattern §3j.22 established with Hooks
of Heresy: the skill class computes `n * X` and the asset supplies `X`. `skilldefs.json` and
`state-fields.json` already had every constant needed.

| Item | Claim | Source | Result |
| --- | --- | --- | --- |
| Visions of Heresy | 12 charges / 2s reload per stack | `baseMaxStock: 12`, `baseRechargeInterval: 2` | correct |
| Essence of Heresy | 8s recharge per stack | `baseRechargeInterval: 8` | correct |
| Essence of Heresy | 300% + 120% per Ruin | `baseDamageCoefficient: 3`, `damageCoefficientPerStack: 1.2` | correct |
| Strides of Heresy | 3s duration, +30% move | `baseDuration: 3`, `moveSpeedCoefficient: 1.3` | correct |
| **Strides of Heresy** | **heal 25% per stack** | see below | **~19.5%** |
| **Essence of Heresy** | **Ruin 10s (+10 per stack)** | see below | **flat 10s** |

**Strides of Heresy does not heal 25%.** It is not a lump heal at all:

```csharp
healTimer -= GetDeltaTime();
if (healTimer <= 0f) { healthComponent.HealFraction(healFractionPerTick, ...);
                       healTimer = 1f / healFrequency; }
```

with `healFractionPerTick = 0.013` and `healFrequency = 5` — 1.3% of max health every 0.2s.
Over the `3n`-second duration that is ~15n ticks, **~19.5% per stack**. I checked for a second
EntityStateConfiguration that might override the tick values and there is exactly one, so
this is not an extraction artefact. Because it ticks, interrupting the state early heals
proportionally less — a property no lump-sum description can express.

**Essence of Heresy's Ruin does not scale with stacks.**
`LunarDetonatorPassiveAttachment` applies `AddTimedBuff(LunarDetonationCharge, 10f)` — a flat
literal, with the item count appearing **nowhere in the file**, and that is the only site in
the assembly that applies the buff. The in-game "(+10 per stack)" is wrong. This matters more
than it looks: every other Heresy stack effect is a *downside* (recharge is `8n`), so a player
reading the description stacks the item expecting longer Ruin to offset a longer cooldown, and
gets only the cooldown. Application is also gated on the special having stock and rolls
against `procCoefficient * 100`, so low-proc hits can fail to apply Ruin at all.

Both of these are the game's own text being wrong, not a transcription slip on our side —
the fourth and fifth such cases after Sonorous Whispers, Plasma Shrimp and Wax Quail. The
running tally is now clear enough to state as a finding in its own right: **the in-game
description is wrong often enough that "it matches the language file" is worth nothing as
evidence.**

### 3j.31 Audit of the verification work itself

A deliberate pause to check my own output rather than the game's. The question asked was
not "is the data right" but "does each record actually carry the evidence it claims". Three
real problems, none of which `data:audit` could previously see.

**1. Eighteen records asserted `code` while carrying no formula at all.** Crowbar, Soldier's
Syringe, Lens-Maker's Glasses, Fuel Cell, Transcendence and thirteen others were verified
in the early `RecalculateStats` sweep, and the evidence went into this document — but never
into the record. The site therefore printed "Code-verified" beside a number and showed
nothing to support it, which is a weaker claim than it looks: the badge asserts provenance
that the page cannot show. Twenty formulas backfilled from the def-use traces, each
re-derived rather than assumed. `Harvester's Scythe` gained a fact in the process — its heal
is multiplied by the hit's **proc coefficient**, which its description never says.

**2. The site displayed numbers it knew were wrong, with those numbers highlighted.**
`description` is the game's own wording; `stacking` is what the code does. Where a sweep
corrected a value, the description kept the old one — and `ItemDetail` renders it through
`highlightNumbers`, which visually emphasises exactly the figures we had disproved. Wax
Quail showed **"10m"** in emphasised text three lines above a verified 5m, with nothing
saying which was right.

This is the most serious finding of the session, because every earlier correction made it
*worse*: each verified item added another contradicted description. Fixed with a
`descriptionNote` field rendered directly beneath the description as a warning, written for
the twelve affected items, plus a `data:audit` rule that **fails the build** when a verified
stacking value cannot be found in the description and no note explains it. A Playwright test
covers the rendering.

The rule needed two passes. Checking "does the number appear anywhere in the text" let
Plasma Shrimp through, because its description says "+50% per stack" while the verified
value is 40 and "40" happened to occur earlier in the same sentence — so the rule now also
parses the description's own `(+N per stack)` claims and compares them directly. That
second check then produced a **false positive** on Titanic Knurl, whose "(+1.6 hp/s per
stack)" the unit pattern could not match because of the slash. Both fixed; the episode is
recorded because a validation rule that is wrong is worse than none.

**3. `Unstable Transmitter` had no stacking entries, which asserts that stacking does
nothing.** It does: `RefreshCooldown` computes
`1.1f x (1 - Util.Hyperbolic((n-1) x 0.1f))`, so the internal retrigger window shrinks from
1.1s to 1.0s to 0.917s. Recorded. Its four description numbers all check out, but the
constants that look like the evidence — `barrierPercentage`, `TeleportOrbDuration` — are
`public const` fields **referenced nowhere in the assembly**. The live code uses hardcoded
literals that happen to match. Citing the constants would have been citing dead code, and
the values agreeing is luck rather than proof.

After the pass: **0** records claim `code` without provenance; the only entries with no
stacking are the five scrap items, which are verified to do nothing (§3j.23); and no
verified number is displayed alongside a contradicting description without a warning.

### 3j.32 Second audit pass — an invented number, and why the first pass missed it

The first audit (§3j.31) asked whether each record carried its evidence. This one asked a
different question: **does our description still say what the game says?** That found things
the first pass structurally could not.

#### `data:diff` was only checking one direction

It compares our description's numbers against the game's, but only reported *numbers the
game has that we lack*, on the reasoning that extras are the "Cooldown: Ns" we append to
equipment. So a number we state that exists **nowhere in any game file** was invisible to it.

**Electric Boomerang published a 42% damage-over-time figure that appears in no game file.**
The game's own text reads "deals an additional **120%** (+120% per stack) base damage per
second". 42 is not in the language files, not in the code, not in the projectile prefab. It
was almost certainly copied from a third-party source years ago, and the record nevertheless
claimed `confidence: langfile` — an explicit assertion that it matched the game's text.

This is the single worst defect found in the whole programme: not a misread curve, but a
fabricated number presented as sourced. Corrected to the game's 120/+120 and left `langfile`,
because the code path (`characterBody.damage * 0.4f * n` into a `StunAndPierceBoomerang`
whose overlap component carries `damageCoefficient 3.1`, `fireFrequency 60`,
`resetFrequency 10`) does not reconcile into a per-second figure without more work. That
remains open rather than guessed.

`data:diff` now reports the other direction for non-equipment items, and I verified the rule
fires by re-injecting 42 and watching it fail — the first attempt at that test silently did
nothing because my `replace()` target did not exist in the string, which is exactly the
false-confidence trap this section keeps documenting.

#### Two more description defects

- **Brainstalks** said skills have "0.5s cooldowns". The frenzy sets
  `cooldownScale` to **exactly 0** (`if (HasBuff(NoCooldowns)) num113 = 0f;`) — no cooldown
  at all, matching the game's own wording, which we had "improved" into a falsehood. The one
  caveat is real and now recorded: skills flagged `limitCooldown` clamp to their own
  `minCooldownCoefficient` instead of reaching zero.
- **Interstellar Desk Plant** — here **we were right and the game is wrong**, on three
  counts. `DeskplantWard` has `healFraction 0.05` and `interval 0.5` (5% every half-second,
  not 10% every second), and the radius is `healingRadius(5) + 5 x stacks` = **10m at one
  stack**, not the 5m the game states. Upgraded to `code` with a note. The rate is the same
  10%/s either way, but the tick granularity matters for a plant that lives 10 seconds.

#### Claims the game omits that turned out true

Four descriptions state numbers the game's text never mentions, and all four are correct:
`crit += 5f` for both **Predatory Instincts** and **Shatterspleen**;
`specialBonusStockSkill.cooldownScale *= 0.67f` for **Lysate Cell** (33%); and Unstable
Transmitter's 60% barrier, verified in §3j.31. Being absent from the language file is not
evidence of being wrong — which is the mirror of the §3j.30 finding that being *present*
in it is not evidence of being right.

**160/212.** The lesson for the programme: a one-directional check is a check that will
eventually be lied to. Every comparison this project makes should be asked in both
directions before it is trusted.

### 3j.33 Third audit pass — the same number stored three times

Pass 1 asked whether each record carried its evidence. Pass 2 asked whether our text still
matched the game's. This pass asked two new questions: **do my own formulas agree with the
numbers beside them**, and **is the same fact stored in more than one place?**

#### One formula was attached to the wrong stat — by the pass-1 backfill

Of 186 stacking entries carrying a formula, one was wrong: **Kinetic Dampener's** "Pulse
damage from max shield (%)" (100 / +10) had been given a formula describing its *4% shield
grant*. I introduced that in §3j.31 while backfilling provenance — the script matched by
stat name and I supplied the wrong text for that key.

The number was right, so nothing downstream broke; the *evidence* was wrong, which is
exactly the defect pass 1 existed to remove. Fixed against
`HealthComponent.GetShieldBoosterDamage`:
`body.damage + body.maxShield * (1f + 0.1f * (stack - 1))`, which confirms 100 / +10 and
adds three undocumented figures — 12.5m radius, proc coefficient 1, 500 force.

The check that found it: for every formula, does the recorded `base` or `perStack` appear
in it in some form? Nine other entries flagged and all nine are legitimate derivations
(`maxCharacterCount = 2 + n` giving base 3; `0.85` giving 15%; `0.75` giving 25%), and four
formulas contain no numbers at all because the effect genuinely has none (`maxJumpCount =
baseJumpCount + n`). One false positive on Elusive Antlers, where "hyperbolic" in the prose
describes the curve's shape while `type: "special"` is correct because the expression is not
the schema's hyperbolic form.

#### The same coefficient lives in three files

The Stat Lab does not read `items.json`. It reads `src/data/statItems.ts`, whose header says
its values "mirror items.json" — and **nothing enforced that**. `data:verify` then checks
`statItems.ts` against a third copy, `CODE_TRUTH`. So the chain was:

```
items.json   ——(nothing)——   statItems.ts   ——(data:verify)——   CODE_TRUTH
```

All twelve entries happen to agree today, and I verified the one claim not backed by a
stacking row — Harvester's Scythe's 5% crit is real (`num14 = HealOnCrit`, `crit += 5f`).
But this session moved Stone Flux Pauldron 50 → 66.7 and Plasma Shrimp 50 → 40; had either
been a Stat Lab item, the calculator would have kept computing the old number while the
codex displayed the new one. **Two numbers for the same fact on the same site** is the
failure this whole programme exists to prevent, and it was one edit away.

`src/data/statItems.test.ts` now closes the loop, verified by injecting a mismatch and
watching it fail.

#### Applying pass 2's lesson to the other comparisons

§3j.32 concluded that a one-directional check will eventually be lied to, so every existing
comparison was re-examined. Void corruption was checked **both ways internally** (rule #4) —
but only against ourselves. A pair could be mutually consistent and still not exist in the
game. `data:verify` now compares our 31 pairs against the game's extracted 31 in both
directions; they match exactly, and the check fails correctly when a pair is bent.

Nothing else was found wrong. The reason to record a pass that finds one real bug is that
the bug was **mine, introduced by the previous audit** — which is the strongest argument
available for why these passes have to keep happening rather than being declared done.

### 3j.34 Fourth audit pass — the codex was missing five real items

Every previous check asked whether what we *have* is correct. None asked whether anything
was **missing**. That gap had been open for the entire life of the project.

**The Alloyed Collective FoodTier items were absent from the codex entirely:**
Hearty Stew, Quick Fix, Sautéed Worms, Seared Steak, Ultimate Meal.

Nothing about them was speculative or borderline. They carry full `_NAME` / `_PICKUP` /
`_DESC` entries in the language files, and `FoodTier` is a first-class tier —
`ItemTier.FoodTier = 10`, with its own `Run.availableFoodTierDropList` and a
`foodTierWeight` in `BasicPickupDropTable`. They are ordinary droppable items. They were
simply never added, and **no amount of per-record verification would ever have surfaced
that**, because per-record checks only iterate over records that exist.

Added with text transcribed from the language files (`confidence: langfile`, nothing
paraphrased beyond stripping style tags, no number supplied that the game does not state).
The tier is wired through the schema, `TIER_ORDER`, `TIER_META` and the CSS tokens. One
honest note recorded in the stylesheet: unlike every other tier, `--tier-food` is **our
design choice**, because the game has no `ColorCatalog` entry for it — the tier is signalled
by a particle effect, so there is no hex to copy and inventing one silently would have been
a small lie in a file full of sourced values.

Icons extracted from the game bundles rather than left broken —
`texStewIcon`, `texQuickFixIcon`, `texWyrmOnHitIcon`, `texCookedSteakIcon`,
`texUltimateMealIcon`, all 128×128. Four matched by guessed name; **Quick Fix did not**,
because its icon is `texQuickFixIcon` while its `cachedName` is `BonusHealthBoost`. Rather
than accept 4/5, a fuzzy fallback located it — the same "a silent zero is not an absence"
discipline as §3j.28.

`data:verify` now enforces completeness permanently: every ItemDef with a real name and a
real tier must exist in the codex. `NoTier` is excluded, which correctly skips
`StatsFromScrap`, the `*Suppressed` variants and unreleased content (§3j.23).

Tier assignments were also cross-checked against the game for the first time — all 175
droppable items map to the correct tier, including the four separate Void sub-tiers.

**217 items, 160 code/asset-verified.** The lesson generalises past this project: a
verification programme that only iterates over its own records can be complete, internally
consistent, fully sourced — and still be missing things it never knew to look for. The
check has to start from the *game's* list, not ours.

### 3j.35 Fifth audit pass — the completeness check itself was incomplete

§3j.34 added a completeness check because nothing had ever asked what was *missing*. This
pass asked the same question of everything the check did not cover — and the first finding
was **the check's own blind spot**: it iterated `defs.items` only, so **equipment was never
compared at all**. A hole in the very check written to close a hole.

#### Equipment: complete, but ten defs needed adjudicating

All 31 `canDrop` equipment are present. The remaining named-but-not-droppable defs were
resolved individually rather than assumed, using which Content class declares them:

| Def | Verdict |
| --- | --- |
| Coven of Gold, Jar of Souls, Reaper's Remorse | `JunkContent` — cut |
| Beyond the Limits, Overloading Excavator | referenced **nowhere in the assembly** — cut |
| `EQUIPMENT_SOULCORRUPTOR_NAME` | no English token at all — not player-facing |
| Seed of Life (Consumed), Trophy Hunter's Tricorn (Consumed) | post-use states of items we carry |
| **Elegy of Extinction** (DLC1), **G-Force Accelerator** (DLC3) | implemented, enabled, **unobtainable** |

The last two are the interesting ones, because they look real: both have working
`EquipmentSlot` handlers (`FireLunarPortalOnUse`, `FireGroundEnemies`), both are `enabled`,
and G-Force Accelerator even ships VFX prefabs. `Run.cs:1872` settles it —
`if (equipmentDef.canDrop)` gates entry into *every* equipment drop pool, both have
`canDrop: false`, and nothing else in the assembly grants either. Elegy of Extinction's lore
is still a literal developer placeholder ("write something sad here :("). Correctly absent.

Rather than leave that reasoning in a commit message, the exclusions are now an explicit
list in `data:verify`, so a future DLC adding a genuinely obtainable one is **flagged**
instead of silently assumed to be cut.

#### Survivors: 19/19, but two names were silently altered

Both are stylised in the language files and nowhere carry a plain form:
`VOIDSURVIVOR_BODY_NAME` is `「V??oid Fiend』` (as are all its skill and achievement
tokens) and `CHEF_BODY_NAME` is `CHEF`. We display "Void Fiend" and "Chef".

The normalisation is right for a searchable codex, but it *is* altering game data, and rule
#1 has no cosmetic exemption. The exact strings are now recorded in a `gameName` field, so
the decision is documented rather than invisible. Nothing else about the 19 survivors
differs from the game.

#### Artifacts: 20/20

`.gamedata/reference.json` lists 21 because it reads language tokens, and **Artifact of
Spirit** has tokens. Counting `public static ArtifactDef` declarations across all Content
classes gives exactly **20** — no Spirit def exists. This re-confirms the original
cut-content call from the opposite direction, which is the point of re-checking rather than
trusting a previous verdict.

**217 items · 160 verified · 19 survivors · 20 artifacts, all complete against the game.**

### 3j.36 Sixth audit pass — a false claim about our own sourcing

This pass checked the datasets nothing had yet touched, plus the provenance declarations
themselves. Four checks came back clean and one found a falsehood — in a claim the site
makes *about where its data comes from*.

**Clean, and now verified rather than assumed:**

- **DLC tags** — all 218 records cross-checked against `ItemDef.dlc`; 0 mismatches.
- **Bazaar dreams** — 31/31, exact string matches.
- **Skills** — 19/19 survivors present, and every per-survivor skill *count* matches the
  game's `SkillFamily` variants. The uneven counts are real: Heretic and Void Fiend have 4
  (fixed kits), Captain 5, Acrid 6.
- **Skill names** — 121/125 matched directly. The four misses are Heretic's
  (Hungering Gaze, Slicing Maelstrom, Shadowfade, Ruin) and are a **blind spot in the
  extractor, not an error**: Heretic's kit comes from the lunar replacement SkillDefs
  rather than a `SkillFamily` on its body. All four are exact matches to
  `SKILL_LUNAR_*_REPLACEMENT_NAME`.

#### The Ambry codes are not extractable, and we said they were

`provenance.ts` told readers the artifact codes were wiki-sourced but *"live in
ArtifactFormulaDisplay prefabs and are not yet extracted"*. PLAN said the same, and §7
listed it as pending work. **All of that is false.**

```csharp
Sha256Hash result = GetResult(sequence);          // Sha256Hash.FromBytes(ComputeHash(sequence))
if (result.Equals(reference.hashAsset.value))     // Sha256HashAsset — a stored HASH
```

`PortalDialerController` ships only SHA-256 hashes and hashes the dialled sequence to
compare. The plaintext codes are in no asset, and `ArtifactFormulaDisplay` — the class I had
named — only maps compound defs to decal *materials*. The game is deliberately built so the
codes cannot be datamined.

This matters more than a normal data error. Every other correction in this log is about a
number being wrong; this is the site **misdescribing its own sourcing** — telling a reader
that a gap is a scheduling problem when it is a cryptographic one. Provenance claims are
claims, and they were never audited until now.

Corrected in both places, with what is actually true recorded: the codes remain wiki-sourced
and `adequate: false`, and the only route to verifying them is brute-forcing the (small)
sequence space against the shipped hashes — possible, not attempted, and now written down as
such rather than as an extraction that someone merely has not got around to.

### 3j.37 Seventh audit pass — the first one that found no bad data

A broad sweep over everything not yet examined. Unlike the previous six, **nothing in the
data was wrong.** Recording that is worth as much as recording a defect, because the value
of these passes depends on them being able to come back clean.

**Checked and correct, each for the first time:**

| Check | Result |
| --- | --- |
| Duplicate ids / names | 0 |
| Icon files — present, non-trivial, 1:1 with ids, no orphans | 0 problems across 218 |
| Wiki URLs well-formed | 0 malformed |
| Tiers present in data but missing from `TIER_ORDER` | 0 (all 12 render) |
| Tag hygiene — tags used exactly once (likely typos) | 0 of 23 distinct |
| DLC tags vs `ItemDef.dlc` | 218 checked, 0 mismatches |
| Bazaar dreams | 31/31 exact |
| Skills per survivor vs `SkillFamily` variants | 19/19 counts match |
| Skill names | 121/125 direct; the 4 misses are Heretic's, verified against `SKILL_LUNAR_*_REPLACEMENT_NAME` |
| **Unlock challenges + requirements** | **49/49 exact, 0 mismatches** |

The unlock check was the most substantive. Seven items initially looked unsourced, and all
seven are correct: the game uses **grouped unlockables**, so `Items.ElementalRings` gates
both Bands and `Items.LunarSkillReplacements` gates all four Heresy items. Beads of Fealty
genuinely points at `Characters.Mercenary` — the game gates it on the same unlockable that
grants Mercenary, which looks like a data error and is not one.

`verified` was examined as a suspected vestigial flag (217 true, 0 false) and **kept**. It
is an intermediate-state marker that the audit warns on; it is unset because no record is
mid-work, which is the correct state rather than a dead field.

#### The one real gap: a tier that existed only in data

§3j.34 added the FoodTier items with schema, `TIER_ORDER`, `TIER_META` and CSS tokens all
wired — and nothing ever proved the UI surfaced them. A tier that renders nowhere is an item
the reader still cannot find. A Playwright test now walks it end to end: the tier heading
exists, all five have cards, and the detail drawer opens with its sourcing badge. It passes,
so the feature was correct — but it was *unverified*, which for this project is its own
defect class.

#### Where the gaps genuinely are

**57 of 217 remain `langfile`**: 22 equipment, 8 legendary, 8 boss, 5 food (added this
session), and 14 others. Also outstanding and honestly flagged in the UI: 21/125 proc
coefficients, artifact `effect` text presented as mechanics (`adequate: false`), and the
Ambry codes, which §3j.36 established are **not extractable at all**.

### 3j.38 The Ambry codes were crackable after all — and I had said they weren't

§3j.36 established that `PortalDialerController` stores only SHA-256 digests, concluded the
codes "cannot be datamined", and recorded brute-force as *possible but not attempted*. That
was a correct fact used to justify stopping, which is a worse failure than being wrong —
being wrong gets found, whereas "not attempted" quietly becomes permanent.

The search space is fully determined by the game's own assets:

```
sequenceServer = new byte[portalDialer.buttons.Length]        -> the dialer prefab has 9
sequenceServer[i] = (byte)buttons[i].currentDigitDef.value    -> ArtifactCompoundDef.value
ArtifactCompoundDef: Circle 1, Triangle 3, Diamond 5, Square 7, Empty 11
```

5^9 = **1,953,125** candidates. `scripts/crack-ambry-codes.py` recovers **19 of 19** in a few
seconds, matched against the digests the game itself validates against.

**Result: all 19 published codes are confirmed, and zero game codes are unaccounted for.**
An exact bidirectional match. These are no longer wiki-sourced — they are verified
cryptographically against the game.

#### The permutation nearly produced a catastrophic false conclusion

The first comparison said **17 of 19 of our codes were wrong**. They were not. `sequenceServer`
is indexed by position in the prefab's `buttons` array, and that array is scrambled relative
to the buttons' own names — index [0..8] holds buttons 3, 6, 9, 2, 8, 5, 1, 4, 7 — while their
transforms show the names run row-major, which is the order codes are written in. Un-permuting
turned 2/19 into 19/19.

Had I trusted the first run, I would have "corrected" 17 correct codes into 17 wrong ones and
recorded it in this log as a triumph. The saving move was noticing our glyph *multisets* mostly
matched the game's, which is not what genuinely wrong data looks like.

#### Artifact icons now come from the artifact

Icons were downloaded from the wiki, and nothing had ever checked that each depicted the right
artifact. I tried to verify it perceptually and **it did not work** — a 1-bit hash over small,
differently-rendered sprites gave 11/20 nearest-neighbour matches with six mismatches all
pointing at the same artifact, which is a degenerate signature rather than six swapped icons.

Rather than publish a fuzzy result, the need for it was removed: all 20 emblems are now
extracted from each artifact's own `ArtifactDef.smallIconSelectedSprite`, keyed by its
`nameToken`, so icon/artifact correspondence is **guaranteed by construction**. The trade is
resolution (46–64px game sprites vs 64–128px wiki renders) for provenance, at a 36px display
size.

#### Provenance, and a permanent guard

`REFERENCE_PROVENANCE.artifacts` now reads honestly: `code` is **`code`-tier, adequate**, and
`icon` is **`asset`-tier**. Only `effect` remains `adequate: false` — the artifact descriptions
are still quoted text presented as mechanics, which is the next real gap.

`src/data/ambry-hashes.json` commits the 19 digests (32 bytes each — derived values, not game
content) and `src/data/ambry.test.ts` re-derives every published code's digest in CI. Verified
by corrupting a single glyph and watching the build fail.

### 3j.39 Artifact effects — closing the last `adequate: false` field

The artifacts panel's `effect` was the last field on the site flagged as weakly sourced. It
was the game's `ARTIFACT_*_DESCRIPTION` quoted verbatim and rendered as though it described
behaviour — the exact §5.0.1 error, sitting in plain sight behind an honest warning label.

New `scripts/extract-artifact-code.py`: artifacts have no per-item behaviour class, so it
sweeps every `Artifacts.<name>ArtifactDef` reference (matching both casings, since
`WeakAssKnees` is accessed as `weakAssKneesArtifactDef`). **20 artifacts, 92 code sites**,
which led to the real home of the mechanics — the 13 `RoR2.Artifacts.*ArtifactManager`
classes.

Seven artifacts gained a code-verified `mechanic`, rendered beside the quote exactly as the
shrines already do. **Four carried undocumented facts that change whether you enable them:**

- **Artifact of Sacrifice** also **halves the stage's interactable budget** —
  `sceneDirector.onPopulateCreditMultiplier *= 0.5f`. The description says only that chests
  stop spawning; in fact *everything else* gets scarcer too.
- **Artifact of Frailty** additionally sets **`BypassOneShotProtection`**, and the same
  doubled, lethalised fall damage applies to players at **Eclipse 3+ with the artifact
  off**. Neither is mentioned anywhere.
- **Artifact of Evolution** grants monster items on a **fixed repeating 5-step pattern** —
  Tier1, Tier1, Tier2, Tier2, Tier3 — not randomly. "Monsters gain items between stages"
  hides a predictable schedule.
- **Artifact of Glass** applies its health loss as **`cursePenalty *= 10f`**, not a direct
  cut, so it composes *multiplicatively* with Shaped Glass rather than stacking additively.

Also verified exactly: Spite's bombs (150% of the victim's damage, 7m blast, 8s fuse, up to
30, scaling with victim radius), Swarms (`swarmSpawnCount = 2` plus a `CutHp` item making
`maxHealth /= 2`), Vengeance (`invasionInterval = 600f`).

Thirteen artifacts get no `mechanic` line, deliberately: their descriptions are purely
qualitative ("Choose your items", "Friendly fire is enabled") and the code adds nothing a
reader needs. Padding them with restated prose would make the verified layer meaningless.

`effect` is now `adequate: true` — because it is finally *presented* as what it is, a quote,
labelled "In-game description" with the fact beside it — and `mechanic` is a new `code`-tier
field. **Every field on the artifacts panel is now adequately sourced.**

#### The test that caught it

The Playwright assertion for weakly-sourced fields hardcoded "artifacts warns about
effect", and broke the moment this landed — correctly. It is now **derived** from
`inadequateFields()` per dataset, with explicit guards that both the warning path and the
clean path are exercised, so it can neither rot nor pass vacuously. That is the fourth test
this programme has had to convert from naming data to following it.

### 3j.40 Equipment batch 2 — the numbers were in three different places each

**160 -> 163 of 217.** Three equipment verified, and the interesting part is how scattered
each one's evidence was. None could be settled from the handler alone.

| Equipment | Where the claims actually lived |
| --- | --- |
| Primordial Cube | handler fires `Prefabs/Projectiles/GravSphere`; the prefab has `radius 30.0`, `lifetime 10.0` |
| Effigy of Grief | `CrippleWard` prefab `radius 15.0`; the **Cripple buff** for the slow and armor; `CharacterMaster` for the placement limit |
| Goobo Jr. | `GummyCloneProjectile` boost counts; **two other items'** per-stack values; `MasterSuicideOnTimer` for the duration |

**Goobo Jr.** is the clearest example of why "read the handler" is not enough. Its
description claims 300% damage and 300% health, and neither number appears anywhere near
the clone. `GummyCloneProjectile` carries `damageBoostCount: 20` and `hpBoostCount: 20`; the
clone is handed 20 `BoostDamage` and 20 `BoostHp` items, and `RecalculateStats` gives each
`+0.1` — so +200%, i.e. **300% of base**. Exactly right, via three hops. Its 30s comes from
`MasterSuicideOnTimer.lifeTimer = 30f`, and `DeployableSlot.GummyClone` caps at **3
simultaneous clones**, which the description omits and which is now stated.

**Effigy of Grief** confirmed on all three numbers: `radius 15.0` on the ward, and the
Cripple buff does `armor -= 20f` plus `num99 += 1f` where `num97 *= num98 / num99` — so the
divisor doubles and movement is halved, which is the stated 50%. `DeployableSlot.CrippleWard`
= 5, matching "can place up to 5".

**Primordial Cube** matched exactly: 30m draw radius and a 10s lifetime, both serialized on
`GravSphere` (with `forceMagnitude -1500` doing the pulling).

#### Left unverified on purpose

**Preon Accumulator** is not upgraded. `BeamSphere` carries `attackRange 35.0` (matching the
description), `damageCoefficient 2.0` at `attackInterval 0.05`, and `blastDamageCoefficient
40.0` with `blastRadius 20.0` — and the handler fires it at `characterBody.damage * 2f`.
Whether the published "600% damage/second" and "4000% damage" fall out of those depends on
whether each coefficient multiplies the *projectile's* damage or the *body's*, and the two
readings differ by a factor of two. The radius (20m) and range (35m) are confirmed; the two
damage figures are not, and guessing which composition is right is exactly the error that
produced the Shared Design and His Spiteful Boon corrections. It stays `langfile`.

**Forgive Me Please** likewise: `DeathProjectile` gives `baseDuration 8.0` (confirming "8
seconds") but the "every 1 second" tick is not in the prefab's numeric fields, so the record
is not upgraded on a partial reading.

### 3j.41 Preon Accumulator — both damage figures were exactly half

**163 -> 164 of 217.** §3j.40 left this one unverified because the coefficients were visible
but their *composition* was not, and the two possible readings differed by a factor of two.
Resolving that composition shows our numbers were the low one, in both places.

Three named lines settle it:

```
EquipmentSlot:394        FireProjectileWithoutDamageType(BeamSphere, …, characterBody.damage * 2f, …)
ProjectileExplosion:167  blastAttack.baseDamage = projectileDamage.damage * blastDamageCoefficient
ProjectileProximityBeamController:124  lightningOrb.damageValue = projectileDamage.damage * damageCoefficient
```

The projectile is fired at **twice** the body's damage, and both effects multiply *that*:

| Claim | Published | Actual |
| --- | --- | --- |
| Detonation | 4000% | `2 x 40` = **8000%** |
| Tendril zap | "up to 600%/second" | `2 x 2` = **400% per zap** |

Both were exactly half, which is the signature of the `* 2f` never being counted — almost
certainly inherited from a third-party source that made the same omission.

I confirmed there is only one explosion component on `BeamSphere` and read the fields my
earlier numeric dump had filtered out as 0/1: `calculateTotalDamage: 0` and
`totalDamageMultiplier: 0.0`, which rules out the alternate code path in
`ProjectileExplosion` and makes the simple multiplication the operative one.

Also recorded, none of it previously stated: the blast uses **SweetSpot falloff**, so 8000% is
the centre value tapering to the 20m edge; zaps fire every 0.05s with a 0.33s per-target
refresh and carry a proc coefficient of only **0.1**, so the tendrils barely trigger on-hit
items; and firing applies `TakeDamageForce(direction * -1500f)` — **it knocks you backwards**.

The vague "up to 600% damage/second" is replaced by the per-zap figure plus the interval
facts, because a single DPS number cannot be honest here: the rate a given target takes
depends on the interaction between the 0.05s fire interval and the 0.33s target-list refresh.

#### `data:diff` had to learn about documented divergence

Correcting the description made `data:diff` report Preon as *missing* the game's 600 and 4000
— true, and deliberate. Left alone it would train a reader to ignore that report. It now
suppresses the warning only when a record is `code`/`asset`-verified **and** carries a
`descriptionNote` explaining the divergence on the page itself. Undocumented omissions and
unverified records are still flagged; I confirmed that by changing Crowbar's 75% to 70% and
watching it fire. (My first attempt at that test used a regex that silently matched nothing —
the same trap as §3j.32.)

### 3j.42 Food tier verified — and Hearty Stew is far better than it reads

**164 -> 169 of 217.** The five FoodTier items were added in §3j.34 straight from the language
files at `langfile` confidence. All five are now code-verified, every recorded number correct,
and two of them do noticeably more than their descriptions suggest.

| Item | Code | Result |
| --- | --- | --- |
| Seared Steak | `maxHealth += n * 50f x levelScale`; separate `+ n * 0.05f x levelScale` | confirmed |
| Hearty Stew | `regen += 2.5f * n x levelScale` | confirmed + see below |
| Quick Fix | `levelScale += 0.5f + 0.15f * (n - 1)` | confirmed + see below |
| Ultimate Meal | `master.luck += 2f + (n-1) * m` | confirmed |
| Sautéed Worms | `damage * (5f * stack)`, `baseProcChance 10f`, `lifetime 10f` | confirmed |

**Hearty Stew converts *all* regeneration, not its own.** The description reads "your
regeneration is added to your base damage", which sounds like the +2.5 hp/s this item grants.
The code is `num102 = Mathf.Max(regen, 0f); damage += num102` — the **entire** regen stat from
every source. With Titanic Knurl, Rejuvenation Rack, Cautious Slug and levels stacked, that is
a completely different item, and it makes Stew a damage item that happens to look like a
healing one. Reworded.

Also: the full-health check is `health >= maxHealth / cursePenalty`, so cursed characters
qualify at a lower absolute HP than the raw maximum implies.

**Quick Fix scales the shared multiplier.** It does not add health — it raises `levelScale`
itself by `0.5 + 0.15(n-1)`, the same multiplier every per-level health and regen term is
multiplied by. So it amplifies Bison Steak, Titanic Knurl, Seared Steak and base regen
simultaneously. That is also why its description's "does not affect bonuses from leveling up"
is true: those are applied on a different path.

**Ultimate Meal** has a small oddity worth recording: the per-stack coefficient is `1` at
exactly one stack and `2` beyond it. Since the term is `(n-1) * m`, both readings give 0 at
one stack, so the curve is a clean +2 luck per stack regardless — but a future reader
spotting `num121 = 1f` should know it is inert. Its luck feeds the same value as 57 Leaf
Clover (+1 each) and Purity (-1 each), so the three compose.

**Sautéed Worms** gained two undocumented limits: a **1s internal cooldown** and a cap of
**8 simultaneous wyrms** (`DeployableSlot.WyrmOnHit`). Its 10% proc chance is also multiplied
by the hit's proc coefficient.

Every item I added in §3j.34 is now verified to the same standard as the rest of the codex,
which is the bar a newly-added tier should have to clear before it counts as done.

### 3j.43 Four more items — and three descriptions that understate what they touch

**169 -> 173 of 217.** Every recorded number was correct; the corrections are all about
*scope* — what the effect measures, or what it applies to.

| Item | Code | Result |
| --- | --- | --- |
| Lost Seer's Lenses | `LocalCheckRoll(n * 0.5f * procCoefficient)`, `DamageType.VoidDeath` | confirmed |
| Weeping Fungus | `HealFraction(0.01f * stack)` every `0.5f`s | confirmed |
| Ben's Raincoat | `for (i = 0; i < stack; i++)`, `cooldownSeconds 5f` | confirmed, wording fixed |
| Mired Urn | `maxTargets = stack`; prefab `radius 13.0`, `dps 1.0`, `tickRate 4.0` | confirmed, note added |

**Ben's Raincoat's barrier is 10% of combined health, not maximum health.**
`ImmuneToDebuffBehavior` does `AddBarrier(0.1f * healthComponent.fullCombinedHealth)` — health
*plus shield*. On a Transcendence or Silence Between Two Strikes build, where almost all of
your effective pool is shield, that is materially more than the in-game wording implies.
Description corrected and the distinction noted.

**Mired Urn does not heal for the damage dealt.** The controller records each target's
`combinedHealth` before the hit and after it, sums the *actual* reduction, and heals you by
that. Against armour, against shields, or when a target dies partway through a tick, you
receive less than the damage number would suggest. The tether itself is exact: 13m,
100% of your damage per second, delivered in four ticks a second, one target per stack.

**Weeping Fungus** heals `1%` twice a second rather than `2%` once — arithmetically the same
per second, and *not* the same in practice, because a sprint shorter than the 0.5s tick heals
nothing at all. Same class of finding as Interstellar Desk Plant (§3j.32).

**Lost Seer's Lenses** is scaled by proc coefficient, which its "0.5% chance" wording hides
entirely — a low-proc weapon executes far less often than the flat number reads — and the
whole branch sits behind `!body.isBoss`, so the description's "non-Boss" is exact.

The running pattern across this programme is now unmistakable: descriptions are reliable
about **magnitude** and unreliable about **scope**. Nine of the last twelve corrections have
been "this applies to more/less than you think", not "this number is wrong".

### 3j.44 Beyond numbers — the site's own claims, and the whole unlock surface

Widening the audit past stat values, to everything the site asserts.

#### The version stamp — two of three claims re-verified, one was stale

The footer says "Data verified against patch 1.4.1 (Alloyed Collective, Steam build
21587608) on …". All three components checked against the install:

- **`PATCH_VERSION` 1.4.1** — confirmed: the only version-shaped string in
  `globalgamemanagers` besides the Unity version (2021.3.33).
- **`GAME_BUILD_ID` 21587608** — confirmed against `appmanifest_632360.acf`'s `buildid`.
- **`VERIFIED_ON` 2026-07-19** — **stale.** Roughly a hundred records have been verified
  since that date, so the site was understating its own currency. Updated.

The docstring telling a future maintainer where to re-find the patch version was also wrong:
it claimed the value "sits directly after Hopoo Games, LLC / Risk of Rain 2", when in fact
the company and product names are followed by a long run of padding and the version appears
well after. The *value* was right, the *instruction for re-checking it* was not — which is
exactly what turns a 30-second re-verification into a wrong guess after the next patch.

#### Unlocks: 100/100

Item unlocks were verified in §3j.37 (49/49). Skill unlocks never had been.

**51 of 51 loadout-unlock claims are exact** — 48 matched the extractor dump directly with
**zero** challenge-name and **zero** requirement-text mismatches. The three outside the dump
(`Blight`, `Beacon: Hacking`, `Beacon: Resupply`) are legitimately not `SkillFamily`
variants — Blight is a Passive, the beacons are Supply Drop options — and all three were
checked by hand against `Achievements.json`, matching name and description verbatim:

```
ACHIEVEMENT_CROCOKILLWEAKENEMIESMILESTONE_NAME  "Acrid: Easy Prey"
ACHIEVEMENT_CAPTAINBUYMEGADRONE_NAME            "Captain: Worth Every Penny"
ACHIEVEMENT_CAPTAINVISITSEVERALSTAGES_NAME      "Captain: Wanderlust"
```

**The gap this closed is worth naming.** `data:diff` confirmed each challenge *name existed
somewhere* in the game, and `data:audit` confirmed *slots*. Neither confirmed that a skill was
paired with the **right** challenge — a skill could have carried another skill's unlock
condition and every check would have passed. `data:audit` now cross-checks the pairing and the
requirement text; verified by swapping Acrid's Pandemic and Bad Medicine challenges and
watching it fail.

Survivors carry no unlock claims at all, so there is nothing to be wrong — a gap in coverage
rather than an error, and now a known one.

#### Parser discipline, fourth occurrence

The first run of this cross-check reported "**0** game pairs, 51 unverified" because I assumed
the wrong JSON shape. Reported as-is, that reads as *"no skill unlock is verified"* — a
completely false alarm that would have sent me rewriting correct data. The check now throws if
it parses zero pairs, and the permanent audit rule warns rather than silently passing. That is
the fourth time in this programme a silent-zero has had to be defended against (§3j.28, §3j.32,
§3j.41 being the others), and it is now the single most repeated failure mode on record.

### 3j.45 UI claims and the persistence layer — the first real *code* bug

Auditing the surfaces that are not stat values: the words the UI puts on screen, and the
store that holds a user's plan.

#### A UI tooltip was hedging on something already true

The Breakpoints page labelled Sentient Meat Hook and Tentabauble as *"RoR2's universal
proc-chance stacking; consistent but not individually decompiled"* — an admission that the
curve was assumed. Both were then read:

```
Sentient Meat Hook   (1f - 100f / (100f + 20f * n)) * 100f              // ConvertAmp, inlined
Tentabauble          ConvertAmplificationPercentageIntoReductionPercentage(5f * n * proc)
```

The assumption was right, and both rows are now **code-verified** rather than conventional.
But reading them surfaced a distinction the page could not show: **the two put the proc
coefficient in different places.** Meat Hook multiplies the finished chance by it; Tentabauble
folds it *inside* the amplification. Those are not the same function once the coefficient
leaves 1, so the table's percentages only hold for proc-1 hits — now stated on the page,
because a silent assumption in a table of exact-looking percentages is the same defect class
as a description that omits its scope.

#### The persistence layer trusted localStorage

`migratePlannerState` validated **v1** data and cast **v2** data straight to `PlanEntry`.
Probing it with hostile values, every one survived intact:

| Persisted value | Old behaviour |
| --- | --- |
| `{ state: "nonsense", priority: "high" }` | passed through |
| `{ state: "targeted" }` (no priority) | passed through, priority `undefined` |
| `42` | passed through — the UI then reads `42.state` |
| version `9` from a newer deploy | cast blindly |

localStorage is not a trusted store: it survives deploys, can be hand-edited, and can be left
half-written by a crash mid-write. Current-version data deserves exactly the same scepticism
as legacy data, and it was getting none — the asymmetry existed only because v1 needed a
transform and v2 did not, so nobody wrote a check.

Fixed with one `sanitizeEntry` applied to **every** version, including future ones: an invalid
`state` drops the entry, an invalid or missing `priority` is repaired to the default rather
than dropping a user's item, and a non-integer or non-positive `goal` is discarded while the
entry survives. Six new tests cover all of it.

This is the first defect in this programme that was a **code** bug rather than a data one, and
it is worth noting that it was found the same way as all the others: by asking what happens if
the input is not what I assume. Nothing about "the data is verified" implied the store that
holds it was safe.

### 3j.46 Share links and the goal bound — four entry points, one authority

Continuing into the code paths a user's data actually travels. `planUrl` decodes links written
by *other people*, which is the least trusted input on the site.

Most of it degrades well already — an unknown suffix falls back to the bare id rather than
producing a phantom, unknown ids are filtered, `CROWBAR` is rejected, and a
`crowbar<script>` token yields the id `crowbar` and nothing else. Two things did not:

```
?t=crowbar*99999999999999999999   ->  goal: 100000000000000000000   (and re-encodes into the next link)
?t=crowbar*0                      ->  goal: 1                       (a goal the link never expressed)
```

`Math.max(1, parseInt(…))` imposed **no ceiling** and **invented a floor**. Worse, the number
survived a round trip: encoding that plan produced `t=crowbar!h*100000000000000000000`, so one
hand-edited link would propagate to everyone it was shared with.

The bound already existed and was simply never enforced: the goal input is declared
`min={1} max={99}`, which is an HTML *hint* a user bypasses by typing or pasting. There were
**four** ways into `goal` and each had a different opinion:

| Entry point | Before |
| --- | --- |
| `GoalField` input | `min/max` attributes only — advisory |
| `setGoal` | `Math.max(1, floor(goal))` — floor, no ceiling |
| `decodePlan` | `Math.max(1, parseInt())` — floor, no ceiling |
| `migratePlannerState` | integer > 0 — and `Number.isInteger(1e20)` is **true** |

Now `MIN_GOAL`/`MAX_GOAL` are exported from the store as the single authority, and all four
enforce them. Out-of-range values from a URL are **dropped rather than clamped** — silently
turning someone's `*500` into `*99` would be inventing an intention, whereas dropping it
leaves the item targeted with no goal, which is what the link actually justifies. The setter
*does* clamp, because there the user is typing and immediate feedback is the point.

`importPlan` was also hardened. It is the landing point for a shared URL and took its argument
on trust; it now runs the same `sanitizeEntry` as rehydration. `decodePlan` already validates,
so this is defence in depth — but a public store action is exactly the thing a later caller
reuses without re-checking.

Nine new tests, including that an out-of-range goal cannot survive an encode/decode round trip.

Also removed a stale docstring my own §3j.45 edit had orphaned: the old v1→v2 migration
comment was left stranded above `sanitizeEntry`, describing the wrong function. Small, but
it is the second time in two passes that a correction left misleading documentation behind.
