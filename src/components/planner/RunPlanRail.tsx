import { useState } from "react";
import { Check, Link2, RotateCcw, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { items as allItems, PRESENT_TIERS, TIER_META } from "@/data/items";
import {
  usePlanner,
  PRIORITY_LABEL,
  PRIORITY_RANK,
  type PlanState,
  type Priority,
} from "@/store/planner";
import { encodePlan } from "@/lib/planUrl";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";

interface RunPlanRailProps {
  onSelect: (item: Item) => void;
}

/**
 * Priority is shown as a coloured left edge, not a control (PLAN §5.8b Part 1 revision).
 *
 * The first version put a three-button H/M/L strip plus a number input on every row —
 * 41% of the row height was editing chrome, and three items cost 17 buttons. The rail
 * is READ far more than it is edited, and read with a game running, so priority is now
 * carried by rank order plus this weight cue, and the control only appears on
 * hover/focus.
 */
const PRIORITY_EDGE: Record<Priority, string> = {
  high: "border-l-emerald-400",
  medium: "border-l-emerald-400/40",
  low: "border-l-border",
};

function groupByTier(list: Item[]) {
  return PRESENT_TIERS.map((tier) => ({
    tier,
    list: list.filter((it) => it.tier === tier),
  })).filter((g) => g.list.length > 0);
}

/**
 * The lowest hard ceiling across an item's stacking entries, or null.
 *
 * This is the ONLY objective answer to "how many should I take?" (PLAN §5.8b Part 2):
 * past this, extra copies do literally nothing — it's the code, not a recommendation.
 * Items whose cap scales with stacks carry no `capStacks`, so they correctly produce
 * no warning here.
 */
function hardCap(item: Item): number | null {
  const caps = item.stacking
    .map((s) => s.capStacks)
    .filter((n): n is number => typeof n === "number");
  return caps.length ? Math.min(...caps) : null;
}

/** Cycles high → medium → low. One button instead of a three-button group. */
const NEXT_PRIORITY: Record<Priority, Priority> = {
  high: "medium",
  medium: "low",
  low: "high",
};

/**
 * Goal shown as inline text ("×3"), click to edit. A number input per row was a heavy
 * control for a single digit, and it duplicated the badge that already showed the same
 * number (PLAN §5.8b Part 1 revision).
 */
function GoalField({ item, goal }: { item: Item; goal?: number }) {
  const setGoal = usePlanner((s) => s.setGoal);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        min={1}
        max={99}
        defaultValue={goal ?? ""}
        aria-label={`Goal stack count for ${item.name}`}
        onBlur={(e) => {
          setGoal(item.id, e.target.value === "" ? null : Number(e.target.value));
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-10 rounded border border-primary/60 bg-surface-2 px-1 text-center text-[11px] text-foreground focus:outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      aria-label={goal ? `Goal: ${goal}. Edit.` : `Set a goal count for ${item.name}`}
      className={cn(
        "rounded px-1 text-[11px] tabular-nums transition-colors hover:bg-surface-2",
        goal ? "text-muted-foreground" : "text-muted-foreground/0 group-hover:text-muted-foreground/60",
      )}
    >
      {goal ? `×${goal}` : "+goal"}
    </button>
  );
}

function PlanSection({
  title,
  list,
  state,
  onSelect,
  runMode,
}: {
  title: string;
  list: Item[];
  state: PlanState;
  onSelect: (item: Item) => void;
  runMode: boolean;
}) {
  const set = usePlanner((s) => s.set);
  const setPriority = usePlanner((s) => s.setPriority);
  const plan = usePlanner((s) => s.plan);
  const accent = state === "targeted" ? "text-emerald-400" : "text-red-400";
  const ranked = state === "targeted";

  return (
    <div>
      <div className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide", accent)}>
        {state === "targeted" ? <Check className="size-3.5" /> : <X className="size-3.5" />}
        {title}
        <span className="text-muted-foreground">({list.length})</span>
      </div>
      {list.length === 0 ? (
        <p className="pl-5 text-xs text-muted-foreground">Nothing yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {groupByTier(list).map(({ tier, list: tierList }) => (
            <div key={tier}>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-widest" style={{ color: TIER_META[tier].color }}>
                {TIER_META[tier].label}
              </div>
              <ul className="flex flex-col gap-0.5">
                {/*
                  Sorted by priority WITHIN the tier: printers and cauldrons trade
                  inside a tier, so "which white do I want most?" is the actual
                  question being asked at the machine (PLAN §5.8b).
                */}
                {(ranked
                  ? [...tierList].sort(
                      (a, b) =>
                        PRIORITY_RANK[plan[a.id]?.priority ?? "medium"] -
                          PRIORITY_RANK[plan[b.id]?.priority ?? "medium"] ||
                        a.name.localeCompare(b.name),
                    )
                  : tierList
                ).map((item) => {
                  const entry = plan[item.id];
                  const cap = hardCap(item);
                  const overCap = cap !== null && entry?.goal !== undefined && entry.goal > cap;
                  return (
                    // ONE row per item. Priority is the left edge, the goal is inline
                    // text, and the two buttons only surface on hover/focus — so at rest
                    // the row is just the item, which is what a plan should be.
                    <li
                      key={item.id}
                      className={cn(
                        "group flex items-center gap-1.5 rounded-r border-l-2 pl-1.5",
                        ranked ? PRIORITY_EDGE[entry?.priority ?? "medium"] : "border-l-transparent",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-2"
                      >
                        <img src={asset(item.icon)} alt="" className="size-6 shrink-0 object-contain" />
                        <span className="truncate text-xs text-foreground">{item.name}</span>
                      </button>

                      {/* Run mode is read-only: the goal is plain text, not a control.
                          Mid-run you are reading, and an editable affordance is both
                          noise and an accidental-edit risk (PLAN §5.8c). */}
                      {ranked &&
                        (runMode ? (
                          entry?.goal ? (
                            <span className="shrink-0 px-1 text-[11px] tabular-nums text-muted-foreground">
                              ×{entry.goal}
                            </span>
                          ) : null
                        ) : (
                          <GoalField item={item} goal={entry?.goal} />
                        ))}

                      {/* Objective, not advice: past the cap an extra copy does nothing.
                          Stated as the ceiling, never as "take N" — see PLAN §5.9.
                          Only shown when it actually matters: a goal that exceeds it. */}
                      {ranked && cap !== null && overCap && (
                        <span
                          className="shrink-0 rounded bg-amber-400/20 px-1 text-[10px] text-amber-300"
                          title={`Stacks past ${cap} have no effect at all — a goal of ${entry!.goal} wastes ${entry!.goal! - cap}.`}
                        >
                          caps at {cap}
                        </span>
                      )}

                      {!runMode && ranked && entry && (
                        <button
                          type="button"
                          onClick={() => setPriority(item.id, NEXT_PRIORITY[entry.priority])}
                          aria-label={`Priority for ${item.name}: ${PRIORITY_LABEL[entry.priority]}. Change to ${PRIORITY_LABEL[NEXT_PRIORITY[entry.priority]]}.`}
                          className="shrink-0 rounded px-1 text-[10px] font-medium text-muted-foreground opacity-0 transition hover:bg-surface-2 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          {PRIORITY_LABEL[entry.priority]}
                        </button>
                      )}

                      {!runMode && (
                        <button
                          type="button"
                          onClick={() => set(item.id, null)}
                          aria-label={`Remove ${item.name} from plan`}
                          className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RunPlanRail({ onSelect }: RunPlanRailProps) {
  const plan = usePlanner((s) => s.plan);
  const reset = usePlanner((s) => s.reset);
  const railMode = usePlanner((s) => s.railMode);
  const setRailMode = usePlanner((s) => s.setRailMode);
  const [shareLabel, setShareLabel] = useState<"idle" | "copied" | "failed">("idle");
  const runMode = railMode === "run";

  const targeted = allItems.filter((it) => plan[it.id]?.state === "targeted");
  const avoided = allItems.filter((it) => plan[it.id]?.state === "avoided");
  const total = targeted.length + avoided.length;

  const share = async () => {
    // Current planner URL (origin + path, no query) + the encoded plan.
    const url = `${window.location.origin}${window.location.pathname}?${encodePlan(plan)}`;
    const ok = await copyText(url);
    setShareLabel(ok ? "copied" : "failed");
    setTimeout(() => setShareLabel("idle"), 2000);
  };

  // The rail is `sticky` on desktop, and a sticky box TALLER than the viewport has an
  // unreachable bottom: it pins at top-16 and the rest is simply cut off, with no way to
  // scroll to it. A realistic plan hits this fast — 26 targeted items is ~1540px in a
  // 900px viewport. So constrain it to the viewport and scroll internally, but only at
  // `lg` where it's sticky; on mobile it sits in normal flow and should stay full height.
  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-16 lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:overscroll-contain">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
          Run Plan
        </h2>
        <div className="flex items-center gap-3">
          {/*
            Plan / Run (PLAN §5.8c). Run mode strips every editing affordance: mid-run
            you are reading with a game in the way, and a control you might hit by
            accident is worse than no control. The choice persists, since a player who
            switches to Run mode wants it to still be there next session.
          */}
          <div className="flex overflow-hidden rounded border border-border text-[10px]">
            {(["plan", "run"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setRailMode(m)}
                aria-pressed={railMode === m}
                title={
                  m === "plan"
                    ? "Plan mode — full editing"
                    : "Run mode — read-only, for glancing at mid-run"
                }
                className={cn(
                  "px-1.5 py-0.5 font-medium capitalize transition-colors",
                  railMode === m
                    ? "bg-primary/20 text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={share}
            disabled={total === 0}
            className={cn(
              "inline-flex items-center gap-1 text-xs hover:text-foreground disabled:opacity-40",
              shareLabel === "copied" ? "text-emerald-400" : shareLabel === "failed" ? "text-red-400" : "text-muted-foreground",
            )}
            title="Copy a shareable link to this plan"
          >
            {shareLabel === "copied" ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {shareLabel === "copied" ? "Copied!" : shareLabel === "failed" ? "Copy failed" : "Copy link"}
          </button>
          {!runMode && (
            <button
              type="button"
              onClick={reset}
              disabled={total === 0}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
            >
              <RotateCcw className="size-3.5" /> New run
            </button>
          )}
        </div>
      </div>

      {total === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Click a card to mark it <span className="text-emerald-400">targeted</span>, click again to{" "}
          <span className="text-red-400">avoid</span> it, once more to clear. Set{" "}
          <span className="text-foreground">H/M/L priority</span> and a{" "}
          <span className="text-foreground">goal count</span> on anything you target. Your plan is
          saved across refreshes.
        </p>
      )}

      <PlanSection title="Targeted" list={targeted} state="targeted" onSelect={onSelect} runMode={runMode} />
      <PlanSection title="Avoided" list={avoided} state="avoided" onSelect={onSelect} runMode={runMode} />
    </aside>
  );
}
