# RoR2 Companion

A fan-made [Risk of Rain 2](https://www.riskofrain.com/) companion site: an interactive
item codex, a pre-run planner (target / avoid items), a survivor-aware stat lab, and a
set of high-value reference pages.

> Not affiliated with Gearbox Publishing or Hopoo Games. Non-commercial fan project. All
> item art, names, and descriptions belong to Gearbox Publishing.

See [`PLAN.md`](./PLAN.md) for the full scope, data schema, and milestones, and
[`CLAUDE.md`](./CLAUDE.md) for the non-negotiable data and design rules.

## Stack

Vite • React 19 • TypeScript (strict) • Tailwind CSS v4 • shadcn/ui • TanStack Router.
Later milestones add Zustand (planner state), Fuse.js (search), and Zod (data validation).

## Getting started

Requires Node ≥ 20 and [pnpm](https://pnpm.io) (`npm install -g pnpm`).

```bash
pnpm install
pnpm dev          # start the dev server at http://localhost:5173
```

## Scripts

| Command             | What it does                                                        |
| ------------------- | ------------------------------------------------------------------- |
| `pnpm dev`          | Vite dev server with HMR.                                            |
| `pnpm build`        | Typecheck (`tsc -b`) then build the static site to `dist/`.         |
| `pnpm preview`      | Serve the production build locally.                                 |
| `pnpm typecheck`    | Type-check the whole project.                                       |
| `pnpm data:audit`   | Schema + integrity checks over `/src/data` (stubbed until M1).      |
| `pnpm test`         | Playwright smoke test of the app shell.                             |

> The smoke test needs a browser once: `pnpm exec playwright install chromium`.

## Deploy

The build in `dist/` is fully static and host-agnostic. `public/_redirects` provides the
SPA fallback for Netlify / Cloudflare Pages. CI (`.github/workflows/ci.yml`) runs
typecheck → data audit → build → smoke test on every push and PR.

## Project status

**M0 — Skeleton (current).** App shell, theme tokens, routing, and deploy pipeline.
Sections beyond the shell render "Coming in Mx" placeholders until their milestone lands.
