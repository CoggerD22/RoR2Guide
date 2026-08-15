import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META } from "@/data/items";
import { asset } from "@/lib/asset";
import { ItemTooltip } from "./ItemTooltip";
import { DlcBadge } from "./DlcBadge";
import { useDisplay } from "@/store/display";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  item: Item;
  onSelect: (item: Item) => void;
}

export function ItemCard({ item, onSelect }: ItemCardProps) {
  const tier = TIER_META[item.tier];
  const density = useDisplay((s) => s.density);
  const showDescriptions = useDisplay((s) => s.showDescriptions);
  const showNames = useDisplay((s) => s.showNames);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(item)}
        className={cn(
          "tier-card flex w-full flex-col items-center rounded-lg bg-surface text-center",
          density === "comfortable" && "gap-2 p-3",
          density === "compact" && "gap-1.5 p-2",
          density === "dense" && "gap-1 p-1.5",
        )}
        style={{ "--tier": tier.color } as CSSProperties}
      >
        <img
          src={asset(item.icon)}
          alt={item.name}
          loading="lazy"
          className={cn(
            "object-contain [image-rendering:auto]",
            density === "comfortable" && "size-14",
            density === "compact" && "size-10",
            density === "dense" && "size-8",
          )}
        />
        {showNames && (
          <span
            className={cn(
              "line-clamp-2 font-medium text-foreground",
              density === "compact" ? "text-[11px] leading-tight" : "text-xs",
            )}
          >
            {item.name}
          </span>
        )}
        {/*
          Full description inline (PLAN §8.2). Left-aligned because centred body text is
          hard to read, and the whole point of this mode is reading rather than scanning.
        */}
        {showDescriptions && (
          <p className="mt-0.5 w-full text-left text-[10px] leading-snug text-muted-foreground">
            {item.description}
          </p>
        )}
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
        <DlcBadge dlc={item.dlc} className="absolute bottom-1 right-1" />
        {!item.verified && (
          <span
            className="absolute right-1.5 top-1.5 size-2 rounded-full bg-amber-400"
            /*
              The wording, not the dot. "Pending logbook confirmation" described how this
              project verified things in M1 — reading the in-game logbook. It has verified
              against decompiled code and serialized assets since §6A, so if this branch
              ever rendered it would tell a reader we work in a way we abandoned. The
              branch is currently unreachable (every record is verified:true) which is
              exactly why it went unnoticed (PLAN §9.1).
            */
            title="Not yet checked against the game's code or assets"
          />
        )}
      </button>

      {/*
        Hover/focus tooltip, positioned above the card.

        `hidden sm:block` is a layout fix, not a taste call (§3j.149). The panel is `w-64`
        (256px) and centred on the card with -translate-x-1/2, so on cards near the right edge
        of a 360px viewport its box reached 421px and made the whole DOCUMENT scroll sideways —
        while being invisible, because opacity-0 still takes part in layout. Below `sm` it is
        also unreachable: there is no hover on touch, and a 256px panel cannot fit anyway.
        Tapping the card opens the drawer, which carries strictly more than the tooltip does.
      */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:block">
        <ItemTooltip item={item} />
      </div>
    </div>
  );
}
