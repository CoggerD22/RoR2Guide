import { Link } from "@tanstack/react-router";
import { Orbit } from "lucide-react";
import { NAV_SECTIONS } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          to="/items"
          className="flex items-center gap-2 font-display text-sm font-semibold tracking-wide"
        >
          <Orbit className="size-5 text-primary" aria-hidden />
          <span>
            RoR2<span className="text-primary"> Companion</span>
          </span>
        </Link>

        <nav
          aria-label="Primary"
          className="ml-auto flex items-center gap-1 overflow-x-auto"
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
