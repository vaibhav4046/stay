import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000';
const port = Number(new URL(baseURL).port || 3000);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: `npm run start -- -p ${port}`,
    port,
    reuseExistingServer: true,
  },
  projects: [
    {
      name: 'chromium',
      // Muted by default so no run ever plays sound; specs that set their own launchOptions also pass --mute-audio.
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--mute-audio'] } },
    },
  ],
});
