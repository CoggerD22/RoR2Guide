import type { CSSProperties } from "react";
import type { Item } from "@/data/schema";
import { TIER_META } from "@/data/items";
import { highlightNumbers } from "@/lib/highlight";
import { StackingBadge } from "./StackingBadge";
import { itemStackingTypes } from "@/lib/stacking";

/** In-game-style tooltip: dark panel, icon left, bold white name, gray body. */
export function ItemTooltip({ item }: { item: Item }) {
  const tier = TIER_META[item.tier];
  const types = itemStackingTypes(item.stacking);

  return (
    <div
      className="w-64 rounded-md border border-border bg-[#0a1120] p-3 text-left shadow-2xl"
      style={{ "--tier": tier.color } as CSSProperties}
    >
      <div className="flex items-center gap-2">
        <img
          src={item.icon}
          alt=""
          className="size-9 shrink-0 rounded-sm"
          style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--tier) 60%, transparent)" }}
        />
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight text-white">{item.name}</div>
          <div className="text-[11px] font-medium" style={{ color: "var(--tier)" }}>
            {tier.label}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {highlightNumbers(item.description)}
      </p>
      {types.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {types.map((t) => (
            <StackingBadge key={t} type={t} />
          ))}
        </div>
      )}
    </div>
  );
}
