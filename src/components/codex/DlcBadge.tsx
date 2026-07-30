import type { Dlc } from "@/data/schema";
import { DLC_META } from "@/data/items";
import { cn } from "@/lib/utils";

/**
 * Which release an item comes from, on the card itself (PLAN §8.1).
 *
 * Base-game items are badged too. An absent badge reads as "we forgot to label this one",
 * and the point of the marker is to scan a grid and see the mix — which only works if
 * every card carries one.
 *
 * Neutral colours by design: tier colour is reserved for item identity (CLAUDE.md design
 * tokens), so this must be legible without competing with the card border.
 */
const DLC_ABBR: Record<Dlc, string> = {
  base: "1",
  sotv: "V",
  sots: "S",
  ac: "A",
};

export function DlcBadge({ dlc, className }: { dlc: Dlc; className?: string }) {
  const meta = DLC_META[dlc];
  return (
    <span
      className={cn(
        "pointer-events-none flex size-4 items-center justify-center rounded-[4px] text-[9px] font-bold leading-none",
        "bg-black/55 text-foreground/85 ring-1 ring-white/15",
        className,
      )}
      title={meta.label}
      aria-label={`Expansion: ${meta.label}`}
    >
      {DLC_ABBR[dlc]}
    </span>
  );
}
