import { test, expect } from '@playwright/test';

test.describe('Gemini Live-style Live Chat Box & Real-Time Transcripts', () => {
  test('renders live chat box, streams submitted tasks, shows Stay response, and supports collapse/expand', async ({ page }) => {
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

    // 2. Chat box container exists
    const chatBox = page.getByTestId('live-chat-box');
    await expect(chatBox).toBeVisible();

    // Initial empty state
    await expect(page.getByTestId('chat-empty-state')).toBeVisible();

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

    // 6. Collapse and Expand toggle works smoothly
    const toggleBtn = page.getByTestId('chat-toggle-btn');
    await toggleBtn.click();
    await expect(page.getByTestId('chat-message-list')).not.toBeVisible();

    await toggleBtn.click();
    await expect(page.getByTestId('chat-message-list')).toBeVisible();

    // 7. Clear button empties the transcript stream
    const clearBtn = page.getByTestId('chat-clear-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();
    await expect(page.getByTestId('chat-empty-state')).toBeVisible();
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

    await expect(page.getByTestId('live-chat-box')).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
