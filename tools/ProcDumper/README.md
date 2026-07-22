# Proc Dumper — runtime proc-coefficient verification

A small BepInEx plugin that records the proc coefficient the game **actually uses**
when an attack fires, plus the EntityState that was running at the time. It is the
one source that can settle the skills our static decompile analysis can't reach
(MATH-VERIFICATION.md Phase 5), and it independently double-checks the ~101 values
we already extracted.

## Status — read this

- **Compiles cleanly against the real game + BepInEx assemblies** (RoR2.dll,
  0Harmony, UnityEngine, the Unity HLAPI networking dll). Every field and signature
  it touches was validated by the C# compiler, not assumed.
- **It has NOT been run in-game** — that step needs the game launched with the mod,
  which is yours to do. Treat the first run as the actual test. If a patch fails to
  apply, BepInEx logs it and the game still runs (all patches are read-only prefixes,
  so they can't affect gameplay).

## What it does / doesn't record

- Hooks `BulletAttack.Fire`, `OverlapAttack.Fire`, `BlastAttack.Fire`. Each carries a
  `procCoefficient` on the instance — these are the hitscan/melee cases static
  analysis handles worst.
- **Projectiles are intentionally not hooked.** `FireProjectileInfo` has no
  `procCoefficient` field (verified in the decompile) — a projectile's proc lives on
  its prefab and is already extracted statically. Nothing to observe at fire time.
- Attribution is honest-by-listing: it logs every `EntityStateMachine` on the attacker
  with its current state, rather than guessing which machine is responsible. When a
  skill fires from a sub-state (scope/charge kits), the row shows that sub-state.

## Build

```
dotnet build -c Release tools/ProcDumper/ProcDumper.csproj
```

Paths default to this machine's install and the Thunderstore "Testing" profile.
Override if needed:

```
dotnet build -c Release tools/ProcDumper/ProcDumper.csproj \
  -p:GameDir="D:\path\to\Risk of Rain 2" \
  -p:BepInExCore="D:\path\to\profile\BepInEx\core"
```

Output: `tools/ProcDumper/bin/Release/ProcDumper.dll`.

## Install & run

1. Copy `ProcDumper.dll` into a BepInEx profile's `BepInEx/plugins/` folder. The
   Thunderstore **Testing** profile already has BepInEx 5, R2API, and **DebugToolkit**
   (console commands), which makes controlled runs easy.
2. Launch the game **through that profile** (r2modman / Thunderstore MM → Start modded).
3. Start a run. With DebugToolkit's console (default `` Ctrl+Alt+` ``):
   - `give_item` / `next_stage` / level up as needed, or just play.
   - **Fire each skill you care about at least once.** Coverage is only what you fire.
   - The 24 still-unverified skills are the ones worth deliberately using — especially
     the movement/stance ones (to confirm they truly produce no attack) and REX's
     DIRECTIVE: Disperse (dynamic proc).
4. Output is written to `<profile>/BepInEx/proc-dump.csv`, one row per distinct
   `(state, kind, proc)` seen. Duplicate fires are de-duplicated so a minigun primary
   doesn't write 10,000 lines.

## Reconcile against the dataset

```
node scripts/reconcile-proc-dump.mjs "<profile>/BepInEx/proc-dump.csv"
```

Reports four buckets and never edits data:

- **CONFIRMED** — runtime matches the static value. Strengthens confidence.
- **CONFLICT** — runtime disagrees. One source is wrong; investigate before trusting
  either. (The script exits non-zero if any exist.)
- **NEW** — a state we had no static value for; runtime supplies one. Candidate to
  curate into `skills.json` (which back the values with an "observed" provenance).
- **INCONSISTENT** — a state that fired with more than one proc, i.e. genuinely
  conditional. Worth a note rather than a single number.

CSV columns: `kind, proc, attackerBody, machine, state`.
