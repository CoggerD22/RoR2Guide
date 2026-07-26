import { useState } from "react";
import { Check, Link2, RotateCcw, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { items as allItems, PRESENT_TIERS, TIER_META } from "@/data/items";
import {
  usePlanner,
  PRIORITIES,
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
 * Muted → bright as priority rises, so the ranking reads at a glance. Every level must
 * still be unmistakably *selected*: "low" originally reused the muted resting style and
 * was indistinguishable from an unset control.
 */
const PRIORITY_STYLE: Record<Priority, string> = {
  high: "bg-emerald-400 text-black",
  medium: "bg-emerald-400/25 text-emerald-200",
  low: "bg-foreground/20 text-foreground",
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

/** Priority + goal controls for one targeted item. */
function TargetControls({ item }: { item: Item }) {
  const entry = usePlanner((s) => s.plan[item.id]);
  const setPriority = usePlanner((s) => s.setPriority);
  const setGoal = usePlanner((s) => s.setGoal);
  if (!entry) return null;

  const cap = hardCap(item);
  const overCap = cap !== null && entry.goal !== undefined && entry.goal > cap;

  return (
    <div className="flex flex-wrap items-center gap-1 pl-8">
      <div className="flex overflow-hidden rounded border border-border" role="group" aria-label={`Priority for ${item.name}`}>
        {PRIORITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPriority(item.id, p)}
            aria-pressed={entry.priority === p}
            title={`${PRIORITY_LABEL[p]} priority`}
            className={cn(
              "px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              entry.priority === p ? PRIORITY_STYLE[p] : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PRIORITY_LABEL[p][0]}
          </button>
        ))}
      </div>
      {/* aria-label on the input is the whole accessible name; an extra sr-only span
          would duplicate the item name and make text queries ambiguous. */}
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <input
          type="number"
          min={1}
          max={99}
          value={entry.goal ?? ""}
          placeholder="—"
          onChange={(e) => setGoal(item.id, e.target.value === "" ? null : Number(e.target.value))}
          aria-label={`Goal stack count for ${item.name}`}
          className="w-10 rounded border border-border bg-surface-2 px-1 py-0.5 text-center text-[10px] text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
        />
        ×
      </span>
      {/*
        Objective, not advice: past the cap an extra copy does nothing. Stated as the
        fact ("caps at N") rather than a recommendation ("take N") — see PLAN §5.9.
      */}
      {cap !== null && (
        <span
          className={cn(
            "rounded px-1 py-0.5 text-[10px]",
            overCap ? "bg-amber-400/20 text-amber-300" : "text-muted-foreground",
          )}
          title={
            overCap
              ? `Stacks past ${cap} have no effect at all — a goal of ${entry.goal} wastes ${entry.goal! - cap}.`
              : `Hard cap: stacks past ${cap} have no effect.`
          }
        >
          {overCap ? `caps at ${cap}` : `cap ${cap}`}
        </span>
      )}
    </div>
  );
}

function PlanSection({
  title,
  list,
  state,
  onSelect,
}: {
  title: string;
  list: Item[];
  state: PlanState;
  onSelect: (item: Item) => void;
}) {
  const set = usePlanner((s) => s.set);
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
                ).map((item) => (
                  <li key={item.id} className="group flex flex-col gap-0.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSelect(item)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-2"
                      >
                        <img src={asset(item.icon)} alt="" className="size-6 shrink-0 object-contain" />
                        <span className="truncate text-xs text-foreground">{item.name}</span>
                        {ranked && plan[item.id]?.goal ? (
                          <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] text-muted-foreground">
                            ×{plan[item.id]!.goal}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => set(item.id, null)}
                        aria-label={`Remove ${item.name} from plan`}
                        className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    {ranked && <TargetControls item={item} />}
                  </li>
                ))}
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
  const [shareLabel, setShareLabel] = useState<"idle" | "copied" | "failed">("idle");

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
          <button
            type="button"
            onClick={reset}
            disabled={total === 0}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" /> New run
          </button>
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

      <PlanSection title="Targeted" list={targeted} state="targeted" onSelect={onSelect} />
      <PlanSection title="Avoided" list={avoided} state="avoided" onSelect={onSelect} />
    </aside>
  );
}
