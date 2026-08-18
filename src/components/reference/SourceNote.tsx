import { REFERENCE_PROVENANCE, SHORT_LABEL, type SourceTier } from "@/data/provenance";
import { cn } from "@/lib/utils";

const TIER_STYLE: Record<SourceTier, string> = {
  code: "text-emerald-300/90",
  asset: "text-emerald-300/90",
  langfile: "text-sky-300/80",
  wiki: "text-amber-300/90",
  editorial: "text-muted-foreground",
};

/**
 * States where a panel's data came from, field by field (PLAN §6B.3).
 *
 * Every reference surface previously rendered with no provenance at all, which meant a
 * wiki-sourced Ambry code and a code-verified shrine mechanic looked identical. Fields
 * whose source is too weak for what they assert are called out explicitly rather than
 * listed alongside the sound ones.
 */
export function SourceNote({
  dataset,
  className,
}: {
  dataset: keyof typeof REFERENCE_PROVENANCE;
  className?: string;
}) {
  const fields = REFERENCE_PROVENANCE[dataset];
  if (!fields) return null;
  const entries = Object.entries(fields);
  const weak = entries.filter(([, s]) => !s.adequate);

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] leading-relaxed",
        className,
      )}
    >
      <div className="mb-1 font-semibold uppercase tracking-widest text-muted-foreground">
        Where this comes from
      </div>
      {/*
        `[overflow-wrap:anywhere]` (§3j.173). These refs are game identifiers —
        `PurchaseInteraction`, `costMultiplierPerPurchase` — and a long unbroken token sets the
        min-content width of the whole panel, so at 360px the DOCUMENT scrolled sideways. That
        is the same defect §3j.149 fixed on the artifact cards, in a component it did not visit.

        NOT `break-words`: it permits a break to avoid visible overflow but leaves the intrinsic
        min-content size unchanged, and min-content is what sizes the box. §3j.149 recorded that
        distinction after trying `break-words` first and watching the document stay too wide.

        Why it took a CI failure to surface: the 360px sweep runs on Windows fonts here and on
        the runner's fonts there, and this panel had ~9% of slack — enough to pass locally and
        fail on ubuntu. It would also have failed on a real Android phone.
      */}
      <ul className="flex flex-col gap-0.5 [overflow-wrap:anywhere]">
        {entries.map(([field, s]) => (
          <li key={field} className="text-muted-foreground">
            <span className="font-medium text-foreground/90">{field}</span>
            {" — "}
            <span className={TIER_STYLE[s.tier]}>{SHORT_LABEL[s.tier]}</span>
            <span className="text-muted-foreground">: {s.ref}</span>
          </li>
        ))}
      </ul>
      {weak.length > 0 && (
        <p className="mt-1.5 rounded border border-amber-400/25 bg-amber-400/5 px-2 py-1 text-amber-200/90">
          <strong className="font-semibold">Not yet verified:</strong>{" "}
          {weak.map(([f]) => f).join(", ")} — shown because it is the best available, but
          its source is weaker than the claim it makes.
        </p>
      )}
    </div>
  );
}
