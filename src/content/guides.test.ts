import { expect, test } from "vitest";
import { parseFrontmatter, buildGuides } from "./guides";

const GUIDE = `---
title: Loader opener priorities
author: Dillon
date: 2026-07-20
patch: Alloyed Collective
summary: What to grab before the first teleporter.
---

Grab **Crowbar** early.

- one
- two
`;

test("parses frontmatter and leaves the body intact", () => {
  const { data, body } = parseFrontmatter(GUIDE);
  expect(data.title).toBe("Loader opener priorities");
  expect(data.author).toBe("Dillon");
  expect(data.patch).toBe("Alloyed Collective");
  expect(body.trim().startsWith("Grab **Crowbar** early.")).toBe(true);
});

test("strips surrounding quotes from values", () => {
  const { data } = parseFrontmatter(`---\ntitle: "Quoted title"\n---\nbody`);
  expect(data.title).toBe("Quoted title");
});

test("publishes a valid guide and renders its markdown", () => {
  const [g] = buildGuides({ "/content/guides/loader.md": GUIDE });
  expect(g.slug).toBe("loader");
  expect(g.html).toContain("<strong>Crowbar</strong>");
  expect(g.html).toContain("<li>");
});

test("underscore-prefixed files are templates and never publish", () => {
  const out = buildGuides({
    "/content/guides/_template.md": GUIDE,
    "/content/guides/real.md": GUIDE,
  });
  expect(out.map((g) => g.slug)).toEqual(["real"]);
});

test("guides written for an older patch are marked stale", () => {
  const [current] = buildGuides({ "/content/guides/a.md": GUIDE }, "Alloyed Collective");
  expect(current.stale).toBe(false);

  const [old] = buildGuides({ "/content/guides/a.md": GUIDE }, "Some Future DLC");
  expect(old.stale).toBe(true);
});

test("a guide missing required stamps is rejected, not silently published", () => {
  const bad = `---\ntitle: No author\ndate: 2026-07-20\npatch: X\nsummary: y\n---\nbody`;
  const issues: string[] = [];
  const out = buildGuides({ "/content/guides/bad.md": bad }, "X", (slug) => issues.push(slug));
  expect(out).toHaveLength(0);
  expect(issues).toEqual(["bad"]);
});

test("newest guides sort first", () => {
  const mk = (d: string) => GUIDE.replace("date: 2026-07-20", `date: ${d}`);
  const out = buildGuides({
    "/content/guides/older.md": mk("2026-01-01"),
    "/content/guides/newer.md": mk("2026-06-01"),
  });
  expect(out.map((g) => g.slug)).toEqual(["newer", "older"]);
});
