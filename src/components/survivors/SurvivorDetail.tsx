import { Link } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { getSurvivorDetail, statRows } from "@/lib/survivorDetail";
import { procProvenance } from "@/data/skills";
import { DLC_META } from "@/data/items";
import { ConfidenceBadge } from "@/components/codex/ConfidenceBadge";

export function SurvivorDetail({ id }: { id: string }) {
  const detail = getSurvivorDetail(id);

  if (!detail) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No survivor called &ldquo;{id}&rdquo;.</p>
        <Link to="/survivors" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to survivors
        </Link>
      </div>
    );
  }

  const { survivor: s, slots, unmatchedUnlocks } = detail;
  const allSkills = slots.flatMap((g) => g.skills);
  /*
    Three states, not two — the same split `data:audit` has used since §3j.47, which this
    page had never been taught. A skill whose own state has no damage path has no proc
    coefficient to find, so counting it against "verified" reported ignorance we do not
    have: Commando read 4/6 when nothing about his kit is actually unknown (PLAN §9.1).
  */
  const verified = allSkills.filter((k) => k.verified).length;
  const noDamage = allSkills.filter((k) => !k.verified && k.damaging === false).length;
  const totalSkills = allSkills.length;
  const applicable = totalSkills - noDamage;
  const unknown = applicable - verified;
  const itemGranted = allSkills.some((k) => k.grantedBy);

  return (
    <div className="py-6">
      <Link
        to="/survivors"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Survivors
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{s.name}</h1>
          <span className="text-xs text-muted-foreground">{DLC_META[s.dlc].label}</span>
          <ConfidenceBadge confidence={s.confidence} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[18rem_1fr]">
        {/* Base stats */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Base stats
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <table className="w-full text-sm">
              <tbody>
                {statRows(s).map((row) => (
                  <tr key={row.label} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{row.label}</td>
                    <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-foreground">
                      {row.base}
                    </td>
                    <td className="w-16 px-3 py-1.5 text-right text-[11px] tabular-nums text-muted-foreground">
                      {row.perLevel ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/*
            "Rainstorm-standard" was true but named only half of it: the hidden Drizzle item
            adds a flat +70 armor as well as multiplying regen, so the Armor row is just as
            difficulty-dependent as the regen row (PLAN §9.1).
          */}
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Right column is growth per level; blank means the stat does not scale with level,
            which is true of every stat below damage, for every survivor in the game. These are Rainstorm
            values &mdash; the only difficulty that grants no hidden item. Drizzle multiplies
            health regen by 1.5 and adds a flat <span className="text-foreground">+70 armor</span>;
            Monsoon and above multiply health regen by 0.6.
          </p>
        </section>

        {/* Skills */}
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Loadout skills
            </h2>
            <span
              className="text-[11px] text-muted-foreground"
              title={
                noDamage > 0
                  ? `${verified} of ${applicable} damage-dealing skills have a verified proc coefficient. ` +
                    `${noDamage} more deal no damage themselves, so there is no coefficient to verify.`
                  : `${verified} of ${applicable} skills have a verified proc coefficient.`
              }
            >
              {unknown === 0
                ? `Every proc coefficient accounted for (${verified} verified${
                    noDamage > 0 ? `, ${noDamage} not applicable` : ""
                  })`
                : `${verified}/${applicable} procs verified vs game data`}
            </span>
          </div>

          {itemGranted && (
            <p className="mb-3 rounded-lg border border-tier-lunar/30 bg-tier-lunar/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              Heretic has no fixed kit. She appears only while holding all four Heresy lunar
              items, each of which replaces one skill slot &mdash; so the skills below are the
              ones those items grant.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {slots.map((group) => (
              <div key={group.slot} className="rounded-xl border border-border bg-surface">
                <div className="border-b border-border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <ul>
                  {group.skills.map((k, i) => (
                    <li
                      key={`${k.name}-${i}`}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border/50 px-3 py-2 last:border-0"
                    >
                      <span className="font-medium text-foreground">{k.name}</span>

                      {k.grantedBy && (
                        <span className="rounded-full border border-tier-lunar/40 px-1.5 py-0.5 text-[10px] text-tier-lunar">
                          {k.grantedBy}
                        </span>
                      )}

                      {k.challenge && (
                        <span
                          title={k.requirement}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <Lock className="size-2.5" /> {k.challenge}
                        </span>
                      )}

                      <span className="ml-auto shrink-0 text-xs" title={procProvenance(k.procSource)}>
                        {k.verified ? (
                          <>
                            <span className="text-muted-foreground">proc </span>
                            <span className="font-semibold tabular-nums text-foreground">{k.proc}</span>
                          </>
                        ) : k.damaging === false ? (
                          /*
                            The Stat Lab has shown this state since §3j.47; this page still
                            said "proc unverified", so the same skill was described two ways
                            on two pages — and the wrong way here, claiming ignorance about a
                            skill we had in fact classified.
                          */
                          <span className="italic text-muted-foreground">no direct damage</span>
                        ) : (
                          <span className="italic text-muted-foreground">proc unverified</span>
                        )}
                      </span>

                      {k.requirement && (
                        <p className="w-full text-[11px] leading-relaxed text-muted-foreground">
                          {k.requirement}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {unmatchedUnlocks.length > 0 && (
            <div className="mt-3 rounded-xl border border-border bg-surface p-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Other unlocks
              </h3>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {unmatchedUnlocks.map((u) => (
                  <li key={u.skill} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{u.skill}</span> ({u.slot}) &mdash;{" "}
                    {u.challenge}: {u.requirement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
            A skill&rsquo;s proc coefficient scales how often it triggers on-hit items. Hover a
            value for its source. &ldquo;No direct damage&rdquo; means the skill&rsquo;s own
            state deals none, so it has no coefficient of its own &mdash; it does <em>not</em>{" "}
            mean nothing it creates can proc, and a turret or a beacon carries its own.
            &ldquo;Unverified&rdquo; is reserved for the case where we could not establish a
            value at all; it does <em>not</em> mean the skill cannot proc.
          </p>

          <a
            href={s.wiki}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View on wiki.gg <ExternalLink className="size-3.5" />
          </a>
        </section>
      </div>
    </div>
  );
}
