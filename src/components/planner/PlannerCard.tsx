import { type CSSProperties } from "react";
import { Check, Info, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META } from "@/data/items";
import { cn } from "@/lib/utils";
import { ItemTooltip } from "@/components/codex/ItemTooltip";
import type { PlanState } from "@/store/planner";

interface PlannerCardProps {
  item: Item;
  state: PlanState | undefined;
  onCycle: () => void;
  onInfo: () => void;
}

/** Codex card in planner mode: click cycles target/avoid; ⓘ opens details. */
export function PlannerCard({ item, state, onCycle, onInfo }: PlannerCardProps) {
  const tier = TIER_META[item.tier];
  const isTargeted = state === "targeted";
  const isAvoided = state === "avoided";

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onCycle}
        aria-pressed={!!state}
        aria-label={`${item.name}: ${state ?? "neutral"}. Click to cycle target/avoid.`}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-lg border bg-surface p-3 text-center transition",
          isTargeted && "border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.35)]",
          isAvoided && "border-red-500/50 opacity-40 grayscale",
          !state && "border-border hover:border-primary/50",
        )}
        style={!state ? ({ "--tier": tier.color } as CSSProperties) : undefined}
      >
        <img src={item.icon} alt={item.name} loading="lazy" className="size-14 object-contain" />
        <span className="line-clamp-2 text-xs font-medium text-foreground">{item.name}</span>
      </button>

      {/* State badge (top-right). */}
      {isTargeted && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-400 text-black">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {isAvoided && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="size-3.5" strokeWidth={3} />
        </span>
      )}

      {/* Info button (top-left) — opens the detail drawer without cycling. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInfo();
        }}
        aria-label={`Details for ${item.name}`}
        className="absolute left-1.5 top-1.5 rounded-full bg-black/40 p-1 text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Info className="size-3.5" />
      </button>

      {/* Hover/focus tooltip. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <ItemTooltip item={item} />
      </div>
    </div>
  );
}
