import { expect, test } from '@playwright/test';
import { answerScenario, expectFooter } from './helpers';

test('the Library guide opens a term popover by keyboard and closes it with Esc', async ({ page }) => {
  await page.goto('/library/guide');
  const term = page.locator('[data-testid^="term-"]').first();
  await term.scrollIntoViewIfNeeded();
  await term.focus();
  await page.keyboard.press('Enter');
  const pop = page.locator('[data-testid$="-popover"]').first();
  await expect(pop).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pop).toHaveCount(0);
});

test('dark mode persists and the dark logo is used', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByTestId('logo')).toHaveAttribute('src', /toptechhr-logo-dark\.png$/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByTestId('logo')).toHaveAttribute('src', /toptechhr-logo-dark\.png$/);
});

test.describe('375 px', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  for (const path of ['/', '/plan', '/rules', '/numbers']) {
    test(`${path} fits the width`, async ({ page }) => {
      if (path === '/plan') await answerScenario(page);
      await page.goto(path);
      await expect(page.locator('main h1').first()).toBeVisible();
      await expect(page.getByTestId('logo-mark')).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      await expectFooter(page);
    });
  }
  test('the Notebook is a drawer', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('notebook-toggle').click();
    const drawer = page.getByTestId('notebook-drawer');
    await expect(drawer).toBeVisible();
    await drawer.getByTestId('new-notebook').click();
    await expect(drawer.getByTestId('notebook-editor')).toBeVisible();
    await drawer.getByTestId('notebook-editor').click();
    await page.keyboard.type('A full sentence typed into the notebook drawer stays whole.');
    await expect(drawer.getByTestId('notebook-editor')).toContainText('A full sentence typed into the notebook drawer stays whole.');
    await expect(drawer.getByTestId('notebook-persistence')).toBeVisible();
  });
});

/** KICKOFF §1, §5: no request leaves the page. The Google Fonts stylesheet and font files are the one allowed exception. */
const ALLOWED = [/^https:\/\/fonts\.googleapis\.com\//, /^https:\/\/fonts\.gstatic\.com\//];
test('no request leaves the page (Google Fonts excepted)', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const outside: string[] = [];
  page.on('request', (r) => {
    const u = r.url();
    if (u.startsWith(origin) || u.startsWith('data:') || u.startsWith('blob:') || ALLOWED.some((a) => a.test(u))) return;
    outside.push(`${new URL(page.url()).pathname} → ${u}`);
  });
  await answerScenario(page);
  for (const p of ['/plan', '/plan/constraints/c-local-pool-thin', '/plan/actions/l-structured-interview', '/rules', '/rules/state/us-al', '/rules/ugesp', '/numbers', '/library/guide', '/library/primers/reading-an-effect-size', '/library/glossary', '/library/sources', '/library/methods', '/notebook', '/about']) {
    await page.goto(p);
    await expect(page.locator('main h1').first()).toBeVisible();
    await page.waitForTimeout(250);
  }
  expect(outside).toEqual([]);
});
