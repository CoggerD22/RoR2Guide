import { AlignLeft, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DENSITIES,
  DENSITY_HINT,
  DENSITY_LABEL,
  useDisplay,
} from "@/store/display";

/**
 * Density + "show every description" controls, shared by the Codex and the Run Planner
 * (PLAN §8.2/§8.3).
 *
 * One component on both pages deliberately: the preference is shared, so two separate
 * controls that could disagree would be a bug waiting to happen.
 */
export function DisplayControls({ className }: { className?: string }) {
  const density = useDisplay((s) => s.density);
  const setDensity = useDisplay((s) => s.setDensity);
  const showDescriptions = useDisplay((s) => s.showDescriptions);
  const toggleDescriptions = useDisplay((s) => s.toggleDescriptions);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <div
        className="flex items-center gap-0.5 rounded-lg border border-border bg-surface p-0.5"
        role="group"
        aria-label="Grid density"
      >
        <LayoutGrid className="ml-1.5 mr-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        {DENSITIES.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDensity(d)}
            aria-pressed={density === d}
            title={DENSITY_HINT[d]}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              density === d
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {DENSITY_LABEL[d]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={toggleDescriptions}
        aria-pressed={showDescriptions}
        title="Show every item's description inline, instead of one click at a time"
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
          showDescriptions
            ? "border-primary/40 bg-primary/10 font-medium text-foreground"
            : "border-border bg-surface text-muted-foreground hover:text-foreground",
        )}
      >
        <AlignLeft className="size-3.5" aria-hidden />
        Descriptions
      </button>
    </div>
  );
}
