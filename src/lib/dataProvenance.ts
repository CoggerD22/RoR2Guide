/**
 * The single sentence that stamps the whole site with what game version its data was
 * verified against (PLAN §4.6). Shown in the footer so the facts visibly age: the date
 * is static and recorded, so a reader can always see how fresh the dataset is.
 *
 * The patch number is included only when it's actually known — never fabricated. Until
 * PATCH_VERSION is filled in, the stamp falls back to the recorded DLC + Steam build,
 * both of which are real provenance (see src/data/gameVersion.ts).
 */
export interface Provenance {
  contentVersion: string;
  buildId: string;
  verifiedOn: string; // ISO date
  patchVersion: string | null;
}

/** Pure formatter (so both branches are unit-testable without module mocking). */
export function dataVerifiedAgainst(p: Provenance): string {
  const against = p.patchVersion
    ? `patch ${p.patchVersion} (${p.contentVersion}, Steam build ${p.buildId})`
    : `${p.contentVersion} (Steam build ${p.buildId})`;
  return `Data verified against ${against} on ${p.verifiedOn}.`;
}

/**
 * How much of the item dataset has been traced to the game's code or assets, versus
 * merely transcribed from its description text (PLAN §6B.2/§6B.3).
 *
 * Stated publicly and precisely because the difference is large and matters: about one
 * in five records examined so far has been wrong in a way transcription could not
 * catch. A site that publishes its own coverage is trustworthy in a way that one
 * implying uniform confidence is not.
 */
export function coverageSummary(items: Array<{ confidence?: string }>): {
  verified: number;
  total: number;
  percent: number;
  sentence: string;
} {
  const total = items.length;
  const verified = items.filter(
    (i) => i.confidence === "code" || i.confidence === "asset",
  ).length;
  const percent = total ? Math.round((verified / total) * 100) : 0;
  return {
    verified,
    total,
    percent,
    sentence:
      `${verified} of ${total} items (${percent}%) have their stacking values traced to the ` +
      `game's code or assets. The rest are transcribed from in-game text and are labelled ` +
      `as unverified wherever their numbers appear.`,
  };
}
