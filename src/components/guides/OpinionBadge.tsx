/**
 * Marks subjective content (CLAUDE.md rule #7 / PLAN §4.2). Deliberately
 * high-contrast: the whole point is that a reader can tell at a glance that this
 * is someone's judgement, not the verified mechanical data in the codex.
 */
export function OpinionBadge() {
  return (
    <span
      title="Subjective content — one author's judgement, not verified game data"
      className="rounded-full border border-tier-lunar/50 bg-tier-lunar/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-tier-lunar"
    >
      Opinion
    </span>
  );
}
