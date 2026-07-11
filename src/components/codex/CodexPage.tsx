import { useMemo, useState } from "react";
import type { Item } from "@/data/schema";
import { items as allItems } from "@/data/items";
import { filterItems } from "@/lib/filterPipeline";
import { CodexFilters } from "./CodexFilters";
import { CodexGrid } from "./CodexGrid";
import { ItemDetail } from "./ItemDetail";
import { emptyFilters, hasActiveFilter, toggleInSet, type FilterState } from "./filters";

export function CodexPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selected, setSelected] = useState<Item | null>(null);

  const results = useMemo(() => filterItems(query, filters), [query, filters]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Item Codex</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {allItems.length} items across every tier and DLC. Hover a card for its in-game
          tooltip; click for full details.
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

      <ItemDetail item={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} />
    </div>
  );
}
