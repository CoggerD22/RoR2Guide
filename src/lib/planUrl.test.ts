import { describe, expect, it } from "vitest";
import { decodePlan, encodePlan, hasPlanParams, type Plan } from "./planUrl";

const targeted = (priority: "high" | "medium" | "low" = "medium", goal?: number) => ({
  state: "targeted" as const,
  priority,
  ...(goal ? { goal } : {}),
});
const avoided = { state: "avoided" as const, priority: "medium" as const };

describe("planUrl", () => {
  it("encodes targeted and avoided into stable, sorted lists", () => {
    const plan: Plan = {
      crowbar: targeted(),
      "tri-tip-dagger": avoided,
      "backup-magazine": targeted(),
    };
    expect(encodePlan(plan)).toBe("t=backup-magazine,crowbar&a=tri-tip-dagger");
  });

  it("omits an empty list entirely", () => {
    expect(encodePlan({ crowbar: targeted() })).toBe("t=crowbar");
    expect(encodePlan({ crowbar: avoided })).toBe("a=crowbar");
    expect(encodePlan({})).toBe("");
  });

  it("round-trips a plan through encode → decode", () => {
    const plan: Plan = { crowbar: targeted(), "tri-tip-dagger": avoided };
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });

  it("encodes priority and goal, omitting the defaults to keep links short", () => {
    expect(encodePlan({ crowbar: targeted("high") })).toBe("t=crowbar!h");
    expect(encodePlan({ crowbar: targeted("low", 3) })).toBe("t=crowbar!l*3");
    // Default priority and a goal of 1 add nothing.
    expect(encodePlan({ crowbar: targeted("medium", 1) })).toBe("t=crowbar");
    expect(encodePlan({ crowbar: targeted("medium", 4) })).toBe("t=crowbar*4");
  });

  it("round-trips priority and goal", () => {
    const plan: Plan = {
      "soldiers-syringe": targeted("high", 4),
      "lens-makers-glasses": targeted("high"),
      "repulsion-armor-plate": targeted("low", 2),
      crowbar: avoided,
    };
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });

  it("decodes OLD links (bare ids, no suffixes) — shared plans must not break", () => {
    expect(decodePlan("t=crowbar,backup-magazine&a=tri-tip-dagger")).toEqual({
      crowbar: targeted(),
      "backup-magazine": targeted(),
      "tri-tip-dagger": avoided,
    });
  });

  it("tolerates a leading '?' and reads params either way", () => {
    expect(decodePlan("?t=crowbar")).toEqual({ crowbar: targeted() });
    expect(decodePlan("t=crowbar")).toEqual({ crowbar: targeted() });
  });

  it("drops unknown ids when given a validator (stale link stays correct)", () => {
    const known = new Set(["crowbar"]);
    expect(decodePlan("t=crowbar!h,ghost-item&a=another-gone", (id) => known.has(id))).toEqual({
      crowbar: targeted("high"),
    });
  });

  it("ignores empty segments and whitespace", () => {
    expect(decodePlan("t=crowbar,,%20&a=")).toEqual({ crowbar: targeted() });
  });

  it("falls back to defaults on a malformed suffix rather than dropping the item", () => {
    expect(decodePlan("t=crowbar!z")).toEqual({ crowbar: targeted() });
  });

  it("detects the presence of plan params", () => {
    expect(hasPlanParams("?t=crowbar")).toBe(true);
    expect(hasPlanParams("?a=crowbar")).toBe(true);
    expect(hasPlanParams("?foo=bar")).toBe(false);
    expect(hasPlanParams("")).toBe(false);
  });
});
