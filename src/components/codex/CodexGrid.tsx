import type { Item } from "@/data/schema";
import { TierGrid } from "./TierGrid";
import { ItemCard } from "./ItemCard";

interface CodexGridProps {
  items: Item[];
  onSelect: (item: Item) => void;
}

export function CodexGrid({ items, onSelect }: CodexGridProps) {
  return (
    <TierGrid
      items={items}
      renderCard={(item) => <ItemCard item={item} onSelect={onSelect} />}
    />
  );
}
