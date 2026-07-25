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
