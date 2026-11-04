import { test, expect, type Page } from '@playwright/test';

/**
 * Typed messages with no voice call go to the same brain as the voice (the chat route and its app tool). Reviews, 4 Nov 2026: before this,
 * a typed question got a coaching template, "set a timer" got "Morphed into Timer (7-Fold AI Morph)!", and "remember…" saved nothing.
 * Uses the real model: a handful of turns.
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
const agentLines = (page: Page) => page.locator('[data-role="agent"], [data-testid="agent-line"]').allInnerTexts();
async function send(page: Page, text: string) {
  const before = (await page.locator('body').innerText()).length;
  await page.getByTestId('task-input').fill(text);
  await page.getByTestId('send').click();
  await expect.poll(async () => (await page.locator('body').innerText()).length, { timeout: 25_000 }).toBeGreaterThan(before + text.length + 4);
  await page.waitForTimeout(1500);
}

test.describe('Typed chat: one brain', () => {
  test.setTimeout(120_000);
  test('a question, a timer, and a memory, typed', async ({ page }) => {
    await onboard(page);
    await send(page, 'why would I use this and not just a regular chatbot?');
    await expect(page.locator('body')).toContainText(/one tiny first step|starting/i);

    await send(page, 'set a 10 minute timer');
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Morph|AI Morph|game move/i);
    await expect(page.getByTestId('stop-timer').or(page.getByText(/10:00|9:5\d/)).first()).toBeVisible({ timeout: 10_000 });

    await send(page, 'remember that I focus best with lofi on');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('stay_user_memory_v1') ?? ''), { timeout: 10_000 }).toMatch(/lofi/i);
    expect(await page.locator('body').innerText()).not.toMatch(/Morph|game move/i);
    void agentLines;
  });
});
