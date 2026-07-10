import { useMemo, useState } from "react";
import type { Item } from "@/data/schema";
import { items as allItems } from "@/data/items";
import { searchItems } from "@/lib/search";
import { CodexFilters } from "./CodexFilters";
import { CodexGrid } from "./CodexGrid";
import { ItemDetail } from "./ItemDetail";
import { emptyFilters, hasActiveFilter, toggleInSet, type FilterState } from "./filters";

export function CodexPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selected, setSelected] = useState<Item | null>(null);

  const results = useMemo(() => {
    const base = searchItems(query);
    return base.filter((it) => {
      if (filters.hideVariants && it.subtype) return false;
      if (filters.tiers.size > 0 && !filters.tiers.has(it.tier)) return false;
      if (filters.dlcs.size > 0 && !filters.dlcs.has(it.dlc)) return false;
      if (filters.stacking.size > 0 && !it.stacking.some((s) => filters.stacking.has(s.type)))
        return false;
      if (filters.tags.size > 0 && !it.tags.some((t) => filters.tags.has(t))) return false;
      return true;
    });
  }, [query, filters]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Item Codex</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {allItems.length} items so far — Common and Uncommon tiers. Hover a card for its
          in-game tooltip; click for full details.
        </p>
      </header>

      <CodexFilters
        query={query}
        onQueryChange={setQuery}
        filters={filters}
        onToggleTier={(t) => setFilters((f) => ({ ...f, tiers: toggleInSet(f.tiers, t) }))}
        onToggleDlc={(d) => setFilters((f) => ({ ...f, dlcs: toggleInSet(f.dlcs, d) }))}
        onToggleStacking={(s) => setFilters((f) => ({ ...f, stacking: toggleInSet(f.stacking, s) }))}
        onToggleTag={(t) => setFilters((f) => ({ ...f, tags: toggleInSet(f.tags, t) }))}
        onToggleHideVariants={() => setFilters((f) => ({ ...f, hideVariants: !f.hideVariants }))}
        onClear={() => {
          setQuery("");
          setFilters(emptyFilters());
        }}
        resultCount={results.length}
        totalCount={allItems.length}
        anyFilter={hasActiveFilter(filters)}
      />

      <CodexGrid items={results} onSelect={setSelected} />

      <ItemDetail item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
