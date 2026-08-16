import { useMemo, useState } from "react";
import { Minus, Plus, Sparkles } from "lucide-react";
import { survivors } from "@/data/survivors";
import { itemById } from "@/data/items";
import { STAT_ITEM_IDS, UNMODELED_STACKING } from "@/data/statItems";
import { computeStats, type DerivedStats, type Difficulty } from "@/lib/statMath";
import { usePlanner } from "@/store/planner";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { SkillProcPanel } from "./SkillProcPanel";

const fmt = (n: number, d = 0) =>
  n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });

interface StatCardDef {
  label: string;
  value: string;
  hint?: string;
}

function statCards(s: DerivedStats): StatCardDef[] {
  return [
    {
      label: "Max Health",
      value: fmt(s.maxHealth),
      hint: s.shieldOnly ? "Transcendence leaves you on 1 HP" : undefined,
    },
    ...(s.maxShield > 0
      ? [
          {
            label: "Max Shield",
            value: fmt(s.maxShield),
            hint: "recharges out of combat; healing cannot restore it",
          },
        ]
      : []),
    { label: "Effective HP", value: fmt(s.effectiveHealth), hint: "health + shield, incl. armor" },
    {
      label: "Health Regen",
      value: `${fmt(s.healthRegen, 1)}/s`,
      hint: s.shieldOnly ? "does not refill shield" : undefined,
    },
    { label: "Damage", value: fmt(s.damage, 1), hint: "per base hit" },
    { label: "Attack Speed", value: `${fmt(s.attackSpeed, 2)}x` },
    { label: "DPS proxy", value: fmt(s.dps, 1), hint: "dmg x aspd x crit" },
    { label: "Move Speed", value: `${fmt(s.moveSpeed, 2)} m/s` },
    { label: "Armor", value: fmt(s.armor) },
    { label: "Crit Chance", value: `${fmt(s.critChance)}%`, hint: `${fmt(s.critMultiplier, 2)}x on crit` },
    { label: "Jumps", value: fmt(s.jumps) },
  ];
}

/**
 * The two hidden difficulty items, with what they actually do. Both are code-verified:
 * `Run.cs` grants them at spawn and `CharacterBody.RecalculateStats` reads them.
 */
const DIFFICULTIES: { id: Difficulty; label: string; hint: string }[] = [
  {
    id: "drizzle",
    label: "Drizzle",
    hint: "Hidden Drizzle item: health regen x1.5 and a flat +70 armor.",
  },
  {
    id: "rainstorm",
    label: "Rainstorm",
    hint: "The only difficulty that grants no hidden item — these are the raw body stats.",
  },
  {
    id: "monsoon",
    label: "Monsoon",
    hint: "Hidden hard-mode item: health regen x0.6. Shared by every difficulty above Monsoon (Typhoon, Eclipse) — the game keys it on countsAsHardMode, not on Monsoon itself.",
  },
];

export function StatLabPage() {
  const [survivorId, setSurvivorId] = useState(survivors[0].id);
  const [level, setLevel] = useState(1);
  const [items, setItems] = useState<Record<string, number>>({});
  const [glass, setGlass] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("rainstorm");

  const plan = usePlanner((st) => st.plan);
  const survivor = survivors.find((s) => s.id === survivorId) ?? survivors[0];

  const derived = useMemo(
    () => computeStats({ survivor, level, items, artifactOfGlass: glass, difficulty }),
    [survivor, level, items, glass, difficulty],
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
        if (plan[id]?.state === "targeted" && !next[id]) next[id] = 1;
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
          Every formula and base stat here is checked against the game&rsquo;s own files, not a
          wiki. Items with conditional effects (only while sprinting, only out of combat)
          aren&rsquo;t modelled.
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

          {/*
            Not a cosmetic setting: Run.cs gives every player a hidden item at spawn on
            Drizzle and on any hard mode, and RecalculateStats reads both. Without this
            control the sheet was silently a Rainstorm sheet (PLAN §9.1).
          */}
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Difficulty
            </h2>
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  title={d.hint}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-sm transition-colors",
                    d.id === difficulty
                      ? "border-primary/60 bg-primary/15 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              {DIFFICULTIES.find((d) => d.id === difficulty)?.hint}
            </p>
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
                    {/*
                      Some items' per-stack effect is a conditional buff or an on-hit event,
                      not a static stat, so adding a second copy changes nothing on this
                      sheet. Without saying so, that reads as a broken calculator rather
                      than a modelling boundary — the same "absent number means no effect"
                      failure this project keeps correcting in the data.
                    */}
                    {UNMODELED_STACKING[id] && (
                      <span
                        className="shrink-0 cursor-help rounded border border-amber-400/40 px-1 text-[10px] font-medium text-amber-300/90"
                        title={UNMODELED_STACKING[id]}
                        aria-label={`Stacking not modelled: ${UNMODELED_STACKING[id]}`}
                      >
                        1&times;
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      {/*
                        aria-disabled, NOT disabled (§3j.145).

                        `disabled` on a focused element hands focus to <body>, so stepping an
                        item down to 0 — an ordinary thing to do — ejected a keyboard user to
                        the top of the page. aria-disabled keeps the button focusable and still
                        announces it as unavailable, so focus stays exactly where the user put
                        it and the next press simply does nothing.
                      */}
                      <button
                        type="button"
                        onClick={() => {
                          if (q > 0) setQty(id, q - 1);
                        }}
                        aria-disabled={q <= 0}
                        aria-label={`Remove one ${item.name}`}
                        className="rounded border border-border p-0.5 text-muted-foreground hover:text-foreground aria-disabled:opacity-30 aria-disabled:hover:text-muted-foreground"
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
            {/*
              Spelled out, not just a tooltip: the tooltip only helps someone who already
              suspects something is wrong. This was reported as "stacking stops working",
              which is exactly what it looks like without an explanation on screen.
            */}
            {STAT_ITEM_IDS.some((id) => UNMODELED_STACKING[id] && (items[id] ?? 0) > 1) && (
              <p className="mt-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
                <strong className="font-semibold">Some stacks are not shown above.</strong>{" "}
                {STAT_ITEM_IDS.filter((id) => UNMODELED_STACKING[id] && (items[id] ?? 0) > 1)
                  .map((id) => `${itemById.get(id)?.name}: ${UNMODELED_STACKING[id]}`)
                  .join(" ")}
              </p>
            )}

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
        {/*
          min-w-0 is what lets the results column SHRINK (§3j.149).

          A grid item defaults to `min-width: auto`, so it refuses to go below its content's
          min-content width. The skill-proc table declares `min-w-[26rem]` (416px) inside an
          `overflow-x-auto` wrapper — correct on its own — but the item widened to 418px
          instead of letting that wrapper scroll, and both columns stretched to the resulting
          track. At 360px that made the whole document 434px wide, and it looked as though
          every control in the left column was too wide when none of them were.
        */}
        <div className="min-w-0">
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
          {derived.shieldOnly && (
            <p className="mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              <strong className="text-foreground">Transcendence is a conversion, not a bonus.</strong>{" "}
              Max health becomes literally 1 and the whole pool moves into shield, which recharges
              on its own after a few seconds out of combat but cannot be healed &mdash; so health
              regen, medkits and most healing do nothing for it. The multiplier{" "}
              {(() => {
                // Read from items.json (§3j.164). These were typed, so a balance change
                // would leave the Stat Lab explaining the shield with the old numbers.
                const row = itemById.get("transcendence")?.stacking[0];
                return row ? `(${row.base}%, +${row.perStack}% per extra stack)` : "";
              })()}{" "}
              applies to your finished health total, so it compounds with Pearl rather
              than adding to it.
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
            Effective HP uses the armor formula (reduction = armor / (100 + armor)); regen from
            items scales with level, matching the game. The DPS proxy (damage x attack speed x
            crit) is a relative comparison, not an exact in-run figure &mdash; it ignores proc
            coefficients and animations.
          </p>

          <SkillProcPanel survivorId={survivor.id} />
        </div>
      </div>
    </div>
  );
}
