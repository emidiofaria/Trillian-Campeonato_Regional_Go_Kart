import { expect, test } from '@playwright/test';

const PLAY = 'https://play.google.com/store/apps/details?id=io.github.emidiofaria.trillian';
const SITE = 'https://emidiofaria.github.io/Trillian-website/';
const FIXTURE = process.env.KARTCUP_FIXTURE === '1';

test('hero has the sponsor heading and CTAs with safe external links', async ({ page }) => {
  await page.goto('./');
  // The next-GP banner owns the h1 while the season is running; the sponsor title is an h2.
  await expect(page.locator('#hero-titulo')).toHaveText(
    /Melhora as tuas voltas com a\s+Trillian Driving Coach/,
  );
  await expect(page.locator('#hero-titulo')).toHaveJSProperty('tagName', 'H2');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveAttribute('id', 'proximo-gp-titulo');
  for (const [name, href] of [
    [/^Download na Play Store/, PLAY],
    [/^Visitar Website da Trillian/, SITE],
  ] as const) {
    const link = page.getByRole('link', { name }).first();
    await expect(link).toHaveAttribute('href', href);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
});

test('hero logo is the real asset, eager, with dimensions and alt text', async ({ page }) => {
  await page.goto('./');
  const hero = page.locator('section[aria-labelledby="hero-titulo"]');
  const img = hero.locator('picture img');
  await expect(img).toHaveAttribute('alt', 'Logótipo Trillian Driving Coach');
  await expect(img).toHaveAttribute('loading', 'eager');
  await expect(img).toHaveAttribute('width', '512');
  await expect(img).toHaveAttribute('height', '512');
  await expect(hero.locator('picture source[type="image/webp"]')).toHaveAttribute(
    'srcset',
    /trillian-logo-400\.webp 400w, .*trillian-logo\.webp 512w$/,
  );
  await expect(img).toHaveJSProperty('complete', true);
  expect(await img.evaluate((el: HTMLImageElement) => el.currentSrc)).toMatch(
    /trillian-logo(-400)?\.webp$/,
  );
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
});

test('labelled links include their visible text in the accessible name (WCAG 2.5.3)', async ({
  page,
}) => {
  await page.goto('./');
  const mismatches = await page.locator('a[aria-label]').evaluateAll((links) =>
    links
      .map((a) => ({
        label: (a.getAttribute('aria-label') ?? '').toLowerCase(),
        text: (a.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase(),
      }))
      .filter(({ label, text }) => text && !label.includes(text)),
  );
  expect(mismatches).toEqual([]);
});

test('hero has no next-GP chip; leader chip depends on results', async ({ page }) => {
  await page.goto('./');
  const hero = page.locator('section[aria-labelledby="hero-titulo"]');
  await expect(hero.getByText('Próximo GP')).toHaveCount(0);
  if (FIXTURE) {
    await expect(page.getByTestId('leader-chip')).toContainText('Emídio');
  } else {
    await expect(page.getByTestId('leader-chip')).toHaveCount(0);
    await expect(page.getByLabel('Destaques do campeonato')).toHaveCount(0);
  }
});
