import { test, expect } from "@playwright/test";
import { createServer, type Server } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * §3j.150 — the only tests that run against the BUILT tree.
 *
 * Every other browser test drives `vite dev`, which supplies an SPA fallback, rewrites paths
 * and serves source. GitHub Pages does none of that, and §3j.147 was the cost: five routes
 * returned GitHub's own 404 in production while 78 green tests said the site was fine, because
 * not one of them had ever looked at `dist/`.
 *
 * So this serves `dist/` the way Pages actually does — static files only, `<dir>/index.html`
 * for a directory, `/404.html` with status 404 for anything missing, and the `/RoR2Guide/`
 * base path — and drives a real browser against it.
 *
 * The fallback is deliberately NOT an SPA rewrite. Making this server more forgiving than Pages
 * would reproduce exactly the blind spot it exists to close.
 */
const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, "..", "dist");
const BASE = "/RoR2Guide";

const MIME: Record<string, string> = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".json": "application/json", ".svg": "image/svg+xml",
};

let server: Server;
let origin: string;

test.beforeAll(async () => {
  // Fail loudly rather than skip. A skipped check that reads as a pass is the §3j.148 defect.
  expect(
    existsSync(join(dist, "index.html")),
    "dist/ is missing or empty — run `pnpm build` before this suite",
  ).toBe(true);

  server = createServer((req, res) => {
    let p = decodeURIComponent((req.url ?? "/").split("?")[0]);
    if (!p.startsWith(BASE)) {
      // Pages serves nothing outside the project path.
      res.writeHead(404).end("not found");
      return;
    }
    p = p.slice(BASE.length) || "/";
    let file = join(dist, p);
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(readFileSync(file));
      return;
    }
    // Exactly what Pages does with an unmatched path.
    const nf = join(dist, "404.html");
    if (existsSync(nf)) {
      res.writeHead(404, { "content-type": "text/html" });
      res.end(readFileSync(nf));
      return;
    }
    res.writeHead(404).end("not found");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const addr = server.address();
  origin = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

test.afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
});

/** Every navigation asserts the page booted AND threw nothing. */
async function visit(page: import("@playwright/test").Page, path: string) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e).split("\n")[0]));
  const failed: string[] = [];
  page.on("requestfailed", (r) => failed.push(`${r.url()} ${r.failure()?.errorText}`));
  /*
    §3j.157 — `requestfailed` does NOT fire for an HTTP error status. It covers network-level
    failures; a 404 is a *successful* request that returned 404, so a page whose every asset
    404s reported zero failed requests and passed.
    That is not hypothetical: the mutation sweep removed the base-path prefix from `asset()`,
    which makes every icon resolve to /icons/… instead of /RoR2Guide/icons/… — 404 on Pages,
    invisible in dev where BASE_URL is "/" — and this suite did not notice.
  */
  const notOk: string[] = [];
  page.on("response", (r) => {
    if (r.status() >= 400) notOk.push(`${r.status()} ${r.url().replace(origin, "")}`);
  });
  const resp = await page.goto(`${origin}${BASE}${path}`);
  return { errors, failed, notOk, status: resp?.status() ?? 0 };
}

test.describe("the built tree, served the way GitHub Pages serves it", () => {
  for (const [path, heading] of [
    ["/", /Item Codex/],
    ["/items", /Item Codex/],
    ["/planner", /Run Planner/],
    ["/stats", /Stat Lab/],
    ["/reference", /Reference/],
    ["/survivors", /Survivors/],
  ] as const) {
    test(`${path} loads from a static file server`, async ({ page }) => {
      const { errors, failed, notOk, status } = await visit(page, path);
      expect(status, `${path} did not return 200`).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
      expect(errors, `threw: ${errors[0]}`).toEqual([]);
      expect(failed, `failed requests: ${failed[0]}`).toEqual([]);
      expect(notOk, `sub-resources returned an error status: ${notOk.join(", ")}`).toEqual([]);
    });
  }

  test("a deep-linked item opens its drawer, with assets resolved from a subdirectory", async ({ page }) => {
    // The page lives at dist/items/crowbar/index.html — two levels down. A relative asset
    // reference would resolve against /items/crowbar/ and 404.
    const { errors, failed, notOk, status } = await visit(page, "/items/crowbar");
    expect(status).toBe(200);
    await expect(page.getByRole("dialog", { name: "Crowbar" })).toBeVisible();
    expect(errors, `threw: ${errors[0]}`).toEqual([]);
    expect(failed, `failed requests: ${failed[0]}`).toEqual([]);
    expect(notOk, `sub-resources returned an error status: ${notOk.join(", ")}`).toEqual([]);

    // Icons must actually DECODE, not merely be requested. `asset()` prefixes the deploy base
    // path, and dropping that prefix is invisible in dev (BASE_URL is "/") while 404-ing every
    // icon in production. naturalWidth is the only thing that distinguishes a loaded image
    // from a broken one.
    const loaded = await page.evaluate(() =>
      Array.from(document.images).filter((i) => i.complete && i.naturalWidth > 0).length,
    );
    expect(loaded, "no icon actually decoded — the asset base path is wrong").toBeGreaterThan(0);
  });

  test("a deep-linked survivor renders", async ({ page }) => {
    const { status, errors } = await visit(page, "/survivors/commando");
    expect(status).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Commando/);
    expect(errors).toEqual([]);
  });

  test("an unknown path serves 404.html and the app's own 404 renders", async ({ page }) => {
    const { status, errors } = await visit(page, "/nonsense");
    // Pages returns 404 for the fallback; the app still boots and explains itself.
    expect(status, "the 404.html fallback was not served").toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/not found/i);
    await expect(page.getByRole("link", { name: /Back to the item codex/ })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a shared planner link survives a real page load", async ({ page }) => {
    // The whole point of "Copy link", and the URL shape that 404'd in production (§3j.147).
    const { status, errors } = await visit(page, "/planner?t=crowbar");
    expect(status).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Run Planner/);
    expect(errors).toEqual([]);
  });
});
