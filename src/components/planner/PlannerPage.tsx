import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/data/schema";
import { items as allItems, itemById } from "@/data/items";
import { decodePlan, hasPlanParams } from "@/lib/planUrl";
import { filterItems } from "@/lib/filterPipeline";
import { CodexFilters } from "@/components/codex/CodexFilters";
import { TierGrid } from "@/components/codex/TierGrid";
import { ItemDetail } from "@/components/codex/ItemDetail";
import { emptyFilters, hasActiveFilter, toggleInSet, type FilterState } from "@/components/codex/filters";
import { usePlanner } from "@/store/planner";
import { PlannerCard } from "./PlannerCard";
import { RunPlanRail } from "./RunPlanRail";

export function PlannerPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [selected, setSelected] = useState<Item | null>(null);

  const plan = usePlanner((s) => s.plan);
  const cycle = usePlanner((s) => s.cycle);
  const importPlan = usePlanner((s) => s.importPlan);

  // A shared link (/planner?t=…&a=…) loads that plan, replacing the local one — the
  // recipient followed the link to see this plan. Unknown ids are dropped. We then
  // strip the query so a refresh keeps the (now-persisted) plan and the URL stays clean.
  useEffect(() => {
    if (!hasPlanParams(window.location.search)) return;
    const shared = decodePlan(window.location.search, (id) => itemById.has(id));
    if (Object.keys(shared).length > 0) importPlan(shared);
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  }, [importPlan]);

  const results = useMemo(() => filterItems(query, filters), [query, filters]);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Run Planner</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Click cards to mark what you want to <span className="text-emerald-400">target</span> or{" "}
          <span className="text-red-400">avoid</span> at printers and scrappers this run. The plan
          is grouped by tier and saved locally.
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
        onToggleLockedOnly={() => setFilters((f) => ({ ...f, lockedOnly: !f.lockedOnly }))}
        onClear={() => {
          setQuery("");
          setFilters(emptyFilters());
        }}
        resultCount={results.length}
        totalCount={allItems.length}
        anyFilter={hasActiveFilter(filters)}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 lg:order-1">
          <TierGrid
            items={results}
            renderCard={(item) => (
              <PlannerCard
                item={item}
                state={plan[item.id]}
                onCycle={() => cycle(item.id)}
                onInfo={() => setSelected(item)}
              />
            )}
          />
        </div>
        <div className="order-1 lg:order-2">
          <RunPlanRail onSelect={setSelected} />
        </div>
      </div>

      <ItemDetail item={selected} onClose={() => setSelected(null)} onSelectItem={setSelected} />
    </div>
  );
}
