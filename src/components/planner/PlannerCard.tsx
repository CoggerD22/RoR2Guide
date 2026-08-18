import { type CSSProperties } from "react";
import { Ban, Check, Info, Lock, X } from "lucide-react";
import type { Item } from "@/data/schema";
import { TIER_META } from "@/data/items";
import { cn } from "@/lib/utils";
import { asset } from "@/lib/asset";
import { ItemTooltip } from "@/components/codex/ItemTooltip";
import type { PlanState } from "@/store/planner";
import { useDisplay } from "@/store/display";
import { DlcBadge } from "@/components/codex/DlcBadge";

interface PlannerCardProps {
  item: Item;
  state: PlanState | undefined;
  onCycle: () => void;
  onInfo: () => void;
}

/** Codex card in planner mode: click cycles target/avoid; ⓘ opens details. */
export function PlannerCard({ item, state, onCycle, onInfo }: PlannerCardProps) {
  const density = useDisplay((d) => d.density);
  const showNames = useDisplay((d) => d.showNames);
  const showDescriptions = useDisplay((d) => d.showDescriptions);
  const tier = TIER_META[item.tier];
  const isTargeted = state === "targeted";
  const isAvoided = state === "avoided";
  /*
    §3j.172. `Run.BuildDropTable()` never adds these to a pool, so no chest, printer or scrapper
    can produce them — and this page's own instruction is to mark what to "target or avoid at
    printers and scrappers". Offering them was inviting a plan the game cannot honour.

    `aria-disabled`, not `disabled`: §3j.145 found that disabling a FOCUSED element ejects focus
    to <body>, and a plain `disabled` button is skipped by the tab order too, so a keyboard user
    could never reach the explanation for why it is inert. It stays focusable and says why.

    Cards already in a saved plan keep their stored state and stay removable from the rail.
    Silently rewriting someone's saved plan would be worse than the problem being fixed.
  */
  const undroppable = !!item.dropExclusion;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={undroppable ? undefined : onCycle}
        aria-disabled={undroppable || undefined}
        aria-pressed={undroppable ? undefined : !!state}
        aria-label={
          undroppable
            ? `${item.name}: cannot be targeted — the game's drop tables never include it, so no printer or scrapper can produce it.`
            : `${item.name}: ${state ?? "neutral"}. Click to cycle target/avoid.`
        }
        className={cn(
          // `relative` is load-bearing: absolutely-positioned children must anchor to
          // the CARD, not to the grid cell. The cell stretches to the tallest card in
          // its row (a 2-line name makes it ~16px taller), so a bottom-anchored badge
          // was rendering in the gap *below* the card — visible in a screenshot, and
          // reported as "no indicator on the planner". Top-anchored badges hid the bug.
          "relative flex w-full flex-col items-center rounded-lg border bg-surface text-center transition",
          density === "comfortable" && "gap-2 p-3",
          density === "compact" && "gap-1.5 p-2",
          density === "dense" && "gap-1 p-1.5",
          isTargeted && "border-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.35)]",
          isAvoided && "border-red-500/50 opacity-40 grayscale",
          !state && !undroppable && "border-border hover:border-primary/50",
          // Muted but NOT hidden, and not hover-dependent: the reason has to be readable on a
          // phone, where `hover` never fires at all (§3j.155).
          undroppable && "cursor-not-allowed border-dashed border-border/70",
        )}
        style={!state ? ({ "--tier": tier.color } as CSSProperties) : undefined}
      >
        <img
          src={asset(item.icon)}
          alt={item.name}
          loading="lazy"
          className={cn(
            "object-contain",
            density === "comfortable" && "size-14",
            density === "compact" && "size-10",
            density === "dense" && "size-8",
          )}
        />
        {showNames && (
          <span
            className={cn(
              "line-clamp-2 font-medium text-foreground",
              density === "compact" ? "text-[11px] leading-tight" : "text-xs",
            )}
          >
            {item.name}
          </span>
        )}
        {showDescriptions && (
          <p className="mt-0.5 w-full text-left text-[10px] leading-snug text-muted-foreground">
            {item.description}
          </p>
        )}
        <DlcBadge dlc={item.dlc} className="absolute bottom-1 right-1" />
        {/*
          TOP-left, matching the codex exactly (PLAN §5.8). Consistent placement is the
          point: a marker that moves between pages has to be relearned. The ⓘ button
          moves to bottom-right to make room; it's hover-only, so that costs nothing.
        */}
        {/*
          Deliberately NO `title`. §3j.152 pinned which components may use one and how many,
          because a hover-only explanation does not exist on touch or for a keyboard — and this
          badge is `pointer-events-none`, so it could never be hovered even on a desktop. The
          button's aria-label carries the reason, the dashed border carries it visually, and the
          drawer states it in full. A title here would have grown the exact surface that pin caps.
        */}
        {undroppable && (
          <span className="pointer-events-none absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-slate-600 text-white shadow-sm ring-1 ring-black/30">
            <Ban className="size-3" strokeWidth={2.5} aria-hidden />
          </span>
        )}
        {item.unlock && !undroppable && (
          <span
            className="pointer-events-none absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-amber-400 text-black shadow-sm ring-1 ring-black/30"
            title={`Unlocked by ${item.unlock.challenge}${item.unlock.requirement ? ` — ${item.unlock.requirement}` : ""}`}
          >
            <Lock
              className="size-3"
              strokeWidth={2.5}
              aria-label={`Locked behind challenge: ${item.unlock.challenge}`}
            />
          </span>
        )}
      </button>

      {/* State badge (top-right). */}
      {isTargeted && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-emerald-400 text-black">
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      )}
      {isAvoided && (
        <span className="pointer-events-none absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-red-500 text-white">
          <X className="size-3.5" strokeWidth={3} />
        </span>
      )}

      {/* Info button (top-left) — opens the detail drawer without cycling. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onInfo();
        }}
        aria-label={`Details for ${item.name}`}
        /*
          §3j.153 — two defects in one control, both invisible with a mouse.

          It was `p-1` around a `size-3.5` icon: a 22x22 target, under WCAG 2.5.8's 24x24, and
          it fails the spacing exception because it sits ON the card, which is itself a button
          doing something else entirely (cycle target/avoid).

          Worse, it was `opacity-0` until `group-hover`, and a phone has no hover — measured on
          an emulated Pixel 5 as opacity 0, pointer-events auto, `(hover: hover)` false. So on
          every touch device this was an INVISIBLE tap target overlapping a different action:
          tapping near the corner of a card silently opened the drawer instead. Revealed where
          there is no hover to reveal it. Third instance of this class after §3j.145 and
          §3j.149.
        */
        className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Info className="size-3.5" />
      </button>

      {/* Hover/focus tooltip. */}
      {/* hidden below sm for the same reason as ItemCard's — see the note there (§3j.149). */}
      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:block">
        <ItemTooltip item={item} />
      </div>
    </div>
  );
}
