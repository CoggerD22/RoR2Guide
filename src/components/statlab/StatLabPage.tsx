import { useMemo, useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";
import { survivors } from "@/data/survivors";
import { itemById } from "@/data/items";
import { STAT_ITEM_IDS } from "@/data/statItems";
import { computeStats, type DerivedStats } from "@/lib/statMath";
import { usePlanner } from "@/store/planner";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";

const fmt = (n: number, d = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

interface StatCardDef {
  label: string;
  value: string;
  hint?: string;
}

function statCards(s: DerivedStats): StatCardDef[] {
  return [
    { label: "Max Health", value: fmt(s.maxHealth) },
    { label: "Effective HP", value: fmt(s.effectiveHealth), hint: "incl. armor" },
    { label: "Health Regen", value: `${fmt(s.healthRegen, 1)}/s` },
    { label: "Damage", value: fmt(s.damage, 1), hint: "per base hit" },
    { label: "Attack Speed", value: `${fmt(s.attackSpeed, 2)}x` },
    { label: "DPS proxy", value: fmt(s.dps, 1), hint: "dmg x aspd x crit" },
    { label: "Move Speed", value: `${fmt(s.moveSpeed, 2)} m/s` },
    { label: "Armor", value: fmt(s.armor) },
    { label: "Crit Chance", value: `${fmt(s.critChance)}%`, hint: `${fmt(s.critMultiplier, 2)}x on crit` },
    { label: "Jumps", value: fmt(s.jumps) },
  ];
}

export function StatLabPage() {
  const [survivorId, setSurvivorId] = useState(survivors[0].id);
  const [level, setLevel] = useState(1);
  const [items, setItems] = useState<Record<string, number>>({});
  const [glass, setGlass] = useState(false);

  const plan = usePlanner((st) => st.plan);
  const survivor = survivors.find((s) => s.id === survivorId) ?? survivors[0];

  const derived = useMemo(
    () => computeStats({ survivor, level, items, artifactOfGlass: glass }),
    [survivor, level, items, glass],
  );

  const setQty = (id: string, q: number) =>
    setItems((prev) => {
      const next = { ...prev };
      if (q <= 0) delete next[id];
      else next[id] = q;
      return next;
    });

  const importFromPlan = () =>
    setItems((prev) => {
      const next = { ...prev };
      for (const id of STAT_ITEM_IDS) {
        if (plan[id] === "targeted" && !next[id]) next[id] = 1;
      }
      return next;
    });

  const totalItems = Object.values(items).reduce((a, b) => a + b, 0);

  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Stat Lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a survivor and level, stack stat items, and watch the derived numbers update.
          Uses standard (Rainstorm) regen and base attack speed; conditional and proc items are
          out of scope for this v1.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Controls */}
        <div className="flex flex-col gap-5">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Survivor
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {survivors.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSurvivorId(s.id)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    s.id === survivorId
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Level
              </h2>
              <input
                type="number"
                min={1}
                max={99}
                value={level}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (!Number.isNaN(v)) setLevel(Math.max(1, Math.min(99, v)));
                }}
                className="w-14 rounded-md border border-border bg-surface px-2 py-0.5 text-right text-sm font-semibold text-foreground focus:border-primary/60 focus:outline-none"
                aria-label="Survivor level"
              />
            </div>
            <input
              type="range"
              min={1}
              max={99}
              value={level}
              onChange={(e) => setLevel(Number(e.target.value))}
              className="level-slider"
              aria-label="Survivor level slider"
            />
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Items {totalItems > 0 && <span className="text-primary">({totalItems})</span>}
              </h2>
              <button
                type="button"
                onClick={importFromPlan}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Import from Run Plan
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {STAT_ITEM_IDS.map((id) => {
                const item = itemById.get(id);
                if (!item) return null;
                const q = items[id] ?? 0;
                return (
                  <div
                    key={id}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-2 py-1",
                      q > 0 ? "border-primary/40 bg-surface-2" : "border-transparent",
                    )}
                  >
                    <img src={asset(item.icon)} alt="" className="size-7 shrink-0 object-contain" />
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQty(id, q - 1)}
                        disabled={q <= 0}
                        aria-label={`Remove one ${item.name}`}
                        className="rounded border border-border p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm tabular-nums text-foreground">{q}</span>
                      <button
                        type="button"
                        onClick={() => setQty(id, q + 1)}
                        aria-label={`Add one ${item.name}`}
                        className="rounded border border-border p-0.5 text-muted-foreground hover:text-foreground"
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={glass}
                onChange={(e) => setGlass(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              <Sparkles className="size-4 text-tier-lunar" /> Artifact of Glass (x5 damage, 10% HP)
            </label>
          </section>
        </div>

        {/* Readout */}
        <div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {statCards(derived).map((c) => (
              <div key={c.label} className="rounded-xl border border-border bg-surface p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</div>
                <div className="mt-1 font-display text-2xl font-semibold text-foreground">
                  {c.value}
                </div>
                {c.hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{c.hint}</div>}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Effective HP uses the armor formula (reduction = armor / (100 + armor)). Stacking order
            is a close approximation of in-game behavior; treat the DPS proxy as a relative
            comparison, not an exact in-run figure.
          </p>
        </div>
      </div>
    </div>
  );
}
