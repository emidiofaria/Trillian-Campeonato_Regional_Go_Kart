---
name: add-gp-results
description: >-
  Record the results of a Grand Prix in the Kart Cup 2026 championship site from a session report
  (markdown tables: Championship, Fastest lap, Best mean time, Top speed, Most consistent pilot),
  given as an .md file or pasted in the chat. Runs `npm run import-gp`, which recomputes the points
  (average-time points + best-lap points for every pilot), checks the average-time points against
  the report, updates the standings, calendar and the "Resultados" tabs (new GP becomes the
  default tab, previous GPs stay available as tabs), archives the raw report in docs/results/, and
  verifies the build and tests. Use whenever the user asks to add, record, import or update GP
  results, e.g. "resultados do GP", "novo GP", "importar resultados", "atualizar classificação",
  "add GP results", "record race results", "the GP is done, here are the results".
---

# Skill: record GP results in Kart Cup 2026

Imports one GP from the session report into `src/data`, and the site rebuilds everything from it.
Work from the repository root. Never `git push`.

## How the site adapts (don't edit these by hand)

- **Standings, calendar, pilot stats, hero leader chip** are computed from `src/data/results.json`
  by `src/lib/scoring.ts`. Never hardcode results in components.
- **Points are recomputed, not copied.** Each GP scores average-time points (2×(N−1)…0) plus
  best-lap points for every attendee (N−1…0, equal best laps share the higher value). The CLI
  checks only the **average-time points** against the report's Championship table: the reported
  total minus the legacy single fastest-lap bonus (N−1) when the `FL` column is set (a report whose
  totals already follow the new rule is also accepted). Any difference (average-time points,
  fastest-lap holder, a pilot with points but no times) stops the import, and nothing is written.
- **Best-lap points** come from the `Fastest lap` table: k-th best lap → N−k points (6 pilots:
  5/4/3/2/1/0). Equal best laps share the higher points and the next pilot skips a place (5, 5,
  3). Absent pilots get 0 and attendees take the top values (compact mode). Only the GP's best
  lap (lap rank 1) gets the **VR** mark, which counts for the tie-break (wins → fastest laps →
  fewer absences).
- **Display:** the standings have "Pts média" and "Pts volta" columns, and GP cells, the GP report
  and the calendar show the split (e.g. `8 + 1`). All of it is computed; nothing to edit.
- **"Resultados" section** (`src/components/sections/GpResults.astro`): one tab per completed GP.
  The newest GP is selected by default, and older GPs remain available as tabs. Each panel
  (`#resultados-gpN`) is rendered by `src/components/GpReport.astro`, and the calendar links to it.
- **Race status:** the imported GP becomes `completed` and the following GP becomes `next`
  (`src/data/races.json`).
- **Archive:** the raw report is saved verbatim to `docs/results/<gpN>.md`.

## Report format (input)

Markdown tables, identified by their section titles (in any order, extra sections are ignored):

| Section title contains | Required columns                          |
| ---------------------- | ----------------------------------------- |
| `Championship`         | `Pilot`, `Total`                          |
| `Fastest lap`          | `Pilot`, `Best lap`, `Session`            |
| `Best mean time`       | `Pilot`, `Best avg`                       |
| `Top speed`            | `Pilot`, `Top speed`                      |
| `Most consistent`      | `Pilot`, `Std dev`, `Spread`              |
| any table (optional)   | `Pilot` + `Kart`, to show the kart number |

- Times can be `59.000` or `1:00.008`. The session number comes from the `Session` column (`S23` →
  `23`).
- Pilot names are matched to `src/data/pilots.json` ignoring accents and case, by full name,
  surname or first name (e.g. `Andre Torres` → Torres, `Pedro Queiros` → P. Queirós). Names that
  aren't in the championship (guests, e.g. `TOMAS`) are ignored. Registered pilots missing from the
  report are recorded as **absent** (0 points, 1 absence).

## Workflow

### 1. Collect the input (use the `ask_user` tool, one form)

Ask for:

1. **Which GP** (always ask): offer the GPs from `src/data/races.json`, with the `next` GP as the
   default. Show `gpN · circuit · date`.
2. **Date** (`AAAA-MM-DD`): required if that race has no `date`. Otherwise, offer the stored date.
   If the race only has a `month` (`AAAA-MM`), the date must fall in that month (the data check
   rejects it otherwise); if the GP moved to another month, update `month` first.
3. **Report:** a path to an `.md` file, or the report pasted in the chat. If pasted, save it
   verbatim to a temporary file in the session workspace (not in the repo) and pass that path. The
   CLI also accepts `-` to read the report from stdin.
4. **Official timesheet URL** (optional).

If the user already gave some of these in the request, don't ask for them again.

### 2. Preview (dry run) and confirm

```sh
npm run import-gp -- --race gpN [--date AAAA-MM-DD] [--timesheet URL] [--replace] --dry-run <report.md>
```

- Show the user the pilot matching, the GP classification (each line prints
  `N pts (média + volta)`, plus `VR` for the best lap) and the new championship standings, then
  ask (`ask_user`) for confirmation before writing.
- **`✖ ... não bate certo com o regulamento`** (lines like
  `Nome: relatório X pts no tempo médio, regulamento Y pts`): stop. Show the mismatches and ask the user how to
  proceed (fix the report, or confirm the times are right). Never edit the JSON by hand or change
  the scoring code to make a report "fit".
- **Unknown or ambiguous name:** ask the user which pilot it is, then rerun with
  `--map "Name=pilotId"` (or `--map "Name=ignore"` for a guest).
- **`já tem resultados`:** the GP was already imported. Only use `--replace` if the user confirms
  they want to overwrite it.
- If the race has no date, the CLI requires `--date`.

### 3. Import

Rerun the same command without `--dry-run` and with `--yes`. The CLI writes
`src/data/results.json`, `src/data/races.json` and `docs/results/<gpN>.md`.

Updating a past GP (e.g. a corrected report) works the same way with `--replace`. The tabs and
standings pick it up automatically.

### 4. Verify

```sh
npm run check          # data + astro check + eslint
npm run format:check
npm test
npm run build
npx playwright test --workers=2                                                   # production data
KARTCUP_FIXTURE=1 npx astro build && KARTCUP_FIXTURE=1 npx playwright test --workers=2
npm run build          # rebuild production dist afterwards
```

- Stop any `astro dev` server on port 4321 first. Playwright reuses whatever is listening there,
  and the dev server doesn't serve `404.html` or the sitemap.
- A few e2e specs pin production values (e.g. the GP1 checks in `tests/e2e/sections.spec.ts` and
  `standings.spec.ts`, including the "Pts média"/"Pts volta" totals and the `8 + 1` breakdowns,
  the next-GP banner and GP2/GP6 calendar checks in `sections.spec.ts`,
  and the leader in `hero.spec.ts`). If a new GP changes them (another leader, totals, shared
  positions, `#calendario details` count), update those expectations to the new computed values and
  say so in the report. Don't change the scoring code or the unit-test fixtures.

### 5. Report

Tell the user:

- the GP imported (round, circuit, date, session) and the winner, the fastest-lap holder (VR), any
  absent pilots and ignored names;
- each pilot's GP points as `total (média + volta)`;
- the new championship top 3 (or the full table), noting shared positions;
- the files changed;
- the verification commands and their results;
- how to preview: `npm run dev`, then open
  `http://localhost:4321/Trillian-Campeonato_Regional_Go_Kart/#resultados`.

Don't commit unless asked. If the user wants a commit, use the message `feat: add GPn results`.

## Guardrails

- One GP per run. For several GPs, import them in round order.
- The report is the source of truth for times. Don't "fix" times from other sources without
  asking the user.
- Don't add pilots here. If the report has a new championship pilot, use the `add-pilot` skill
  first, then import.
- Keep `docs/results/*.md` verbatim (it's excluded from Prettier).
