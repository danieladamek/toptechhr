import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { answerScenario, NOTEBOOK_KEY } from './helpers';

async function selectEffect(page: Page) {
  const effect = page.getByTestId('lever-card').first().getByTestId('lever-effect').locator('p').first();
  await effect.scrollIntoViewIfNeeded();
  const box = (await effect.boundingBox())!;
  // drag-select the effect line, as a reader would
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 3, { steps: 8 });
  await page.mouse.up();
}

/**
 * KICKOFF §5: select text inside a lever's effect line → the Quote control → the Notebook holds a quote block with the
 * [n]s and the reference line → reload → persists → Export Markdown keeps the source line → Export JSON → delete →
 * Import → it is back; and the print view renders the six sections with no header or nav.
 */
test('quote from a lever card, persist, export, delete, import', async ({ page }) => {
  await answerScenario(page);
  await page.goto('/plan');
  await selectEffect(page);
  await expect(page.getByTestId('quote-control')).toBeVisible();
  await expect(page.getByTestId('add-action-button')).toBeVisible();
  await page.getByTestId('quote-button').click();

  const quote = page.getByTestId('quote-block').first();
  await expect(quote).toBeVisible();
  await expect(quote.getByTestId('quote-source')).toContainText(/Source: .+ · \[\d+/);
  await expect(quote.getByTestId('quote-refs')).toContainText(/\[\d+\] \S+/);

  await page.reload();
  if (!(await page.getByTestId('notebook-panel').isVisible())) await page.getByTestId('notebook-toggle').click();
  await expect(page.getByTestId('quote-block').first()).toBeVisible();
  await expect(page.getByTestId('notebook-persistence')).toHaveText('Saved in this browser only. Export to keep it. Nothing is sent anywhere.');

  // Markdown: the quote carries its source line
  await page.getByTestId('export-menu').click();
  const [md] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-md').click()]);
  expect(md.suggestedFilename()).toMatch(/^Action-plan-\d{4}-\d{2}-\d{2}\.md$/);
  const text = fs.readFileSync((await md.path())!, 'utf8');
  expect(text).toMatch(/^> .+\[\d+\]/m);
  expect(text).toMatch(/^> — Source: .+ · \[\d+/m);

  // JSON → delete → import → back
  await page.getByTestId('export-menu').click();
  const [json] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-json').click()]);
  const file = (await json.path())!;
  page.once('dialog', (d) => d.accept());
  await page.getByTestId('delete-notebook').click();
  await expect(page.getByTestId('quote-block')).toHaveCount(0);
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), NOTEBOOK_KEY))!).notebooks).toHaveLength(0);
  await page.getByTestId('import-file').setInputFiles(file);
  await expect(page.getByTestId('quote-block').first()).toBeVisible();
});

test('the print view renders the six sections with no header or nav', async ({ page }) => {
  await page.goto('/notebook');
  await page.getByTestId('new-notebook-page').click();
  await expect(page).toHaveURL(/\/notebook\/nb-/);
  const id = page.url().split('/').pop();
  await page.goto(`/notebook/${id}/print`);
  const body = page.getByTestId('notebook-print');
  await expect(body.locator('h2')).toHaveText(['Situation', 'What we confirmed', 'Actions', 'Rules to check', 'Numbers', 'Sources']);
  await expect(page.locator('header')).toHaveCount(0);
  await expect(page.locator('nav')).toHaveCount(0);
  await expect(page.getByTestId('top-band')).toHaveCount(0);
});

test('Add to plan fills the Actions section with the Does not line and placeholders', async ({ page }) => {
  await answerScenario(page);
  await page.goto('/plan');
  const lever = page.getByTestId('lever-card').first();
  await lever.getByRole('button', { name: /Add to plan/i }).click();
  if (!(await page.getByTestId('notebook-panel').isVisible())) await page.getByTestId('notebook-toggle').click();
  const row = page.getByTestId('plan-row-action').first();
  await expect(row).toContainText('Does not:');
  await expect(row.getByTestId('row-owner')).toHaveAttribute('placeholder', '[owner]');
  await expect(row.getByTestId('row-by')).toHaveAttribute('placeholder', '[date]');
  await expect(row.getByTestId('row-measure')).toHaveAttribute('placeholder', '[measure]');
});
