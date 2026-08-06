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
      {/*
        Every curve on this page takes a stack count as its input, and nothing on the site
        had ever said what the game counts as a stack. `Inventory.UpdateEffectiveItemStacks`
        sums three separate collections and can zero the lot — a caveat that applies to every
        number in the dataset, so it belongs once, here, rather than on 217 records.
      */}
      <section>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
          What counts as a stack
        </h3>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Every formula below is fed by{" "}
          <code className="rounded bg-surface-2 px-1">GetItemCountEffective</code>, and
          &ldquo;effective&rdquo; is doing real work.{" "}
          <code className="rounded bg-surface-2 px-1">UpdateEffectiveItemStacks</code> adds
          three collections together &mdash; the items you{" "}
          <span className="text-foreground">picked up</span>, items you are currently{" "}
          <span className="text-foreground">channeling</span>, and{" "}
          <span className="text-foreground">temporary</span> items &mdash; so a borrowed or
          channeled copy counts exactly as much as one you own, on every curve here.
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          It can also go to <span className="text-foreground">zero</span>: while an inventory
          is disabled, every item that can be removed reports a count of 0, which is what
          &ldquo;disable items&rdquo; effects actually do. Items flagged as non-removable
          &mdash; a survivor&rsquo;s built-in passives, world-unique items &mdash; keep
          working, because the reset is gated on{" "}
          <code className="rounded bg-surface-2 px-1">canRemove</code>.
        </p>
      </section>

      {/*
        The fourth shared input (MATH-VERIFICATION §3j.92). Four published item formulas
        scale by difficultyCoefficient — Roll of Pennies, Ghor's Tome, Brittle Crown,
        Defiant Gouge — as do chest prices and Artifact of Kin's spawn budget, and the site
        had never said what it is. Note the two curves come apart: the coefficient uses
        FLOORED minutes, ambientLevel uses the raw value.
      */}
      <section>
        <h3 className="mb-1 font-display text-lg font-semibold text-foreground">
          The difficulty coefficient
        </h3>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Several items scale their payout by it, chest prices ride on it, and it is what
          makes a run get harder. <code className="rounded bg-surface-2 px-1">Run.cs</code>:
        </p>
        <pre className="mb-3 overflow-x-auto rounded-xl border border-border bg-surface p-3 text-[11px] leading-relaxed text-muted-foreground">
{`base     = 0.7 + 0.3 x players
timeRate = 0.0506 x scalingValue x players^0.2
coeff    = (base + timeRate x floor(minutes)) x 1.15^stagesCleared`}
        </pre>
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">scalingValue</span> is{" "}
          <span className="text-foreground">1</span> on Drizzle,{" "}
          <span className="text-foreground">2</span> on Rainstorm and{" "}
          <span className="text-foreground">3</span> on Monsoon &mdash; and{" "}
          <em>every Eclipse level is also 3</em>. Eclipse does not scale this curve at all; it
          stacks its own separate modifiers. Solo on Rainstorm the run starts at exactly{" "}
          <span className="text-foreground">1.0</span> and gains{" "}
          <span className="text-foreground">0.1012</span> per minute, while each stage cleared
          multiplies the whole thing by 1.15 &mdash; so late in a run, clearing stages moves
          it far faster than the clock does.
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
          One subtlety worth having: the coefficient uses{" "}
          <code className="rounded bg-surface-2 px-1">Mathf.Floor</code> of the minutes, so it
          rises in <span className="text-foreground">steps, once a minute</span>. Monster
          level is computed from the same inputs <em>without</em> the floor, so it climbs{" "}
          <span className="text-foreground">continuously</span>. Two curves, same run, and
          only one of them ticks.
        </p>
      </section>

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
        {/*
          Sure Proc qualifies every chance in this table and every "% chance on hit" number
          in the dataset, and nothing on the site mentioned it. Same placement logic as
          "what counts as a stack": a property of the whole class goes once, beside the
          class, not onto 217 records.
        */}
        <p className="mb-3 max-w-2xl rounded-lg border border-emerald-400/25 bg-emerald-400/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <strong className="font-semibold text-emerald-300/90">
            A parry makes your next skill hit ignore all of this.
          </strong>{" "}
          Parrying grants the hidden <span className="text-foreground">Sure Proc</span> buff.
          The next damage you deal <em>from a skill</em> consumes it and stamps{" "}
          <code className="rounded bg-surface-2 px-1">ProcType.SureProc</code> onto that hit,
          and every roll below then returns true regardless of its chance &mdash;{" "}
          <code className="rounded bg-surface-2 px-1">LocalCheckRoll</code> short-circuits to{" "}
          <span className="text-foreground">true</span> without rolling. One hit, every
          on-hit effect you own, at 100%. Exactly one roll in the game opts out
          (<code className="rounded bg-surface-2 px-1">ignoreSureProc: true</code>): an
          elite&rsquo;s chance to drop its equipment on death.
        </p>
        {/*
          The other half of the on-hit story, and the reason proc chains terminate. 21 of the
          gates in GlobalEventManager are `!procChainMask.HasProc(X)`, and each effect stamps
          its own type on the chain it spawns — so a type fires at most once per chain.
          Same placement rule: qualifies the class, so it sits with the class.
        */}
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Chains also <span className="text-foreground">terminate by type</span>. Every hit
          carries a <code className="rounded bg-surface-2 px-1">procChainMask</code> &mdash; a
          bitmask over the game&rsquo;s 28 proc types &mdash; and an effect that spawns
          follow-up damage stamps its own type onto it. Twenty-one separate gates in{" "}
          <code className="rounded bg-surface-2 px-1">GlobalEventManager</code> read{" "}
          <code className="rounded bg-surface-2 px-1">!HasProc(…)</code> before firing, so a
          given effect can fire <span className="text-foreground">at most once per chain</span>:
          missiles never launch more missiles, chain lightning never re-chains off its own
          bolts. Different types still trigger each other, which is why proc chains happen at
          all &mdash; and why the coefficient on a secondary hit is what decides how far one
          gets.
        </p>
        {/*
          The last of the four on-hit inputs, and the one 18 item records lean on by name
          while the site only ever glossed it in a sentence (MATH-VERIFICATION §3j.93).
          28 uses in GlobalEventManager, and it does two different jobs.
        */}
        <p className="mb-3 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          <span className="text-foreground">Proc coefficient</span> is the multiplier that hit
          carries, and it does two jobs.{" "}
          <code className="rounded bg-surface-2 px-1">GlobalEventManager</code> uses it{" "}
          <span className="text-foreground">linearly</span> &mdash; a chance becomes{" "}
          <code className="rounded bg-surface-2 px-1">chance x procCoefficient</code>, so a 0.5
          hit really is half as likely to proc, with none of the hyperbolic softening the
          stacking curves above use. It also scales <em>durations</em>: Malachite&rsquo;s
          healing-disable is{" "}
          <code className="rounded bg-surface-2 px-1">8f x procCoefficient</code> seconds, not
          a flat 8. And a coefficient of exactly{" "}
          <span className="text-foreground">0</span> is a hard stop, not a small number
          &mdash; <code className="rounded bg-surface-2 px-1">OnHitAllProcess</code> returns
          immediately, so nothing you own triggers at all. That is why a skill&rsquo;s
          coefficient, listed per survivor on the Stat Lab, is often worth more than its
          damage.
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
