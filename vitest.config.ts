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
    environment: "node",
  },
});
