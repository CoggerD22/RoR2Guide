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
