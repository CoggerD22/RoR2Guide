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

### 3j.47 The proc-coefficient gap closes — and 19 of 21 were never a gap

`skills.json` had carried 21 skills at `proc: null` since Phase 5, rendered in the Stat Lab as
"unverified" and reported by `data:audit` as a standing warning. The PLAN's own "next up" said
these needed splitting into genuinely non-damaging skills versus truly unknown ones. Doing it:

**19 of the 21 have no damage path at all. 2 have a verified coefficient of 0. None are unknown.**

`scripts/classify-nondamaging-skills.py` checks each skill's state class — and one transition
onward — for any damage-dealing API (`BlastAttack`, `OverlapAttack`, `BulletAttack`,
`FireProjectile`, `TakeDamage`, `InflictDot`, orbs, or a `procCoefficient` field). Deliberately
conservative: any hit at all keeps a skill out of the "no attack" category, because a false
"no proc" is a *claim* whereas a false "unverified" is only a shrug.

The 19 are what you would expect once stated plainly — Tactical Dive, Tactical Slide, both
Huntress blinks, Retool, Power Mode, both Engineer turret placements, Shadowfade, Trespass,
Sojourn, Reprieve, Meridian's Will, ADMIN-OVERRIDE, CMD-SWARM, Ascent Protocol, Repossess,
Salvage, Orbital Supply Beacon. Dashes, stance swaps, aim states and placements. **A dash does
not have an unknown proc coefficient; it has no attack.** Reporting that as unverified claimed
ignorance we did not have, which is the exact mirror of this project's usual failure mode and
just as misleading.

The two REX skills the classifier flagged as *damaging* resolve to a real zero:

```
DIRECTIVE: Disperse  FireSonicBoom.CalculateProcCoefficient() => return 0f;
Tangling Growth      FireFlower2: damageInfo.procCoefficient = 0f;
```

Both now `proc: 0, verified: true` with that provenance. Tangling Growth's is a self-damage
path (`attacker = null`, `NonLethal | BypassArmor`, applied to the caster) — the skill's own
hits genuinely carry no proc.

**125 skills: 106 with a verified coefficient, 19 with no attack, 0 unknown.**
`data:audit`'s long-standing proc warning is gone, replaced by an informational line.

A new schema field carries the distinction rather than overloading `proc`. The schema had an
explicit rule — *"a null proc means 'not yet verified', NOT 'does not proc'"* — so
`damaging: false` was added instead of setting `proc: 0`, which would have conflated "attacks,
with a coefficient of zero" (the REX case) with "does not attack" (the other 19). The Stat Lab
now renders "no attack" with its own tooltip, and its explanatory paragraph distinguishes the
two states.

The Playwright assertion that Tactical Dive reads "unverified" failed, correctly, and is now
`no attack` — the fifth test in this programme converted from asserting a gap to asserting a
fact.

### 3j.48 Shrine costs — the last `adequate: false` field on the site

`shrines.cost` was the final field still flagged as weakly sourced: an editorial one-liner
("Escalating gold", "Gold, repeatable") describing something the game states precisely.

Every shrine prefab carries a `PurchaseInteraction` with `cost`, `costType`,
`costMultiplierPerPurchase` and `maxPurchaseCount`. Reading them turns eight vague phrases
into exact ones:

| Shrine | Was | Asset values |
| --- | --- | --- |
| Chance | "Escalating gold" | cost 17, Money, x1.4, **max 2** |
| Blood | "50% → 75% → 93.75%" | cost 50, PercentHealth, x2 compounding, **max 3** |
| The Woods | "Gold, repeatable" | cost 25, Money, x1.5, **max 3** |
| Halcyon | "Gold, siphoned from nearby survivors" | drains 1 gold per tick at 5/s within 30m; tiers 75 / 150 / 300, difficulty-scaled |
| Cleansing Pool | "1 Lunar item or Lunar Equipment" | cost 1, `LunarItemOrEquipment` |
| Order | "1 Lunar Coin" | cost 1, `LunarCoin` — already exact |
| Combat, Mountain | "Free" | `CostTypeIndex.None` — confirmed free |

The purchase **caps** were the substantive gain: "repeatable" gave no hint that the Woods
stops after three uses or that Chance stops after two.

Shrine of the Mountain is worth a note — its prefab has `cost: 20` but `costType: None`, so
nothing is charged. Reading the number without the type would have invented a 20-gold price.

**Two rows are deliberately not numeric.** Shrine of Shaping takes a Soul offering and Shrine
of Rebirth takes an item choice; neither is a `PurchaseInteraction` price, so they describe a
mechanic and the provenance says so.

I also nearly recorded a false correction here. `HalcyoniteShrineInteractable` has
`maxGoldCost 300 / midGoldCost 150 / lowGoldCost 75`, and I briefly took that as proof that
"Shrine of Shaping" — whose cost we list as a Soul offering — was really a gold shrine. It is
not: the tokens are two different shrines, `SHRINE_COLOSSUS_NAME` = "Shrine of Shaping" and
`SHRINE_HALCYONITE_NAME` = "Halcyon Shrine". Both of our entries were right. Checking the
name token rather than trusting the association is what stopped it.

**Every field in `REFERENCE_PROVENANCE` is now `adequate: true`.** Nothing on the site is
shown with a source weaker than the claim it makes.

#### The test that punished finishing

The Playwright assertion for weakly-sourced fields required at least one to exist, so closing
the last one **broke the test for the crime of completing the work**. Restructured: it still
checks each dataset against `inadequateFields()`, and when none are weak it asserts exactly
that instead of demanding a failure to point at. Incentives in a test suite matter — one that
only passes while a gap remains will eventually be satisfied by leaving the gap.

### 3j.49 Power Elixir — the threshold is not what the wording says

**173 -> 174 of 217.** Both numbers in Power Elixir's description are exactly right, and the
condition behind them is not:

```csharp
public bool isHealthLow => (health + shield) / fullCombinedHealth <= lowHealthFraction;
lowHealthFraction = 0.25f;
...
HealFraction(0.75f, default(ProcChainMask));
```

"Taking damage to below 25% health" is measured on **health plus shield over combined
health**, not health alone. On a Transcendence or Silence Between Two Strikes build — where
almost all of the pool is shield — the item fires at a materially different point than the
sentence implies, and a player relying on "25% health" would misjudge it. `HealFraction(0.75f)`
is also 75% of *maximum* health, not of missing health, which the wording leaves ambiguous.
Both recorded.

**Ghor's Tome is deliberately left `langfile`.** Its 4% per stack is verified —
`LocalCheckRoll(4f * n)` — but the "$25" is not: the handler spawns
`Prefabs/NetworkedObjects/BonusMoneyPack`, and that prefab carries **no `goldReward` component
at all**. The only objects with `goldReward` in the whole bundle set are the three barrels
(Barrel1 8, VoidCoinBarrel 25, DrifterBarrel 4). VoidCoinBarrel's 25 is a tempting match and
is a *different object* — taking it would be exactly the Halcyon/Shaping mistake from §3j.48,
where a plausible number from a neighbouring prefab nearly became a false correction. Half the
record is verified, so the record is not.

That is now the standing shape of the remaining backlog: most of the surviving 43 are not
unverifiable, they are **partially** verified — a chance confirmed but a payout not, a radius
found but a coefficient's composition ambiguous. Upgrading them on the verified half would
inflate the coverage number while leaving the unverified half indistinguishable from the rest,
which is the precise failure this programme was built to end.

### 3j.50 Stun Grenade is hyperbolic — and a sweep of every hyperbolic call site

**174 -> 175 of 217.** Stun Grenade was recorded as `linear`, 5% per stack. It is not:

```csharp
Util.CheckRoll(Util.ConvertAmplificationPercentageIntoReductionPercentage(
    stunChanceOnHitBaseChancePercent * n * damageInfo.procCoefficient))   // 5f
SetStun(2f);
```

That is the Tougher Times curve. The real chance is **4.76%** at one stack, 9.09% at two,
13.04% at three, and **33.3% at ten — not 50%**. A wrong `type` is worse than a wrong number
here, because the sparkline is *computed* from it: the codex was drawing a straight line to
50% for a mechanic that asymptotes. `base` stays 5 per the schema convention for hyperbolic
entries (it is the amplification input, not the displayed chance), and the proc coefficient is
folded **inside** the amplification, as with Tentabauble.

#### Sweeping every hyperbolic site

Finding one mis-typed curve is a reason to check for others, so I enumerated every call to
`ConvertAmplificationPercentageIntoReductionPercentage` and every inlined
`1f - 100f / (100f + …)` in the assembly. There are five:

| Site | Item | Status |
| --- | --- | --- |
| `HealthComponent:1170` | Tougher Times (15) | already hyperbolic |
| `CharacterBody:3363` | Old Guillotine (13) | already hyperbolic |
| `GlobalEventManager:493` | Tentabauble (5) | verified §3j.45 |
| `SetStateOnHurt:102` | **Stun Grenade (5)** | **corrected here** |
| `AttackSpeedPerNearbyCollider:96` | Bolstering Lantern (5) | **dead code — see below** |

Plus the two inlined forms already verified: Sentient Meat Hook and Bandolier. So the
hyperbolic surface is now fully accounted for, and Stun Grenade was the only one wrong.

#### A computed value that goes nowhere

`AttackSpeedPerNearbyCollider.UpdateValues` computes
`radiusSizeGrowth = ConvertAmp(itemCount * 5)` and then sets `diameter = 40f` unconditionally.
`radiusSizeGrowth` is **assigned once and never read anywhere in the assembly** — so Bolstering
Lantern's radius is a flat 20m regardless of stacks, exactly as its description says.

Had I taken the computed value as live, I would have added a "radius grows per stack" claim
that is simply false — the same trap as Unstable Transmitter's unused `public const` fields in
§3j.31. Twice now, a plausible-looking constant has been dead. **Assignment is not evidence of
effect; only a read is.**

#### My own escaping mistake, caught

Writing the formula through a shell string let the backticks around `` `base` `` be evaluated
as a command substitution, and the word was silently deleted from the stored text. Repaired via
the Write tool, and I then scanned every formula in the dataset for the same corruption
signature — zero others. This is the fourth time shell quoting has damaged content in this
project; the rule to write files with the editor rather than heredocs exists precisely for it,
and I broke it again.

### 3j.51 Sweeping the other curve shapes — all correct, and a near-miss worth recording

§3j.50 found a mis-typed *curve*, which is a different defect from a wrong value: the sparkline
is computed from `type`, so getting it wrong draws a line the game never follows. Having swept
every hyperbolic site, this pass swept the other two shapes.

**Exponential** — every `Mathf.Pow` in `RecalculateStats`/`HealthComponent`/`GlobalEventManager`
whose exponent is an item count:

| Code | Item | Recorded |
| --- | --- | --- |
| `Mathf.Pow(2f, n)` on health, `- 1f` on damage | Shaped Glass | exponential ✓ |
| `15f * Mathf.Pow(0.9f, n)` cooldown | Safer Spaces | exponential ✓ |
| `0.7f * Mathf.Pow(0.9f, n-1)` x3 stats, `armor -= 35 + 15(n-1)` | Neutronium Weight | exponential + linear ✓ |
| `Mathf.Pow(0.95f, n)` | Tonic Affliction | verified §3j.25 |
| `Mathf.Pow(2f, n)` | `DroneUpgradeHidden` | not player-facing |

**Reciprocal** — every `/= (count + 1)`:

| Code | Item | Recorded |
| --- | --- | --- |
| `num110 /= (n + 1)` attack speed | Light Flux Pauldron | reciprocal ✓ |
| `num78 /= (n + 1)` health | `CutHp` (NoTier, Swarms artifact) | not an item |

**All correct.** Stun Grenade was the only mis-typed curve in the dataset, and the shape
surface is now fully swept: hyperbolic, exponential and reciprocal all traced to their call
sites and matched against `type`.

#### A near-miss, and the third of its kind

Reading `num56 = Items.TransferDebuffOnHit` I read the *name* — "transfer debuff on hit" — and
concluded it was **Noxious Thorn**, whose description is about transferring debuffs. On that
reading, Noxious Thorn silently inflicts −30% damage, −30% attack speed, −30% movement speed
and −35 armor on its holder while in combat, with none of it documented. That would have been
the largest omission in this log.

It is **Neutronium Weight**, a Lunar item, and its record already carries all four penalties,
correctly typed, code-verified. Nothing was wrong. Noxious Thorn is `TriggerEnemyDebuffs`, and
the verification of it in §3j.22 was correct.

This is the **third** near-miss of exactly this shape in three passes — Halcyon vs Shrine of
Shaping (§3j.48), VoidCoinBarrel's 25 vs Ghor's Tome (§3j.49), and now this. All three are the
same error: a plausible *association* between a name or number and the wrong entity. All three
were stopped by the same discipline — resolve the `cachedName` to its display name through
`itemdefs.json` and check, rather than trusting that a name means what it sounds like. Given
the rate, that resolution should be reflexive before any correction, not a step I remember to
take.

### 3j.52 Three more items — War Bonds has a whole second behaviour

**175 -> 178 of 217.** Every recorded number correct; the gaps are again about *scope*.

| Item | Code | Result |
| --- | --- | --- |
| Shuriken | `body.damage * (3f + 1f * stack)`; `stack + 2` held | exact |
| Unstable Tesla Coil | `body.damage * 2f`; `bouncesRemaining = 2 * stack` | exact |
| War Bonds | `(maxHealth + maxShield) * (stack * 0.025f)`; `15 + stack * 5` | exact, see below |

**War Bonds does something entirely different to non-bosses.** The description is only about
bosses — "2.5% of the boss's max health" — but the damage function has two branches:

```csharp
if (isBoss) return (targetBody.maxHealth + targetBody.maxShield) * (stack * bossHealthDamageRatio);
return body.damage * normalEnemyDamageRatio;   // 32f
```

Against anything that is not a boss the missiles deal **3200% of your damage**. That is not a
footnote; it is a second mode the item never mentions. Its boss figure is also measured on
**max health plus shield**, and the "per 50 gold" threshold is `GetDifficultyScaledCost(50)`,
so it climbs as the run's difficulty coefficient does — late-run missiles cost considerably
more than 50.

**Unstable Tesla Coil** gained two omissions: the orb's `procCoefficient` is only **0.3**, so
it triggers on-hit items far less than its hit count suggests; and it fires on a `1/12`s
interval with the target list clearing every `0.5`s, rather than the flat "every 0.5s" the
description implies.

**Shuriken** was exact on both values. Worth noting its named constants
(`damageCoefficientBase = 3f`, `numShurikensBase = 2`) are **not** what the code reads — the
firing line inlines `3f + 1f * stack` and `stack + 2`. The values agree, so nothing is wrong,
but after Bolstering Lantern's dead `radiusSizeGrowth` and Unstable Transmitter's unused
`public const`s (§3j.31, §3j.50) the rule stands: **read the use site, not the constant**. Three
times now a named constant has been decorative; this is the first where it happened to match.

### 3j.53 Substandard Duplicator — "an additional 10 seconds" additional to what?

**178 -> 179 of 217.**

```csharp
float itemDecayDurationServer = 80f + (float)(stack * 10);
base.body.inventory.SetItemDecayDurationServer(itemDecayDurationServer);
```

The game's own text — "Temporary items last an additional 10 (+10 per stack) seconds" — is
arithmetically correct and practically useless, because the **80-second base it is additional
to is installed by this very item** and appears in no description anywhere. A player reading
it reasonably concludes a temporary copy lasts about ten seconds. It lasts **ninety**.

This is a different failure from the ones catalogued so far. Not a wrong number, not an
omitted side-effect, not a scope error — a number that is *right* and *unanchored*. "+10 per
stack" is true; "additional" has no referent the player can see.

Recorded both ways: the per-stack increment stays 10 (it is what the code adds), and the note
states the real lifetime, 90s at one stack and +10 from there.

I also checked whether 80 might be a general engine default rather than this item's doing —
`Inventory.tempItemsStorage` initialises `decayDuration = 1f`, and `SetItemDecayDurationServer`
has exactly one caller, this behaviour. So the 80 is genuinely the Duplicator's, not a
pre-existing baseline it adds to.

### 3j.54 Partial evidence, recorded without inflating the count

Two more records reached the state §3j.49 predicted would dominate the tail: **half verified,
half not.** Neither is upgraded, and the verified half is written down anyway.

**Defense Nucleus** — `CharacterMaster.GetDeployableSameSlotLimit` gives
`result = n * 4` for `DeployableSlot.MinorConstructOnKill`, so "Limited to 4 (+4 per stack)"
is exact, and the spawn is gated on `victimBody.isElite` exactly as described. The construct's
stated **300% damage / 300% health** is not in the spawn path. Goobo Jr. (§3j.40) turned out to
get its identical-sounding 300%/300% from twenty `BoostDamage`/`BoostHp` items on the summoned
master, so the same mechanism is likely here — *likely* being the reason this stays `langfile`.

**Sale Star** — `InteractionDriver` confirms which interactables qualify
(`PurchaseInteraction.saleStarCompatible`) and that the highlight only appears on a chest you
can afford. The 5%-per-stack chance for additional items is not in that path.

Recording evidence on a record that stays unverified is worth doing rather than skipping: the
next person to look at Defense Nucleus should not have to re-derive the deployable limit to
discover that the *construct stats* are the open question. The formula field is the working
note, not just the certificate.

**179 of 217.** The count did not move, which is the correct outcome for a pass that verified
two halves. A programme whose number only ever goes up is one that has started rounding.

### 3j.55 Dio's Best Friend — and the audit catching my own edit

**179 -> 180 of 217.** `CharacterMaster` consumes exactly one stack per death (an
`ItemTransformation` of `ExtraLife` into `ExtraLifeConsumed`), and `RespawnExtraLife` does
`AddTimedBuff(RoR2Content.Buffs.Immune, 3f)` — so both the one-life-per-stack behaviour and
the stated 3 seconds are confirmed. Undocumented: the respawn is at your death position, but
if an unsafe area killed you the game searches for a safe destination first rather than
dropping you back into it.

**The interesting part is that the audit rejected the upgrade.** Marking the record `code`
immediately failed the build:

> `Dio's Best Friend: verified value(s) Extra lives.base=1, Extra lives.perStack=1 do not
> appear in the description, and there is no descriptionNote explaining the discrepancy`

Correct, and I had not noticed. The in-game text — *"Upon death, this item will be consumed
and you will return to life with 3 seconds of invulnerability"* — never says what stacking
does. Our `1 / +1` is right, and it was about to be published as a verified number the
description gave no support for.

That rule was written in §3j.31 for the opposite case: descriptions that *contradict* a
verified value. It turns out to catch this one too — descriptions that are *silent* where we
assert. Both are the same defect from the reader's side: a number on the page with nothing
visible behind it. Note added, stating that N copies is N extra lives and that the
invulnerability applies to every revive rather than only the first.

A guard that fires on the author who wrote it is the only kind worth having.

### 3j.56 Extending §3j.55's check to unverified records — Rusted Key's stat was fiction

The rule that caught Dio's Best Friend only applies to **code/asset** records. Running the same
question over `langfile` ones — *does this record publish a stacking value its description never
states?* — returned exactly two, and one was wrong.

**Pluripotent Larva** is verified: `ExtraLifeVoid -> ExtraLifeVoidConsumed` once per death,
`AddTimedBuff(Buffs.Immune, 3f)`, then a walk of `ContagiousItemManager.transformationInfos`
calling `TryForceReplacement` on each — which is the "all of your items that can be corrupted
will be" clause, confirmed. Note added, as with Dio, because the description says nothing about
stacking.

**Rusted Key carried a stat that was not real.** It recorded `Lockbox behavior = 1 (+1 per
stack)`, which reads as "each key adds something per stage". The code says otherwise:

```csharp
foreach (CharacterMaster m in CharacterMaster.readOnlyInstancesList)
    if (m.inventory.GetItemCountEffective(TreasureCache) > 0) num5++;   // per PLAYER, not per key
for (int j = 0; j < num5; j++) TrySpawnObject(iscLockbox, …);
```

`> 0` is a boolean. **One lockbox spawns per player who holds any key**, and a second key adds
nothing to that stage. Opening one *consumes* a key (`CostTypeIndex.TreasureCacheItem` transforms
it to `ItemIndex.None`), so N keys is N openings spread across a run — a real per-stack effect,
but a completely different one from what the row implied.

The stat is renamed to what it actually measures and the note says plainly that stacking does
not add caches.

Worth naming the defect class, because it is new here: not a wrong number, not an omission, but
a **stat row that was never a statistic**. "Lockbox behavior = 1 (+1)" is not a measurement of
anything — it was a placeholder that acquired the authority of data by sitting in a column of
real numbers. The audit could not catch it because the value was internally consistent; only
asking "what would this number mean?" does.

### 3j.57 "Stacking stops working past 1" — reported by the user, and they were right

Reported: adding a second Predatory Instincts or Harvester's Scythe changes nothing in the
Stat Lab. The arithmetic was correct and the presentation was not.

Both items grant a flat **+5% critical chance that genuinely does not stack** —
`if (count > 0) crit += 5f`, verified in §3j.37 — so `perStack: 0` is right. But that is only
a rider. Their actual per-stack effects are:

- **Predatory Instincts** — raises the ceiling on attack speed gained from critical strikes
  (36%, +24% per stack). A buff that accumulates as you crit, so it has no fixed value to put
  on a static sheet.
- **Harvester's Scythe** — increases the heal per critical strike (8, +4 per stack). An on-hit
  event, not a stat.

Neither is *computable* as a static number, so excluding them is a defensible modelling
boundary. Presenting that boundary as silence is not: the picker offered the items, took the
second stack, and changed nothing, which reads as a broken calculator.

**This is the same defect the whole programme exists to correct, in the calculator instead of
the data**: an absent number reading as "no effect" rather than "not shown here". It is the
mirror of §3j.47, where 19 skills were labelled "unverified" when they simply had no attack —
there I was overstating ignorance, here I was understating scope.

Checked systematically rather than fixing the two that were reported: of every Stat Lab item,
exactly these two model a non-scaling stat while the codex records a scaling one. Shaped Glass,
Irradiant Pearl and Laser Scope all scale correctly (probed 1 -> 3 stacks through
`computeStats`, confirming which outputs move).

Fixed with `UNMODELED_STACKING`: an amber `1x` marker in the picker, and — once a second copy
is actually added — a spelled-out explanation on screen. A tooltip alone would only help
someone who already suspected a problem, and the person who hit this had no reason to.

**The reporting matters more than the fix.** Every automated check I have compares our data to
the game; none of them can notice that a correct number is being *presented* misleadingly.
That gap is only closed by someone using the thing.

### 3j.58 §9 surface audit, first pass — three more placeholder rows and a misdirecting empty state

PLAN §9 is now written: a phase for the axis §6A cannot test. §6A asks *is this the game's
number*; §9 asks *does a reader who is not us come away believing something true*. The
Predatory Instincts report proved the second can fail while the first passes, and that no
check in this repository could ever have noticed.

First pass findings.

#### Two more rows that were never measurements

A scan for stat labels naming no unit or basis surfaced 36 candidates, most of them fine
("Attack speed", "Max Beetle Guards" — clear from context). Two were the Rusted Key defect
(§3j.56) repeated:

- **Encrusted Key** — `Void cache behavior = 1 (+1)`. The spawn code is identical to Rusted
  Key's: `GetItemCountEffective(TreasureCacheVoid) > 0` increments once per **player**, so
  extra keys add no caches. Worse, its formula field asserted *"additional keys raise the
  cache item's rarity"* — a mechanical claim that appears nowhere in the spawn path and was
  never sourced, sitting in the field the UI presents **as provenance**. Removed rather than
  restated: an unverified claim is worse in a provenance field than anywhere else on the site.
- **Shipping Request Form** — `Delivered item rarity = 1 (+1)`. Here the *formula* is correct
  and code-verified (weights `0.79`, `0.20n`, `0.01n²`), but the row's numbers measure
  nothing. Renamed to the quadratic term it actually is, with the resulting split spelled out,
  because no single per-stack number can express a quadratic.

That is **three** placeholder rows found in two passes. Each was internally consistent, so no
validator could object; each acquired the authority of data by sitting in a column of real
numbers. The only detector is asking *"what would this number mean?"* of every row.

#### An empty state pointing at the wrong control

Searching for a typo rendered *"No items match those filters."* — sending the reader to the
tier and DLC buttons when the cause was the search box. Now names the query, and suggests the
right remedy for each cause. Small, and precisely the §9 class: correct behaviour, wrong
explanation.

#### Verified as fine

Checked and correct, recorded so they are not re-examined blind: the planner's empty rail
("Nothing yet" per section), Crowbar's unlock badge (genuinely gated behind *The Basics* —
`Items.Crowbar` → `Discover10UniqueTier1`, so the lock is not spurious on a starting-looking
item), the Stat Lab's own disclosure that conditional items are not modelled, and its
"DPS proxy" label, which is honest about being a proxy.

### 3j.59 §9 surface audit, second pass — the Stat Lab was publishing a health total nobody has

The §6A programme verified `items.json` against the game. It never verified the **Stat
Lab**, which is a second implementation of the game's arithmetic. Three defects, all found
by reading `RecalculateStats` beside `statMath.ts` line for line.

#### Transcendence: modelled as a bonus, when it is a conversion

`statItems.ts` had Transcendence as `healthPct: base 50, perStack 25` — a flat percentage
into the same pool as Pearl. The game:

```csharp
if (num74)                                             // num15 = ShieldOnly > 0
{
    num81 += maxHealth * (1.5f + (float)(num15 - 1) * 0.25f);   // -> maxShield
    maxHealth = 1f;
}
```

Three separate errors followed from one wrong model:

1. **The number was attached to the wrong pool.** The Stat Lab printed *Max Health 165* for
   a Commando who in fact has **1** max health and a 165 shield. Shield recharges by itself
   out of combat and **cannot be healed** — so the Health Regen card beside it, and every
   healing item, were quietly describing a resource the player no longer has.
2. **The arithmetic was wrong too.** The multiplier applies to the *finished* health total,
   so it compounds with percentage health items instead of adding to them. Transcendence ×3
   with a Pearl: game `(110 × 1.1) × 2.0 = 242`; the old model gave `110 × 2.10 = 231`.
3. **`effectiveHealth` ignored shield entirely**, because before this nothing in the picker
   could produce any. `HealthComponent.fullCombinedHealth` sums health + shield + barrier.

Fixed by modelling the conversion, adding `maxShield` / `combinedHealth` / `shieldOnly` to
`DerivedStats`, showing a Max Shield card with what shield actually is, and warning on the
Health Regen card. `items.json`'s formula field had the mechanic *right all along* — the row
label said "Maximum health (%)", so the codex was accurate and the calculator was not. The
row is now "Shield, as a % of your max health" at 150 (+25), with a `descriptionNote`
explaining why the game's own text says 50%: a 150% shield replacing 100% health is a net
+50% pool.

#### Shaped Glass shares the damage pool

`num103 += Mathf.Pow(2f, num28) - 1f` sits in the same additive running total as Irradiant
Pearl's `+= num31 * 0.1f`. We multiplied them separately: 1 glass + 1 Irradiant gave **2.2×**
where the game gives **2.1×**. Health is genuinely two steps (percentage pool, then the
`cursePenalty` divisor), which is presumably how the damage side came to be written the same
way.

#### `cursePenalty` divides shield as well

`maxHealth /= cursePenalty; maxShield /= cursePenalty;` — Shaped Glass halves the
Transcendence shield too. Unreachable before, since shield was never non-zero.

#### Confirmed correct while there

Read and matched to the code rather than assumed: the attack-speed, move-speed, armor and
crit pools all take Irradiant Pearl additively, exactly as modelled; `critMultiplier =
2f + 1f * LaserScope`; Artifact of Glass is `×5` damage and a `×10` `cursePenalty`, both
separate multipliers, as modelled. `baseCrit` is 1 and `levelCrit` 0 for **all 19**
survivors (checked against the extracted bodies, where every monster is 0), so the hardcoded
base 1% is right. **No survivor body has a `baseMaxShield`** — of 241 extracted bodies only
`SolusVendorBody` does — so starting shield is genuinely zero and item-granted shield is the
whole story. `extract-bodies.py` now pulls `baseMaxShield`/`levelMaxShield` so that claim is
re-checkable after a patch instead of resting on this one reading.

Lesson, and it is the §9 thesis in one line: **a second implementation of the game's
arithmetic is a second dataset, and it was never being audited.**

### 3j.60 §9 surface audit, third pass — one sentence that was false on 28 rows

The item detail panel rendered every stacking row the same way:

> **15** base, **+15** per stack

That sentence is true for `linear`. It is one of the 177 rows' honest description. On the
**28 non-linear rows** it invites the reader to do arithmetic the game does not do:

| Item | Rendered as | Reader computes at 2 stacks | Actual |
|---|---|---|---|
| Mercurial Rachis | 16 base, +50 per stack | 66 m | **24 m** (16 × 1.5) |
| Old War Stealthkit | 30 base, −50 per stack | −20 s | **15 s** (30 × 0.5) |
| Tougher Times | 15 base, +15 per stack | 30% | **23.08%** |
| Bandolier | 20.4 base, +10 per stack | 30.4% ✓, then 40.4% at 3 | **36.7%** at 3 |

`perStack` carries three unrelated meanings across the schema — an addend (linear), a
multiplier (exponential / reciprocal), and an amplification input (hyperbolic) — and all
three were being printed into the same visual slot with the same words. Every one of these
rows already carried a `formula` field saying the right thing in the very next line; a
reader who reads bold numbers and skips monospace paragraphs got the wrong answer anyway.
That is the §9 thesis again: **correct data, false presentation**, and no data check can see
it.

Non-linear rows now read "16 **at one stack**, +50 per stack — *is a multiplier applied per
stack, not a number added*", and hyperbolic rows additionally print their real curve
(13.0 at 1 · 23.1 at 2 · 31.0 at 3 · 46.2 at 5 · 60.0 at 10) computed from
`Util.ConvertAmplificationPercentageIntoReductionPercentage` rather than restated. Unstable
Transmitter is hyperbolic in a different shape (`perStack` is 0, the stack term lives in its
own formula) and is deliberately excluded — drawing the generic curve there would be an
invention.

Four unit tests and one Playwright test now hold this: one of them walks all 217 items and
fails if any non-linear row is left with a bare additive per-stack number.

#### Breakpoints tab: checked, no change needed

All four hyperbolic rows re-verified at their call sites — Tougher Times `15f` in
`HealthComponent`, Old Guillotine `13f` in `CharacterBody.executeEliteHealthFraction`,
Tentabauble `5f` in `GlobalEventManager`, and Sentient Meat Hook's `20f`, which is written
out inline rather than through the shared helper and so does not appear in a search for it.
The proc-coefficient caveat already on that tab is correct, including the subtlety that Meat
Hook multiplies the finished chance while Tentabauble applies the coefficient inside the
curve.

### 3j.61 §9 surface audit, fourth pass — the sheet had a difficulty setting it never told you about

Every number in the Stat Lab, and every base stat on a survivor page, was a **Rainstorm**
number. Nothing said so, and the difficulty is not cosmetic:

```csharp
// Run.cs, at spawn
if (selectedDifficulty == DifficultyIndex.Easy)
    inventory.GiveItemPermanent(RoR2Content.Items.DrizzlePlayerHelper);
else if (difficultyDef.countsAsHardMode)
    inventory.GiveItemPermanent(RoR2Content.Items.MonsoonPlayerHelper);
```

Both are read by `RecalculateStats`, and between them they move two of the ten cards:

- **Drizzle** — `num94 += 0.5f` (regen ×1.5) *and* `armor += num26 * 70f`. A Drizzle player
  reading our Commando sheet was 0.5 hp/s and **70 armor** out.
- **Monsoon** — `num94 -= 0.4f` (regen ×0.6). Keyed on `countsAsHardMode`, so Typhoon and
  Eclipse carry the same item; the control says so rather than implying Monsoon is special.
- **Rainstorm** — neither item. It is the only difficulty for which the raw body stats are
  the truth.

The Stat Lab now has a three-way control, and the survivor page's footnote — previously
*"Regen figures are Rainstorm-standard"*, true but naming only half of it — now names the
armor grant too, since the Armor row was exactly as difficulty-dependent as the regen row
and said nothing.

Two ordering details are in the model, not just the prose: difficulty multiplies the
**finished** regen total (`num96 = (base + items × levelFactor) × num94`), and Drizzle's +70
lands **after** the Irradiant Pearl multiplier (`armor *= 1f + 0.1f * num31;` *then*
`armor += num26 * 70f;`), so a Pearl does not scale it. Both are pinned by tests.

#### A latent trap: armor had two branches and we implemented one

`effectiveHealth` used `(100 + armor) / 100`. That is the exact algebraic simplification of
the game's positive branch, and nonsense below zero — at −100 armor it reports **zero**
damage taken, i.e. infinite effective HP. `HealthComponent` is explicit:

```csharp
num7 = (armor >= 0f) ? (1f - armor / (armor + 100f)) : (2f - 100f / (100f - armor));
```

No survivor has negative base armor and nothing in the picker reduces it, so this was never
live — but it would have gone live silently the first time an armor-reducing item was added
to the Stat Lab, with no test failing. Both branches are now implemented and both are
tested, including that the positive branch still equals the old shortcut to ten decimals.

#### Checked, no change needed

- **No survivor scales armor, move speed, attack speed, jump power or crit with level** —
  all five `level*` fields are 0 on all 19 survivor bodies, so the survivor table's blank
  growth column is correct rather than merely unfilled. The footnote now says this outright.
- **Hard-cap triage re-read.** Of the five candidates, two (`Elusive Antlers`, `H3AD-5T v2`)
  are `(!inventory) ? 1 : count` null guards rather than caps and are correctly excluded;
  Longstanding Solitude's cap of 3 is recorded; Fuel Cell's is a 255-stack byte clamp.
  Pocket I.C.B.M.'s missile *count* is `(n <= 0) ? 1 : 3` — a genuine one-stack ceiling —
  and `items.json` already states it in that row's formula. The planner's "caps at N" badge
  is complete for what the data records.
- **Shrine `cost` provenance** is `adequate: true`, read from each prefab's
  `PurchaseInteraction`. An older note in this log calling it an editorial summary is stale.
- **No UI copy hardcodes a data count** that could drift; the one instance introduced in
  this pass was rewritten before it landed.

### 3j.62 §9 surface audit, fifth pass — thirteen artifacts whose "the code adds nothing" was untrue

The artifacts tab has carried a two-layer design since M6: the game's own description, quoted,
and beneath it a green **"Verified mechanic — from game code"** panel. Seven artifacts had the
second layer. The other thirteen carried a doc comment justifying the gap:

> *Omitted where the description is purely qualitative and the code adds nothing.*

That is a claim about game code, sitting in the file that is supposed to be sourced from game
code, and it was **wrong for all thirteen**. Each was read from its implementation:

| Artifact | What the description never says |
|---|---|
| **Honor** | Promotes into exactly **four** elite types — `eliteDefs = { Fire, Lightning, Ice, Earth }`. Malachite, Celestine, Void and Perfected are not in that array and Honor never produces them. |
| **Command** | Strips the stage of everything that already offered a choice: every interactable with a `ShopTerminalBehavior`, `MultiShopController` or `ScrapperController` is removed. Multishops and scrappers stop spawning. |
| **Delusion** | A wrong guess does `RemoveItemPermanent` on the item you picked — and the decoys are drawn **from your own inventory**, so a wrong answer deletes one of your items rather than forfeiting a reward. |
| **Vengeance** | The doppelganger carries a hidden `InvadingDoppelganger` item that `RecalculateStats` reads twice: `num78 *= 10f` and `num101 *= 0.04f` — **ten times your health, four percent of your damage**. |
| **Death** | Does *not* kill the team if the victim had a revive: Dio's, Pluripotent Larva, `ExtraLifeBuff`, a Seed of Life, or Seeker self-revive. |
| **Dissonance** | Does not widen the pool — it **replaces** it with `mixEnemyMonsterCards` trimmed to 3 Basic / 3 Miniboss / 3 Champion cards. Nine monster types, and the stage's usual residents may not be among them. |
| **Soul** | `WispSoulBody` has a **negative** regen (-3/s, -0.6/level), so the wisps bleed out on their own. |
| **Metamorphosis** | Re-rolls on **every** respawn, and only ever into survivors *that player has unlocked* (`networkUser.unlockables`). |
| **Devotion** | Followers get `BoostHp`/`BoostDamage` in counts of 10/20/10/20 by level — at 10% each, a level-1 follower is at **+200%** health and damage. |
| **Kin** | Picks one card affordable within `40 x difficultyCoefficient` credits (50 on Void Fields), max 5 spawns (6), min 1 (2). |
| **Chaos** | The gates apply no multiplier, and the class's one damage-scale field (`friendlyFireDamageScale = 0.5f`) has **zero callers in RoR2.dll** — checked at IL level. Friendly fire is full damage. |
| **Rebirth** | Exactly **one** item per run, consumed; a random `rebirthDropTable` roll if you banked none. |
| **Enigma** | Pool is `enigmaEquipmentList` filtered by enabled expansion; MUL-T is special-cased to two slots. |

Two guards came out of writing them:

- **A name resolved before it was published.** The Death write-up first said "the Delicate
  Watch-style HealAndRevive equipment" — a vague analogy standing in for a name I had not
  looked up. `EQUIPMENT_HEALANDREVIVE_NAME` is **Seed of Life**. This is the third time a
  `cachedName` has nearly been published as a guess; the rule holds — resolve the token first.
- **A near-miss on attribution.** `PrestigeBulwarkManager`'s cost formula
  (`max(overrideCost, 600 x compensatedDifficultyCoefficient^0.5) x (1 + mountainShrineCount)`)
  is the **Bulwark's Ambry trial** for unlocking Prestige, not what Prestige does in a run.
  Filing it under the artifact's effect would have been the Halcyon/Shaping error again. It is
  deliberately not in the artifact's mechanic string.

Three tests hold the layer: every artifact must have a mechanic; no mechanic may be a
paraphrase (it must introduce at least ten terms absent from the description — this test is
what caught Vengeance's original one-liner as too thin, which is how the x10/x0.04 was found);
and exactly one artifact may lack an Ambry code, Rebirth, which is unlocked at a Shrine of
Rebirth instead.

#### A disclaimer that had become false

The shrine cost badge carried `title="Our summary, not game data"`. That stopped being true
when the costs were re-read from each prefab's `PurchaseInteraction`. A **false disclaimer is
its own defect**, and a mirror image of the ones §9 usually finds: it tells the reader that a
verified figure is our guess, which sends them to a worse source to check it. Understating
provenance and overstating it are the same failure — the badge now names the field it came from.

### 3j.63 §9 surface audit, sixth pass — the last audit warning was real, and a lossy share link

#### Fuel Array: a cooldown on an equipment that cannot be activated

`data:audit` had carried one standing warning for several passes:

> ⚠ Fuel Array: has a 60s cooldown but the description never states it

It had been read as a quirk of the game's text. It was our defect. Fuel Array has **no fire
handler in `EquipmentSlot` at all** — the entire behaviour is a state machine attached to the
body — so there is nothing a cooldown could gate, and `activated: true` was wrong too. The
audit rule was doing its job; the warning was being tolerated rather than answered.

Reading `EntityStates.QuestVolatileBattery` gave four numbers the description omits, and one
correction to what the description *implies*:

- `Monitor.healthFractionDetonationThreshold = 0.5f`, tested against
  `HealthComponent.combinedHealthFraction` — health **plus shield and barrier**, not health
  alone — and only on the crossing (`frac <= 0.5f && 0.5f < previousFrac`), so it arms once as
  you fall past half rather than re-arming while you stay there.
- `CountDown.duration = 3` and `explosionRadius = 30` (both from the EntityStateConfiguration,
  which is why they are in no C# literal).
- The blast is a `BlastAttack` with **`falloffModel = None`** — every target inside 30 m takes
  full damage — and `procCoefficient = 0`, so it triggers no on-hit items.
- `baseDamage = fullCombinedHealth * 3f`. The description's "300% of your maximum health" is
  measured against the **combined** pool, which matters enormously to a Transcendence build.

And the fact a player most needs: the countdown checks only `fixedAge`, so **healing back above
half does not stop it**.

`data:audit` now reports *All checks passed* with zero warnings, and the coverage floor rises
to 182/217.

#### A shared plan that was not the plan you made

`encodePlan` omitted a goal of 1 as "adds nothing" — and there was a test asserting that. It
adds something: the rail renders "×1" for a goal of 1 and "+goal" for none, so a link shared by
someone who had set "one is enough" arrived showing no goal at all. Silent loss between what
was configured and what was sent.

It is also the wrong number to drop, given what these audits established: "one is enough" is the
*correct* plan for Rusted Key, Encrusted Key and Longstanding Solitude past 3, where extra
stacks genuinely do nothing. The one goal value the encoder discarded was the one the data most
often justifies. Fixed, with the old test rewritten to state why rather than deleted.

### 3j.64 §9 surface audit, seventh pass — two pages describing the same skill two ways

`data:audit` has used a three-state model for proc coefficients since §3j.47: **verified**
(we have the number), **no damage path** (there is no number to have), and **unknown**. That
split is what corrected the reported proc gap from 21 skills to 2, and then to 0.

The Stat Lab learned it. The **survivor page never did.** It rendered
`k.verified ? proc N : "proc unverified"` — two states — so all 19 non-damaging skills read
*"proc unverified"* there while the Stat Lab said the value did not apply. The same fact,
described two ways, on two pages of the same site, and the wrong way on the page a reader is
more likely to open.

It compounded in the header. `{verified}/{totalSkills} procs verified vs game data` counted
"not applicable" against "verified", so **Commando read 4/6** — advertising two unknowns in a
kit where nothing is unknown. And the footnote defined the state a reader was seeing as *"we
could not establish a value from game data"*, which is the exact opposite of the truth for all
19: we established it, and the answer was that there is nothing to establish.

Fixed by giving the page the audit's own three states. The header now reads *"Every proc
coefficient accounted for (N verified, M not applicable)"* whenever nothing is genuinely
unknown, with the breakdown on hover, and falls back to a ratio over **applicable** skills if
that ever stops being true.

#### And a wording fix that outgrew its original case

The label was *"no attack"*, chosen when the classified skills were dashes and stance swaps.
The set has since grown to include **Engineer's turrets and Captain's supply beacon** — and
"no attack" on a turret skill invites exactly the wrong conclusion, that Engineer turrets do
not proc items. They carry their own coefficient; it is the placement state that has none.

Both surfaces now say **"no direct damage"**, and the tooltip is precise about the scope of
the claim: *this skill's own state has no damage-dealing path, so it has no proc coefficient
of its own; a turret or beacon it places carries its own.* Verified scope, stated as verified
scope — the distinction is the whole of §5.0.1 applied to our own labels rather than to the
game's descriptions.

The data was right throughout and is unchanged: `verified` means "we have a number" and
`damaging: false` means "there is no number", and collapsing them in the schema would have
destroyed the distinction the audit depends on. The defect was only ever in the reading.

### 3j.65 §9 surface audit, eighth pass — a verified answer we held and never showed

Sweeping the remaining 35 `langfile` items found that 23 of them are equipment with no
stacking rows at all. Their meaningful verifiable fact is the **cooldown**, and the data has
carried it — asset-read, and cross-checked by `data:audit` against the description — ever
since the Seed of Life correction.

**No page had ever rendered it.**

That is a defect in the omission direction, and a sharp one for a site whose stated premise is
*"the answers the game itself makes hard to find"*: equipment cooldown is among the most
useful numbers in the game, we had it verified for 19 equipment, and a reader could not see it.
It also meant the audit rule guarding the field was protecting something invisible.

The detail page now has an Equipment section, with three states rather than one number:

- **A cooldown**, plus the caveat the description cannot give — that it is the figure *before*
  any Fuel Cell or Gesture of the Drowned reduction.
- **Consumed on use**, for the two equipment whose asset cooldown is `0`. A bare 0 reads as
  *"reusable instantly"*, which is the opposite of the truth. Verified from code rather than
  from the descriptions' "consumed" wording (§5.0.1 applies to our own reading too):
  `FireHealAndRevive` and `FireBossHunter` each end in
  `SetEquipmentIndex(<the *Consumed* variant>, isRemovingEquipment: true)`.
- **Passive**, for equipment with no `EquipmentSlot` handler, which states that the asset
  cooldown *never runs* rather than quoting it as if it did — the failure mode that produced
  "Passive (no cooldown). Cooldown: 10s." in an earlier pass.

New schema field `consumedOnUse`, and two new audit rules so the ambiguity cannot return: an
activated equipment with a 0s cooldown **must** declare `consumedOnUse`, and anything
declaring it must actually have a 0s cooldown. Before this, storing the 0 was harmless because
nothing displayed it; the moment it is displayed, it needs the flag.

A note on the redundancy: many equipment descriptions already state their cooldown, so the
panel repeats them. That is deliberate — for the equipment whose description *omits* it (which
`data:audit` warns about by name) the panel is the only place the number appears, and the
reduction caveat is not in any description.

### 3j.66 the langfile tail, part 1 — seven equipment traced to their prefabs

Equipment is the hardest part of the dataset to verify, because almost none of its numbers
are in `RoR2.dll`. `EquipmentSlot.Fire*` is nearly always four lines that load a prefab by
path and spawn it; every figure a player cares about is a **serialized field on that prefab**.
That is the third of the three hiding places §5.0.2 named, and reaching it needs
`extract-component-fields.py` pointed at the right field names.

Seven traced end to end. Five of the seven turned out to carry a fact the in-game text does
not.

**Radar Scanner** — `radius = 500`, `revealDuration = 10`, matching the description. But the
prefab also carries a `DestroyOnTimer` of **5 seconds** against a `pulseInterval` of **10**,
and `nextPulse` starts at `negativeInfinity` so the first pulse fires immediately. It
therefore pulses **exactly once** and is destroyed long before a second. The "10 seconds" is
how long the markers stay up, not how long it keeps looking — anything that becomes
revealable after the moment you press the button is missed. I had written "pulses forever"
before checking for a second component on the prefab; querying one more field name reversed
the conclusion.

**Executive Card** — the description says *"Cooldown: 0.1s"* and the EquipmentDef agrees. But
`FireVendingMachine` ends with `subcooldownTimer = 0.5f`, and **both** activation paths refuse
to fire while that is above zero. The real floor is five times the stated one.

**Glowing Meteorite** — *"Lasts 20 seconds"* is not a duration. `waveCount = 20` with
`waveMinInterval = 0.5` and `waveMaxInterval = 1.5`, so it is **20 waves** spaced randomly,
running anywhere from about 10 to about 30 seconds. The 600% is confirmed
(`blastDamageCoefficient = 6`) but is the figure at the centre of an 8m sphere with
`falloffModel = Linear`. And "ALL characters" is exact: `teamIndex = None` plus
`AttackerFiltering.AlwaysHit`.

**Forgive Me Please** — 8 ticks, one per second, confirmed. The countdown sits inside
`if (projectileStickOnImpactController.stuck)`, so a doll that lands on nothing **never
ticks**. Each tick hands `GlobalEventManager.OnCharacterDeath` a `DamageReport` whose victim is
the doll's own `HealthComponent` — which is how it fires on-kill effects with nothing dying.

**Blast Shower** — `CleanseBody(removeDebuffs: true, removeBuffs: **false**,
removeCooldownBuffs: true, removeDots: true, removeStun: true, removeNearbyProjectiles: true)`.
Two omissions in the game's text: it breaks **stun and freeze**, often the actual reason to
press it, and it strips **cooldown buffs** as well as debuffs, so it is not purely beneficial.

**Recycler** — the reroll is uniform over the pickup's *transmutation group* minus itself, not
its rarity tier, and the once-only rule is a real `NetworkRecycled` flag. Better: if the group
has no other member the handler `return false`s, and a handler that returns false never
reaches `OnEquipmentExecuted` — so **the cooldown is not spent**.

#### The one that stayed langfile, deliberately

**Milky Chrysalis**: `duration = 15` and `boostSpeedMultiplier = 3` on a `boostCooldown` of
0.5s are verified, as is the ending — downward velocity is clamped to −5 rather than dropping
you. The description's flat **"+20% movement speed"** appears nowhere in `JetpackController`
and is not in `RecalculateStats`. I did not find where it is applied, and I did not find that
it isn't. So the verified parts are recorded, the gap is written into `descriptionNote` as
*not verified*, and the item **stays `langfile`** — a partly-traced item is not a traced one,
and letting it graduate on the strength of the parts that did resolve is precisely how a
dataset starts lying.

Coverage 182 → **188 of 217**, floor raised to match.

### 3j.67 the langfile tail, part 2 — a payout previously recorded as untraceable

**Ghor's Tome** carried an explicit surrender in its own formula field:

> *NOT yet verified: the $25 value is not on the BonusMoneyPack prefab, which carries no
> `goldReward` component — so the payout figure remains game-text-sourced.*

That was a true statement about the wrong component. The pack has no `goldReward`; it has a
**`MoneyPickup`** with `baseGoldReward`. Querying that field name instead returns four
candidates — and three of them are decoys:

| `baseGoldReward` | bundle |
|---|---|
| **25** | `ror2-base-**bonusgoldpackonkill**` |
| 8 | `ror2-dlc2-elites-eliteaurelionite` |
| 15 | `ror2-dlc3-drifter` |
| 25 | `ror2-dlc3-drones` |

Two of them are 25. The **bundle name** is the only thing that separates Ghor's Tome's 25
from a DLC3 drone pack's — and this project has already been burned three times by exactly
this collision, most relevantly by `VoidCoinBarrel`, which also carries a `goldReward` of 25
and is not Ghor's Tome. Field name plus bundle name is the identifying pair; either alone is
a coin flip.

With it: `shouldScale = true` routes the 25 through `Run.GetDifficultyScaledCost`, which is
`baseCost × difficultyCoefficient^1.25`. That is the description's "Scales over time", now a
formula rather than a phrase — and the same exponent the game prices chests with, so the drop
tracks what things cost rather than what you kill.

Also worth recording: the chance is `LocalCheckRoll(4f * n)` — **linear**, not the hyperbolic
curve nearly every other on-hit chance uses. An item whose stacking looks like every other
proc item's but is not is precisely the kind of thing a reader assumes wrongly.

#### Box of Dynamite: the coefficient is not applied to your damage

`damage = base.body.damage * (2.4f + 0.85f * (stack - 1))` confirms 240% (+85%) exactly. The
subtlety is `base.body`. `DroneDynamiteBehaviour` is attached via `DroneDynamiteDisplay` — an
item the **drone** holds — so the coefficient multiplies the drone's damage stat, not yours.
The description ("your drones drop sticks of dynamite that detonate for 240% damage") is
ambiguous about whose damage, and the natural reading is the wrong one.

Three more numbers that were nowhere: the recharge is a flat `rechargeTimer += 10f` that
**never scales with stacks** (extra copies buy damage, never rate), "while in combat" is
literally an enemy within `searchDistance = 30f` checked every `0.25s`, and the stick's blast
is `blastRadius = 7` thrown with `force = 500` in a `Random.onUnitSphere` direction.

Coverage 188 → **190 of 217**.

### 3j.68 the langfile tail, part 3 — reading OverlapAttack's fire/reset pair

Three items were left explicitly unresolved last pass because their prefabs carried a
*fire rate* and a *reset rate* and it was not obvious how they composed. Reading
`ProjectileOverlapAttack` and `ProjectileDotZone` settles it:

`Fire()` runs every `1 / fireFrequency`, but `OverlapAttack` keeps an **ignore list** of
everything already hit, and only clears it on the reset cadence. So the **reset rate — not
the fire rate — is what caps how often a single enemy can be hit**, and a reset that never
happens turns an apparent hit *rate* into "once, ever". Two of the three hinged on that.

**Volcanic Egg** — `overlapDamageCoefficient = 5` at `overlapFireFrequency = 15` looks like
500% fifteen times a second. But `overlapResetFrequency = 0.00001` puts the reset period at
**100,000 seconds**, so each enemy takes the 500% exactly once however long you sit inside
them. The detonation is 800% with `blastFalloffModel = None` — full damage anywhere in the
8m sphere, which is unusual and generous. And the mechanic the description omits entirely:

```csharp
if (overlapAttack.Fire()) age = Mathf.Max(0f, age - overlapVehicleDurationBonusPerHit);
```

with that field set to **5** against a `duration` of **5**. Every enemy you ram rewinds the
ride timer by the entire duration, so "5 seconds" is a floor and a dense crowd keeps you
airborne indefinitely.

**Sawmerang** — three saws at −15°/0°/+15° confirmed, 400% each confirmed
(`damageCoefficient = 4`). But `resetInterval = -1`, and the reset is guarded by
`if (resetInterval >= 0f)`, so it is disabled; `BoomerangProjectile` never calls
`ResetOverlapAttack` either. **Each saw therefore hits a given enemy once — outbound or
returning, whichever comes first — and the description's "Can strike enemies again on the way
back" is not what the code does.**

That negative claim is worth the corroboration it has: the game *does* implement return-pass
re-hits, for Chef's Cleaver. `CleaverProjectile` calls `ResetOverlapAttack()` explicitly and
its prefab carries a `recallDamageCoefficient` field. Sawmerang's prefab has neither, in the
same engine, for the same class of weapon. The absence is a design difference, not a gap in
the decompile.

**Molotov (6-Pack)** — the 500% resolves cleanly once `calculateTotalDamage` is understood:
`ProjectileExplosion` sets `dotInfo.totalDamage = characterBody.damage * totalDamageMultiplier`,
so the bomblet's `blastDamageCoefficient = 2.5` (impact) and `totalDamageMultiplier = 2.5`
(burn **total**, not a rate) sum to the stated 500%.

#### Two items deliberately left short of `code`

Sawmerang's *"3×100% per second while bleeding"* refers to a bleed DoT distinct from the
blade-contact component I did trace (20% at a 10/s reset cap, i.e. up to 200%/s). Molotov's
puddle is `damageCoefficient = 1` at `fireFrequency = 1` — **100% per second**, against a
stated 200% — down a chain whose `childrenDamageCoefficient` is 1 at every step.

Both are recorded as verified rows plus an explicit `NOT verified` note, and **both stay
`langfile`**. The Molotov gap in particular is the shape of a real 2× error, the same shape as
Wax Quail — and that is exactly why it does not get written as a correction on the strength of
a chain I have not closed. Finding a discrepancy and *proving* one are different results, and
only the second may change a number.

Coverage 190 → **191 of 217**.

### 3j.69 the langfile tail, part 4 — a second surrender that was looking in the wrong file

**Sale Star** carried the same shape of note Ghor's Tome did:

> *NOT verified: the stated 5%-per-stack chance for additional items is not in that path, so
> the number remains game-text sourced.*

"That path" was `InteractionDriver`, which only decides which interactables **glow**. The
mechanic is in `PurchaseInteraction`, and it is considerably more interesting than the
sentence it was hiding behind:

```csharp
dropCount = 2 + num2;                      // ChestBehavior or RouletteChestController
```

with `num2` produced by a cascade that runs only when you hold **two or more**:

- The Sale Stars are transformed to `LowerPricedChestsConsumed` with `minToTransform = 1`
  and `maxToTransform = int.MaxValue` — the **entire stack is spent on one purchase**, not one
  star per stage.
- At exactly one star, `num2 = 0`: one extra item, flat.
- From two up, three gated rolls at **30% / 15% / 1%**, each requiring the previous to pass.
- From **three** up, every threshold gains `(1 − 1/(n × 0.05 + 1)) × 100` — the game's usual
  hyperbolic curve on a 5%-per-stack amplification.

So the stacking row was typed `linear` and is `hyperbolic`, and the shape is lopsided in a way
no reader would guess: the **second** star is the big one (0% → 30% for a third item), while
the third adds about 13 points on top of that.

Two files, two different jobs, and the one that was searched was the one that only draws a
glow. The lesson is the Wax Quail lesson in a new costume: *"the number is not in that path"*
is a statement about the path you chose.

#### Prison Matrix multiplies; the description reads like it adds

`PowerCubeBodyBehavior` grants `Buffs.PowerCubeBuff`, and `RecalculateStats` does
**`armor *= 1.5f`** — sandwiched between the Irradiant Pearl / bead multipliers and Drizzle's
flat `+70`. "+50% armor" is +50% *of* your armor, so on Commando, Huntress, Artificer,
Railgunner and every other 0-armor survivor it does **nothing at all** until something else
grants some. `HasBuff` rather than `GetBuffCount`, so it cannot stack.

**Sentry Key** is the opposite and equally worth stating: `num98 += 0.15f * GetBuffCount(...)`
puts it **additively into the same movement pool as Paul's Goat Hoof**, not on its own
multiplier — and `BaseItemBodyBehavior` enables once for any stack size, so a second copy adds
nothing.

#### Where Defense Nucleus stops, precisely

Its 4-per-stack deployable cap is verified (`GetDeployableSameSlotLimit: n * 4`) and the elite
gate is verified. The stated **300% damage / 300% health** would be boost items in a
`CharacterSpawnCard.itemsToGrant` list — `extract-component-fields.py` reads scalar fields and
does not surface array members, so that list is out of reach for the current tooling rather
than absent from the game. Recording the boundary that precisely is the point: the next person
knows what to build, instead of re-searching the same three files.

Coverage 191 → **194 of 217**.

### 3j.70 the extractor could not see arrays, and was silently discarding whole records

Last pass ended by naming a tooling boundary rather than an unknowable fact: Defense
Nucleus's 300% damage / 300% health live in a `CharacterSpawnCard.itemsToGrant` list, and
`extract-component-fields.py` read only top-level **scalars**.

Fixing it exposed that the gap was worse than "arrays are skipped". The old loop ended:

```python
fields = scalars(t)
if not fields:
    continue
```

A ScriptableObject whose interesting content is *entirely* arrays yields an **empty** scalar
dict — so the record was not thinned, it was **dropped**, with no trace. Every asset of that
shape had been invisible to every query ever run through this tool. That is the silent-zero
failure mode this log has recorded four times (`m_Script` resolution, the language-file
loader, the skill-unlocks parser, a `replace()` that matched nothing), and it had been sitting
in the extractor the whole time.

Two changes. `arrays()` descends one level into lists of structs, keeping scalar members and
resolving PPtrs to names where the target is in the same bundle — falling back to `#<pathId>`
rather than dropping the entry, since the `m_FileID != 0` wall that defeats `m_Script` also
defeats these. And `owner` now falls back to the asset's own `m_Name`, because
ScriptableObjects have no `m_GameObject` and were therefore all labelled `""` — which left the
bundle name as the only handle, and §3j.67 showed the bundle name alone is not enough.

#### What it found immediately

```
cscMinorConstructOnKill  itemsToGrant = [ {count: 30}, {count: 30} ]
```

`BoostHp` is `num80 += n * 0.1f` and `BoostDamage` is `num103 += n * 0.1f` — **+10% each** —
so 30 of each is exactly the stated **+300% health and +300% damage**. It is also the same
mechanism `EliteOnlyArtifactManager` uses when it grants `(coefficient - 1) * 10` of that pair
for Artifact of Honor, so the pattern is the game's own idiom rather than a coincidence of
arithmetic.

The residual is stated in the record rather than smoothed over: **the counts are read; the two
`ItemDef` pointers are cross-bundle and never resolve to names.** The identification rests on
30 × 10% reproducing the description's figures through the game's established boost pair — two
independent paths agreeing — not on having read the item names. That is a materially different
situation from Molotov's puddle, where the paths *disagree* and the number therefore stays
untouched.

Of the 121 spawn cards carrying an `itemsToGrant` field, only five actually populate it, and
`cscMinorConstructOnKill` is the only one whose counts are not 1 — which is itself a useful
negative: no other summon in the game is buffed this way.

Coverage 194 → **195 of 217**.

### 3j.71 three elite Aspects, and an audit rule catching the row I was least sure of

The Aspects have always been the weakest cluster in the dataset: their in-game text is
"Gain the power of a X Elite" followed by prose, and the mechanics live across
`CharacterBody`, a body-attachment prefab, and sometimes an EntityState. Three now traced.

**His Reassurance (Mending)** — `AffixEarthBodyAttachment` carries a `HealNearbyController`
with **`maxTargets = 1`**. "Continuously heal nearby allies" heals exactly **one ally per
tick**; the sphere search stops at the first eligible target. With a full team the aura
round-robins rather than topping everyone up. Rate is `damagePerSecondCoefficient = 1.2` at
`tickRate = 3` — 40% of **your damage** three times a second, in a 30m radius plus the body's
own. Anything already carrying `EliteEarth` is skipped, so two Mending holders never heal each
other. The death core is `healCoefficient = 4` in a 12m radius after a 3s chargeup.

**N'kuhana's Retort (Malachite)** — `UpdateAffixPoison` fires every 6s, and the volley size is
**`3 + (int)radius`**: the number of spiked balls scales with your character's **collision
radius**, so a physically larger survivor throws more from the same aspect. Each is 100% of
your damage, spread at `360/num` degrees and tilted 25° up from vertical toward your facing.
The healing-disable is `AddTimedBuff(HealingDisabled, 8f * damageInfo.procCoefficient)` — the
8 seconds is the figure at proc coefficient 1, and a half-proc hit applies four.

**Aurelionite's Blessing** — the reconciliation is the interesting part. The two projectile
prefabs carry `blastDamageCoefficient` of **0.1** and **1.0**, which look nothing like the
stated 15% and 150%. Both are fired with `attackerBody.damage * aurelioniteAttackDamageCoeff`
where that constant is **1.5f**, and the prefab coefficient multiplies on top: 0.1 × 1.5 = 15%,
1.0 × 1.5 = 150%. Publishing from the prefab values alone would have "corrected" two numbers
that were already right — the same two-stage trap as Molotov's `totalDamageMultiplier`.

#### The audit rule earned its keep

I wrote a row reading *"Seconds between spike attacks = 10"* from `rawCooldownDuration = 10f`.
`data:audit` **failed the build**: the value appears nowhere in the description and no
`descriptionNote` explained it. That rule exists because a number of ours next to a number of
the game's, with nothing to say which is which, is worse than no number at all.

Checking it out properly, the row was **wrong**. The autonomous firing loop is gated on

```csharp
if (hasAuthority && body != null && (useRandomTargetingForNearbyEnemy || baseAI != null))
```

and `useRandomTargetingForNearbyEnemy` is set **false** for a player who is holding
`EliteAurelioniteEquipment` — who also has no `BaseAI`. **The 10–13 second timer is the
monster path.** A holder aims the strike and pays the equipment's own 25s cooldown. I had
taken a constant from a shared behaviour and attributed the NPC branch to the player.

That is the Halcyon/Shaping error in a new place: not a wrong *name* this time, but a wrong
*branch*. The row is now the telegraph timing, with the monster/player split stated in the
formula so nobody re-derives it. Worth recording that the rule which caught it was written for
a different reason entirely — it checks presentation, and it happened to catch a fact error,
because a number that cannot be reconciled with the game's own text is often a number that is
about something else.

Coverage 195 → **198 of 217**; the tail is down to **19**.

### 3j.72 Of One Mind — the last Aspect, and the clearest case yet for reading prefabs

All four elite Aspects are now code-verified.

**Of One Mind** — `TargetNearbyHealthComponents` on `AffixCollectiveBodyAttachment`:
`radius = 30` (the dome), `maxTargets = 50`, and `tickRate = 0.5`, so **membership is
re-scanned twice a second rather than continuously** — an ally who steps in is not covered
instantly. Seated characters are excluded outright.

The cooldown cut is `if (num75 > 0) num113 *= 0.75f`, where
`num75 = HasBuff(EliteCollective) ? 1 : GetBuffCount(CollectiveShareBuff)` — the holder gets
it from the aspect, allies from the shared buff. It is a **presence check, not a count**, so
standing inside two overlapping domes is worth exactly as much as one. Death explosion is
`blastDamageCoefficient = 1` in an 11m radius, and deaths inside a collective are chained at
`delayBetweenDeaths = 0.8f` rather than resolving together.

#### The dome downtime is the argument for the whole extractor

`AffixCollectiveAttachmentBehaviour` declares:

```csharp
public float ColliderDisableIfHitDuration = 10f;
```

The prefab serializes **8**. The game's own description says 8. Reading the class — which is
the obvious thing to do, and what every C#-only pass would have done — produces a **10 that
contradicts the game's text**, and the natural next move would have been to "correct" the
description's 8 to our 10. The serialized value is the truth and the initialiser is dead.

This is §5.0.2's second hiding place demonstrated as cleanly as it gets: a public field with an
initialiser that is *always* overwritten on the prefab. Nothing in the C# marks it as
overridden; the only way to know is to read the asset.

#### Attempted and stopped, with the boundary named

- **Orphaned Core** — `PhysicsProjectileController` computes contact damage as
  `baseDamageCoefficient + velocityDamageIncrease * (magnitude / speedThreshold)` with both
  coefficients `5f`. But those are **private** fields with initialisers and no `[SerializeField]`,
  so nothing serializes them, and `speedThreshold` is assigned at runtime. That gives the
  *contact* damage, which is a different mechanism from the row we hold ("Launch damage 400%").
  I could not connect the two without guessing, so nothing was written.
- **Defensive Microbots** — `CaptainDefenseMatrixController` has
  `defenseMatrixToGrantPlayer` and `defenseMatrixToGrantMechanicalAllies`, both `1` in code,
  but only the *allies* field came back from the prefab scan. Until I understand why the other
  did not, its value is not something I am willing to publish.

Coverage 198 → **199 of 217**; the tail is **18**, of which 4 are quest items with no mechanic
(Artifact Key, both Cerebellums, Beads of Fealty), 2 are the Rusted/Encrusted Key placeholder
pair whose rows are already corrected prose, and 2 are the deliberate holds (Milky Chrysalis,
Molotov).

### 3j.73 the noise filter was eating real data — every field ending in "Player"

Last pass left Defensive Microbots blocked on a specific, checkable anomaly rather than a
vague one: `CaptainDefenseMatrixController` declares `defenseMatrixToGrantPlayer` and
`defenseMatrixToGrantMechanicalAllies`, both `1` in code, and the prefab scan returned **only
the second**. That was recorded as "until I understand why the other did not, its value is
not something I am willing to publish."

A direct probe showed both serialized, both `1`:

```json
{ "defenseMatrixToGrantPlayer": 1, "defenseMatrixToGrantMechanicalAllies": 1 }
```

So the extractor was dropping it. The cause was its own noise filter:

```python
NOISE = re.compile(r"^m_|^k[A-Z]|Layer$|LayerMask|Hash$|^instanceID$", re.I)
```

`Layer$` **under `re.I`** matches the trailing "layer" inside "P|layer". **Every serialized
field whose name ends in "Player" has been silently dropped from every query ever run through
this tool**, since the day it was written. `^k[A-Z]` was over-matching the same way — under
`re.I` it eats any field starting `k` + a letter, so `keepAlive` went too.

That is the **fifth** silent-zero this log has recorded (`m_Script` resolution, the
language-file loader, the skill-unlocks parser shape, a `replace()` that matched nothing, the
array-shaped records of §3j.70) and the second one *inside the extractor*. The pattern is
consistent enough to be worth naming: **every one of them returned a plausible smaller answer
rather than an error.** A filter that removes too much looks exactly like a game that contains
less.

Fixed by splitting the pattern in two. Unity's noise is capitalised — `m_Layer`,
`groundLayer`, `kMaxCount` — so those alternatives are now **case-sensitive** and keep working,
while `...Player` and `keepAlive` come through.

#### What it unblocked immediately

**Defensive Microbots**, fully:

- `projectileEraserRadius = 20` matches the stated 20m.
- `DeleteNearbyProjectile` walks the live projectile list and breaks at `num2 >= itemStack` —
  the stack count is *literally* the loop bound, so "1 (+1 per stack)" is exact. Projectiles
  flagged `cannotBeDeleted` are skipped and only other teams' count.
- The 0.5 seconds is a **recharge, not a scan interval**:
  `rechargeFrequency = baseRechargeFrequency (2) x attackSpeed`, while
  `fireFrequency = Max(minimumFireFrequency (10), rechargeFrequency)` governs how often it
  *looks*. The microbots check ten times a second and fire the instant a charge exists, so
  walking into a projectile does not cost you half a second of exposure — a meaningfully
  different feel from what the text implies.
- `defenseMatrixToGrantPlayer = 1` and `defenseMatrixToGrantMechanicalAllies = 1`: Captain
  starts with one and each of his mechanical allies gets one, on top of any copies picked up.

Coverage 199 → **200 of 217**.

The lesson worth keeping is not about regexes. Last pass could have written "the prefab does
not carry that field" and moved on; the reason it did not is that the anomaly was recorded
*specifically* — which field, on which component, in which bundle — and a specific anomaly can
be probed. A vague one ("couldn't find it") cannot.

### 3j.74 both silent-failure paths proved inert, and Orphaned Core was in the third hiding place

Before trusting another negative result, I checked the two places
`extract-component-fields.py` swallows exceptions without reporting — the same shape of
mistake as §3j.73, one loop up.

```
bundles: 1472   loaded: 1472   FAILED: 0
MonoBehaviours: 224435   readable: 224435   UNREADABLE: 0
```

Both `except Exception: continue` paths are **inert**: every bundle loads and every
MonoBehaviour typetree reads. That is worth recording precisely because it is a negative — it
means every extraction result in this log was computed over complete input, and a "0
components carry it" answer means the field genuinely is not on any component.

#### Which is exactly what it meant

`baseDamageCoefficient`, `velocityDamageIncrease` and `speedThreshold` return **nothing**, and
`PhysicsProjectileController` is not on the Solus unit prefab at all. Dumping that prefab's
components shows why:

```
[EntityStates.FriendUnit.KineticAura]        serializedFieldsCollection
[EntityStates.FriendUnit.KineticAuraImpact]  serializedFieldsCollection
[EntityStates.FriendUnit.FinalSacrifice]     serializedFieldsCollection
```

Orphaned Core's numbers live in **EntityStateConfigurations** — §5.0.2's *second* hiding
place, and a different extractor's territory (`extract-state-fields.py`, whose output we
already had). Two passes of searching components failed because they were searching the wrong
one of the three places, not because the data was missing. The three really are mutually
unreachable.

`EntityStates.FriendUnit.KineticAura` gives the lot: `chargeDamageCoefficient = 4` (the 400%),
`lockonDistance = 30`, `lockonAngle = 180`, `chargeBeforeLaunch = 0.5`, `refreshTime = 1.5`,
`knockbackDamageCoefficient = 10` and `knockbackForce = 8000` above
`massThresholdForKnockback = 250`. `FriendUnitLovesYou` gives the petting: `cleanseRadius = 15`,
`curseStacksToRemove = 5`.

#### And it retroactively corroborates §3j.70

The "+400% per stack" is **not** a bigger coefficient. `UpdateMinionInventory` keeps the unit
stocked with `(newStack - 1) * 10` **BoostDamage** items, at +10% each — so two stacks double
the unit's damage *stat* and the flat 400% coefficient rides on top.

That is the same idiom Defense Nucleus's spawn card uses, where the `ItemDef` pointers were
cross-bundle and **unresolvable**, and the identification rested on 30 × 10% reproducing the
stated 300%. Here the identical pattern appears with `RoR2Content.Items.BoostDamage` **named
explicitly in C#**. An inference made from counts alone in §3j.70 now has an independent
instance of the same mechanism with the names visible. It does not upgrade that record — the
pointers still do not resolve — but it is the strongest corroboration available short of
resolving them, and worth having on the record beside it.

`GetDamageBoostFromSpeed() = Max(1f, moveSpeed / baseMoveSpeed)` is the "hits harder the
faster it moves" clause, floored at 1 so it can never *reduce* damage, and
`InheritMovementItems` is what makes that ratio climb.

Coverage 200 → **201 of 217**.

### 3j.75 Halcyon Seed's damage is a square root wearing a linear label

Two more, and one of them is a genuine numeric correction rather than an addition.

#### The Crowdfunder

`EntityStates.GoldGat.GoldGatFire`: `damageCoefficient = 1` at `procCoefficient = 1`, spread
widening 0 → 3. Two facts the text does not carry:

- **The fire rate ramps.** `fireFrequency = Mathf.Lerp(minFireFrequency, maxFireFrequency,
  totalStopwatch / windUpDuration)` with 3, 15 and 10 — it opens at three bullets a second and
  reaches fifteen after ten seconds of sustained fire, then resets when you release.
- **The cost is keyed to team LEVEL, not to time.**
  `(int)(baseMoneyCostPerBullet * (1f + (GetTeamLevel(team) - 1f) * 0.25f))` with a base of 1.
  Integer truncation means it stays at exactly 1 gold per bullet until team level 5, then
  climbs in whole steps. "Increasing over time" is true only because your level does.

#### Halcyon Seed — a correction

`items.json` had **damage +50% per stack, `type: "linear"`**. `GoldTitanManager`:

```csharp
currentBoostHpCoefficient     *= Mathf.Pow(totalItemCount, 1f);
currentBoostDamageCoefficient *= Mathf.Pow(totalItemCount, 0.5f);
GiveItemPermanent(BoostHp,     Mathf.RoundToInt((currentBoostHpCoefficient     - 1f) * 10f));
GiveItemPermanent(BoostDamage, Mathf.RoundToInt((currentBoostDamageCoefficient - 1f) * 10f));
```

Health is `Pow(n, 1)` — genuinely linear, and the description's "+100% per stack" is exact.
Damage is **`Pow(n, 0.5)`**. With the `RoundToInt` on the boost-item count the real curve is
stepped: **100% at one seed, 140% at two, 170% at three, 200% at four, 220% at five** — against
a stated 150 / 200 / 250 / 300. The linear label is right for the first stack and diverges from
there, exactly like Stun Grenade's linear-vs-hyperbolic (§3d) and Bandolier's stated 18%.

A second thing the text omits entirely: `CalcTitanPowerAndBestTeam` sums
`GetItemCountForTeam` across **every team** into `totalItemCount`, so Aurelionite's power comes
from **all players' seeds pooled**, while the team it fights for is whichever single team holds
the most. In multiplayer the item is far better than its own description implies, and for a
different reason than the one a reader would guess.

Worth noting what did *not* go into the record: the difficulty terms
(`+= difficultyCoefficient / 8f` and `/ 2f`) sit inside the
`isFalseSonBossLunarShardBrokenMaster` branch — that is the **hostile** Aurelionite from the
False Son fight, not your ally. Reading those two lines without the enclosing `if` would have
produced a difficulty-scaling claim about the player's summon that is simply false. The same
wrong-branch trap as Aurelionite's Blessing in §3j.71, caught this time before it was written.

Coverage 201 → **203 of 217**.

### 3j.76 I published a name collision — Executive Card was carrying Remote Caffeinator's data

This log has recorded three near-misses on `cachedName` collisions (Halcyon/Shaping,
VoidCoinBarrel's 25 vs Ghor's Tome, `TransferDebuffOnHit` on Neutronium Weight rather than
Noxious Thorn) and drawn the same rule each time: **resolve the internal name to its display
name before writing anything.** In §3j.66 I did not, and this one reached published data.

`FireVendingMachine` — the `subcooldownTimer = 0.5f` and the 1000m downward
`CharacterRaycast` — was written into **Executive Card**, with `confidence: code` and a
`descriptionNote` telling readers their 0.1s cooldown was really 0.5s. The mapping:

| Display name | Token | EquipmentDef |
|---|---|---|
| **Remote Caffeinator** | `EQUIPMENT_VENDINGMACHINE_NAME` | `VendingMachine` |
| **Executive Card** | `EQUIPMENT_MULTISHOPCARD_NAME` | `MultiShopCard` |

Both facts belonged to Remote Caffeinator. Executive Card has **no `EquipmentSlot` handler at
all.** Two passes of tests went green over it, because the test I wrote asserted the wrong
value against the wrong item — checking my own mistake against itself.

It surfaced only because this pass started by resolving the *remaining* items' tokens, and
`EQUIPMENT_VENDINGMACHINE_NAME` came back "Remote Caffeinator" when I expected the name I had
already used. The rule works; I skipped it, and skipping it cost two passes of false data on a
live page.

#### What Executive Card actually does

`MultiShopCardUtils`: `refundPercentage = 0.1f`, paid as a `GoldOrb` of
`(uint)(0.1f * moneyCost)` — an integer cast, so **a purchase under 10 gold refunds nothing**.
`SetCloseOnTerminalPurchase(..., doCloseMultiShop: false)` is applied to
`ShopTerminalBehavior` **and** `DroneVendorTerminalBehavior`, so drone vendors stay open too,
which the description omits. A non-gold purchase (lunar coin, item cost) still keeps the shop
open and still spends a charge, but refunds nothing.

#### A third activation state, because two could not describe it

`OnPurchase` requires `equipmentSlot.stock > 0` and then calls `OnEquipmentExecuted()`. So the
0.1s cooldown is **real and is spent**, even though pressing the key does nothing. Under the
old two-state model the item had to be either mislabelled as key-activated or told the reader
"its cooldown never runs" — both false.

New `triggered` flag: `activated: false` **and** the cooldown is operative, spent by an
in-world event. `data:audit` exempts exactly this case from the passive-cooldown rule and
fails if `triggered` appears without `activated: false`; the detail page renders
*"Triggered, not activated"* rather than *"Passive"*. The elite Aspects keep failing closed, as
they should.

#### Remote Caffeinator, with its own constants back

`VendingMachineProjectile`: `blastDamageCoefficient = 20` (the stated 2000%) in a 16m blast.
The `VendingMachine` component: `healFraction = 0.25` with `numBonusOrbs = 2` — one primary
heal plus two bonus orbs is the description's "up to 3 targets" — `vendingRadius = 50` and
`maxPurchases = 12`. And the 1000m raycast means **no ground beneath you refuses the use and
does not spend the 60s cooldown.**

Coverage 203 → **204 of 217**. The count is not the point of this entry: two records were
wrong, one of them with a confident `descriptionNote` contradicting the game's own text, and a
test was defending it.

### 3j.77 the name-collision rule, written because vigilance kept failing

§3j.76 was the fourth `cachedName` collision in this project and the first to reach a live
page. The rule drawn each of the previous three times — *resolve the internal name to its
display name before writing anything* — is a rule about remembering to be careful, and it had
now failed four times out of four. So it is a check.

`data:audit` now scans every `formula` and `descriptionNote` for the internal name of any item
in the dataset, and **fails** if a record cites another item's `cachedName` without naming that
item in the same text. Cross-references stay legal — comparing mechanics is often the clearest
explanation available — they just have to be legible as references.

Run over the existing 217: **zero collisions.** So §3j.76 was the only one, which is the answer
I wanted and could not otherwise have had.

Then, to check the rule was not merely agreeing with me, I re-introduced the original bug —
a formula on Executive Card citing `VendingMachine`:

```
✗ Executive Card: cites the internal name "VendingMachine", which belongs to
  "Remote Caffeinator" — either this is the wrong item's mechanic, or name
  "Remote Caffeinator" in the text so the cross-reference is visible
```

It bites, and it would have caught the original the day it was written.

#### It then caught me twice more, immediately

Writing Electric Boomerang up, I wrote *"skips `BleedOnHit`"* — which is **Tri-Tip Dagger's**
internal name, and a reader would have no way to know that. Naming the item fixed it, and made
the sentence better: the two items **anti-synergise**, and neither description says so.

That fix then produced a **false positive**: `Dagger` is Ceremonial Dagger's `cachedName` and
is a substring of "Tri-Tip Dagger". The rule now strips every mentioned display name from the
prose first, longest first, and matches `cachedName`s only against what remains — so labelled
references disappear before they can collide, and only unlabelled ones survive to be flagged.

Three catches in the first ten minutes, one of them a real defect in prose I was writing at the
time. That is a better argument for the check than the entry that motivated it.

#### Electric Boomerang, split into what is known and what is not

Verified: the trigger is `LocalCheckRoll(15f * damageInfo.procCoefficient)` — a flat 15 with
**no stack term**, so extra copies buy damage and never frequency, and it is **linear** in the
proc coefficient rather than hyperbolic. Two gates the text omits: the roll is skipped if the
hit already carries `ProcType.StunAndPierceDamage` (a boomerang cannot spawn another) or if the
damage type includes `Electrocution`.

Not verified, and now stated precisely rather than vaguely: the projectile is fired with
`characterBody.damage * 0.4f * n` into a prefab carrying `damageCoefficient = 3.1`, whose
product is **1.24 × n** against the **1.20** the game's text states for both of its damage
figures. A 4% gap is small enough to be a rounding convention and large enough not to assume,
and I still cannot tell which of the two stated 120% figures the 3.1 component produces. The
item stays `langfile` with the arithmetic written down, which is a better open question than
the one it replaced.

### 3j.78 one extraction, two verdicts — Rusted Key matches its text, Encrusted Key does not

**Gnarled Woodsprite** first, and it is the third time a prefab value has overruled its own
class initialiser. `HealingFollowerController` declares `fractionHealthHealing = 0.01f` and
`fractionHealthBurst = 0.05f`; the `HealingFollower` prefab serializes **0.015** and **0.10**,
and only those agree with the game's text (1.5% per second, 10% burst). Reading the class
would have produced *two* numbers that contradict the description at once.

Also verified, and genuinely useful: using it does not summon anything —
`passiveHealingFollower.AssignNewTarget(...)` retargets the sprite you already have — and with
nothing aimed at, `FirePassiveHealing` falls back to `this.characterBody`, so **pressing it at
nothing bursts you for 10%** rather than wasting the cooldown.

#### The keys: the same method, one match and one mismatch

Both keys' *spawn* logic was already code-verified; what was not was the drop split each
description advertises. Both tables were found in the items' **own** bundles:

| Table | Bundle | Weights | Implies |
|---|---|---|---|
| `dtLockbox` | `ror2-base-**treasurecache**` | tier2 **4**, tier3 **1** | **80% / 20%** |
| `dtVoidLockbox` | `ror2-dlc1-**treasurecachevoid**` | void 1/2/3 = **5 / 5 / 2** | **41.7 / 41.7 / 16.7** |

Rusted Key's description says 80% / 20%. **Exact.** Upgraded to code-verified, with the extra
fact that its `tier1Weight` is 0, so a lockbox can never give a white item.

Encrusted Key's description says **60 / 30 / 10**, and its own bundle's table says
41.7 / 41.7 / 16.7. The stated split is instead exactly the **6 / 3 / 1** of `dtVoidChest` —
the generic void-chest table in `ror2-base-common`. So either the cache reads that shared table
rather than the one shipped beside it, or the description is stale.

I did not pick. The record now names **both tables, both weight sets, and the exact
arithmetic**, and stays `langfile`. What makes this worth writing down rather than shrugging at
is that the *same extraction, on the same kind of asset, in the same run* reproduced Rusted
Key's description to the digit. The method is not in question, so the mismatch is about this
one attribution — which is a far sharper open question than "not verified", and the next person
can settle it by finding the single reference from the void cache prefab to its drop table.

#### A test that had quietly become ambiguous

The §6B.3 test asserting untraced items show the amber banner started failing — not because
the banner vanished, but **strict-mode violation: two matches**. Electric Boomerang's own
formula now contains the phrase *"NOT yet code-verified"* about one of its figures, so
`/not yet code-verified/i` matched the banner and the data. The assertion now matches the
banner's full sentence. A test that greps for a phrase the content is allowed to contain is a
test that will eventually lie in one direction or the other.

Coverage 204 → **206 of 217**.

### 3j.79 the game's own description is wrong about Encrusted Key — and I was wrong about Milky Chrysalis

Last pass ended by naming exactly how the Encrusted Key question could be settled: *"find the
single reference from the void cache prefab to its drop table."* Doing that took one probe.

```
[Lockbox]      dropTable -> dtLockbox
[LockboxVoid]  dropTable -> dtVoidLockbox
```

Both pointers resolve **inside their own bundles**, so there is no `m_FileID` wall and no
inference. The void cache reads `dtVoidLockbox` — `voidTier1/2/3 = 5 / 5 / 2`, i.e.
**41.7% / 41.7% / 16.7%**. Its description advertises **60 / 30 / 10**, which is the `6 / 3 / 1`
of `dtVoidChest`, a table this prefab does not point at.

So the game's own text is wrong, and now demonstrably: not "our number disagrees with theirs",
but "the prefab's own pointer resolves to a table whose weights are not the ones the tooltip
prints." That is about as strong as this project's evidence ever gets, and it is worth
contrasting with the four places this session where a *seeming* contradiction turned out to be
mine — Aurelionite's 0.1 and 1.0 (multiplied later by 1.5), Molotov's 2.5 (a DoT total, not a
rate), Of One Mind's 10f (overwritten by the prefab), and the wrong-branch reads in §3j.71 and
§3j.75. Four false alarms before one real one is the right ratio to expect, and the reason the
rule is "prove it, then correct it."

Rusted Key's pointer resolves the same way to `dtLockbox` (4 : 1 = **80 / 20**), matching its
description exactly. Same technique, same run, opposite verdict.

#### And a negative claim of mine that was false

Milky Chrysalis's record said the description's "+20% movement speed" *"appears nowhere in
`JetpackController` and is not in `RecalculateStats`."* The second half was **wrong**:

```csharp
if (HasBuff(RoR2Content.Buffs.BugWings)) num98 += 0.2f;
```

It is there — additive into the same movement pool as Paul's Goat Hoof — and the BuffDef
(`bdBugWings`) ships in the item's own bundle. I missed it because I searched
`RecalculateStats` for "Jetpack" and "flight" and the buff is called **BugWings**, which
resembles neither the item's display name nor its controller's. The name-collision problem
wearing its other face: not two things sharing a name, but one thing whose name matches nothing
you would think to search for.

What is still open is narrower and stated as such: **where the buff is applied.** The
equipment's `passiveBuffDef` is null, `JetpackController` never calls `AddBuff`, and at IL
level `Buffs.BugWings` is loaded exactly once in the whole assembly — the read above. Effect
and magnitude verified; trigger unfound. The item stays `langfile` on that basis, which is a
much smaller gap than the one it replaced.

**A false negative is a false claim.** "This is not in the game" reads as knowledge and was
published with the same confidence as the things I had actually traced. It is the one category
of error the `verified`/`langfile` split does not protect against, because it lives in the
prose rather than in a number.

Two of last pass's tests failed on this work, both correctly — they were guarding open
questions that had closed. Updating an assertion because the answer arrived is the system
working.

Coverage 206 → **207 of 217**.

### 3j.80 auditing my own negative claims, after one of them turned out to be false

§3j.79 ended on a category rather than an item: **a false negative is a false claim.** Milky
Chrysalis's record asserted the +20% "is not in `RecalculateStats`" — published with the same
confidence as a traced number, and wrong. The `verified` / `langfile` split cannot catch that
class, because it lives in prose rather than in a value, so nothing in this repository was
looking at it.

So I swept for the rest. Six negative claims across all 217 records:

| Record | Claim | Verdict |
|---|---|---|
| Orphaned Core | "the per-stack scaling is NOT in that coefficient" | scoped — names where it *is* |
| Substandard Duplicator | "appears nowhere in its text" | about the description, trivially checkable |
| Encrusted Key | "not in the spawn path" | scoped to one path |
| Milky Chrysalis | "we have not found where…" | already hedged after §3j.79 |
| Molotov (6-Pack) | "a doubling we have not found" | hedged |
| **Essence of Heresy** | **"this is the only site that applies the buff"** | **unscoped and load-bearing** |

The last one is a claim about the entire assembly, and it is the justification for calling the
game's own "(+10 per stack)" wrong. Checked at IL level, the way BugWings should have been:
`Buffs.LunarDetonationCharge` is loaded at **six** sites, and **exactly one** applies it —
`LunarDetonatorPassiveAttachment`'s `AddTimedBuff(..., 10f)`. The other five read
`GetBuffCount`, call `ClearTimedBuffs`, or drive the visual effect.

The claim holds. But it *held* before I checked, too, and that is the problem: I had no way to
tell the true ones from the false one without re-deriving each. The formula now carries the
evidence — six sites, one application — so a reader can re-run the check instead of trusting it.

#### The rule

A negative claim must now either **hedge to what we did** ("we have not found") or **state its
search scope** (a file, a call-site count, the IL, a named path). An unqualified *"X is not in
the game"* is not a permitted sentence, and a unit test walks every `formula` and
`descriptionNote` enforcing it.

Verified by injection: a `descriptionNote` reading *"This effect is not in the game code at
all"* fails the suite by name.

This is the fourth thing this session that moved from *"remember to be careful"* to *"the build
fails"* — after the coverage ratchet, the name-collision rule, and the verified-value-vs-
description rule. The pattern is worth stating plainly: **every discipline I have relied on
memory for has eventually failed, and every one I turned into a check has held.** The interval
between the Milky Chrysalis error and finding it was four passes; the interval between writing
the name-collision rule and it catching me was ten minutes.

### 3j.81 the Milky Chrysalis boundary, scoped three ways — and an apostrophe that broke a rule

Two passes ago Milky Chrysalis's `+20%` was "not in `RecalculateStats`" (false). One pass ago
it was "we have not found where the buff is applied" (true but vague). Now it is bounded:

- **The assembly.** `Buffs.BugWings` is loaded **once** in all of `RoR2.dll` at IL level — the
  `RecalculateStats` read itself. Nothing calls `AddBuff` with it.
- **The equipment.** `Jetpack`'s `passiveBuffDef` resolves to `{fileID: 0, pathID: 0}` — null.
  So it is not the standard equipment-passive mechanism.
- **The item's own bundle.** A reference scan over every `PPtr` in `ror2-base-jetpack`, at any
  depth, finds **nothing pointing at the `bdBugWings` asset that ships there.**

Three searches, three empty results, each named. Any application would have to be cross-bundle
(where `m_FileID != 0` makes the pointer unresolvable in this direction) or outside the
assembly, and this tooling cannot follow either. So: **magnitude verified, trigger unfound**,
and the record says which searches were run rather than implying the game lacks the mechanism.

That is the shape §3j.80's rule was written to force, and this is the first record written
under it.

#### An apostrophe defeated the name-collision rule

Writing the above, I described the pool as "additive with **Paul's Goat Hoof**" — using a
typographic apostrophe. The dataset's display name uses a straight one. The strip step
therefore did not match, `Hoof` survived into the residue, and the §3j.77 rule reported an
unlabelled reference to an item I had just named.

The rule was right to fire and wrong about why, which is the worst kind of check: it would have
trained me to write around it. Both comparisons now normalise `’ ‘ ʼ` to `'` and `" "` to `"`
before matching. The dataset is straight-quoted; prose written by hand is not reliably so, and
a check that depends on which apostrophe someone typed is a check that fails at random.

Worth noting the sequence: the rule caught a real defect in §3j.77 within ten minutes, and
produced its first false positive here, on the fourth day of use, from punctuation. Both are
information. A check that has never fired is untested; a check that fires wrongly and gets
narrowed is being calibrated. The failure mode to fear is the third one — a check that fires
wrongly and gets *worked around*.

No coverage change: 207 of 217. This pass tightened a boundary and repaired a rule rather than
verifying a new item, which is the correct trade when the alternative is a record that reads
more confident than the search behind it.

### 3j.82 Molotov's puddle is half what its tooltip says; Sawmerang applies no bleed at all

The technique that settled Encrusted Key — **resolve every pointer in-bundle, infer nothing** —
settles Molotov too, and it is worth noticing that this open question had been recorded as
unresolvable-for-now for three passes.

```
MolotovClusterProjectile --childrenCount 6, coeff 1.0--> MolotovSingleProjectile
MolotovSingleProjectile  --childrenCount 1, coeff 1.0--> MolotovProjectileDotZone
```

Both hops resolve **inside the item's own bundle**. `ProjectileExplosion` passes children
`projectileDamage.damage * childrenDamageCoefficient`, so with a coefficient of 1 at each hop
the puddle's `projectileDamage.damage` is exactly your base damage. `ProjectileDotZone` then
does `attack.damage = damageCoefficient * projectileDamage.damage` — coefficient **1**, at
`fireFrequency = 1`.

**100% per second. The description says 200%.**

No step in the chain doubles anything, and every link was read rather than assumed. That is the
second place this project has caught the game's own tooltip being wrong by a clean factor, and
the second time the proof came from following pointers instead of arguing about coefficients.

The other half of the item resolves cleanly too: the stated "500% base damage" is a **sum** —
250% impact plus a 250% burn *total* — because `ProjectileExplosion` treats
`calculateTotalDamage` as a total rather than a rate. Right number, composite meaning.

#### Sawmerang: a clean negative and a deliberate refusal

Same session, same tools, and I did **not** correct it — which is the point of recording both
together.

The verified part is a good fact: the prefab's `ProjectileDamage.damageType` is
`{ damageType: 0, damageTypeExtended: 0, damageSource: 0 }` — **completely empty**. Sawmerang
applies **no bleed**. Its description says "plus 3x100% per second **while bleeding**", and
there is no bleed: the sustained damage is a `ProjectileDotZone`, and nothing the item does
would register with a bleed-synergy build. A player reading that clause and stacking Tri-Tip
Daggers is building on a word, not a mechanic.

The unverified part stays unverified. That dot zone is `damageCoefficient = 0.2` at
`fireFrequency = 30` with `resetFrequency = 10`, and since the reset cadence caps re-hits the
arithmetic is 10 × 20% = **200% per second per saw** — against a stated 100%. Every one of
those fields is read from the prefab. What I cannot establish is that this component is what
the description's clause refers to, and "my number is double theirs" is not evidence when the
two might be counting different things.

So: Molotov corrected, Sawmerang not, on the same day with the same technique. The difference
is not confidence in the arithmetic — both are solid — it is whether the chain from the game's
sentence to the game's field is closed. Molotov's is. Sawmerang's has a gap I can name, which
is exactly why it does not get a number changed.

Coverage 207 → **208 of 217**.

### 3j.83 Electric Boomerang is Sawmerang's twin, and a model that only gets to correct where it was tested

Dumping the `StunAndPierceBoomerang` prefab in full — rather than querying field names one at
a time — shows it carries **two** damage components, exactly like Sawmerang:

| Component | Fields | Values |
|---|---|---|
| `ProjectileOverlapAttack` | `resetInterval`, `maximumOverlapTargets`, `canHitOwner` | `damageCoefficient 3.1`, `fireFrequency 60`, **`resetInterval -1`**, proc 1 |
| `ProjectileDotZone` | `resetFrequency`, `lifetime`, `attackerFiltering` | `damageCoefficient 1`, `fireFrequency 30`, `resetFrequency 10`, `lifetime -1`, proc 0.2 |

`resetInterval = -1` disables the reset, and `BoomerangProjectile` never calls
`ResetOverlapAttack`. So **Electric Boomerang cannot strike the same enemy on the way back**,
and its description says it can — the identical defect, from the identical mechanism, as
Sawmerang. Two items shipped years apart, both promising a return-pass hit that the shared
projectile class does not implement. Chef's Cleaver remains the only thing in the game that
actually does it, and it needs an explicit `ResetOverlapAttack()` call plus a
`recallDamageCoefficient` field to manage it.

That is published. The damage figures are not, and the reason is worth stating precisely.

#### A model gets to change numbers only where it has been tested

Three items now hinge on the same reading of `ProjectileDotZone` — that `Fire()` runs at
`fireFrequency` but a target already in the ignore list is skipped, so the **reset** cadence
caps how often one enemy is hit:

| Item | fire vs reset | Computed | Stated | Verdict |
|---|---|---|---|---|
| Molotov (6-Pack) | **1 < 3** | 100%/s | 200%/s | **corrected** |
| Sawmerang | 30 > 10 | 200%/s | 100%/s | not corrected |
| Electric Boomerang | 30 > 10 | far above | 120%/s | not corrected |

Molotov is the case where the model is not doing any work: with `fireFrequency` below
`resetFrequency`, every fire hits everything inside, and "1 × base, once a second" needs no
theory about ignore lists. That correction rests on the chain of pointers, not on the model.

The other two are the untested direction, and they disagree with their descriptions **by
different factors in different directions** — 2× low, and more than 3× high. When one model
produces three mutually inconsistent disagreements, the model is the thing to doubt, not three
separate tooltips. So both keep the game's numbers and carry the arithmetic plus an explicit
note that our reading of the fire/reset pair is confirmed only in the other regime.

This is the same discipline as §3j.82 stated more generally: **the evidence has to be strong
enough for the specific claim.** A chain of resolved pointers can change a number. A plausible
model that has never been checked in the regime it is being applied to cannot — even when the
arithmetic is clean, and even when it is the third time in a row it has disagreed.

Coverage unchanged at 208 of 217; the count is not what moved.

### 3j.84 the dot-zone model, read instead of argued — and the reason for holding back changes

§3j.83 held two items back because our reading of `ProjectileDotZone`'s fire/reset pair was
"confirmed only where `fireFrequency < resetFrequency`". That was the wrong reason, and the way
to find out was to stop reasoning about the model and read it.

`OverlapAttack`:

```csharp
if (ignoredHealthComponentList.Contains(hurtBox.healthComponent)) return false;   // Fire()
...
public void addIgnoredHitList(HealthComponent component) { … ignoredHealthComponentList.Add(component); }
public void ResetIgnoredHealthComponents() { ignoredHealthComponentList.Clear(); … }
```

And `ProjectileDotZone.ResetOverlap()` does not clear the list — it **constructs a brand-new
`OverlapAttack`**, so the ignore list is discarded wholesale and `retriggerTimeout` (default
`+infinity`, the only thing that could expire entries on its own) never comes into play.

So the effective hit rate on a single target is **`min(fireFrequency, resetFrequency)`**,
**unconditionally**. The ratio between them changes the answer but not the mechanism, and the
"untested direction" caveat was describing a limit in my reasoning, not in the code.

#### Which leaves a better reason, and it is not a smaller one

With the model settled, the numbers are: Sawmerang **200% per second per saw** (stated 100%),
Electric Boomerang **400% per stack per second** (stated 120%). Neither was corrected, and the
tell is inside Electric Boomerang itself:

| Component | Computed | Stated | Ratio |
|---|---|---|---|
| Slice (`ProjectileOverlapAttack`) | `3.1 × 0.4n` = **124%** | 120% | **1.03** |
| Lingering (`ProjectileDotZone`) | `10 × 0.4n` = **400%** | 120% | **3.33** |

Both figures derive from the *same* fired `projectileDamage.damage`. They cannot both be
compared against the same description unless the two clauses measure different things — and the
one that lines up almost exactly is the one measuring a **single event**, while the one that is
wildly off is measuring a **rate**.

That points at the answer: these are instantaneous rates *while the target is inside the
hitbox*, and a boomerang in flight overlaps an enemy for a fraction of a second, not a whole
one. The description's "per second" is plausibly describing a pass. Without a contact duration
the two quantities are not comparable, and a factor-of-3.33 disagreement between
non-comparable quantities is not evidence of anything.

Recorded on both items, with the model's derivation, so the next person starts from "we need
the contact duration" rather than re-deriving the ignore list.

#### The shape of the last three passes

Molotov moved because a chain of pointers closed. Encrusted Key moved because a pointer
resolved in-bundle. These two did not move, twice, for two *different* reasons — and the second
reason only became visible after removing the first. **Being wrong about why you are uncertain
is its own kind of error**, and it is invisible while the conclusion happens to be right.

### 3j.85 both new guards were only watching the file they were born in

The name-collision rule (§3j.77) and the negative-claim rule (§3j.80) each read
`items.json` and nothing else. `reference.ts` holds **21 artifact and shrine `mechanic`
strings** and **12 `cost` strings** — prose published with exactly the same authority, dense
with internal names, and thirteen of the artifact ones written in a single pass. Neither guard
had ever looked at any of it.

Pointing them at it found two defects immediately, both in **Artifact of Honor**:

- *"Malachite, Celestine, Void and Perfected elites **are not in that array**"* — an unscoped
  negative about which elites exist.
- A bare **`Lightning`** in `eliteDefs = { Fire, Lightning, Ice, Earth }`, which is the
  `cachedName` of **Royal Capacitor**. A reader has no way to tell the elite from the item.

Rewritten to `{ Elites.Fire, Elites.Lightning, Elites.Ice, Elites.Earth } — the four entries in
that static array, which is the whole of the search`, which fixes both at once: the negative
now states its scope, and the names carry their namespace.

#### One refinement to the rule, which the fix itself demanded

`Elites.Lightning` still tripped the collision check, because `\bLightning\b` matches inside a
dotted path. But a **dotted reference is self-disambiguating** — `Buffs.BugWings`,
`Items.BoostHp`, `Elites.Fire` all name their namespace, and no reader mistakes them for an
item page. Only a bare token is ambiguous. The rule now requires the match not be preceded by
`.` or a word character.

That is the third calibration of this check in four days — substring-of-a-display-name,
typographic apostrophes, and now dotted paths — and each one narrowed it without weakening what
it catches. Verified by injecting both defect kinds into a shrine's `mechanic` string:

```
✗ reference.ts mechanic #19: cites the internal name "Syringe", which belongs to
  "Soldier's Syringe" …
× every negative claim in published prose is scoped or hedged
    Artifact of Swarms (mechanic)
```

Both fire on the file they previously could not see.

#### The general lesson, which cost a test to learn

Reverting the injection with `git checkout` also reverted the Honor fix I had made minutes
earlier, and the Playwright assertion pinned to the *old* wording then failed — correctly. Two
things worth keeping from that: a guard proven only on the dataset it was written for is
unproven, and **the blast radius of a "temporary" edit is whatever the revert command takes,
not whatever you were thinking about.**

Coverage unchanged at 208 of 217. Nothing was verified this pass; two published sentences were
wrong and two guards had a blind spot the size of the rest of the dataset.

### 3j.86 the third uncovered surface: prose that lives in components

§3j.85 extended the two guards from `items.json` to `reference.ts`. The obvious next question
is what is *still* uncovered, and the answer is a lot: **a large share of what a reader is told
about the game is written directly into `.tsx`.** The Stat Lab's Transcendence warning, the
three difficulty hints, the proc footnotes on two pages, the artifact panel's framing — all
claims about the game, published with the same authority as a stacking row, and never read by
any check.

Swept 57 files. Four hits, and **every one was a gap in my detectors rather than a defect in
the prose** — which is itself the useful result, because three of those gaps were live in the
data guards too:

| Hit | Diagnosis |
|---|---|
| *"we could not establish a value from game data"* ×2 | **A hedge my QUALIFIED list did not know.** It is the exact admission the rule wants; the vocabulary was incomplete. |
| `throw new Error('Root element "#root" not found')` | Developer-facing, not reader-facing. Scope error. |
| bare `Saw` in `reference.ts` | **"Power-Saw"** — MUL-T's skill. `\bSaw\b` matches after a hyphen, but a hyphen joins a compound word rather than starting a token. |

So: `could not establish` and `that array` join the hedge vocabulary, the collision lookbehind
now excludes `-` as well as `.` and word characters, and the negative-claim guard runs over
`src/components/**` and `src/data/**` — scoped deliberately, since infrastructure strings are
addressed to developers and a rule that scolds you for `Error("… not found")` is a rule people
disable.

Verified by injection, as usual: a constant reading *"This expansion does not appear in the
game files"* dropped into `DlcBadge.tsx` fails the suite **by filename**.

#### What four false positives in a row actually mean

It would be easy to read this pass as the checks being too noisy. The opposite: each false
positive was a place where the rule and my *intent* had drifted apart, and every one of those
gaps existed in the data guards as well — prose in `items.json` hedged with "could not
establish" would have been flagged, and a hyphenated item name would have collided. Extending
coverage to a new surface is also the cheapest way to find out that the rule was subtly wrong
on the old one.

Four calibrations in five days, and the check has still never had to be weakened — only made
more precise about what it was always trying to say. The count of things it catches has not
gone down.

Coverage unchanged at 208 of 217.

### 3j.87 re-examining a claim I had already published twice

Reading `OverlapAttack` for the dot-zone question (§3j.84) surfaced a field I had not accounted
for: **`retriggerTimeout`**. Entries can leave the ignore list on their own —
`cleanupRetriggerList()` drains a queue inside `Fire()`, releasing anything whose timeout has
elapsed. That is a **third** escape, alongside the timed reset and a manual
`ResetOverlapAttack()` call.

I had published "each saw hits a given enemy once" on **two** items — Sawmerang (§3j.68) and
Electric Boomerang (§3j.83) — having checked only the first two escapes. If
`ProjectileOverlapAttack` set `retriggerTimeout`, both records were wrong, and both are
statements that contradict the game's own descriptions. A confident correction resting on an
incomplete search is worse than no correction.

It is assigned in **exactly two places in the game**:

```
EntityStates.Chef/RolyPoly.cs:358        attack.retriggerTimeout = 0.5f;
EntityStates.FriendUnit/KineticAura.cs:147   attack.retriggerTimeout = refreshTime;
```

Neither is `ProjectileOverlapAttack`, which leaves the default `float.PositiveInfinity`, and
the guard `if (retriggerTimeout != float.PositiveInfinity)` means nothing is ever even queued
for removal. **The claim holds** — now on all three conditions, and both records say so rather
than implying two checks were the whole search.

#### The same read handed us a mechanic we had missed

`KineticAura` is **Orphaned Core's** launch attack, and it *does* set the timeout — to
`refreshTime`, which is **1.5 seconds**. So the Solus unit is emphatically **not**
one-hit-per-enemy the way a boomerang is: the same target becomes hittable again every 1.5s,
which is why a unit pinballing around one large enemy keeps doing damage. That was absent from
the record entirely.

#### Why this pass was worth spending on something already "done"

Nothing here was flagged. `data:audit` was clean, 128 tests passed, and both Sawmerang and
Electric Boomerang read as finished work. The prompt to look again came from having read a
*different* part of `OverlapAttack` for a *different* item and noticing a field with
consequences for a claim made elsewhere.

That is not a repeatable process, which is the uncomfortable part. The guards built over the
last four passes catch **unscoped** claims and **misattributed** names; they cannot catch a
claim that is scoped, attributed, well-evidenced on the conditions checked, and simply missing
a condition. The only defence found so far is the one that worked here: when a shared mechanism
turns out to be more complex than assumed, go back to **everything that already depends on it**
rather than only the item in hand.

Coverage unchanged at 208 of 217; one claim strengthened, one mechanic added.

### 3j.88 the "go back to everything depending on it" defence, run and then automated

§3j.87 ended by admitting the defence it had used was manual and unrepeatable: when a shared
mechanism turns out to be more complex than assumed, go back to **everything already depending
on it**. So this pass ran that sweep properly, and then turned it into a check.

Ten records across five items reason about `OverlapAttack`'s ignore list:

| Item | Claim | Status after the sweep |
|---|---|---|
| Sawmerang | hits once per saw | closed on all three in §3j.87 |
| Electric Boomerang | hits once per throw | closed on all three in §3j.87 |
| Orphaned Core | re-hittable every 1.5s | added in §3j.87 |
| Molotov (6-Pack) | puddle 100%/s | rate, not a count — reset 3/s vs fire 1/s means every fire hits regardless |
| **Volcanic Egg** | **ram hits once per enemy** | **cited only the reset period** |

Volcanic Egg was the one still resting on a partial search. Checked: `FireballVehicle`'s
object initialiser constructs its `OverlapAttack` with eleven fields and **`retriggerTimeout`
is not among them**, so it keeps `float.PositiveInfinity`; the manual
`ResetIgnoredHealthComponents()` runs on a period of `1/0.00001` = **100,000 seconds**; and
there is no timed `resetInterval` on that path. The claim holds, and now says so.

#### The check

A record that reasons about the ignore list **in order to claim a hit count** must mention
`retriggerTimeout`. Records that cite the same machinery to explain a **rate** are exempt —
they are not claiming a count, and the fire/reset cadence really is the whole of that story.
That distinction matters: a blanket rule would have forced irrelevant boilerplate onto
Molotov's puddle and taught me to satisfy the checker rather than the question.

Verified by deletion rather than injection this time — stripping the retrigger sentence from
Volcanic Egg fails the suite by item and row name.

#### What this does and does not solve

It converts one specific incompleteness into a permanent guard, for one mechanism, on one kind
of claim. It does **not** generalise: nothing stops the same failure on the next shared
mechanism whose complexity I underestimate. The honest summary is that §3j.87's lesson was
right and its pessimism was too — the sweep is repeatable **per mechanism**, once you know the
mechanism is worth sweeping, and knowing that still comes from reading code for an unrelated
reason.

What is now true and was not before: every hit-count claim in the dataset has been checked
against the complete model, and none can silently regress.

Coverage unchanged at 208 of 217.

### 3j.89 the input every curve on the site takes, and nobody had defined

The last two passes established a method: when a shared mechanism turns out to be more complex
than assumed, sweep everything that depends on it. The obvious next question is **which shared
mechanism does this dataset lean on hardest**, and the answer is not close.

Every stacking curve, every breakpoint table, every "per stack" figure takes **a stack count**
as its input — and that count comes from `GetItemCountEffective`. In roughly a hundred passes
of verification work I had never once asked what *effective* means.

```csharp
private void UpdateEffectiveItemStacks(ItemIndex itemIndex)
{
    int stackValue  = permanentItemStacks.GetStackValue(itemIndex);
    int stackValue2 = channeledItemStacks.GetStackValue(itemIndex);
    int itemStacks  = tempItemsStorage.GetItemStacks(itemIndex);
    num = stackValue + stackValue2 + itemStacks;
    …
    if (inventoryDisabled && ItemCatalog.GetItemDef(itemIndex).canRemove) num = 0;
    effectiveItemStacks.SetStackValue(itemIndex, num);
}
```

Two facts that apply to **every number in the dataset**:

- A stack is the sum of **three** collections — items you picked up, items you are currently
  **channeling**, and **temporary** items. A borrowed or channeled copy feeds every curve on
  the site exactly as hard as one you own. Nothing on the site said so.
- The whole count **drops to zero** while an inventory is disabled — which is what "disable
  items" effects mechanically *are*, including the one Of One Mind's death explosion applies.
  And the reset is gated on `canRemove`, so survivor passives and world-unique items keep
  working through it.

#### Where it belongs

Not on 217 records. It is a property of the *input* to every formula, so it goes once, at the
head of the Breakpoints tab, above the curves it qualifies. That tab already explains how
stacking curves behave; it had never explained what they are counting.

This is the §9 omission class in its purest form: nothing was wrong, every number was right,
and a reader had no way to learn that "3 stacks" might include a temporary copy that will
expire, or that a single debuff can zero the lot. The site's premise is *the answers the game
makes hard to find*, and this is the answer underneath all the others.

#### On the method

Three passes ago the defence against incomplete models was "go back to everything depending on
it", and I noted that knowing *which* mechanism to sweep still came from reading code for an
unrelated reason. This pass suggests a cheaper heuristic: **sweep the mechanisms with the most
dependents first.** `GetItemCountEffective` is cited by name in only four formulas but is the
silent input to all 217, and that gap — between how often something is *mentioned* and how much
rests on it — is a usable signal for where to look next.

Coverage unchanged at 208 of 217.

### 3j.90 Sure Proc — the mechanic that makes every chance in the dataset a 100%

The heuristic from §3j.89 was "sweep the mechanisms with the most dependents first". After
`GetItemCountEffective` (the input to every stacking number), the next densest is
`LocalCheckRoll` — the gate behind **every "% chance on hit" figure the site publishes**. Its
signature carries a parameter I had read past a dozen times:

```csharp
bool LocalCheckRoll(float percentChance, CharacterMaster master, bool ignoreSureProc)
{
    if (!ignoreSureProc) { if (!sureProc) return Util.CheckRoll(percentChance, master); return true; }
    return Util.CheckRoll(percentChance, master);
}
```

`if (!sureProc) … return true;` — when `sureProc` is set the roll **does not happen**. The
stated chance is irrelevant and the effect simply fires.

Traced end to end:

- **Earned** in `HealthComponent`, on the parry path — the same branch that rejects the damage,
  grants 0.5s of hidden invincibility and refunds 75% of the equipment cooldown also does
  `body.AddBuff(DLC3Content.Buffs.SureProc)`.
- **Spent** on the next damage you deal *from a skill*
  (`damageInfo.damageType.damageSource & DamageSource.SkillMask`), which removes the buff and
  stamps `ProcType.SureProc` onto that hit's `procChainMask`.
- **Consumed** by every `LocalCheckRoll` on that hit, all of which short-circuit to `true`.

So: **parry, then hit something with a skill, and every on-hit item you own procs at once, at
100%, regardless of its printed chance.** Tougher Times' block sits on a different path, but
Ghor's Tome, Sentient Meat Hook, Tentabauble, Stun Grenade, Bandolier, Electric Boomerang and
the rest are all gated by this call.

Exactly **one** roll in the game opts out — `ignoreSureProc: true` appears once, against
eleven `false` — and it is an elite's chance to drop its equipment on death. Naming that
exception matters: "always, except once" is a checkable claim, and "always" would have been
wrong.

#### Placement, again

Same reasoning as §3j.89 and worth stating as a settled rule: **a property of a whole class of
numbers goes once, beside the class.** This one qualifies every chance in the on-hit table, so
it sits directly above that table rather than being copied onto every proc item — where it
would be 20 identical paragraphs nobody reads, and 20 places to drift.

Two passes, two mechanics that silently qualify the entire dataset, both found by asking not
"what is unverified?" but **"what does everything depend on?"** The remaining `langfile` count
did not move for either, and both are more useful to a reader than any of the nine items still
on that list.

### 3j.91 why proc chains stop — the third dataset-wide mechanic in three passes

Continuing the "most dependents first" sweep. After stack counts (§3j.89) and the roll gate
(§3j.90), the third is `ProcChainMask`, and the site had **zero** mentions of it: not in a
formula, not in a component, nowhere.

It is a bitmask over the 28 entries of `ProcType`, and the whole mechanism is three lines:

```csharp
public void AddProc(ProcType procType) { mask |= (uint)(1 << (int)procType); }
public bool HasProc(ProcType procType) { return (mask & (1 << (int)procType)) != 0; }
```

`GlobalEventManager` reads `!damageInfo.procChainMask.HasProc(X)` at **21 separate gates**
before firing effect X, and every effect that spawns follow-up damage stamps its own type onto
the mask it passes along. So **each proc type fires at most once per chain**: missiles never
launch missiles, chain lightning never re-chains off its own bolts, a boomerang cannot spawn a
boomerang.

The half that is easy to state wrongly, and matters more: **different types still trigger one
another.** That is why proc chains exist at all, and it is why the proc coefficient on a
*secondary* hit decides how far one travels. Writing "effects can't chain" would have been
both simpler and false; the test asserts the qualifier is present, not just the rule.

#### Three passes, three mechanics, one question

| Pass | Mechanism | Qualifies |
|---|---|---|
| §3j.89 | `GetItemCountEffective` | every stack count on the site |
| §3j.90 | `LocalCheckRoll` / Sure Proc | every "% chance on hit" |
| §3j.91 | `ProcChainMask` | every on-hit effect's ability to trigger another |

None of the three was flagged by any check. None moved the coverage number. All three were
found by asking **"what does everything depend on?"** rather than "what is still unverified?",
and each turned out to be a fact a player would actually want — the kind the game makes hardest
to find, because it is never printed on any item.

Between them they now define the three inputs every on-hit calculation on the site takes: how
many of an item you effectively have, whether the roll happens at all, and whether the effect
is still eligible to fire. Those were previously assumed by 217 records and stated by none.

The `langfile` list is unchanged at nine, and I think that is the right trade: the remaining
nine are individually hard and narrow, while these three qualify everything.

### 3j.92 the difficulty coefficient — four published formulas rode on an undefined term

Fourth pass of "most dependents first". Four item records scale their payout by
`difficultyCoefficient` — **Roll of Pennies, Ghor's Tome, Brittle Crown, Defiant Gouge** — as
do chest prices, Artifact of Kin's spawn budget and the Bulwark encounter cost. The site
published all of them and never once said what the term meant.

`Run.RecalculateDifficultyCoefficentInternal`:

```
base     = 0.7 + 0.3 x players
timeRate = 0.0506 x scalingValue x players^0.2
coeff    = (base + timeRate x floor(minutes)) x 1.15^stagesCleared
```

`scalingValue` comes from `DifficultyCatalog`, and reading the constructor calls gives the
fact that is genuinely hard to find elsewhere:

| Difficulty | scalingValue |
|---|---|
| Drizzle | 1 |
| Rainstorm | 2 |
| Monsoon | 3 |
| **Eclipse 1 – 8** | **3** |

**Every Eclipse level shares Monsoon's 3.** Eclipse does not scale this curve at all — it
stacks its own separate modifiers. A reader who assumes "Eclipse 8 must scale harder than
Monsoon" is wrong about the mechanism, if not about the experience.

Solo on Rainstorm the run starts at exactly **1.0** (`0.7 + 0.3`) and gains **0.1012** per
minute, while each stage cleared multiplies the entire expression by **1.15** — so late in a
run, clearing a stage moves the coefficient far more than the clock does.

#### The detail I would have missed by skimming

```csharp
float num2 = Mathf.Floor(num * (1f / 60f));            // difficultyCoefficient
...
float num10 = (num4 + num7 * (num * (1f / 60f))) * …;  // ambientLevel — no floor
```

The coefficient uses **floored** minutes and therefore rises in **steps, once a minute**.
Monster level is computed from the same inputs **without** the floor and climbs
**continuously**. Two curves, same run, same variables, and only one of them ticks. The lines
are eleven apart and differ by one function call.

#### Four passes, four shared inputs

| Pass | Term | Silently qualified |
|---|---|---|
| §3j.89 | `GetItemCountEffective` | every stack count |
| §3j.90 | Sure Proc | every "% chance on hit" |
| §3j.91 | `ProcChainMask` | every on-hit effect's eligibility |
| §3j.92 | `difficultyCoefficient` | four payouts, every price, every spawn budget |

Each was published-adjacent for months, cited in formulas as a bare identifier, and never
defined. The pattern is now clear enough to name: **a term used inside a verified formula
inherits the formula's air of authority without inheriting any of its verification.** Writing
"`25 x difficultyCoefficient^1.25`" looks like a complete answer, and is only complete if the
reader already knows the part we did not write down.

### 3j.93 stop guessing which term to define — extract them

Four passes found four undefined shared terms by intuition. §3j.92 named why they exist —
*a term cited inside a verified formula inherits the formula's authority without inheriting
its verification* — which is a description of a **class**, and classes can be enumerated.

So: pull every identifier-shaped token out of all 217 records' formulas, rank by how many
records lean on it, and check each against everything a reader can actually see.

The ranking is noisy (an `[a-z]{8,}` pattern happily matches "description" and "multiplied"),
but the top real entry is unambiguous:

| Term | Records | Explained anywhere? |
|---|---|---|
| `CharacterBody.RecalculateStats` | 25 | yes |
| **`procCoefficient`** | **18** | **one sentence** |
| `damageCoefficient` | 16 | contextually |
| `levelScale` | 7 | no |
| `blastRadius` | 7 | contextually |

`procCoefficient` was the largest gap, and the site's entire treatment of it was *"a skill's
proc coefficient scales how often it triggers on-hit items"* — true, and not enough to use.
28 uses in `GlobalEventManager`, doing **two** different jobs:

- **Chances scale linearly.** `LocalCheckRoll(chance * damageInfo.procCoefficient, …)` — a 0.5
  hit is exactly half as likely, with none of the hyperbolic softening the tables above it
  use. Getting this wrong in the other direction is easy, because every *stacking* curve on
  that page is hyperbolic.
- **Durations scale too.** `AddTimedBuff(Buffs.HealingDisabled, 8f * damageInfo.procCoefficient)`
  — Malachite's healing-disable is eight seconds only at coefficient 1.
- **Zero is a hard stop, not a small number.** `OnHitAllProcess` opens with
  `if (damageInfo.procCoefficient == 0f …) return;`, so nothing you own fires at all.

That completes the on-hit story the last four passes have been assembling, and it is worth
seeing as one thing rather than four:

| Input | Question it answers |
|---|---|
| `GetItemCountEffective` | how many of the item do you *effectively* have |
| Sure Proc | does the roll happen at all |
| `ProcChainMask` | is this effect still eligible on this chain |
| **`procCoefficient`** | **how likely, and for how long** |

#### On the method

The extraction is crude and I am not going to pretend otherwise — it needs a human to
separate `levelScale` from "multiplied". But it converts *"which mechanism should I look at
next?"*, which had been four passes of intuition, into a ranked list I can work down. The four
terms found by instinct all appear in the top of that list, which is the encouraging part: the
instinct was right, and now it does not have to be.

`levelScale` (7 records, genuinely undefined) is the next one down.

### 3j.94 `levelScale` was my own invention, and it was two different multipliers

The term extraction from §3j.93 listed `levelScale` at seven records and "explained: no". It
is explained nowhere because **it does not exist in the game.** I made the name up, and used
it for two unrelated things.

`RecalculateStats`, eleven lines apart:

```csharp
float num79 = 1f;  if (num60 > 0) num79 += 0.5f + 0.15f * (num60 - 1);   // health side
float num84 = 1f;  if (num60 > 0) num84 += 0.5f + 0.15f * (num60 - 1);   // regen side
float num85 = 1f + num72 * 0.2f;                                          // num72 = level - 1
```

`num60` is **`DLC3Content.Items.BonusHealthBoost` — Quick Fix**. So `num79`/`num84` are a
*Quick Fix* multiplier, and only `num85` is a level factor. They are applied to different
things:

| Quantity | Level factor (`num85`) | Quick Fix (`num79`/`num84`) |
|---|---|---|
| Flat item health (Bison Steak 25, Knurl 40, Seared Steak 50) | **no** | yes |
| Percentage item health (Pearl 10%, Seared Steak 5%) | **no** | yes |
| Item regen terms (Knurl 1.6, Hearty Stew 2.5, Irradiant 0.1) | yes | yes (on the sum) |

Seven records said flat health items "scale with level like every flat-health item". **They
carry no level term at all.** Nine rows across eight items rewritten, with the two multipliers
named separately and Bison Steak carrying an explicit `CORRECTION:` since the wrong claim was
published.

Quick Fix's own record was inside-out as a result: it described itself as raising "the
level-scaling multiplier". It raises *its own* multiplier, which is not the level one, and the
level factor is entirely unaffected by it.

#### Two things worth separating

**`statMath.ts` was right the whole time.** It applies a level factor to item regen and none to
flat health — exactly correct. `pnpm data:verify` has been passing because the *calculator*
matched the game; the error lived only in the prose beside it. That is the failure mode
§3j.80 named — prose is where the `verified`/`langfile` split cannot see — and this is a
sharper instance, because the number was right and the *explanation* of the number was wrong.

**Inventing a name is how it happened.** Neither `levelScale` nor `quickFixMultiplier` appears
in the decompile; both are mine. `quickFixMultiplier` is honest because it names the thing
that sets it. `levelScale` asserted a mechanism in its own name, and once written it read as
verified — nothing in the pipeline distinguishes a term I coined from one I copied. A test now
fails if the word reappears anywhere.

The method earned its keep on its first real use: four passes of intuition found four *missing*
definitions, and the ranked list immediately found a *wrong* one.
