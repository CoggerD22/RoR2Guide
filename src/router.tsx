import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  useNavigate,
} from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { CodexPage } from "@/components/codex/CodexPage";
import { ItemDetail } from "@/components/codex/ItemDetail";
import { itemById } from "@/data/items";
import { PlannerPage } from "@/components/planner/PlannerPage";
import { StatLabPage } from "@/components/statlab/StatLabPage";
import { ReferencePage } from "@/components/reference/ReferencePage";
import { SurvivorsPage } from "@/components/survivors/SurvivorsPage";
import { SurvivorDetail } from "@/components/survivors/SurvivorDetail";
import { NotFound } from "@/components/layout/NotFound";
// Guides (opinion layer) is intentionally PARKED — the code lives in
// src/components/guides/, src/content/guides.ts and content/guides/, but is not
// wired into the nav or router while the site stays facts-only. To re-enable:
// restore the two imports + routes below and the nav entry in src/lib/nav.ts.

const rootRoute = createRootRoute({
  component: RootLayout,
  // Renders inside RootLayout's <Outlet/>, so a bad URL keeps the nav and the footer and the
  // user can leave. Without it TanStack falls back to the bare string "Not Found" (§3j.146).
  // Wrapped rather than passed directly: TanStack hands its own NotFoundRouteProps to this
  // slot, which has nothing in common with NotFound's own optional props.
  notFoundComponent: () => <NotFound />,
});

/** `/` redirects to the codex, the app's home surface. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/items" });
  },
});

const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/items",
  component: CodexPage,
});

// /items exact — no drawer (CodexPage's <Outlet/> renders nothing).
const itemsIndexRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "/",
  component: () => null,
});

// /items/<id> — deep-linkable, shareable item drawer over the (still-mounted) grid.
const itemDetailRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: "$id",
  component: function ItemDrawerRoute() {
    const { id } = itemDetailRoute.useParams();
    const navigate = useNavigate();
    const item = itemById.get(id) ?? null;
    /*
      §3j.146 — an unknown id used to render the whole codex and say nothing.
      `ItemDetail` returns null when it has no item, so /items/not-a-real-item looked
      byte-for-byte like /items: someone following a stale or mistyped link was told the item
      does not exist by being shown 217 that are not it. `/survivors/nobody` had said so
      properly all along; this is the same courtesy in the drawer's own position.
    */
    if (!item) {
      return (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Item not found">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => navigate({ to: "/items" })}
            aria-hidden
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-surface p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-foreground">Item not found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              No item called &ldquo;{id}&rdquo;. It may have been renamed, or the link may be
              incomplete.
            </p>
            <button
              type="button"
              onClick={() => navigate({ to: "/items" })}
              className="mt-4 self-start text-sm text-primary hover:underline"
            >
              Back to the codex
            </button>
          </aside>
        </div>
      );
    }
    return (
      <ItemDetail
        item={item}
        onClose={() => navigate({ to: "/items" })}
        onSelectItem={(it) => navigate({ to: "/items/$id", params: { id: it.id } })}
      />
    );
  },
});

const plannerRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/planner",
  component: PlannerPage,
});

const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: StatLabPage,
});

const referenceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/reference",
  component: ReferencePage,
});

const survivorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/survivors",
  component: SurvivorsPage,
});

const survivorDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/survivors/$id",
  component: function SurvivorRoute() {
    const { id } = survivorDetailRoute.useParams();
    return <SurvivorDetail id={id} />;
  },
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  itemsRoute.addChildren([itemsIndexRoute, itemDetailRoute]),
  plannerRoute,
  statsRoute,
  referenceRoute,
  survivorsRoute,
  survivorDetailRoute,
]);

export const router = createRouter({
  routeTree,
  // Matches Vite's base so routes work under the GitHub Pages subpath
  // ("/RoR2Guide") in production and at "" (root) in dev.
  basepath: import.meta.env.BASE_URL.replace(/\/$/, ""),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
