import type { LucideIcon } from "lucide-react";
import { BookOpen, ClipboardList, Calculator, Library, Lightbulb } from "lucide-react";

/**
 * Single source of truth for the top-level sections. Both the router and the
 * nav bar read this, so adding a section in a later milestone is one edit.
 * `milestone` drives the "Coming in Mx" placeholder copy during M0.
 */
export interface NavSection {
  path: "/items" | "/planner" | "/stats" | "/reference" | "/guides";
  label: string;
  blurb: string;
  milestone: string;
  icon: LucideIcon;
}

export const NAV_SECTIONS: NavSection[] = [
  {
    path: "/items",
    label: "Item Codex",
    blurb: "Every item and equipment as searchable, filterable cards with in-game tooltips.",
    milestone: "M2",
    icon: BookOpen,
  },
  {
    path: "/planner",
    label: "Run Planner",
    blurb: "Mark items to target or avoid; a tier-grouped plan that persists across a run.",
    milestone: "M3",
    icon: ClipboardList,
  },
  {
    path: "/stats",
    label: "Stat Lab",
    blurb: "Pick a survivor, set a level, stack items, and watch the derived stats update.",
    milestone: "M5",
    icon: Calculator,
  },
  {
    path: "/reference",
    label: "Reference",
    blurb: "Bazaar dreams, shrines, loadout unlocks, and artifacts — the hard-to-find answers.",
    milestone: "M6",
    icon: Library,
  },
  {
    path: "/guides",
    label: "Guides",
    blurb: "Build advice and item priorities — opinion, badged and dated, kept out of the codex.",
    milestone: "M7",
    icon: Lightbulb,
  },
];
