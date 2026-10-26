// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

// Override with SITE_URL / BASE_PATH env vars (e.g. custom domain => BASE_PATH=/).
const site = process.env.SITE_URL ?? 'https://emidiofaria.github.io';
const base = process.env.BASE_PATH ?? '/Trillian-Campeonato_Regional_Go_Kart';

// Test-only builds with tests/fixtures/season.json go to a separate folder (never deployed).
const fixture = process.env.KARTCUP_FIXTURE === '1';

export default defineConfig({
  site,
  base,
  outDir: fixture ? './dist-fixture' : './dist',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    // Keep only canonical (trailing-slash) URLs; the 404 page is not indexable.
    sitemap({ filter: (page) => page.endsWith('/') && !page.includes('/404') }),
  ],
});
