import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META } from "@/data/items";
import { asset } from "@/lib/asset";
import { ItemTooltip } from "./ItemTooltip";

interface ItemCardProps {
  item: Item;
  onSelect: (item: Item) => void;
}

export function ItemCard({ item, onSelect }: ItemCardProps) {
  const tier = TIER_META[item.tier];

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(item)}
        className="tier-card flex w-full flex-col items-center gap-2 rounded-lg bg-surface p-3 text-center"
        style={{ "--tier": tier.color } as CSSProperties}
      >
        <img
          src={asset(item.icon)}
          alt={item.name}
          loading="lazy"
          className="size-14 object-contain [image-rendering:auto]"
        />
        <span className="line-clamp-2 text-xs font-medium text-foreground">{item.name}</span>
        {item.unlock && (
          <span
            className="absolute left-1.5 top-1.5 rounded-full bg-black/50 p-0.5 text-amber-400/80"
            title={`Locked — ${item.unlock.challenge}${item.unlock.requirement ? `: ${item.unlock.requirement}` : ""}`}
          >
            <Lock className="size-3" aria-label={`Locked behind challenge: ${item.unlock.challenge}`} />
          </span>
        )}
        {!item.verified && (
          <span
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-400"
            title="Unverified — pending logbook confirmation"
          />
        )}
      </button>

      {/* Hover/focus tooltip, positioned above the card. */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
        <ItemTooltip item={item} />
      </div>
    </div>
  );
}
