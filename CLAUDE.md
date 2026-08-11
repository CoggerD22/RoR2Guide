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
- [x] Guards, not resolutions — each turns a repeated mistake into a failing build. Two
      tiers, and the difference matters:
      - **Enforced in CI** (`pnpm test:unit`, no game install needed): coverage ratchet;
        unscoped negative claims in data AND component prose; `damageCoefficient` vs the
        published base; blast radius without a falloff model; hit-count claims vs all three
        `OverlapAttack` escapes; the invented term `levelScale`; stale verification
        vocabulary ("logbook"); Status counts vs the data; schema fields vs `PLAN.md`.
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
