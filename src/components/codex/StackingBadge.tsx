import type { StackingType } from "@/data/schema";
import { stackingLabel } from "@/lib/stacking";
import { cn } from "@/lib/utils";

const STYLES: Record<StackingType, string> = {
  linear: "border-sky-400/30 text-sky-300",
  hyperbolic: "border-violet-400/30 text-violet-300",
  exponential: "border-amber-400/30 text-amber-300",
  reciprocal: "border-teal-400/30 text-teal-300",
  special: "border-fuchsia-400/30 text-fuchsia-300",
  none: "border-border text-muted-foreground",
};

export function StackingBadge({ type, className }: { type: StackingType; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        STYLES[type],
        className,
      )}
    >
      {stackingLabel(type)}
    </span>
  );
}
