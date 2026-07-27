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
