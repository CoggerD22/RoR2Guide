import { useState, type ReactNode } from "react";
import { Search, X, SlidersHorizontal, ChevronDown, Lock } from "lucide-react";
import type { Tier, Dlc, StackingType } from "@/data/schema";
import { PRESENT_TIERS, TIER_META, DLC_ORDER, DLC_META, ALL_TAGS } from "@/data/items";
import { stackingLabel } from "@/lib/stacking";
import { cn } from "@/lib/utils";
import { STACKING_TYPES, type FilterState } from "./filters";

interface CodexFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  filters: FilterState;
  onToggleTier: (t: Tier) => void;
  onToggleDlc: (d: Dlc) => void;
  onToggleStacking: (s: StackingType) => void;
  onToggleTag: (t: string) => void;
  onToggleHideVariants: () => void;
  onToggleLockedOnly: () => void;
  onClear: () => void;
  resultCount: number;
  totalCount: number;
  anyFilter: boolean;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs capitalize transition-colors",
        active
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-3">
      <span className="w-20 shrink-0 pt-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export function CodexFilters(props: CodexFiltersProps) {
  const { filters } = props;

  // Tier is how people actually browse RoR2 items, so it stays visible. The other
  // ~30 chips are collapsed by default — expanded they pushed all content below the
  // fold on desktop and took two full screens on mobile. Starts open if any of the
  // hidden filters is already active (e.g. restored from a previous visit).
  const hiddenActive = filters.dlcs.size + filters.stacking.size + filters.tags.size;
  const [showMore, setShowMore] = useState(hiddenActive > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={props.query}
            onChange={(e) => props.onQueryChange(e.target.value)}
            placeholder="Search items — name, effect, or tag (e.g. bleed, crit, armor)…"
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/60 focus:outline-none"
            aria-label="Search items"
          />
        </div>
        <span className="shrink-0 text-sm text-muted-foreground">
          {props.resultCount} / {props.totalCount}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <Row label="Tier">
          {PRESENT_TIERS.map((tier) => (
            <Chip
              key={tier}
              active={filters.tiers.has(tier)}
              onClick={() => props.onToggleTier(tier)}
            >
              {TIER_META[tier].label}
            </Chip>
          ))}
        </Row>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          aria-expanded={showMore}
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <SlidersHorizontal className="size-3.5" />
          {showMore ? "Fewer filters" : "More filters"}
          {hiddenActive > 0 && (
            <span className="rounded-full bg-primary/20 px-1.5 text-[10px] font-semibold text-primary">
              {hiddenActive}
            </span>
          )}
          <ChevronDown className={cn("size-3.5 transition-transform", showMore && "rotate-180")} />
        </button>

        {showMore && (
          <div className="flex flex-col gap-3">
            <Row label="DLC">
              {DLC_ORDER.map((dlc) => (
                <Chip key={dlc} active={filters.dlcs.has(dlc)} onClick={() => props.onToggleDlc(dlc)}>
                  {DLC_META[dlc].short}
                </Chip>
              ))}
            </Row>

            <Row label="Stacking">
              {STACKING_TYPES.map((s) => (
                <Chip
                  key={s}
                  active={filters.stacking.has(s)}
                  onClick={() => props.onToggleStacking(s)}
                >
                  {stackingLabel(s)}
                </Chip>
              ))}
            </Row>

            <Row label="Category">
              {ALL_TAGS.map((tag) => (
                <Chip key={tag} active={filters.tags.has(tag)} onClick={() => props.onToggleTag(tag)}>
                  {tag.replace(/-/g, " ")}
                </Chip>
              ))}
            </Row>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.hideVariants}
              onChange={props.onToggleHideVariants}
              className="size-3.5 accent-[var(--color-primary)]"
            />
            Hide scrap / consumed variants
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={filters.lockedOnly}
              onChange={props.onToggleLockedOnly}
              className="size-3.5 accent-[var(--color-primary)]"
            />
            Challenge-locked only
          </label>
          {/*
            Legend (PLAN §5.8). The badge was reported as unnoticed twice; a symbol
            nobody can decode is the same as no symbol. "Unlocked by" — not "locked" —
            because the site knows the item is gated, not what this player has earned.
          */}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="flex size-4 items-center justify-center rounded-full bg-amber-400 text-black">
              <Lock className="size-2.5" strokeWidth={2.5} />
            </span>
            = unlocked by a challenge; hover a card for how
          </span>
        </div>
        {(props.anyFilter || props.query) && (
          <button
            type="button"
            onClick={props.onClear}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" /> Clear all
          </button>
        )}
      </div>
    </div>
  );
}
