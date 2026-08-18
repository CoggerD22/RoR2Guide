import { Link } from "@tanstack/react-router";
import { Orbit } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[120rem] items-center gap-4 px-4 sm:px-6">
        <Link
          to="/items"
          className="flex shrink-0 items-center gap-2 font-display text-sm font-semibold tracking-wide"
        >
          <Orbit className="size-5 text-primary" aria-hidden />
          <span className="whitespace-nowrap">
            RoR2<span className="text-primary"> Companion</span>
          </span>
        </Link>

        {/* Scrolls horizontally on narrow screens; the mask fades the cut-off edge so a
            clipped link reads as "more to scroll" rather than broken text.

            NO `min-w-0` here, deliberately, and measured rather than reasoned (§3j.173). This is
            a flex item, so the §3j.149 `min-width: auto` trap looks like it should apply — I
            added `min-w-0` on exactly that reasoning and it changed nothing: with and without it
            the nav reports the same clientWidth at every viewport from 360px down to 200px, and
            `scrollWidth > clientWidth` either way. `min-width: auto` only applies while overflow
            is VISIBLE; `overflow-x: auto` already sets the automatic minimum size to zero, so the
            scroller was engaging all along. Left as it was — adding a no-op with a confident
            comment is how a false explanation gets inherited. */}
        <nav
          aria-label="Primary"
          className="nav-scroll ml-auto flex items-center gap-1 overflow-x-auto"
        >
          {NAV_SECTIONS.map((section) => (
            <Link
              key={section.path}
              to={section.path}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
                "aria-[current=page]:bg-surface-2 aria-[current=page]:text-foreground",
              )}
              activeProps={{ "aria-current": "page" }}
            >
              {section.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
