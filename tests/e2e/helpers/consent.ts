import type { Page } from '@playwright/test';

/** A person who already pressed "Start talking" on an earlier visit. Tests that are about something other than consent start here. */
export async function grantMicConsent(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('stay:mic_consented:v1', '1');
    } catch {
      // storage blocked: the sheet will show, which is the safe default
    }
  });
}
