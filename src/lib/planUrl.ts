/**
 * Shareable run-plan URLs (PLAN §4.4). The planner is client-only (Zustand +
 * localStorage), so "share this plan" has to round-trip through the URL — no server.
 *
 * Encoding is ID-based, not index-based: `?t=<targeted ids>&a=<avoided ids>`, each a
 * comma-separated list. Item ids are all `[a-z0-9-]+` (verified), so they're URL-safe
 * and need no escaping. ID-based means a link stays correct when items.json grows or
 * is reordered; unknown ids (a stale link after an item is renamed/removed) are simply
 * dropped on decode rather than resolving to the wrong item.
 */
import type { PlanState } from "@/store/planner";

export type Plan = Record<string, PlanState>;

/** Serialize a plan to a query string (no leading "?"). Empty plan → "". */
export function encodePlan(plan: Plan): string {
  const targeted: string[] = [];
  const avoided: string[] = [];
  for (const [id, state] of Object.entries(plan)) {
    if (state === "targeted") targeted.push(id);
    else if (state === "avoided") avoided.push(id);
  }
  // Sort for a stable, diff-friendly URL that doesn't depend on insertion order.
  targeted.sort();
  avoided.sort();
  const parts: string[] = [];
  if (targeted.length) parts.push(`t=${targeted.join(",")}`);
  if (avoided.length) parts.push(`a=${avoided.join(",")}`);
  return parts.join("&");
}

/** True if a query string (with or without leading "?") carries a shared plan. */
export function hasPlanParams(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.has("t") || params.has("a");
}

/**
 * Parse a plan from a query string. `isKnownId` (e.g. `itemById.has`) filters out
 * ids that no longer exist, so a stale link degrades gracefully instead of showing
 * phantom entries. Later duplicates win, but "avoided" is applied after "targeted"
 * only per-list — an id can't be both since it appears in one param.
 */
export function decodePlan(search: string, isKnownId?: (id: string) => boolean): Plan {
  const params = new URLSearchParams(search);
  const plan: Plan = {};
  const ingest = (raw: string | null, state: PlanState) => {
    if (!raw) return;
    for (const part of raw.split(",")) {
      const id = part.trim();
      if (!id) continue;
      if (isKnownId && !isKnownId(id)) continue;
      plan[id] = state;
    }
  };
  ingest(params.get("t"), "targeted");
  ingest(params.get("a"), "avoided");
  return plan;
}
