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

  it("omits the default priority to keep links short", () => {
    expect(encodePlan({ crowbar: targeted("high") })).toBe("t=crowbar!h");
    expect(encodePlan({ crowbar: targeted("low", 3) })).toBe("t=crowbar!l*3");
    expect(encodePlan({ crowbar: targeted("medium", 4) })).toBe("t=crowbar*4");
  });

  /**
   * A goal of 1 used to be omitted as "adds nothing". It adds something: the rail renders
   * "x1" for a goal of 1 and "+goal" for none, so the recipient of a shared link saw a
   * plan the sender had not made. "One is enough" is also the CORRECT plan for the items
   * where stacking genuinely does nothing — Rusted Key, Encrusted Key, Longstanding
   * Solitude past 3 — which this project spent the data passes establishing.
   */
  it("does not silently drop a goal of 1 from a shared link", () => {
    expect(encodePlan({ crowbar: targeted("medium", 1) })).toBe("t=crowbar*1");
    const plan: Plan = { "rusted-key": targeted("high", 1) };
    expect(decodePlan(encodePlan(plan))).toEqual(plan);
    // A plan with no goal at all still encodes bare, and stays that way.
    expect(encodePlan({ crowbar: targeted("medium") })).toBe("t=crowbar");
    expect(decodePlan("t=crowbar").crowbar.goal).toBeUndefined();
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

describe("share links are bounded, not just parsed", () => {
  const known = (id: string) => id === "crowbar";

  // A share link is untrusted input from another person. Before this, `Math.max(1, parseInt())`
  // imposed no ceiling and invented a floor: `*99999999999999999999` decoded to a goal of 1e20
  // and re-encoded straight into the next link, and `*0` became a goal of 1 the link never
  // expressed.
  it("drops an out-of-range goal instead of clamping or inventing one", () => {
    expect(decodePlan("t=crowbar*99999999999999999999", known).crowbar.goal).toBeUndefined();
    expect(decodePlan("t=crowbar*100", known).crowbar.goal).toBeUndefined();
    expect(decodePlan("t=crowbar*0", known).crowbar.goal).toBeUndefined();
    expect(decodePlan("t=crowbar*99", known).crowbar.goal).toBe(99);
    expect(decodePlan("t=crowbar*1", known).crowbar.goal).toBe(1);
  });

  it("still degrades gracefully on malformed tokens", () => {
    expect(decodePlan("t=crowbar!z*abc", known)).toEqual({
      crowbar: { state: "targeted", priority: "medium" },
    });
    expect(decodePlan("t=CROWBAR", known)).toEqual({});
    expect(decodePlan("t=,,,&a=,,", known)).toEqual({});
    expect(decodePlan("t=crowbar<script>", known)).toEqual({
      crowbar: { state: "targeted", priority: "medium" },
    });
  });

  it("an out-of-range goal cannot survive a round trip", () => {
    const q = encodePlan({ crowbar: { state: "targeted", priority: "high", goal: 1e20 } });
    expect(decodePlan(q, known).crowbar.goal).toBeUndefined();
  });
});
