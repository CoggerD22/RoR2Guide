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

Each entry names the **specific question** — not "is it right" — and what a defect would look
like. A front without those two things is not ready to work on.

### 1. Responsive layout
**Question:** at 360px wide, is anything unreachable or overlapping?
**Defect:** the codex filter row, the planner rail, or the Stat Lab's two-column layout
clipping content with no scroll.

### 2. `prerender-og` output
**Question:** the build writes 217 item + 19 survivor + 5 section + 404 + home pages. §3j.147
established they are PRESENT and that the router agrees. Is the metadata inside them correct?
**Defect:** wrong title/description per page, a stale template, or absolute URLs pointing at
the wrong origin.

### 3. Interaction and error states, beyond contrast
**Question:** §3j.144 measured 13 panel-states and found that every route had only ever been
examined *at rest*. Which other states does no check ever render?
**Defect:** the shape already proven once — a defect placed in `TierGrid`'s empty state passed
the whole suite. Candidates: loading, empty planner, empty Stat Lab, an item with no stacking
rows, a survivor with no unlock.
**Note:** this is a *coverage* front, not an a11y one. Fold new states into
`tests/contrast.spec.ts` and `tests/headings.spec.ts`, which both take a state list.

### 4. `title` as the only home for an explanation
**Question:** 25 `title=` attributes across 13 components carry real explanatory content
("Formula confirmed against the decompiled game code", "Stacks past N have no effect at all").
`title` is invisible to keyboard users, unreliable for screen readers, and absent on touch. How
much of that content exists nowhere else?
**Defect:** an explanation only a mouse user can reach. Some already have an `aria-label`
sibling; some do not, and some sit on non-focusable `<span>`s.
**Note:** partly a SCOPE decision (rule 9) — a real tooltip component (focusable,
`aria-describedby`, dismissible per WCAG 1.4.13) is a new UI surface. A subset can be fixed
without one. §3j.145.

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
3. **In-game observation.** Behaviour under real play. Everything reachable by reading code and
   assets has been read; nothing here substitutes for holding the item and watching the number.
   §3j.98.

---

## When OPEN is empty

Say so and stop. Do not generate fronts to keep going. The honest continuations at that point
are a game patch (which the enforced cross-checks will surface), a decision from the DEFERRED
list, or in-game observation.
