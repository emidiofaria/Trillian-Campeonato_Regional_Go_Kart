import { defineConfig, devices } from '@playwright/test';

const FIXTURE = process.env.KARTCUP_FIXTURE === '1';
const PORT = FIXTURE ? 4322 : 4321;
const BASE_PATH = (process.env.BASE_PATH ?? '/Trillian-Campeonato_Regional_Go_Kart').replace(
  /\/?$/,
  '/',
);

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}${BASE_PATH}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}${BASE_PATH}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
