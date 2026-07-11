import { Check, RotateCcw, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { items as allItems, PRESENT_TIERS, TIER_META } from "@/data/items";
import { usePlanner, type PlanState } from "@/store/planner";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";

interface RunPlanRailProps {
  onSelect: (item: Item) => void;
}

function groupByTier(list: Item[]) {
  return PRESENT_TIERS.map((tier) => ({
    tier,
    list: list.filter((it) => it.tier === tier),
  })).filter((g) => g.list.length > 0);
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
  const accent = state === "targeted" ? "text-emerald-400" : "text-red-400";

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
                {tierList.map((item) => (
                  <li key={item.id} className="group flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-surface-2"
                    >
                      <img src={asset(item.icon)} alt="" className="size-6 shrink-0 object-contain" />
                      <span className="truncate text-xs text-foreground">{item.name}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => set(item.id, null)}
                      aria-label={`Remove ${item.name} from plan`}
                      className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
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

  const targeted = allItems.filter((it) => plan[it.id] === "targeted");
  const avoided = allItems.filter((it) => plan[it.id] === "avoided");
  const total = targeted.length + avoided.length;

  return (
    <aside className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 lg:sticky lg:top-16">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-foreground">
          Run Plan
        </h2>
        <button
          type="button"
          onClick={reset}
          disabled={total === 0}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          <RotateCcw className="size-3.5" /> New run
        </button>
      </div>

      {total === 0 && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          Click a card to mark it <span className="text-emerald-400">targeted</span>, click again to{" "}
          <span className="text-red-400">avoid</span> it, once more to clear. Your plan is saved
          across refreshes.
        </p>
      )}

      <PlanSection title="Targeted" list={targeted} state="targeted" onSelect={onSelect} />
      <PlanSection title="Avoided" list={avoided} state="avoided" onSelect={onSelect} />
    </aside>
  );
}
