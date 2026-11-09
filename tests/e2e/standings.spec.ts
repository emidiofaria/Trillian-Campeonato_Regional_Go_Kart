import { expect, test } from '@playwright/test';

import { FIXTURE, N } from './season';

test('standings table is accessible and lists every pilot and 7 GPs', async ({ page }) => {
  await page.goto('./');
  const table = page.locator('#classificacao table');
  await expect(table.locator('caption')).toHaveCount(1);
  await expect(table.locator('thead th[scope="col"]')).toHaveCount(12);
  await expect(table.locator('tbody th[scope="row"]')).toHaveCount(N);
  await expect(page.locator('#classificacao [role="region"][tabindex="0"]')).toHaveCount(1);
});

test.describe('production season', () => {
  test.skip(FIXTURE, 'production data only');

  test('GP1 is scored and the remaining GPs are not run', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByTestId('season-not-started')).toHaveCount(0);
    const rows = page.locator('#classificacao tbody tr');
    await expect(rows.locator('th[scope="row"]')).toHaveText([
      /Emídio/,
      /Dinis/,
      /Torres/,
      /P\. Oliveira/,
      /P\. Queirós/,
      /Joel/,
    ]);
    await expect(rows.locator('td:first-child')).toHaveText([
      /^\s*1\D/,
      /^\s*2\D/,
      /^\s*2\D/,
      /^\s*4\D/,
      /^\s*5\D/,
      /^\s*5\D/,
    ]);
    await expect(rows.first()).toContainText('Líder');
    const emidio = rows.first().locator('td');
    await expect(emidio.nth(1)).toHaveText('15');
    await expect(emidio.nth(2)).toHaveText('10');
    await expect(emidio.nth(3)).toHaveText('5');
    await expect(emidio.nth(4)).toContainText('volta mais rápida do GP');
    await expect(emidio.nth(4).getByTestId('gp-breakdown')).toContainText('10 + 5');
    const torres = page.locator('tr[data-pilot="torres"] td');
    await expect(torres.nth(1)).toHaveText('9');
    await expect(torres.nth(4).getByTestId('gp-breakdown')).toContainText('8 + 1');
    await expect(page.locator('#classificacao tbody').getByText('Não realizado')).toHaveCount(
      6 * N,
    );
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
      /Torres/,
    ]);
    const leader = rows.first();
    await expect(leader).toContainText('Líder');
    await expect(leader.locator('td').nth(1)).toHaveText('31');

    const pq = page.locator('tr[data-pilot="p-queiros"] td');
    await expect(pq.nth(1)).toHaveText('24');
    await expect(pq.nth(4)).toContainText('volta mais rápida do GP');
    await expect(pq.nth(4).getByTestId('gp-breakdown')).toContainText('6 + 4');

    const joel = page.locator('tr[data-pilot="joel"] td');
    await expect(joel.nth(5)).toContainText('Falta, 0 pontos');
    await expect(joel.nth(7)).toContainText('Não realizado');
    await expect(page.getByTestId('season-not-started')).toHaveCount(0);
  });
});
