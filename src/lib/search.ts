import Fuse from "fuse.js";
import { items } from "@/data/items";
import type { Item } from "@/data/schema";

/**
 * Fuzzy search over the item corpus (PLAN §3 — "bleed" should find Tri-Tip,
 * Shatterspleen, Needletick). Weighted toward names and tags.
 */
const fuse = new Fuse(items, {
  keys: [
    { name: "name", weight: 3 },
    { name: "tags", weight: 2 },
    { name: "pickupText", weight: 1 },
    { name: "description", weight: 1 },
  ],
  threshold: 0.4,
  ignoreLocation: true,
  minMatchCharLength: 2,
});

/** Returns all items for an empty query, otherwise fuzzy-ranked matches. */
export function searchItems(query: string): Item[] {
  const q = query.trim();
  if (!q) return items;
  return fuse.search(q).map((result) => result.item);
}
