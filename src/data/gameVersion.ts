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
export const VERIFIED_ON = "2026-07-30";

/**
 * Player-facing game patch/version string — what the game's main menu shows.
 *
 * Source: Unity's `bundleVersion`, in the install's `globalgamemanagers` PlayerSettings
 * block — the same value `Application.version` returns at runtime, so it is build
 * metadata rather than a guess. Re-verified 2026-07-30: it is the only version-shaped
 * string in that file apart from the Unity version itself (2021.3.33).
 *
 * An earlier note here claimed it "sits directly after Hopoo Games, LLC / Risk of Rain 2".
 * It does not — the company and product names are followed by a long run of padding and
 * the version appears well after. The value was right; the instruction for re-finding it
 * was not, which is the kind of detail that turns a 30-second re-check into a wrong guess
 * after the next patch.
 */
export const PATCH_VERSION: string | null = "1.4.1";
