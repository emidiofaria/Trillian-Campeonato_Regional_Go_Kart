// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

// Override with SITE_URL / BASE_PATH env vars (e.g. custom domain => BASE_PATH=/).
const site = process.env.SITE_URL ?? 'https://emidiofaria.github.io';
const base = process.env.BASE_PATH ?? '/Trillian-Campeonato_Regional_Go_Kart';

export default defineConfig({
  site,
  base,
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [tailwind({ applyBaseStyles: false })],
});
