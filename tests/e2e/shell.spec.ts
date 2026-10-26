import { expect, test } from '@playwright/test';

const SECTIONS = ['classificacao', 'calendario', 'pilotos', 'patrocinador', 'regulamento'];

test('has pt-PT lang, title and no external network requests', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    const url = new URL(req.url());
    if (url.hostname !== 'localhost') external.push(req.url());
  });
  await page.goto('./');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-PT');
  await expect(page).toHaveTitle(/Kart Cup 2026/);
  await page.waitForLoadState('networkidle');
  expect(external).toEqual([]);
  expect(baseURL).toBeTruthy();
});

test('fonts, icons and manifest load under the base path', async ({ page, request }) => {
  await page.goto('./');
  const hrefs = await page
    .locator(
      'link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], link[rel="preload"]',
    )
    .evaluateAll((els) => els.map((el) => (el as HTMLLinkElement).href));
  expect(hrefs.length).toBeGreaterThanOrEqual(6);
  for (const href of hrefs) {
    const res = await request.get(href);
    expect(res.status(), href).toBe(200);
  }
  await page.evaluate(() => document.fonts.ready);
  const loaded = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((f) => f.status === 'loaded')
      .map((f) => f.family),
  );
  expect(loaded.join(',')).toContain('Inter Variable');
});

test('all nav anchors resolve to a section', async ({ page }) => {
  await page.goto('./');
  for (const id of SECTIONS) {
    await expect(page.locator(`section#${id}`)).toHaveCount(1);
    await expect(
      page.locator(`nav[aria-label="Navegação principal"] a[href$="#${id}"]`),
    ).toHaveCount(1);
  }
});

test('skip link is the first focusable element and moves focus to main', async ({ page }) => {
  await page.goto('./');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Saltar para o conteúdo' });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#conteudo$/);
});

test.describe('mobile (360px)', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('disclosure menu is keyboard operable and page has no horizontal overflow', async ({
    page,
  }) => {
    await page.goto('./');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    const toggle = page.getByRole('button', { name: 'Abrir menu' });
    const menuLink = page.locator('#nav-menu a', { hasText: 'Pilotos' });
    await expect(toggle).toBeVisible();
    await expect(menuLink).toBeHidden();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Fechar menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await expect(menuLink).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(menuLink).toBeHidden();
    await expect(page.getByRole('button', { name: 'Abrir menu' })).toBeFocused();

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    await menuLink.click();
    await expect(page).toHaveURL(/#pilotos$/);
    await expect(menuLink).toBeHidden();
  });
});

test.describe('reduced motion', () => {
  test('speed-line animation is disabled', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('./');
    const anim = await page
      .locator('.speed-lines')
      .first()
      .evaluate((el) => getComputedStyle(el, '::before').animationName);
    expect(anim).toBe('none');
  });
});
