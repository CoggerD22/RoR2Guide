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
  /**
   * Show item names under the icons.
   *
   * Independent of density rather than implied by it. Dense mode used to hide names
   * outright, which forced a choice between "most items on screen" and "readable at a
   * glance" — but those are separate wants, and tying them together meant a player who
   * wanted a dense grid WITH names simply could not have one.
   */
  showNames: boolean;
  setDensity: (density: Density) => void;
  toggleDescriptions: () => void;
  toggleNames: () => void;
}

/** Guard rehydrated values — localStorage is not a trusted store (see planner.ts). */
function sanitize(persisted: unknown): Partial<DisplayState> {
  const v = (persisted ?? {}) as Partial<DisplayState>;
  return {
    density: DENSITIES.includes(v.density as Density) ? v.density : "comfortable",
    showDescriptions: typeof v.showDescriptions === "boolean" ? v.showDescriptions : false,
    showNames: typeof v.showNames === "boolean" ? v.showNames : true,
  };
}

export const useDisplay = create<DisplayState>()(
  persist(
    (set) => ({
      density: "comfortable",
      showDescriptions: false,
      showNames: true,
      setDensity: (density) => set({ density }),
      toggleDescriptions: () => set((s) => ({ showDescriptions: !s.showDescriptions })),
      toggleNames: () => set((s) => ({ showNames: !s.showNames })),
    }),
    {
      name: "ror2-display",
      version: 1,
      // A view preference, never part of a plan and never in a share link (PLAN §8.2).
      migrate: (persisted) => sanitize(persisted) as DisplayState,
      /**
       * §3j.158 — `sanitize` has to run on EVERY hydrate, not only on a version change.
       *
       * Wired to `migrate` alone it never ran: zustand calls `migrate` only when the stored
       * version differs, and this has been version 1 throughout. That is the identical defect
       * §3j.146 found and fixed in `planner.ts` — fixed there as an instance, and left here.
       *
       * The consequence was not cosmetic. `DENSITY_GRID[density]` is `undefined` for an
       * unrecognised value, so a corrupted `density` rendered the codex as a bare `grid` with
       * no column classes at all: 217 items in a single column, no error, nothing to explain it.
       */
      merge: (persisted, current) => ({ ...current, ...sanitize(persisted) }),
    },
  ),
);
