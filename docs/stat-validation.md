# In-game stat validation sheet (Phase 4)

The stat engine (`src/lib/statMath.ts`) is verified against the game's decompiled
`CharacterBody.RecalculateStats()` (Phase 2). Survivor **base stats**, however,
live in Unity prefab asset bundles — not in `RoR2.dll` — so they cannot be
decompiled and currently trace to riskofrain2.wiki.gg. This sheet closes that gap
by hand: load each scenario in-game and compare the character screen / stat panel
to the expected values below.

## How to validate

1. **Difficulty must be Rainstorm** (regen figures are the Rainstorm values).
2. No artifacts enabled (Command is fine; Glass/Honor/etc. off).
3. Fresh character, no items, then add exactly the listed items via the Command
   artifact or a sandbox/console. Read stats from the pause-menu character panel.
4. A mismatch on a **Level-1 no-items** row means a survivor **base stat** in
   `survivors.json` is wrong → fix the JSON. A mismatch on a **scenario** row
   (items/level) would mean an engine bug → reopen Phase 2.
5. Record results in the "Status" column and report any deltas.

Values are rounded the way the panel displays them. Regen is HP/second, Atk Spd is
the multiplier (1.00 = base), Move is m/s, Damage is per-hit base damage.

### All survivors — Level 1, no items (base stats)
| Survivor | HP | Regen/s | Damage | Move m/s | Armor | Atk Spd | Jumps | Status |
|---|--:|--:|--:|--:|--:|--:|--:|:--|
| Commando | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Huntress | 90 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Engineer | 130 | 1 | 14 | 7 | 0 | 1 | 1 | |
| MUL-T | 200 | 1 | 11 | 7 | 12 | 1 | 1 | |
| Artificer | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Mercenary | 110 | 1 | 12 | 7 | 20 | 1 | 2 | |
| Bandit | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Loader | 160 | 2.5 | 12 | 7 | 20 | 1 | 1 | |
| Acrid | 160 | 2.5 | 15 | 7 | 20 | 1 | 1 | |
| Captain | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| REX | 130 | 1 | 12 | 7 | 20 | 1 | 1 | |
| Heretic | 440 | -6 | 18 | 8 | 0 | 1 | 3 | |
| Railgunner | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Void Fiend | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Seeker | 115 | 0.75 | 12 | 7 | 20 | 1 | 1 | |
| Chef | 110 | 1 | 12 | 7 | 0 | 1 | 1 | |
| False Son | 180 | 1 | 12 | 7 | 0 | 1 | 1 | |
| Drifter | 170 | 1 | 12 | 7 | 20 | 1 | 1 | |
| Operator | 90 | 1 | 12 | 7 | 0 | 1 | 1 | |

### Targeted scenarios
| Survivor | Lvl | Items | HP | Regen/s | Dmg | Move | Atk | Crit% | Jumps | Status |
|---|--:|---|--:|--:|--:|--:|--:|--:|--:|:--|
| Commando | 30 | none | 1067 | 6.8 | 81.6 | 7 | 1 | 1 | 1 | |
| Commando | 1 | 5x lens-makers-glasses | 110 | 1 | 12 | 7 | 1 | 51 | 1 | |
| Commando | 1 | 5x pauls-goat-hoof | 110 | 1 | 12 | 11.9 | 1 | 1 | 1 | |
| Commando | 1 | 3x hopoo-feather | 110 | 1 | 12 | 7 | 1 | 1 | 4 | |
| Commando | 1 | 4x soldiers-syringe | 110 | 1 | 12 | 7 | 1.6 | 1 | 1 | |
| Commando | 20 | 2x titanic-knurl | 817 | 20.2 | 57.6 | 7 | 1 | 1 | 1 | |
| Commando | 45 | 4x titanic-knurl | 1722 | 72.5 | 117.6 | 7 | 1 | 1 | 1 | |
| Mercenary | 35 | 3x soldiers-syringe, 2x lens-makers-glasses | 1232 | 7.8 | 93.6 | 7 | 1.45 | 21 | 2 | |

