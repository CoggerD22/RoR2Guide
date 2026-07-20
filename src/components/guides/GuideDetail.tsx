import { Link } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { guideBySlug } from "@/content/guides";
import { CONTENT_VERSION } from "@/data/gameVersion";
import { OpinionBadge } from "./OpinionBadge";

export function GuideDetail({ slug }: { slug: string }) {
  const guide = guideBySlug.get(slug);

  if (!guide) {
    return (
      <div className="py-10 text-center">
        <p className="text-sm text-muted-foreground">No guide called &ldquo;{slug}&rdquo;.</p>
        <Link to="/guides" className="mt-3 inline-block text-sm text-primary hover:underline">
          Back to guides
        </Link>
      </div>
    );
  }

  return (
    <article className="py-6">
      <Link
        to="/guides"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Guides
      </Link>

      <header className="mt-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold sm:text-3xl">{guide.title}</h1>
          <OpinionBadge />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {guide.author} &middot; {guide.date} &middot; written for {guide.patch}
        </p>
      </header>

      {guide.stale && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/5 px-3 py-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-300" />
          <p className="text-xs leading-relaxed text-amber-200/90">
            Written for <strong>{guide.patch}</strong>; the site&rsquo;s data is on{" "}
            <strong>{CONTENT_VERSION}</strong>. Balance may have changed &mdash; the mechanical
            numbers in the codex are current, this advice may not be.
          </p>
        </div>
      )}

      {/* Content is repo-authored and reviewed, not user input. */}
      <div
        className="guide-prose mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground"
        dangerouslySetInnerHTML={{ __html: guide.html }}
      />
    </article>
  );
}
