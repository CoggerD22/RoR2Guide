/**
 * Non-affiliation disclaimer is a non-negotiable requirement
 * (CLAUDE.md rule #6 / PLAN intro). Do not remove.
 */
export function Footer() {
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
      </div>
    </footer>
  );
}
