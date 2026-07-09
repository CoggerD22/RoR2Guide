import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { RootLayout } from "@/components/layout/RootLayout";
import { PlaceholderPage } from "@/components/PlaceholderPage";
import { NAV_SECTIONS, type NavSection } from "@/lib/nav";

const rootRoute = createRootRoute({ component: RootLayout });

function section(path: NavSection["path"]): NavSection {
  const found = NAV_SECTIONS.find((s) => s.path === path);
  if (!found) throw new Error(`Missing nav section for ${path}`);
  return found;
}

/** `/` redirects to the codex, the app's home surface. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: () => {
    throw redirect({ to: "/items" });
  },
});

function placeholderRoute(path: NavSection["path"]) {
  const meta = section(path);
  return createRoute({
    getParentRoute: () => rootRoute,
    path,
    component: () => (
      <PlaceholderPage
        title={meta.label}
        blurb={meta.blurb}
        milestone={meta.milestone}
        icon={meta.icon}
      />
    ),
  });
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  placeholderRoute("/items"),
  placeholderRoute("/planner"),
  placeholderRoute("/stats"),
  placeholderRoute("/reference"),
]);

export const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
