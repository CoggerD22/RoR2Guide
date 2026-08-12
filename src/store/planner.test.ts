import { describe, expect, it } from "vitest";
import {
  usePlanner,
  DEFAULT_PRIORITY,
  MIN_GOAL,
  MAX_GOAL,
  migratePlannerState,
  sanitizePersisted,
} from "./planner";

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


/**
 * §3j.146 — the sanitiser existed, was tested, and never ran.
 *
 * `sanitizeEntry` was reachable only through `migrate`, and zustand calls `migrate` ONLY when
 * the stored version differs from the current one. Version has been 2 for a while, so every
 * ordinary load skipped it. The suite above hid this rather than catching it: it proves the v2
 * path by calling `migrate(data, 2)` directly — a call the library never makes.
 *
 * These test `sanitizePersisted`, which is wired into `merge` and therefore runs on every
 * hydrate. `tests/errors.spec.ts` covers the wiring itself, in a real browser with real
 * localStorage, because a pure-function test is exactly what failed to notice last time.
 */
describe("persisted state is sanitised on every hydrate, not only on migration", () => {
  it("rejects a goal outside the input's own 1..99 range", () => {
    // The value that reached the screen: localStorage holding 1e20 rendered
    // "×100000000000000000000" in the rail.
    const out = sanitizePersisted({ plan: { crowbar: { state: "targeted", priority: "high", goal: 1e20 } } });
    expect(out.plan.crowbar).toEqual({ state: "targeted", priority: "high" });
    expect(out.plan.crowbar.goal).toBeUndefined();
  });

  it("keeps a goal inside the range", () => {
    const out = sanitizePersisted({ plan: { crowbar: { state: "targeted", priority: "high", goal: 3 } } });
    expect(out.plan.crowbar.goal).toBe(3);
    for (const bad of [0, -1, MIN_GOAL - 1, MAX_GOAL + 1, 1.5, NaN, Infinity]) {
      const o = sanitizePersisted({ plan: { c: { state: "targeted", priority: "high", goal: bad } } });
      expect(o.plan.c.goal, `goal ${bad} survived`).toBeUndefined();
    }
  });

  it("falls back to a real priority instead of rendering no label", () => {
    // "ULTRA" is not in PRIORITY_LABEL, so the rail showed a targeted item with no priority
    // at all — a gap that reads as a bug in the app rather than bad stored data.
    const out = sanitizePersisted({ plan: { crowbar: { state: "targeted", priority: "ULTRA" } } });
    expect(out.plan.crowbar.priority).toBe(DEFAULT_PRIORITY);
  });

  it("drops entries that are not entries", () => {
    const out = sanitizePersisted({
      plan: { a: 42, b: null, c: "targeted", d: { state: "nonsense" }, e: [], ok: { state: "avoided", priority: "low" } },
    });
    expect(Object.keys(out.plan)).toEqual(["ok"]);
  });

  it("survives a plan that is not an object at all", () => {
    for (const plan of [null, undefined, "hello", 42, [1, 2, 3], true]) {
      expect(sanitizePersisted({ plan }).plan, `plan=${JSON.stringify(plan)}`).toEqual({});
    }
    expect(sanitizePersisted(undefined).plan).toEqual({});
    expect(sanitizePersisted("not an object").plan).toEqual({});
  });

  it("clamps railMode to the two values the rail can render", () => {
    expect(sanitizePersisted({ railMode: "run" }).railMode).toBe("run");
    expect(sanitizePersisted({ railMode: "plan" }).railMode).toBe("plan");
    for (const bad of ["wat", "", null, 7, {}]) {
      expect(sanitizePersisted({ railMode: bad }).railMode, `railMode=${JSON.stringify(bad)}`).toBe("plan");
    }
  });

  it("is idempotent, since migrate may have run first", () => {
    const once = sanitizePersisted({ plan: { crowbar: { state: "targeted", priority: "high", goal: 3 } } });
    expect(sanitizePersisted(once)).toEqual(once);
  });
});
