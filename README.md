# Trillian — Campeonato Regional Go Kart (Kart Cup 2026)

Site estático oficial da **Kart Cup 2026**, um campeonato de karting de aluguer entre amigos
(Emídio, P. Queirós, Joel, Dinis), com o apoio da **Trillian Driving Coach**.

Built with [Astro](https://astro.build) 4 + Tailwind CSS, deployed to GitHub Pages.

Live: https://emidiofaria.github.io/Trillian-Campeonato_Regional_Go_Kart/

## Requirements

- Node.js 18.17.1+ (see `.nvmrc`). Astro is pinned to 4.16.x for Node 18 compatibility.

## Local development

| Command           | Action                                         |
| ----------------- | ---------------------------------------------- |
| `npm install`     | Install dependencies                           |
| `npm run dev`     | Dev server at `http://localhost:4321/<base>/`  |
| `npm run build`   | Build the static site into `dist/`             |
| `npm run preview` | Serve `dist/` locally (respects the base path) |
| `npm run check`   | Type-check (`astro check`) + lint (ESLint)     |
| `npm run format`  | Format with Prettier                           |

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
second-best lap) and score 8/6/4/0; absence = 0; +4 for the fastest lap (VR) of the session
(shared if two pilots set exactly the same time). Championship ties: more wins, then more VRs,
then fewer absences.

### `ABSENCE_RANKING_MODE`

The rules don't say how positions are awarded when someone is absent. The constant in
`src/lib/scoring.ts` controls it:

| Value                 | Behaviour                                                        | 3 attendees |
| --------------------- | ---------------------------------------------------------------- | ----------- |
| `'compact'` (default) | Attendees take the top positions in order                        | 8 / 6 / 4   |
| `'fixed'`             | The slowest attendee keeps the 4-pilot table's last slot (0 pts) | 8 / 6 / 0   |

### Tests

- `npm test` runs the Vitest unit tests (`tests/unit/`), which use `tests/fixtures/season.json`
  (a test-only fixture, never used in production).
- `KARTCUP_FIXTURE=1 npm run build` builds the site with the fixture data (used by e2e tests).
