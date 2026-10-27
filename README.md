# Trillian — Campeonato Regional Go Kart ( Kart Cup 2026/2027)

Site estático oficial da **Kart Cup 2026**, um campeonato de karting de aluguer entre amigos
(Emídio, P. Queirós, Joel, Dinis), com o apoio da **Trillian Driving Coach**.

Built with [Astro](https://astro.build) 4 + Tailwind CSS, deployed to GitHub Pages.

Live: https://emidiofaria.github.io/Trillian-Campeonato_Regional_Go_Kart/

## Requirements

- Node.js 18.17.1+ (see `.nvmrc`). Astro is pinned to 4.16.x for Node 18 compatibility.

## Local development

| Command                 | Action                                         |
| ----------------------- | ---------------------------------------------- |
| `npm install`           | Install dependencies                           |
| `npm run dev`           | Dev server at `http://localhost:4321/<base>/`  |
| `npm run build`         | Build the static site into `dist/`             |
| `npm run preview`       | Serve `dist/` locally (respects the base path) |
| `npm run check`         | Validate data + type-check + lint (ESLint)     |
| `npm run format`        | Format with Prettier                           |
| `npm run add-result`    | Interactive CLI to record a GP result          |
| `npm run validate-data` | Validate `src/data/*.json` only                |

## Deploying to GitHub Pages

1. Push to `main`. The workflow `.github/workflows/deploy.yml` builds and deploys the site.
2. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. You can also trigger a deploy manually from the **Actions** tab (`workflow_dispatch`).

## Changing `site` / `base`

`astro.config.mjs` reads two environment variables, with these fallbacks:

| Variable    | Default                                 | Meaning                        |
| ----------- | --------------------------------------- | ------------------------------ |
| `SITE_URL`  | `https://emidiofaria.github.io`         | Origin of the deployed site    |
| `BASE_PATH` | `/Trillian-Campeonato_Regional_Go_Kart` | Sub-path the site is served at |

- Repo renamed → set `BASE_PATH=/<new-repo-name>`.
- `<user>.github.io` repo or a custom domain → set `BASE_PATH=/` (and `SITE_URL` to the domain).

Set them locally (`BASE_PATH=/ npm run build`) or as `env:` in the workflow. All internal links and
assets use `import.meta.env.BASE_URL`, so never hardcode `/`-rooted paths.

## Data and scoring

All championship data lives in `src/data/` and is validated with Zod at build time (`src/lib/schemas.ts`,
`src/lib/validate.ts`). Standings are never hardcoded; they are computed by `src/lib/scoring.ts`.

| File                    | Contents                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/data/pilots.json`  | `id`, `name`, `number` (1–4), `color`, `initials`                                                                                                   |
| `src/data/races.json`   | 7 GPs: `id`, `round`, `circuit`, `type` (Indoor/Outdoor), `location`, optional `date`/`timesheetUrl`, `status` (`scheduled` / `next` / `completed`) |
| `src/data/results.json` | Per GP: `raceId` + one entry per pilot `{ pilotId, attended, avgLapTime, bestLap, secondBestLap }` (seconds; `null` when absent)                    |

Scoring (see `docs/rules.md`): sessions are ranked by average lap time (ties: best lap, then
second-best lap) and score 6/4/2/0; absence = 0; +3 for the fastest lap (VR) of the session
(shared if two pilots set exactly the same time). Championship ties: more wins, then more VRs,
then fewer absences.

## Recording a GP result

There is no backend: results are committed to the repo and the site is rebuilt.

1. After the session, run `npm run add-result` and answer the prompts:
   - the GP (the current "next" GP is preselected; re-entering a GP replaces its results);
   - optional date (`AAAA-MM-DD`) and link to the official timesheet;
   - for each pilot: present or not, then best lap, 2nd-best lap and average lap.
     Times are accepted as `52.341`, `52,341` or `0:52.341`.
2. The CLI shows the computed classification and points and asks before saving. It then:
   - writes `src/data/results.json`;
   - marks the GP `completed` in `src/data/races.json`;
   - sets the first GP that isn't completed to `next` (no GP is `next` once the season ends).
3. Check and publish:
   ```sh
   npm run check            # validates the data too
   git add src/data && git commit -m "results: GP1"
   git push                 # the Pages workflow rebuilds and redeploys the site
   ```

Invalid data never reaches production. `npm run check` (and the site build itself) fails if:

- a lap time is invalid, or the best lap is slower than the 2nd-best lap or the average;
- an absent pilot has times, or a present pilot is missing one;
- a pilot is duplicated, unknown, or missing from a GP;
- a GP's `status` doesn't match whether it has results, or more than one GP is `next`.

Pilots who aren't comfortable with the CLI can open the **"Submeter resultados do GP"** issue
(template in `.github/ISSUE_TEMPLATE/`) with the timesheet; a maintainer then runs the CLI.

### `ABSENCE_RANKING_MODE`

The rules don't say how positions are awarded when someone is absent. The constant in
`src/lib/scoring.ts` controls it:

| Value                 | Behaviour                                                        | 3 attendees |
| --------------------- | ---------------------------------------------------------------- | ----------- |
| `'compact'` (default) | Attendees take the top positions in order                        | 6 / 4 / 2   |
| `'fixed'`             | The slowest attendee keeps the 4-pilot table's last slot (0 pts) | 6 / 4 / 0   |

## Tests and QA

| Command                    | What it does                                                                            |
| -------------------------- | --------------------------------------------------------------------------------------- |
| `npm test`                 | Vitest unit tests (`tests/unit/`): scoring engine, validation, result entry, formatting |
| `npm run test:e2e`         | Builds with production data, then Playwright smoke + axe tests against `astro preview`  |
| `npm run test:e2e:fixture` | Same, built with `tests/fixtures/season.json` into `dist-fixture/` (never deployed)     |
| `npm run lhci`             | Builds and runs Lighthouse CI (`lighthouserc.json`); warns if any category is below 95  |

- First run: `npx playwright install --with-deps chromium`. For `npm run lhci` without a system
  Chrome, set `CHROME_PATH` (e.g. to Playwright's Chromium).
- The e2e suite covers: base-path assets and links, all nav anchors, keyboard navigation and focus
  visibility, the disclosure menu at 360px, reduced motion, the standings/calendar/pilots in both
  the empty and fixture seasons, the 404 page, SEO files, and **axe** (fails on serious/critical).
- `.github/workflows/ci.yml` runs all of the above on every PR and push to `main`
  (Lighthouse only warns).

## SEO

- `@astrojs/sitemap` generates `sitemap-index.xml`; `robots.txt` is generated by
  `src/pages/robots.txt.ts` so the sitemap URL always includes the base path.
- `src/components/StructuredData.astro` emits JSON-LD: one `SportsEvent` per GP (+ the championship).
- `public/og-image.png` (1200×630) is generated once by `npm run og-image`
  (`scripts/generate-og-image.py`, needs Python + Pillow) and committed.
- `src/pages/404.astro` is served by GitHub Pages for unknown URLs (`noindex`).

## Go-live checklist

- [ ] **Settings → Pages → Source: GitHub Actions** is enabled.
- [ ] The `Deploy to GitHub Pages` workflow ran on `main` and the site loads at
      `https://emidiofaria.github.io/Trillian-Campeonato_Regional_Go_Kart/`.
- [ ] `SITE_URL` / `BASE_PATH` match the real URL (defaults are correct for this repo; if the repo
      is renamed, set `BASE_PATH=/<new-name>`).
- [ ] Optional custom domain: add it under **Settings → Pages**, add `public/CNAME` with the
      domain, and set `SITE_URL=https://<domain>` and `BASE_PATH=/` as `env:` in
      `.github/workflows/deploy.yml` (the base changes from `/<repo>` to `/`).
- [ ] GP dates added to `src/data/races.json` once agreed (optional `date`, `AAAA-MM-DD`).
- [ ] The absence rule (`ABSENCE_RANKING_MODE`) is confirmed with the group.
- [ ] CI is green (data, types, lint, unit, e2e + axe); Lighthouse ≥ 95.
- [ ] After each GP: `npm run add-result` → commit → push.
