import type { Item } from "@/data/schema";
import { searchItems } from "@/lib/search";
import type { FilterState } from "@/components/codex/filters";

/**
 * Shared query → filter pipeline used by both the codex (browse) and the
 * planner. Runs fuzzy search first, then applies the chip filters.
 */
export function filterItems(query: string, filters: FilterState): Item[] {
  const base = searchItems(query);
  return base.filter((it) => {
    if (filters.hideVariants && it.subtype) return false;
    if (filters.tiers.size > 0 && !filters.tiers.has(it.tier)) return false;
    if (filters.dlcs.size > 0 && !filters.dlcs.has(it.dlc)) return false;
    if (filters.stacking.size > 0 && !it.stacking.some((s) => filters.stacking.has(s.type)))
      return false;
    if (filters.tags.size > 0 && !it.tags.some((t) => filters.tags.has(t))) return false;
    if (filters.lockedOnly && !it.unlock) return false;
    return true;
  });
}
