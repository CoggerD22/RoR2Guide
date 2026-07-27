import { CONTENT_VERSION, GAME_BUILD_ID, PATCH_VERSION, VERIFIED_ON } from "@/data/gameVersion";
import { dataVerifiedAgainst, coverageSummary } from "@/lib/dataProvenance";
import { items } from "@/data/items";

/**
 * Non-affiliation disclaimer is a non-negotiable requirement
 * (CLAUDE.md rule #6 / PLAN intro). Do not remove.
 */
export function Footer() {
  const coverage = coverageSummary(items);
  const provenance = dataVerifiedAgainst({
    contentVersion: CONTENT_VERSION,
    buildId: GAME_BUILD_ID,
    verifiedOn: VERIFIED_ON,
    patchVersion: PATCH_VERSION,
  });

  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs leading-relaxed text-muted-foreground sm:px-6">
        <p>
          A fan-made, non-commercial companion for Risk of Rain 2.{" "}
          <strong className="font-medium text-foreground">
            Not affiliated with Gearbox Publishing or Hopoo Games.
          </strong>
        </p>
        <p>
          All item art, names, and descriptions belong to Gearbox Publishing. Game data is
          sourced from the community wiki and the game&rsquo;s own language files.
        </p>
        {/* Verification stamp (PLAN §4.6): the recorded date makes the data visibly age. */}
        <p className="text-muted-foreground/80">{provenance}</p>
        {/* Publish the coverage gap rather than letting the stamp above imply the
            whole dataset is code-verified (PLAN §6B.2). */}
        <p className="text-muted-foreground/80">{coverage.sentence}</p>
      </div>
    </footer>
  );
}
