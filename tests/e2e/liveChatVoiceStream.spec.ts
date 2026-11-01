import { test, expect, type Page } from '@playwright/test';
import { installFakeVoice, type FakeVoice } from './helpers/fakeVoice';

test.use({
  permissions: ['microphone'],
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  },
});

async function setupOnboardedPage(page: Page): Promise<FakeVoice> {
  const fakeVoice = await installFakeVoice(page);
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const careOption = page.getByTestId('care-self_managing');
  if (await careOption.isVisible({ timeout: 5000 }).catch(() => false)) {
    await careOption.click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();
  }
  await expect(page.getByTestId('orb-button')).toBeVisible();
  await page.waitForSelector('[data-testid="orb-button"] canvas');
  return fakeVoice;
}

async function startVoice(page: Page) {
  await page.getByTestId('orb-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
}

test.describe('Deterministic Fake-Voice Browser Live Chat Stream Suite', () => {
  test('User partial speech -> final speech -> thinking -> assistant streaming -> finalized message', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    // Start voice session
    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // 1. Send user partial delta
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: 'I need to file my' });

    // Assert: chat-live-user-partial is visible, appears once, status says Transcribing speech
    const userPartial = page.getByTestId('chat-live-user-partial');
    await expect(userPartial).toBeVisible({ timeout: 5000 });
    await expect(userPartial).toHaveCount(1);
    await expect(userPartial).toContainText('I need to file my');
    await expect(page.getByTestId('chat-status-pill')).toContainText('Transcribing speech');

    // 2. Send longer user partial delta (in-place replacement)
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: 'I need to file my taxes for 2024' });
    await expect(userPartial).toHaveCount(1);
    await expect(userPartial).toContainText('I need to file my taxes for 2024');

    // 3. Send final user transcript
    fakeVoice.sendRaw({ type: 'input.speech.stopped' });
    fakeVoice.sendRaw({ type: 'transcript.user', text: 'I need to file my taxes for 2024', item_id: 'u-101' });

    // Assert: temporary user partial becomes finalized chat-user-message
    await expect(userPartial).toHaveCount(0);
    const userMsg = page.getByTestId('chat-user-message');
    await expect(userMsg).toHaveCount(1);
    await expect(userMsg).toContainText('I need to file my taxes for 2024');

    // 4. Send reply.started
    fakeVoice.sendRaw({ type: 'reply.started' });
    // State becomes thinking or speaking
    await expect(page.getByTestId('chat-status-pill')).toContainText(/Thinking|speaking/i);

    // 5. Send streaming audio & transcript.agent
    fakeVoice.sendRaw({ type: 'transcript.agent', text: 'Let us open your W-2 document first.', item_id: 'a-201' });

    // 6. Send reply.done
    fakeVoice.sendRaw({ type: 'reply.done', status: 'completed' });

    // Exactly one finalized agent message exists
    const agentMsg = page.getByTestId('chat-agent-message');
    await expect(agentMsg).toHaveCount(1);
    await expect(agentMsg).toContainText('Let us open your W-2 document first.');
  });

  test('Instant barge-in interruption while Stay is speaking', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // Initial user speech & final
    fakeVoice.sendRaw({ type: 'transcript.user', text: 'Organize office', item_id: 'u-1' });
    await expect(page.getByTestId('chat-user-message')).toHaveCount(1);

    // Stay begins speaking
    fakeVoice.sendRaw({ type: 'reply.started' });
    fakeVoice.sendRaw({ type: 'transcript.agent', text: 'Start with the stack of bills on your left.', item_id: 'a-1' });

    // User interrupts by speaking over Stay
    fakeVoice.userSpeaks('Wait, I found the document already');

    // Assert: interruption badge appears and new user partial bubble appears
    await expect(page.getByTestId('chat-live-interrupted-badge')).toBeVisible({ timeout: 5000 });
    const userPartial = page.getByTestId('chat-live-user-partial');
    await expect(userPartial).toBeVisible();
    await expect(userPartial).toContainText('Wait, I found the document already');

    // Finalize the interruption utterance
    fakeVoice.sendRaw({ type: 'transcript.user', text: 'Wait, I found the document already', item_id: 'u-2' });
    await expect(page.getByTestId('chat-user-message')).toHaveCount(2);
  });

  test('User partial ending in hesitation, rapid speech, and empty transcript handling', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // Empty transcript should not add broken bubbles
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: '   ' });
    await expect(page.getByTestId('chat-live-user-partial')).toHaveCount(0);

    // Rapid speech updates
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: 'I' });
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: 'I am' });
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: 'I am not sure...' });

    const userPartial = page.getByTestId('chat-live-user-partial');
    await expect(userPartial).toHaveCount(1);
    await expect(userPartial).toContainText('I am not sure...');

    // Finalize hesitation
    fakeVoice.sendRaw({ type: 'transcript.user', text: 'I am not sure where to start', item_id: 'u-hesitate' });
    await expect(page.getByTestId('chat-user-message')).toContainText('I am not sure where to start');
  });

  test('Collapse while streaming, accessible preview button, and reopening after collapse', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // Collapse live chat
    await page.getByTestId('chat-toggle-btn').click();
    await expect(page.getByTestId('chat-message-list')).not.toBeVisible();

    // Stream user speech while collapsed
    fakeVoice.sendRaw({ type: 'transcript.user.delta', text: 'Testing collapsed streaming' });

    // Collapsed preview button is visible and accessible
    const previewBtn = page.getByTestId('chat-collapsed-preview-btn');
    await expect(previewBtn).toBeVisible();
    await expect(previewBtn).toContainText('Testing collapsed streaming');

    // Reopen by clicking the preview button
    await previewBtn.click();
    await expect(page.getByTestId('chat-message-list')).toBeVisible();
    await expect(page.getByTestId('chat-live-user-partial')).toContainText('Testing collapsed streaming');
  });

  test('Clear transcripts during active session leaves input usable', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    fakeVoice.sendRaw({ type: 'transcript.user', text: 'A completed thought', item_id: 'u-10' });
    await expect(page.getByTestId('chat-user-message')).toHaveCount(1);

    // Clear
    const clearBtn = page.getByTestId('chat-clear-btn');
    await expect(clearBtn).toBeVisible();
    await clearBtn.click();

    // Empty state returns
    await expect(page.getByTestId('chat-empty-state')).toBeVisible();

    // Task text input remains 100% usable
    const taskInput = page.getByTestId('task-input');
    await expect(taskInput).toBeVisible();
    await taskInput.fill('Typed backup thought');
    expect(await taskInput.inputValue()).toBe('Typed backup thought');
  });

  test('Active session persistence survives page reload and restores chat turns and plan', async ({ page }) => {
    await setupOnboardedPage(page);

    // Type a task and submit to generate a plan card
    const taskInput = page.getByTestId('task-input');
    await taskInput.fill('Filing 2024 quarterly taxes');
    await page.getByTestId('send').click();

    // Verify user message and plan card
    await expect(page.getByTestId('chat-user-message')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 10000 });

    // Reload the page
    await page.reload();

    // Assert: active chat transcripts and plan card are both restored!
    await expect(page.getByTestId('chat-user-message')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('chat-user-message')).toContainText('Filing 2024 quarterly taxes');
    await expect(page.getByTestId('plan-card')).toBeVisible();
    await expect(page.getByTestId('task-input')).toBeVisible();
  });

  test('Wispr Flow: Scratch that and Actually change that to voice commands', async ({ page }) => {
    await setupOnboardedPage(page);

    // Submit initial task
    const taskInput = page.getByTestId('task-input');
    await taskInput.fill('Send invoice to client');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('chat-user-message')).toContainText('Send invoice to client');

    // Use Wispr Flow Scratch that button
    const scratchBtn = page.getByTestId('wispr-scratch-btn');
    await expect(scratchBtn).toBeVisible({ timeout: 4000 });
    await scratchBtn.click();
    await page.waitForTimeout(600);
    // Last turn is cleanly removed
    const userMsgs = await page.locator('[data-testid="chat-user-message"]').allTextContents();
    expect(userMsgs.some(t => t.includes('Send invoice to client'))).toBe(false);

    // Voice command: Actually change that to call landlord
    await taskInput.fill('Actually, change that to call the landlord');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('chat-user-message').last()).toContainText('call the landlord', { timeout: 8000 });
  });

  test('Wispr Flow: Repeat last thing and What you heard commands', async ({ page }) => {
    await setupOnboardedPage(page);

    const taskInput = page.getByTestId('task-input');
    await taskInput.fill('Tidy desk');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 10000 });

    // What you heard action
    const heardBtn = page.getByTestId('wispr-heard-btn');
    if (await heardBtn.isVisible()) {
      await heardBtn.click();
      await expect(page.getByTestId('chat-agent-message').last()).toContainText(/heard/i);
    }

    // Repeat action
    const repeatBtn = page.getByTestId('wispr-repeat-btn');
    if (await repeatBtn.isVisible()) {
      await repeatBtn.click();
      await expect(page.getByTestId('chat-agent-message').last()).toBeVisible();
    }
  });

  test('Mobile 375px responsive layout has no overflow and live chat is fully contained', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await setupOnboardedPage(page);

    const liveChatBox = page.getByTestId('live-chat-box');
    await expect(liveChatBox).toBeVisible();

    // Verify horizontal overflow is strictly zero
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(overflow).toBe(false);
  });
});
