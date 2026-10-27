import { expect, test } from '@playwright/test';

const FIXTURE = process.env.KARTCUP_FIXTURE === '1';

test('standings table is accessible and lists 4 pilots and 7 GPs', async ({ page }) => {
  await page.goto('./');
  const table = page.locator('#classificacao table');
  await expect(table.locator('caption')).toHaveCount(1);
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(10);
  await expect(table.locator('tbody th[scope="row"]')).toHaveCount(4);
  await expect(page.locator('#classificacao [role="region"][tabindex="0"]')).toHaveCount(1);
});

test.describe('empty season', () => {
  test.skip(FIXTURE, 'production data only');

  test('shows not-started message, no leader, all GPs not run', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('season-not-started')).toContainText(
      'A temporada ainda não começou',
    );
    await expect(page.locator('#classificacao').getByText('Líder')).toHaveCount(0);
    await expect(page.locator('#classificacao tbody').getByText('Não realizado')).toHaveCount(28);
  });
});

test.describe('fixture season', () => {
  test.skip(!FIXTURE, 'fixture data only');

  test('orders pilots by computed standings and marks leader, VR and absences', async ({
    page,
  }) => {
    await page.goto('./');
    const rows = page.locator('#classificacao tbody tr');
    await expect(rows.locator('th[scope="row"]')).toHaveText([
      /Emídio/,
      /P\. Queirós/,
      /Dinis/,
      /Joel/,
    ]);
    const leader = rows.first();
    await expect(leader).toContainText('Líder');
    await expect(leader.locator('td').nth(1)).toHaveText('16');

    const pq = page.locator('tr[data-pilot="p-queiros"] td');
    await expect(pq.nth(2)).toContainText('7');
    await expect(pq.nth(2)).toContainText('bónus pela volta mais rápida');

    const joel = page.locator('tr[data-pilot="joel"] td');
    await expect(joel.nth(3)).toContainText('Falta, 0 pontos');
    await expect(joel.nth(5)).toContainText('Não realizado');
    await expect(page.getByTestId('season-not-started')).toHaveCount(0);
  });
});
