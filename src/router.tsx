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
// Guides (opinion layer) is intentionally PARKED — the code lives in
// src/components/guides/, src/content/guides.ts and content/guides/, but is not
// wired into the nav or router while the site stays facts-only. To re-enable:
// restore the two imports + routes below and the nav entry in src/lib/nav.ts.

const rootRoute = createRootRoute({ component: RootLayout });

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
