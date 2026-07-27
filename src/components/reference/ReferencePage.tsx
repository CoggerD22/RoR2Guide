import { useState } from "react";
import { DLC_META } from "@/data/items";
import { ARTIFACTS, BAZAAR_DREAMS, SHRINES, LOADOUT_UNLOCKS } from "@/data/reference";
import { asset } from "@/lib/asset";
import { cn } from "@/lib/utils";
import { Breakpoints } from "./Breakpoints";
import { SourceNote } from "./SourceNote";

const TABS = ["Artifacts", "Bazaar Dreams", "Shrines", "Loadout Unlocks", "Breakpoints"] as const;
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
    <div className="flex flex-col gap-3">
      <SourceNote dataset="artifacts" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {ARTIFACTS.map((a) => (
        <div key={a.name} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <img
                src={asset(a.icon)}
                alt=""
                loading="lazy"
                className="size-9 shrink-0 object-contain"
              />
              <h3 className="font-display text-sm font-semibold text-foreground">{a.name}</h3>
            </div>
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
    </div>
  );
}

function Dreams() {
  return (
    <div className="flex flex-col gap-3">
      <SourceNote dataset="dreams" />
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
    </div>
  );
}

function Shrines() {
  return (
    <div className="flex flex-col gap-3">
      {/*
        The blurb below each shrine is the GAME'S OWN description, quoted verbatim —
        not a verified account of the mechanic (PLAN §5.0.1). These descriptions are
        often incomplete: Shrine of Blood's, for instance, never mentions that its
        cost compounds per use or that uses are capped. Labelled as a quote until the
        code+prefab-verified mechanic layer lands.
      */}
      <SourceNote dataset="shrines" />
      {SHRINES.map((s) => (
        <div key={s.name} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-sm font-semibold text-foreground">{s.name}</h3>
            <span
              className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-primary"
              title="Our summary, not game data"
            >
              {s.cost}
            </span>
          </div>
          <p className="mt-1.5 border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground">
            {s.description}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
            In-game description
          </p>
          {/*
            The verified layer, shown separately and given the visual weight — this is
            the fact, while the quote above is only what the game says (PLAN §5.0.4).
          */}
          {s.mechanic && (
            <div className="mt-3 rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-3">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-300/90">
                Verified mechanic — from game code + prefab values
              </p>
              <p className="text-sm leading-relaxed text-foreground/90">{s.mechanic}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function LoadoutUnlocks() {
  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Challenge-unlocked alternate skills for every survivor, generated from the game&rsquo;s
        own <code className="text-foreground/80">SkillFamily</code> variants and each
        skill&rsquo;s unlock achievement — challenge names and requirements are the game&rsquo;s
        exact text. Skins aren&rsquo;t listed. A survivor shown as having no alternates has
        been <em>verified</em> to have none, rather than simply not recorded.
      </p>
      <SourceNote dataset="loadoutUnlocks" />
      {LOADOUT_UNLOCKS.map((s) => (
        <section key={s.survivor}>
          <h3 className="mb-2 font-display text-sm font-semibold text-foreground">{s.survivor}</h3>
          {s.skills.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted-foreground">
              Fixed kit — verified against the game&rsquo;s skill families: this survivor has no
              alternate skills.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <tbody>
                  {s.skills.map((sk) => (
                    <tr key={sk.skill} className="border-t border-border first:border-t-0">
                      <td className="w-1/3 px-4 py-2 align-top">
                        <div className="font-medium text-foreground">{sk.skill}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {/* No slot = not a loadout-slot variant (Captain's beacons). */}
                          {sk.slot ?? "Supply Drop option"}
                        </div>
                      </td>
                      <td className="px-4 py-2 align-top">
                        {sk.noUnlockRequired ? (
                          <div className="text-xs text-muted-foreground">
                            Available from the start — no unlock required.
                          </div>
                        ) : (
                          <>
                            <div className="text-primary">{sk.challenge}</div>
                            {sk.requirement && (
                              <div className="mt-0.5 text-xs text-muted-foreground">
                                {sk.requirement}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}
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
      {tab === "Breakpoints" && <Breakpoints />}
    </div>
  );
}
