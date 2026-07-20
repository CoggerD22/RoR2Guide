import { Link } from "@tanstack/react-router";
import { BookOpen } from "lucide-react";
import { guides } from "@/content/guides";
import { OpinionBadge } from "./OpinionBadge";

export function GuidesPage() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold sm:text-3xl">Guides</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Build advice and item priorities. Everything here is{" "}
          <span className="text-foreground">opinion</span> &mdash; stamped with its author,
          date, and game patch, and kept strictly separate from the codex, whose numbers are
          verified against the game itself.
        </p>
      </header>

      {guides.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <BookOpen className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium text-foreground">No guides published yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            The mechanical data on this site is verified against the game&rsquo;s own code and
            assets. Opinions are deliberately not auto-generated &mdash; add one by copying{" "}
            <code className="rounded bg-surface-2 px-1 py-0.5">content/guides/_template.md</code>.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {guides.map((g) => (
            <li key={g.slug}>
              <Link
                to="/guides/$slug"
                params={{ slug: g.slug }}
                className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-semibold text-foreground">{g.title}</h2>
                  <OpinionBadge />
                  {g.stale && (
                    <span className="rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                      Older patch
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{g.summary}</p>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  {g.author} &middot; {g.date} &middot; written for {g.patch}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
