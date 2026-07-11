import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { CodexPage } from "@/components/codex/CodexPage";
import { PlannerPage } from "@/components/planner/PlannerPage";
import { StatLabPage } from "@/components/statlab/StatLabPage";
import { ReferencePage } from "@/components/reference/ReferencePage";

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

const routeTree = rootRoute.addChildren([
  indexRoute,
  itemsRoute,
  plannerRoute,
  statsRoute,
  referenceRoute,
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
