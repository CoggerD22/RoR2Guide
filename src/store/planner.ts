import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A card in the run plan is either targeted (want) or avoided (skip). */
export type PlanState = "targeted" | "avoided";

/**
 * How badly the player wants it. Deliberately plain High/Medium/Low — the real
 * decision at a printer is "which of these do I take first?", and any RoR2-flavoured
 * naming ("core", "situational") would itself need explaining (PLAN §5.8b).
 */
export type Priority = "high" | "medium" | "low";

export const PRIORITIES: Priority[] = ["high", "medium", "low"];
export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
/** Sort key — high first. */
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export interface PlanEntry {
  state: PlanState;
  /** Only meaningful for `targeted`; avoided items aren't ranked. */
  priority: Priority;
  /** Optional target stack count ("I want 3 Crowbars"). Undefined = no specific goal. */
  goal?: number;
}

/**
 * How the rail is rendered (PLAN §5.8c).
 * - `plan` — full editing affordances, for building a plan before a run.
 * - `run`  — read-only and dense, for glancing at mid-run with a game in the way.
 */
export type RailMode = "plan" | "run";

interface PlannerState {
  /** itemId → entry. Absent means neutral. */
  plan: Record<string, PlanEntry>;
  /**
   * A UI preference, deliberately NOT part of `plan`: it must never travel in a share
   * link, and importing someone else's plan must not change how you view yours.
   */
  railMode: RailMode;
  setRailMode: (mode: RailMode) => void;
  /** Cycle neutral → targeted → avoided → neutral (unchanged muscle memory). */
  cycle: (id: string) => void;
  /** Set (or clear, with null) a specific state, preserving priority/goal. */
  set: (id: string, state: PlanState | null) => void;
  setPriority: (id: string, priority: Priority) => void;
  /** Pass null to clear the goal. */
  setGoal: (id: string, goal: number | null) => void;
  /** Replace the whole plan wholesale (e.g. loading a shared plan from a URL). */
  importPlan: (plan: Record<string, PlanEntry>) => void;
  /** Wipe the whole plan ("New run"). */
  reset: () => void;
}

export const DEFAULT_PRIORITY: Priority = "medium";

/**
 * v1 → v2 persisted-state migration, exported so it can be tested directly.
 *
 * v1 stored `plan: Record<id, "targeted" | "avoided">`. Plans live in localStorage, so
 * shipping the richer shape without this would silently wipe a run someone is midway
 * through. Unrecognised values are dropped rather than imported as garbage.
 */
/**
 * Coerce one persisted entry into a valid `PlanEntry`, or drop it.
 *
 * This exists because the v1 path validated its input and the v2 path did not — it simply
 * cast whatever was in localStorage to `PlanEntry`. Probing it with hostile values showed
 * every one of these surviving intact: `state: "nonsense"`, a missing `priority`, and an
 * entry that was the bare number `42`. Any of those reaches the UI, and `42.state` is a
 * crash rather than a bad render.
 *
 * localStorage is not a trusted store. It survives across deploys, can be hand-edited, and
 * can be left half-written by a crash mid-write — so current-version data deserves exactly
 * the same scepticism as legacy data.
 */
function sanitizeEntry(value: unknown): PlanEntry | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Partial<PlanEntry>;
  if (v.state !== "targeted" && v.state !== "avoided") return null;
  const priority = PRIORITIES.includes(v.priority as Priority)
    ? (v.priority as Priority)
    : DEFAULT_PRIORITY;
  const entry: PlanEntry = { state: v.state, priority };
  // A goal is optional, but a non-positive or non-integer one is meaningless.
  if (typeof v.goal === "number" && Number.isInteger(v.goal) && v.goal > 0) entry.goal = v.goal;
  return entry;
}

export function migratePlannerState(persisted: unknown, version: number): { plan: Record<string, PlanEntry> } {
  const state = persisted as { plan?: Record<string, unknown> } | undefined;
  if (!state?.plan || typeof state.plan !== "object") return { plan: {} };
  const plan: Record<string, PlanEntry> = {};
  for (const [id, value] of Object.entries(state.plan)) {
    // v1 stored a bare state string; v2+ stores an object. Both are validated, and a
    // FUTURE version (someone loading an older build after a newer one wrote its state)
    // falls through the same sanitiser rather than being cast blindly.
    if (version < 2 && (value === "targeted" || value === "avoided")) {
      plan[id] = { state: value, priority: DEFAULT_PRIORITY };
      continue;
    }
    const entry = sanitizeEntry(value);
    if (entry) plan[id] = entry;
  }
  return { plan };
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      plan: {},
      railMode: "plan",
      setRailMode: (railMode) => set({ railMode }),
      cycle: (id) =>
        set((s) => {
          const next = { ...s.plan };
          const current = next[id];
          if (!current) next[id] = { state: "targeted", priority: DEFAULT_PRIORITY };
          else if (current.state === "targeted") next[id] = { ...current, state: "avoided" };
          else delete next[id];
          return { plan: next };
        }),
      set: (id, state) =>
        set((s) => {
          const next = { ...s.plan };
          if (state) {
            next[id] = { ...next[id], state, priority: next[id]?.priority ?? DEFAULT_PRIORITY };
          }
          else delete next[id];
          return { plan: next };
        }),
      setPriority: (id, priority) =>
        set((s) => {
          const current = s.plan[id];
          if (!current) return s;
          return { plan: { ...s.plan, [id]: { ...current, priority } } };
        }),
      setGoal: (id, goal) =>
        set((s) => {
          const current = s.plan[id];
          if (!current) return s;
          const nextEntry = { ...current };
          if (goal === null || Number.isNaN(goal)) delete nextEntry.goal;
          else nextEntry.goal = Math.max(1, Math.floor(goal));
          return { plan: { ...s.plan, [id]: nextEntry } };
        }),
      importPlan: (plan) => set({ plan }),
      reset: () => set({ plan: {} }),
    }),
    {
      name: "ror2-run-plan",
      version: 2,
      migrate: migratePlannerState,
    },
  ),
);
