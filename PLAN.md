# RoR2 Companion — Project Plan

A fan-made Risk of Rain 2 companion site. Core idea: an interactive item codex with a
pre-run planner (check items to target, X items to avoid), a survivor-aware stat
calculator, and a small set of reference pages that answer the questions the game
itself makes hard to answer (Bazaar dreams → stages, shrines, loadout unlocks).

Not affiliated with Gearbox or Hopoo Games. Non-commercial fan project. All item art,
names, and descriptions belong to Gearbox Publishing.

---

## 1. Game state (verified July 2026 — build against this, not older sources)

RoR2 currently has the base game plus **three** expansions:

| Release | Content relevant to us |
|---|---|
| Base game (1.0, Aug 2020) | Core survivors, ~110 items/equipment, artifacts, Bazaar |
| Survivors of the Void (Mar 2022) | Railgunner, Void Fiend, 40+ items incl. the **Void tier** (items that "corrupt" a counterpart item), Simulacrum mode |
| Seekers of the Storm (Aug 2024) | Seeker, False Son, Chef; ~16 items; new stages/paths |
| Alloyed Collective (Nov 2025) | Operator, Drifter; ~18 items (drone-focused meta); 7 drones; Artifact of Prestige; new final boss path |

Current totals (per the actively-maintained wiki): roughly **183 items and 44
equipment**, and **19 playable survivors** (11 base + Heretic + Railgunner, Void Fiend,
Seeker, False Son, Chef, Operator, Drifter).

**Canonical data sources, in order of preference:**
1. `riskofrain2.wiki.gg` — the actively maintained community wiki (updated through
   Alloyed Collective). Use this as ground truth for effects, stacking formulas, and
   item icons (256×256 PNGs on each item page / icon category).
2. The user's own game install — `steamapps/common/Risk of Rain 2/Risk of Rain 2_Data/StreamingAssets/Language/en/`
   contains the game's text as JSON (`Items.txt` etc. are JSON token files like
   `"ITEM_BEAR_NAME": "Tougher Times"`). This gives *exact* in-game names, pickup
   text, and full descriptions, straight from the source, always in sync with the
   installed patch. Prefer this for names/descriptions; use the wiki for numbers,
   stacking math, and icons.
3. `riskofrain2.fandom.com` — mirror; acceptable fallback only.

**Data rule for the whole project:** never invent or guess a stat. Every number in
`items.json` must be traceable to source 1 or 2. Anything unverified gets
`"verified": false` and is visually flagged in dev builds.

---

## 2. Domain knowledge the site must encode

### 2.1 Item tiers (and their canonical colors)
- **Common (white)**, **Uncommon (green)**, **Legendary (red)**
- **Boss (yellow)** — dropped by teleporter bosses / special sources
- **Lunar (blue)** — powerful with drawbacks; bought with Lunar Coins (Bazaar, Lunar Pods). ~20 items.
- **Void (purple)** — SotV. Each void item **corrupts** all stacks of a specific
  counterpart (e.g. Needletick ⇄ Tri-Tip Dagger) and they can never coexist. Void
  items internally have sub-tiers (common/uncommon/legendary/boss) which matters for
  Artifact of Command drop pools. The codex must show corruption pairs both directions.
- **Equipment (orange)** and **Lunar Equipment** — active-use, one at a time.
- Edge cases to model but visually de-emphasize: consumed variants (Sale Star
  (Consumed), Delicate Watch (broken), Dio's (consumed)), temporary items
  (Alloyed Collective's Substandard Duplicator grants temporary copies), untiered/NoTier
  internal items. Include a `subtype` field so these can be filtered out of the
  default view.

### 2.2 Stacking behavior (a first-class field, per the user's request)
Every item effect gets a stacking descriptor shown as a small badge on the card:

- **Linear** — `f(x) = base + a·x` (most items; Syringe, Crowbar, Glasses…)
- **Hyperbolic** — `f(x) = 1 − 1/(1 + a·x)` — approaches but never reaches 100%
  (Tougher Times, Old Guillotine…). E.g. 10 Tougher Times = 60% block, not 150%.
- **Exponential / compounding** — `f(x) = aˣ` style (Shaped Glass doubles per stack;
  Fuel Cell cooldown ×0.85 per stack; Alien Head ×0.75 per stack)
- **Special** — bespoke formulas (Bandolier uses `1 − 1/(1+x)^0.33`, Rusted Key,
  57 Leaf Clover luck rerolls, etc.)

Note: one item can have **multiple stats with different stacking types** (Fuel Cell:
linear +1 charge AND exponential −15% cooldown). Schema must support an array of
stacking entries, not a single enum. Hard caps exist for some items (Lens-Maker's at
10 for 100% crit) — include an optional `cap` field with a human note.

The badge UI: small pill ("Linear" / "Hyperbolic" / "Exponential" / "Special") in the
card corner; hovering/tapping expands the exact formula and a tiny sparkline of value
vs. stack count. Non-intrusive, exactly as requested.

### 2.3 Survivor stats & level scaling
Every survivor has base stats and per-level growth, e.g. Commando: HP 110 (+33/level),
damage 12 (+2.4/level), armor 0; Drifter: HP 170 (+52/level), armor 20. General model:

`stat(level) = base + growth × (level − 1)`

then item effects apply on top (order matters for some: e.g. % health items apply to
max HP after level scaling; Shaped Glass multiplies *base damage*). Capture per-survivor:
health, HP regen, damage, speed, armor, jump count, plus growth values — all from the
wiki's survivor pages. The calculator computes: max HP, effective HP (armor formula:
`reduction = armor / (100 + armor)` for positive armor), damage, attack-speed-adjusted
DPS proxy, movement speed, regen, crit chance.

### 2.4 Artifacts — scope honestly (pushback item, agreed with user in chat)
Almost all artifacts change **run rules**, not survivor stat math. For the calculator,
only a couple matter (e.g. **Artifact of Glass**: allies deal 500% damage but have 10%
health). So: artifacts appear in the stat calculator only where they mathematically
apply (Glass toggle), and appear in the **run planner** as strategy context
(Command = checklist becomes a literal shopping list; Sacrifice = no chests, items
drop from kills, which changes what "targeting" means). A dedicated Artifacts
reference page (with the ■/▲/● codes for Bulwark's Ambry) lives in Phase 3.

### 2.5 Mods
Deferred indefinitely, per discussion. Modded item data varies by mod version and
isn't reliably documented; revisit only if a concrete, well-documented mod list is
chosen (e.g. specific Thunderstore packages with published stats).

### 2.6 Unlock challenges (locked items, equipment & skills)
A large share of items and equipment are not in the drop pool until the player
completes a specific **Challenge** — e.g. Fuel Cell is gated behind *Experimenting*
("Pick up 5 different types of Equipment."). This is precisely the
kind of hard-to-find, in-game-buried fact the site exists to surface, and it is a
**fact, not an opinion** (rule #7): it belongs in the datasets.

Model each unlock as a challenge **name** plus its **requirement** — the one-line
"how do I actually get this?" description. Both come from source 2 (the game's
`Language/en` challenge/unlockable tokens, which carry the exact in-game text), with
wiki.gg as the fallback for edge cases. Where a requirement can't be verified, leave
it empty and flag it in the audit — **never invent an unlock condition** (rule #1).

Because some challenges unlock more than one thing, and some item challenges overlap
conceptually with the survivor alt-skill challenges already stored in
`LOADOUT_UNLOCKS`, the requirement text is best kept **once** in a challenge lookup
keyed by challenge name and referenced by items and loadout skills alike, rather than
duplicated across datasets. Items with no challenge are the default drop-pool items
and simply carry no unlock (shown as always available).

### 2.7 Artifact identity (icons)
Artifacts are recognized visually — by their circular emblem, and by the
■ / ▲ / ● / ♦ monument pattern used to unlock them in Bulwark's Ambry. The Artifacts
reference must therefore show **both** the artifact's **icon** and its Ambry code, not
code alone. Icons are the artifact emblems from wiki.gg (Gearbox assets, shown under
the site's standing non-affiliation/attribution disclaimer), stored alongside the item
icons and referenced by a stable id per artifact.

---

## 3. Product spec

### Phase 1 — Item Codex + Run Planner (the priority)
The page that replaces/betters the Netlify cheat sheet.

**Codex grid**
- All items as cards using real 256×256 icons, grouped by tier with the game's tier
  colors as the card border/glow.
- Instant fuzzy search (name, description text, tags — "bleed" finds Tri-Tip,
  Shatterspleen, Needletick).
- Filters: tier, DLC (with icons), category tags (Damage / Healing / Utility /
  On-Kill / On-Hit / Equipment…), stacking type, "hide consumed/temporary variants"
  (on by default).
- Card hover/tap = in-game-style tooltip (dark panel, icon left, white bold name,
  description with highlighted numeric values — replicate the screenshot aesthetic the
  user provided). Click = detail drawer: full description, logbook flavor text,
  stacking formula(s) + sparkline, corruption pair links, unlock challenge if locked
  behind one, wiki link.

**Run Planner (the checklist)**
- Each card cycles through three states: **neutral → targeted (✓ green ring) →
  avoided (✗ red desaturated) → neutral**. Also right-click / long-press menu for
  direct set.
- Persistent side panel ("Run Plan") listing targeted and avoided items, **grouped by
  tier** — because in-game decisions are tier-scoped (3D printers, scrappers, and
  cauldrons trade within a tier, so "what greens do I want" is the actual question
  you ask at a printer).
- Planner state persists in `localStorage` (survives refresh mid-run). "New run"
  button clears it. Optional later: encode plan in the URL for sharing.
- Optional survivor selector at the top of the planner: purely contextual in Phase 1
  (shows the survivor portrait + base stats next to the plan); becomes live math in
  Phase 2.

### Phase 2 — Stat Lab (survivor calculator)
- Pick survivor → level slider (1–99) → shows all derived stats.
- Add item quantities (searchable picker or "import from Run Plan") → stats update
  live with correct per-item stacking math. Start with the ~30 items that directly
  modify survivor stats (Syringe, Glasses, Crit items, HP/regen/armor/speed items,
  Shaped Glass, Transcendence…); proc/damage-chain items are out of scope for v1 of
  the calculator (they need proc-coefficient simulation — a possible Phase 4).
- Artifact of Glass toggle. Eclipse level selector later if desired.

### Phase 3 — Reference pages (small, high-value, static)
- **Bazaar dreams → stages**: table of every "You dream of…" line with the stage it
  seeds, thumbnail, and stage number. (Solves the exact pain point raised.)
- **Shrines & interactables**: photo, exact effect, costs/odds, per-stack behavior
  (e.g. Shrine of the Mountain), spawn notes.
- **Loadout unlocks**: per-survivor table of alternate skills/skins and the exact
  challenge to unlock each.
- **Artifacts**: each artifact shown with its **icon** (the circular emblem), its
  effect, and its Bulwark's Ambry monument code (the ■/▲/●/♦ pattern) together — so the
  page is scannable by sight and doubles as an Ambry cheat-sheet. Icons sourced from
  wiki.gg (§2.7); codes verified against each artifact's unlock.

### Phase 4 — Future roadmap (planned, not scheduled)

**4.1 Survivor pages & loadout guides.** Promote the Phase-3 loadout-unlock table
into full per-survivor pages: every skill and alternate skill with its factual data
(damage %, cooldown, proc coefficient), unlock challenge, and skins. Include a
"survivor-specific item behavior" section covering items that mechanically work
differently or do nothing on that survivor (these interactions are facts, not
opinions, and are among the hardest info to find in-game).

**4.2 Recommendations without fake objectivity.** All content on the site belongs to
exactly one of three classes, and the UI must make the class visible at a glance:

1. **Mechanics** — sourced facts (numbers, formulas, unlocks). Lives in the JSON
   datasets. No editorializing.
2. **Synergies** — factual interactions stated mechanically: *why* items combine
   ("Crowbar multiplies damage on targets above 90% HP, so it scales one-big-hit
   kits far more than sustained-fire kits"). Verifiable, patch-checkable, still no
   tier ranking.
3. **Opinions** — build guides, per-survivor item priorities, tier lists. Always
   badged **Opinion**, always stamped with author + date + **game patch version**,
   stored in separate content files (`/content/guides/*.md`), never mixed into
   `items.json`. When the dataset's patch version moves past a guide's stamp, the
   guide auto-shows a "written for an older patch" staleness banner.

This is the answer to the "subjective presented as objective" worry: the site never
launders opinion through the codex; it labels it, dates it, and lets it visibly age.

**4.3 Proc & breakpoint tools.** Per-skill proc coefficient database (the single most
scattered piece of RoR2 knowledge), breakpoint tables (items to reach crit cap,
Guillotine execute thresholds, hyperbolic milestones like Tougher Times at N stacks),
and eventually a proc-chain explorer.

**4.4 Shareable plans & rich item links.** Encode the run plan in a URL for
co-op planning; give every item a stable route (`/items/crowbar`) and prerender those
pages at build time with OpenGraph meta (icon, name, description) so links pasted in
Discord unfurl into proper cards. Build-time prerendering keeps this fully static —
still no server.

**4.5 Offline / PWA.** Cache the dataset and icons with a service worker so the site
works with zero connection on the machine running the game.

**4.6 Patch survival (why sites like this die, and how this one won't).** Every RoR2
patch or DLC silently invalidates hand-built sites — that's why the niche is empty.
Codify the update loop as tooling: `pnpm data:diff` re-reads the game's language
files, diffs tokens against the dataset, and emits a checklist of changed/added
items; changed entries get `verified: false` until re-checked against the wiki; the
dataset carries a global `patchVersion` that drives the staleness banners in 4.2.
Updating after a patch should be an evening, not a rebuild.

**4.7 Locked items — surfacing unlock challenges.** Phase 1 promised the detail
drawer would show an item's "unlock challenge if locked behind one." The dataset
records the challenge *name* for ~30 items (`unlock`), but not the *requirement*, and
the codex gives no at-a-glance signal that an item is locked. Close the loop as three
layers, all facts-only (rule #7) — "this is locked, here's the condition," never build
advice:

1. **Data.** Promote `unlock` from a bare challenge name to a challenge **name +
   requirement**. The requirement is the verbatim achievement DESCRIPTION, resolved
   from the game's `Language/en` text by `scripts/extract-challenges.py` (which joins
   each stored challenge name to its `ACHIEVEMENT_*_DESCRIPTION`). Because one
   challenge can unlock several items (Death Do Us Part → both Elite bands; Blockade
   Breaker → all four Heresy items), `data:audit` enforces that those items carry
   identical requirement text; any requirement that can't be verified is left empty
   and flagged — never guessed (rule #1).
2. **Indicator.** A small, non-intrusive **lock glyph** on locked item cards in the
   codex and planner — tier color preserved, an unobtrusive corner badge consistent
   with the stacking pill, with an accessible label ("Locked — unlock challenge:
   <name>"). Nothing that interferes with the existing tooltip aesthetic.
3. **How to unlock.** The detail drawer shows the challenge name and its one-line
   requirement under a clear "How to unlock" heading. Add an optional codex filter
   ("Locked only") so a player can see everything still gated behind a challenge.

**4.8 Artifact visuals on the reference page.** Give the Artifacts reference each
artifact's **icon** (§2.7) so the page is recognizable at a glance and doubles as an
Ambry cheat-sheet: icon + name + effect + monument code per row/card. Download the
artifact emblems from wiki.gg into `/public/icons/artifacts/`, add a stable `id` and
an `icon` field to `ArtifactRef`, and render them beside the existing effect/code.
Icons are Gearbox assets shown under the standing attribution disclaimer; a missing
artifact icon is reported by `data:audit`.

**4.9 Explicitly parked.** Mod support (undocumented, version-volatile), other
languages (the game's language files make it *possible*, but it multiplies data
maintenance), accounts/cloud sync (localStorage is enough; URL sharing covers co-op).

---

## 4. Tech stack (deliberately boring where it counts)

The user asked for "the newest and coolest frameworks." Recommendation: **new but
proven** — the flashy edge (server components, RSC frameworks, backends) buys nothing
for a static, client-interactive content site and adds failure modes. This is a
static site with client state; keep it that way.

- **Vite + React + TypeScript** — instant HMR, typed item data end-to-end.
- **Tailwind CSS v4** + **shadcn/ui** primitives (dialog, drawer, tooltip, command
  palette) — modern, and `cmdk` gives a slick ⌘K item search for free.
- **Zustand** with the `persist` middleware — run-planner state → localStorage in
  ~20 lines.
- **Fuse.js** for fuzzy search over the item corpus (small enough to search in-memory
  instantly; no server, no index build).
- **TanStack Router** (or React Router 7) — typed routes for /items, /planner,
  /stats, /reference/*.
- **Data as static JSON** in `/src/data`, validated at build time with **Zod**
  schemas. No backend, no database.
- **Deploy**: Cloudflare Pages / Netlify / Vercel (any; static). CI = typecheck +
  Zod data validation + Playwright smoke test.

### Design direction
- Dark, atmospheric UI matching the game: deep space-blue base (slate/indigo blacks,
  e.g. `#0b1220`–`#101826` range), thin luminous cyan-blue accents (the game's
  teleporter/UI blue), tier colors reserved exclusively for item identity so they
  stay meaningful.
- Tooltip styling cloned from the in-game look (the user's Crowbar screenshot is the
  reference): dark panel, subtle border, icon left, bold white name, gray body with
  numeric values highlighted.
- Typography: a squarish techno display face for headings (in the spirit of the
  game's UI), a clean humanist sans for body/data. Avoid generic default look.
- Signature element: the three-state check/X interaction with a satisfying micro-
  animation, and the tier-grouped Run Plan rail.
- Quality floor: responsive to mobile (people will use this on a phone next to their
  PC), keyboard navigation, reduced-motion respected.

---

## 5. Data pipeline (the real work of Phase 1)

1. **Schema first** (`items.schema.ts` via Zod):
```ts
type StackingType = "linear" | "hyperbolic" | "exponential" | "special" | "none";
interface StackingEntry { stat: string; base: number; perStack: number;
  type: StackingType; formula?: string; cap?: string; }
interface Item {
  id: string;              // internal token-ish slug, e.g. "crowbar"
  name: string;            // "Crowbar"
  tier: "common"|"uncommon"|"legendary"|"boss"|"lunar"|"void-common"|"void-uncommon"|"void-legendary"|"void-boss"|"equipment"|"lunar-equipment";
  subtype?: "consumed"|"temporary"|"untiered";
  dlc: "base"|"sotv"|"sots"|"ac";
  pickupText: string;      // short in-game pickup line
  description: string;     // full description with numbers
  flavor?: string;         // logbook quote (optional; long)
  stacking: StackingEntry[];
  tags: string[];          // "damage","on-hit","healing","drone",...
  corrupts?: string[];     // void item -> ids it corrupts
  corruptedBy?: string;    // normal item -> void id
  unlock?: { challenge: string; requirement?: string }; // §2.6: challenge name + how to
                           // earn it; requirement omitted ONLY when unverified (never guessed)
  icon: string;            // /icons/crowbar.png
  wiki: string;            // wiki.gg URL
  verified: boolean;
}
```
2. **Names/descriptions**: parse the JSON language files from the user's game install
   (exact, current-patch text) if available; otherwise transcribe from wiki.gg.
3. **Numbers & stacking**: from wiki.gg item pages + its Item Stacking page. Do this
   tier by tier (whites → greens → reds → boss → lunar → void → equipment → DLC sets),
   committing per tier so review is tractable.
4. **Icons**: download per-item PNGs from wiki.gg into `/public/icons/` (keep original
   filenames mapped in the JSON). Artifact emblems download the same way into
   `/public/icons/artifacts/` (§2.7, §4.8). Fan-use with attribution; site carries the
   non-affiliation disclaimer.
5. **Validation**: build fails if any item violates schema; a `pnpm run data:audit`
   script reports unverified items, missing item/artifact icons, dangling corruption
   pairs, and locked items whose unlock requirement is still unverified (§2.6).

Estimated effort: the dataset is ~230 entries; done tier-by-tier with Claude Code
fetching wiki pages and the user spot-checking against the in-game logbook, this is a
few focused sessions — and it's the moat that makes every other feature possible.

---

## 6. Milestones

1. **M0 — Skeleton**: Vite app, routing, theme tokens, layout shell, deploy pipeline.
2. **M1 — Data: whites + greens** end-to-end (schema, ~60 items, icons, audit script).
3. **M2 — Codex UI**: grid, tier grouping, search, filters, tooltip, detail drawer.
4. **M3 — Run Planner**: three-state toggling, tier-grouped rail, persistence.
5. **M4 — Data: complete** all tiers + equipment + DLC items + corruption pairs.
6. **M5 — Stat Lab**: survivors dataset, level scaling, stat-item math, Glass toggle.
7. **M6 — Reference pages**: dreams→stages, shrines, loadout unlocks, artifacts.

Ship publicly after M4; M5/M6 iterate on a live site.
