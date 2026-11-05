import { defineConfig, devices } from '@playwright/test';

/**
 * Stay in the other two engines: WebKit (Safari, desktop and iPhone) and Firefox. The main suite (playwright.config.ts) is Chromium; this one
 * runs tests/cross/ against a running copy of the app (PLAYWRIGHT_BASE_URL, default http://localhost:3122). Run it with:
 *   npx playwright test -c playwright.cross.config.ts
 * Voice itself needs a microphone and a real service, so these tests cover what can be checked without one: every page loads clean, the layout
 * holds, the foldable folds and blurs, and the scroll animations never leave anything invisible.
 */
export default defineConfig({
  testDir: './tests/cross',
  fullyParallel: false,
  retries: 0,
  workers: 2,
  reporter: 'list',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3122', trace: 'off' },
  projects: [
    { name: 'webkit-desktop', use: { ...devices['Desktop Safari'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 15'] } },
    { name: 'firefox-desktop', use: { ...devices['Desktop Firefox'] } },
  ],
});
