import { describe, expect, it } from "vitest";
import {
  stackingEntrySchema,
  itemSchema,
  confidenceSchema,
  tierSchema,
  stackingTypeSchema,
} from "./schema";

/**
 * §3j.158 — the validation layer, tested by what it must REJECT.
 *
 * `schema.ts` carries 29 constraints and had **zero negative tests**. That is not a small gap:
 * loosening a rule cannot make valid data invalid, so every one of these mutations shipped
 * green through the whole gate —
 *
 *   - `special` rows no longer required a `formula`
 *   - `capStacks` no longer required the human-readable `cap` explaining it
 *   - an item could ship an empty `description`
 *   - `confidence` accepted any string instead of the four provenance tiers
 *
 * — because the current data satisfies the *stricter* rule either way. Found by
 * `pnpm data:mutate`.
 *
 * It matters beyond tidiness: `data:audit` and `data:diff` both parse through this schema, so a
 * weakened rule here silently weakens them rather than failing loudly. This is §3j.148's class —
 * a check that cannot fail — applied to the layer every other check trusts.
 *
 * Each test states the rule's REASON, because a constraint whose purpose is unrecorded is the
 * one a future refactor deletes as noise.
 */

const validEntry = {
  stat: "Damage (%)",
  base: 75,
  perStack: 75,
  type: "linear" as const,
};

describe("stackingEntrySchema rejects what it exists to reject", () => {
  it("accepts a well-formed linear entry", () => {
    // The positive case has to be here too, or a schema that rejects EVERYTHING would pass
    // every test below (§3j.126: a check must distinguish its own failure modes).
    expect(stackingEntrySchema.safeParse(validEntry).success).toBe(true);
  });

  it("requires a formula on `special` rows", () => {
    // "Special" means the curve cannot be derived from base/perStack. Without the formula the
    // UI has nothing true to render, and would fall back to arithmetic the game does not do.
    const r = stackingEntrySchema.safeParse({ ...validEntry, type: "special" });
    expect(r.success, "a special row without a formula was accepted").toBe(false);
    expect(stackingEntrySchema.safeParse({ ...validEntry, type: "special", formula: "x" }).success).toBe(true);
  });

  it("requires the prose `cap` whenever `capStacks` is set", () => {
    // capStacks drives the planner's "a goal of N wastes M" warning. A bare number with no
    // explanation is a claim the reader cannot check (PLAN §5.8b).
    const r = stackingEntrySchema.safeParse({ ...validEntry, capStacks: 4 });
    expect(r.success, "capStacks without a cap note was accepted").toBe(false);
    expect(
      stackingEntrySchema.safeParse({ ...validEntry, capStacks: 4, cap: "caps at 4" }).success,
    ).toBe(true);
  });

  it("rejects a non-positive or fractional capStacks", () => {
    for (const capStacks of [0, -1, 2.5]) {
      expect(
        stackingEntrySchema.safeParse({ ...validEntry, capStacks, cap: "note" }).success,
        `capStacks ${capStacks} was accepted`,
      ).toBe(false);
    }
  });

  it("rejects an empty stat label, formula or cap", () => {
    expect(stackingEntrySchema.safeParse({ ...validEntry, stat: "" }).success).toBe(false);
    expect(stackingEntrySchema.safeParse({ ...validEntry, formula: "" }).success).toBe(false);
    expect(stackingEntrySchema.safeParse({ ...validEntry, cap: "" }).success).toBe(false);
  });

  it("rejects an unknown stacking type", () => {
    // The type drives which arithmetic the UI is allowed to state. An unrecognised one would
    // render as an unlabelled badge and be treated as non-linear by accident.
    expect(stackingEntrySchema.safeParse({ ...validEntry, type: "quadratic" }).success).toBe(false);
    expect(stackingTypeSchema.safeParse("linear").success).toBe(true);
  });

  it("is strict — an unexpected key is a mistake, not extra data", () => {
    // `.strict()` is what makes a typo'd field (perStak) fail instead of being silently dropped
    // and defaulting to nothing.
    expect(stackingEntrySchema.safeParse({ ...validEntry, perStak: 5 }).success).toBe(false);
  });

  it("rejects a non-numeric base or perStack", () => {
    expect(stackingEntrySchema.safeParse({ ...validEntry, base: "75" }).success).toBe(false);
    expect(stackingEntrySchema.safeParse({ ...validEntry, perStack: null }).success).toBe(false);
  });
});

describe("the provenance and tier enums are closed sets", () => {
  it("accepts exactly the four confidence tiers", () => {
    // confidence is the site's provenance claim — code > asset > langfile > wiki. An open
    // string would let an unbadged or misspelled value render as if it were verified.
    for (const ok of ["code", "asset", "langfile", "wiki"]) {
      expect(confidenceSchema.safeParse(ok).success, `${ok} rejected`).toBe(true);
    }
    for (const bad of ["verified", "Code", "", "guess", "wiki "]) {
      expect(confidenceSchema.safeParse(bad).success, `${JSON.stringify(bad)} accepted`).toBe(false);
    }
  });

  it("rejects a tier the codex cannot group", () => {
    // Every tier must be renderable — an unknown one groups nowhere and the item vanishes
    // from the grid rather than erroring (see the tier-renderability guard).
    expect(tierSchema.safeParse("common").success).toBe(true);
    for (const bad of ["mythic", "Common", "void"]) {
      expect(tierSchema.safeParse(bad).success, `${bad} accepted as a tier`).toBe(false);
    }
  });
});

describe("itemSchema rejects an item that would render as a blank", () => {
  const validItem = {
    id: "test-item",
    name: "Test Item",
    tier: "common",
    dlc: "base",
    tags: ["damage"],
    pickupText: "A test item.",
    description: "Deals damage.",
    icon: "/icons/test.png",
    wiki: "https://example.invalid",
    stacking: [validEntry],
    verified: true,
    confidence: "code",
  };

  it("accepts the well-formed item", () => {
    const r = itemSchema.safeParse(validItem);
    expect(r.success, `valid item rejected: ${JSON.stringify(r.error?.issues?.[0])}`).toBe(true);
  });

  it.each(["name", "description", "pickupText", "id"] as const)(
    "rejects an empty %s",
    (field) => {
      // Empty text renders as a blank line on the page, which reads as "this item has no
      // effect" rather than as missing data — rule #1's "never let a gap look like a fact".
      expect(itemSchema.safeParse({ ...validItem, [field]: "" }).success).toBe(false);
    },
  );

  it("rejects a missing required field", () => {
    const { description: _drop, ...withoutDescription } = validItem;
    expect(itemSchema.safeParse(withoutDescription).success).toBe(false);
  });
});
