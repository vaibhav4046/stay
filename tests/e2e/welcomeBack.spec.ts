import { test, expect } from '@playwright/test';

/** Stay is proactive while the tab is open: after hours away the calm card comes back once, as a welcome back. */
test('coming back to the tab after hours away brings the greeting card again', async ({ page }) => {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
  // the person has seen and dismissed today's card
  await page.evaluate(() => {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    localStorage.setItem('stay_greeting_v1', JSON.stringify({ dismissedDay: day }));
  });
  // hide the page, let "three hours" pass, show it again
  await page.evaluate(() => {
    const real = Date.now;
    let offset = 0;
    Date.now = () => real() + offset;
    const set = (state: 'hidden' | 'visible') => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    set('hidden');
    offset = 3.2 * 60 * 60 * 1000;
    set('visible');
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('stay_greeting_v1') || '{}').dismissedDay), { timeout: 5000 }).toBe('');
});
