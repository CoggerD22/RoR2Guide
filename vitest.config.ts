import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests only (src/**). The Playwright smoke suite in tests/ is run
// separately via `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Guides is parked (see tsconfig.app.json) — don't run its tests either.
    exclude: ["src/content/guides.test.ts"],
    environment: "node",
  },
});
