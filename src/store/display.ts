import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * How densely the item grids render, shared by the Codex and the Run Planner (PLAN §8.3).
 *
 * The site is read next to a running game, so "how much fits on screen" is the whole
 * question — and it has two opposite right answers depending on the moment: reading
 * descriptions before a run, and glancing at icons during one.
 */
export type Density = "comfortable" | "compact" | "dense";

export const DENSITIES: Density[] = ["comfortable", "compact", "dense"];

export const DENSITY_LABEL: Record<Density, string> = {
  comfortable: "Comfortable",
  compact: "Compact",
  dense: "Dense",
};

export const DENSITY_HINT: Record<Density, string> = {
  comfortable: "Largest icons, fewest per row",
  compact: "Smaller cards, more per row",
  dense: "Icons only — the most items on screen at once",
};

/** Grid classes per density. `dense` drops names so the icon is all that remains. */
export const DENSITY_GRID: Record<Density, string> = {
  comfortable: "grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 2xl:grid-cols-10",
  compact: "grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 2xl:grid-cols-16",
  dense: "grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12 lg:grid-cols-16 2xl:grid-cols-24",
};

interface DisplayState {
  density: Density;
  /**
   * Expand every card to show its description (PLAN §8.2), turning the grid into a
   * reference sheet instead of an icon wall that costs one click per item.
   */
  showDescriptions: boolean;
  setDensity: (density: Density) => void;
  toggleDescriptions: () => void;
}

/** Guard rehydrated values — localStorage is not a trusted store (see planner.ts). */
function sanitize(persisted: unknown): Partial<DisplayState> {
  const v = (persisted ?? {}) as Partial<DisplayState>;
  return {
    density: DENSITIES.includes(v.density as Density) ? v.density : "comfortable",
    showDescriptions: typeof v.showDescriptions === "boolean" ? v.showDescriptions : false,
  };
}

export const useDisplay = create<DisplayState>()(
  persist(
    (set) => ({
      density: "comfortable",
      showDescriptions: false,
      setDensity: (density) => set({ density }),
      toggleDescriptions: () => set((s) => ({ showDescriptions: !s.showDescriptions })),
    }),
    {
      name: "ror2-display",
      version: 1,
      // A view preference, never part of a plan and never in a share link (PLAN §8.2).
      migrate: (persisted) => sanitize(persisted) as DisplayState,
    },
  ),
);
