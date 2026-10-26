# AGENTS.md — Project Context

You are building the official website for "Kart Cup 2026", a friends' rental-kart
championship (pilots: Emídio, P. Queirós, Joel, Dinis). Source specs are in
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
  Play Store:  https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian
- Do not run git push. Do not install dependencies not needed for the task.

Work in small, reviewable steps. At the end of each task, report what changed
and the exact commands to verify it.
