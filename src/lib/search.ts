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

/**
 * Returns all items for an empty query, otherwise fuzzy-ranked matches.
 *
 * SHORT QUERIES ARE NOT FUZZY. `minMatchCharLength: 2` means Fuse cannot match a
 * single-character query at all, and the codex filters as you type — so the first keystroke
 * of every search anyone performs was rendering an empty codex reading "no items match". That
 * is false for a corpus containing Brainstalks, Bison Steak and Bustling Fungus.
 *
 * Lowering the threshold is not the fix either: at `minMatchCharLength: 1` a query of "b"
 * matches 187 of 217 items and ranks Topaz Brooch above all of them, because one character is
 * far too little signal for a fuzzy ranker. What a person typing "b" wants is items whose
 * NAME BEGINS with b, so that is what a one-character query does — prefix matches first, then
 * anything else containing the letter in its name or tags.
 */
export function searchItems(query: string): Item[] {
  const q = query.trim();
  if (!q) return items;

  if (q.length < 2) {
    const needle = q.toLowerCase();
    const prefix: Item[] = [];
    const elsewhere: Item[] = [];
    for (const it of items) {
      const name = it.name.toLowerCase();
      if (name.startsWith(needle)) prefix.push(it);
      else if (name.includes(needle) || it.tags.some((t) => t.toLowerCase().includes(needle))) {
        elsewhere.push(it);
      }
    }
    return [...prefix, ...elsewhere];
  }

  return fuse.search(q).map((result) => result.item);
}
