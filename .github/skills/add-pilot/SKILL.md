---
name: add-pilot
description: >-
  Register a new pilot/driver in the Kart Cup 2026 championship site. Asks for the pilot name and a
  photo or avatar colour, runs `npm run add-pilot`, updates the docs and the OG image, and verifies
  the build and tests. The points table (2×(N−1)…0, VR = N−1) adapts automatically. Use whenever
  the user asks to add, register or enrol a pilot or driver, e.g. "adicionar piloto", "novo piloto",
  "inscrever piloto", "add a pilot", "add a new driver", "new driver joins the championship".
---

# Skill: add a pilot to Kart Cup 2026

Adds a pilot end-to-end: data, avatar (photo or colour), scoring, docs, OG image and verification.
Work from the repository root. Never `git push`.

## How the site adapts (don't edit these by hand)

- **Points** are derived from the number of pilots N in `src/lib/scoring.ts`:
  `positionPoints(N) = 2×(N−1), …, 2, 0` and `fastestLapBonus(N) = N−1` (half the win).
  For example, 5 pilots give 8/6/4/2/0 + VR 4, and 6 pilots give 10/8/6/4/2/0 + VR 5.
  **Never edit the scoring code to add a pilot.**
- **Mid-season joins:** each GP in `src/data/results.json` stores `pilotCount`. GPs already run
  keep their points table, and the newcomer is recorded there as absent (0 pts, 1 absence each).
  The CLI does this.
- **UI:** the standings badge, rows, pilot cards, rules points table, VR text, "boa sorte" line and
  JSON-LD all come from `src/data/pilots.json`.
- **Tests:** the e2e specs read `src/data/pilots.json`. The unit tests use
  `tests/fixtures/pilots.json`, which must **not** be changed when adding a pilot.

## Workflow

### 1. Collect the input (use the `ask_user` tool, one form)

Ask for:

1. **Pilot name** (required), as it should appear on the site, e.g. "Torres" or "Ana Sousa".
2. **Avatar type:** `photo` or `colour`.
3. **Photo path** (if photo): an absolute path to a jpg/png/webp/avif image, ideally square and
   ≥ 256px. Confirm the file exists before running the CLI.
4. **Colour:** the avatar colour, or the ring/accent colour when a photo is used. Offer the unused
   colours from `SUGGESTED_COLOURS` in `src/lib/pilot-entry.ts` (compare with the colours already in
   `src/data/pilots.json`), with the first unused one as the default. The user may type a custom
   `#rrggbb`.
5. **Initials** (optional): defaults to the CLI's suggestion (first two letters, or first + last
   initial).

If the user already gave some of these in the request, don't ask for them again.

### 2. Run the CLI (non-interactive)

```sh
# colour avatar
npm run add-pilot -- --name "<Name>" --color "<#rrggbb>" [--initials XX] --yes
# photo avatar (photo is centre-cropped to src/assets/pilots/<id>.webp)
npm run add-pilot -- --name "<Name>" --photo "<path>" --color "<#rrggbb>" [--initials XX] --yes
```

- The CLI prints a summary (number, id, avatar, new points table, GPs where the pilot is marked
  absent) and writes `src/data/pilots.json`, plus `src/data/results.json` if GPs were already run.
- If it exits with `✖`, fix the input (duplicate name or colour, colour too dark for AA, bad photo)
  and ask the user again if needed. Don't edit the JSON by hand to work around validation.

### 3. Regenerate the OG image

```sh
npm run og-image   # needs python3 + Pillow; reads the pilot count from pilots.json
```

If Pillow is missing, say so in the report rather than installing system packages without asking.

### 4. Update the docs (the CLI can't do this)

Use the full pilot list in number order and the new N. Write in European Portuguese (pt-PT) and
never copy `[cite: …]` artifacts.

- `docs/rules.md`:
  - **§2 Pilotos Inscritos:** add `* <Name>`.
  - **§5 heading:** `(para N Participantes)`.
  - **§5 table:** one row per position from 1º to Nº, `Cálculo` = `(N−k) × 2` for position k
    (`-` for the last), `Pontos` = `2×(N−k) pts`; keep the **Falta** row.
  - **VR:** `**+(N−1) pontos** (metade dos pontos da vitória)` and the example
    `soma 2(N−1) + (N−1) = 3(N−1) pontos`.
  - **§8 "boa sorte" line:** `Emídio, P. Queirós, …, <Penultimate> e <Name>!`.
  - If GPs were already run, add a note under §6 that the pilot joined from GP k and that earlier
    GPs keep the points table they were run with.
- `README.md`: the pilot list in the intro, and the "today N: …" values in the Scoring paragraph.
- `AGENTS.md`: the pilot list on the first line ("pilots: …").
- `docs/layout.md`: the "hoje N / hoje 8/6/4/2/0 / hoje +4" example values.

### 5. Verify

```sh
npm run check          # data (incl. photo exists) + astro check + eslint
npm run format:check
npm test
npm run build
npm run test:e2e && npm run test:e2e:fixture   # if Playwright's Chromium is installed
```

All checks must pass. If an e2e test times out under load, rerun that file alone before treating
it as a real failure.

### 6. Report

Tell the user:

- the pilot added (#, name, id, initials, colour, photo);
- the new points table and VR bonus;
- any GPs where the pilot was marked absent;
- the files changed;
- the verification commands and their results;
- how to preview: `npm run dev`, then open
  `http://localhost:4321/Trillian-Campeonato_Regional_Go_Kart/`.

Don't commit unless asked. If the user wants a commit, use the message `feat: add pilot <Name>`.

## Guardrails

- Only add pilots. Removing or renaming a pilot with results is out of scope: explain and ask.
- Photos must be the user's own or used with consent. Don't download images from the web.
- Keep the brand rules in `AGENTS.md`: don't touch the Trillian logo or the sponsor links.
- Maximum is 12 pilots (`MAX_PILOTS` in `src/lib/schemas.ts`).
