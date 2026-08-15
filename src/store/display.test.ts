import { describe, expect, it } from "vitest";
import { DENSITIES, DENSITY_GRID, DENSITY_LABEL, DENSITY_HINT, type Density } from "./display";

/**
 * §3j.158 — `display.ts` had no test, and the mutation sweep found two holes in it.
 *
 * The density strings are Tailwind class lists, so nothing type-checks their CONTENT: a density
 * that quietly stops defining columns at a breakpoint still compiles, still renders, and simply
 * stops responding at that width while its siblings keep working.
 *
 * The store's own sanitisation defect is covered end-to-end in `tests/errors.spec.ts` — a
 * corrupt `density` made `DENSITY_GRID[density]` undefined and collapsed the codex to a single
 * column, which is a browser-level fact and belongs in a browser test.
 */
const breakpointsOf = (classes: string) =>
  new Set(
    classes
      .split(/\s+/)
      .filter((c) => c.includes("grid-cols-"))
      .map((c) => (c.includes(":") ? c.split(":")[0] : "base")),
  );

const baseColumns = (classes: string) =>
  Number(classes.split(/\s+/).find((c) => /^grid-cols-\d+$/.test(c))?.replace("grid-cols-", ""));

describe("the density options actually differ, at every width", () => {
  it("covers every density with a grid, a label and a hint", () => {
    // A missing entry renders `undefined` — as a class list that is a grid with no columns,
    // and as a label that is the literal word "undefined".
    for (const d of DENSITIES) {
      expect(DENSITY_GRID[d], `no grid for ${d}`).toMatch(/grid-cols-/);
      expect(DENSITY_LABEL[d], `no label for ${d}`).toMatch(/\S/);
      expect(DENSITY_HINT[d], `no hint for ${d}`).toMatch(/\S/);
    }
    expect(DENSITIES).toHaveLength(3);
  });

  it("defines columns at the same breakpoints for all three", () => {
    // The mutation that survived: `dense` lost its sm/md/lg/2xl columns. It still rendered and
    // still type-checked; it just stopped responding above 360px while the other two did not,
    // so on a desktop "dense" showed FEWER items than "comfortable" — the opposite of the
    // control's whole purpose.
    const sets = DENSITIES.map((d) => [d, breakpointsOf(DENSITY_GRID[d])] as const);
    const reference = sets[0][1];
    for (const [d, bps] of sets) {
      expect(
        [...bps].sort(),
        `${d} defines columns at different breakpoints than ${sets[0][0]}`,
      ).toEqual([...reference].sort());
    }
    expect(reference.size, "densities define columns at only one width").toBeGreaterThan(2);
  });

  it("gets denser, in order", () => {
    // DENSITIES is ordered comfortable -> compact -> dense, and each must fit strictly more
    // per row than the last or two options do the same thing.
    const counts = DENSITIES.map((d) => baseColumns(DENSITY_GRID[d]));
    expect(counts.every(Number.isFinite), `a density has no base column count: ${counts}`).toBe(true);
    for (let i = 1; i < counts.length; i++) {
      expect(
        counts[i],
        `${DENSITIES[i]} (${counts[i]}) is not denser than ${DENSITIES[i - 1]} (${counts[i - 1]})`,
      ).toBeGreaterThan(counts[i - 1]);
    }
  });

  it("keeps each label and hint distinct", () => {
    // Two identical hints means the picker cannot explain the difference it is offering.
    const labels = DENSITIES.map((d: Density) => DENSITY_LABEL[d]);
    const hints = DENSITIES.map((d: Density) => DENSITY_HINT[d]);
    expect(new Set(labels).size, "two densities share a label").toBe(labels.length);
    expect(new Set(hints).size, "two densities share a hint").toBe(hints.length);
  });
});
