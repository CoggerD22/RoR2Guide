import type { Confidence } from "@/data/schema";
import { cn } from "@/lib/utils";

/**
 * How strongly this record's numbers are sourced (MATH-VERIFICATION.md §1).
 * Deliberately understated — it's a provenance cue, not a decoration. Wiki-only
 * data has been wrong repeatedly here, so the difference is worth showing.
 */
const META: Record<Confidence, { label: string; title: string; className: string }> = {
  code: {
    label: "Code-verified",
    title: "Numbers checked against the game's decompiled code",
    className: "border-emerald-400/30 text-emerald-300/90",
  },
  asset: {
    label: "Asset-verified",
    title: "Numbers read from the game's own asset bundles",
    className: "border-emerald-400/30 text-emerald-300/90",
  },
  langfile: {
    label: "Game-text verified",
    title: "Name, pickup text and numbers match the game's language files",
    className: "border-sky-400/25 text-sky-300/80",
  },
  wiki: {
    label: "Wiki-sourced",
    title: "From riskofrain2.wiki.gg; not yet confirmed against game data",
    className: "border-amber-400/40 text-amber-300",
  },
};

export function ConfidenceBadge({
  confidence,
  className,
}: {
  confidence?: Confidence;
  className?: string;
}) {
  if (!confidence) return null;
  const m = META[confidence];
  return (
    <span
      title={m.title}
      className={cn(
        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        m.className,
        className,
      )}
    >
      {m.label}
    </span>
  );
}
