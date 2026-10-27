import { expect, test } from '@playwright/test';

const FIXTURE = process.env.KARTCUP_FIXTURE === '1';

test('every nav anchor resolves to a section on the page', async ({ page }) => {
  await page.goto('./');
  const hrefs = await page
    .locator('header nav a[href*="#"]')
    .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).hash));
  expect(hrefs.length).toBeGreaterThanOrEqual(5);
  for (const hash of new Set(hrefs)) {
    await expect(page.locator(`section${hash}`)).toHaveCount(1);
  }
});

test('calendar lists the 7 official GPs with type badges and ids', async ({ page }) => {
  await page.goto('./');
  const cards = page.locator('#calendario li.gp-card');
  await expect(cards).toHaveCount(7);
  for (let i = 1; i <= 7; i++) await expect(page.locator(`#gp${i}`)).toHaveCount(1);
  await expect(page.locator('#gp1')).toContainText('Cabo do Mundo');
  await expect(page.locator('#gp7')).toContainText('Famalicão');
  await expect(page.locator('#gp6')).toContainText('Indoor');
  await expect(page.locator('#gp2')).toContainText('Outdoor');
  await expect(page.locator('#calendario').getByText('Próximo GP')).toHaveCount(1);
});

test('next-GP banner is the first section and links to its calendar card', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00Z'));
  await page.goto('./');
  const banner = page.getByTestId('next-gp');
  await expect(banner).toBeVisible();
  const order = await page.evaluate(() =>
    [...document.querySelectorAll('main > section')].map(
      (s) => s.id || s.getAttribute('aria-labelledby'),
    ),
  );
  expect(order.slice(0, 3)).toEqual(['proximo-gp', 'hero-titulo', 'classificacao']);
  await expect(banner.getByRole('heading', { level: 1 })).toBeVisible();

  const photo = banner.locator('img');
  await expect(photo).toHaveAttribute('alt', '');
  await expect(photo).toHaveAttribute('loading', 'eager');
  await expect(photo).toHaveAttribute('fetchpriority', 'high');

  const hash = await banner
    .getByRole('link', { name: 'Ver no calendário' })
    .evaluate((a) => (a as HTMLAnchorElement).hash);
  const card = page.locator(`#calendario ${hash}`);
  await expect(card).toHaveCount(1);
  await expect(card).toHaveAttribute('data-status', 'next');

  const countdown = page.getByTestId('next-gp-countdown');
  if (FIXTURE) {
    await expect(banner).toContainText('Kartódromo Internacional de Braga');
    await expect(banner).toContainText('Data a anunciar');
    await expect(countdown).toHaveCount(0);
  } else {
    await expect(banner).toContainText('Kartódromo Cabo do Mundo');
    await expect(banner).toContainText('Matosinhos');
    await expect(banner).toContainText('Outdoor');
    await expect(banner).toContainText('7 de novembro de 2026');
    await expect(countdown).toHaveText('Faltam 11 dias');
  }
});

test('rules intro shows the convivio photo with alt text', async ({ page }) => {
  await page.goto('./');
  const img = page.locator('#regulamento details').first().locator('img');
  await expect(img).toHaveAttribute('alt', /convívio/);
  await expect(img).toHaveAttribute('loading', 'lazy');
});

test('pilot cards show 4 pilots with numbers and stats', async ({ page }) => {
  await page.goto('./');
  const cards = page.locator('#pilotos li.pilot-card');
  await expect(cards).toHaveCount(4);
  await expect(cards.locator('h3')).toHaveText(['Emídio', 'P. Queirós', 'Joel', 'Dinis']);
  await expect(cards.first()).toContainText('#1');
  await expect(cards.first().locator('dt')).toHaveText([
    'Pontos',
    'Vitórias',
    'Voltas rápidas',
    'Faltas',
  ]);
});

test('rules show points table and the full accordion', async ({ page }) => {
  await page.goto('./');
  const table = page.getByTestId('points-table');
  await expect(table).toContainText('6 pts');
  await expect(table).toContainText('4 pts');
  await expect(table).toContainText('2 pts');
  await expect(table).toContainText('+3 pts');
  await expect(table).not.toContainText('8 pts');
  await expect(page.locator('#regulamento')).toContainText('soma 6 + 3 = 9 pontos');
  await expect(table).toContainText('Falta');
  await expect(page.locator('#regulamento details')).toHaveCount(6);
  const conduct = page.locator('#regulamento details', { hasText: 'Conduta e transparência' });
  await conduct.locator('summary').click();
  await expect(conduct).toContainText('folha de tempos oficial do kartódromo');
});

test('sponsor block has logo and external CTAs', async ({ page }) => {
  await page.goto('./');
  const block = page.locator('#patrocinador');
  await expect(block.locator('img[src$="trillian-logo-192.png"]')).toHaveCount(1);
  const links = block.locator('a[target="_blank"]');
  await expect(links).toHaveCount(2);
  for (const rel of await links.evaluateAll((as) => as.map((a) => a.getAttribute('rel'))))
    expect(rel).toContain('noopener');
  await expect(block.getByRole('link', { name: /Google Play/ })).toHaveAttribute(
    'href',
    /play\.google\.com/,
  );
});

test.describe('empty season', () => {
  test.skip(FIXTURE, 'production data only');
  test('no results details and all stats at zero', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#calendario details')).toHaveCount(0);
    await expect(page.locator('#calendario').getByText('Concluído')).toHaveCount(0);
    await expect(page.locator('#pilotos dd')).toHaveText(Array(16).fill('0'));
  });
});

test.describe('fixture season', () => {
  test.skip(!FIXTURE, 'fixture data only');
  test('completed GPs expand to show results, VR and timesheet', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#calendario details')).toHaveCount(3);
    const gp1 = page.locator('#gp1');
    await expect(gp1).toContainText('Concluído');
    await gp1.locator('summary').click();
    await expect(gp1.locator('tbody tr')).toHaveCount(4);
    await expect(gp1).toContainText('Volta mais rápida');
    await expect(gp1).toContainText('P. Queirós');
    await expect(gp1.getByRole('link', { name: /Folha de tempos/ })).toHaveAttribute(
      'target',
      '_blank',
    );
    const gp2 = page.locator('#gp2');
    await gp2.locator('summary').click();
    await expect(gp2.locator('tbody')).toContainText('Falta');
    await expect(page.locator('#gp4')).toContainText('Próximo GP');
  });

  test('pilot stats come from the engine', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('[data-pilot="emidio"] dd')).toHaveText(['16', '2', '0', '0']);
    await expect(page.locator('[data-pilot="joel"] dd').nth(3)).toHaveText('1');
  });
});
