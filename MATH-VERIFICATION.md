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

### 3j.95 sweeping the term that caught me twice — 13 exact, 3 explained, 0 wrong

`damageCoefficient` was next on §3j.93's ranked list: **16 records**, the most-cited unit in
the dataset, and the one that has produced two near-misses. Aurelionite's prefabs carry `0.1`
and `1.0` against a stated 15% and 150%; Electric Boomerang's carries `3.1` against a stated
120%. Both looked like the game contradicting itself, and in both cases the **fired** damage
was pre-scaled — `× 1.5f` for one, `× 0.4f × n` for the other. A coefficient multiplies
whatever value it was handed, and that is not always your base damage.

Having been caught twice, the question is how many of the other fourteen are wrong. So: parse
every cited coefficient, multiply by 100, compare against the base the record publishes.

**13 exact. 3 mismatched, all three already documented:**

| Record | Coefficient implies | Published | Why |
|---|---|---|---|
| Electric Boomerang — impact | 310% | 120% | fired with `damage × 0.4f × n`; 3.1 × 0.4 = 1.24 |
| Electric Boomerang — DoT | 100% | 120% | same pre-scaled chain |
| Sawmerang — blade contact | 20% | 200% | a **rate**: 0.2 × 10 hits/s, not a per-hit figure |

Nothing unexplained. That is the outcome I wanted and could not have assumed — the term that
burned me twice is consistent in every other place it appears, and the three exceptions are
exactly the three already carrying notes.

#### The invariant

A record citing `damageCoefficient = X` must publish `base = 100X`, **or its formula must say
why not** — a pre-scaling chain, an explicit rate, or a flagged open question. A test now
enforces it across all 217 records, verified by injecting a `7f` coefficient against a base of
300 and watching it fail by item and row.

What makes this one worth having is that it catches the *specific* mistake I actually make.
The two near-misses were not carelessness — the prefab value genuinely looks like the answer,
and it takes a second lookup to find the multiplication upstream. This check is that second
lookup, run automatically, on every record, forever.

#### Where the ranked list stands

Four terms defined (§3j.89–93), one invented term caught and split (§3j.94), one swept and
pinned (this). `blastRadius` (7 records) is next, and I expect it to be dull — a radius is a
radius — which is itself worth confirming rather than assuming.

### 3j.96 the dull term wasn't — a blast radius without its falloff is half an answer

I predicted `blastRadius` (7 records) would be dull, and said that was worth confirming rather
than assuming. It was worth confirming.

The sweep found no arithmetic inconsistency — a radius is a radius, and the two records that
publish one as their own value are both exact. But it surfaced the question the sweep was not
looking for: **five of the seven published a blast radius without saying whether the damage
tapers across it.** `BlastAttack` has **five** falloff models, and they are not variations on a
theme:

```csharp
case FalloffModel.None:          num2 = 1f;
case FalloffModel.Linear:        num2 = 1f - Mathf.Clamp01(num / radius);
case FalloffModel.SweetSpot:     num2 = 1f - ((num > radius / 2f) ? 0.75f : 0f);
case FalloffModel.HalfLinear:    num2 = 1f - Mathf.Clamp01(num / radius) * 0.5f;
case FalloffModel.QuarterLinear: num2 = 1f - Mathf.Clamp01(num / radius) * 0.75f;
```

**Linear reaches zero at the rim.** So "600% in 8 metres" under Linear delivers 600% at the
exact centre and nothing at the edge, while the same sentence under None delivers 600%
everywhere inside. Same words, entirely different item.

And **SweetSpot is a cliff, not a taper** — full damage inside half the radius, a flat 25%
beyond it.

#### What the missing halves turned out to be

| Record | Model | Consequence |
|---|---|---|
| Box of Dynamite | None | full 240% anywhere in 7m |
| Molotov (6-Pack) | None | each bomblet's full 250% across its 7m |
| Of One Mind | None | full 100% across the whole 11m |
| **Remote Caffeinator** | **SweetSpot** | **2000% within 8m, then exactly 500% out to 16m** |
| Aurelionite's Blessing | Linear (outer) / None (centre) | the ring tapers to nothing; the centre does not |

Remote Caffeinator is the one worth the pass on its own. Its description gives a single damage
number, and the item actually has an **inner and an outer band with a fourfold step between
them**. Nothing in the game's text hints at it, and I had published the 2000% with a radius
and no model — technically true, and misleading in the way a half-stated mechanic always is.

Aurelionite's is the subtler one: the outer ring and the centre use *different models*, which
explains why the ring feels weaker than its stated 15% suggests. That asymmetry is invisible
unless you read both prefabs.

#### The test, and what caught the last one

A record citing `blastRadius` must state its falloff model. Writing it flagged **Aurelionite's
Blessing**, which I had not thought to check — I had gone looking for the five I knew about
and stopped. The test found the sixth.

That is the second time this session a check has caught something in the same pass that wrote
it (§3j.77 was the first). Both times the check knew the rule better than I was applying it,
which is the whole argument for writing rules down as code rather than as resolutions.

### 3j.97 checking my own vocabulary against the game's

§3j.94 caught `levelScale` — a word I invented, used in seven records, which asserted a
mechanism *in its own name* and was wrong about it. The uncomfortable part of that entry was
the admission at the end: **nothing in the pipeline distinguishes a token I coined from one I
copied out of the game.** This is that distinction, made mechanical.

Every camelCase token in every formula, checked against 90 MB of decompiled C#. **273 tokens;
259 exist in the game.** The 14 that do not, reviewed one by one:

| Kind | Tokens | Verdict |
|---|---|---|
| Deliberate shorthand of mine | `quickFixMultiplier`, `levelFactor`, `healthMultiplier` | fine — each named after *what sets it*, not after a mechanism it claims |
| Readable stand-ins for real parameters | `hitDamage`, `bodyDamage`, `previousFrac`, `irradiantPearls`, `maxGuards`, `beadLevels` | fine, and checked |
| Asset names | `dtLockbox`, `dtVoidLockbox`, `dtVoidChest`, `cscMinorConstructOnKill`, `bdBugWings` | real game identifiers that live in bundles rather than the assembly |

No second `levelScale`. That is the result I wanted and, again, could not have assumed.

The two I trusted least were Runic Lens's `hitDamage` and `bodyDamage`, since a stand-in for a
damage term is exactly where a wrong assumption hides. `MeteorAttackOnHighDamageUtil`:

```csharp
public static int CalculateOverspill(DamageInfo damageInfo, float attackerBodyDamage)
    => (int)(damageInfo.damage / attackerBodyDamage);
```

`hitDamage / bodyDamage` is an honest rename of exactly that. Checked rather than assumed,
which is the point of having flagged them at all.

#### The rule

A camelCase token in a formula must **exist in the decompile** or appear in an explicit
`COINED_OK` list with a comment saying what it stands for. Deliberate shorthand is often
*clearer* than the game's own `num79` — the failure was never coining, it was **coining
silently**. Now a new invention fails the build and has to be justified in the same commit
that introduces it.

Verified by replaying the original bug: putting `levelScale` back on Bison Steak produces

```
✗ "levelScale" appears in a formula (Bison Steak) but exists nowhere in the decompiled
  source — if it is deliberate shorthand, add it to COINED_OK; if it names a mechanism,
  that name is an unverified claim
```

The audit still runs in 1.7 seconds, and skips gracefully where `.decompiled` is absent — CI
keeps passing without the game install.

#### Where this leaves the term sweep

Started at §3j.89 as "what does everything depend on?", ran through four undefined shared
mechanics, one invented term, one swept unit and one half-stated one. It now ends with a check
that asks the question automatically for every token we write from here on. The ranked list
that started it is exhausted of real entries — what remains below `blastRadius` is English
prose the pattern mistakes for identifiers.

### 3j.98 §9.3 cross-cutting — 45 tooltips, and the two that had gone stale

The last unaudited surface on §9.3's list. Every `title` and `aria-label` in the app: **45 of
them**, extracted and read one by one, because a tooltip is a claim that happens to be small.

Forty-three are accurate. Two were describing a version of this project that no longer exists.

**`ItemCard`: "Unverified — pending logbook confirmation."** The in-game logbook was how M1
verified things. Nothing has been verified that way since §6A — the standard has been
decompiled code and serialized assets for the whole life of the verification programme. If
that dot ever rendered it would tell a reader we work in a way we abandoned.

**`CLAUDE.md`: the opinion layer "is designed but **unbuilt**".** It is built and *parked*.
`src/components/guides/`, `src/content/guides.ts` and `content/guides/_template.md` all exist,
and `src/router.tsx` carries a precise note on re-enabling it — restore two imports and routes,
plus the nav entry. What is missing is written guides, which need a human author. "Unbuilt"
would send someone to write infrastructure that is already there.

#### Both were unreachable, and that is the point

The ItemCard dot renders only when `verified: false`, and **every record is `verified: true`**.
The CLAUDE.md line describes a directory most work never touches. Neither could be seen by
using the site or running the suite, and both had been read past dozens of times in this
session alone.

That is the §9 thesis in its least glamorous form. The audit found them not by testing
behaviour — there is no behaviour — but by **enumerating a category and reading every member**,
which is the only method that reaches things nothing exercises.

#### The check

Not the wording — vocabulary. `logbook` was M1's verification source and has not been one
since; if it reappears in a user-facing string, something has been copied forward from a model
of the project that no longer holds. A test walks every `.tsx`, strips comments (which may
legitimately discuss the old model), and fails on the word.

#### §9.3 is now complete

| Surface | Pass |
|---|---|
| Shell, Codex, Planner | §3j.58 |
| Stat Lab | §3j.59, §3j.61 |
| Reference, Survivors | §3j.60, §3j.64 |
| **Cross-cutting** | **this** |

Per §9.5, done is not "no findings" — it is that every surface has been read with the §9.1
questions asked, every finding fixed or recorded, and the unexaminable named. What remains
unexaminable is unchanged and worth restating: **behaviour under real play.** Nothing here
substitutes for someone holding the item and watching the number.

### 3j.99 the status section was itself out of date

§3j.98 found a stale claim in `CLAUDE.md` while auditing tooltips. Having found one, the
obvious move was to check the rest of that file rather than assume it was the only one. It
was not.

**"Proc coefficients: 78/125 loadout skills verified … the rest are honestly marked
unverified."** The real number is **106/125**, and "the rest" is not unverified at all — 19
have no damage path and **0 are genuinely unknown** (§3j.47, §3j.64). The sentence understated
the work by 28 skills and mischaracterised the remainder.

**"Next up: proc tail — split genuinely non-damaging skills from the truly unknown ones so
the UI can say 'no proc' instead of 'unverified'."** That is a verbatim description of work
finished in §3j.64. Anyone picking the project up would have started on a task that was done,
and found the code already doing it.

Also corrected: the item line now records that **208 of 217 are traced to code or assets**,
with the remaining 9 characterised rather than left as a bare count — 4 quest items with no
mechanic, 2 equipment fully described by `consumedOnUse`, 3 open questions each carrying the
arithmetic that would settle them. And §9 and the guards, neither of which the Status section
mentioned at all, are now listed.

#### Why this matters more than it looks

This is a project whose entire premise is that unverified claims must not read as verified.
Its own status file was making claims about the verification and getting them wrong. The
failure mode is identical to the one §9 was written for — **correct work, false description**
— aimed at the next person to open the repository instead of at a player.

And the drift direction is worth noting: every stale claim understated or mis-stated *completed*
work. Nothing overstated it. That is the cheerful version of the failure, and it still sends
someone to redo finished work.

#### The check

Two counts the Status section quotes are now derived and asserted: procs verified out of total,
and items traced out of total. Verified by putting the old `78/125` back and watching it fail
by name. Prose around them can be rewritten freely; the numbers cannot drift.

`Next up` now has exactly two entries, and both are honest about needing something this process
cannot supply: **written guides need a human author**, and **in-game observation needs someone
holding the item**. Everything reachable by reading code and assets has been read.

### 3j.100 the source of truth for the schema did not mention four schema fields

`CLAUDE.md` names `PLAN.md` as "the source of truth for scope, schema, and milestones", and
tells every contributor to read it in full before doing anything. Having found two stale
claims in `CLAUDE.md` (§3j.98, §3j.99), the larger document was the obvious next place to
look.

Its mechanically-checkable surface is clean: every path it names exists, every `pnpm` command
it gives is in `package.json`, no checklist item is left open. The gap is in the part that
cannot be checked by existence — **the schema block is the Phase-1 draft, and four fields
added since appear nowhere in the file at all:**

- **`capStacks`** — a *hard* ceiling in stacks. Deliberately absent where the ceiling scales
  with stacks, which is a rule nobody could infer: Hiker's Boots has a cap and no `capStacks`.
- **`descriptionNote`** — the field that makes the UI print *"The game's text above is
  inaccurate"*. The single most consequential field in the schema, and undocumented.
- **`consumedOnUse`** — exists because a cooldown of `0` reads as "reusable instantly".
- **`triggered`** — the third activation state, no handler but a real cooldown.

Documented now as a delta table, with **why each had to exist** rather than what type it is —
the type is in `schema.ts` and always will be; the reason is the part that gets lost. Plus the
cross-field rules `data:audit` enforces, which were also written down nowhere.

#### The failure mode, stated plainly

A field can be added to `schema.ts` in one commit and stay undocumented forever, because
**nothing reads the plan.** Tests read the code, the audit reads the data, CI reads both — the
document that new contributors are told to read first is the one thing with no reader that
would notice it going stale.

So it has one now: the fields carrying a rule someone could get wrong must appear in `PLAN.md`
by name. Verified by removing every mention of `triggered` and watching the suite fail by field
name.

#### Three documents, three drifts, one shape

| Document | Stale claim |
|---|---|
| `ItemCard` tooltip | verification "pending logbook confirmation" — a method abandoned at §6A |
| `CLAUDE.md` | 78/125 procs verified (really 106); finished work listed as pending |
| `PLAN.md` | schema block predates four fields, including the one that contradicts the game |

Every one describes work that was **done better than the description admits**. That is worth
noticing about this kind of drift: it does not exaggerate, it lags. And a lagging description
of a verification project is still a false claim about verification — which is the one thing
this repository exists to refuse.

### 3j.101 do the guards actually guard? Nine do; three cannot

Ten passes of this session ended with "and now a check enforces it". §3j.99 then wrote that
list into `CLAUDE.md` as *"each of these turned a repeated mistake into a failing build"*.
That sentence deserved the same treatment as every other claim here, so: **which of them
actually fail a build, and where?**

Measured by hiding `.gamedata/` and `.decompiled/` — which is exactly the state CI runs in,
since both are Gearbox's data and must never be committed:

```
⚠ coined terms not checked (.decompiled absent)
⚠ internal-name collisions not checked (.gamedata/itemdefs.json absent)
⚠ unlock gating not cross-checked (.gamedata/achievements.json absent)
No fatal errors.
Tests  140 passed
```

**Nine guards run everywhere.** They live in `test:unit` and read only committed data: the
coverage ratchet, unscoped negatives (data *and* component prose), `damageCoefficient` vs
published base, blast falloff, the three `OverlapAttack` escapes, `levelScale`, stale
verification vocabulary, Status counts, schema-vs-`PLAN.md`.

**Three cannot.** The name-collision rule (§3j.77), the coined-term rule (§3j.97) and unlock
gating all need the game install. In CI they report *skipped*, and skipped reads exactly like
passed if nobody looks.

The claim was therefore wrong for two of the guards I was proudest of — the two written
specifically because I kept making the same mistake. Corrected into two explicit tiers, with
the reason stated: **this is a permanent limit, not a TODO.** No amount of work moves them into
CI without committing data that must not be committed.

#### And the workflow file had no reader either

`deploy.yml` decides whether any of this gates publication, and nothing checked it. A gate
deleted from CI passes every local suite — the failure would be invisible in exactly the way
the last four passes have been about.

So it has a reader now: the four gate commands must appear in `deploy.yml`, **and must precede
the build**, since a check that runs after publication has already lost. Verified by deleting
the `pnpm test:unit` step and watching the suite fail by step name.

#### The shape of the last five passes

Tooltips, `CLAUDE.md`, `PLAN.md`, and now the workflow. Every one is a document that describes
the work rather than doing it, and every one had drifted — always by **understating** what was
finished, and always in a place with no reader that would notice.

The pattern is worth naming for whoever comes next: **the further a claim sits from the code,
the less likely anything checks it, and documentation sits furthest of all.** A verification
project that lets its own description go stale is failing at the thing it exists to do — just
one level up from the data.

### 3j.102 the front door still said "M0 — Skeleton"

Four passes of auditing documents that describe the work, and the one nobody had opened was
the first one anybody opens. `README.md`, verbatim:

> **Project status**
> **M0 — Skeleton (current).** App shell, theme tokens, routing, and deploy pipeline.
> Sections beyond the shell render "Coming in Mx" placeholders until their milestone lands.

Every milestone has landed. The stat engine has been rebuilt against decompiled code, 208 of
217 items traced, every surface audited. Anyone arriving at the repository was told it was a
skeleton with placeholder pages.

It was wrong about nearly everything checkable:

| Claim | Reality |
|---|---|
| "M0 — Skeleton (current)" | M0–M6 done, plus the whole verification programme |
| "Later milestones add Zustand, Fuse.js, Zod" | all three shipped |
| `data:audit` "(stubbed until M1)" | a 700-line audit with nine enforced rules |
| Scripts table | omitted `data:verify`, `data:diff`, `test:unit` entirely |
| "CI runs typecheck → data audit → build → smoke test" | also verify and unit tests, across two workflows |
| Deploy: Netlify/Cloudflare `_redirects` | true, but the actual deploy is GitHub Pages with a `404.html` fallback |

Rewritten to describe the project as it is, including the two things a newcomer most needs and
could not have learned: **the extractors need a local game install and their output must never
be committed**, and **three audit rules therefore cannot run in CI** (§3j.101). Also added the
thing the README never said at all — *why* this project exists rather than pointing at a wiki,
with three examples where the game's own text is demonstrably wrong.

#### What is now guarded

The README's status line and its scripts table, plus the traced-item count, are asserted
against `package.json` and the data. And `ci.yml` gained the reader `deploy.yml` got last
pass: the Playwright suite runs **only** in `ci.yml`, so 46 end-to-end tests could have stopped
running without a single local failure.

Both injections needed two attempts, which is worth recording. Changing one of two occurrences
of `208 of 217` did not fail the test — correctly, since the claim was still present elsewhere.
**A guard that passes when you try to break it has not been verified; it has been assumed.**
The second attempt, replacing every occurrence, failed as designed.

#### Documents audited, and the count

| Document | Stale claim | Now |
|---|---|---|
| `ItemCard` tooltip | "pending logbook confirmation" | fixed + vocabulary guarded |
| `CLAUDE.md` | 78/125 procs; finished work as pending | fixed + counts guarded |
| `PLAN.md` | schema block missing four fields | documented + guarded |
| `deploy.yml` | nothing checked it gated anything | guarded |
| `ci.yml` | nothing checked it ran Playwright | guarded |
| **`README.md`** | **"M0 — Skeleton (current)"** | **rewritten + guarded** |

Six documents, six drifts, every one understating finished work. The repository now has a
reader for each of them.

### 3j.103 verifying the verifiers — every guard, broken on purpose

§3j.102 ended on a line that turned out to be aimed at me: **a guard that passes when you try
to break it has not been verified, it has been assumed.** Two injections that pass needed a
second, harder attempt to actually fail. So the obvious question is which of the twelve guards
built this session have genuinely been proven to bite, and which I merely believe do.

Going through them, each broken deliberately and restored:

| Guard | Mutation | Failed? |
|---|---|---|
| Internal-name collisions | cite `VendingMachine` on Executive Card | ✓ by item and term |
| Unscoped negative claims (data) | note reading "not in the game code at all" | ✓ by record |
| Unscoped negatives (component prose) | same string in `DlcBadge.tsx` | ✓ by filename |
| Coined terms | put `levelScale` back on Bison Steak | ✓ with both remedies named |
| `damageCoefficient` vs base | `7f` against a base of 300 | ✓ by item and row |
| Blast falloff | (fired unprompted on Aurelionite's Blessing) | ✓ found one I had missed |
| `OverlapAttack` escapes | delete the retrigger sentence from Volcanic Egg | ✓ by row |
| `CLAUDE.md` counts | restore the stale `78/125` | ✓ by count |
| Schema vs `PLAN.md` | remove every mention of `triggered` | ✓ by field |
| CI gates | delete the `pnpm test:unit` step | ✓ by step |
| README | drift the traced count everywhere | ✓ on the second attempt |
| **Logbook vocabulary** | **inject a logbook claim into a component** | **✓ — untested until now** |

The last one had never been broken on purpose. It works.

#### The ratchet was tested in the wrong direction

`coverage-floor.json` has fired repeatedly this session — every time coverage *rose* and the
floor needed raising. That is its cosmetic direction. Its actual job is to catch a **silent
downgrade**, and I had never once tested that. Setting Crowbar back to `langfile`:

```
✗ coverage regression: 207 items are code/asset-verified but the floor is 208.
  Verification must not go backwards — if a downgrade is genuinely correct, lower
  src/data/coverage-floor.json deliberately and say why.
```

It works, and the message tells you what to do. But "it has fired a lot" was never evidence
for the thing it exists to prevent — it had only ever fired on the *easy* side, and I had been
reading that as reassurance for six weeks of passes.

#### The general point

Twelve guards, twelve deliberate breakages, twelve confirmed. That is a boring result and it
is the only kind that means anything: **a check nobody has watched fail is a check nobody has
tested.** The two-attempt injections are the proof that this is not paranoia — in both cases my
first mutation left the claim standing elsewhere in the file, the suite passed, and had I
stopped there I would have recorded a verified guard that was verifying nothing.

Worth stating as a rule, since it generalises past this repository: **when you break something
to prove a test catches it, and the test passes, the default assumption is that your mutation
was too weak — not that the code is fine.**

### 3j.104 the 50 swallowed exceptions under everything

The last thing in this repository with no reader: **the extractors themselves.** Everything in
`.gamedata/` comes out of them, `data:verify`'s "190/190 survivors" rests on them, and this
session found **two** silent-failure bugs in one — a noise filter dropping every field ending
in "Player" (§3j.73), and records discarded whole for having only array-valued fields
(§3j.70). Both returned a plausible smaller answer instead of an error.

So: how many more of that shape are there? Scanning the family for the two constructs that
produced both bugs:

```
extract-procs.py               swallowed-exc: 7
extract-loadouts.py            swallowed-exc: 6
extract-component-fields.py    swallowed-exc: 5
extract-skill-unlocks.py       swallowed-exc: 5
extract-bodies.py              swallowed-exc: 4
… 25 scripts, 50+ in total
```

Each is individually defensible — one corrupt asset should not abort an extraction. Together
they are the most dangerous construct in the project, for the reason both bugs demonstrated:
**a failure that skips input looks exactly like a game that contains less.**

#### Measuring rather than reading

Auditing 25 scripts by eye would be slow and unconvincing. But the swallows fall into
**classes**, and the dominant ones are properties of the game install plus the UnityPy version
rather than of any one script — so measuring a class once covers every extractor that uses it.

Instrumented across the whole install:

| Class | Result |
|---|---|
| Language files that fail to parse | **0** of 39 |
| Bundles that fail to load | **0** of 1,472 |
| Typetrees that fail to read | **0** of 224,435 MonoBehaviours |
| Owner names that fail to resolve | **0** |

Every swallow class is **inert**. `extract-bodies.py`'s four skips hide nothing, and its 241
bodies match `bodies.json` exactly — so the 190/190 survivor claim rests on complete input,
which had been assumed for the entire life of the project and never checked.

#### Making it repeatable

A one-off measurement is worth little, because the thing it measures is a property of *this*
install and *this* UnityPy. `scripts/check-extractor-health.py` reports all four classes and
exits non-zero if any becomes non-empty. Documented in `CLAUDE.md` next to the extractors, to
run after a game patch or a library upgrade.

Its message says what a failure means, which matters more than the count: a non-zero result
does **not** prove an extraction is wrong — it proves the *"0 skipped"* assumption behind every
number in `.gamedata/` no longer holds, and the affected extractor needs looking at before any
of its output is trusted again.

#### The closing symmetry

This session began by verifying the game's numbers, and has spent its last several passes
verifying the things that verify them — the guards (§3j.103), the documents (§3j.98–102), and
now the tools. Each level had the same defect: something that had never been read, quietly
assumed correct because nothing had ever contradicted it.

`.decompiled/` and `.gamedata/` are the floor. Below the extractors there is only the game.

### 3j.105 the contact duration, measured — the rate was real and unreachable

§3j.84 stopped on a named blocker rather than a vague one: *"these are instantaneous rates
while the target is inside the hitbox, and a projectile in flight overlaps an enemy for a
fraction of a second — we need a contact duration we do not have."* Having exhausted the
levels below the data, that blocker was the thing left worth attacking.

It is measurable. Both boomerangs carry a `HitBoxGroup` named "Buzzsaw" with a single box:

| Projectile | Hitbox `localScale` | travelSpeed |
|---|---|---|
| Sawmerang | 0.85 × 0.34 × 0.85 | 60 |
| StunAndPierceBoomerang | 1.00 × 0.20 × 1.00 | 60 |

A straight pass overlaps a target for roughly `(box depth + target depth) / 60` — on the order
of **0.03–0.05 seconds**. The dot zone can re-hit a target only once per
`1 / resetFrequency` = **0.1 s**.

**The contact is shorter than a single reset window.** So a fly-through lands *at most one*
lingering tick, often zero — and the "200% per second" figure computed in §3j.84 is an
instantaneous rate that a normal pass never sustains. Both records now carry the measurement
and the bound.

#### What this does and does not settle

It removes the appearance of a contradiction. A computed 200%/s against a stated 100%/s looked
like the game's text being wrong by 2×; it is actually a rate that requires a full second of
contact the projectile cannot deliver in flight. The two quantities were never comparable, and
now the *reason* is a measurement rather than a suspicion.

It does **not** tell me what the description's "per second" clause means. The one place
sustained contact is plausible is the turnaround — `transitionDuration = 1` holds the
projectile near-stationary at the far end of its arc — which would give up to a full second
inside the hitbox and land the sustained rate exactly. That is an inference from a constant,
not something traced, and it is written into the record as an inference and into no number.

Both items stay `langfile` on that basis. A bound is not an answer, and the honest position is
that the gap narrowed rather than closed.

#### On going back up the stack

The last several passes worked downward — guards, documents, tools — until there was nothing
below the extractors but the game. Coming back up to the one blocker I had named precisely
enough to attack turned out to be the most productive thing available, and it was only
attackable *because* §3j.84 had recorded exactly what was missing rather than "unresolved".

That is the argument for writing open questions as specifications: **"we need the contact
duration" is a task; "unresolved" is a shrug.**

### 3j.106 RoR2.dll was never the whole assembly

Attacking the last reachable blocker — *where is `Buffs.BugWings` applied?* — produced a
finding much larger than the item.

The recorded obstacle (§3j.81) was that `m_FileID != 0` pointers cannot be followed backwards.
That is only true if you ignore the **externals table**: every `SerializedFile` lists the CABs
it references, and `m_FileID` indexes into it. So the reverse scan is possible — find the
target's CAB and pathID, find the bundles whose externals include that CAB, and search only
those for a matching pointer.

**22 of 1,472 bundles reference the jetpack CAB. Not one points at `bdBugWings`.**

#### The much bigger thing

Checking whether another assembly could apply it, I looked at what sits beside `RoR2.dll`:

```
Assembly-CSharp.dll   135 KB
RoR2.dll              5.9 MB
```

`Assembly-CSharp.dll` appeared to contain **RoR2 code** — a raw string scan showed
`RoR2.CharacterAI`, `RoR2.EntityLogic`, `RoR2.UI`, `RoR2.Achievements.*` and class names like
`BuffPassengerWhileSeated`. **We had never decompiled it.** `scripts/decompile.sh` takes
`RoR2.dll` and nothing else, and it has done since Phase 0.

> **Corrected in §3j.107.** Those names are `[assembly: TypeForwardedTo(...)]` attributes —
> 2,039 of them — not implementations. The assembly forwards RoR2 types to `RoR2.dll` and
> implements only graphics and audio middleware. Reading a string scan as evidence of
> *contents* was the mistake; the strings were references, and every one of those types is
> implemented in `RoR2.dll` where we had already read it.

So every claim in this log of the form *"loaded once in the whole assembly"* — Chaos's
`friendlyFireDamageScale` with zero callers, Essence of Heresy's single `AddTimedBuff` site,
this one — was scoped to **one of two assemblies** while being written as though it covered
the game.

Decompiled it (5,038 lines) and re-checked all three. **All three survive: zero occurrences of
any of them in `Assembly-CSharp.dll`.** The conclusions were right; the *scope stated for them*
was not.

Then the decisive, cheap test I should have run months ago — a cross-assembly field reference
stores the field **name** in the referencing assembly's metadata, so a raw byte scan of every
managed DLL settles it:

```
DLLs scanned: 143
  BugWings                -> ['RoR2.dll']
  friendlyFireDamageScale -> ['RoR2.dll']
  LunarDetonationCharge   -> ['RoR2.dll']
```

Only one assembly out of 143 can reference any of them.

#### Milky Chrysalis, closed

Nothing in any assembly applies `Buffs.BugWings`; nothing in any bundle references the asset;
`passiveBuffDef` is null; `JetpackController` never calls `AddBuff`. On that evidence **the
description's +20% movement speed is unreachable** — the buff exists, is read by
`RecalculateStats`, and is never granted.

The number stays as the game states it, with the finding recorded beside it. A negative this
strong should be *surfaced*, not used to silently overwrite the game's own text — and the test
now asserts the record carries the **scope** of the search, because "nothing applies it"
without a stated scope is exactly the §3j.80 failure that started this thread.

`decompile.sh` and `CLAUDE.md` now warn about the second assembly.

#### What this says about the foundation

Nine passes of this session rest on reading the decompile. The decompile was missing an
assembly the whole time, and nothing noticed — because the missing piece is small, and because
every conclusion drawn from the incomplete input happened to be correct. **The claims were
lucky, not sound.** They are sound now.

### 3j.107 correcting §3j.106 — the second assembly contains no game code at all

§3j.106 re-checked three assembly-scoped claims against `Assembly-CSharp.dll` and found them
intact. The rule established several passes earlier says do not stop at the item in hand: when
a shared foundation turns out to be incomplete, go back to **everything** resting on it. This
log has far more than three claims resting on the decompile.

So, before sweeping them: what is actually *in* that assembly?

**Eighteen types.** `AudioSpline`, `SoundTrigger`, `FogControl`, `MirrorReflection`,
`BlurredBackground`, four `NGSS_*` shadow classes, `ChefUnlockFXManager`. Two namespaces, both
third-party asset-store packages: `JBooth.VertexPainterPro` and `LeTai.Asset.TranslucentImage`.

Mentions of `ItemDef`, `BuffDef`, `RecalculateStats`, `GetItemCount`, `damageCoefficient`:
**two**, and both are this —

```csharp
[assembly: TypeForwardedTo(typeof(BuffDef))]
[assembly: TypeForwardedTo(typeof(ItemDef))]
```

There are **2,039** such attributes. A type-forward is the *opposite* of an implementation: it
says "this type lives in another assembly; go there." `BuffPassengerWhileSeated` is forwarded
here and implemented in `RoR2/BuffPassengerWhileSeated.cs`, where it had already been read.

#### The correction

§3j.106 said the assembly "contains RoR2 code — `RoR2.CharacterAI`, `RoR2.EntityLogic`,
`RoR2.UI`, classes like `BuffPassengerWhileSeated`." **That was wrong**, and wrong in a way
worth naming: I read a **raw string scan** as evidence of *contents*. Those strings were
references — the names of forwarded types and `using` directives — not implementations. The
entry is corrected in place.

The practical consequence is that the sweep §3j.106 implied is unnecessary: **no
assembly-scoped claim in this log could have been affected**, because the second assembly
contains no mechanics to have missed. The three re-checks were not three lucky survivals out
of many; they were three samples of a set that was never at risk.

What survives from §3j.106 is the part that mattered anyway:

- The **cross-bundle reverse scan** works, via each `SerializedFile`'s externals table. That
  is a real capability the project did not have, and it is what closed Milky Chrysalis.
- The **cheap decisive test** for "is this referenced anywhere else?" — a raw byte scan of all
  143 `Managed/*.dll` for the identifier, since a cross-assembly member reference stores the
  member *name* in the referencing assembly's metadata. One grep, no decompiling.
- `decompile.sh` and `CLAUDE.md` now say **that**, rather than "check both assemblies", which
  would have sent the next person to decompile middleware.

#### On correcting a correction

Two passes ago the lesson was that a claim inherits authority from the confident work around
it. §3j.106 was itself a confident entry about scope, written in the same breath as a genuine
finding, and its central characterisation was mistaken. The finding held; the framing did not.

The reason it got caught is that this pass started by asking *what is in there?* rather than
accepting the previous pass's answer. **The most useful thing to distrust is the entry you
wrote last** — it is the one with the least distance between conviction and evidence.

### 3j.108 Electric Boomerang — a shape argument where the number would not settle it

The last open arithmetic question in the dataset was a 4% gap: the slice computes to 1.24n
(`damageCoefficient` 3.1 x a fired `damage * 0.4f * n`) against a stated 120%. Two passes have
now failed to close it, and it is too small to justify overwriting a published number.

This pass stopped chasing the 4% and looked at the **shape** of the description instead:

> "...slices through enemies dealing **120% base damage** and deals an additional
> **120% (+120% per stack)** base damage per second..."

That is a flat slice next to a scaling lingering effect. But the projectile is fired **once**:

```csharp
float damage6 = characterBody.damage * 0.4f * (float)itemCountEffective20;
```

One value. Linear in `n`, with **no constant term**. Both damage components on the prefab read
that same `projectileDamage.damage` and multiply it by their own coefficient. **One fired value
cannot be flat for one consumer and scaling for another.** So the description's split is not
merely imprecise, it is structurally impossible, and the slice scales with stacks whether or
not the text says so. The absent constant term says something further: nothing about this item
has a floor that survives at zero stacks — every effect is purely proportional to the count.

`perStack` on the impact row goes from absent to 120, and the note now says both effects grow
together.

#### Why this is worth a log entry

The 4% is **still open**, and is recorded as open. What changed is that a question I could not
answer numerically turned out to be answerable structurally — and the structural answer was the
more useful one, because it corrects how the item stacks rather than a rounding digit.

Three passes were spent trying to make 1.24 equal 1.20. The relationship between the two
clauses was visible in the same line of code the whole time. **When a number will not close,
check whether the claim around it is even self-consistent** — the arithmetic can be the least
informative thing in a description.

The test that pins this asserts a conclusion drawn from shape rather than from a measurement,
which is the kind a later edit breaks quietly, without any number looking wrong.

### 3j.109 the guard that passed because it was not looking

§3j.108 generalised into a sweep: 69 descriptions pair a flat number with a scaling one. Most
are legitimate — Crowbar's 90% is a *threshold*, Tri-Tip's 240% bleed genuinely does not scale.
The narrower shape (two damage numbers sharing one code value) matched only **Gasoline**, and
Gasoline turned out to be **correct**: `baseDamage = damage * 1.5f` and
`value = (1 + n) * 0.75f * damage` are two independent variables, so the flat/scaling split is
real. That matters — it means the description convention is reliable and Electric Boomerang is
a genuine anomaly rather than loose phrasing.

The sweep found nothing. Reading Gasoline's code to *check* the sweep found something else.

#### The hole

Gasoline's blast is `falloffModel = None`, and our record never said so. There is a guard for
exactly this — "every record citing a blast radius states its falloff model", written after
five of seven blast records published a radius without one. It had been passing. It was keyed
on the literal string `blastRadius` in the formula text, and Gasoline's formula quotes the
code's own field name: `blastAttack.radius`.

Widening detection to the **stat name as well as the formula** — the stat name is what the
reader actually sees — took the guard from 8 rows to 29, and produced six corrections:

| item | published as | actually |
|---|---|---|
| **Will-o'-the-wisp** | "350% base damage" in 12m | **SweetSpot**: 350% within 6m, **87.5%** from 6–12m |
| **Shatterspleen** | 400%/stack + 15% max HP in 16m | **SweetSpot**, both terms — quartered beyond 8m |
| **Voidsent Flame** | 260%/stack in 12m | **SweetSpot**, plus a 0.2s delay |
| Brilliant Behemoth | radius only | `None`, and fires at `procCoefficient 0f` |
| Gasoline | radius only | `None`, `procCoefficient 0f`, burn upgraded by `StrengthenBurnUtils` |
| Razorwire | "Burst radius" | **not a blast at all** — SphereSearch → LightningOrbs, nearest-first |

Three items published a **SweetSpot cliff as though it were a uniform sphere.** SweetSpot is
the model most damaged by omission because it is the one that is not a taper: full damage
inside half the radius, a flat quarter beyond. "350% base damage in 12m" describes under a
fifth of that sphere's volume.

Razorwire is the opposite error and worth as much: "Burst radius (m)" reads like an explosion,
but distance decides **who** is hit, not how hard — the search orders candidates by distance
and fires one orb at each of the nearest N, all sharing a single crit roll, each at
`procCoefficient 0.5`.

Resonance Disc's bomb is left **explicitly unverified**: it is a projectile, its blast lives on
a prefab absent from the extracted set, and a guessed falloff would be worse than a stated gap.

#### What this says about guards

The three earlier local-only rules are honest about being unenforced. This one was worse: it
**reported success**. A guard keyed on one spelling of a concept certifies every record that
happens to spell it differently, and it gets more dangerous over time, because each passing run
is evidence that the area is covered.

The tell was available: the guard covered 8 rows in a dataset with 29 area effects. **A guard
should be asked how many rows it inspects, not just whether it passes** — a green test with a
narrow selector and a green test with a wide one are indistinguishable from the outside, and
only the second one is a guard.

Proven by restoring Will-o'-the-wisp's original formula verbatim: it escaped the old rule for
the whole life of that rule, and fails the new one.

### 3j.110 asking every guard how many rows it inspects

§3j.109 ended on a rule: *ask a guard how many rows it inspects, not just whether it passes.*
This pass applies it to the other guards, which is the part that is easy to skip once the
interesting finding is already written down.

Four population-scanning guards, measured against the population they claim:

| guard | inspected | population | verdict |
|---|---|---|---|
| `damageCoefficient` vs published base | **16** | 34 rows naming a coefficient | **narrow** — case-sensitive on the bare name |
| hit-count claims vs `OverlapAttack` | 3 | 3 rows making the claim | complete |
| negative claims scoped/hedged | items + artifacts + shrines | **+ skills.json** | **blind to a whole dataset** |
| falloff (fixed last pass) | 20 | 20 blast rows | complete |

The coefficient guard had the identical defect to the falloff guard: the code we quote almost
never says plain `damageCoefficient`. It says `blastDamageCoefficient`,
`overlapDamageCoefficient`, `secondBombDamageCoefficient`, `mainBeamDamageCoefficient`. Widened
to `[A-Za-z]*[Dd]amageCoefficient`, it now reads **28** rows instead of 16.

It found **no new errors** — those fifteen records were already right. Worth stating plainly:
widening a selector is not a technique for finding bugs, it is a technique for making a green
result mean something. Last pass it surfaced three SweetSpot cliffs; this pass it surfaced
nothing, and both outcomes are the guard working.

One real exclusion: `childrenDamageCoefficient = 1` sits on Molotov's **Bomblets** row, whose
`base` is a count of 6. Comparing them is arithmetic between unrelated units, so the guard now
only compares where the stat is a damage stat.

#### The same mistake, inside the fix for it

Extending the negative-claim guard to `skills.json` produced a version that mapped the file's
top level and read `survivor` and `body`. `skills.json` is **19 survivor wrappers** holding
**125 nested skills**, so the extension ran, passed, and inspected none of the prose it was
added to police. Written minutes after diagnosing that exact failure elsewhere.

It surfaced because the deliberate-breakage injection printed `skill:undefined (undefined)` —
the guard fired, but on a field name it had invented, which is what a mutation landing outside
the intended surface looks like. **A passing breakage test is not proof the guard reaches the
right rows; it proves it reaches *some* row.** The re-run injects into `mul-t / Rebar Puncher`
by name.

`survivors.json` is now excluded *explicitly*: every string on it is an identifier, so there is
no claim there to be unscoped. Recorded rather than silently omitted, so the next reader can
tell a checked absence from an overlooked one.

#### The guard-of-guards

Both selectors are now module constants shared by the guard and a `guard coverage` block that
asserts **floors on rows admitted**: 20 area rows, 28 coefficient rows, 19 wrappers → 125
skills, 0 skipped hit-count claims. Floors, not equalities, so rows can still be added.

Proven by reverting both selectors to their original text. The instructive part: with the
narrowed falloff selector the **falloff guard itself still passes** — its seven visible rows
all state a model now. Only the coverage floor fails. A guard cannot detect its own blindness,
which is the whole reason this block exists.

### 3j.111 right in the formula is not the same as read

The three SweetSpot corrections from §3j.109 went into `stacking[].formula`. `ItemDetail`
renders that field as **11px muted mono** beneath the row, while the row header carries the
headline number at full weight. So the correction was true, published, and positioned exactly
where a reader sizing up the item would not look — the number they *do* read is the one that
overstates by 4x across most of the blast volume.

Only Will-o'-the-wisp had a `descriptionNote`, which is the field that renders in the amber
callout **above the fold**. Shatterspleen and Voidsent Flame now have one too, each naming the
model *and* its consequence in plain words, so the point survives a reader who has never heard
of SweetSpot.

Shatterspleen is the starkest: its radius is a fixed 16m at any stack count, and the
15%-of-max-health term is summed into the same blast damage value as the base-damage term, so
**both are quartered beyond 8m**. The percent-max-health figure is exactly what players size
that item by against bosses.

#### A scope note on the callout, checked rather than assumed

The amber box has one fixed header: *"The game's text above is inaccurate."* Since the notes
now cover both flat contradictions and material omissions, that header was worth testing rather
than trusting. Reading all **51** notes: the overwhelming majority are genuine contradictions
(Prison Matrix multiplying rather than adding, Genesis Loop's pre-reduction 30s, Light Flux
Pauldron's reciprocal penalty), and the omission cases are ones where the plain reading is
wrong anyway — a single damage number printed for a blast that deals a quarter of it across
four fifths of its volume is inaccurate *in effect*, not merely incomplete.

So the header stands, as a **judgement made and recorded**, not an oversight. If notes ever
drift toward pure addenda, it needs splitting; today it does not.

The general point is the one worth carrying: this project's failure mode has stopped being
wrong data and become **correctly-recorded data in a place nobody reads**. Verification puts a
fact in the file. Only layout decides whether anyone meets it — which is what §9 was for, and
why the falloff work was not finished when the formulas were right.

### 3j.112 two guards that disagreed about their own subject

The `stacking.test.ts` tier was audited for narrow selectors in §3j.110. The other tier —
`data-audit.ts`, the local-only rules — had not been. Same question, asked properly: which
prose does each rule actually read?

They disagreed. Both police the text we **write** rather than the game text we transcribe, and
each built that list separately:

| surface | strings | camelCase terms | coined-term rule | collision rule |
|---|---|---|---|---|
| `items.descriptionNote` | 53 | 26 | ✗ → ✓ | ✓ |
| `items.stacking.formula` | 289 | 277 | ✓ | ✓ |
| `items.stacking.cap` | 5 | 1 | ✗ → ✓ | ✗ → ✓ |
| `reference.ts` mechanic/cost | 33 | 26 | **✗ → ✓** | ✓ |
| `skills.procSource` | 125 | 6 | ✗ → ✓ | ✗ → ✓ |

The coined-term rule — the one written *because* I invented `levelScale` and shipped it in
seven records — was reading formulas only. So `descriptionNote`, which renders in the **amber
callout at the top of an item page**, was never checked, and neither were the 26 camelCase
identifiers in the artifact and shrine prose.

#### What was hiding there

One term, in Artifact of Swarms: **`cutHpCount`**. Not a game identifier — my shorthand for
`num33`, written to look like one. Exactly the `levelScale` failure, in the one surface the
`levelScale` guard could not see.

The surrounding claim was *true* (`SwarmsArtifactManager`, `swarmSpawnCount = 2`, the `CutHp`
item, and `num78 /= (num33 + 1)` all check out), which is why nothing caught it by reading.
Verifying it turned up three effects the record omitted, all in the same handler:

- `DeathRewards.spawnValue`, `expReward` and `goldReward` are each **divided by 2**, so every
  monster is worth half the XP and gold and the doubled count roughly cancels — Swarms is much
  closer to XP-neutral than "twice the monsters" suggests.
- Spawns whose placement rule sets `IgnoreSwarmsArtifact` are skipped, as are player-team
  spawns.
- The duplicate spawn is re-fired through `DirectorCore.TrySpawnObject` behind an `inSpawn`
  flag, so copies cannot recurse.

#### The fix is structural, not another patch

Both rules now read one `PROSE_RECORDS` list built in one place. Adding a prose field to the
schema means adding it there, once, and every rule gains it. Two guards maintaining private
definitions of their own subject is the same failure as a narrow selector, and patching each
rule separately would have preserved the condition that produced it.

With a coverage floor, because this tier can also pass by inspecting nothing: **343** records
today, floor **335**. The floor is deliberately tight — at 300 it would not have caught
`reference.ts` (33 records) dropping out, which is the exact failure it exists for. Proven by
removing that source: 322, and it fails.

A guard is not a rule plus a regex. It is a rule, a regex, **and a stated surface** — and the
surface is the part that rots silently, because nothing about a passing run reveals how much of
the dataset it read.

### 3j.113 the artifacts were verified for numbers, not for completeness

§3j.112 found `cutHpCount` by guard, and verifying that one word forced a read of
`SwarmsArtifactManager`, which turned out to contain three effects the record never mentioned.
That is a bad way to find things. The status line said *"Artifact + shrine numbers confirmed
against their behavior classes"* — and every word of that is true, which is the problem:
**numbers** were confirmed. Swarms' gaps were not numbers. They were other effects in the same
handler.

So: all 13 managers in `RoR2.Artifacts`, 1,173 lines, re-read against the 20 records.

Most held up well — several already flag "Undocumented:" effects and cite specifics (Chaos's
zero-caller `friendlyFireDamageScale`, Command's stripped interactable pool, Vengeance's
`num78 *= 10f`). Three did not.

#### Sacrifice: the headline number was missing entirely

The record described *what* drops but never *how often*. The chance is not the flat 5% it
looks like in the source:

```csharp
Util.CheckRoll(Util.GetExpAdjustedDropChancePercent(5f, damageReport.victim.gameObject))
// -> baseChancePercent * Mathf.Log(spawnValue + 1, 2f)
```

**5 × log₂(spawnValue + 1) percent.** 5% is only the value for a monster worth 1; anything the
director pays more for drops considerably more often, and the log flattens the gain as monsters
get larger. Per-monster `spawnValue` lives on body prefabs outside the extracted set, so the
per-monster chance is stated as **not established** rather than filled in with a plausible
table. Also newly recorded: surviving interactables are re-weighted by
`weightScalarWhenSacrificeArtifactEnabled` (the mix changes, not just the amount), and
same-team kills of owned minions do not roll at all.

#### Two artifacts share an input, and nothing said so

Swarms halves `DeathRewards.spawnValue`. Sacrifice's drop chance *reads* `spawnValue`. So
running both lowers each kill's drop chance while doubling the kills — a real interaction
between two artifacts, visible only by reading both managers, and hinted at by neither
description. Both records now carry it, in both directions.

#### Spite was wrong

> "one extra bomb per 4 units of radius"

```csharp
Mathf.Min(maxBombCount, Mathf.CeilToInt(victimBody.bestFitRadius * extraBombPerRadius * cvSpiteBombCoefficient.value))
// extraBombPerRadius = 4f, spite_bomb_coefficient defaults to 0.5
```

That is `radius × 2` — **two bombs per unit of radius**, not one per four. The relationship was
inverted, and the constant in the prose (`bombSpawnRadiusCoefficient = 4`) belongs to the
scatter *sphere*, not the count — the same misfiling as Executive Card / Remote Caffeinator
(§3j.66). Also added: `falloffModel = None`, `procCoefficient = 0.75` (bombs *do* proc, at
three-quarters), and `crit = false` (they never crit).

#### The lesson is about status lines

"Verified" is always verified *against a question*. Confirming every number in a record leaves
untouched the question of whether the record mentions everything the code does — and a status
line that records the first invites the reader to assume the second. The counts in `CLAUDE.md`
were accurate the whole time and still left three artifacts misdescribed.

The falloff guard now also reads `reference.ts`, so blast claims are policed wherever we make
them rather than only in `items.json`.

### 3j.114 the shrines, and a disclaimer that outlived its own truth

Following §3j.113's rule — *"verified" is always verified against a question* — to the shrines
produced a contradiction before it produced any data. Three places in the repo disagreed:

- `ShrineRef.cost`'s doc comment: *"OUR editorial one-line cost summary — NOT game data, NOT
  code-verified."*
- The file header: *"SHRINES.cost is OUR editorial summary, not game data."*
- `ReferencePage.tsx`: *"This said 'Our summary, not game data' — which stopped being true when
  the costs were re-read from each shrine prefab's PurchaseInteraction."*

The UI was right and the data file's own documentation was stale — Shrine of Blood's entry
already carried the prefab constants in a comment. But an assertion that something *was*
verified is not verification, and `.gamedata/` held nothing about shrines, so there was no
re-checkable artifact behind any of it. Settled by extracting them again:

```
python scripts/extract-component-fields.py costType costMultiplierPerPurchase maxPurchaseCount failureWeight
```

**All twelve cost summaries were correct.** Two that had been hedged are now exact (Altar of
Gold = 200 Money, Shrine of Shaping = 30 SoulCost), and one near-miss is worth recording:
`ShrineBoss` carries `cost = 20` with `costType = None`. Reading the integer without resolving
the enum would have "corrected" *Free* — the right answer — into *20 gold*.

#### Two real errors, both from stopping one step early

**Shrine of Blood published 93.75%.** The escalation is not a multiplier at all:

```csharp
Networkcost = (int)(100f * (1f - Mathf.Pow(1f - cost/100f, costMultiplierPerPurchase)))
```

With the serialized `2.0` that is `1 − (1−c)²` — *take the same fraction of what is left again*
— giving 50, 75, 93.75. The previous pass computed the float and stopped **before the `(int)`
cast**: the shrine charges **93%**, and gold follows at 46.5% rather than 46.9%. The cost is
also a fraction of `fullCombinedHealth`, max health **plus max shield**, not max health; and
it is dealt as damage flagged `NonLethal | BypassArmor`.

**Shrine of Chance escalated on the wrong event.** The record said "×1.4 per success". The
refresh multiplies `Networkcost` after *every* attempt, while the limit of 2 increments only on
a win. Failures therefore cost gold, raise the price, and do not consume the shrine. Success is
54.71%, and that number is not merely transcribed — `failureWeight 10.1` against rewards
totalling 12.2 gives 10.1/22.3 = 0.45291, matching the serialized `failureChance` exactly.

#### New ground

Four shrines gained a mechanic they never had (6 of 12 now): the Woods ward heals 1.5% max
health every 0.25s — **6%/s** — in a radius of 12m growing 8m per purchase; Shrine of Order
picks **uniformly over the distinct items you hold**, not weighted by stack size, one tier at a
time, skipping `ObjectiveRelated` and `PowerShape`; Halcyon's three tiers share *identical*
reward weights, so a higher tier buys more offers rather than better ones; Combat is genuinely
free and spends 100 director credits.

#### The thing to carry

A disclaimer is a claim. *"Not verified"* was the false statement here, and false in the
direction that looks humble — it told readers a prefab-derived figure was a guess and sent them
to a worse source to check it. Stale caution reads as safe and is not: **it is as wrong as
stale confidence, and much less likely to be re-examined**, because nobody audits a claim that
undersells itself.

### 3j.115 the inverse audit: where does the site claim LESS than it knows?

§3j.114 ended on stale caution being as wrong as stale confidence and much less likely to be
re-examined. That is a testable claim about this repo, so: every hedge in the data and
components, checked against what is actually known.

**One real bug.** `procProvenance()` in `skills.ts` ends `return "not yet verified"`, and
**21 of 125 skills** reached it — every skill whose `procSource` is neither a `code:explicit`
nor a `code:default` prefix. All 21 are established:

- **19** are `code:no-damage-path` — a *verified absence*, produced by
  `classify-nondamaging-skills.py`. Tactical Dive does not have an unknown proc coefficient;
  it has no attack.
- **2** carry a proc coefficient of **zero read from a named site**
  (`code:FireSonicBoom.CalculateProcCoefficient=0f`, `code:FireFlower2`). A proc of 0 that was
  *read* is not a proc that is unknown.

The sharp part: `schema.ts` already carries the principle, in these words —

> *Conflating them made the Stat Lab report 21 skills as unverified when 19 of them have
> nothing to verify… Reporting a known thing as unknown is the mirror of this project's usual
> failure and just as misleading.*

That comment was written when the **Stat Lab** was fixed. `procProvenance()` was not, so the
same 21 skills went on describing themselves as unverified everywhere else that string appears.
A principle can be stated, agreed with, and enforced in exactly one of the places it applies.

**One stale hedge.** `reference.ts` still announced the verified-mechanic layer as "still to be
built" — with 20 of 20 artifacts and 6 of 12 shrines carrying a traced mechanic directly
beneath it.

**Two hedges checked and found correct**, which is the other half of an audit. The
`ItemDetail` "not yet code-verified" banner and the `ItemTooltip` "curve unverified" dot both
look over-broad on the data — they key on `confidence`, and 6 of the 9 `langfile` items have no
mechanic at all. But both sit inside guards that require stacking rows to exist
(`item.stacking.length > 0`, `types.length > 0`), so neither ever renders for those six. They
fire only on Electric Boomerang, Sawmerang and Milky Chrysalis — all three of which have a
genuine open question or an unreachable claim, and all three of which carry a
`descriptionNote` giving the specifics. No change.

I had concluded otherwise from the data alone before reading the JSX. Worth recording: the
condition that decides whether a warning is fair was **not in the file the warning was about**.

#### The asymmetry

This project has spent most of its passes looking for claims that assert too much. Nothing
looks for claims that assert too little, and nothing would — an unverified label never triggers
a correction, never contradicts the code, and reads as diligence. That is exactly why the
`skills.ts` bug survived being diagnosed, named, and fixed once already, three files away.

### 3j.116 the recurring failure is not a wrong number

§3j.115 found `procProvenance()` still labelling 21 established skills "unverified" — after the
same conflation had been diagnosed, named, and fixed in the Stat Lab. That is worth counting,
because it is the third instance of one shape:

1. The Stat Lab learned to show "no damage path"; `SurvivorDetail` went on saying *"proc
   unverified"*. Its own comment records the result — the same skill described two ways on two
   pages, *"and the wrong way here"*.
2. The Stat Lab was fixed for the 21-skill conflation; `procProvenance()` was not (§3j.115).
3. The falloff and coined-term rules each policed only the file they were born in (§3j.109,
   §3j.112).

**The recurring failure in this project is not a wrong number. It is a fix applied to the
surface where a bug was noticed rather than to the concept.** Every one of these was found by
someone looking at a *different* screen and noticing the disagreement — never by the fix itself.

#### Sweeping for it

Nine components touch item numbers; four carry a confidence signal. Most of that gap is not a
gap: `PlannerPage` filters by stacking TYPE and renders no values, `StatLabPage` computes from
`statItems.ts` (locked by `data:verify`), and `Breakpoints` carries a per-row `verified` field
and renders it as `<VerifiedTag>`.

One real hole: `RunPlanRail` publishes an item's hard **cap** as a bare number, no badge, no
tooltip. All four capped items are code-verified today, so nothing on screen is wrong — but
nothing would notice if that changed. Guarded rather than redesigned: only traced records may
carry a cap. Proven by giving Sawmerang (`langfile`) one.

The proc rule came out clean — both surfaces gate on `verified` and both branch on
`damaging === false`. So it is now guarded **structurally**: any component rendering a proc
value must also handle the no-coefficient case. A number is guarded by asserting a value; a
concept has to be guarded by asserting that every place it applies implements it.

#### On the breakage test that passed

Flipping one `damaging === false` in `SurvivorDetail` left the suite green. The recorded rule
applied exactly as written — *when you break something to prove a test catches it and the test
passes, assume your mutation was too weak* — and it was: the file contains **two** occurrences
and `.replace(x, y, 1)` changed one. Removing both fails the test.

The same rule has now caught three weak mutations across this work. It is the single most
reliable thing in the log, and it earns its keep precisely because a passing breakage test is
indistinguishable from a working guard until you check the count.

### 3j.117 the biggest remaining data gap, measured instead of carried

§3j.113 found Artifact of Spite silent on its bombs' `procCoefficient` — by accident, while
chasing something else. That is a question worth asking of the whole item dataset, so I asked
it: of the **41** rows that describe an item-fired attack, how many say what proc rate it fires
at?

**Eight.** And **zero** say anything about crit.

That is not a cosmetic omission. Proc coefficient decides whether an item's own damage can
trigger other items, and *"does AtG's missile proc Ukulele?"* is among the most common real
questions a player has about this game. The site answers it for eight rows out of forty-one.

#### Two closed, and they disagree in an instructive way

**Ukulele** — `procCoefficient = 0.2f`, and `isCrit = damageInfo.crit`: the orb inherits the
triggering hit's crit. It chains into other on-hit items, at a fifth rate.

**Electric Boomerang** — `crit = characterBody.RollCrit()`, an *independent* roll, and the
`FireProjectileInfo` sets **no** `procCoefficient` at all, so the rate is whatever the
`StunAndPierceBoomerang` prefab carries. That prefab is not in the extracted set, so it is
recorded as **not established** rather than assumed to be 1.0.

Two items, adjacent in the same method, differing on both properties. Neither difference is
guessable from the descriptions, which is the argument for recording the field at all.

#### On the scan that produced this

I wrote a scan that walks each `GetItemCountEffective(...Items.X)` site and reports
`procCoefficient` assignments in the following block. It over-reported, as designed — 60-line
windows run past the end of one item's handler into the next, and it confidently attributed
Loader's lightning orb to AtG. Every value here was verified by opening the file at the line;
none was taken from the scan. **A scan of this kind is a way to decide what to read, never a
source of values** — which is the same rule §3j.107 arrived at from the opposite direction,
where a raw string scan was misread as evidence of contents.

#### The remaining 31 are frozen, not forgiven

A ratchet: the silent set must stay a **subset** of an explicit list of 31. The debt can shrink
and cannot grow, and a new attack row that says nothing about proc rate fails the build rather
than joining the pile quietly. Proven by adding one.

This is the honest shape for a gap too large to close in one pass. The alternative — knowing
the number is 8 of 41 and writing nothing down — is how a gap becomes permanent.

### 3j.118 closing the proc gap, and a number that may be 4x wrong

§3j.117 measured the gap at **8 of 41** attack rows stating a proc coefficient and froze the
rest. This pass closed most of it: **28 of 41**, ratchet retightened from 31 silent rows to 13.

#### The structural finding

Proc rate for a projectile is not in the C# at all. It is a **product of two serialized fields
on the same prefab**:

```csharp
attack.procCoefficient      = projectileController.procCoefficient * overlapProcCoefficient;
blastAttack.procCoefficient = projectileController.procCoefficient * blastProcCoefficient;
```

So "what does this item proc at?" needs **two** asset reads plus the code, and reading either
field alone gives a confidently wrong answer. This is §5.0.2 again, one level deeper: the
constant is not merely serialized, it is *factored*.

#### Two claims made and reversed inside one pass

Earlier in this same session I wrote, from the code alone, that Kjaro's Band and Electric
Boomerang had proc rates that were "NOT established here". Extracting the prefabs settled both,
and they landed at opposite extremes:

- **Kjaro's Band** — `FireTornado` is `procCoefficient 1.0 × overlapProcCoefficient 0.0` = **0**.
  The tornado procs **nothing**. Runald's Band, its supposed twin, is a direct `DamageInfo` at
  `procCoefficient = 1f`. The two items players treat as a matched pair sit at opposite ends of
  this scale, and neither description hints at it.
- **Electric Boomerang** — the slice is `1.0 × 1.0` = **full rate**, while the lingering
  component on the same prefab is `0.2`. One throw procs at two different rates depending on
  which effect lands.

Both reversals are now pinned by tests, including one asserting the old hedge cannot return.
A re-hedge would read as caution and be a regression — §3j.114's lesson, made executable.

Also closed: AtG's missile and Ceremonial Dagger at 1.0; Sawmerang's contact at 1.0; Molotov's
bomblet blast at 1.0 against its puddle at 0.5; Will-o'-the-wisp, Shatterspleen and Voidsent
Flame all at **1.0**, because `DelayBlast` declares `procCoefficient = 1f` and none of the three
overrides it — unlike Behemoth and Gasoline, explicitly set to `0f`.

#### Resonance Disc: a possible 4x error, deliberately not fixed

`LaserTurbineBomb` turns out to be in the extracted set after all, carrying
`blastDamageCoefficient = 4.0`, `blastRadius = 14`, `falloffModel = 2` (**SweetSpot** — resolved
from the enum, not read as an integer, per §3j.114's `costType` near-miss). The damage chain is
exact wherever it is readable:

```
GetDamage()            = ownerBody.damage x LaserTurbine count
projectileDamage.damage = GetDamage() x secondBombDamageCoefficient   // 10.0
blastAttack.baseDamage  = projectileDamage.damage x blastDamageCoefficient  // 4.0
```

That is **40x base damage per stack — 4000%, against a published 1000%.**

The published figure is **left unchanged.** Exactly one link is unproven: that
`LaserTurbineBomb` *is* `secondBombPrefab`. The EntityStateConfiguration stores a prefab
reference, that pointer has not been resolved to a named asset, and **name similarity is the
only evidence**. A 4x correction resting on a name is worse than a known gap, so it is recorded
as an open question carrying the whole arithmetic — the same treatment Electric Boomerang's 4%
got, at forty times the stake.

#### The guard caught my own prose

Appending a generic explanation mentioning `ProjectileExplosion` to five rows made the falloff
rule fire: those five items have no detonation at all — they deal damage by overlap — so my own
sentence implied a blast that does not exist. Reworded rather than exempted. **A guard written
against my errors caught an error in the fix for a different one.**

And the ratchet itself had the §3j.109 defect: keyed on `procCoefficient`, it reported Resonance
Disc as silent when its row already read *"Beam proc coefficient is 1.0"*. Written three passes
after documenting that exact failure. It now matches both spellings.

### 3j.119 the 4x error was real — Resonance Disc explodes for 4000%, not 1000%

§3j.118 left this as an open question rather than a correction, because one link rested on
name similarity. That link is now **followed rather than matched**.

`scripts/resolve-state-refs.py` (new) resolves object-valued fields in EntityStateConfiguration
assets. `extract-state-fields.py` reads only fields that parse as numbers out of
`serializedFieldsCollection`; prefab pointers live in `fieldValue.objectValue` as a PPtr and
were simply invisible to it.

```
EntityStates.LaserTurbine.FireMainBeamState.secondBombPrefab
    -> LaserTurbineBomb   [m_FileID=0  m_PathID=1198976041846065181  via same-file]
```

Every link in the chain is now read:

1. `GetDamage()` returns `ownerBody.damage x GetItemCountEffective(LaserTurbine)`.
2. `FireMainBeamState` fires with `damage = GetDamage() * secondBombDamageCoefficient`; that
   coefficient is **10.0**, from the EntityStateConfiguration.
3. `ProjectileManager` assigns `ProjectileDamage.damage = fireProjectileInfo.damage` unmodified.
4. The pointer resolves to `LaserTurbineBomb` — **followed, not guessed**.
5. That prefab carries `blastDamageCoefficient = 4.0` with `calculateTotalDamage = 0`, so there
   is no alternative damage path.
6. `ProjectileExplosion` computes `blastAttack.baseDamage = projectileDamage.damage *
   blastDamageCoefficient`, and `ProjectileImpactExplosion` overrides only `Awake`,
   `GetRandomDirectionForChild` and `OnValidate` — **not the damage**.

**10 x 4 = 40x base damage per stack. 4000%, not 1000%.**

The record published the **intermediate projectile damage as though it were the damage dealt.**

The control that confirms the shape rather than a mis-reading: the beam rows are unaffected and
remain correct at 300%, because `FireMainBeamState` builds a `BulletAttack` **directly** with
`damage = GetDamage() * mainBeamDamageCoefficient` and never passes through a prefab. Same
state, same method, two damage paths — only the one crossing a prefab boundary was wrong.

Also recorded: falloff is **SweetSpot** in a 14m radius (resolved from
`BlastAttack.FalloffModel`, not read as the integer `2` — §3j.114's `costType` near-miss), so
the 4000% lands within 7m and a quarter of it beyond. That quarter is **1000%** — exactly the
number the game prints, which is either a coincidence or the origin of the description.

#### What the guards did

The `damageCoefficient`-vs-base rule fired immediately: the record cites `4.0` and publishes
4000%. Rather than widen its numeric tolerance — which would have silently accepted the very
error it exists to catch — it was taught a **new reconciliation category**: `PRODUCT OF TWO
COEFFICIENTS`, for a code-side coefficient multiplied again on a prefab.

`data:diff` stayed silent, correctly. It compares our transcribed `description` (still the
game's verbatim 1000%) and exempts code-verified records carrying a `descriptionNote`. Its own
comment names the precedent, which is the reason the next task is a sweep rather than a
celebration: **"Preon Accumulator's blast is 8000%, not the 4000% the game claims."** This bug
shape has been found in this dataset before.

### 3j.120 sweeping the 4x bug shape, and finding two guards that could not match anything

§3j.119 fixed Resonance Disc. The point of that fix was never the one item — `data:diff`'s own
comment records the same shape found before ("Preon Accumulator's blast is 8000%, not the 4000%
the game claims"), so the question was how many more there are.

**Every item projectile, checked against its prefab.** Six named projectile prefabs are fired
from `GlobalEventManager`, plus `CommonAssets` pointers. Of those, `ElementalRingVoidBlackHole`,
`FireMeatBall`, `LightningStake` and `StickyBomb` all carry `blastDamageCoefficient = 1.0` —
no second multiplication, so the shape cannot occur. Sawmerang checks out at 1.0 x 4.0 = 400%.
Molotov checks out. Only two items multiply twice, and both were already known.

**Electric Boomerang: 120% -> 124%.** `0.4f` (code) x `damageCoefficient 3.1` (prefab) = 1.24
exactly. This had been carried as "NOT resolved: the residual 4%" since §3j.108 on the grounds
that it was too small to correct a published number on. That reasoning does not survive
§3j.119: the same rule that moved Resonance Disc by 4x moves this by 4%, and *size is not a
criterion for whether the code outranks the description*. The lingering row is deliberately
left at the game's figure, because its 400%/s is an instantaneous rate a fly-through never
sustains — a different question with a different answer.

#### Preon Accumulator: the numbers were right and in the wrong field

The corrections were sound (8000% blast, 400%/zap — both verified again here: fired with
`characterBody.damage * 2f`, `BeamSphere` carries `blastDamageCoefficient = 40` and a
`ProjectileProximityBeamController` at `damageCoefficient = 2.0`). They had been written **into
the `description` field**, which `ItemDetail` renders directly above the sentence *"The game's
text above is inaccurate."* That sentence is only true if the text above is the game's.

A sweep settled the scale: of 217 items, **exactly one** replaced a number the game states.
The dataset is otherwise disciplined, so this was a single lapse rather than a practice. The
description is now verbatim again (`EQUIPMENT_BFG_DESC` + the house-style cooldown suffix), and
the verified figures live in `stacking` rows where every other item keeps them.

Three things came out of re-verifying it:

- Both of the game's figures are **half** their real values, for one reason: they are computed
  as though the projectile were fired at 1x rather than `2f`. 4000 vs 8000, and 600%/s vs the
  ~1200%/s that `listClearInterval = 0.33` allows. A single omitted multiplier explains both.
- The note said the blast "tapers toward the 20m edge". **SweetSpot does not taper** — it is
  full damage within half the radius and a flat quarter beyond. Written by a pass that had
  already identified the model correctly.
- Two mechanics the description omits entirely: `bfgChargeTimer = 2f` holds the shot for two
  seconds before the projectile spawns, and
  `healthComponent.TakeDamageForce(aimRay.direction * -1500f, alwaysApply: true)` shoves the
  firer backwards unresistably.

#### Two guards that could not match anything

Adding a rule against describing SweetSpot as a taper produced five failures — on the five
records that describe it **correctly**, because "NOT a taper" contains the word. Fixing that
with a negation-stripping regex did nothing, and the reason is the finding of this pass:

> The regex was authored through a shell heredoc, where `\b` is a valid escape for **BACKSPACE
> (0x08)**. The file ended up holding a literal control character where the word-boundary
> assertion should be, so the pattern required an actual backspace in the text.

A scan for that class found a second instance, and a worse one: `AREA_SELECTOR`'s `\bblast\b`
branch had the same corruption. It was dead, and four rows describing a blast had been escaping
the falloff rule entirely — **Runald's Band, Kjaro's Band, Kinetic Dampener, Runic Lens**.
Repaired, the selector went from 20 rows to 27, and all four are now resolved: Kinetic Dampener
and Runic Lens are real BlastAttacks at `falloffModel = None`; Runald's "ice blast" is not a
blast at all but a single `DamageInfo` handed to one victim; Kjaro's tornado is a
`ProjectileOverlapAttack` with no radius to fall off across.

Neither `tsc`, nor eslint, nor vitest flags a control character inside a regex literal. The
coverage floor read 20 and passed. **This is the narrow-selector failure in its purest form:
not merely too narrow, but unmatchable — and every run said PASS.** There is now a guard that no
source file may contain `\0 \a \b \v \f \e` as a literal control character, proven by
re-injecting the exact corruption.

#### One more rule widened

The audit rule comparing a formula's stated "N at 1 stack" against `base` ran only on
non-linear rows: **7 inspected, 33 skipped**. Both errors it was best placed to catch — Electric
Boomerang and Resonance Disc — were on `linear` rows. It now runs on everything except
`hyperbolic` (whose `base` is an amplification input by design). Widening it surfaced one
mismatch, a false positive from Ultimate Meal's phrasing "m is 1 at one stack", which described
a multiplier rather than a value; the record now names `num121` and explains that its 1 case is
unreachable arithmetic.

### 3j.121 auditing the stat engine — nothing wrong, one thing right by luck

`statMath.ts` computes numbers the Stat Lab shows directly, so it is the highest-consequence
code in the repo. Read line by line against `CharacterBody.RecalculateStats`.

**It holds up.** Specifically re-derived from the decompile rather than taken on trust:

- **Armor**, both branches, character for character:
  `(armor >= 0f) ? (1f - armor / (armor + 100f)) : (2f - 100f / (100f - armor))`.
- **Crit multiplier** — `critMultiplier = 2f + 1f * num44` where `num44` is the Laser Scope
  count, matching `2 + critDamagePct / 100`.
- **Every stat target is consumed.** All 8 in the `StatTarget` union are read by the engine;
  none is defined and dropped.
- **No modelled item under-reports.** Of the 14 items in `STAT_ITEMS`, the only two whose
  `items.json` rows outnumber their modelled effects are Shaped Glass and Transcendence, both
  of which are special-cased in `statMath` by design.

Two things checked because they *looked* wrong and were not:

- `RecalculateStats` contains a branch that **converts crit chance into crit multiplier**
  (`critMultiplier += num111 * 0.01f; crit = 0f`) when `ConvertCritChanceToCritDamage` is held.
  That item is `tier: "NoTier"` with the name `"?"` — cut content that cannot drop — so its
  absence from the dataset is correct.
- Void Fiend's `gameName` renders as `「V??oid Fiend』`, which reads like mojibake. Compared
  codepoint by codepoint against `VOIDSURVIVOR_BODY_NAME`: **identical**. The `??` is the
  game's own stylisation.

#### The one real finding: correct by luck

`RecalculateStats` computes armor as `baseArmor + levelArmor * num72` — the same
`base + perLevel` shape as health, regen and damage. But `survivors.json` stores `armor` as a
**scalar**, and `statMath` uses `survivor.armor` directly instead of putting it through
`scale()`. Health, regen and damage all go through `scale()`; armor alone does not.

That is right today, and provably so: of **241** extracted bodies, exactly **two** carry a
non-zero `levelArmor` — `MegaDroneBody` and its remote-op variant, both at 5. No playable
survivor has one.

But it is right because of what the data happens to contain, not because of anything the code
does. A patch giving any survivor level-scaling armor would silently make every Stat Lab armor
figure — and every effective-HP figure derived from it — wrong at any level above 1, with no
test failing. `data:verify` now fails loudly on a non-zero `levelArmor` for any modelled
survivor, naming the schema change required. Proven by injecting one onto Commando.

This is the same shape as §3j.115's stale caution, inverted: an assumption that is *true* is
indistinguishable from one that is *checked*, right up until the data moves.

### 3j.122 the proc-coefficient gap is closed — 43 of 43

§3j.117 measured it at **8 of 41** and froze the 31 silent rows as a ratchet, on the reasoning
that a gap too large for one pass should at least be stopped from growing. It shrank instead,
so the ratchet is now a hard zero: **every row describing an item-fired attack states the rate
that attack procs at.**

The answers are the argument for having done it. They are not uniform, and none is guessable:

| rate | items |
|---|---|
| **0** | Brilliant Behemoth, Gasoline's blast, **Kjaro's tornado** |
| 0.1 | Preon's tendrils, Molten Perforator's fire pool |
| 0.2 | Ukulele, Polylute, Plasma Shrimp, Electric Boomerang's lingering component |
| 0.5 | Razorwire's orbs, Molotov's puddle |
| 0.7 | Molten Perforator's impact |
| 1.0 | most of the rest, including all three DelayBlast items |

Several items differ sharply from the item they are usually paired with. **Runald's Band procs
at 1.0 and Kjaro's Band procs at 0** — the two halves of a set. Electric Boomerang's own throw
procs at two different rates depending on which of its effects lands.

Rows that make no attack say so rather than being exempted by a list: Halcyon Seed's row is a
summon's damage **stat**, not an attack the item fires, and Sawmerang's bleed row records an
absence. That distinction is the §3j.115 lesson applied while writing rather than afterwards —
"no coefficient exists" and "coefficient unknown" must not look alike.

#### Two defaults worth naming

Both were found by reading class declarations rather than call sites, which is where a default
hides:

- `OverlapAttack` declares `public float procCoefficient = 1f`. Orphaned Core's launch never
  assigns one, so it lands at full rate **by default rather than by choice** — a distinction
  the record now makes, because a future patch adding an explicit value would look like no
  change at all.
- `DelayBlast` declares the same, which is why Will-o'-the-wisp, Shatterspleen and Voidsent
  Flame all proc fully while Behemoth and Gasoline — which set `0f` outright — do not.

#### The breakage test failed to break anything, again

Stripping the proc statement from Gasoline's burn row left the suite green. The rule applied:
*assume the mutation was too weak*. It was — that row does not match the attack selector at
all (no `damageCoefficient`, no attack class), so it was never in the inspected set. Mutating
AtG's missile row, which is genuinely in scope, fails as it should.

That is the fourth weak mutation this session. The pattern in all four is the same: **the
mutation landed somewhere the guard was never looking, which is indistinguishable from the
guard working** — and is exactly the failure the coverage floors exist to make visible.

### 3j.123 auditing the application, not the data — and a bug on every first keystroke

Every pass so far has audited what the site SAYS. This one audited what it DOES: the seven
`src/lib` modules with no test file of their own, plus the planner store and the highlighter.

#### The real bug: searching for one letter emptied the codex

`search.ts` configures Fuse with `minMatchCharLength: 2`. The codex filters as you type, so
**the first keystroke of every search anyone has ever performed rendered an empty codex** —
"no items match" for a corpus containing Brainstalks, Bison Steak and Bustling Fungus.

Measured rather than assumed, because the behaviour is not even consistent:

```
minMatchCharLength=2:  "b"=0    "c"=9     "cr"=79
minMatchCharLength=1:  "b"=187  "c"=217   "cr"=79
```

So the obvious fix is wrong too. At 1, a single letter matches 187 of 217 items and ranks
**Topaz Brooch** first for "b" — one character is far too little signal for a fuzzy ranker
weighing four fields.

What someone typing "b" wants is items whose name BEGINS with b. Queries under two characters
now take a deterministic path: name-prefix matches first, then anything else containing the
letter in its name or tags. Two characters and up are unchanged, and a test pins that "cr"
still finds Crowbar through the fuzzy path.

This is a bug no amount of data verification could have found, and it sat in the most-used
control on the site.

#### Checked and found sound

Reported because "we looked and it was fine" is the half of an audit that usually goes
unrecorded:

- **`planUrl.ts`** — 15 tests already, covering malformed suffixes, out-of-range goals, and
  old links. Solid.
- **The planner store** — `sanitizeEntry` was hardened in an earlier pass against hostile
  localStorage. An id that no longer exists survives migration, but cannot reach the screen:
  the rail derives its list from `allItems.filter(it => plan[it.id]?…)` rather than iterating
  the plan, so an unknown id is structurally unrenderable.
- **`highlightNumbers`** — relies on `String.split` with a capture group placing captures at
  odd indices. Verified across all **488** description, pickup and note strings: reassembly is
  lossless and no even index carries a number. Correct.
- **`survivorDetail.statRows`** — one latent case fixed. `.replace(/0$/, "")` strips a single
  trailing zero, so a non-integer rounding to `x.00` rendered "1.0". No survivor stat hits it
  today; hardening changed no current output, verified across all 19.

`search.test.ts` and `survivorDetail.test.ts` are new: 21 tests over modules that had none,
including regex metacharacters in a query (which must not throw), filters composing as AND
rather than either-or, and a matched unlock never also appearing as unmatched.

### 3j.124 a stat that varies across the roster and was on no page

Applying §3j.113's question — *verified against WHICH question?* — to survivors. Their numbers
match the body prefabs field for field (`data:verify` has enforced that for passes). The other
question is whether the fields we chose are the ones that matter.

The prefabs carry **22** fields. `survivors.json` carried **7**.

Most of the difference is genuinely uninteresting, and measuring says so: `levelAttackSpeed`,
`levelCrit`, `levelMoveSpeed`, `levelJumpPower`, `levelMaxShield` and `baseMaxShield` are
**0 across all 19**, `baseCrit` is 1.0 for all 19 (which is what `statMath` hardcodes), and
`sprintingSpeedMultiplier` is 1.45 for all 19 — a column identical down every row is noise, so
it stays off the page deliberately rather than by omission.

One field is different. **`baseAcceleration` varies: MUL-T 30, Artificer 40, False Son 50, and
the other sixteen 80.** MUL-T builds speed at under half the rate of most of the roster. It is
a handling difference players feel, it is not derivable from anything the site shows, and the
game's own character sheet does not show it either. It is now published, prefab-verified, and
locked by `data:verify` like every other survivor stat.

#### The same "correct by luck" shape, five more times

§3j.121 found armor modelled as flat while `RecalculateStats` scales it. The same is true of
attack speed, crit, move speed, jump power and shield — all six get `base + level * factor` in
the game and a bare scalar in our schema, and all six are right only because every relevant
`level*` field happens to be zero. `data:verify` now checks all six by name, each with the
schema change it would require. Proven by injecting a `levelMoveSpeed` onto Huntress.

#### The documentation guard was fail-open

Adding `acceleration` to the schema should have failed the rule that every schema field is
documented in `PLAN.md`. It did not: that rule held an allowlist of **nine field names to
check**, so a field added later was covered only if someone remembered to extend the list.
Seven of 35 declared fields were undocumented.

Inverted to fail closed — every declared field must appear in `PLAN.md` unless explicitly
exempt, and the exemption list holds exactly three names (`moveSpeed`, `jumpCount`,
`baseAttackSpeed`) where the identifier IS the documentation. `acceleration`, `gameName`,
`procSource` and `grantedBy` are now documented; none of them means quite what its name
suggests, which is the test for whether a field needs a sentence. Proven by adding a field.

**An allowlist of things to check is a list someone has to remember to grow. An allowlist of
exemptions is a list someone has to justify.** Only the second one fails when a person forgets.

### 3j.125–126 two audits that found nothing wrong, and one check that compared nothing

A pass with no data corrections in it. Recording it anyway, because "we looked and it was
fine" is the half of an audit that normally goes unwritten — and because the *method* failed
once in a way worth keeping.

#### Numbers duplicated between a component and a dataset

`Breakpoints.tsx` opens with: *"Every number is computed from the game's own formulas, not
hand-entered."* Its hyperbolic table then hand-enters four: `perStackAmp: 15, 13, 20, 5`. The
crit paragraph hardcodes `stacksToCritCap(10)` beside prose reading "+10% each".

**All of them were correct.** Checked against `items.json` and `STAT_ITEMS`: 15/15, 13/13,
20/20, 5/5, and Lens-Maker's perStack 10. Tougher Times' banner claim in `ItemDetail` — "reads
15% per stack but blocks 13% at one stack" — recomputes to 13.04% from the item's own curve.

So nothing was wrong on the page. The defect was that **the header claimed derivation over a
table of literals**, and nothing would have noticed them diverging. The inputs are now read
from the data, which makes that sentence true; a row whose item loses its hyperbolic entry is
dropped rather than rendered with a placeholder, and a test asserts all four still resolve.
What cannot be derived — prose quoting a number — is asserted instead.

**This is the distinction worth being careful about: the values did not need fixing, and were
not fixed. The duplication did.**

#### Equipment cooldowns: 41 numbers nothing was checking

`data:diff` structurally cannot see them — the game stores cooldowns outside `_DESC`, which is
why the site appends "Cooldown: Ns" itself. Extracted `EquipmentDef.cooldown` for all 60
equipment defs and compared. **41/41 correct**, and `data:verify` now checks them every run.

The mapping was the hard part, and the first attempt **silently compared nothing**:
`itemdefs.json` holds *item* defs, so every equipment lookup returned `None`, and the script
printed "MISMATCHES: 0" over a comparison set of size zero. It was caught only because the
script also printed how many it had actually compared.

> A verification that reports success must report its **denominator**. "0 mismatches" and
> "0 of 41 compared" are the same output otherwise — the same failure as every weak breakage
> test in this log, in a different costume.

Rebuilt on `EQUIPMENT_<X>_NAME` tokens, with the aliases stated explicitly rather than guessed:
Sawmerang's def is `Saw`, Recycler's is `Recycle`, and the ten elite aspects are tokenised by
COLOUR (`affixred`) while their defs are named by ELEMENT (`EliteFireEquipment`). Fuzzy-matching
those would risk exactly the misfiling of §3j.66.

What makes the aspect pairing evidence rather than assumption: **the cooldowns are not
uniform.** They split 6/4 between 10s and 25s, and all ten land on the right one.

Also confirmed already covered, so not rebuilt: void corruption pairs are cross-checked against
the game both ways, and codex completeness asserts every droppable game item is present.

### 3j.127 every stacking type verified; nothing was wrong

All **291** stacking rows checked against what their formulas actually compute, because a wrong
`type` is the one data error that renders as a wrong PICTURE — the sparkline plots from it.

| type | rows | verdict |
|---|---|---|
| reciprocal | 8 | all genuine `k/n` shapes |
| exponential | 14 | all genuine `k x r^n` |
| hyperbolic | 7 | all the game's amplification curve |
| special | 7 | all curves the standard renderers cannot express |
| none | 79 | 57 on equipment (trivially true), 22 real claims, all evidenced |
| linear | 176 | swept for non-linear math; 15 flagged, all false positives |

Two hyperbolic rows deserved a second look and survived it. **Sale Star** reads like a cascade
(30/15/1% thresholds), but its `perStack: 5` IS the hyperbolic amplification applied from three
stars up, with the cascade layered on top. **Unstable Transmitter** decays toward 0 rather than
approaching 100%, which is unlike every other hyperbolic row — but it calls `Util.Hyperbolic`
literally, and an existing test already records that it draws no curve.

The 15 flagged linear rows are all "multiplied by something that is **not** the stack count" —
the hit's proc coefficient, the number of charges, `quickFixMultiplier` — plus `Pow(n, 1f)`,
which is linear, and `13^2`, which is a constant. Linear in n is the only thing the type
claims, and each is.

**The contract that makes a mistype survivable:** `sparklinePoints` returns `null` for anything
that is not `linear`, so a non-linear row can never be plotted as a straight line. The
dangerous direction is the opposite one — a non-linear row mislabelled `linear` WOULD be
extrapolated — which is why the linear sweep was the part worth doing carefully.

The 22 non-equipment `none` rows are the interesting subset: "extra copies do not change this"
is a negative claim, the shape this project has repeatedly caught. All 22 already name the
constant or mechanism (`(n > 0) ? 0.04`, `NO stack term`, `flat regardless of item count`).
A guard now requires that of the 23rd.

Also re-ran `check-extractor-health.py` after this session's new extractions: **1472 bundles,
224,435 MonoBehaviours, 39 language files, all four swallow classes at zero.** The "complete
input" assumption behind every asset-derived number still holds.

### 3j.128 a planned sweep that found no data errors

The previous rounds each found real corrections, so this one was planned deliberately rather
than followed opportunistically: seven surfaces nothing had checked, ranked by expected yield,
each with a falsifiable check decided **before** looking.

| surface | result |
|---|---|
| numbers duplicated between component and dataset | all correct; **duplication** removed |
| equipment cooldowns (41) | **41/41 correct**, now checked every run |
| `type: "none"` rows (79) | all evidenced; 22 real claims, 57 trivially true |
| non-linear `type` classifications (36) | all correct |
| linear rows swept for non-linear math (176) | 15 flagged, all false positives |
| unlock gating (49) | 49/49 compared and matching |
| `capStacks` (5) | all five verified verbatim in the decompile |
| Playwright suite quality | two targeted mutations, both caught |
| extractor health | 1472 bundles, 224,435 MonoBehaviours, all swallow classes 0 |

**Zero data corrections.** That is a result, not an absence of one — after four rounds that each
found real errors, a planned sweep across the largest remaining unchecked surfaces coming back
clean says something about where the dataset now is.

Three things did change, none of them a number:

1. `Breakpoints.tsx` opened with *"every number is computed from the game's own formulas, not
   hand-entered"* above a table of four hand-entered curve inputs. They were **right** — 15, 13,
   20, 5 all matched `items.json`. The values were not touched; the duplication was, so the
   sentence is now true and drift is impossible rather than merely absent.
2. `data:audit` now prints **how many** items its unlock check compared. Which is the lesson
   from §3j.126 generalised: the cooldown check's first version printed "MISMATCHES: 0" over a
   comparison set of size **zero**, because `itemdefs.json` holds item defs and every equipment
   lookup silently returned nothing.
3. A guard requires the 23rd `none` row to name its evidence, as the 22 existing ones do.

> **A check that reports success must report its denominator.** "0 mismatches" and "0 of 41
> compared" are the same output otherwise. This is the same failure as every weak breakage
> mutation in this log — four of them this session — wearing different clothes: the measurement
> ran, reported success, and touched nothing.

The one surface deliberately NOT checked, rather than checked badly: **item icons**. 217 files
exist (`data:audit` enforces that), but whether each PNG depicts the right item is a visual
question. Comparing them to the game's own icon assets is possible and was not done; asserting
they are correct on the basis that the filenames match the ids would be exactly the kind of
denominator-free "verification" this entry is about.

### 3j.129 two icons were HTML pages, and forty "mismatches" that were not

The one surface §3j.128 deliberately left unchecked: whether each `/public/icons/<id>.png`
actually depicts the item it is named after. `data:audit` checked the file EXISTED. Nothing
checked it was a picture.

#### The real bug

**`encrypted-cerebellum.png` and `exposed-cerebellum.png` were 407KB of HTML** — a wiki.gg
Cloudflare *"Just a second…"* interstitial, captured when the icons were originally fetched and
saved with a `.png` extension. Both rendered as a broken image on their item pages, and every
check the project had reported the icons as fine, because every check asked whether the file
was **there** rather than whether it was an **image**.

Replaced from the game's own `pickupIconSprite`, and the second attempt matters: the first
resized the raw sprite straight to 256x256, but Exposed Cerebellum's sprite is **127x92** —
squashing that to a square would have published a visibly wrong shape. Scaled to fit
preserving aspect, centred on a transparent canvas. Both were then opened and looked at:
Encrypted is the sealed armoured shell with a teal core, Exposed the open pink brain.

A CI guard now reads the magic bytes of all 237 icon files, and a second makes a missing icon
a build failure rather than the warning it used to be. Proven by replacing Crowbar with an
HTML page.

#### The forty that were not

The first run of `scripts/verify-icons.py` reported **40+ mismatched icons.** Every one was an
artifact of my own method, and reporting them would have been the worst outcome of this
session — a demand to "fix" forty things that were correct.

Two compounding errors, both found by asking why the distances looked like noise:

1. **Framing.** The game's sprites are tightly cropped and not square (Alien Head 115x125,
   Crowbar 127x124, Exposed Cerebellum 127x92); our PNGs are 256x256 with the art padded
   inside. Hashing those against each other compares a crop to a canvas. Trimming both to
   their alpha bounding box first took mismatches from 40+ to **5**.
2. **Colour.** Item Scrap comes in White, Green, Red and Yellow — four icons with the SAME
   shape differing only in hue, and a greyscale hash discards exactly that. Hashing the three
   colour channels took 5 to **1**.

The last one, Hearty Stew, was settled by exporting the game's own sprite and looking at both:
same bowl, same blue-and-white stripes, same butter and broccoli. The residual distance is a
systematic difference — our icons carry a tier-coloured outline the game sprites lack — not a
wrong picture.

**Final: 0 mismatched icons of 217 compared.**

#### The lesson, which is not about icons

A measurement that disagrees with the data is not evidence the data is wrong. It is evidence
that one of them is wrong. Forty simultaneous "errors" in a dataset that has survived this much
checking was the tell — a real defect rate does not arrive in a block like that. **The cost of
believing a broken instrument is not a wasted afternoon; it is forty correct files overwritten
with wrong ones.**

### 3j.130 tier and DLC — 217 numbers nobody had ever compared

A different question rather than a new surface: not *are the numbers right* but **is the item
filed under the right kind?** `tier` decides the colour a reader sees, the drop pool the item
belongs to, and the group the planner files it under. `dlc` drives a filter. Neither had ever
been checked against the game.

The aggregate counts matched **perfectly** — Tier1 36 ↔ common 36, Tier2 42 ↔ uncommon 42,
Boss 22, Lunar 20, VoidTier1 5, FoodTier 5, and so on down the list. That is worth exactly
nothing as evidence: two items swapped between tiers leaves every total identical. So, per
item:

- **175 items** against `ItemDef.deprecatedTier`
- **42 equipment** against `EquipmentDef.isLunar`, because equipment has no item tier at all
- **217/217 tiers correct. 217/217 DLC assignments correct.**

Both are now checked by `data:verify` every run, proven by swapping Crowbar to uncommon and
Jade Elephant to SotV.

#### A second source, found by accident

`itemdefs.json` turned out to have three sections — `items`, `equipment`, `corruption` — and
every script that had touched it read `Object.values(d)[0]`, i.e. the items list only. That is
why the first cooldown attempt found no equipment and silently compared nothing (§3j.126).

The `equipment` section carries `dlc`, `isLunar` **and** `cooldown`, produced by
`extract-itemdefs.py` walking MonoBehaviours — a completely different pass from
`extract-component-fields.py`, which selects by field name and is what `data:verify` uses.
Re-checking the cooldowns against it: **41/41 agree.**

Two extractors, two independent walks over 1472 bundles, same answer. That is a stronger claim
than either could make alone, and it cost nothing but noticing that a dictionary had more than
one key.

**Score for this pass: 0 corrections, 434 values verified for the first time** (217 tiers,
217 DLC), plus 41 cooldowns confirmed twice.

### 3j.131 a mechanic the game tags and the site does not publish

Following §3j.130's accident — a dictionary with three keys where every script read one — to
its natural next question: **what else is in the extracted data that nothing reads?**

`ItemDef.tags`. The game assigns **35 distinct tags** across the roster. Ours are editorial
(`damage`, `on-hit`, `aoe`) and drive search; the game's encode mechanics.

First, the check that matters for correctness: do our editorial tags **contradict** the game's?
Across 175 comparable items, **no contradictions**. Nothing is mislabelled.

But several game tags are consumed by real behaviour, and one is strategically significant:

```csharp
// ItemStealController.BrotherItemStealFilter
if (itemDef.canRemove && itemDef.DoesNotContainTag(ItemTag.AIBlacklist))
    return itemDef.DoesNotContainTag(ItemTag.BrotherBlacklist);
return false;
```

**Mithrix cannot steal an item carrying `AIBlacklist` or `BrotherBlacklist`.** In our dataset
that is **55 items** — including Fuel Cell, Hopoo Feather, H3AD-5T v2, Brainstalks, Old
Guillotine and both Cerebellums. Which items survive the phase-4 steal is a genuine strategic
fact, it is decided entirely by the game's own defs, and the site says nothing about it.

Others in the same family, all verified as consumed by code rather than decorative:
`CannotSteal` (12, the void Extractor and shrine steals), `RebirthBlacklist` (7, cannot be
banked at a Shrine of Rebirth — the site HAS an Artifact of Rebirth record), `CannotDuplicate`
(9), `CommandArtifactBlacklist` (2), `DevotionBlacklist` (4), `SacrificeBlacklist` (1),
`Cleansable` (2).

#### Why this is recorded and not acted on

**This is an omission, not an error.** Nothing on the site is wrong; a fact the game holds is
simply absent. Publishing it is not a fix — it is a schema field, 217 records, a UI surface,
a `PLAN.md` entry and a guard, i.e. a feature with a scope decision attached.

The distinction matters more than the tags do. Every correction in this log changed something
that was WRONG. Quietly widening the dataset because a new field looked interesting would be
the same failure as "fixing" the forty icons that turned out to be correct (§3j.129), just in
the opposite direction: **action taken without a defect to justify it.**

So it is written down, characterised, and left for a decision.

### 3j.132 roster completeness, and the one disagreement that is correct

Three completeness questions nothing had asked, all answered by comparing to the game rather
than by counting.

**Void corruption pairs.** The game defines **31**; we hold 31 `corruptedBy` links across 14
void items whose `corrupts[]` arrays sum to 31. Resolved to display names and compared as
SETS, not counts: **exact match, both directions, nothing missing.**

**Survivor roster.** 19 `survivordefs` against our 19, compared by `cachedName` rather than by
length: **exact match.** One detail worth having seen — `Heretic` is `hidden: 1`, and the site
already handles it: `SurvivorDetail` explains she "appears only while holding all four Heresy
lunar items", and the Artifact of Metamorphosis record notes the respawn pool skips hidden
survivors so it can "never" roll her.

**Loadout skills.** 122 in the game's tables against our 125, and the difference is entirely
Heretic.

#### The disagreement that must not be "fixed"

A completeness check reports Heretic wrong in both directions: the game's default loadout has
one skill we lack, and we list four it does not.

`HereticBody` ships `HereticDefaultSkill` — displayName **"Nevermore"**, state
`EntityStates.Heretic.Weapon.Squawk` — in **all four slots**. It is a placeholder. Becoming
Heretic requires holding all four Heresy lunar items, each of which replaces a slot, so no
player ever sees Nevermore. The four skills we publish are what those items grant.

**Our data is more correct than the source it would be "corrected" against.** The game's
loadout table answers *what does the body ship with*; the page answers *what will I have*. For
all eighteen other survivors those are the same question, which is exactly why the divergence
looks like an error.

Pinned by a test that fails if the placeholder is ever added, and by a second asserting the
page still explains why — proven by adding Nevermore back.

This is the §3j.129 lesson in a new costume. There, a broken instrument said forty correct
icons were wrong. Here, a correct instrument pointed at the wrong question says four correct
skills are wrong. **Both would have been "fixed" by anyone acting on the report instead of
reading it.**

### 3j.133 the Ambry codes — right data, four broken things behind it

The last claim in the repo that anything was wiki-sourced: *"Still hand-entered / wiki-sourced:
the Ambry codes."* CLAUDE.md said the opposite — "Nothing is wiki-only any more" — so one of
them was false. Chasing which found the data correct and the machinery around it broken in
four separate ways.

**The data is right.** All 19 published codes are reproduced by brute-forcing 5^9 = 1,953,125
candidate sequences against the SHA-256 the game itself validates
(`PortalDialerController.PerformActionServer`), and all 16 code→artifact attributions that
resolve match ours. Nothing on the site changed.

#### 1. Array order is not display order

`ambry-codes.json` and `ambry-codes-final.json` disagreed on every code, as PERMUTATIONS of
each other. The cracker recovers each sequence in `buttons[]` order because that is what the
game hashes — but the dialer's nine buttons are not stored in reading order. Their GameObjects
are named `PortalDialerButton 1..9` and appear in the array as **3, 6, 9, 2, 8, 5, 1, 4, 7**.

Derived the permutation `[6,3,0,7,5,1,8,4,2]` from the prefab's names and transform positions
(rows at z = -4/0/4, columns at x = 5/1/-3) and it reproduces the published grids for **16/16**
shared codes. The correction had existed only as a JSON file with no generator; it is now in
the script, read from the prefab rather than hardcoded.

#### 2. The scan was three hardcoded bundles

`skymeadow`, `dlc1-voidoutro`, `dlc2-helminthro`. It recovered **16 codes and reported
16/16** — a denominator derived from the same incomplete scan that produced the numerator.
There are **19** hash assets: `PortalDialerCode1A5784` and `D738C9` are in `ror2-cu8`,
`CF4BB3` in `ror2-dlc3`. The three newest artifacts — Delusion, Devotion, Prestige — were
never targeted. Now every bundle is swept and hash assets are collected directly rather than
only through the dialer actions that happen to reference them: **19/19 recovered.**

#### 3. Attribution silently failed for all 16

Each dialer action calls `OpenArtifactPortalServer` with an `ArtifactDef` PPtr. Every one fell
back to the hash-asset name, so the code→artifact mapping was never established from the game
at all. The pointers resolve fine — 109 externals, `m_FileID 38..52` well within range — via
the externals walk. All 16 attribute correctly, and all 16 match what we publish.

#### 4. Two crashes the narrow scan was hiding

The script died on Windows AFTER writing its output, printing glyphs to a cp1252 console; the
existing `.encode("utf-8","replace").decode("utf-8")` is a no-op because `print` re-encodes.
And `dialer` was initialised once outside the bundle loop instead of per bundle — harmless
while the first of three curated bundles always had one, an `UnboundLocalError` on the first
dialer-less bundle the moment the sweep became complete.

`data:verify` now checks all 19 codes against the cracked set in both directions, proven by
altering a single glyph.

**Every one of these four was invisible while the answer was right.** A hardcoded scan list, a
missing permutation, a failed pointer walk and a crash after the useful work — and the output
still matched the wiki, so nothing ever looked wrong.

### 3j.134 the reference layer, checked the way items were

Two questions already asked of `items.json`, never asked of `reference.ts`.

**Is the quoted text verbatim?** `reference.ts` claims it is — *"Text is verbatim, including
the game's own typos"*. The same question found exactly one rewritten description in
`items.json` (Preon, §3j.125).

- **20/20 artifact `effect` strings** match `ARTIFACT_*_DESCRIPTION` exactly.
- **12/12 shrine `description` strings** match their game tokens exactly.

Zero rewrites. The claim is true.

The first attempt parsed only **9 of 12** shrines, because the regex expected `cost` and
`description` to be adjacent and the `mechanic` blocks added in §3j.114 sit between them. It
would have reported "0 not-verbatim" over a quarter of the data. Fixed by slicing the SHRINES
array and pairing `name` to `description` regardless of what lies between — and caught, again,
only because the script printed *compared 8* next to *bad 0*.

**Do the icons depict the right thing?** §3j.129 rank-tested the 217 item icons. The 20
artifact icons were covered only by the magic-byte guard — valid PNGs, unverified identity.
`ArtifactDef.smallIconSelectedSprite` gives the same test: **20/20 correct**.

`verify-icons.py` now covers both in one sweep rather than two 20-minute passes over the same
1472 bundles, and Hearty Stew's known-benign result carries its explanation inline instead of
being suppressed — silencing it would also silence a real future change to that icon.

**Zero defects this pass.** Worth recording precisely because the reference layer had been
verified for *mechanics* (§3j.113–114) while its *quotations* and *pictures* had not, and
"we checked the artifacts" could easily have been taken to mean all three.

### 3j.135 the last two reference datasets, and a pattern in my own failures

**Bazaar dreams — 31/31.** Every dream line is verbatim in `BAZAAR_SEER_*`, and every stage
attribution resolves correctly through the scene's `nameToken` and `stageOrder`.

Two things that looked like errors and were not:

- Four rows show `stageNumber: "—"` against scenedef orders of 93, 96, 96 and 99. The distinct
  orders in the game are `1..6` for the stage loop and `93..100` for hidden realms (bazaar is
  98, Gilded Coast 96, Void Locus 99). The dash is right; my check was naive about sentinels.
- `BAZAAR_SEER_HELMINTH` has no scene called `helminth`. The scene is `helminthroost`, order 5,
  and our row already says Helminth Hatchery / stage 5. A token-vs-scene naming difference,
  not a data error.
- The four `BAZAAR_SEER_*` tokens we do not publish are `_NAME`, `_LORE`, `_DESCRIPTION` and
  `_CONTEXT` — the Seer's own label, not dreams.

**Skill unlocks — 51/51.** Every `LOADOUT_UNLOCKS` challenge name resolves to a real
achievement and every requirement string matches `ACHIEVEMENT_*_DESCRIPTION` verbatim. The
52nd is flagged `noUnlockRequired` and correctly carries no challenge. `data:audit` had been
cross-checking the 49 ITEM unlocks all along; the skill unlocks on the survivor pages — equally
actionable — had never been checked.

#### The pattern worth naming, because it is mine

Three scripts this pass, three under-reaching parsers:

| attempt | parsed | actual | why |
|---|---|---|---|
| shrine verbatim | 9 | 12 | regex assumed `cost` and `description` adjacent; the `mechanic` blocks I added in §3j.114 sit between |
| dream stages | 0 | 31 | treated `scenedefs.json` as a list of dicts; it is a dict keyed by scene name |
| skill unlocks | 2 | 52 | assumed a field order the data does not use |

Every one would have printed **"0 mismatches."** Every one was caught by the same line of
output — the count of what was actually compared, next to the count of what failed.

That is now six times in this session that a check was about to certify a dataset it had barely
read. The lesson has stopped being *"remember to print the denominator"* and become something
sharper: **a parser I wrote from memory of a file's shape is wrong more often than the data it
is checking.** In this pass, three for three — and the data was clean all three times.

### 3j.136 auditing the machinery, because that is where the defects now are

Three consecutive passes found zero data errors while finding real bugs in the verification
code every time. That is evidence about where to look, so this pass audited the tooling
directly rather than the dataset.

#### The bug class, hunted deliberately

§3j.133's Ambry failure had a shape worth naming: **a hardcoded content list that did not grow
with the game.** Three bundle globs, three missing codes, and a clean "16/16" derived from the
same incomplete scan. So: which other scripts carry one?

Of 25 scripts that glob, all but two scan complete sets (`*.json` language files, recursive
`**/*.cs`, `*.bundle`). The two narrowed ones — `extract-loadouts.py` and
`extract-skill-unlocks.py` — resolve their bundle from `bodies.json` rather than a literal, so
they are data-driven and safe.

But `extract-loadouts.py` iterates a **hardcoded `SURVIVOR_BODY` map of 19 entries.** It is
correct today. A twentieth survivor would be skipped silently, `skills.json` would be short a
roster entry, and every script involved would still report success.

#### Two completeness checks that did not exist

`crossCheckCompleteness` has asserted since §6A that every droppable game item is present.
There was no equivalent for the roster or for skills — the two datasets fed by that hardcoded
map.

- **Roster completeness**: 19 SurvivorDefs, compared by `cachedName` rather than count (§3j.130).
  Proven by injecting a twentieth survivor.
- **Skill completeness**: all 19 loadouts compared against `loadouts_final.json`, both
  directions. Proven by deleting Commando's Frag Grenade.

The skill check encodes the Heretic exception explicitly (§3j.132): her four Heresy-item skills
are expected, and `Nevermore` is expected to be *absent*. A naive version of this check would
report her wrong in both directions and invite someone to "fix" correct data — so the knowledge
lives in the check rather than in a comment nobody reads.

`data:verify` now reports **eleven** cross-checks, each with its denominator.

#### The shape of the remaining risk

Every check added in the last several passes has the same purpose: making a hardcoded or
hand-maintained list fail loudly when the game moves past it. That is the entire residual risk
profile of this project now — not wrong numbers, but **right numbers about a game that has
changed**, and lists that quietly describe the version they were written for.

### 3j.137 a reported denominator is not an enforced one

The previous pass ended on a claim: the residual risk is hand-maintained lists that quietly
describe the version they were written for. This pass tested that claim against the checks
themselves, and found the checks had the same weakness they were built to catch.

#### Printing the number is not the same as requiring it

Six times this session a check was caught about to certify a dataset it had barely read, and
the fix each time was to print how much was compared. But `data:verify` only *printed* it:

```
if (!raw) continue;      // cooldowns: name did not resolve
if (!g) continue;        // tier/dlc: no ItemDef / EquipmentDef found
```

Three silent-skip sites. An item the game renamed, or a new equipment whose token does not
match its display name, simply left the comparison — and the line still printed
`41/41 ✓`, because the denominator was **recomputed from what was reachable** rather than from
what exists. A partial run and a complete run are the same output.

All three now push a named failure instead, and the reporting requires `compared === total`
before printing a tick. Proven by renaming Crowbar and Jade Elephant so they resolve to
nothing: previously silent, now three explicit failures naming the item and the fix.

#### A tier the codex would not show

`TIER_META` is `Record<Tier, TierMeta>`, so the compiler forces an entry for every tier in the
schema. `TIER_ORDER` is a plain `Tier[]` — omit a tier and it compiles, the codex never renders
that group, and **every item in it is invisible on the page while perfectly correct in the
data.** Every check this project has would pass, because they all ask whether the data is right
rather than whether the page shows it.

Guarded from both directions — schema tiers and tiers actually used by items — with a floor so
it cannot pass by emptying both sides. Proven by removing `food`.

#### The shape

Three passes ago the finding was that guards can be narrow. Two passes ago, that they can be
unmatchable. Now: that they can be **honest about their own coverage and still not act on it.**
Each is the same defect one level up — the check exists, runs, reports, and does not bind.

### 3j.138 CI printed a claim it had not checked

The ladder continued. Narrow selectors, then unmatchable ones, then guards that report their
coverage without acting on it. This rung: **a guard that binds, runs, and still ends by
asserting something it did not verify.**

`data:verify` checks each dataset in two stages — against a transcribed truth table inside the
script, and against a fresh extraction from the game. The extractions are git-ignored, because
they are Gearbox's data and must never be committed. So in CI the second stage never happens.

Simulated a CI run by hiding `.gamedata/` and `.decompiled/`:

```
9 of 12 checks: skipped
✓ statItems.ts matches the code-derived coefficients.
✓ survivors.json matches the game's body prefabs.
EXIT 0
```

**That second sentence was false in CI.** The live prefab cross-check had just printed
"skipped" four lines above it. What actually matched was `SURVIVOR_TRUTH`, a hand-written table
in the script — a *transcription* of the game, which is exactly the thing the extraction exists
to check.

Every CI run since those checks were written has ended by claiming a comparison against the
game that did not occur.

Now it counts what ran and words the conclusion accordingly:

```
0 of 7 game cross-checks ran; skipped: skill completeness, roster completeness, Ambry codes,
tier + dlc, equipment cooldowns, live prefab cross-check, live decompiled grep
✓ statItems.ts matches the transcribed coefficient table.
✓ survivors.json matches the transcribed survivor table.
  (Not the same as matching the GAME…)
```

Locally, with the game present, it still prints `7 of 7` and the confident wording.

`CLAUDE.md` understated this too: the local-only tier was documented as three `data:audit`
rules, when `data:verify` alone contributes **seven** more, and the Status line said
`data:verify` "locks coefficients and survivor stats, and runs in CI" — true in every word and
misleading as a whole. Both corrected, and pinned by a test asserting both wordings exist and
that the choice between them is made by counting.

#### What this rung actually is

The previous four findings were about a check not looking hard enough. This one is about a
check **summarising itself generously** — the gap between what a run did and what its last line
says. A reader takes the last line.

That makes it the same defect as a stale hedge (§3j.114), inverted: there, caution outlived its
reason; here, confidence outran its evidence. **Both are a sentence that was true when written
and describes a different situation now.**

### 3j.139 the browser tests did not gate publication

Next rung, and the last one that was still load-bearing: **a guard that names the right
property and asserts a weaker one.**

`deploy.yml` triggers on `push: branches: [main]` with no `needs:` and no `workflow_run`
dependency, so a push starts CI and deploy **in parallel**. A previous pass already found this
and duplicated typecheck, `data:audit`, `data:verify` and `test:unit` into the deploy job, with
a comment explaining exactly why: *"a failing audit in CI would not have stopped this job from
publishing."*

The reasoning was right and the fix stopped one step short. **Playwright was left in `ci.yml`
only.** So a change that broke the rendered page would fail CI and deploy anyway.

That is not hypothetical for these particular tests. Two of the 46 were verified by deliberate
breakage earlier in this session:

- the **non-affiliation disclaimer** (rule #6) actually rendering — §3j.116
- the **amber callout** that carries every correction in this log appearing on the page at all
  — §3j.123; removing it fails one browser test and zero unit tests

Both are invisible to `test:unit`, because a unit test can confirm `descriptionNote` holds the
right sentence and cannot confirm anyone will ever see it.

#### The guard was complicit

The test policing this is called *"the deploy workflow still gates publication on every runnable
check"*. Its Playwright assertion read:

```ts
expect(ci, "Playwright must run somewhere").toContain("pnpm test");
```

**Somewhere is not the deploy path.** The guard had the right name, checked the wrong file, and
passed — the same shape as §3j.109's falloff rule, one level up: correct intent, weaker
assertion, green.

Both fixed. `pnpm test` now runs in `deploy.yml` before the build (it starts its own dev server
via `playwright.config.ts`, so it needs no build step), and the guard requires it there rather
than anywhere. Proven by deleting the step.

#### The ladder, complete

| rung | the check… |
|---|---|
| §3j.109 | looked at too few rows |
| §3j.120 | could not match anything at all |
| §3j.137 | measured its coverage and did not act on it |
| §3j.138 | ran, bound, and then overstated itself in the summary |
| §3j.139 | was correct, ran, bound — and did not gate the thing it was for |

Every rung passed green. The dataset was never the problem at any of them.

### 3j.140 the source-of-truth document named the wrong source of truth

Five passes of finding stale claims in `reference.ts`, `provenance.ts` and `CLAUDE.md` is a
pattern, not three coincidences. The one document never audited for it was `PLAN.md` — the file
`CLAUDE.md` opens by telling a reader to *"read in full before doing anything"*.

**§1 and §6A.2 contradict each other outright.**

§1, "Canonical data sources, in order of preference":

> 1. `riskofrain2.wiki.gg` … **Use this as ground truth for effects, stacking formulas**…
> 2. the language files … *"use the wiki for numbers, stacking math, and icons"*

§6A.2, a thousand lines later:

> | **T4** | Community wiki / internet | **Nothing, on its own.** |

Both were true when written; only one is true now. And the ordering matters more than a
footnote would, because a reader following the instruction meets §1 first — the section telling
them to take numbers from the wiki is the section they read before anything else.

The same reversal survived in three more places:

- **`CLAUDE.md` rule #1**, a stated *non-negotiable*: data "must come from riskofrain2.wiki.gg
  or the game's own language files". Both halves are now wrong — the wiki is a lead, not a
  source, and a language file is quoted text, never a constant (§5.0.1). It also still told a
  contributor to set `verified: false`, a field that has been **zero across all 217 items** for
  many passes; a new one would be a signal, and the rule framed it as a placeholder.
- **Rule #2**: "verify against the wiki when touching data."
- **Working style**: "When fetching wiki pages for data entry, transcribe numbers exactly."

All corrected to the hierarchy the project actually follows, with §1 left in place under an
explicit SUPERSEDED banner rather than deleted — removing it would hide that the project
reversed its position, which is the more interesting fact.

**The counts were wiki approximations too.** §1 gave "roughly 183 items and 44 equipment". The
game's own defs give **175 items and 42 equipment**, counted per-item in §3j.130 and enforced
every run since. A round number sourced from a page, sitting in the section that told everyone
to trust pages.

#### Why this is the same finding as the last five

The ladder in §3j.109–139 was about checks that pass while proving less than they claim. This
is the documentation equivalent: **instructions that were accurate when written and now point
the reader at the thing the project spent a hundred entries disproving.** A guard can be
narrow; a rule can be stale; both fail silently, and both are believed precisely because they
are the authoritative-looking thing in the room.

### 3j.141 the item drawer promised modality and did not deliver it

A front never opened before: **accessibility.** The codex drawer is how all 217 items are
read, and it declared:

```tsx
<div role="dialog" aria-modal="true" aria-label={item.name}>
```

with **no focus management of any kind** — no move on open, no trap, no restore on close.
`useRef`, `focus`, `tabIndex`, `autoFocus` and `inert` appear nowhere in the file.

`aria-modal="true"` is not a style hint. It tells assistive technology that everything outside
the element is inert. **Tab does not know that.** So a keyboard user opening an item kept focus
on the grid behind the overlay and could tab through content their screen reader had just been
instructed to ignore — the two failures compounding rather than cancelling. On close, focus fell
to `<body>` and the user lost their place in a 217-card grid.

Fixed properly: focus moves to the panel on open (the panel, not the close button, so a screen
reader announces the dialog and its item name rather than the word "Close"), Tab and Shift+Tab
cycle within it, and the previously focused element is restored on unmount.

Three browser tests now assert the three behaviours, because **none of them is observable from
the source** — the component "looks" accessible either way. Each was validated by disabling
exactly the code it covers: removing the focus move fails two, removing only the restore fails
the third.

#### What else was checked and was fine

Reported because an audit that only lists faults implies the rest was never looked at:

- Every `<img>` carries `alt`. The empty ones are decorative and correct — each sits beside the
  name in text, including the corruption-pair row where the icon could easily have been the
  only indicator.
- All seven `<input>`s have an accessible name, by `aria-label` or by being wrapped in a
  `<label>`.
- The filter chips are real `<button>`s carrying `aria-pressed`, not clickable `<div>`s.
- The one non-interactive element with a click handler is the modal backdrop, which is
  correctly `aria-hidden` and correctly not focusable — Escape is the keyboard path.

#### And the seventh time

My first version of these tests navigated to `/codex`. The route is `/items`. All three failed
on a timeout, which looks exactly like "the fix does not work" — and the fix was fine.

That is the seventh time this session my own tooling was wrong where the thing under test was
right. The habit that keeps saving it is the same one every time: **when a check fails, find out
whether it ran before deciding what it proved.**

### 3j.142 the heading outline — and an audit that inspected a fifth of its subject

**Target:** the heading hierarchy of every route. **Question:** not "are there headings" but
*can a screen-reader user navigate by heading and get a correct outline?* **Defect:** a page
with no `h1`, more than one, or a skipped level — invisible on screen, incoherent to a screen
reader.

#### The finding

`/reference` jumped **h1 → h3** on four of its five tab panels. Every entry (each artifact,
each shrine, each survivor's unlocks, each breakpoint table) is an `h3` sitting directly under
the page title, with no `h2` naming what the panel contains. Navigating by heading gave
"Reference" followed by twenty artifact names and nothing saying where the artifacts began.

Fixed with an `sr-only` `h2` per panel. The active tab already states which panel is showing
**visually** — what was missing was the outline, so the fix changes nothing on screen.

Second, smaller finding in the same control: the five tab buttons announced **no state at
all**. Styling was the only signal of which panel was active. They now carry `aria-pressed`,
matching what the codex filter Chips already do. Deliberately *not* `role="tab"` — that pattern
promises arrow-key navigation this control does not implement, and claiming a role you do not
honour is what §3j.141 was about.

#### The audit was wrong before the code was

The first run reported **106 headings, 1 problem**. `/reference` renders one of five panels at
a time, so visiting the route once inspected **a fifth of it**. Walking every panel: **146
headings, 4 problems.** Same page, same code, four times the defects — and the single problem
the first run found would have been "fixed" in isolation while three identical ones survived.

That is the eighth time this session the denominator caught a check about to certify what it
had barely read, and the first time it caught one *I wrote under a standing rule telling me to
print it.* Printing it is not the same as reading it: 106 looked like a plausible number for
eight pages, which is exactly why it passed unexamined.

Final state: **151 headings across 12 panel-views, 0 problems**, both guards proven by removing
the code each covers.

#### Checked and clean

The other seven routes were already correct — one `h1` each, no skips, including the codex
drawer opened over the grid, where a second `h1` would have been easy to introduce.

### 3j.143 a queue, so that "Continue" converges instead of drifting

Not a defect pass. This makes the method durable, because the method had a gap that only shows
up under repetition: **each pass re-derived its target from memory.** Over one session that is
mild inefficiency; over a hundred it is drift, repeats, and eventually inventing work to do.

`AUDIT-BACKLOG.md` holds three lists — OPEN fronts, CLOSED fronts, DEFERRED decisions — and
"Continue" now means *take the top OPEN front*. Two properties make it worth having rather than
being another document to keep in sync:

- **Every CLOSED front records its denominator.** 33 fronts, each with what was checked and how
  much of it. "Checked the artifacts" is exactly the phrase that hid the fact that their
  *quotations* and *pictures* had never been looked at (§3j.134).
- **Every OPEN front states a specific question and a defect shape** before it can be worked
  on. A front that says only "accessibility" produces a pass that wanders.

Ten standing rules moved into `CLAUDE.md`, which is loaded every session and survives
compaction. Each has an incident behind it rather than being general advice: print the
denominator (§3j.126), verify the instrument before believing a block of defects (§3j.129),
never change a value that is correct (§3j.129 again, from the other side), assume a passing
breakage test means a weak mutation (§3j.116).

Three of the ten are new, and address failure modes that only appear over many passes:

- **A pass that finds nothing is a complete pass.** Commit the negative result, close the
  front, stop. The pressure that produced the forty-icon near-miss is the felt need to return
  a finding; making *nothing* a valid committable outcome removes it.
- **Guard the class, not the instance, and only when the class can recur.** There are ~25
  guards now. One protecting against a defect that cannot happen twice is pure upkeep and a
  future false failure.
- **When OPEN is empty, say so and stop.** Do not generate fronts. The honest continuations at
  that point are a game patch, a DEFERRED decision, or in-game observation.

#### The backlog is guarded, because every other document here has rotted

`reference.ts` called the Ambry codes wiki-sourced after they were brute-forced. `PLAN.md`
named the wiki as ground truth after the project stopped using it. `CLAUDE.md` documented three
local-only rules when there were ten. All three were true when written.

A backlog rots the same way, so the properties are asserted: all three sections present, every
OPEN front carrying a **Question** and a **Defect**, every CLOSED row carrying a number, and
`CLAUDE.md` pointing at it. Proven by adding a front with no defect shape.

That guard immediately found six CLOSED rows with no numeric denominator — written minutes
earlier, by me, under a rule requiring one. They now carry real counts.

---

### §3j.144 — Colour contrast: the first pass that measured a colour

Backlog front #1. **Question:** does every text/background pair in the dark theme meet WCAG AA
— 4.5:1 for body text, 3:1 for large text? **Defect:** a pair below ratio: readable to me on a
good monitor, unreadable to a low-vision user, and invisible to every check this project has,
because nothing here had ever measured a colour.

Method: walk every route and tab panel in a real browser and read **computed** styles, not
source classes. The theme is CSS variables through Tailwind, so what a class *says* and what
the browser *paints* are different questions, and only the second one matters to a reader.

**Denominator: 3362 text/background pairs across 13 panel-states. 80 failing nodes, 4 distinct
colour pairs, one root cause.**

#### The instrument was wrong twice, and its first result was a clean pass

The first run reported `FAILING: 0` over 2132 pairs and would have closed the front. It also
reported **1190 elements skipped as "no colour"** — 36% of all text on the site. A computed
`color` is never absent, so that number was the finding.

Tailwind v4 emits OKLCH, and Chromium reports colours resolved through `color-mix` as
`oklab(...)`. The regex `/rgba?\(...\)/` matched neither. On `/items` alone that is 590 text
colours and 263 backgrounds. The text ones were skipped and at least *counted*; the background
ones were silently treated as absent, so the walk continued past a real opaque layer and
compared against a fallback colour hardcoded in the script. **The clean pass was measured
against a page that does not exist.**

Replacing the regex with canvas normalisation, then self-checking it against known values,
found two more:

- `rgba(255,0,0,0.5)` came back as **`[508, 0, 0]`**. `getImageData` already returns
  un-premultiplied channels; dividing by alpha applied the correction twice.
- `"not-a-color"` came back as **opaque black** — an invalid value leaves `fillStyle` untouched,
  so every unparseable colour produced a confident wrong ratio instead of a skip. Now rejected
  by painting against two sentinels and requiring agreement.

Only after all three fixes did the sweep compare all 3322 pairs it had claimed to compare.

#### The finding: one token, dimmed

All 80 failures are `text-muted-foreground` with an **opacity modifier**. The base token
measures ~6:1 on our darkest surface — comfortably AA, with nothing to give away:

| Use | Measured | Needs |
|---|---|---|
| `text-muted-foreground/70`, 11px | **3.61–3.64:1** | 4.5 |
| `text-muted-foreground/80`, 11–12px | **4.31–4.36:1** | 4.5 |
| `group-hover:text-muted-foreground/60` | **~3.0:1** | 4.5 |

Confirmed by hand before acting (rule 3): `rgb(138,151,173)` at 70% over `rgb(14,22,38)`
composites to `(100.8, 112.3, 132.5)`, luminance `0.1609` against `0.00807`, ratio
`(0.1609+0.05)/(0.00807+0.05)` = **3.63**. The tool said 3.64.

Ten occurrences fixed by **dropping the modifier**, not by touching the palette — the design
tokens are fixed by `CLAUDE.md`, and the token was never the problem. Other tokens are far
brighter and their `/80`–`/90` uses all pass, which is why the guard names one token rather
than banning opacity modifiers wholesale.

The planner's `+goal` affordance was worse than anything the sweep could see: `/60` on hover,
**and** fully transparent until hover, so a keyboard user tabbing to it landed on a button with
no visible label. It now resolves to the full token and reveals on `focus-visible`.

#### Two mutations failed to fail, for two different reasons

Rule 5 says a passing breakage test means a weak mutation. Once again it did — but the second
time the diagnosis was different, and that is the useful part.

A deliberately-too-dark colour placed in `TierGrid`'s empty state **passed the entire suite**.
The mutation was not weak: the *sweep* was narrow. Every panel was visited at rest, and a
default visit to `/items` always has results, so "No items match…" had never been rendered
under measurement. Empty states, error states and anything behind an interaction were an
unmeasured class of UI. The sweep now drives the search box to an empty result, and the same
mutation is caught at 1.81:1.

The panel-count assertion then failed on its own when 12 panels became 13 — the denominator
guard proving itself without a mutation being needed.

#### What is guarded, and what is honestly not

`tests/contrast.spec.ts` asserts 0 failures **and** asserts its own denominators: 13 panels,
>2500 pairs compared, and **0 elements skipped for an unreadable colour** — that last one is
the tripwire for the instrument regressing to the state that produced the false clean pass.
Proven by reverting `parse` to rgb-only: 1110 skips, test fails.

It cannot see `hover:` or `focus-visible:` variants, which is exactly where the worst offender
lived. A static guard in `stacking.test.ts` covers that class by forbidding any opacity modifier
on `text-muted-foreground` in any state (`/0` stays legal — that is deliberate invisibility, not
low contrast). Proven twice: once on a plain `/70`, once on a hover-only `/60`.

Neither covers non-text contrast (icon glyphs, focus rings, chart strokes) — WCAG 1.4.11 rather
than 1.4.3. The test says so rather than letting its name imply otherwise (§3j.138).

---

### §3j.145 — Keyboard operability: reachability was sound, operating things was not

Backlog front #1. **Question:** can every control in the planner and the Stat Lab be reached
*and operated* by keyboard alone, in a sensible order? §3j.141 gave the item drawer a focus
contract and did not generalise it. **Defect:** a control reachable by mouse but not Tab, a
focus order that jumps, or an indicator nobody can see.

The structural read said this would be clean — every handler sits on a real `<button>` or
`<input>`, no `onClick` on a `<div>` anywhere. That is a prediction, not a result, so the page
was actually tabbed.

**Reachability is genuinely sound**, and the denominators are exact:

| | visible controls | disabled | Tab stops reached | order inversions | invisible focus |
|---|---|---|---|---|---|
| `/planner` | 447 | 2 | **445** | 0 / 443 | 0 / 445 |
| `/stats` | 60 | 14 | **46** | 0 / 45 | 0 / 46 |

Two counts derived independently — one by querying the DOM, one by pressing Tab — agreeing
exactly. A global `:focus-visible` outline covers everything; `.tier-card` replaces it with a
border and glow measuring **3.35:1** between focused and unfocused, which clears WCAG 2.2's 3:1
for focus indicators. Correct as written, left alone (rule 4).

#### Both defects were in what happens AFTER a control is used

Neither is visible to anyone holding a mouse.

1. **The planner's goal editor dropped focus on the floor.** Enter and Escape both unmount the
   input, the browser has nowhere to put focus, and it goes to `<body>`. On a page with 445 tab
   stops, setting one goal ejects a keyboard user to the top of the document. The *values* were
   always right — Escape really does discard — so this was purely the focus contract.

2. **Stepping a Stat Lab item down to zero ejected the user.** At `q === 0` the minus button
   became `disabled`, and disabling a **focused** element hands focus to `<body>`. Decrementing
   to zero is an ordinary thing to do. Now `aria-disabled`, which announces the same state
   without removing the button from the tab order — the WAI-ARIA pattern for exactly this. The
   cost is 14 extra tab stops on `/stats`, which is the right trade against ejecting the user.

#### The obvious fix for (1) was wrong in a way that looked right

Restoring focus inside the keydown handler means the *rest of that keystroke* lands on the
button just focused — and Enter on a focused button activates it. The editor committed, closed,
and instantly reopened:

```
render editing=false goal=3        <- commit worked
effect restoring focus             <- focus moves to the button
button onClick -> setEditing(true) <- the SAME Enter press activates it
```

It presents as "Enter does nothing", and a test that only asserted *where focus landed* would
have passed it. `preventDefault()` on the keydown is load-bearing, and the guard asserts the
editor is **closed** as well as where focus went.

Four mutations, each reverting one fix: `disabled` back on the stepper (focus → BODY),
`preventDefault` removed (editor reopens), focus restore removed (both goal tests fail),
`tabIndex={-1}` on a stepper (60 enabled controls, 46 reached). All four caught.

#### Instrument corrections, again before any finding was believed

- **~100 "backward jumps" in focus order on the planner were a grid artifact.** Within a card
  the cycle button sits above its Details link, so advancing to the next card in the same row
  always reads as a jump upward — correct reading order. Comparing against **DOM order**
  instead gives 0 inversions over 443 stops.
- **A hardcoded cap of 250 Tab presses** made every stop past it on the 445-control planner
  look like an unreachable control. The cap is now derived from the page.
- **`outline: none` is not the same as no focus indicator.** Tailwind rings are `box-shadow`
  and `.tier-card` uses a border and glow. The check is now a before/after diff of every
  property a focus indicator could plausibly use.
- **The planner rail renders no per-item controls until something is in the plan**, so the goal
  editor did not exist in any default page visit. Same shape as the empty-state gap in §3j.144:
  the interesting controls live behind state.

#### Found, not fixed: `title` as the only home for an explanation

25 `title=` attributes across 13 components carry real content — "Formula confirmed against the
decompiled game code", "Stacks past N have no effect at all — a goal of G wastes W". The
`title` attribute is invisible to keyboard users, unreliable for screen readers, and absent on
touch. Fixing it properly means a real tooltip component (focusable, `aria-describedby`,
dismissible per WCAG 1.4.13) across 13 files, which is a new UI surface and therefore a scope
decision rather than a correction (rule 9). Logged as an OPEN front with its denominator.

---

### §3j.146 — Error paths: what a user sees when something is wrong

Backlog front #1. **Question:** what does a user *see* when something fails — not when it
works? Every check before this one exercised the success path. **Defect:** a blank page, an
uncaught throw, or silent nonsense where a readable message belonged.

Four surfaces, all four probed in a real browser: corrupted `localStorage`, unknown routes,
mangled share links, and icons that do not arrive.

#### The sanitiser was correct, was unit-tested, and never ran

`sanitizeEntry` is reachable only through `migrate`, and zustand calls `migrate` **only when the
stored version differs from the current one** — `middleware.js` returns
`deserializedStorageValue.state` straight to `merge` on a version match. `version` has been 2
for a long time, so the validation this file documents at length ran on legacy data and on
shared links, and never on the ordinary load.

The existing suite hid it rather than catching it. It proved the v2 path with
`migrate(v2data, 2)` — a call the library never makes. **A pure-function test of a function
nothing calls passes forever.**

Probing v2 storage directly, in a browser:

| stored under version 2 | what rendered |
|---|---|
| `goal: 1e20` | **`×100000000000000000000`** — the exact value MIN_GOAL/MAX_GOAL exist to stop |
| `priority: "ULTRA"` | targeted item with **no priority label at all** |
| `crowbar: 42`, `null`, `{state:"nonsense"}` | silently dropped (correct, by luck — the rail filters on a valid `state`) |
| `plan` as array / string, non-JSON blob | empty plan, no throw |

Fixed by sanitising in **`merge`**, which runs on every hydrate regardless of version.
`railMode` was never validated anywhere either and is now clamped to the two values the rail
can render.

#### There was no 404

`/nonsense` rendered the two unstyled words **"Not Found"** — TanStack Router's built-in
default, i.e. what you get when nobody writes one. No heading, no styling, no way back, and no
`h1`, which the heading guard never noticed because it only ever visits URLs that exist.

The pattern already existed one route over: `/survivors/nobody` said *"No survivor called
'nobody'"* with a link home. It had simply never been applied to the case that catches every
mistyped, stale or truncated URL.

**`/items/not-a-real-item` was worse, because it looked fine.** `ItemDetail` returns `null` when
it has no item, so the page rendered byte-for-byte like `/items`: someone following a dead link
was told their item does not exist by being shown 217 items that are not it. It now says so, in
the drawer's own position, with the codex still behind it.

#### Sound already, with denominators

- **Share links.** `?p=%%%broken%%%`, 3000 characters of `A`, `{"a":1}`, empty `?t=`, and
  `?t=crowbar*99999999999999999999` — all render, none throw, and the 1e20 goal is rejected.
  `importPlan` sanitises, and always did.
- **Icons.** 10 `<img>` across 8 components: two use `alt={item.name}` (the grid cards, where
  the icon *is* the identification), eight use `alt=""` with the name adjacent in text. With
  every `.png` forced to 404, the codex still renders and still names every card.

#### Two lessons about the guards themselves

**A mutation that does not apply looks exactly like a guard that works.** Removing the `merge:`
line by a pattern ending in `
` silently matched nothing — the file is CRLF, so the text is
`}),
`. The suite passed and briefly looked like proof. Rule 5 says to assume the mutation
was too weak before believing the guard, and this is the most literal case of that yet: the
mutation was not weak, it was absent. Re-run with `?
`, removing `merge` fails 2 tests.

**A guard fired on this pass's own work, correctly, and was still wrong.** The unscoped
negative-claim rule flagged `NotFound.tsx` for the words "not found". That rule is about
sentences telling a reader something is absent *from the game*, published with the authority of
a stacking row; a 404 heading says a URL is absent from this site. Rewording the 404 to dodge
the regex would have left the rule still wrong for whoever writes the next one, so the exception
is named, explained, and capped at two entries.

Three mutations, each reverting one fix, all caught: no `merge` (2 fail), no
`notFoundComponent` (3 fail), no item-not-found branch (1 fail).

---

### §3j.147 — Dependency and bundle health: the site was broken in production

Backlog front #1. **Question:** is anything shipped that shouldn't be, and is anything
vulnerable or unmaintained? **Defect:** a known CVE reachable at runtime, script-only code
leaking into the client bundle, or a payload large enough to matter on a phone.

The front's own three defect shapes came back: one real, one clean, one clean. The serious
finding was none of them, and it was sitting in the build output all along.

#### The deploy served GitHub's 404 for five of its own routes

`.github/workflows/deploy.yml` publishes to **GitHub Pages**, which is a plain static file
server: it resolves `/planner` by looking for `dist/planner/index.html`, and there are no
rewrite rules. The SPA fallback this repo carries is `public/_redirects` — a **Netlify and
Cloudflare** convention that Pages ignores completely. There was no `404.html` either.

Mapping the built tree against the router:

| route | file in `dist/` |
|---|---|
| `/` | present |
| `/items/<id>` | present — 217, from the OG prerender |
| `/survivors/<id>` | present — 19 |
| `/items`, `/planner`, `/stats`, `/reference`, `/survivors` | **nothing** |

`/` worked because its redirect to `/items` is client-side and never touches the server. Item
and survivor pages worked by accident, because the OG prerender happens to write a file at
exactly the path the router uses. Everything else returned GitHub's own 404 on refresh or on
any link someone shared — **including every URL the planner's "Copy link" button produces**,
which is the one feature whose entire purpose is being pasted somewhere else.

It was invisible locally because `vite dev` and `vite preview` both provide an SPA fallback,
and invisible to the whole browser suite because Playwright drives that same dev server. Only
the built `dist/` tree says what Pages will actually serve. Fixed by prerendering the five
section routes and a `404.html` catch-all — which now lands on the app's own 404 from §3j.146
rather than GitHub's.

#### Four advisories, none of them runtime

`pnpm audit`: **3 high, 1 moderate** — two `postcss` path-traversal issues and two `nanoid`
infinite-loop issues. Every path ran through `vite`, a devDependency, so none was reachable by
a browser; all four were the lockfile pinning old transitives inside ranges that already
allowed the fixes. `postcss@8.5.16 → 8.5.26`, `nanoid@3.3.15 → 3.3.18`, **0 known
vulnerabilities**.

#### What was already sound, with denominators

- **Nothing script-only ships.** `zod` is entirely absent from the bundle (0 hits for `zod`,
  `ZodError`, `invalid_type`) — `schema.ts` uses it, but only the audit scripts import that
  module's runtime half. `marked` is absent too despite being a dependency of the parked guides
  layer: its 3 apparent hits are the game's own prose, "Enemies with 4 or more debuffs are
  **marked** for death". Tree-shaking handles both.
- **No dev leakage.** 0 sourcemaps, 0 `console.log`, 0 `debugger`, 0 `process.env`, 0 `__vite`
  across the built bundle. The single `localhost` hit is TanStack Router's own origin fallback.
- **Size is fine, and the interesting number was not the one the warning points at.** 722.5 kB
  raw / **214.9 kB gzip**, of which the data is ~72.5 kB gzip (items.json 68.1). The icons are
  4.1 MB across 217 files — 20× the JS — but every grid `<img>` already carries
  `loading="lazy"`, so first paint fetches only what is on screen. Checked rather than assumed.
- **One genuinely unused dependency.** `class-variance-authority`: zero references in `src/`,
  `scripts/`, `tests/` or config, and absent from the bundle. A leftover from the shadcn/ui
  scaffold. Removed. `react-dom` was flagged by the same sweep and is a **false positive** — it
  is imported as `react-dom/client`, and the pattern demanded an exact specifier.

#### The guard is against the class, not the instance

"Add a route, forget the prerender" recurs every time the router grows. The guard reads
`router.tsx`, extracts every static path, and asserts `prerender-og.mjs` covers each — plus the
`404.html` catch-all and the two data-driven loops. Proven twice: renaming the prerendered
`stats` entry fails it, and adding a new `/loadouts` route with no prerender fails it with the
route named.
