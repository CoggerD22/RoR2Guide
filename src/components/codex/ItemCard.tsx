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
        {/*
          Challenge-gated marker (PLAN §5.8). Deliberately solid amber rather than the
          previous faint 12px outline, which was reported as invisible at grid density
          — twice. Tier colour is reserved for item identity (design tokens), so this
          must read without touching the card border.

          Wording note: the site cannot know what THIS player has unlocked. It knows
          the item is gated behind a challenge in general. So it says "Unlocked by",
          never "Locked", which would assert something about the player's save.
        */}
        {item.unlock && (
          <span
            className="absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-black shadow-sm ring-1 ring-black/30"
            title={`Unlocked by ${item.unlock.challenge}${item.unlock.requirement ? ` — ${item.unlock.requirement}` : ""}`}
          >
            <Lock
              className="size-3"
              strokeWidth={2.5}
              aria-label={`Locked behind challenge: ${item.unlock.challenge}`}
            />
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
