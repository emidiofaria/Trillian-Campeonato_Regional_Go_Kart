# AGENTS.md — Project Context

You are building the official website for "Kart Cup 2026", a friends' rental-kart
championship (pilots: Emídio, P. Queirós, Joel, Dinis, Torres, P. Oliveira). Source specs are in
docs/rules.md (rules) and docs/layout.md (layout). Read both fully before coding.
The full phased plan is in 00_inputs/IMPLEMENTATION_PLAN.md.

Stack and constraints:

- Astro 4.16.x (pinned: local Node is 18.19.x, Astro 5 needs >= 18.20.8),
  TypeScript strict, fully static output (no SSR). Tailwind CSS 3 via @astrojs/tailwind.
- Deployed to GitHub Pages as a project site:
  https://emidiofaria.github.io/Trillian-Campeonato_Regional_Go_Kart/
  so `site` and `base` MUST be configured and every internal link/asset must
  respect `import.meta.env.BASE_URL`.
- Design tokens as CSS variables. No heavy UI frameworks; vanilla JS / Astro
  islands only where essential.
- All user-facing copy in European Portuguese (pt-PT), <html lang="pt-PT">.
- Design: sports/telemetry dark mode. Background #0d1117, slightly lighter
  surfaces, accents racing yellow, blue, green. Professional, not gimmicky.
- Quality bar: Lighthouse >= 95 in all categories, WCAG AA contrast, keyboard
  navigable, responsive from 360px, respects prefers-reduced-motion.
- Never hardcode championship results in components. All data lives in
  src/data and standings are computed.
- Do not copy "[cite: ...]" artifacts from the spec files into the site.
- Brand: the official Trillian Driving Coach logo is provided in docs/brand/
  (and public/): trillian-logo-512.png, -192, -180, -64, -32, trillian-logo.webp,
  favicon.ico. Use these real files. Do not redraw, recolor, or distort the logo,
  and do not invent a different logo. Keep it circular with its aspect ratio intact.
- Brand palette: --brand-blue #0f4174, --brand-yellow #e9be00,
  --brand-green #19833c, --brand-ring #82b07a, --bg #0d1117.
- Sponsor links (use exactly these):
  App website: https://emidiofaria.github.io/Trillian-website/
  Play Store: https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian
- Do not run git push. Do not install dependencies not needed for the task.

Scoring (single source of truth: `src/lib/scoring.ts`, documented in docs/rules.md §5/§7):

- Each GP awards average-time points 2×(N−1)…0 (6 pilots: 10/8/6/4/2/0) plus best-lap points
  N−1…0 for every pilot (6 pilots: 5/4/3/2/1/0), N = registered pilots. Applies retroactively
  from GP1.
- Equal best laps share the higher points and the next pilot skips a place (5, 5, 3).
- Absent pilots score 0; attendees take the top values of both tables (compact mode,
  `ABSENCE_RANKING_MODE`).
- "VR" (volta mais rápida) marks only the GP's best lap (lap rank 1); it counts for the
  tie-break: wins → fastest laps → fewer absences.
- The standings show "Pts média" and "Pts volta" columns, and GP cells show the split
  (e.g. "8 + 1"). Never hardcode these values; they are computed.

Calendar (`src/data/races.json`, mirrored in docs/rules.md §3 and the results issue template):

- 7 GPs; `id` must be `gp<round>`. Exactly one GP is `next`; imported GPs become `completed`.
- Order (changed 2026-11: Indoor Matosinhos and Baltar swapped): GP1 Cabo do Mundo, GP2 Indoor
  de Matosinhos, GP3 Rilhadas, GP4 Braga, GP5 Viana, GP6 Baltar, GP7 Indoor de Famalicão. When
  reordering, swap the circuit/type/location only, keep ids/rounds, and update all three places.
- Dates: optional `date` (`AAAA-MM-DD`); while only the month is known use `month` (`AAAA-MM`,
  shown as "dezembro de 2026 · dia a anunciar"). A `date` must fall inside its `month`. There is
  no start-time field yet.

Work in small, reviewable steps. At the end of each task, report what changed
and the exact commands to verify it.

## Skills

- **Adding a pilot/driver** (e.g. "add a new pilot", "adicionar/inscrever piloto", "novo piloto"):
  you MUST follow `.github/skills/add-pilot/SKILL.md`. It asks for the name and a photo or avatar
  colour, runs `npm run add-pilot`, and updates the docs and the OG image. Points
  (average time 2×(N−1)…0 + best lap N−1…0) are derived from the pilot count, so never edit the scoring code or the
  tests to add a pilot.
- **Recording GP results** (e.g. "resultados do GP", "importar resultados", "add GP results"):
  you MUST follow `.github/skills/add-gp-results/SKILL.md`. It asks which GP (default: the next
  one), the date and the session report (.md file or pasted), previews with
  `npm run import-gp -- --dry-run`, then imports. Points are recomputed (average time + best lap for
  every pilot; the preview prints `N pts (média + volta)`); only the average-time points are
  checked against the report (its total minus the legacy N−1 fastest-lap bonus when `FL` is set,
  or the new-rule total); on a mismatch, stop and ask. Never hand-edit results or the scoring code to make a report fit.
