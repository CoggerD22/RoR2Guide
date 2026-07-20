# CLAUDE.md — RoR2 Companion

Fan-made Risk of Rain 2 companion site. Read `PLAN.md` in full before doing anything;
it is the source of truth for scope, schema, and milestones. Work milestone by
milestone (M0 → M6) and do not pull in future-phase features early.

## Non-negotiable rules

1. **Never invent game data.** Every stat, formula, and description in `/src/data`
   must come from riskofrain2.wiki.gg or the game's own language files
   (`Risk of Rain 2_Data/StreamingAssets/Language/en/*.txt` — these are JSON). If a
   value can't be verified, set `"verified": false` and surface it in the audit
   script; never fill in a plausible-sounding number.
2. **The game has 3 DLCs as of 2026**: Survivors of the Void, Seekers of the Storm,
   Alloyed Collective (Nov 2025). Training-data knowledge of item counts, survivors,
   and balance is stale — verify against the wiki when touching data.
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
  `scripts/decompile.sh` → `.decompiled/` (C#: formulas/coefficients) and
  `scripts/extract-bodies.py` → `.gamedata/` (Unity prefabs: survivor base stats,
  which are NOT in RoR2.dll). Re-run both after a game patch, then `pnpm data:verify`.
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

- When fetching wiki pages for data entry, transcribe numbers exactly; paraphrase any
  wiki prose that isn't verbatim in-game text.
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
      - items.json 100% verified (0 `verified:false`); survivors verified field-by-field
        against the body **prefabs** (190/190) — those values are NOT in RoR2.dll.
      - Artifact + shrine numbers confirmed against their behavior classes.
      - `pnpm data:verify` locks coefficients and survivor stats, and runs in CI.
      - Every record carries a `confidence` tag (code > asset > langfile > wiki),
        badged in the codex. Nothing is wiki-only any more.
      - Proc coefficients: `src/data/skills.json`, 78/125 loadout skills verified with
        provenance, surfaced in the Stat Lab. The rest are honestly marked unverified —
        never guessed (see MATH-VERIFICATION §3c).

### Next up

- Opinion layer (rule #7) — `/content/guides/*.md` is designed but **unbuilt**. The site
  is currently all facts, no guidance. Infrastructure first; opinions need a human author.
- Proc tail: split genuinely non-damaging skills (dashes, beacons) from the truly
  unknown ones so the UI can say "no proc" instead of "unverified".
