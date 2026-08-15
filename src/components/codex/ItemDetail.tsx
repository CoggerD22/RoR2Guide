import { useEffect, useRef, type CSSProperties } from "react";
import { Biohazard, ExternalLink, Lock, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META, DLC_META, itemById } from "@/data/items";
import { highlightNumbers } from "@/lib/highlight";
import { sparklinePoints, perStackMeaning, hyperbolicCurve } from "@/lib/stacking";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { StackingBadge } from "./StackingBadge";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { Sparkline } from "./Sparkline";

interface ItemDetailProps {
  item: Item | null;
  onClose: () => void;
  /** Navigate the drawer to a related item (corruption link). */
  onSelectItem?: (item: Item) => void;
}

function CorruptionRow({
  label,
  other,
  onSelectItem,
}: {
  label: string;
  other: Item;
  onSelectItem?: (item: Item) => void;
}) {
  const inner = (
    <>
      <img src={asset(other.icon)} alt="" className="size-7 shrink-0 object-contain" />
      <span className="min-w-0">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm text-foreground">{other.name}</span>
      </span>
    </>
  );
  const base = "flex w-full items-center gap-2 rounded-lg border border-border bg-surface-2 p-2 text-left";
  return onSelectItem ? (
    <button type="button" onClick={() => onSelectItem(other)} className={cn(base, "hover:border-primary/50")}>
      {inner}
    </button>
  ) : (
    <div className={base}>{inner}</div>
  );
}

/** Slide-in detail drawer for a selected item. */
export function ItemDetail({ item, onClose, onSelectItem }: ItemDetailProps) {
  const panelRef = useRef<HTMLElement | null>(null);

  /**
   * FOCUS MANAGEMENT. `role="dialog" aria-modal="true"` is a promise, and this component
   * made it without keeping it (MATH-VERIFICATION §3j.141).
   *
   * `aria-modal` tells assistive technology that everything outside this element is inert.
   * Tab does not know that. With no focus handling, a keyboard user opening an item kept
   * focus on the grid behind the overlay and could tab through content their screen reader
   * had just been told to ignore — the two failures compounding rather than cancelling.
   *
   * Three things are required and all three were missing: move focus in on open, keep it
   * inside while open, and put it back where it came from on close. The drawer is how every
   * item on the site is read, so this is the main surface, not an edge case.
   */
  useEffect(() => {
    if (!item) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    // Focus the panel itself rather than the close button: a screen reader then announces
    // the dialog and its label, instead of just the word "Close".
    panelRef.current?.focus();

    const focusablesIn = (root: HTMLElement) =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null || el === root);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = focusablesIn(panel);
      if (items.length === 0) {
        // Nothing focusable inside: keep focus on the panel rather than letting it escape.
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Restore focus so a keyboard user returns to the card they opened, not to <body>.
      previouslyFocused?.focus?.();
    };
  }, [item, onClose]);

  if (!item) return null;

  const tier = TIER_META[item.tier];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={item.name}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={panelRef}
        // -1 so it is programmatically focusable without joining the tab order.
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl focus:outline-none"
        style={{ "--tier": tier.color } as CSSProperties}
      >
        <div className="sticky top-0 z-10 flex items-start gap-3 border-b border-border bg-surface/95 p-4 backdrop-blur">
          <img
            src={asset(item.icon)}
            alt=""
            className="size-16 shrink-0 object-contain"
            style={{ filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--tier) 40%, transparent))" }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight text-foreground">{item.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium" style={{ color: "var(--tier)" }}>
                {tier.label}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{DLC_META[item.dlc].label}</span>
              {!item.verified && (
                <span className="rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                  Unverified
                </span>
              )}
              {item.verified && <ConfidenceBadge confidence={item.confidence} />}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 p-4">
          <p className="text-sm italic text-muted-foreground">{item.pickupText}</p>

          <p className="text-sm leading-relaxed text-foreground/90">
            {highlightNumbers(item.description)}
          </p>

          {/*
            The description above is the GAME'S wording, and the game is wrong often enough
            that it cannot be presented unqualified — its numbers are even highlighted,
            which reads as authority. Where the verified value differs, say so right here
            rather than hoping the reader scrolls to the formula (PLAN §5.0.1).
          */}
          {item.descriptionNote && (
            <p className="-mt-2 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
              <strong className="font-semibold">The game&rsquo;s text above is inaccurate.</strong>{" "}
              {item.descriptionNote}
            </p>
          )}

          {/*
            The cooldown has been in the data — asset-read and audit-checked — since the
            Seed of Life correction, and no page had ever rendered it. A verified answer we
            hold and do not show is a gap on a site whose whole premise is "the answers the
            game makes hard to find" (PLAN §9.1).

            0 is never printed bare: on its own it reads as "reusable instantly", when for
            these it means there is nothing to recharge.
          */}
          {item.cooldown !== undefined && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Equipment
              </h3>
              <div className="rounded-lg border border-border bg-surface-2 p-3 text-xs text-muted-foreground">
                {item.activated === false && item.triggered ? (
                  /*
                    The third state. Saying "passive, the cooldown never runs" here would be
                    false — the charge is spent by an in-world event instead of the key
                    (PLAN §9.1 / MATH-VERIFICATION §3j.76).
                  */
                  <>
                    <span className="font-semibold text-foreground">Triggered, not activated.</span>{" "}
                    Pressing the equipment key does nothing, but the{" "}
                    <span className="font-semibold text-foreground">{item.cooldown}s</span>{" "}
                    cooldown is real &mdash; it is spent automatically when the effect fires.
                  </>
                ) : item.activated === false ? (
                  <>
                    <span className="font-semibold text-foreground">Passive.</span> Pressing
                    the equipment key does nothing &mdash; it has no handler in{" "}
                    <code className="rounded bg-surface px-1">EquipmentSlot</code>, so the{" "}
                    {item.cooldown}s on its asset never runs.
                  </>
                ) : item.consumedOnUse ? (
                  <>
                    <span className="font-semibold text-foreground">Consumed on use.</span> A
                    successful activation replaces it, so there is no cooldown to wait out.
                  </>
                ) : (
                  <>
                    Cooldown{" "}
                    <span className="font-semibold text-foreground">{item.cooldown}s</span>{" "}
                    &mdash; before any Fuel Cell or Gesture of the Drowned reduction.
                  </>
                )}
              </div>
            </section>
          )}

          {item.stacking.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Stacking
              </h3>
              {/*
                Fail closed (PLAN §6B.3). A record we have not traced to the game's code
                or assets must not LOOK like one we have. Roughly one in five records
                examined so far has been wrong, so presenting the untraced ones with the
                same confidence as the verified ones is itself a false claim.
              */}
              {item.confidence !== "code" && item.confidence !== "asset" && (
                <p className="mb-3 rounded-lg border border-amber-400/25 bg-amber-400/5 p-2.5 text-[11px] leading-relaxed text-amber-200/90">
                  <strong className="font-semibold">Numbers below are not yet code-verified.</strong>{" "}
                  They are transcribed exactly from the game&rsquo;s own description text, which is
                  reliable for wording but has repeatedly proven wrong about the actual curve —
                  Tougher Times reads &ldquo;15% per stack&rdquo; but blocks 13% at one stack.
                  Treat the stacking values as the game&rsquo;s claim, not as measured behaviour.
                </p>
              )}
              <div className="flex flex-col gap-3">
                {item.stacking.map((entry, i) => {
                  const points = sparklinePoints(entry);
                  const meaning = perStackMeaning(entry.type);
                  const curve = hyperbolicCurve(entry);
                  return (
                    <div key={i} className="rounded-lg border border-border bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{entry.stat}</span>
                        <StackingBadge type={entry.type} />
                      </div>
                      {/*
                        "N base, +M per stack" is only a true sentence for linear rows.
                        Anywhere else that phrasing invites the reader to add M once per
                        stack and get a number the game never produces (PLAN §9.1) — so
                        non-linear rows say what their second number is instead.
                      */}
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.base}</span>{" "}
                        {entry.type === "linear" ? "base" : "at one stack"}
                        {entry.perStack !== 0 && (
                          <>
                            , <span className="font-semibold text-foreground">
                              {entry.perStack > 0 ? `+${entry.perStack}` : entry.perStack}
                            </span>{" "}
                            per stack
                            {meaning && <span className="italic"> &mdash; {meaning}</span>}
                          </>
                        )}
                      </div>
                      {curve && (
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
                          {curve.map((p) => (
                            <span key={p.n}>
                              <span className="font-semibold text-foreground">
                                {p.v.toFixed(1)}
                              </span>{" "}
                              at {p.n}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.formula && (
                        <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                          {entry.formula}
                        </p>
                      )}
                      {entry.cap && (
                        <p className="mt-1 text-[11px] text-muted-foreground">Cap: {entry.cap}</p>
                      )}
                      {points && (
                        <div className="mt-2">
                          <Sparkline points={points} />
                          <div className="mt-0.5 text-[10px] text-muted-foreground">1 → 8 stacks</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {(item.corrupts || item.corruptedBy) && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Biohazard className="size-3.5" style={{ color: "var(--tier-void)" }} /> Void
                corruption
              </h3>
              <div className="flex flex-col gap-2">
                {item.corrupts?.map((id) => {
                  const other = itemById.get(id);
                  return other ? (
                    <CorruptionRow
                      key={id}
                      label="Corrupts"
                      other={other}
                      onSelectItem={onSelectItem}
                    />
                  ) : null;
                })}
                {item.corruptedBy
                  ? (() => {
                      const other = itemById.get(item.corruptedBy);
                      return other ? (
                        <CorruptionRow
                          label="Corrupted by"
                          other={other}
                          onSelectItem={onSelectItem}
                        />
                      ) : null;
                    })()
                  : null}
              </div>
            </section>
          )}

          {item.unlock && (
            <section>
              <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                How to unlock
              </h3>
              <p className="text-sm font-medium text-foreground/90">{item.unlock.challenge}</p>
              {item.unlock.requirement ? (
                <p className="mt-0.5 text-sm text-muted-foreground">{item.unlock.requirement}</p>
              ) : (
                <p className="mt-0.5 text-sm italic text-muted-foreground">
                  Unlock condition not yet verified.
                </p>
              )}
            </section>
          )}

          {item.flavor && (
            <p className="border-l-2 border-border pl-3 text-sm italic text-muted-foreground">
              {item.flavor}
            </p>
          )}

          <div className="flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>

          <a
            href={item.wiki}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 py-0.5 text-sm text-primary hover:underline"
          >
            View on wiki.gg <ExternalLink className="size-3.5" />
          </a>
        </div>
      </aside>
    </div>
  );
}
