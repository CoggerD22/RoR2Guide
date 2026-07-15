# In-game stat validation (optional end-to-end spot-check)

**You do not need to do this to trust the numbers.** Both halves of the stat math
now trace to game data automatically:

| Input | Source | Checked by |
|---|---|---|
| Formulas / order of operations | decompiled `CharacterBody.RecalculateStats()` | `pnpm data:verify` (coefficients + live grep) |
| Item coefficients | decompiled `RecalculateStats()` | `pnpm data:verify` |
| Survivor base stats | body **prefabs** in the Addressables bundles | `pnpm data:verify` (19 × 10 fields, 0 mismatches) |

This file used to contain a 19-survivor table to fill in by hand from the Logbook.
That is obsolete: `scripts/extract-bodies.py` reads those values straight out of the
game's bundles in ~15 seconds, which is the same data the Logbook renders — but
exact, complete, and re-runnable after a patch. See MATH-VERIFICATION.md, Phase 3.

## What's left that in-game *could* still catch

Only things neither the code nor the prefabs express — i.e. whether our **model**
omits an effect that exists in the real game (a buff, a hidden multiplier, a
conditional we didn't model). The scenarios below exercise the engine end-to-end.
They're a sanity net, not a dependency.

To run one: Rainstorm difficulty, no stat-altering artifacts, spawn the listed items
(Artifact of Command, or DebugToolkit's `give_item`), and compare a live stat readout.

| Survivor | Lvl | Items | HP | Regen/s | Dmg | Move | Atk | Crit% | Jumps |
|---|--:|---|--:|--:|--:|--:|--:|--:|--:|
| Commando | 30 | none | 1067 | 6.8 | 81.6 | 7 | 1 | 1 | 1 |
| Commando | 1 | 5x lens-makers-glasses | 110 | 1 | 12 | 7 | 1 | 51 | 1 |
| Commando | 1 | 5x pauls-goat-hoof | 110 | 1 | 12 | 11.9 | 1 | 1 | 1 |
| Commando | 1 | 3x hopoo-feather | 110 | 1 | 12 | 7 | 1 | 1 | 4 |
| Commando | 1 | 4x soldiers-syringe | 110 | 1 | 12 | 7 | 1.6 | 1 | 1 |
| Commando | 20 | 2x titanic-knurl | 817 | 20.2 | 57.6 | 7 | 1 | 1 | 1 |
| Commando | 45 | 4x titanic-knurl | 1722 | 72.5 | 117.6 | 7 | 1 | 1 | 1 |
| Mercenary | 35 | 3x soldiers-syringe, 2x lens-makers-glasses | 1232 | 7.8 | 93.6 | 7 | 1.45 | 21 | 2 |

The Titanic Knurl rows are the most interesting: they exercise the level-scaled item
regen (`×(1 + 0.2·(level−1))`) that the decompiled code revealed and our engine was
previously getting wrong.
