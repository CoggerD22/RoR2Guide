import { create } from "zustand";
import { persist } from "zustand/middleware";

/** A card in the run plan is either targeted (want) or avoided (skip). */
export type PlanState = "targeted" | "avoided";

interface PlannerState {
  /** itemId → plan state. Absent means neutral. */
  plan: Record<string, PlanState>;
  /** Cycle neutral → targeted → avoided → neutral. */
  cycle: (id: string) => void;
  /** Set (or clear, with null) a specific state. */
  set: (id: string, state: PlanState | null) => void;
  /** Replace the whole plan wholesale (e.g. loading a shared plan from a URL). */
  importPlan: (plan: Record<string, PlanState>) => void;
  /** Wipe the whole plan ("New run"). */
  reset: () => void;
}

export const usePlanner = create<PlannerState>()(
  persist(
    (set) => ({
      plan: {},
      cycle: (id) =>
        set((s) => {
          const next = { ...s.plan };
          const current = next[id];
          if (!current) next[id] = "targeted";
          else if (current === "targeted") next[id] = "avoided";
          else delete next[id];
          return { plan: next };
        }),
      set: (id, state) =>
        set((s) => {
          const next = { ...s.plan };
          if (state) next[id] = state;
          else delete next[id];
          return { plan: next };
        }),
      importPlan: (plan) => set({ plan }),
      reset: () => set({ plan: {} }),
    }),
    { name: "ror2-run-plan" },
  ),
);
