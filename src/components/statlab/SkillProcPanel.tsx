import { skillsBySurvivor, SLOT_LABEL, procProvenance } from "@/data/skills";
import type { Skill } from "@/data/schema";
import { cn } from "@/lib/utils";

const SLOTS: Skill["slot"][] = ["primary", "secondary", "utility", "special"];

/**
 * Proc coefficients for the selected survivor's loadout skills.
 *
 * Values are extracted from the game's own assets/assembly. Where no value could
 * be established, we show "unverified" — deliberately NOT a number and NOT "0",
 * because an unverified skill may still proc (CLAUDE.md rule #1).
 */
export function SkillProcPanel({ survivorId }: { survivorId: string }) {
  const skills = skillsBySurvivor.get(survivorId) ?? [];
  if (skills.length === 0) return null;

  const verified = skills.filter((s) => s.verified).length;

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Proc coefficients
        </h2>
        <span className="text-[11px] text-muted-foreground">
          {verified}/{skills.length} verified vs game data
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[26rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-medium">Slot</th>
              <th className="px-3 py-2 font-medium">Skill</th>
              <th className="px-3 py-2 text-right font-medium">Proc</th>
            </tr>
          </thead>
          <tbody>
            {SLOTS.flatMap((slot) =>
              skills
                .filter((s) => s.slot === slot)
                .map((s, i) => (
                  <tr key={`${slot}-${s.name}-${i}`} className="border-b border-border/50 last:border-0">
                    <td className="px-3 py-1.5 text-xs text-muted-foreground">
                      {i === 0 ? SLOT_LABEL[slot] : ""}
                    </td>
                    <td className="px-3 py-1.5 text-foreground">{s.name}</td>
                    <td
                      className="px-3 py-1.5 text-right tabular-nums"
                      title={procProvenance(s.procSource)}
                    >
                      {s.verified ? (
                        <span
                          className={cn(
                            "font-semibold",
                            s.proc === 0 ? "text-muted-foreground" : "text-foreground",
                          )}
                        >
                          {s.proc}
                        </span>
                      ) : s.damaging === false ? (
                        /*
                          Not a gap. These states have no damage path at all — a dash, a
                          stance swap, an aim state — so there is no coefficient to find.
                          Rendering them as "unverified" claimed ignorance we do not have.
                        */
                        <span
                          className="text-[11px] italic text-muted-foreground/70"
                          title="This skill has no damage-dealing path, so a proc coefficient does not apply"
                        >
                          no attack
                        </span>
                      ) : (
                        <span className="text-[11px] italic text-muted-foreground">unverified</span>
                      )}
                    </td>
                  </tr>
                )),
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
        A skill&rsquo;s proc coefficient scales how often it triggers on-hit items. Values are read
        from the game&rsquo;s own skill configs, projectile prefabs, and code (hover a value for its
        source). &ldquo;No attack&rdquo; means the skill has no damage-dealing path at all, so a
        coefficient does not apply &mdash; that is a verified fact, not a gap.
        &ldquo;Unverified&rdquo; means we could not establish a value from game data, and does
        <em>not</em> mean the skill cannot proc.
      </p>
    </section>
  );
}
