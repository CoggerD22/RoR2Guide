# CLAUDE.md — RoR2 Companion

Fan-made Risk of Rain 2 companion site. Read `PLAN.md` in full before doing anything;
it is the source of truth for scope, schema, and milestones. Work milestone by
milestone (M0 → M6) and do not pull in future-phase features early.

## Non-negotiable rules

1. **Never invent game data.** The rule is unchanged; its SOURCES are not what this
   line used to say. It named riskofrain2.wiki.gg first and the language files as "the
   game", which PLAN §6A.2 has since inverted — the wiki is authoritative for **nothing
   on its own**, and a language file proves what the game *says*, never what it *does*
   (§5.0.1). Both remnants were still here after the whole dataset had moved off them
   (MATH-VERIFICATION §3j.140).

   Every stat and formula in `/src/data` must trace to the game's own **code**
   (`.decompiled/`) or **serialized assets** (`.gamedata/`), and carries a `confidence`
   tag recording which. Language files are for quoted TEXT — names, pickups,
   descriptions — reproduced verbatim, typos included. The wiki is a lead to chase and a
   cross-check to argue with, never a source of record; icons are the one exception,
   because the file is the artefact and asserts nothing.

   `items.json` currently has **zero** `verified: false` entries, so a new one is a
   signal, not a placeholder: prefer leaving a value out over shipping a
   plausible-sounding number, and never let a gap look like a fact.
2. **The game has 3 DLCs as of 2026**: Survivors of the Void, Seekers of the Storm,
   Alloyed Collective (Nov 2025). Training-data knowledge of item counts, survivors,
   and balance is stale — verify against the game's own defs, not against memory and not
   against the wiki. `pnpm data:verify` counts items, equipment, survivors and skills
   from ItemDef/EquipmentDef/SurvivorDef every run and fails if any drifts.
3. **Stacking is an array, not an enum.** Items can have multiple stats with
   different stacking types (see Fuel Cell). Don't flatten the schema.
4. **Void corruption pairs must be bidirectional** and validated (audit script fails
   on dangling references).
5. **No backend.** Static JSON + client state only. Don't add servers, databases, or
   auth. Planner state lives in localStorage via Zustand persist.
6. Keep the non-affiliation disclaimer in the footer; this is a non-commercial fan
   project and all game assets belong to Gearbox Publishing.
7. **Facts and opinions never mix.** Mechanical data (numbers, formulas, unlocks,
   survivor-specific item behavior) is fact and lives in the JSON datasets.
   Recommendations, build guides, and tier content are opinion: they live in
   `/content/guides/*.md`, are always badged "Opinion" in the UI, and carry
   author + date + game patch version so they visibly go stale. Never write
   ranking or "best item" language into `items.json` or codex UI copy.

## Stack & conventions

- Vite + React + TypeScript (strict), Tailwind v4, shadcn/ui, Zustand, Fuse.js,
  TanStack Router, Zod for data validation.
- Package manager: pnpm.
- Commands (once scaffolded): `pnpm dev`, `pnpm build`, `pnpm typecheck`,
  `pnpm data:audit` (schema + integrity checks over /src/data), `pnpm test`,
  `pnpm test:unit` (stat-engine vitest), `pnpm data:diff` (numbers vs game language
  files), `pnpm data:verify` (Stat Lab coefficients vs decompiled RecalculateStats,
  and survivors.json vs the body prefabs).
- Ground truth beyond the language files comes from the game install, via two local,
  git-ignored extractors (never commit their output — it's Gearbox's data):
  `scripts/decompile.sh` → `.decompiled/` (C#: formulas/coefficients. Before claiming
  something is absent from "the game code", scan every `Managed/*.dll` for the identifier
  rather than only the decompile — a cross-assembly reference stores the member name in the
  referencing assembly, so one grep over 143 DLLs settles it. `Assembly-CSharp.dll` looks
  like a second source of RoR2 code but is type-forwarders and middleware only, §3j.107) and
  `scripts/extract-bodies.py` → `.gamedata/` (Unity prefabs: survivor base stats,
  which are NOT in RoR2.dll). Re-run both after a game patch, then `pnpm data:verify`.
  Also run `python scripts/check-extractor-health.py` after a patch or a UnityPy upgrade:
  the extractors swallow load/read exceptions by design, and a skipped bundle looks
  identical to a game that contains less. It reports 0 for every swallow class today
  (1472 bundles, 224,435 MonoBehaviours) — a non-zero count invalidates the "complete
  input" assumption behind everything in `.gamedata/`.
- Data files: `/src/data/items.json`, `/src/data/survivors.json`, schemas in
  `/src/data/schema.ts`. Icons in `/public/icons/<id>.png`.
- Commit data work tier-by-tier (one tier per PR/commit) so it can be spot-checked
  against the in-game logbook.

## Audit method

`AUDIT-BACKLOG.md` is the queue. **"Continue" means: take the top OPEN front, do one pass,
update the backlog in the same commit.** These rules exist because each one has a specific
incident behind it in `MATH-VERIFICATION.md` — they are not general advice.

1. **State the target before touching anything**: the surface, the *specific question* being
   asked of it (never "is it right" — that one is exhausted), and what a defect would look
   like. Asking a different question of already-checked data is what found the SweetSpot
   cliffs, the proc gap and the tier/DLC values (§3j.109, §3j.117, §3j.130).

2. **Every check prints its denominator.** "0 mismatches" and "0 of 41 compared" must never be
   the same output. Eight times in one session a check was about to certify a dataset it had
   barely read; the count caught every one (§3j.126, §3j.142).

3. **Verify the instrument before believing a block of defects.** A dataset this heavily
   checked does not fail forty at a time. Confirm one finding by hand first — the icon
   comparison reported 40 mismatches and all 40 files were correct (§3j.129).

4. **Never change a value that is correct.** If the data is right and the tooling, prose or
   documentation around it is wrong, fix that and say so. Most recent findings have been in
   the apparatus, not the dataset.

5. **Prove every new guard by deliberate breakage.** If the mutation passes, assume the
   mutation was too weak rather than that the guard works — that assumption has been right
   four times out of four (§3j.116, §3j.122).

6. **A pass that finds nothing is a complete pass.** Commit the negative result, close the
   front, stop. Do not open a second front to salvage it. "Checked X, found nothing" belongs
   in the log and the commit message. Two consecutive empty passes on related fronts means
   that area is exhausted — say so.

7. **Guard the class, not the instance**, and only when the class can recur. A guard against a
   defect that cannot happen again is upkeep and future false failures for no cover.

8. **Full gate before every commit**: `typecheck`, `test:unit`, `data:audit`, `data:diff`,
   `data:verify`, `playwright`, `build`. One pass per commit, pushed separately, with the
   reasoning in the message.

9. **Stop and ask only for scope changes** — a new schema field, a new UI surface — not for
   corrections. See DEFERRED in the backlog for what that looks like.

10. **When OPEN is empty, say so and stop.** Do not generate fronts to keep going. The honest
    continuations then are a game patch, a decision from DEFERRED, or in-game observation.

## Design tokens

Dark space-blue theme. Base surfaces `#0b1220`–`#101826`, luminous cyan-blue accent
for interactive elements, tier colors reserved for item identity only:
common `#e8e8e8`, uncommon `#77ff8b`-family green, legendary `#ff5c5c`-family red,
boss `#ffd93d`, lunar `#66ccff`, void `#c974ff`, equipment `#ff9c3f`.
(Confirm exact tier hex values against in-game UI during M2 and record final tokens
here.) Tooltips replicate the in-game item tooltip: dark panel, subtle border, icon
left, bold white name, gray body with highlighted numeric values.

## Working style

- Data entry is from the game, not from pages: numbers come from the decompile and the
  serialized assets, quoted text from the language files verbatim (typos included). If the
  wiki is consulted at all it is to find something worth verifying, and the verification is
  what ships.
- After each milestone, update the "Status" section below.

## Status

- [x] M0 skeleton
- [x] M1 data: whites + greens
- [x] M2 codex UI
- [x] M3 run planner
- [x] M4 data complete
- [x] M5 stat lab
- [x] M6 reference pages (artifacts, bazaar dreams, shrines; loadout unlocks → Phase 4)
- [x] Math verification pass (see `MATH-VERIFICATION.md` for the full log)
      - Stat engine rebuilt against the decompiled `CharacterBody.RecalculateStats()`;
        two real bugs fixed (item regen scales with level; Irradiant Pearl also grants crit).
      - items.json 100% verified (0 `verified:false`), of which **208/217 are traced to
        code or assets**; the remaining 9 are 4 quest items with no mechanic, 2 equipment
        fully described by `consumedOnUse`, and 3 open questions each carrying the exact
        arithmetic that would settle them. `coverage-floor.json` ratchets this and
        `data:audit` fails if it drops. Survivors verified field-by-field against the body
        **prefabs** (190/190) — those values are NOT in RoR2.dll.
      - Artifact + shrine numbers confirmed against their behavior classes **and their
        prefabs** — the behaviour classes alone are not enough, since `maxPurchaseCount`,
        `costMultiplierPerPurchase` and the drop weights are all serialized (§5.0.2). Note
        the scope of "numbers": confirming every figure in a record says nothing about
        whether the record mentions everything the code does, and re-reading all 13 artifact
        managers found three that did not (§3j.113). Shrine costs are prefab-derived, not
        editorial; 6 of 12 shrines carry a verified mechanic (§3j.114).
      - `pnpm data:verify` runs in CI, but what it can prove THERE is narrower than the
        name suggests: its seven game cross-checks all need the git-ignored extractions, so in
        CI they skip and only the transcribed truth tables are compared. It now says so
        (§3j.138). Locally, with the game installed, all seven run.
      - Every record carries a `confidence` tag (code > asset > langfile > wiki),
        badged in the codex. Nothing is wiki-only any more.
      - Proc coefficients: `src/data/skills.json`, **106/125** loadout skills verified with
        provenance, surfaced in the Stat Lab. The other **19 have no damage path at all**
        (dashes, stance swaps, turret placements) and are labelled "no direct damage" rather
        than unverified — **0 skills are genuinely unknown** (§3j.47, §3j.64).
      - ITEM attacks now carry the same: **43/43** rows describing an item-fired attack state
        the rate that attack procs at, and they are not uniform — 0 (Brilliant Behemoth,
        Gasoline, Kjaro's tornado), 0.1, 0.2, 0.5, 0.7, 1.0. Runald's Band procs at 1.0 and
        Kjaro's at 0, which no description hints at (§3j.117, §3j.122). Projectile rates are
        a PRODUCT of two serialized prefab fields, neither in the C# (§3j.118).
      - Two published damage figures were wrong by whole multiples, both from a coefficient
        applied on a prefab AFTER the one in code: **Resonance Disc detonates for 4000%, not
        1000%** (the record had published the intermediate projectile damage), and Electric
        Boomerang's slice is 124%, not 120% (§3j.119, §3j.120). `scripts/resolve-state-refs.py`
        follows EntityStateConfiguration prefab pointers, which is what settled the first.
      - Survivors: `acceleration` added, the one base stat that varies across the roster and
        appeared on no page — MUL-T 30, Artificer 40, False Son 50, the rest 80 (§3j.124).
        Six stats modelled as flat (armor, attack speed, crit, move speed, jump power, shield)
        are scalable in `RecalculateStats` and correct only because every `level*` field is
        currently zero; `data:verify` now fails if any becomes non-zero (§3j.121).

- [x] Application audit — the code, not the data. `search.ts` returned **zero items for any
      one-character query**, so the first keystroke of every search rendered an empty codex;
      short queries now take a deterministic name-prefix path. `planUrl`, the planner store,
      `highlightNumbers` and `statMath` were read and found sound, with one latent formatter
      case hardened. `search.test.ts` and `survivorDetail.test.ts` are new (§3j.123).
- [x] §9 surface audit — every page and component read with "what does a reader conclude?"
      asked explicitly (`PLAN.md` §9). Findings and method in `MATH-VERIFICATION.md`
      §3j.58–§3j.98. Notable: the Stat Lab was a second unaudited implementation of the
      game's arithmetic; "N base, +M per stack" was false on 28 non-linear rows; four shared
      terms every formula depended on had never been defined.
- [x] Error paths — what a user sees when something is **wrong**, a question nothing had asked.
      Three defects. The planner's `sanitizeEntry` was correct, unit-tested, and **never ran**:
      zustand calls `migrate` only on a version *mismatch*, and version has been 2 for a long
      time, so a stored `goal` of 1e20 rendered `×100000000000000000000` — the exact value
      `MIN_GOAL`/`MAX_GOAL` exist to prevent. Sanitising now happens in `merge`, which runs on
      every hydrate. There was **no 404** (TanStack's bare "Not Found", no heading, no way back)
      even though `/survivors/nobody` had done it properly all along; and `/items/<unknown>`
      rendered the whole codex silently, telling a reader their item did not exist by showing
      217 that were not it. Share links and missing icons were already sound, with denominators
      (§3j.146). **The lesson worth keeping: a pure-function test of a function nothing calls
      passes forever** — the suite "proved" the v2 path by calling `migrate(data, 2)` directly,
      which the library never does.
- [x] Keyboard operability — planner and Stat Lab tabbed for real, not read. Reachability was
      **sound and is now pinned**: 447 and 60 visible controls, 445 and 46 tab stops, counts
      derived two independent ways and agreeing exactly; 0 focus-order inversions against DOM
      order; 0 controls without a visible focus indicator. Both defects were in what happens
      *after* a control is used, and neither is visible with a mouse: committing a planner goal
      dropped focus to `<body>` (on a page with 445 tab stops), and stepping a Stat Lab item to
      zero did the same, because disabling a **focused** element ejects focus. The stepper now
      uses `aria-disabled`. Note the trap in the obvious fix — restoring focus inside a keydown
      hands the rest of that keystroke to the newly-focused button, so the editor committed,
      closed and instantly reopened; `preventDefault()` is load-bearing and the guard asserts
      the editor is *closed*, not merely where focus went (§3j.145).
- [x] Accessibility — three passes, each a separate class. The item drawer claimed
      `aria-modal` and managed no focus (§3j.141); the heading outline skipped a level on 4 of
      5 reference panels (§3j.142); and **colour contrast had never been measured at all**
      (§3j.144). 3362 text/background pairs across 13 panel-states now meet WCAG AA; 80 nodes
      did not, every one of them `text-muted-foreground` dimmed by an opacity modifier to
      3.6–4.4:1. The token is fine at ~6:1 — the fix was dropping the modifiers, not touching
      the palette. Two lessons carry forward: the instrument was wrong twice before its first
      believable result (Tailwind v4 emits **oklch**, and a regex for `rgb()` silently dropped
      36% of the page while reporting a clean pass), and every route had only ever been
      examined **at rest**, so empty and error states were an entirely unmeasured class.
- [x] Guards, not resolutions — each turns a repeated mistake into a failing build. Two
      tiers, and the difference matters:
      - **Enforced in CI** (`pnpm test:unit`, no game install needed): coverage ratchet;
        unscoped negative claims in data AND component prose; `damageCoefficient` vs the
        published base; blast radius without a falloff model; hit-count claims vs all three
        `OverlapAttack` escapes; the invented term `levelScale`; stale verification
        vocabulary ("logbook"); Status counts vs the data; schema fields vs `PLAN.md`;
        `text-muted-foreground` dimmed by any opacity modifier, in any state variant — the
        static half of the contrast guard, covering the `hover:`/`focus-visible:` cases a
        rendered sweep structurally cannot see.
      - **Local only** — needs the game install, so CI reports them SKIPPED, not passed.
        `data:audit`: internal-name collisions, coined terms absent from the decompile,
        unlock gating. `data:verify`: **all seven game cross-checks** — skill completeness,
        roster completeness, Ambry codes, tier + dlc, equipment cooldowns, the live prefab
        cross-check and the live decompiled grep. `.decompiled/` and `.gamedata/` are
        Gearbox's data and must never be committed (rule above), so this is a permanent
        limit, not a TODO.

        **What CI can therefore prove is narrower than it looks.** With no game data,
        `data:verify` compares our JSON to the *transcribed truth tables in the script*, not
        to the game — and it used to print "survivors.json matches the game's body prefabs"
        anyway (§3j.138). It now prints how many cross-checks ran and qualifies the claim as
        the table rather than the game. Run `pnpm data:audit` AND `pnpm data:verify` locally
        before pushing data work; a green CI badge does not cover the game comparison.

### Next up

- Opinion layer (rule #7) — **built but parked**, not unbuilt: `src/components/guides/`,
  `src/content/guides.ts` and `content/guides/_template.md` all exist, and `src/router.tsx`
  carries the note explaining how to re-enable (restore two imports + routes, plus the nav
  entry in `src/lib/nav.ts`). It stays parked while the site is facts-only — the missing
  piece is written guides, and those need a human author.
- In-game observation. Everything reachable by reading code and assets has been read;
  what is left is behaviour under real play — see "unexaminable" in `MATH-VERIFICATION.md`
  §3j.98. Nothing on this site substitutes for holding the item and watching the number.
