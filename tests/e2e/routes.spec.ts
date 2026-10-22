import { expect, test } from '@playwright/test';
import { expectFooter } from './helpers';

/** KICKOFF §5: every route answers 200 and renders its h1; the footer disclaimer and privacy line on every page. */
const ROUTES: [string, RegExp | string][] = [
  ['/', "What's going on with this opening?"],
  ['/plan', /Your plan|plan/i],
  ['/plan/constraints/c-local-pool-thin', /qualified candidates/i],
  ['/plan/actions/l-structured-interview', /structured interview/i],
  ['/plan/programs/opm-structured-interview-guide', /./],
  ['/rules', 'Rules'],
  ['/rules/e-verify-federal-contractor', /E-Verify/],
  ['/rules/al-e-verify-beason-hammon', /Alabama E-Verify/],
  ['/rules/state/us-al', 'Alabama'],
  ['/numbers', 'Numbers'],
  ['/library/guide', /Key Personnel/],
  ['/library/guide/1-what-predicts-a-good-hire', /Key Personnel/],
  ['/library/primers', 'Primers'],
  ['/library/primers/reading-an-effect-size', /./],
  ['/library/glossary', 'Glossary'],
  ['/library/sources', 'Sources'],
  ['/library/methods', /Methods/],
  ['/notebook', 'Notebooks'],
  ['/about', 'About TopTechHR'],
  ['/no-such-page', 'Page not found'],
];

for (const [path, h1] of ROUTES) {
  test(`${path} answers and renders its h1`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.locator('main h1').first()).toHaveText(h1, { timeout: 15_000 });
    await expect(page.getByTestId('top-band')).toHaveText(/^Evidence as of \d{1,2} \w+ 2026 · pack pack-\d{4}-\d{2}-\d{2}/);
    await expectFooter(page);
  });
}

test('the header: logo, five menu items, the Notebook toggle', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('logo')).toHaveAttribute('alt', 'TopTechHR');
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveText(['Start', 'Plan', 'Rules', 'Numbers', 'Library'], { ignoreCase: true });
  await expect(page.getByTestId('notebook-toggle')).toBeVisible();
  const logo = await page.request.get('/brand/toptechhr-logo.png');
  expect(logo.status()).toBe(200);
  expect(logo.headers()['content-type']).toContain('image/png');
});
