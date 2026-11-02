import { test, expect } from '@playwright/test';

test.describe('Chat-first home: orb, conversation top to bottom, composer', () => {
  test('empty screen is the orb and the composer; the first message starts the conversation; New chat clears it', async ({ page }) => {
    // 1. Visit /app/today and complete onboarding
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const careOption = page.getByTestId('care-self_managing');
    if (await careOption.isVisible()) {
      await careOption.click();
      await page.getByTestId('onboarding-ack').click();
      await page.getByTestId('onboarding-done').click();
    }

    // 2. Empty home: a large orb and the composer, no conversation yet
    await expect(page.getByTestId('orb-stage')).toHaveAttribute('data-compact', 'false');
    await expect(page.getByTestId('live-chat-box')).toHaveCount(0);
    await expect(page.getByTestId('composer')).toBeVisible();

    // 3. Type task and send
    const taskInput = page.getByTestId('task-input');
    await taskInput.fill('Organize my desk papers');
    await page.getByTestId('send').click();

    // 4. User message appears in live chat box
    const userMessage = page.getByTestId('chat-user-message');
    await expect(userMessage).toBeVisible({ timeout: 5000 });
    await expect(userMessage).toContainText('Organize my desk papers');

    // 5. Stay response appears in live chat box
    const agentMessage = page.getByTestId('chat-agent-message');
    await expect(agentMessage.first()).toBeVisible({ timeout: 10000 });

    // 6. The orb shrinks to a header and the conversation flows beneath it
    await expect(page.getByTestId('orb-stage')).toHaveAttribute('data-compact', 'true');
    await expect(page.getByTestId('chat-stream')).toBeVisible();

    // 7. New chat returns to the empty home
    const clearBtn = page.getByTestId('chat-clear-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(page.getByTestId('orb-stage')).toHaveAttribute('data-compact', 'false');
    await expect(page.getByTestId('chat-stream')).toHaveCount(0);
  });

  test('no horizontal overflow at mobile 375px with chat box', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/app/today');

    const careOption = page.getByTestId('care-self_managing');
    if (await careOption.isVisible()) {
      await careOption.click();
      await page.getByTestId('onboarding-ack').click();
      await page.getByTestId('onboarding-done').click();
    }

    await expect(page.getByTestId('orb-stage')).toBeVisible();
    await page.getByTestId('task-input').fill('Organize my desk papers');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('live-chat-box')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
