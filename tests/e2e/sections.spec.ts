import { expect, test } from '@playwright/test';

import { FIXTURE, N, lapPoints, pilots, positionPoints } from './season';

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
  await expect(page.locator('#gp7')).toContainText('Indoor');
  await expect(page.locator('#gp3')).toContainText('Outdoor');
  if (!FIXTURE) {
    await expect(page.locator('#gp2')).toContainText('Kartódromo Indoor de Matosinhos');
    await expect(page.locator('#gp2')).toContainText('dezembro de 2026');
    await expect(page.locator('#gp6')).toContainText('Kartódromo de Baltar');
  }
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
    await expect(banner.getByTestId('start-grid').locator('li')).toHaveText([
      /1\.º[\s\S]*Torres/,
      /2\.º[\s\S]*Joel/,
      /3\.º[\s\S]*Dinis/,
      /4\.º[\s\S]*P\. Queirós/,
      /5\.º[\s\S]*Emídio/,
    ]);
  } else {
    await expect(banner).toContainText('Kartódromo Indoor de Matosinhos');
    await expect(banner).toContainText('Matosinhos');
    await expect(banner).toContainText('Indoor');
    await expect(banner).toContainText('dezembro de 2026 · dia a anunciar');
    await expect(banner.getByTestId('start-grid')).toContainText('Grelha de partida');
    await expect(banner.getByTestId('start-grid').locator('li')).toHaveText([
      /1\.º[\s\S]*Joel/,
      /2\.º[\s\S]*P\. Queirós/,
      /3\.º[\s\S]*P\. Oliveira/,
      /4\.º[\s\S]*Torres/,
      /5\.º[\s\S]*Dinis/,
      /6\.º[\s\S]*Emídio/,
    ]);
    await expect(countdown).toHaveCount(0);
  }
});

test('rules intro shows the convivio photo with alt text', async ({ page }) => {
  await page.goto('./');
  const img = page.locator('#regulamento details').first().locator('img');
  await expect(img).toHaveAttribute('alt', /convívio/);
  await expect(img).toHaveAttribute('loading', 'lazy');
});

test('pilot cards show every pilot with numbers and stats', async ({ page }) => {
  await page.goto('./');
  const cards = page.locator('#pilotos li.pilot-card');
  await expect(cards).toHaveCount(N);
  await expect(cards.locator('h3')).toHaveText(pilots.map((p) => p.name));
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
  await expect(table.locator('tbody th[scope="row"]')).toHaveText([
    ...positionPoints.map((_, i) => `${i + 1}.º`),
    'Falta',
  ]);
  await expect(table.locator('tbody td:nth-child(2)')).toHaveText([
    ...positionPoints.map((pts) => `${pts} pts`),
    '0 pts',
  ]);
  await expect(table.locator('tbody td:last-child')).toHaveText([
    ...lapPoints.map((pts) => `${pts} pts`),
    '0 pts',
  ]);
  await expect(page.locator('#regulamento')).toContainText(
    `soma ${positionPoints[0]} + ${lapPoints[0]} = ${positionPoints[0] + lapPoints[0]} pontos`,
  );
  await expect(table).toContainText('Falta');
  await expect(page.locator('#regulamento details')).toHaveCount(7);
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

test.describe('production season', () => {
  test.skip(FIXTURE, 'production data only');
  test('GP1 results in the calendar and pilot stats', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('#calendario details')).toHaveCount(1);
    const gp1 = page.locator('#gp1');
    await expect(gp1).toContainText('Concluído');
    await gp1.locator('summary').click();
    await expect(gp1.locator('tbody tr')).toHaveCount(N);
    await expect(gp1.locator('tbody tr').last()).toContainText('6.º');
    await expect(page.locator('[data-pilot="emidio"] dd')).toHaveText(['18', '1', '1', '0']);
  });

  test('results section shows GP1 classification, highlights and rankings', async ({ page }) => {
    await page.goto('./');
    const section = page.locator('section#resultados');
    await expect(section.getByRole('tab')).toHaveText([/GP1/]);
    const panel = section.locator('#resultados-gp1');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h3').first()).toContainText('GP1 · Kartódromo Cabo do Mundo');
    await expect(panel).toContainText('Sessão 23');
    const highlights = panel.getByTestId('gp-highlights');
    await expect(highlights.locator('dt')).toHaveText([
      'Vencedor',
      'Volta mais rápida',
      'Velocidade máxima',
      'Mais consistente',
    ]);
    await expect(highlights).toContainText('48.81 km/h');
    await expect(highlights).toContainText('σ 1.802 s');

    const rows = panel.locator('table tbody tr');
    await expect(rows).toHaveCount(N);
    await expect(rows.first()).toContainText('1:02.769');
    await expect(rows.first().getByTestId('points-breakdown')).toContainText('12 + 6');
    await expect(rows.nth(1).getByTestId('points-breakdown')).toContainText('10 + 2');
    await expect(rows.nth(1)).toContainText('+0.259');
    await expect(
      section.locator('section[aria-label="Ranking: Consistência"] li').first(),
    ).toContainText('Torres');
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
    await expect(gp1.locator('tbody tr')).toHaveCount(5);
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

  test('results tabs: newest GP first, keyboard navigation and deep links', async ({ page }) => {
    await page.goto('./');
    const section = page.locator('section#resultados');
    const tabs = section.getByRole('tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await expect(section.getByRole('tabpanel')).toHaveCount(1);
    await expect(section.locator('#resultados-gp3')).toBeVisible();
    await expect(section.locator('#resultados-gp1')).toBeHidden();

    await tabs.nth(2).focus();
    await page.keyboard.press('Home');
    await expect(tabs.first()).toBeFocused();
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
    await expect(section.locator('#resultados-gp1')).toBeVisible();
    await page.keyboard.press('ArrowLeft');
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await tabs.nth(1).click();
    await expect(section.locator('#resultados-gp2')).toBeVisible();

    await page.goto('./#resultados-gp1');
    await expect(section.locator('#resultados-gp1')).toBeVisible();
    await expect(section.locator('#resultados-gp3')).toBeHidden();

    await page.goto('./');
    await page.locator('#gp2 summary').click();
    await page
      .locator('#gp2')
      .getByRole('link', { name: /Relatório completo/ })
      .click();
    await expect(section.locator('#resultados-gp2')).toBeVisible();
    await expect(section.locator('#resultados-gp2')).toBeInViewport();
  });

  test('pilot stats come from the engine', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('[data-pilot="emidio"] dd')).toHaveText(['40', '2', '0', '0']);
    await expect(page.locator('[data-pilot="joel"] dd').nth(3)).toHaveText('1');
    await expect(page.locator('[data-pilot="torres"] dd')).toHaveText(['9', '0', '0', '1']);
  });
});
