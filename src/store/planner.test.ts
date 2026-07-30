import { describe, expect, it } from "vitest";
import { usePlanner, DEFAULT_PRIORITY, MIN_GOAL, MAX_GOAL, migratePlannerState } from "./planner";

/**
 * The v1→v2 migration is the risky part of PLAN §5.8b: plans live in localStorage, so
 * a shape change without a migration silently wipes a run someone is mid-way through.
 * It's exported as a pure function precisely so it can be tested without standing up
 * the store or a localStorage shim.
 */
const migrate = migratePlannerState;

describe("planner persistence migration", () => {
  it("lifts a v1 plan (bare state strings) into the v2 entry shape", () => {
    const v1 = { plan: { crowbar: "targeted", "tri-tip-dagger": "avoided" } };
    expect(migrate(v1, 1)).toEqual({
      plan: {
        crowbar: { state: "targeted", priority: DEFAULT_PRIORITY },
        "tri-tip-dagger": { state: "avoided", priority: DEFAULT_PRIORITY },
      },
    });
  });

  it("drops unrecognised v1 values instead of importing garbage", () => {
    const v1 = { plan: { crowbar: "targeted", weird: "somethingElse" } };
    expect(migrate(v1, 1)).toEqual({
      plan: { crowbar: { state: "targeted", priority: DEFAULT_PRIORITY } },
    });
  });

  it("passes a v2 plan through untouched", () => {
    const v2 = { plan: { crowbar: { state: "targeted", priority: "high", goal: 3 } } };
    expect(migrate(v2, 2)).toEqual(v2);
  });

  it("survives empty or missing persisted state", () => {
    expect(migrate({}, 1)).toEqual({ plan: {} });
    expect(migrate(undefined, 1)).toEqual({ plan: {} });
  });
});

describe("planner actions", () => {
  it("cycles neutral → targeted → avoided → neutral, keeping the default priority", () => {
    usePlanner.getState().reset();
    const { cycle } = usePlanner.getState();
    cycle("crowbar");
    expect(usePlanner.getState().plan.crowbar).toEqual({
      state: "targeted",
      priority: DEFAULT_PRIORITY,
    });
    cycle("crowbar");
    expect(usePlanner.getState().plan.crowbar.state).toBe("avoided");
    cycle("crowbar");
    expect(usePlanner.getState().plan.crowbar).toBeUndefined();
  });

  it("preserves priority and goal when the state changes", () => {
    usePlanner.getState().reset();
    const s = usePlanner.getState();
    s.cycle("crowbar");
    s.setPriority("crowbar", "high");
    s.setGoal("crowbar", 4);
    s.cycle("crowbar"); // → avoided
    const entry = usePlanner.getState().plan.crowbar;
    expect(entry.state).toBe("avoided");
    expect(entry.priority).toBe("high");
    expect(entry.goal).toBe(4);
  });

  it("clamps goals to whole numbers ≥ 1 and clears on null", () => {
    usePlanner.getState().reset();
    const s = usePlanner.getState();
    s.cycle("crowbar");
    s.setGoal("crowbar", 0);
    expect(usePlanner.getState().plan.crowbar.goal).toBe(1);
    s.setGoal("crowbar", 3.7);
    expect(usePlanner.getState().plan.crowbar.goal).toBe(3);
    s.setGoal("crowbar", null);
    expect(usePlanner.getState().plan.crowbar.goal).toBeUndefined();
  });

  it("keeps railMode out of the plan, so it never travels in a share link", () => {
    usePlanner.getState().reset();
    usePlanner.getState().setRailMode("run");
    // The mode is a view preference. If it leaked into `plan`, importing someone
    // else’s shared plan would silently change how you view your own.
    expect(usePlanner.getState().railMode).toBe("run");
    expect(Object.keys(usePlanner.getState().plan)).toHaveLength(0);
    usePlanner.getState().importPlan({ crowbar: { state: "targeted", priority: "high" } });
    expect(usePlanner.getState().railMode).toBe("run");
  });

  it("ignores priority/goal changes for items not in the plan", () => {
    usePlanner.getState().reset();
    usePlanner.getState().setPriority("not-planned", "high");
    usePlanner.getState().setGoal("not-planned", 2);
    expect(usePlanner.getState().plan["not-planned"]).toBeUndefined();
  });
});

describe("planner persistence is hostile-input safe", () => {
  // localStorage survives deploys, can be hand-edited, and can be left half-written by a
  // crash. The v2 path used to cast it straight to PlanEntry, so every case below survived
  // intact — including `42`, where the UI would then read `42.state` and crash.
  it("drops an entry with an invalid state", () => {
    expect(migrate({ plan: { crowbar: { state: "nonsense", priority: "high" } } }, 2)).toEqual({ plan: {} });
  });

  it("drops an entry that is not an object", () => {
    expect(migrate({ plan: { crowbar: 42 } }, 2)).toEqual({ plan: {} });
    expect(migrate({ plan: { crowbar: null } }, 2)).toEqual({ plan: {} });
  });

  it("repairs a missing or invalid priority rather than dropping the entry", () => {
    expect(migrate({ plan: { crowbar: { state: "targeted" } } }, 2)).toEqual({
      plan: { crowbar: { state: "targeted", priority: DEFAULT_PRIORITY } },
    });
    expect(migrate({ plan: { crowbar: { state: "targeted", priority: "urgent" } } }, 2)).toEqual({
      plan: { crowbar: { state: "targeted", priority: DEFAULT_PRIORITY } },
    });
  });

  it("discards a nonsensical goal but keeps the entry", () => {
    for (const goal of [0, -3, 2.5, "3", NaN]) {
      expect(migrate({ plan: { crowbar: { state: "targeted", priority: "high", goal } } }, 2)).toEqual({
        plan: { crowbar: { state: "targeted", priority: "high" } },
      });
    }
    expect(migrate({ plan: { crowbar: { state: "targeted", priority: "high", goal: 3 } } }, 2)).toEqual({
      plan: { crowbar: { state: "targeted", priority: "high", goal: 3 } },
    });
  });

  it("sanitises a FUTURE version instead of trusting it", () => {
    // A user who loads an older build after a newer one wrote its state. Unknown fields are
    // dropped; the recognisable parts survive.
    expect(migrate({ plan: { crowbar: { state: "targeted", priority: "high", futureField: 1 } } }, 9)).toEqual({
      plan: { crowbar: { state: "targeted", priority: "high" } },
    });
  });

  it("survives a plan that is not an object", () => {
    expect(migrate({ plan: "corrupt" }, 2)).toEqual({ plan: {} });
    expect(migrate({ plan: [] }, 2)).toEqual({ plan: {} });
  });
});

describe("goal bounds are enforced at every entry point", () => {
  it("setGoal clamps rather than trusting the input's max attribute", () => {
    usePlanner.getState().reset();
    usePlanner.getState().cycle("crowbar");
    usePlanner.getState().setGoal("crowbar", 1e20);
    expect(usePlanner.getState().plan.crowbar.goal).toBe(MAX_GOAL);
    usePlanner.getState().setGoal("crowbar", -5);
    expect(usePlanner.getState().plan.crowbar.goal).toBe(MIN_GOAL);
    usePlanner.getState().setGoal("crowbar", Infinity);
    expect(usePlanner.getState().plan.crowbar.goal).toBeUndefined();
  });

  it("importPlan sanitises what it is handed", () => {
    usePlanner.getState().reset();
    usePlanner.getState().importPlan({
      good: { state: "targeted", priority: "high", goal: 3 },
      badState: { state: "nonsense", priority: "high" } as never,
      badEntry: 42 as never,
      badGoal: { state: "targeted", priority: "high", goal: 1e20 },
    });
    const plan = usePlanner.getState().plan;
    expect(Object.keys(plan).sort()).toEqual(["badGoal", "good"]);
    expect(plan.badGoal.goal).toBeUndefined();
    expect(plan.good.goal).toBe(3);
  });
});
