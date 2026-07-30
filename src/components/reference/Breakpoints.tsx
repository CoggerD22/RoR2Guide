import { itemById } from "@/data/items";
import {
  MILESTONES,
  hyperbolicChance,
  stacksToCritCap,
  linearAt,
  cooldownReduction,
  COOLDOWN_ITEMS,
  type Verification,
} from "@/lib/breakpoints";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";

/**
 * Breakpoint tables (PLAN §4.3) — "how many stacks to reach X".
 * Every number is computed from the game's own formulas, not hand-entered.
 */

interface HyperbolicItem {
  id: string;
  stat: string;
  perStackAmp: number;
  verified: Verification;
}

// Hyperbolic "chance that approaches but never reaches 100%" mechanics. All four are now
// code-verified; the two on-hit procs were previously labelled as following "RoR2's
// universal proc-chance stacking, not individually decompiled", which was a guess that
// happened to be right — they are hyperbolic, and reading them proved it:
//
//   Sentient Meat Hook  (1f - 100f / (100f + 20f * n)) * 100f          — ConvertAmp inlined
//   Tentabauble         ConvertAmplificationPercentageIntoReductionPercentage(5f * n * proc)
//
// Note WHERE the proc coefficient sits, because the two differ: Meat Hook multiplies the
// finished chance by it, Tentabauble folds it INSIDE the amplification. Those are not the
// same function for proc != 1, so the table below states the assumption.
const HYPERBOLIC: HyperbolicItem[] = [
  { id: "tougher-times", stat: "Block an attack", perStackAmp: 15, verified: "code" },
  { id: "old-guillotine", stat: "Execute elites below", perStackAmp: 13, verified: "code" },
  { id: "sentient-meat-hook", stat: "Fire hooks on hit", perStackAmp: 20, verified: "code" },
  { id: "tentabauble", stat: "Root on hit", perStackAmp: 5, verified: "code" },
];

const CRIT_STACKS = [1, 3, 5, 7, 9, 10];
const pct = (n: number) => `${n.toFixed(1).replace(/\.0$/, "")}%`;

function VerifiedTag({ v }: { v: Verification }) {
  return v === "code" ? (
    <span
      title="Formula confirmed against the decompiled game code"
      className="rounded-full border border-emerald-400/30 px-1.5 py-0.5 text-[10px] text-emerald-300/90"
    >
      code-verified
    </span>
  ) : (
    <span
      title="Follows the same hyperbolic curve, but the specific mechanic has not been read in the decompile"
      className="rounded-full border border-sky-400/25 px-1.5 py-0.5 text-[10px] text-sky-300/80"
    >
      standard curve
    </span>
  );
}

export function Breakpoints() {
  const critCap = stacksToCritCap(10); // Lens-Maker's, from 1% base

  return (
    <div className="flex flex-col gap-8">
      {/* Critical strike */}
      <section>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">Guaranteed crits</h3>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Everyone starts at <span className="text-foreground">1%</span> crit. Lens-Maker&rsquo;s
          Glasses add <span className="text-foreground">+10%</span> each, so{" "}
          <span className="text-foreground">{critCap} Glasses</span> reach the 100% cap. Predatory
          Instincts and Harvester&rsquo;s Scythe each add a flat <span className="text-foreground">+5%</span>{" "}
          (one-time), shaving a Glass off. Laser Scope is crit <em>damage</em>, not chance.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[22rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Lens-Maker&rsquo;s Glasses</th>
                {CRIT_STACKS.map((s) => (
                  <th key={s} className="px-3 py-2 text-right font-medium">{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-3 py-2 text-muted-foreground">Crit chance</td>
                {CRIT_STACKS.map((s) => {
                  const crit = Math.min(100, 1 + linearAt(10, 10, s));
                  return (
                    <td
                      key={s}
                      className={cn(
                        "px-3 py-2 text-right font-semibold tabular-nums",
                        crit >= 100 ? "text-emerald-300" : "text-foreground",
                      )}
                    >
                      {crit}%
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Hyperbolic chances */}
      <section>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
          Block, execute &amp; on-hit chances
        </h3>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          These stack <span className="text-foreground">hyperbolically</span> &mdash; each stack adds
          less than the last, approaching but never reaching 100%. The tooltip percentage is the
          per-stack <em>input</em>, not the actual chance (Tougher Times shows 15% but blocks 13% at
          one stack).
        </p>
        {/*
          The two on-hit rows are proc-scaled and the table cannot show that, so it has to be
          stated. It is not a footnote-level detail: Sentient Meat Hook multiplies the finished
          chance by the proc coefficient, while Tentabauble folds it inside the amplification,
          so the two diverge as soon as the coefficient is not 1 (PLAN §5.0.1).
        */}
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          The two on-hit rows assume a <span className="text-foreground">proc coefficient of 1</span>.
          Both scale with it, but not identically: Sentient Meat Hook multiplies the finished chance,
          whereas Tentabauble applies the coefficient <em>inside</em> the curve, so a
          half-proc-coefficient hit does not simply halve either one.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Item</th>
                {MILESTONES.map((n) => (
                  <th key={n} className="px-3 py-2 text-right font-medium">{n}&times;</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {HYPERBOLIC.map((h) => {
                const item = itemById.get(h.id);
                return (
                  <tr key={h.id} className="border-b border-border/50 last:border-0 align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {item && (
                          <img src={asset(item.icon)} alt="" className="size-6 shrink-0 object-contain" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{item?.name ?? h.id}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {h.stat} <VerifiedTag v={h.verified} />
                          </div>
                        </div>
                      </div>
                    </td>
                    {MILESTONES.map((n) => (
                      <td key={n} className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                        {pct(hyperbolicChance(h.perStackAmp, n))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cooldown reduction */}
      <section>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">Cooldown reduction</h3>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Cooldown items stack <span className="text-foreground">multiplicatively</span>, so total
          reduction climbs fast early then flattens &mdash; never quite reaching 0 cooldown. All
          multipliers below are confirmed in the game code.
        </p>
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">Item</th>
                {MILESTONES.map((n) => (
                  <th key={n} className="px-3 py-2 text-right font-medium">{n}&times;</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COOLDOWN_ITEMS.map((c) => {
                const item = itemById.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-border/50 last:border-0 align-top">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {item && (
                          <img src={asset(item.icon)} alt="" className="size-6 shrink-0 object-contain" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-foreground">{item?.name ?? c.id}</div>
                          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            {c.stat} <VerifiedTag v={c.verified} />
                          </div>
                        </div>
                      </div>
                    </td>
                    {MILESTONES.map((n) => (
                      <td key={n} className="px-3 py-2 text-right font-semibold tabular-nums text-foreground">
                        {pct(cooldownReduction(c.firstStackScale, c.mult, n))}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Values are computed from the game&rsquo;s formulas, not transcribed. Hyperbolic uses{" "}
        <code className="rounded bg-surface-2 px-1 py-0.5">100 &minus; 100/(100 + amp)</code>;
        cooldown uses <code className="rounded bg-surface-2 px-1 py-0.5">1 &minus; first &middot; mult<sup>n&minus;1</sup></code>.
      </p>
    </div>
  );
}
