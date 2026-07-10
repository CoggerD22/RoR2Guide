import { SearchX } from "lucide-react";
import type { Item } from "@/data/schema";
import { PRESENT_TIERS, TIER_META } from "@/data/items";
import { ItemCard } from "./ItemCard";

interface CodexGridProps {
  items: Item[];
  onSelect: (item: Item) => void;
}

export function CodexGrid({ items, onSelect }: CodexGridProps) {
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
              <h2
                className="text-sm font-semibold uppercase tracking-widest"
                style={{ color }}
              >
                {TIER_META[tier].label}
              </h2>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
              {list.map((item) => (
                <ItemCard key={item.id} item={item} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
