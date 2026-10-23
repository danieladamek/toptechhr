import { expect, test } from '@playwright/test';
import { ANSWERS_KEY, answerScenario, expectFooter } from './helpers';

/** KICKOFF §5: Start → the scenario → /plan, section by section; "Clear my answers" empties the stored answers. */
test('Start → Plan for "Few plausible candidates", Fill a role, clearance + rare skill, Alabama', async ({ page }) => {
  await answerScenario(page);
  await expect(page.getByTestId('stays-here')).toHaveText('These answers stay in this browser.');
  await page.getByTestId('show-plan').click();
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByTestId('plan-title')).toHaveText('Few plausible candidates');
  await expect(page.getByTestId('ranking-line')).toHaveText('Ranked by how many of your answers each item matches. Nothing here is recommended over anything else.');

  // Check these first: c-local-pool-thin, with a reason naming the pattern
  const card = page.locator('#c-local-pool-thin');
  await expect(page.getByTestId('check-first-list').locator('#c-local-pool-thin')).toBeVisible();
  await expect(card.getByTestId('match-count')).toContainText('Matches 3 of your answers');
  await card.getByTestId('why-matched').click();
  await expect(card.getByTestId('reasons')).toContainText('Pattern: Few plausible candidates');

  // a lever card: "Does not:" directly under the evidence block
  const lever = page.getByTestId('lever-card').first();
  await expect(lever.getByTestId('limits-line')).toContainText('Does not:');
  const adjacent = await lever.getByTestId('evidence-block').evaluate((el) => el.nextElementSibling?.getAttribute('data-testid'));
  expect(adjacent).toBe('limits-line');
  await expect(lever.getByTestId('grade-chip')).toBeVisible();
  await expect(lever.getByTestId('moment-chip')).toHaveText(/^Moment: (Planning|Posting and finding people|Interviewing and testing|The offer|Clearance and start|The first weeks|Growing people|Keeping people|Departures and handovers)/);

  // Rules: Alabama with six state rules and the E-Verify gate
  const rules = page.getByTestId('plan-rules');
  await expect(rules.getByTestId('state-heading')).toHaveText('Alabama');
  await expect(rules.getByTestId('state-rules').getByTestId('rule-item')).toHaveCount(6);
  await expect(rules.locator('[data-gate="al-e-verify-beason-hammon"]')).toBeVisible();
  await expect(rules.locator('[data-gate="e-verify-federal-contractor"]')).toBeVisible();
  await expect(rules.getByTestId('check-tag').first()).toHaveText('Check');

  // Numbers: an Alabama card with its U.S. counterpart in the same card
  const numbers = page.getByTestId('plan-numbers');
  const al = numbers.getByTestId('number-card').filter({ has: page.getByTestId('geo-chip').filter({ hasText: 'Alabama' }) }).first();
  await expect(al.getByTestId('counterpart')).toContainText('United States');
  expect(await numbers.getByTestId('number-card').count()).toBeGreaterThanOrEqual(4);
  expect(await numbers.getByTestId('number-card').count()).toBeLessThanOrEqual(8);

  // Sources on this page: fold-out cards
  await expect(page.getByTestId('plan-sources').getByTestId('sources')).toBeVisible();
  await expectFooter(page);
});

test('"Clear my answers" empties the stored answers', async ({ page }) => {
  await answerScenario(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), ANSWERS_KEY)).not.toBeNull();
  await page.getByTestId('clear-answers').click();
  expect(await page.evaluate((k) => localStorage.getItem(k), ANSWERS_KEY)).toBeNull();
  await page.goto('/plan');
  await expect(page.getByTestId('start-steps')).toBeVisible();
});

test('the plain name renders above the pack name on an action page', async ({ page }) => {
  await page.goto('/plan/actions/l-mechanical-scoring');
  await expect(page.getByTestId('record-title')).toHaveText('Score candidates with a fixed rubric, then combine the scores by rule');
  await expect(page.getByTestId('pack-name')).toBeVisible();
  const order = await page.evaluate(() => { const t = document.querySelector('[data-testid=record-title]')!; const p = document.querySelector('[data-testid=pack-name]')!; return t.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING; });
  expect(order).toBeTruthy();
});
