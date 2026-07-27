import type { CSSProperties } from "react";
import { Lock } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META } from "@/data/items";
import { highlightNumbers } from "@/lib/highlight";
import { StackingBadge } from "./StackingBadge";
import { itemStackingTypes } from "@/lib/stacking";
import { asset } from "@/lib/asset";

/** In-game-style tooltip: dark panel, icon left, bold white name, gray body. */
export function ItemTooltip({ item }: { item: Item }) {
  const tier = TIER_META[item.tier];
  const types = itemStackingTypes(item.stacking);

  return (
    <div
      className="w-64 rounded-md border border-border bg-[#0a1120] p-3 text-left shadow-2xl"
      style={{ "--tier": tier.color } as CSSProperties}
    >
      <div className="flex items-center gap-2">
        <img
          src={asset(item.icon)}
          alt=""
          className="size-9 shrink-0 rounded-sm"
          style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--tier) 60%, transparent)" }}
        />
        <div className="min-w-0">
          <div className="truncate font-semibold leading-tight text-white">{item.name}</div>
          <div className="text-[11px] font-medium" style={{ color: "var(--tier)" }}>
            {tier.label}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {highlightNumbers(item.description)}
      </p>
      {types.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {types.map((t) => (
            <StackingBadge key={t} type={t} />
          ))}
          {/*
            Fail closed (PLAN §6B.3): the tooltip shows numbers with no provenance at
            all, so an untraced curve reads exactly like a verified one. A single dot is
            enough here — the drawer carries the full explanation.
          */}
          {item.confidence !== "code" && item.confidence !== "asset" && (
            <span
              className="ml-0.5 inline-flex items-center gap-1 text-[10px] text-amber-300/80"
              title="Stacking curve not yet verified against the game's code — transcribed from the in-game description"
            >
              <span className="size-1.5 rounded-full bg-amber-400/80" />
              curve unverified
            </span>
          )}
        </div>
      )}
      {/*
        Unlock surfaced on hover, not just in the drawer (PLAN §5.8): "can I even get
        this?" is the first question a locked item raises, and the tooltip is where
        people look. Challenge + requirement are code-verified (§6A.7).
      */}
      {item.unlock && (
        <div className="mt-2 flex items-start gap-1.5 border-t border-border pt-2">
          <Lock className="mt-0.5 size-3 shrink-0 text-amber-400/80" aria-hidden />
          <div className="min-w-0 text-[11px] leading-snug">
            <span className="font-medium text-amber-400/90">{item.unlock.challenge}</span>
            {item.unlock.requirement && (
              <span className="text-muted-foreground"> — {item.unlock.requirement}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
