/**
 * Shareable run-plan URLs (PLAN §4.4, extended for §5.8b). The planner is client-only
 * (Zustand + localStorage), so "share this plan" has to round-trip through the URL —
 * no server.
 *
 * Encoding is ID-based, not index-based: `?t=<targeted>&a=<avoided ids>`. Item ids are
 * all `[a-z0-9-]+` (verified), so they're URL-safe and need no escaping. ID-based means
 * a link stays correct when items.json grows or is reordered; unknown ids (a stale link
 * after an item is renamed/removed) are dropped on decode rather than resolving to the
 * wrong item.
 *
 * Targeted entries may carry priority and goal, appended to the id:
 *     crowbar          → priority medium (the default), no goal
 *     crowbar!h        → priority high
 *     crowbar!l*3      → priority low, goal 3
 *     crowbar*3        → default priority, goal 3
 * Avoided entries are never ranked, so `a=` stays a plain id list.
 *
 * Old links (plain id lists with no suffixes) decode unchanged — a shared plan from
 * before this feature must not break.
 */
import { DEFAULT_PRIORITY, MAX_GOAL, MIN_GOAL, type PlanEntry, type Priority } from "@/store/planner";

export type Plan = Record<string, PlanEntry>;

const CODE_TO_PRIORITY: Record<string, Priority> = { h: "high", m: "medium", l: "low" };
const PRIORITY_TO_CODE: Record<Priority, string> = { high: "h", medium: "m", low: "l" };

/** Serialize a plan to a query string (no leading "?"). Empty plan → "". */
export function encodePlan(plan: Plan): string {
  const targeted: string[] = [];
  const avoided: string[] = [];
  for (const [id, entry] of Object.entries(plan)) {
    if (entry.state === "avoided") {
      avoided.push(id);
      continue;
    }
    // Omit the default priority so common links stay short and readable.
    const p = entry.priority && entry.priority !== DEFAULT_PRIORITY
      ? `!${PRIORITY_TO_CODE[entry.priority]}`
      : "";
    // A goal of 1 IS encoded. It used to be omitted as "adds nothing", but the rail
    // renders "x1" for a goal of 1 and "+goal" for none — they are different states, and
    // "one is enough" is a real plan for the items where stacking genuinely does nothing
    // (Rusted Key, Encrusted Key, Longstanding Solitude past 3). Dropping it meant the
    // recipient of a link saw a plan the sender had not made (PLAN §9.1).
    const g = entry.goal !== undefined ? `*${entry.goal}` : "";
    targeted.push(`${id}${p}${g}`);
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
 * Split "crowbar!h*3" into its parts.
 *
 * The id is always taken as the leading `[a-z0-9-]+` run, so a malformed or
 * future-unknown suffix degrades to "just the item at default priority" instead of
 * producing a phantom id like "crowbar!z" — which would then be silently dropped by
 * `isKnownId` and quietly lose the item from a shared plan.
 */
function parseToken(token: string): { id: string; priority: Priority; goal?: number } {
  const trimmed = token.trim();
  const id = /^[a-z0-9-]+/.exec(trimmed)?.[0] ?? "";
  if (!id) return { id: "", priority: DEFAULT_PRIORITY };
  const rest = trimmed.slice(id.length);
  const priorityCode = /^!([hml])/.exec(rest)?.[1];
  // Out-of-range goals are DROPPED, not clamped. `Math.max(1, …)` used to turn `*0` into a
  // goal of 1 — inventing an intention the link never expressed — and imposed no ceiling at
  // all, so `*99999999999999999999` decoded to 1e20 and re-encoded into the next share link.
  const goalRaw = /\*(\d+)/.exec(rest)?.[1];
  const parsed = goalRaw ? parseInt(goalRaw, 10) : NaN;
  const goal =
    Number.isInteger(parsed) && parsed >= MIN_GOAL && parsed <= MAX_GOAL ? parsed : undefined;
  return {
    id,
    priority: (priorityCode && CODE_TO_PRIORITY[priorityCode]) || DEFAULT_PRIORITY,
    ...(goal ? { goal } : {}),
  };
}

/**
 * Parse a plan from a query string. `isKnownId` (e.g. `itemById.has`) filters out ids
 * that no longer exist, so a stale link degrades gracefully instead of showing phantom
 * entries.
 */
export function decodePlan(search: string, isKnownId?: (id: string) => boolean): Plan {
  const params = new URLSearchParams(search);
  const plan: Plan = {};

  for (const part of (params.get("t") ?? "").split(",")) {
    if (!part.trim()) continue;
    const { id, priority, goal } = parseToken(part);
    if (!id || (isKnownId && !isKnownId(id))) continue;
    plan[id] = { state: "targeted", priority, ...(goal ? { goal } : {}) };
  }
  for (const part of (params.get("a") ?? "").split(",")) {
    // Tolerate suffixes here too, in case a hand-edited link carries them; avoided
    // items are simply never ranked.
    const { id } = parseToken(part);
    if (!id || (isKnownId && !isKnownId(id))) continue;
    plan[id] = { state: "avoided", priority: DEFAULT_PRIORITY };
  }
  return plan;
}
