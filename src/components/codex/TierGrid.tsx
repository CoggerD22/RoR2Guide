import { Fragment, type ReactNode } from "react";
import { SearchX } from "lucide-react";
import type { Item } from "@/data/schema";
import { PRESENT_TIERS, TIER_META } from "@/data/items";
import { cn } from "@/lib/utils";
import { DENSITY_GRID, useDisplay } from "@/store/display";

interface TierGridProps {
  items: Item[];
  renderCard: (item: Item) => ReactNode;
}

/** Groups items by tier (in display order) and renders a card per item. */
export function TierGrid({ items, renderCard }: TierGridProps) {
  const density = useDisplay((d) => d.density);
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-20 text-center text-muted-foreground">
        <SearchX className="size-8" aria-hidden />
        <p className="text-sm">No items match those filters.</p>
      </div>
    );
  }

  const groups = PRESENT_TIERS.map((tier) => ({
    tier,
    list: items.filter((it) => it.tier === tier),
  })).filter((g) => g.list.length > 0);

  return (
    <div className="flex flex-col gap-8">
      {groups.map(({ tier, list }) => {
        const color = TIER_META[tier].color;
        return (
          <section key={tier}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{
                  background: color,
                  boxShadow: `0 0 8px color-mix(in srgb, ${color} 70%, transparent)`,
                }}
              />
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color }}>
                {TIER_META[tier].label}
              </h2>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </div>
            <div className={cn("grid", DENSITY_GRID[density])}>
              {list.map((item) => (
                <Fragment key={item.id}>{renderCard(item)}</Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
