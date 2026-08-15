# Audit backlog

The queue behind `Continue`. **Take the top OPEN front, do one pass, update this file in the
same commit.** Findings and reasoning go in `MATH-VERIFICATION.md`; this file only tracks
*what has been looked at, with what question, and how much of it*.

Why it exists: after ~140 log entries there was no index of **fronts examined and exhausted**,
only of defects found. That meant each pass re-derived its target from memory, which drifts,
repeats, and eventually invents work. A denominator is recorded for every closed front so
"checked" can never mean "glanced at" (§3j.126, §3j.142).

---

## OPEN

**Empty.** Every front raised in this queue has been examined with a stated question and a
recorded denominator; see CLOSED below.

Per rule 10, this is where the queue stops rather than where new fronts get invented. The honest
continuations from here are:

1. a **game patch** — the enforced cross-checks and the `.gamedata/` staleness gate will surface
   it (§3j.148), and `pnpm data:verify` fails rather than passing quietly;
2. a decision from **DEFERRED** below, each of which is a scope change a human should make;
3. **in-game observation** — behaviour under real play, which nothing here substitutes for;
4. **`pnpm data:mutate`** — the standing way to ask "what can change without anything
   noticing?" rather than re-deriving a surface to audit. Add a mutation when a new kind of
   claim ships; a survivor is a real hole, and both holes it found on its first run were in
   surfaces already marked CLOSED.

A new front belongs here when something real prompts it: a patch, a bug report, a decision taken
from DEFERRED. Not to keep the queue populated.

---

## CLOSED

Closed means: examined with a stated question, denominator recorded, and either fixed or
found sound. **Do not reopen without a genuinely different question** — that is what found
SweetSpot cliffs and the proc gap in already-"checked" data.

| Front | Denominator | Outcome | Ref |
|---|---|---|---|
| Item numbers & formulas | 217 items, 208 code/asset-traced | ratcheted by `coverage-floor.json` | §6A |
| Item proc coefficients | 43/43 attack rows | closed from 8/41 | §3j.117–122 |
| Damage chains vs prefab multipliers | 6 named projectiles | **2 real errors** (Resonance Disc 4×, Boomerang 124%) | §3j.119–120 |
| Stacking `type` classification | 291 rows | all correct | §3j.127 |
| Item tier + DLC | 217/217 | all correct, now enforced | §3j.130 |
| Equipment cooldowns | 41/41, two independent extractors | all correct, now enforced | §3j.126, §3j.130 |
| Icon file integrity | 237 files, magic bytes | **2 were HTML error pages** | §3j.129 |
| Icon identity (items) | 217/217 rank test | all correct; 40 false alarms rejected | §3j.129 |
| Icon identity (artifacts) | 20/20 | all correct | §3j.134 |
| Void corruption pairs | 31/31, both directions | complete | §3j.132 |
| Survivor roster | 19/19 by `cachedName` | complete, now enforced | §3j.136 |
| Survivor base stats | 19 × 10 fields vs prefabs | correct; `acceleration` added | §3j.121, §3j.124 |
| Flat-stat assumptions | 6 stats (armor, atk spd, crit, move, jump, shield) | correct *by luck*, now enforced | §3j.121, §3j.124 |
| Skill completeness | 19 loadouts / 125 skills | complete, Heretic divergence pinned | §3j.132, §3j.136 |
| Skill proc provenance | 125 skills | 0 genuinely unknown | §3j.115 |
| Item unlock gating | 49/49 | correct | §3j.128 |
| Skill unlock text | 51/51 verbatim | correct | §3j.135 |
| Artifact mechanics | 20/20 | **3 records incomplete** | §3j.113 |
| Artifact effect text | 20/20 verbatim | correct | §3j.134 |
| Shrine costs | 12/12 prefab-derived | **2 errors** (Blood 93%, Chance per-attempt) | §3j.114 |
| Shrine descriptions | 12/12 verbatim | correct | §3j.134 |
| Ambry codes | 19/19 brute-forced, 16/16 attributed | correct; **4 tooling bugs** | §3j.133 |
| Bazaar dreams | 31/31 verbatim + stage attribution | correct | §3j.135 |
| Stat engine vs `RecalculateStats` | 8 stat targets, 14 modelled items, both armor branches | sound | §3j.121 |
| Application logic | 13 lib modules + planner store; 21 new tests | **1 real bug** (1-char search) | §3j.123 |
| Verbatim item descriptions | 217 vs language files | **1 rewritten** (Preon) | §3j.125 |
| Component prose vs data | 4 duplicated claims | correct; duplication removed | §3j.125 |
| Guard coverage & denominators | 4 population guards + 3 audit rules | **5-rung ladder of defects** | §3j.109–139 |
| CI + deploy gating | 2 workflows, 17 steps | **browser tests didn't gate deploy** | §3j.139 |
| Documentation accuracy | 3 documents, 6 stale claims | **wiki named as ground truth** | §3j.138, §3j.140 |
| Modal focus management | 1 dialog, 3 required behaviours | **no focus handling at all** | §3j.141 |
| Heading outline | 151 headings / 12 panel-views | **h1→h3 on 4 panels** | §3j.142 |
| Colour contrast (WCAG AA) | 3362 pairs / 13 panel-states | **80 nodes below AA**; instrument wrong twice first | §3j.144 |
| Keyboard operability | 447+60 controls, 491 tab stops, 4 mutations | **2 focus-loss bugs**; reachability sound | §3j.145 |
| Error paths | 4 surfaces, 21 browser tests, 3 mutations | **sanitiser never ran; no 404; unknown item silent** | §3j.146 |
| Dependency & bundle health | 11 deps, 203 transitive, 215 kB gzip, 243 built pages | **5 routes 404'd in production**; 4 CVEs | §3j.147 |
| Extractor swallows & verify gating | 28 scripts, 83 handlers, 78 silent; 5 live | **all 7 cross-checks exited 0 on failure**; stale inputs passed | §3j.148 |
| Responsive layout at 360px | 13 panel-states, 11,725 nodes | **7 of 13 scrolled sideways**, 3 unrelated causes | §3j.149 |
| prerender-og metadata + built tree | 243 pages, 10 browser tests on `dist/` | metadata sound; **nothing had ever loaded the build** | §3j.150 |
| Unrendered UI states | 17 ItemDetail branches, 13 reachable | **every sweep used one item**; 4 branches dead | §3j.151 |
| Hover-only `title` content | 23 attributes / 13 components, 77 rendered | mostly duplicated; **proc provenance is hover-only** → DEFERRED | §3j.152 |
| Tap-target size (WCAG 2.5.8) | 2249 targets / 16 panel-states | **31 raw -> 4 real**; one invisible on touch | §3j.153 |
| Mutation sweep (what survives?) | 28 mutations x 6 gate stages, local + CI | **2 holes**; 61 non-verbatim descriptions found | §3j.154 |
| Hover-only affordances on touch | 2700 controls / 17 panel-states | **3 more found by the new guard**; instrument wrong 3 ways | §3j.155 |
| CI/deploy parity & ordering | 2 workflows, 6 gate stages | **deploy failing since §3j.150**; 404 overwritten | §3j.156 |
| Mutation sweep: application logic | 11 code mutations, 14 lib/store modules | **3 holes**; `stacking.ts` had no test | §3j.157 |
| Mutation sweep: schema & stores | 8 mutations, 29 schema constraints | **schema had 0 negative tests**; §3j.146 defect unfixed in display | §3j.158 |
| Verbatim descriptions, part paid | 61 sized: 29 pure / 29 numeric / 3 prose | **29 restored, 0 facts lost**; 32 remain | §3j.159 |
| Extractor health | 1472 bundles, 224,435 MonoBehaviours | all swallow classes 0 | §3j.127 |

---

## DEFERRED — awaiting a decision, not a pass

These are **scope changes, not corrections**. Nothing on the site is wrong because of them.

1. **Publish steal-immunity and the other blacklist mechanics.** `ItemStealController` gates on
   `AIBlacklist`/`BrotherBlacklist`: **55 of our items cannot be taken by Mithrix**. Same
   family: `RebirthBlacklist` (7), `CannotSteal` (12), `CannotDuplicate` (9),
   `CommandArtifactBlacklist` (2), `DevotionBlacklist` (4), `SacrificeBlacklist` (1),
   `Cleansable` (2). Publishing means a schema field, 217 records, a UI surface, a `PLAN.md`
   entry and a guard. §3j.131.
2. **Opinion layer.** Built and parked (`src/components/guides/`, `src/content/guides.ts`,
   `content/guides/_template.md`; `src/router.tsx` documents re-enabling). The missing piece is
   written guides, and rule #7 means a human writes them.
3. **Publish proc-coefficient provenance outside a tooltip.** `SkillProcPanel` and
   `SurvivorDetail` show the proc number visibly and keep "game code (attack default 1.0)" /
   "game asset (skill config)" in a `title` — hover-only, so invisible to keyboard and touch.
   Provenance is the site's whole claim to authority, so this is the one hover-only class worth
   publishing. Needs **either** a real tooltip component (focusable, `aria-describedby`,
   dismissible per WCAG 1.4.13) **or** a new visible column in the proc table — both new UI
   surfaces, hence a decision rather than a correction. `aria-label` on the existing `<span>`s
   is not a shortcut: on `role=generic` it is widely ignored by real AT. §3j.152.
4. **Restore the remaining 32 non-verbatim item descriptions.** §3j.159 paid the safe half:
   29 were pure rewordings stating no number the game omits, restored verbatim with 0 facts
   lost. The **29 that remain state a number the game's own text does not** (Predatory
   Instincts 5, Unstable Transmitter 60, Strides of Heresy 0.2/1.3/19.5, The Back-up 100),
   plus 3 with materially longer prose. Each is either a verified fact the game omits — fix is
   to restore the quotation and move the fact into `descriptionNote` — or a number tracing to
   nothing, which is a rule #1 violation. Deciding which needs the decompile, per item. Ratchet
   pinned at 32. ORIGINAL FRAMING BELOW, kept because the reasoning that deferred all 61 was
   only true of some of them:
   `schema.ts` documents `description` as "the game's wording, kept verbatim", rule #1 says
   quoted text is "reproduced verbatim, typos included", and `ItemDetail` tells the reader "The
   game's text above is inaccurate" — a sentence that only means anything if the text above is
   the game's. **61 of 217 differ with no `descriptionNote`** (3 punctuation-level, 58
   substantive), verified by hand against the raw language tokens. A mass restore is NOT safe:
   Predatory Instincts' 5% crit chance is in no stacking row, so replacing its description with
   the game's would delete a verified fact from the page. Each needs a researched
   `descriptionNote` against the decompile, which is per-item verification, not an edit. Pinned
   at 61 by `game-facts-baseline.json` so it cannot grow. §3j.154.
5. **In-game observation.** Behaviour under real play. Everything reachable by reading code and
   assets has been read; nothing here substitutes for holding the item and watching the number.
   §3j.98.

---

## When OPEN is empty

Say so and stop. Do not generate fronts to keep going. The honest continuations at that point
are a game patch (which the enforced cross-checks will surface), a decision from the DEFERRED
list, or in-game observation.
