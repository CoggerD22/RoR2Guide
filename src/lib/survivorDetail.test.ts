import { describe, expect, test } from "vitest";
import { getSurvivorDetail, statRows } from "./survivorDetail";
import { survivors } from "@/data/survivors";

describe("getSurvivorDetail", () => {
  test("returns null for an unknown id rather than throwing", () => {
    expect(getSurvivorDetail("not-a-survivor")).toBeNull();
  });

  test("every survivor in the dataset resolves", () => {
    for (const s of survivors) {
      expect(getSurvivorDetail(s.id), `${s.id} did not resolve`).not.toBeNull();
    }
  });

  test("slots are ordered primary → secondary → utility → special", () => {
    const d = getSurvivorDetail("commando")!;
    const order = d.slots.map((g) => g.slot);
    const expected = ["primary", "secondary", "utility", "special"].filter((s) =>
      order.includes(s as (typeof order)[number]),
    );
    expect(order).toEqual(expected);
  });

  test("empty slots are dropped, not rendered as blank groups", () => {
    for (const s of survivors) {
      const d = getSurvivorDetail(s.id)!;
      expect(d.slots.every((g) => g.skills.length > 0), `${s.id} has an empty slot group`).toBe(true);
    }
  });

  /**
   * An unlock matched to a skill must not ALSO appear in `unmatchedUnlocks` — the detail page
   * renders that list as "we have an unlock we could not place", so a double-listed entry
   * reads as a gap in the data that does not exist.
   */
  test("a matched unlock never also appears as unmatched", () => {
    for (const s of survivors) {
      const d = getSurvivorDetail(s.id)!;
      const matched = new Set(
        d.slots.flatMap((g) => g.skills.filter((k) => k.challenge).map((k) => k.name)),
      );
      for (const u of d.unmatchedUnlocks) {
        expect(matched.has(u.skill), `${s.id}: ${u.skill} is both matched and unmatched`).toBe(false);
      }
    }
  });
});

describe("statRows", () => {
  test("renders every survivor without producing NaN or 'undefined'", () => {
    for (const s of survivors) {
      for (const row of statRows(s)) {
        expect(row.base, `${s.id} ${row.label}`).not.toMatch(/NaN|undefined/);
        if (row.perLevel) expect(row.perLevel, `${s.id} ${row.label}`).not.toMatch(/NaN|undefined/);
      }
    }
  });

  test("negative growth reads as '-1.2', never '+-1.2'", () => {
    // Heretic's regen is negative; a naive "+" prefix produced "+-1.2".
    for (const s of survivors) {
      for (const row of statRows(s)) {
        if (row.perLevel) expect(row.perLevel).not.toMatch(/\+-/);
      }
    }
  });

  test("a value rounding to x.00 renders without a trailing '.0'", () => {
    // `.replace(/0$/, "")` stripped only one zero, so 1.004 rendered as "1.0".
    for (const s of survivors) {
      for (const row of statRows(s)) {
        expect(row.base, `${s.id} ${row.label}`).not.toMatch(/\.0(\D|$)/);
      }
    }
  });
});
