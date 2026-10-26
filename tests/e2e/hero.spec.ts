import { expect, test } from '@playwright/test';

const PLAY = 'https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian';
const SITE = 'https://emidiofaria.github.io/Trillian-website/';
const FIXTURE = process.env.KARTCUP_FIXTURE === '1';

test('hero has the sponsor heading and CTAs with safe external links', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Melhora as tuas voltas com a\s+Trillian Driving Coach/,
  );
  await expect(page.locator('h1')).toHaveCount(1);
  for (const [name, href] of [
    [/Download da app .* Play Store/, PLAY],
    [/Visitar o website da Trillian/, SITE],
  ] as const) {
    const link = page.getByRole('link', { name }).first();
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('hero logo is the real asset, eager, with dimensions and alt text', async ({ page }) => {
  await page.goto('./');
  const img = page.locator('picture img');
  await expect(img).toHaveAttribute('alt', 'Logótipo Trillian Driving Coach');
  await expect(img).toHaveAttribute('loading', 'eager');
  await expect(img).toHaveAttribute('width', '512');
  await expect(img).toHaveAttribute('height', '512');
  await expect(page.locator('picture source[type="image/webp"]')).toHaveAttribute(
    'srcset',
    /trillian-logo\.webp$/,
  );
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(512);
});

test('next GP chip renders from data; leader chip depends on results', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByText('Próximo GP', { exact: true })).toBeVisible();
  if (FIXTURE) {
    await expect(page.getByTestId('leader-chip')).toContainText('Emídio');
  } else {
    await expect(page.getByText('GP 1 · Kartódromo Cabo do Mundo')).toBeVisible();
    await expect(page.getByTestId('leader-chip')).toHaveCount(0);
  }
});
