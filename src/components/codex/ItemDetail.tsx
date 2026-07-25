import { useEffect, type CSSProperties } from "react";
import { Biohazard, ExternalLink, Lock, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META, DLC_META, itemById } from "@/data/items";
import { highlightNumbers } from "@/lib/highlight";
import { sparklinePoints } from "@/lib/stacking";
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
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-border bg-surface shadow-2xl"
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

          {item.stacking.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Stacking
              </h3>
              <div className="flex flex-col gap-3">
                {item.stacking.map((entry, i) => {
                  const points = sparklinePoints(entry);
                  return (
                    <div key={i} className="rounded-lg border border-border bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-foreground">{entry.stat}</span>
                        <StackingBadge type={entry.type} />
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{entry.base}</span> base
                        {entry.perStack !== 0 && (
                          <>
                            , <span className="font-semibold text-foreground">
                              {entry.perStack > 0 ? `+${entry.perStack}` : entry.perStack}
                            </span>{" "}
                            per stack
                          </>
                        )}
                      </div>
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
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            View on wiki.gg <ExternalLink className="size-3.5" />
          </a>
        </div>
      </aside>
    </div>
  );
}
