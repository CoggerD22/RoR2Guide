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

### Phase 5 — Correctness, coverage & discovery (queued behind Phase 4)

Raised from real use of the live site. Deliberately ordered so the **correctness**
work lands before the features that would otherwise build on top of bad data.

**5.0 Systematic verification sweep — do this before anything else in Phase 5.**

Three separate "unverified values" turned out to be **lookup failures, not real gaps**
(Drifter's kit, the proc tail, and every item on the old maintainer-input list). That
is a *methodology* failure, not bad luck: each was recorded as unknowable without ever
testing whether the game's own files contained it. The standing rule is now:

> **No value may be described as unverified, blocked, or wiki-sourced until it has
> been searched for in the language files, the decompiled C#, and the asset bundles.**

Applying that rule to `reference.ts` — the one dataset with **no provenance tags at
all**, while `items.json` (192 langfile / 20 code) and `survivors.json` (19 asset) are
fully sourced — immediately found substantial, verifiable error:

- **Bazaar dreams: we ship 13; the game defines 31.** The `BAZAAR_SEER_<STAGE>` tokens
  encode the dream→stage mapping *in the token name*, so the table can be generated
  rather than transcribed. All 13 existing rows check out, but **18 are missing**
  (Aphelian Sanctuary, Conduit Canyon, Treeborn Colony, Golden Dieback, Iron Alluvium,
  Iron Auroras, Viscous Falls, Reformed Altar, Prime Meridian, Commencement,
  Pretender's Precipice, Repurposed Crater, Siphoned Forest, Solutional Haunt,
  Sulfur Pools, Shattered Abodes, Disturbed Impact, …).
- **Artifacts: the count of 20 is correct, but the text is paraphrase.** Several
  shipped descriptions differ from the in-game `ARTIFACT_*_DESCRIPTION` — Prestige
  omits "Shrine of the Mountain effects are permanent," and Devotion's "grow into
  permanent allies" is not the game's wording. Replace all 20 with verbatim text.
  - **Counter-example worth preserving:** the language files define a 21st,
    **Artifact of Spirit** ("All characters move faster at lower health"). Adding it
    would have been a *false* entry — `RoR2Content.Artifacts` registers no `ArtifactDef`
    for it, so it is cut content that still ships tokens (same as the `SoulCorruptor`
    equipment). **Presence in the language files is not proof of live content.** The
    verification rule cuts both ways: it removes phantom gaps *and* prevents phantom
    additions. Cross-check every token-derived record against its registered def.
- **Loadout unlocks: 14 rows carry an empty `requirement`**, resolvable through the
  same achievement-token join already built for item unlocks (§2.6).
- **Shrines: we ship 9; three live ones were missing** — Shrine of Shaping
  (`ShrineColossusAccessBehavior`), Halcyon Shrine (`ShrineHalcyonite*`), and Shrine
  of Rebirth (`ShrineRebirthController`), each confirmed against a behaviour class
  compiled into RoR2.dll. The Cleansing Pool text was also **factually wrong**: it
  gives a **Pearl item**, not "a random regular item of the same tier."
  - A second cut-content catch: **Shrine of Warding** (`SHRINE_PROTECTION_NAME`) has
    name and context tokens but *no* description and *no* behaviour class — the same
    signature as Artifact of Spirit. Excluded, with the reasoning recorded in the file.
- **Ambry codes** are extractable from `ArtifactFormulaDisplay` (§7).

#### 5.0.1 The deeper flaw: description text is not behaviour

The sweep above fixed *coverage* but introduced a *category error*, caught on review
and worth stating plainly because it invalidates part of the work:

> Replacing a wiki paraphrase with the game's own `_DESCRIPTION` token verifies
> **what the game says**. It does **not** verify **what the game does**.

Description tokens are player-facing blurbs. They are routinely incomplete, rounded,
or stale. Storing one in a field the UI presents as *the mechanic* is the same class
of error as trusting the wiki — the source merely looks more official.

**Worked example — Shrine of Blood.** The token says it "consumes a percentage of the
survivors health in exchange for gold equal to half the amount of HP taken." The
decompiled `ShrineBloodBehavior` shows that is at best a third of the story:

```csharp
public float goldToPaidHpRatio  = 0.5f;   // gold = HP paid × ratio  (the "half")
public float costMultiplierPerPurchase;   // cost COMPOUNDS every purchase
public int   maxPurchaseCount;            // and the shrine is use-capped
// cost is a PERCENT of max HP, recomputed after each use:
Networkcost = (int)(100f * (1f - Mathf.Pow(1f - cost / 100f, costMultiplierPerPurchase)));
```

The escalating cost and the use cap — the two things a player actually needs to know
before praying twice — appear nowhere in the description. Worse, the real constants
(`costMultiplierPerPurchase`, `maxPurchaseCount`, and any per-prefab override of
`goldToPaidHpRatio`) are **serialized on the shrine prefab**, so even the C# only
gives the *shape* of the formula, not its values.

#### 5.0.2 Claim taxonomy — every stored field is exactly one kind

Verification is meaningless until the *kind* of claim is named, because each kind has
a different authoritative source. Every field in every dataset must be classified:

| Kind | Example | Authoritative source | Never acceptable |
|---|---|---|---|
| **Identity** | id, name, icon | `*Def` asset + `_NAME` token | — |
| **Existence** | "this is live content" | Registration in a catalog (`RoR2Content.*`) or a compiled behaviour class | Language tokens alone |
| **Quoted text** | pickup/flavour text, a Seer's line | `Language/en` **verbatim** — the token *is* the truth | Paraphrase |
| **Behaviour** | "cost rises per use" | Decompiled C# | A `_DESCRIPTION` token |
| **Numeric constant** | `goldToPaidHpRatio`, cooldowns | **Serialized field on the actual prefab/ScriptableObject**; code default only if never overridden | Numbers read out of prose |
| **Derived** | DPS, breakpoints | Computed from verified constants, with inputs cited | — |
| **Editorial** | our "cost" summary column | Ours — must be *visibly labelled as ours* | Presenting it as game fact |

**The two rules that follow, and that the sweep violated:**
1. A `_DESCRIPTION` token may populate a field typed **Quoted text**. It may *never*
   populate a field typed **Behaviour** or **Numeric constant**.
2. Code gives the **formula**; the prefab gives the **constants**. A behaviour claim
   citing only one of the two is incomplete and must say so.

#### 5.0.3 Consequence: what must be re-verified

Anything where a description token was stored into a behaviour-typed field is
**not verified** and must be redone against code + prefab:

| Record set | Field | Status |
|---|---|---|
| `SHRINES` (12) | `effect` | ❌ **Invalid** — description-as-behaviour. Redo from `Shrine*Behavior` + prefab constants. |
| `SHRINES` (12) | `cost` | ❌ **Editorial, unlabelled** — hand-written, presented as fact. Either derive from prefab or mark as ours. |
| `ARTIFACTS` (20) | `effect` | ❌ **Invalid** — same error. Redo against each artifact's manager/behaviour class. |
| `LOADOUT_UNLOCKS` (45) | `requirement` | ⚠️ **Conditionally valid** — it is the game's own stated unlock contract, so it is legitimately *Quoted text*, but it must be **labelled as the game's description**, not as the verified trigger. The true trigger lives in each achievement class. |
| `BAZAAR_DREAMS` (31) | `dream` | ✅ **Valid** — the Seer literally speaks this line; it is Quoted text by nature. |
| `BAZAAR_DREAMS` (31) | `stage`, `stageNumber` | ✅ **Valid** — structural, from the token name joined to `SceneDef.stageOrder`, not from prose. |
| `items.json` (212) | `description`, `pickupText` | ✅ **Valid as Quoted text** — these are the in-game tooltips, and `data:diff` confirms transcription fidelity. Any *derived* number the site computes from them belongs to the stat engine, which is separately code-verified. |

#### 5.0.4 Method going forward

1. **Type every field** in the schemas with its claim kind, so the requirement is
   visible at the point of definition rather than living in someone's head.
2. **Per-field provenance, not per-record.** A record is not "verified"; each field
   is verified *by a named source*. `confidence` becomes `{ source, ref }` — e.g.
   `{ source: "code", ref: "ShrineBloodBehavior.AddShrineStack" }`.
3. **Extract prefab constants**, not just code shape: pull the serialized fields off
   each shrine/interactable prefab (UnityPy is available — §7) so numeric constants
   come from the asset that actually ships.
4. **Present both layers in the UI where they differ.** Show the game's own
   description *as a quote*, and the verified mechanic separately. Users benefit from
   seeing that the in-game blurb omits the escalation — that is exactly the
   "answers the game hides" brief.
5. **Audit enforcement:** `data:audit` fails when a behaviour-typed field has no code
   citation, when a numeric constant has no asset citation, or when an editorial field
   is not flagged as editorial.
6. **No claim ships on a single source** when two layers exist (code + asset).

**Verification status — honest, and revised after 5.0.1:**

| Surface | State |
|---|---|
| `items.json` (212) | ✅ Quoted text + identity verified; `data:diff` reports 0 mismatches |
| `survivors.json` (19) | ✅ Numeric constants verified against body prefabs (`data:verify`) |
| `statItems.ts` | ✅ Constants match decompiled `RecalculateStats` |
| `BAZAAR_DREAMS` (31) | ✅ Quoted text + structural mapping |
| **`SHRINES` (12) effects/costs** | ❌ **Invalid — description-as-behaviour; redo** |
| **`ARTIFACTS` (20) effects** | ❌ **Invalid — same; redo against behaviour classes** |
| **`LOADOUT_UNLOCKS` (45)** | ⚠️ Valid only if relabelled as the game's stated description |
| **Ambry codes (19)** | ⚠️ Still wiki-sourced — extractable, not yet done |
| **Proc coefficients (21/125)** | ⚠️ Still unresolved — statically recoverable (§5.7) |
| **Loadout alt-skill coverage** | ⚠️ 5 survivors under-reported (§5.1) |

Work: re-derive every hand-entered `reference.ts` block from game text, transcribing
**verbatim** — including the game's own typos (e.g. "cavernouse depths"); the site
quotes the game, it does not correct it. Attach `confidence` tags to these records the
way items and survivors already carry them, and extend `data:audit` to flag any
reference row lacking provenance. Portals (§5.6) should be built from the `PORTAL_*`
and interactable tokens for the same reason.

**5.1 Loadout-table correctness pass — and an audit that makes it stick.**
`LOADOUT_UNLOCKS` uses an empty skill list to mean two different things: *"this
survivor genuinely has no challenge-locked alternates"* (Void Fiend — correct) and
*"we never entered the data"* (Drifter — wrong). The UI renders both as the positive
claim **"Fixed kit — no challenge-locked alternate skills."** The site is therefore
asserting something false, which rules #1 and #7 forbid. Cross-checking the table
against the extracted SkillFamily variants (`.gamedata/loadouts.json`) shows **five
survivors under-reported**: MUL-T (4 real vs 3 listed), Railgunner (3 vs 2),
False Son (3 vs 2), Chef (3 vs 2), and **Drifter (3 vs 0 — the visible bug)**. Fix:
1. Fill the missing rows from the game's own skill variants + achievement text.
2. Represent "no alternates" and "not yet recorded" as *distinct states* in the data,
   so the UI can say the honest thing in each case instead of defaulting to a claim.
3. Extend `data:audit` to **fail** when a survivor's table lists fewer alternates than
   the game data contains. This class of silent gap must not be able to ship again.

The inverse also exists and is benign but should be labelled rather than left
mismatched: Acrid and Captain list rows that aren't loadout-slot variants (Captain's
beacon sub-skills).

**5.2 Undo a cleared run plan.** "New run" is instantly destructive with no recovery.
Retain the cleared plan in memory and offer an **Undo** affordance that stays
available until the plan is meaningfully rebuilt (first new item marked) or the
session ends — matching the "undo toast" pattern users expect, without adding
persistence complexity.

**5.3 Stat Lab item coverage.** The Stat Lab currently models **14 of 212 items**.
That is by design (Phase 2 scoped it to items that directly modify survivor stats),
but it undershoots even that scope — the plan said ~30 — and the UI never explains
the boundary, so it reads as broken rather than deliberate. Two parts:
1. Expand to every item whose effect is a *direct, unconditional* stat change
   (Energy Drink, Hiker's Boots, Red Whip, Elusive Antlers, Oddly-shaped Opal,
   Cautious Slug, Warbanner, Chronic Expansion, …), each with its verified numbers.
2. State the boundary in the UI: proc-chain, on-hit, and situational items are
   excluded **because they can't be reduced to a stat line**, not because they were
   forgotten. Items outside the model should be visibly marked as such.

**5.4 Survivor → Stat Lab handoff.** From a survivor page, a single action ("Open in
Stat Lab") that loads that survivor into the calculator. Pure navigation + preselect;
no new math.

**5.5 Survivor portraits.** Survivor pages and the survivor index are text-only
because no portrait assets exist. Source them the same way as item and artifact icons
(§2.7), add an `icon` field to `survivors.json`, and use them in the index, the
detail header, the Stat Lab picker, and survivor OpenGraph cards (which currently
fall back to text-only for exactly this reason, §4.4).

**5.6 Portal guide + Bazaar dream imagery.** Two related gaps:
- A **complete portal reference**: every portal in the game (Blue/Newt → Bazaar,
  Green/Celestial → Obliterate, Gold → Gilded Coast, Void/Purple → Void Fields,
  Null → Void Locus, Deep Void, Primordial Teleporter, and the DLC additions), each
  with how it is opened, where it leads, what it costs, and what it locks out.
  This is the same "answers the game hides" brief that justified the Bazaar
  dreams table.
- **Imagery for the Bazaar dreams table** — the dream portals are identified visually
  in-game, so the table should show them, not just quote the text.

**5.7 Finish proc verification — statically, no runtime dumper required.**
21 of 125 loadout skills carry no verified proc coefficient. This was previously
scoped as *"needs the in-game ProcDumper"*; **that was wrong**, and the correction
matters because it moved work off the maintainer entirely.

Root cause: `extract-loadouts.py` resolves procs only from **serialized Unity fields**
(EntityStateConfiguration overrides and projectile prefabs). It never reads the game's
**C# code**, and it keys on a skill's *entry* `activationState` — but for charge/setup
skills the damage is dealt by a **later state** in the machine. So "unresolved" mostly
meant "we looked in the wrong place," not "this value doesn't exist statically."

Decompiling the `EntityStates.*` classes out of `RoR2.dll` (the same ilspycmd path
already used for `CharacterBody`) resolves them. Verified while re-checking this claim:
- `Treebot.Weapon.ChargeSonicBoom` merely transitions to `FireSonicBoom`, whose
  `CalculateProcCoefficient()` **returns `0f`** — DIRECTIVE: Disperse is a pure
  knockback. A code-verified fact, not an unknown.
- Eight others — Captain `SetupSupplyDrop`, Drifter `Salvage`, DroneTech `DroneLeap` /
  `Weapon.Activate` / `Weapon.Paint.Paint`, `PrepFlower2`, Seeker `Reprieve`, Toolbot
  `ToolbotDualWieldStart` — contain **no damage path whatsoever** (no `DamageInfo`,
  no attack construction).

Work to do:
1. Widen `scripts/decompile.sh` beyond its current 3 stat types to cover the
   `EntityStates` tree, and follow state transitions to the state that actually fires.
2. Classify each skill by the *kind* of answer, since collapsing them into
   "unverified" is itself misleading:
   - **Non-damaging** (dashes, stances, setups): Tactical Dive/Slide, Blink,
     Phase Blink, Trespass, Shadowfade, Sojourn, Repossess, Retool, Power Mode,
     Orbital Supply Beacon, Reprieve → **"no proc — deals no damage"**, a fact.
   - **Delegating** (the state spawns something that carries the proc): TR12/TR58
     turrets, CMD-SWARM, Tangling Growth, Salvage → resolve to the spawned
     minion/projectile's own coefficient and model the delegation explicitly.
   - **Genuinely runtime-dependent**, if any survive the above → only *these* justify
     the ProcDumper, and they stay marked unverified until measured. Never estimated.

**5.8 Make the locked-item state unmissable.** §4.7 shipped a lock badge, a
"How to unlock" block, and a "Locked only" filter, but the badge is deliberately
subtle and reads as invisible at grid density. Strengthen the *visual* language:
a clearly distinct treatment for locked cards (dimmed/desaturated art with the lock
overlaid, in the spirit of the in-game logbook), a legend so the state is
self-explanatory, and the challenge surfaced in the hover tooltip rather than only
in the drawer.

**5.9 Objective build guidance — what is and isn't honestly possible.** Sites like
Rogueranker publish per-survivor item lists with no stated methodology, no math, and
no sourcing. The instinct to distrust them is correct. Three tiers of claim, of which
only the first two belong on this site:

1. **Derivable and objective** — *build this.* Given a survivor's verified base
   stats, proc coefficients, and attack rates, the **marginal value of the next
   stack** is computable: "+1 Soldier's Syringe = +X% sustained DPS for Commando at
   level N with this inventory." Same for effective HP per armor item, expected procs
   per second for on-hit items on a given primary, and breakpoints (§4.3, shipped).
   These are facts *under explicitly stated assumptions* (target dummy, stationary,
   sustained fire, no movement), and the assumptions must be shown with the number so
   any reader can reproduce or reject it.
2. **Factual interaction (synergy)** — already defined in §4.2: *why* two items
   combine, stated mechanically, no ranking.
3. **"Best items for X"** — **not objective and cannot be made so.** It requires an
   objective function (survive? clear speed? boss burst?) that different players
   answer differently, and item value in a roguelike depends on run state, stage,
   difficulty, artifacts, and player skill. Any site presenting this as fact is
   laundering opinion. If it ever appears here it goes through §4.2's Opinion class:
   badged, authored, dated, patch-stamped.

So: the answer to "is there an objective build guide?" is **no for rankings, yes for
math** — and the math is the part nobody has built. That is the version worth doing.

**5.10 Image loading polish.** Item icons are lazy-loaded with no reserved space, so
a card can briefly render without its art while scrolling (observed on Shuriken; the
asset is present and intact — this is a loading artifact, not missing data). Reserve
the icon box and decode asynchronously so cards never reflow or flash empty.

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

---

## 6A. Data Truth Programme — guaranteeing every claim on the site is sourced

> **Standing requirement:** Risk of Rain 2 is a game where a wrong number changes how
> someone plays. **No false information, in either direction** — not a wrong value, and
> not a confident claim where we only have a guess. A field we cannot source is shown
> as unknown, never filled with something plausible.

§5.0 established *how* to verify a claim. This section is the programme that applies it
to **every claim on the site**, with measurable coverage and CI gates so it cannot
silently regress. It supersedes the informal "verified" flag, which conflated three
very different things: *we transcribed it correctly*, *we found it in a game file*, and
*we know it is true*.

### 6A.1 Why the current `verified` flag is not a guarantee

`items.json` reports 212/212 `verified: true` and 0 unverified. That number is
misleading. Breaking it down by what was actually checked:

| | Count | What "verified" currently means |
|---|---|---|
| `confidence: "code"` | 20 | Numbers and curve checked against decompiled C#. **A real guarantee.** |
| `confidence: "langfile"` | 192 | Numbers **and stacking curve** read out of the description prose. **Transcription fidelity only.** |

`data:diff` reports "0 numeric mismatches", but it compares `items.json` numbers to the
*language file* numbers — i.e. it proves we copied the blurb correctly, not that the
blurb is right. That is a circular check, and it is currently our main evidence.

**Tougher Times is the proof this is not hypothetical.** Its description reads
"15% (+15% per stack) chance to block". The code-verified behaviour is *hyperbolic*:
13% at one stack, ~60% at ten, asymptotic to 100%. Had it stayed `langfile` we would be
publishing "linear 15%/stack" — confidently, and wrongly. **153 items are currently
marked `linear` on exactly that basis**, and a further **22 `langfile` items assert a
non-linear curve** (Bandolier, Alien Head, 57 Leaf Clover, H3AD-5T v2, Fuel Cell,
Rusted Key, …) with no code behind the assertion.

### 6A.2 Source hierarchy — including where the internet is and isn't allowed

Sources are ranked by **authority**, and the required rank depends on the claim kind
(§5.0.2). Higher tiers override lower ones; a lower tier may never contradict a higher.

| Tier | Source | Authoritative for | Notes |
|---|---|---|---|
| **T0** | **Decompiled C#** (`RoR2.dll`) | Behaviour, formulas, curve shape, order of operations | The game *is* its code. Highest authority for what happens. |
| **T1** | **Serialized asset fields** (prefabs, ScriptableObjects, `*Def`s) | Numeric constants, existence, identity, relationships | The values that actually ship. Code shows the formula; assets supply its inputs. |
| **T2** | **Language files** (`Language/en`) | Quoted text **only** — names, tooltips, flavour, the game's own stated descriptions | **Never** authoritative for behaviour or constants. |
| **T3** | **Runtime observation** (BepInEx/ProcDumper) | Values genuinely computed at runtime from external state | Last resort; must record method + build. |
| **T4** | **Community wiki / internet** | **Nothing, on its own.** | Permitted only as a *lead* or a *cross-check*, and only visibly labelled. See below. |

**The internet's role, stated precisely.** The wiki is a legitimate *research aid* and an
illegitimate *source of record*:
- ✅ **Allowed:** to discover that a thing exists so we can go verify it in T0–T2; to
  sanity-check a T0/T1 result and, on disagreement, trigger investigation; for art
  assets (icons) where the file is the artefact and no factual claim is involved.
- ❌ **Forbidden:** as the sole basis of any number, formula, curve, unlock condition, or
  mechanic that ships as fact.
- ⚠️ **Conditional:** where a fact is genuinely absent from all game files, it may ship
  **only** flagged `confidence: "wiki"`, rendered with a visible "community-sourced,
  unverified" badge, and listed in the coverage report as an outstanding gap.
- **Disagreement rule:** wiki vs. T0/T1 conflict is always resolved for T0/T1, and the
  discrepancy is recorded — those are exactly the cases where the site adds value
  (Tougher Times, Old Guillotine's real 11.5%, Shrine of Blood's escalation).

### 6A.3 Per-field provenance model

`confidence` moves from the record to the **field**, and becomes a citation rather than
a label. A claim without a resolvable citation is not verified — full stop.

```ts
type Tier = "code" | "asset" | "langfile" | "runtime" | "wiki";
interface Provenance {
  tier: Tier;
  ref: string;      // "ShrineBloodBehavior.AddShrineStack" | "ItemDef:Bear.deprecatedTier"
                    // | "ITEM_BEAR_DESC" — must be machine-checkable, not prose
  checkedOn: string;      // ISO date
  gameBuild: string;      // Steam buildid the check ran against
  note?: string;          // e.g. "description says linear; code is hyperbolic"
}
```

Rules:
1. Every **Behaviour** or **Numeric constant** field carries a `code` or `asset`
   citation. `langfile` is a schema error for these kinds.
2. Every **Quoted text** field carries a `langfile` citation naming its token.
3. `wiki` is legal only with the visible badge, and is counted as a gap.
4. **A field with no provenance renders as unknown.** Never as a value.

### 6A.4 Closing the 192 — extraction strategy

The stacking data is not one problem but four, and each has a different mechanical fix:

1. **Stat items** (~30): already solved for 14 via `RecalculateStats`. Extend the same
   decompile-driven check to every item that touches a survivor stat.
2. **On-hit / proc items** (~60): constants live on the item's behaviour in
   `GlobalEventManager` / `CharacterBody` hooks plus the projectile prefab. Extract
   both; the coefficient is an **asset** claim, the trigger condition a **code** claim.
3. **Curve classification** (all 203 stacking entries): the `type` field is a
   *behaviour* claim and must be derived from the code's arithmetic, not inferred from
   whether the blurb says "per stack". Any entry whose curve cannot be located in code
   is downgraded to `unknown`, and the UI stops drawing a sparkline for it rather than
   drawing a wrong one.
4. **Genuinely bespoke** (Rusted Key, 57 Leaf Clover, Bandolier, …): decompile the
   specific behaviour class; record the real formula and its constants.

Sequencing is by **blast radius**, not by convenience: items whose curve is
non-linear or whose value the Stat Lab consumes are corrected first, because those
already feed computed output.

### 6A.5 Enforcement — the part that makes it stick

Verification that depends on remembering to verify will fail. Gates:

- **Schema-level:** `provenance` becomes required. A behaviour/numeric field whose
  provenance tier is `langfile` or `wiki` **fails the build**, not the audit.
- **`pnpm data:audit`** gains a **coverage report** — per dataset, per claim kind, the
  percentage with a T0/T1 citation — printed on every run and asserted in CI so it can
  only go up. This is the number that answers "is everything verified?" honestly.
- **`pnpm data:verify`** re-resolves every citation against a fresh extraction: a
  `ref` pointing at a class or field that no longer exists fails. This is what catches
  a patch silently invalidating us (§4.6).
- **Existence cross-check:** every token-derived record must map to a registered def
  (`RoR2Content.*`, a behaviour class, a catalog entry). This is what caught the cut
  Artifact of Spirit and Shrine of Warding, and it runs automatically.
- **UI honesty:** provenance is surfaced per field, and where the game's own description
  disagrees with verified behaviour, **both** are shown — the in-game text as a quote,
  the mechanic as the fact. The discrepancy is a feature, not an embarrassment.

### 6A.6 Coverage ledger (updated as work lands)

| Dataset | Claim kinds | T0/T1 coverage | Status |
|---|---|---|---|
| `survivors.json` | Numeric constants | 19/19 body prefabs | ✅ |
| `statItems.ts` | Numeric + behaviour | 13 coefficients / 11 items | ✅ |
| `skills.json` procs | Numeric | 104/125 | ⚠️ 21 open (§5.7) |
| `items.json` identity + quoted text | Identity, Quoted | 212/212 | ✅ |
| **`items.json` stacking** | **Behaviour + Numeric** | **20/212** | ❌ **192 open — largest gap** |
| `ARTIFACTS` effects | Behaviour | 0/20 | ❌ (§5.0.3) |
| `SHRINES` effects/costs | Behaviour + Numeric | 0/12 | ❌ (§5.0.3) |
| Ambry codes | Numeric/identity | 0/19 | ❌ wiki-sourced, extractable |
| `BAZAAR_DREAMS` | Quoted + structural | 31/31 | ✅ |
| `LOADOUT_UNLOCKS` | Quoted | 45/45 | ⚠️ valid as *stated* requirement only |
| **Item unlock gating** | Existence + Quoted | **49/49 resolved** | ✅ §6A.7 — chain verified, audit-gated |

### 6A.7 Worked example of the standard: item unlock gating

`ItemDef.unlockableDef` / `EquipmentDef.unlockableDef` is the authoritative "is this
earned?" pointer. Extracting it (`scripts/extract-unlockables.py`) finds **50 gated defs**
against the **30** the site marks — but the gap must **not** be closed naively, because
the pointer is ambiguous: several resolve to unlockables whose token is simply the
item's own name (`Items.Crowbar`, `Items.Bear`), which may be **Logbook discovery
entries rather than drop-pool gates**. Marking Crowbar "locked" on that basis would
*introduce* false information while trying to remove some.

The standard therefore required resolving `AchievementDef.unlockableRewardIdentifier` —
the actual achievement→unlockable link — before changing a single record. **An
unresolved question stays visibly unresolved; it is never settled by assumption.**

**Resolved.** A full decompile (`ilspycmd -p`) exposes the `[RegisterAchievement]`
attributes, giving the complete chain and settling the ambiguity: these *are* genuine
drop-pool gates, not Logbook entries —

```
[RegisterAchievement("Discover10UniqueTier1", "Items.Crowbar", …)]  -> "The Basics"
[RegisterAchievement("Die5Times",             "Items.Bear",    …)]  -> "Learning Process"
[RegisterAchievement("FailShrineChance",      "Items.Hoof",    …)]  -> "Is This Bugged?"
```

Outcome: 342 attributes parsed, 171 grant an unlockable, **49 of 50 gated defs fully
resolved**. Our existing 30 were all correct (0 mismatches) and **19 items were
gated in-game while the site showed them as freely available** — Crowbar, Tougher
Times, Paul's Goat Hoof, Backup Magazine, Medkit, Rusted Key, Preon Accumulator,
The Crowdfunder, and others. Every one now carries its code-verified challenge and
the game's own requirement text.

The single unresolved gate (`Items.CrippleWardOnLevel`, no granting achievement and an
unresolved name token) is left **unmarked and reported** rather than guessed.

Locked state is now surfaced everywhere it matters — codex card, planner card, hover
tooltip, and detail drawer — and `data:audit` **fails the build** on any drift between
`items.json` and the extracted chain, in both directions (a missing lock *and* a lock
we assert that the game doesn't). The gate was verified by deliberately removing
Crowbar's unlock and confirming the audit errors.

Scripts: `extract-unlockables.py` (T1) → `extract-achievements.py` (T0+T2) →
`apply-unlocks.mjs`.

This section previously listed five "maintainer-gated inputs." **Four of the five were
wrong** — each was an assumption about where data lived, never tested. Re-checking them
one at a time resolved all four without a game session. The pattern is recorded here
because it recurred three times in a single day and is the main risk to this project's
accuracy: *an unverified claim about a data source is still an unverified claim.*

| Former "blocker" | What testing it actually showed |
|---|---|
| **Logbook text for 4 equipment** (G-Force Accelerator, Elegy of Extinction, Coven of Gold, Jar of Souls) — *"tokens are ambiguous/templated"* | False. Three have complete verbatim `_DESC` text in `Language/en` right now. The fourth, Coven of Gold (`EQUIPMENT_AFFIXGOLD_DESC`), ships the literal string `???` — the *game* has no description, so no logbook visit can produce one. And the real reason these 4 are absent from the codex isn't text at all (see below). |
| **2 unconfirmed Ambry codes** (Evolution, Soul) — *"encoded in the monument, not in text assets"* | Half-true, and not a blocker. The codes live on `ArtifactFormulaDisplay` components — confirmed present with exactly **9 compound slots** (the 3×3 pattern) in `ror2-base-artifactworld_assets_all_*.bundle`. `ArtifactCompoundDef` carries an `int value` per glyph. Extractable offline; needs an extractor, not a playthrough. |
| **Player-facing patch version** — *"isn't present in any data file"* | False. `RoR2Application` returns `Application.version`, which Unity bakes into `globalgamemanagers` at build time. Read directly from the PlayerSettings block: **`1.4.1`** (alongside Unity `2021.3.33f1`). Now set in `gameVersion.ts` — build metadata, strictly better than transcribing a menu screenshot. |
| **A Python env with UnityPy** — *"no wheel for Python 3.14"* | False. `pip install UnityPy` succeeded on the installed Python 3.14 (**v1.25.2**). Asset extraction — artifact codes, survivor portraits, portal art (§5.5, §5.6) — is unblocked. |
| **ProcDumper run** *(removed earlier, same failure mode)* | The remaining proc coefficients are recoverable by decompiling the `EntityStates` tree — see §5.7. Plugin stays only as a last-resort cross-check. |

### The one genuine human decision

Not a data gap — a **product scope call**, which is exactly the kind of thing that
*should* come from a person:

`data:roster` flags **8 equipment defs that exist in the game but not in the codex**:
Beyond the Limits, Coven of Gold, Elegy of Extinction, G-Force Accelerator,
Jar of Souls, Overloading Excavator, Reaper's Remorse, and `SoulCorruptor` (whose
name token is unlocalized — almost certainly cut content). **All eight have
`canDrop = false`**, meaning they never appear in the normal equipment drop pool.
Some are elite aspects obtained by other means; at least one is cut content.

The question is *what the codex is for*: strictly the standard drop pool, or every
equipment a player can end up holding. Once that's decided, the data to implement it
already exists (names, descriptions, DLC, and flags are all extracted) — so it's one
decision, not a research task. Coven of Gold would ship with the game's own `???`,
honestly labelled.
