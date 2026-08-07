# RoR2 Companion

A fan-made [Risk of Rain 2](https://www.riskofrain.com/) companion site: an interactive
item codex, a pre-run planner (target / avoid items), a survivor-aware stat lab, and a
set of high-value reference pages.

> Not affiliated with Gearbox Publishing or Hopoo Games. Non-commercial fan project. All
> item art, names, and descriptions belong to Gearbox Publishing.

See [`PLAN.md`](./PLAN.md) for the full scope, data schema, and milestones,
[`CLAUDE.md`](./CLAUDE.md) for the non-negotiable data and design rules, and
[`MATH-VERIFICATION.md`](./MATH-VERIFICATION.md) for the verification log.

## What makes it different

Every number is traced to the game itself, not to a wiki — **208 of 217 items** are
verified against decompiled C# or serialized Unity assets, and the rest say plainly what is
still open. Where the game's own description is wrong, the site says so and shows the
evidence: Bandolier's real chance is 20.4%, not the stated 18%; Stone Flux Pauldron slows
66.7%, not 50%; Encrusted Key's cache does not use the drop table its tooltip implies.

Facts and opinions never mix. Mechanical data lives in JSON and is verifiable; guidance
would live in `/content/guides` and be badged as one author's judgement. The site currently
ships facts only.

## Stack

Vite • React 19 • TypeScript (strict) • Tailwind CSS v4 • TanStack Router • Zustand
(planner state, persisted to localStorage) • Fuse.js (search) • Zod (data validation).
No backend: static JSON and client state only.

## Getting started

Requires Node ≥ 20 and [pnpm](https://pnpm.io) (`npm install -g pnpm`).

```bash
pnpm install
pnpm dev          # dev server at http://localhost:5173
```

## Scripts

| Command            | What it does                                                          |
| ------------------ | --------------------------------------------------------------------- |
| `pnpm dev`         | Vite dev server with HMR.                                              |
| `pnpm build`       | Typecheck, build to `dist/`, prerender OG images.                      |
| `pnpm preview`     | Serve the production build locally.                                    |
| `pnpm typecheck`   | Type-check the whole project.                                          |
| `pnpm test:unit`   | Vitest: stat engine, stacking curves, and the data-integrity guards.   |
| `pnpm test`        | Playwright: end-to-end over every page.                                |
| `pnpm data:audit`  | Schema + integrity checks over `/src/data`.                            |
| `pnpm data:diff`   | Our numbers vs the game's language files.                              |
| `pnpm data:verify` | Stat coefficients vs decompiled code; survivors vs the body prefabs.   |

> Playwright needs a browser once: `pnpm exec playwright install chromium`.

### Checks that need the game installed

`data:audit` and `data:verify` cross-check against the local game install through two
git-ignored extractors — `scripts/decompile.sh` → `.decompiled/` (C#) and the
`scripts/extract-*.py` family → `.gamedata/` (Unity assets). **Never commit their output:
it is Gearbox's data.** Without them, three audit rules and the `data:verify` cross-checks
report as *skipped* rather than passed, which is why CI cannot enforce them — see the guard
tiers in [`CLAUDE.md`](./CLAUDE.md). Run `pnpm data:audit` locally before pushing data work.

## Deploy

The build in `dist/` is fully static and host-agnostic.

- **GitHub Pages** — `.github/workflows/deploy.yml` publishes on push to `main`, gating the
  deploy on typecheck → data audit → data verify → unit tests. SPA deep links work via a
  copy of `index.html` at `404.html`.
- **Netlify / Cloudflare Pages** — `public/_redirects` provides the same SPA fallback.

`.github/workflows/ci.yml` runs the full suite, including Playwright, on every push and PR.

## Project status

**All milestones landed** (M0 skeleton → M6 reference pages), followed by a verification
programme that rebuilt the stat engine against the decompiled `RecalculateStats`, traced
208 of 217 items to code or assets, and audited every rendered surface for claims a reader
could misread. `MATH-VERIFICATION.md` is the full log.

What is left needs something this pipeline cannot supply: **written guides need a human
author**, and **behaviour under real play** cannot be verified by reading files.
