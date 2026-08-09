import { describe, expect, test } from "vitest";
import { searchItems } from "./search";
import { filterItems } from "./filterPipeline";
import { items } from "@/data/items";
import type { FilterState } from "@/components/codex/filters";

const noFilters = (): FilterState => ({
  tiers: new Set(),
  dlcs: new Set(),
  stacking: new Set(),
  tags: new Set(),
  hideVariants: false,
  lockedOnly: false,
});

describe("searchItems", () => {
  test("an empty or whitespace query returns the whole corpus", () => {
    expect(searchItems("")).toHaveLength(items.length);
    expect(searchItems("   ")).toHaveLength(items.length);
  });

  test("finds items by mechanic word, not just by name (PLAN §3)", () => {
    const names = searchItems("bleed").map((i) => i.name);
    expect(names).toContain("Tri-Tip Dagger");
    expect(names).toContain("Shatterspleen");
  });

  /**
   * `minMatchCharLength: 2` means a ONE-character query can match nothing at all. The search
   * box filters as you type, so this is the state the UI is in after the very first keystroke
   * of every search anyone ever performs. Whatever it returns, it must not be an empty list
   * presented as "no results" — that reads as "this site has no items matching 'b'", which is
   * false for a corpus containing Brainstalks, Bustling Fungus and Bison Steak.
   */
  test("a single character does not wipe the corpus", () => {
    const one = searchItems("b");
    expect(one.length, "one character returned nothing — the UI shows an empty codex").toBeGreaterThan(0);
  });

  test("a single character ranks name-prefix matches first", () => {
    // The useful answer for "b" is items whose NAME starts with b, not the best fuzzy score
    // across every field. At minMatchCharLength 1 Fuse put Topaz Brooch top of 187 results.
    const out = searchItems("b");
    expect(out[0].name.toLowerCase().startsWith("b")).toBe(true);
    const firstNonPrefix = out.findIndex((i) => !i.name.toLowerCase().startsWith("b"));
    const lastPrefix = out.map((i) => i.name.toLowerCase().startsWith("b")).lastIndexOf(true);
    // Every prefix match precedes every non-prefix match.
    expect(firstNonPrefix === -1 || lastPrefix < firstNonPrefix).toBe(true);
  });

  test("a single character still finds well-known items", () => {
    const names = searchItems("b").map((i) => i.name);
    for (const n of ["Bison Steak", "Brainstalks", "Bustling Fungus"]) {
      expect(names, `"b" did not find ${n}`).toContain(n);
    }
  });

  test("two characters go back to fuzzy ranking", () => {
    // The short-query path must not swallow ordinary queries: "cr" is fuzzy, and finds
    // Crowbar even though other items merely contain the letters.
    expect(searchItems("cr").map((i) => i.name)).toContain("Crowbar");
  });

  test("regex metacharacters in a query do not throw", () => {
    for (const q of ["(", "[", "*", "\\", ".*", "a|b", "$^"]) {
      expect(() => searchItems(q), `query ${JSON.stringify(q)} threw`).not.toThrow();
    }
  });

  test("a query matching nothing returns an empty list rather than everything", () => {
    expect(searchItems("zzzzzzqqqqq")).toHaveLength(0);
  });
});

describe("filterItems", () => {
  test("no filters and no query is the identity", () => {
    expect(filterItems("", noFilters())).toHaveLength(items.length);
  });

  test("tier filter keeps only that tier", () => {
    const f = noFilters();
    f.tiers.add("legendary");
    const out = filterItems("", f);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => i.tier === "legendary")).toBe(true);
  });

  test("a stacking-type filter excludes items with no stacking rows", () => {
    const f = noFilters();
    f.stacking.add("linear");
    const out = filterItems("", f);
    expect(out.every((i) => i.stacking.length > 0)).toBe(true);
  });

  test("lockedOnly keeps only items with an unlock", () => {
    const f = noFilters();
    f.lockedOnly = true;
    const out = filterItems("", f);
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((i) => !!i.unlock)).toBe(true);
  });

  test("filters compose (tier AND dlc), rather than either-or", () => {
    const f = noFilters();
    f.tiers.add("common");
    f.dlcs.add("base");
    const out = filterItems("", f);
    expect(out.every((i) => i.tier === "common" && i.dlc === "base")).toBe(true);
  });
});
