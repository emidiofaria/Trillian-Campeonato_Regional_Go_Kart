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
