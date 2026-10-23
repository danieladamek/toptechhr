import { expect, test } from '@playwright/test';

/** KICKOFF §5: /rules defaults to Alabama; Washington; /numbers tabs, pairing and the BLS refresh (with and without the file). */
test('/rules defaults to Alabama: six state rules and the nine-overlay table with two "official text pending" rows', async ({ page }) => {
  await page.goto('/rules');
  await expect(page.getByTestId('rules-state')).toHaveValue('us-al');
  await expect(page.getByTestId('state-own-rules').getByTestId('rule-item')).toHaveCount(6);
  await expect(page.getByTestId('state-own-rules').getByTestId('statute-chip').first()).toHaveText('Statute');
  await expect(page.getByTestId('overlay-row')).toHaveCount(9);
  await expect(page.getByTestId('overlay-table').getByTestId('mirror-tag')).toHaveCount(2);
  await expect(page.getByTestId('overlay-table').getByTestId('mirror-tag').first()).toHaveText('Mirror of the Code; official text pending');
  await expect(page.getByTestId('moment').first()).toBeVisible();
  await expect(page.locator('#changed')).toBeVisible();
});

test('switching to Washington: three overlays without the compilation tag, no state rules', async ({ page }) => {
  await page.goto('/rules');
  await page.getByTestId('rules-state').selectOption('us-wa');
  await expect(page.getByTestId('overlay-row')).toHaveCount(9);
  await expect(page.locator('[data-testid=overlay-row][data-pending=false]')).toHaveCount(3);
  await expect(page.getByTestId('overlay-table').getByTestId('compilation-tag')).toHaveCount(6);
  await expect(page.getByTestId('no-state-rules')).toBeVisible();
});

test('/numbers: the Alabama tab pairs a card; the National tab pairs none', async ({ page }) => {
  await page.goto('/numbers?tab=alabama');
  await expect(page.getByTestId('numbers-panel-alabama').getByTestId('counterpart').first()).toBeVisible();
  await page.getByTestId('numbers-tab-national').click();
  await expect(page.getByTestId('numbers-panel-national').getByTestId('number-card').first()).toBeVisible();
  await expect(page.getByTestId('numbers-panel-national').getByTestId('counterpart')).toHaveCount(0);
  await page.getByTestId('numbers-tab-defense').click();
  await expect(page.getByTestId('numbers-panel-defense').getByTestId('number-card').first()).toBeVisible();
});

test('with the fixture refresh: a refreshed value beside the pack value, labelled API-confirmed', async ({ page }) => {
  await page.goto('/numbers?tab=alabama');
  const card = page.locator('#ind-al-unemployment-sep2026');
  await expect(card.getByTestId('pack-figure')).toContainText('3.5%');
  await expect(card.getByTestId('refreshed-value')).toContainText('3.6');
  await expect(card.getByTestId('refreshed-value')).toContainText('BLS, refreshed 22 October 2026');
  await expect(card.getByTestId('series-label')).toHaveText('API-confirmed');
  await expect(page.getByTestId('refresh-date')).toBeVisible();
});

test('without the data file: the pack value stands with the pack label, and /about lists the series under Refresh', async ({ page }) => {
  await page.route('**/data/benchmarks/latest.json', (r) => r.fulfill({ status: 404, body: 'not found' }));
  await page.goto('/numbers?tab=alabama');
  const card = page.locator('#ind-al-unemployment-sep2026');
  await expect(card.getByTestId('pack-figure')).toContainText('3.5%');
  await expect(card.getByTestId('refreshed-value')).toHaveCount(0);
  await expect(card.getByTestId('series-label')).toHaveText('series confirmed by the API');
  await expect(page.getByTestId('no-refresh')).toBeVisible();
  await page.goto('/about');
  await expect(page.getByTestId('refresh-missing')).toBeVisible();
  await expect(page.getByTestId('refresh-failed')).toContainText('LASST010000000000003');
});

test('/numbers: no Alabama or Huntsville figure without its national twin or its note', async ({ page }) => {
  await page.goto('/numbers?tab=alabama');
  const cards = page.getByTestId('numbers-panel-alabama').getByTestId('number-card');
  await expect(cards.first()).toBeVisible();
  const n = await cards.count();
  for (let i = 0; i < n; i++) {
    const c = cards.nth(i);
    expect(await c.getByTestId('counterpart').count() + await c.getByTestId('counterpart-note').count(), await c.locator('h2').innerText()).toBeGreaterThan(0);
  }
  for (const row of await page.getByTestId('wage-row').all()) expect(await row.getByTestId('counterpart').count() + await row.getByTestId('counterpart-note').count()).toBeGreaterThan(0);
  // the Huntsville defense figure sits on the Defense tab, with its note where the twin would be
  await page.getByTestId('numbers-tab-defense').click();
  await expect(page.locator('#ind-redstone-arsenal-workforce').getByTestId('counterpart-note')).toContainText('No national twin shown: an installation headcount has no national twin');
});
