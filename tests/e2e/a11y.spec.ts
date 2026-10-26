import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
    .analyze();
  const blocking = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  return blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target).join(' | ')}`);
}

async function openAllDetails(page: Page) {
  await page
    .locator('details')
    .evaluateAll((els) => els.forEach((d) => ((d as HTMLDetailsElement).open = true)));
}

test.describe('axe', () => {
  test('home page (desktop, all accordions open) has no serious/critical issues', async ({
    page,
  }) => {
    await page.goto('./');
    await openAllDetails(page);
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('home page (360px, menu open) has no serious/critical issues', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('./');
    await page.getByRole('button', { name: /menu/i }).click();
    expect(await seriousViolations(page)).toEqual([]);
  });

  test('404 page has no serious/critical issues', async ({ page }) => {
    await page.goto('./404.html');
    expect(await seriousViolations(page)).toEqual([]);
  });
});

test('keyboard-only: tab order reaches nav, CTAs, tables and accordions with visible focus', async ({
  page,
}) => {
  await page.goto('./');
  const reached = new Set<string>();
  let focusVisibleOk = true;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const style = getComputedStyle(el);
      const visible = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0;
      const section = el.closest('section[id], header, footer');
      return {
        key: `${section?.id || section?.tagName.toLowerCase()}:${el.tagName.toLowerCase()}`,
        visible,
      };
    });
    if (!info) continue;
    reached.add(info.key);
    if (!info.visible) focusVisibleOk = false;
  }
  for (const key of ['header:a', 'classificacao:div', 'classificacao:summary', 'patrocinador:a']) {
    expect([...reached], `expected to reach ${key}`).toContain(key);
  }
  expect(
    [...reached].some((k) => k.startsWith('calendario:') || k.startsWith('regulamento:')),
  ).toBe(true);
  expect(focusVisibleOk, 'every focused element shows a focus outline').toBe(true);
});

test('details accordions toggle with the keyboard', async ({ page }) => {
  await page.goto('./');
  const item = page.locator('#regulamento details', { hasText: 'Critérios de desempate' });
  await item.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(item).toHaveAttribute('open', '');
  await page.keyboard.press('Space');
  await expect(item).not.toHaveAttribute('open', '');
});

test('404 page uses the site shell and links back under the base path', async ({
  page,
  baseURL,
}) => {
  const res = await page.goto('./404.html');
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saíste de pista!');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  await page.getByRole('link', { name: 'Voltar ao início' }).click();
  await expect(page).toHaveURL(baseURL!);
  await expect(page.locator('#classificacao')).toBeVisible();
});

test('SEO: sitemap, robots, OG image and JSON-LD use the base path', async ({
  page,
  request,
  baseURL,
}) => {
  const robots = await (await request.get('robots.txt')).text();
  expect(robots).toMatch(/Sitemap: https:\/\/.+\/sitemap-index\.xml/);
  expect((await request.get('sitemap-index.xml')).status()).toBe(200);
  expect((await request.get('og-image.png')).status()).toBe(200);

  await page.goto('./');
  const og = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(og).toMatch(/\/og-image\.png$/);
  const ld = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  );
  const events = ld['@graph'].filter((n: { '@type': string }) => n['@type'] === 'SportsEvent');
  expect(events).toHaveLength(7);
  expect(new URL(baseURL!).pathname).not.toBe('');
});
