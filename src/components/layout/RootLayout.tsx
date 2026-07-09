import { Outlet } from "@tanstack/react-router";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";

/** App shell: top nav, routed content, footer disclaimer. */
export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <TopNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
