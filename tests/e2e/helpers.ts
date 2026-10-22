import { expect, type Page } from '@playwright/test';

export const ANSWERS_KEY = 'toptechhr-start';
export const NOTEBOOK_KEY = 'toptechhr-notebooks';

/** The footer duties on every page (KICKOFF §4, §5): the disclaimer and the privacy line. */
export async function expectFooter(page: Page) {
  await expect(page.getByTestId('footer-disclaimer')).toContainText('Not legal, HR, compliance or financial advice');
  await expect(page.getByTestId('footer-privacy')).toHaveText('Nothing leaves your browser · No analytics');
}

/** Choose the KICKOFF §5 scenario through the Start steps. */
export async function answerScenario(page: Page) {
  await page.goto('/');
  await page.getByLabel('Fill a role').check();
  await page.getByLabel('Few plausible candidates').check();
  await page.getByLabel('Needs a security clearance or sponsorship').check();
  await page.getByLabel('The skill is rare or the market is mostly passive').check();
  await page.getByTestId('state-select').selectOption('us-al');
}
