import { test, expect, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

const clockSeconds = async (page: Page) => {
  const t = ((await page.getByTestId('clock').textContent()) ?? '').trim();
  const m = t.match(/(\d+):(\d{2})/);
  if (!m) throw new Error(`unparseable clock: "${t}"`);
  return Number(m[1]) * 60 + Number(m[2]);
};

async function startBlock(page: Page, task: string) {
  await page.getByTestId('task-input').fill(task);
  await page.getByTestId('send').click();
  await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('start-timer').click();
  await expect(page.getByTestId('clock')).toBeVisible();
}

test.describe('Scorecard regressions (each asserts the real behaviour, not a toast)', () => {
  test('onboarding cannot be finished without the support-tool acknowledgement', async ({ page }) => {
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-done').click();
    await expect(page.getByTestId('onboarding-error')).toBeVisible();
    await expect(page.getByTestId('onboarding')).toBeVisible();
    await expect(page.getByTestId('task-input')).toHaveCount(0);
  });

  test('+5 min really adds 300 seconds to the live clock', async ({ page }) => {
    await onboard(page);
    await startBlock(page, 'Sort the paperwork pile');
    const before = await clockSeconds(page);
    await page.getByTestId('plus-five').click();
    await expect.poll(() => clockSeconds(page), { timeout: 5000 }).toBeGreaterThan(before + 280);
  });

  test('stopping a block clears it: no stale "still running" block after a reload', async ({ page }) => {
    await onboard(page);
    await startBlock(page, 'Sort the paperwork pile');
    await page.getByTestId('plus-five').click();
    await page.getByTestId('stop-timer').click();
    await expect(page.getByTestId('outcome-card')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('stay_active_block'))).toBeNull();
  });

  test('an unsent draft survives leaving Today and coming back', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('task-input').fill('Ring the dentist about Thursday');
    await page.goto('/app/history');
    await page.goto('/app/today');
    await expect(page.getByTestId('task-input')).toHaveValue('Ring the dentist about Thursday');
  });

  test('"Make it smaller" reaches a floor instead of looping forever', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('task-input').fill('Do my taxes');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 20000 });
    for (let i = 0; i < 8; i++) {
      const smaller = page.getByTestId('make-smaller');
      if (!(await smaller.isVisible().catch(() => false)) || (await smaller.isDisabled().catch(() => true))) break;
      await smaller.click();
      await page.waitForTimeout(250);
    }
    await expect(page.getByTestId('shrink-floor')).toBeVisible();
  });

  test('saving an empty routine explains why instead of failing silently', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('chip-routines').click();
    await page.getByTestId('routine-new').click();
    await page.getByTestId('routine-save').click();
    await expect(page.getByTestId('routine-error')).toBeVisible();
  });

  test('a logged session can be deleted and the delete can be undone', async ({ page }) => {
    await onboard(page);
    await startBlock(page, 'Sort the paperwork pile');
    await page.getByTestId('stop-timer').click();
    await page.getByTestId('outcome-started').click();
    await expect(page.getByTestId('done-card')).toBeVisible();
    await page.goto('/app/history');
    const rows = page.locator('[data-testid^="history-delete-"]');
    await expect(rows.first()).toBeVisible();
    const n = await rows.count();
    await rows.first().click();
    await expect(page.getByTestId('history-undo-toast')).toBeVisible();
    await expect(rows).toHaveCount(n - 1);
    await page.getByTestId('history-undo-button').click();
    await expect(rows).toHaveCount(n);
  });
});
