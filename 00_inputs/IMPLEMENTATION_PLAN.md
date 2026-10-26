# Kart Cup 2026: Implementation Plan (GitHub Copilot CLI)

Static Astro website for a friends' rental-kart championship, deployed to GitHub Pages.
Pilots: Emídio, P. Queirós, Joel, Dinis. Sponsor: Trillian Driving Coach.
Site copy is pt-PT. Prompts and code are in English.

---

## 0. How to run this with Copilot CLI

### Setup
1. Create the repo and clone it. Copy the two spec files in as `docs/rules.md` (was `2.md`) and `docs/layout.md` (was `3.md`).
2. Copy the logo assets from the `assets/` folder delivered with this plan into the repo as `docs/brand/` (they are the Trillian logo, already cropped to a transparent circle and exported in several sizes; see Section 1.1). The agent will move them into `public/` in Phase 1.
3. Copy **Section 1 (Project Context)** below into `AGENTS.md` at the repo root (Copilot CLI also reads `.github/copilot-instructions.md`; use either, not both).
4. Start the CLI in the repo root: `copilot`
5. Pick a model with `/model` (see Section 0.1).
6. Run one phase at a time. Paste the phase prompt, review the diff, run the verification commands, commit, then start the next phase. Use `/clear` (or a fresh session) between phases so context stays clean; `AGENTS.md` carries the shared context.

### Tips
- For each phase, start with plan mode (Shift+Tab to cycle modes) so the agent proposes a plan before touching files. Approve, then let it implement.
- Approve tools per session rather than blanket `--allow-all-tools`. The agent will run npm and git commands; read what it asks for.
- Non-interactive alternative: `copilot -p "<phase prompt>"` works, but interactive is better for review.
- Never let the agent run `git push` automatically. Push yourself after review.

### 0.1 Model recommendation
Model lists in Copilot change often, so run `/model` and pick from what your plan offers. Rule of thumb:

| Phase | Needs | Pick |
|---|---|---|
| Phase 2 (scoring engine + tests) | Careful logic, edge cases | **Strongest reasoning model available** (Claude Opus-class, or GPT-5-class with high reasoning) |
| Phase 7 (CLI + validation), Phase 8 (CI/QA) | Multi-file tooling, debugging | **Claude Sonnet-class** (best balance) |
| Phases 1, 3, 4, 5, 6 (scaffold, UI, content) | Fast, good frontend taste | **Claude Sonnet-class** |

**Default for the whole project: a Claude Sonnet-class model.** It is strong at Astro/Tailwind UI work and agentic multi-file edits, and cheaper on premium-request quota. Switch up to the top reasoning model only for Phase 2, since a scoring bug silently corrupts the standings. If your plan has no Sonnet/Opus option, use the best GPT-5-class model. Avoid "mini"/fast models for Phase 2.

---

## 1. Project Context (put in `AGENTS.md`)

```
You are building the official website for "Kart Cup 2026", a friends' rental-kart
championship (pilots: Emídio, P. Queirós, Joel, Dinis). Source specs are in
docs/rules.md (rules) and docs/layout.md (layout). Read both fully before coding.

Stack and constraints:
- Astro (latest stable), TypeScript strict, fully static output (no SSR).
- Deployed to GitHub Pages as a project site: https://<user>.github.io/<repo>/
  so `site` and `base` MUST be configured and every internal link/asset must
  respect `import.meta.env.BASE_URL`.
- Tailwind CSS via the official Astro integration, design tokens as CSS variables.
  No heavy UI frameworks; vanilla JS / Astro islands only where essential.
- All user-facing copy in European Portuguese (pt-PT), <html lang="pt-PT">.
- Design: sports/telemetry dark mode. Background #0d1117, slightly lighter
  surfaces, accents racing yellow, blue, green. Professional, not gimmicky.
- Quality bar: Lighthouse >= 95 in all categories, WCAG AA contrast, keyboard
  navigable, responsive from 360px, respects prefers-reduced-motion.
- Never hardcode championship results in components. All data lives in
  src/data and standings are computed.
- Do not copy "[cite: ...]" artifacts from the spec files into the site.
- Brand: the official Trillian Driving Coach logo is provided in docs/brand/
  (trillian-logo-512.png, -192, -180, -64, -32, trillian-logo.webp, favicon.ico).
  Use these real files. Do not redraw, recolor, or distort the logo, and do not
  invent a different logo. Keep it circular with its aspect ratio intact.
- Sponsor links (use exactly these):
  App website: https://emidiofaria.github.io/Trillian-website/
  Play Store:  https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian
- Do not run git push. Do not install dependencies not needed for the task.

Work in small, reviewable steps. At the end of each task, tell me what changed
and the exact commands to verify it.
```

### 1.1 Logo and brand palette

Provided logo: a yellow racing helmet with green and black stripes on a deep-blue
circle with a thin neon-green ring. Sampled brand colors (use as design tokens
and tune for AA contrast):

| Token | Hex | Use |
|---|---|---|
| `--brand-blue` | `#0f4174` | Sponsor surfaces, gradient ring, links |
| `--brand-yellow` | `#e9be00` | Leader highlight, primary accent, points |
| `--brand-green` | `#19833c` | Play Store CTA, success states |
| `--brand-ring` | `#82b07a` | Neon ring accent, subtle glows |
| `--bg` | `#0d1117` | Page background |

Files in `docs/brand/`:

| File | Size | Use |
|---|---|---|
| `trillian-logo-512.png` / `.webp` | 512x512 | Hero visual, OG image composition |
| `trillian-logo-192.png` | 192x192 | Web manifest icon, footer/sponsor block |
| `trillian-logo-180.png` | 180x180 | `apple-touch-icon` |
| `trillian-logo-64.png` / `-32.png` | 64 / 32 | Navbar sponsor mini-badge |
| `favicon.ico` | 16/32/48 | Site favicon |

Note: the source was a square-ish image with a light background. These exports
were cropped to the blue disc and masked to a transparent circle, so the logo
sits cleanly on the dark `#0d1117` background.

---

## 2. Phases

Each phase: **Goal → Prompt → Acceptance criteria → Commit message**.

### Phase 1: Scaffold and GitHub Pages deployment
**Model:** Sonnet-class

**Prompt**
```
Scaffold the project:
1. Create an Astro project (minimal template, TypeScript strict) and add Tailwind.
2. Configure astro.config.mjs with `site: 'https://<GITHUB_USER>.github.io'` and
   `base: '/<REPO_NAME>'`, read from env vars with sensible fallbacks, documented
   in the README.
3. Add .github/workflows/deploy.yml using the official `withastro/action` and
   `actions/deploy-pages`, triggered on push to main and workflow_dispatch, with
   `pages: write` and `id-token: write` permissions.
4. Add public/.nojekyll and robots.txt. Move the provided brand files from
   docs/brand/ into public/ (keep file names). Wire up the real favicon
   (favicon.ico), apple-touch-icon (trillian-logo-180.png) and a
   site.webmanifest using the 192 and 512 icons. All icon hrefs must use the
   base path.
5. Add a README: local dev commands, how to enable Pages
   (Settings > Pages > Source: GitHub Actions), how to change base/site.
6. Add ESLint + Prettier (with astro plugin) and an `npm run check` script
   (astro check + lint).
```
**Acceptance:** `npm run build` passes; `npm run preview` serves under the base path with no broken asset links (including favicon, apple-touch icon and manifest); `npm run check` passes.
**Commit:** `chore: scaffold astro + pages deploy`

---

### Phase 2: Data model and scoring engine
**Model:** strongest reasoning model available

**Prompt**
```
Implement the data layer and scoring logic. Make it pure, typed, unit-tested.

Data (src/data, validated at build time with Zod):
- pilots.json: id, name, number (1-4), color, initials
  (Emídio #1, P. Queirós #2, Joel #3, Dinis #4).
- races.json: 7 GPs per docs/rules.md section 3 (id, circuit, type Indoor|Outdoor,
  location, optional date, optional timesheetUrl, status: scheduled|next|completed).
- results.json: per GP, per pilot: { attended: boolean, avgLapTime (seconds,
  nullable), bestLap, secondBestLap }. Absent pilots have attended:false and no
  times. Start with all GPs scheduled and empty.

Scoring engine (src/lib/scoring.ts), per docs/rules.md sections 5-7:
- Rank attendees by avgLapTime ascending. Points: 1st=8, 2nd=6, 3rd=4, 4th=0.
  Absent = 0.
- Fastest-lap bonus: +4 to the pilot with the lowest bestLap in the session.
- Session tie-break on equal avg time: better bestLap, then secondBestLap.
- Championship tie-break: more wins, then more fastest laps, then fewer absences.
- Output: per-GP results with points breakdown (position pts, VR bonus) and
  overall standings (total, wins, fastest laps, absences, per-GP points array).

AMBIGUITY, DO NOT SILENTLY DECIDE: the rules don't say how positions are awarded
when someone is absent (with 3 attendees: 8/6/4 or 8/6/0?). Add one constant
`ABSENCE_RANKING_MODE` ('compact' = attendees take the top positions in order;
'fixed' = positions keep the 4-pilot table), default 'compact', documented in
the README.

Write Vitest tests: normal race, fastest-lap bonus on a non-winner, absence,
session tie, championship tie-break chain, empty season (all zero, no crash).
Use a fixture for tests only, never in production data.
```
**Acceptance:** `npm test` green; both `ABSENCE_RANKING_MODE` values are tested; production `results.json` contains no fake data.
**Commit:** `feat: data model and scoring engine with tests`

---

### Phase 3: Design system and layout shell
**Model:** Sonnet-class

**Prompt**
```
Build the design system and shell:
1. Tailwind theme tokens: background #0d1117, surface/elevated/border variants,
   text primary/muted. Brand accents from the Trillian logo: blue #0f4174,
   yellow #e9be00, green #19833c, ring #82b07a (adjust lightness where needed
   to hit WCAG AA on #0d1117). Pilot colors from pilots.json, chosen so they do
   not clash with the brand accents.
   Display font for headings, tabular-figures font for times/points. Self-host
   fonts (no external CDNs), font-display: swap, preload the critical weight.
2. BaseLayout.astro: meta tags, canonical URL from site+base, Open Graph/Twitter
   cards, theme-color, skip-to-content link, <html lang="pt-PT">.
3. Sticky Navbar: "Kart Cup 2026" brand with trophy icon + anchors
   (Classificação, Calendário, Pilotos, Patrocinador, Regulamento). Mobile:
   accessible disclosure menu, no JS framework. Active section highlighting via
   IntersectionObserver (progressive enhancement).
4. Footer: copyright, quick links, small Trillian logo (trillian-logo-64.png,
   with width/height set) and "Com o apoio técnico da Trillian Driving Coach"
   linking to the app website.
5. Primitives: Section (eyebrow + title + anchor id), Card, Badge, Button
   (primary/secondary/green), all with visible focus states.
6. Subtle racing motifs (checkered divider, speed-line gradient), CSS-only,
   disabled under prefers-reduced-motion.
```
**Acceptance:** Keyboard-only navigation works; mobile menu usable at 360px; no external network requests for fonts.
**Commit:** `feat: design system and layout shell`

---

### Phase 4: Hero / sponsor section
**Model:** Sonnet-class

**Prompt**
```
Build the Hero (docs/layout.md section 3A) under the navbar:
- Badge "Patrocinador Oficial".
- H1: "Melhora as tuas voltas com a Trillian Driving Coach".
- Polished pt-PT subcopy: official championship assistant focused on telemetry
  analysis and driving improvement.
- CTAs: green "Download na Play Store" ->
  https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian
  and secondary "Visitar Website" -> https://emidiofaria.github.io/Trillian-website/
  Both new tab, rel="noopener noreferrer", descriptive aria-labels.
- Visual: the real Trillian logo (public/trillian-logo-512.webp with PNG
  fallback via <picture>, explicit width/height, alt="Logótipo Trillian Driving
  Coach", eager-loaded since it is above the fold) inside a decorative gradient
  ring built from brand blue/green/yellow, with a soft glow. Only the outer
  ring may animate (slow rotation, disabled for reduced motion); the logo itself
  never rotates, scales unevenly or gets recolored.
- Below: compact chips for "next GP" (races.json status 'next') and current
  leader from the scoring engine (hidden if no results yet).
Responsive: stacked on mobile, two columns at >= lg.
```
**Acceptance:** Chips render from data; leader chip hidden with empty results; links correct.
**Commit:** `feat: hero and sponsor section`

---

### Phase 5: Standings table
**Model:** Sonnet-class

**Prompt**
```
Build the Standings section (docs/layout.md section 3B), fed only by the scoring engine:
- Header with checkered-flag icon, "Classificação Geral", "4 Pilotos".
- Columns: Pos, Piloto (colored avatar + name), Pontos Totais, GP1..GP7. Cells
  show GP points; "—" for GPs not yet run; "F" (falta) styled distinctly for
  absences; small "VR" marker with accessible text where the fastest-lap bonus
  was earned.
- Leader row gets a "Líder" badge and yellow total. No leader before any GP is
  completed: show "A temporada ainda não começou".
- Footnote: "+4 pontos pela volta mais rápida (VR) da sessão".
- Accessibility: real <table> with <caption>, scope attributes, sticky first
  column, horizontal scroll on mobile with a visible scroll hint, never color
  alone for meaning.
- Collapsible "Critérios de desempate" summarizing docs/rules.md section 7.
```
**Acceptance:** Renders correctly with empty data and with the test fixture.
**Commit:** `feat: standings table`

---

### Phase 6: Calendar, pilots, rules, sponsor block
**Model:** Sonnet-class

**Prompt**
```
Build the remaining sections:

Calendário (3C): responsive card grid of 7 GPs from races.json. Each card: GP
number, Indoor/Outdoor badge (distinct color + icon), circuit, location, status
badge (Próximo GP / Agendado / Concluído), optional date. Completed cards expand
(native <details>) to show podium, average times, best laps, VR winner, and the
timesheet link if present.

Pilotos (3D): 4 cards with circular initials avatar in the pilot color, name,
number (#1-#4), and live stats from the engine (points, wins, VR, absences).
2x2 / 4x1 grid.

Regulamento (3E + rules): summary box with scoring as a clean points table
(8/6/4/0, falta = 0, VR +4) plus native <details> accordion with full rules:
format (10-min free session, random kart draw, ranking by average lap time),
absences, tie-breakers, conduct and transparency (timesheet shared in the group
after each session). pt-PT, faithful to docs/rules.md, no invented rules.

Patrocinador: compact block (#patrocinador) with trillian-logo-192.png, a short
pt-PT description and the same CTAs as the hero. Optionally add a small "Obter
no Google Play" style button using plain text/SVG, not Google's badge artwork
unless the official badge is supplied.
```
**Acceptance:** All nav anchors scroll to a section; copy matches `docs/rules.md`.
**Commit:** `feat: calendar, pilots, rules and sponsor sections`

---

### Phase 7: Results entry workflow
**Model:** Sonnet-class

**Prompt**
```
No backend exists, so make updating results safe and easy:
1. `npm run add-result`: interactive Node CLI (e.g. @clack/prompts) asking for
   GP, each pilot's attendance, avg lap, best lap, second-best lap. Validate
   formats (52.341 or 0:52.341). Write results.json, mark the GP completed, set
   the next scheduled GP to 'next'.
2. Validation step (Zod) in `npm run check` and CI that fails if results.json is
   inconsistent (bestLap > avgLap, duplicate pilots, missing attendance).
3. README: run script -> commit -> push -> Action redeploys.
4. GitHub issue template "Submeter resultados do GP" as optional alternative.
```
**Acceptance:** Entering a fake GP via the CLI updates standings; bad input is rejected; CI fails on invalid data. Revert the fake GP afterwards.
**Commit:** `feat: results entry cli and validation`

---

### Phase 8: Polish, SEO, accessibility, QA
**Model:** Sonnet-class

**Prompt**
```
Final hardening pass:
- SEO: @astrojs/sitemap, structured data (SportsEvent per GP), static
  1200x630 OG image (dark #0d1117 background, Trillian logo from
  trillian-logo-512.png, "Kart Cup 2026" title, checkered accent), pt-PT meta
  descriptions.
- Performance: no layout shift, image dimensions set, fonts preloaded, no
  unnecessary JS. Add Lighthouse CI to the workflow (warn if < 95).
- Accessibility: axe via @axe-core/playwright against the built site in CI; fix
  serious/critical issues. Verify keyboard-only navigation.
- Playwright smoke tests: all anchors resolve, base-path links work in
  `astro preview`, standings render with fixture and with empty data.
- 404.astro in the same style.
- README final checklist: Pages enabled, base/site env set, optional custom
  domain (and how base changes).
Report a short summary of Lighthouse and axe results at the end.
```
**Acceptance:** CI green; Lighthouse >= 95; zero serious/critical axe issues.
**Commit:** `chore: seo, a11y and qa hardening`

---

## 3. Decisions to make before starting

1. **Absent-pilot scoring.** Do attendees move up when someone is missing (`compact`) or keep the fixed 4-pilot table (`fixed`)? Settle with the group, then set the constant.
2. **Repo name.** `<user>.github.io` gives base `/`; any other name gives `/<repo>/`.
3. **Trillian logo.** Done: the real logo is supplied and prepared in `assets/`. Optional: provide a vector (SVG) version if you have one, for sharper rendering at large sizes. The helmet design strongly resembles a well-known real-world driver's livery; since it is your own app's logo this is your call, but keep that in mind if the site or app ever becomes commercial.
4. **Spec cleanup.** Remove the stray `[cite: 1]` from `docs/layout.md` before starting.
5. **Season dates.** Add GP dates to `races.json` once agreed.

## 4. Definition of done
- Site live at the GitHub Pages URL, all 7 GPs listed, standings computed from data.
- Scoring engine matches `docs/rules.md` with passing unit tests.
- Adding a result takes one command plus a push.
- Lighthouse >= 95, axe clean, keyboard accessible, pt-PT throughout.
