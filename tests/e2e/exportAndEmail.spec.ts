import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/**
 * "Export to Obsidian" and "Email this to me" in Settings. Both are built in the browser from the device's own data: the zip is a real
 * download that holds the person's remembered fact, and the email button hands a summary to their own mail app without leaving the page.
 */
async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

const FACT = 'I focus best before ten in the morning';

test('Export to Obsidian downloads a zip with the notes and what Stay was asked to remember', async ({ page }) => {
  await onboard(page);
  await page.evaluate((fact) => localStorage.setItem('stay_user_memory_v1', JSON.stringify({ facts: [fact] })), FACT);
  await page.goto('/app/settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-vault').click()]);
  expect(download.suggestedFilename()).toMatch(/^stay-vault-\d{4}-\d{2}-\d{2}\.zip$/);
  const path = await download.path();
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK'); // a real zip
  const text = bytes.toString('latin1');
  expect(text).toContain('Stay.md');
  expect(text).toContain('Memory.md');
  expect(text).toContain(FACT);
});

test('Email this to me stays on the page and raises no error', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await onboard(page);
  await page.goto('/app/settings');
  await expect(page.getByTestId('email-me')).toBeVisible();
  await page.getByTestId('email-me').click({ noWaitAfter: true });
  await page.waitForTimeout(300);
  await expect(page).toHaveURL(/\/app\/settings/);
  expect(errors).toEqual([]);
});
