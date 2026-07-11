import { useState } from "react";
import { DLC_META } from "@/data/items";
import { ARTIFACTS, BAZAAR_DREAMS, SHRINES } from "@/data/reference";
import { cn } from "@/lib/utils";

const TABS = ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks"] as const;
type Tab = (typeof TABS)[number];

/** Renders an Ambry code (rows of ●■▲♦ glyphs) as a 3-column grid. */
function AmbryCode({ code }: { code: string | null }) {
  if (!code) {
    return <span className="text-xs text-muted-foreground">No Ambry code</span>;
  }
  const rows = code.split(" ");
  return (
    <div className="inline-grid grid-flow-row gap-0.5">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-1 font-mono text-sm leading-none text-foreground/80">
          {[...row].map((g, j) => (
            <span key={j} className="w-4 text-center">
              {g}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function Artifacts() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ARTIFACTS.map((a) => (
        <div key={a.name} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-foreground">{a.name}</h3>
            {a.dlc !== "base" && (
              <span className="shrink-0 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {DLC_META[a.dlc].short}
              </span>
            )}
          </div>
          <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{a.effect}</p>
          <div className="mt-1 border-t border-border pt-2">
            <AmbryCode code={a.code} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Dreams() {
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">&ldquo;You dream of…&rdquo;</th>
            <th className="px-4 py-2 font-medium">Stage</th>
            <th className="w-16 px-4 py-2 text-center font-medium">#</th>
          </tr>
        </thead>
        <tbody>
          {BAZAAR_DREAMS.map((d) => (
            <tr key={d.dream} className="border-t border-border">
              <td className="px-4 py-2 italic text-muted-foreground">{d.dream}</td>
              <td className="px-4 py-2 font-medium text-foreground">{d.stage}</td>
              <td className="px-4 py-2 text-center text-muted-foreground">{d.stageNumber}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Shrines() {
  return (
    <div className="flex flex-col gap-3">
      {SHRINES.map((s) => (
        <div key={s.name} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-foreground">{s.name}</h3>
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-primary">{s.cost}</span>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.effect}</p>
        </div>
      ))}
    </div>
  );
}

function LoadoutUnlocks() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
      <p className="text-sm text-muted-foreground">
        Per-survivor skill &amp; skin unlock tables are coming as part of the full survivor pages
        (Phase 4). Each will list every alternate skill and the exact challenge to unlock it.
      </p>
    </div>
  );
}

export function ReferencePage() {
  const [tab, setTab] = useState<Tab>("Artifacts");

  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Reference</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The answers the game itself makes hard to find — artifact codes, what each Bazaar dream
          seeds, and shrine mechanics.
        </p>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b border-border pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm transition-colors",
              tab === t
                ? "bg-surface-2 font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Artifacts" && <Artifacts />}
      {tab === "Bazaar Dreams" && <Dreams />}
      {tab === "Shrines" && <Shrines />}
      {tab === "Loadout Unlocks" && <LoadoutUnlocks />}
    </div>
  );
}
