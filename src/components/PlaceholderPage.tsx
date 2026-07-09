import type { LucideIcon } from "lucide-react";

interface PlaceholderPageProps {
  title: string;
  blurb: string;
  milestone: string;
  icon: LucideIcon;
}

/**
 * M0 shell content for a section that isn't built yet. Real pages replace
 * these in their respective milestones (see PLAN §6).
 */
export function PlaceholderPage({ title, blurb, milestone, icon: Icon }: PlaceholderPageProps) {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 py-16 text-center sm:py-24">
      <span className="flex size-16 items-center justify-center rounded-2xl border border-border bg-surface-2 text-primary">
        <Icon className="size-8" aria-hidden />
      </span>
      <div className="flex flex-col gap-3">
        <div className="inline-flex items-center gap-2 self-center rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Coming in {milestone}
        </div>
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        <p className="text-balance text-muted-foreground">{blurb}</p>
      </div>
    </section>
  );
}
