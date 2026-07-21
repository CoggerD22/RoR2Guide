import { Link } from "@tanstack/react-router";
import { survivors } from "@/data/survivors";
import { skillsBySurvivor } from "@/data/skills";
import { DLC_META } from "@/data/items";

export function SurvivorsPage() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Survivors</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Base stats read from the game&rsquo;s own body prefabs, every loadout skill with its
          proc coefficient, and the challenge that unlocks each alternate skill.
        </p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {survivors.map((s) => {
          const skills = skillsBySurvivor.get(s.id) ?? [];
          const withProc = skills.filter((k) => k.verified).length;
          return (
            <li key={s.id}>
              <Link
                to="/survivors/$id"
                params={{ id: s.id }}
                className="flex h-full flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-lg font-semibold text-foreground">{s.name}</h2>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {DLC_META[s.dlc].short}
                  </span>
                </div>
                <dl className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Health</dt>
                    <dd className="font-semibold text-foreground">{s.health.base}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Damage</dt>
                    <dd className="font-semibold text-foreground">{s.damage.base}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Armor</dt>
                    <dd className="font-semibold text-foreground">{s.armor}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  {skills.length} loadout skills &middot; {withProc} with a verified proc
                </p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
