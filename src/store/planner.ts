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

/**
 * Bounds on a stack goal, enforced everywhere a goal can enter: the number input, a shared
 * URL, and rehydrated localStorage.
 *
 * The input already declared `min={1} max={99}`, but that is only an HTML hint — nothing
 * clamped the value, so `?t=crowbar*99999999999999999999` decoded to a goal of 1e20 and
 * round-tripped straight back into a link. 99 is the existing UI contract, kept as the one
 * authority rather than a fourth opinion.
 */
export const MIN_GOAL = 1;
export const MAX_GOAL = 99;

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
  // A goal is optional, but one outside the input's own 1..99 range is meaningless —
  // and `Number.isInteger(1e20)` is true, so a range check is the part that matters.
  if (
    typeof v.goal === "number" &&
    Number.isInteger(v.goal) &&
    v.goal >= MIN_GOAL &&
    v.goal <= MAX_GOAL
  ) {
    entry.goal = v.goal;
  }
  return entry;
}

/**
 * §3j.146 — sanitise the WHOLE persisted blob, on every hydrate.
 *
 * `sanitizeEntry` was wired in through `migrate`, and zustand only calls `migrate` when the
 * stored version differs from the current one (`middleware.js`: a version match returns
 * `deserializedStorageValue.state` straight to `merge`). Version has been 2 for a while, so the
 * validation this file documents at length ran on legacy data and on shared links — and never
 * on the ordinary path. Probing v2 storage directly put `×100000000000000000000` on screen from
 * a `goal` of 1e20, the exact value MIN_GOAL/MAX_GOAL were introduced to prevent, and rendered
 * a targeted item with no priority label at all from `priority: "ULTRA"`.
 *
 * `merge` runs on every hydrate regardless of version, so that is where this belongs. Running
 * after `migrate` is harmless: sanitising twice is idempotent.
 */
export function sanitizePersisted(persisted: unknown): { plan: Record<string, PlanEntry>; railMode: RailMode } {
  const s = persisted as { plan?: unknown; railMode?: unknown } | undefined;
  const plan: Record<string, PlanEntry> = {};
  const raw = s?.plan;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
      const entry = sanitizeEntry(value);
      if (entry) plan[id] = entry;
    }
  }
  // railMode was never validated anywhere. It is a closed set of two, so anything else is the
  // default rather than a value the rail has to render around.
  return { plan, railMode: s?.railMode === "run" ? "run" : "plan" };
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
          // Clamped, not just floored: the number input's max=99 is an HTML hint a user can
          // bypass by typing or pasting, and this is the only place that can enforce it.
          if (goal === null || !Number.isFinite(goal)) delete nextEntry.goal;
          else nextEntry.goal = Math.min(MAX_GOAL, Math.max(MIN_GOAL, Math.floor(goal)));
          return { plan: { ...s.plan, [id]: nextEntry } };
        }),
      // Validated, not trusted: this is the landing point for a shared URL, and a store
      // action is exactly the kind of thing a later caller will reuse without re-checking.
      importPlan: (plan) =>
        set({
          plan: Object.fromEntries(
            Object.entries(plan ?? {})
              .map(([id, entry]) => [id, sanitizeEntry(entry)] as const)
              .filter((pair): pair is readonly [string, PlanEntry] => pair[1] !== null),
          ),
        }),
      reset: () => set({ plan: {} }),
    }),
    {
      name: "ror2-run-plan",
      version: 2,
      migrate: migratePlannerState,
      // Not decoration: this is the only hook that runs when the stored version already
      // matches, which is the overwhelmingly common case. See sanitizePersisted.
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    },
  ),
);
