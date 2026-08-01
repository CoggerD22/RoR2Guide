import type { Item } from "@/data/schema";
import { TierGrid } from "./TierGrid";
import { ItemCard } from "./ItemCard";

interface CodexGridProps {
  items: Item[];
  onSelect: (item: Item) => void;
  /** Passed through so the empty state can name the search rather than blaming filters. */
  query?: string;
}

export function CodexGrid({ items, onSelect, query }: CodexGridProps) {
  return (
    <TierGrid
      items={items}
      query={query}
      renderCard={(item) => <ItemCard item={item} onSelect={onSelect} />}
    />
  );
}
