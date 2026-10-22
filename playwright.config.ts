import { defineConfig, devices } from '@playwright/test';

// KICKOFF §5: Playwright serves dist/ on :4173. BX_PORT overrides it when 4173 is taken by another app's preview.
const PORT = Number(process.env.BX_PORT ?? 4173);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  workers: 4,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    acceptDownloads: true,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Built beforehand with the fixture BLS file in public/data/benchmarks (CI copies tests/fixtures/benchmarks there).
    command: `npm run preview -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
