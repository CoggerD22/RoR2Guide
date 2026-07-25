import { describe, expect, it } from "vitest";
import { decodePlan, encodePlan, hasPlanParams, type Plan } from "./planUrl";

describe("planUrl", () => {
  it("encodes targeted and avoided into stable, sorted lists", () => {
    const plan: Plan = {
      crowbar: "targeted",
      "tri-tip-dagger": "avoided",
      "backup-magazine": "targeted",
    };
    // Sorted within each list, targeted first.
    expect(encodePlan(plan)).toBe("t=backup-magazine,crowbar&a=tri-tip-dagger");
  });

  it("omits an empty list entirely", () => {
    expect(encodePlan({ crowbar: "targeted" })).toBe("t=crowbar");
    expect(encodePlan({ crowbar: "avoided" })).toBe("a=crowbar");
    expect(encodePlan({})).toBe("");
  });

  it("round-trips a plan through encode → decode", () => {
    const plan: Plan = { crowbar: "targeted", "tri-tip-dagger": "avoided" };
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
  });

  it("tolerates a leading '?' and reads params either way", () => {
    expect(decodePlan("?t=crowbar")).toEqual({ crowbar: "targeted" });
    expect(decodePlan("t=crowbar")).toEqual({ crowbar: "targeted" });
  });

  it("drops unknown ids when given a validator (stale link stays correct)", () => {
    const known = new Set(["crowbar"]);
    const plan = decodePlan("t=crowbar,ghost-item&a=another-gone", (id) => known.has(id));
    expect(plan).toEqual({ crowbar: "targeted" });
  });

  it("ignores empty segments and whitespace", () => {
    expect(decodePlan("t=crowbar,,%20&a=")).toEqual({ crowbar: "targeted" });
  });

  it("detects the presence of plan params", () => {
    expect(hasPlanParams("?t=crowbar")).toBe(true);
    expect(hasPlanParams("?a=crowbar")).toBe(true);
    expect(hasPlanParams("?foo=bar")).toBe(false);
    expect(hasPlanParams("")).toBe(false);
  });
});
