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

/**
 * Player-facing game patch/version string — the number shown on the game's main menu
 * (e.g. "Version 1.4.x"). Deliberately UNVERIFIED: it has not been read from the game,
 * and CLAUDE.md rule #1 forbids guessing a number. Left null so the stamp falls back to
 * the DLC name + Steam build (which ARE recorded). Fill this in from the main menu after
 * the next play session, then bump VERIFIED_ON.
 */
export const PATCH_VERSION: string | null = null; // TODO: record exact patch string from the game's main menu
