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

            `min-w-0` is load-bearing and its absence was a real bug (§3j.173). This <nav> is a
            flex ITEM, and a flex item defaults to `min-width: auto` — it refuses to shrink below
            its content, so `overflow-x-auto` never engaged and the nav pushed the header past the
            viewport instead of scrolling inside it. The whole document then scrolled sideways.

            It survived §3j.149's 360px sweep because that sweep ran on Windows, where the labels
            happen to fit; the same page scrolled sideways on the CI runner's fonts, and on a
            phone. This is the exact `min-width: auto` trap §3j.149 documented, in a place it did
            not look. With `min-w-0` the nav scrolls internally at any font width. */}
        <nav
          aria-label="Primary"
          className="nav-scroll ml-auto flex min-w-0 items-center gap-1 overflow-x-auto"
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
