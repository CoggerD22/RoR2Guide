/**
 * Which build of the game the datasets were verified against.
 *
 * `GAME_BUILD_ID` is the Steam build the extractors last ran on — real provenance,
 * not a guess. Bump both of these after a game patch, which is also when you re-run
 * `scripts/decompile.sh` + `scripts/extract-bodies.py` and then `pnpm data:verify`.
 *
 * `CONTENT_VERSION` is the player-facing marker guides stamp themselves with; when a
 * guide's stamp no longer matches, it shows a staleness banner (PLAN §4.2).
 */
export const CONTENT_VERSION = "Alloyed Collective";

/** Steam buildid of the install the data was extracted/verified from. */
export const GAME_BUILD_ID = "21587608";

/** ISO date of the last full verification pass. */
export const VERIFIED_ON = "2026-07-19";
