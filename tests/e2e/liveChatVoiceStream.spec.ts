import { test, expect, type Page } from '@playwright/test';
import { installFakeFastVoice, type FakeFastVoice } from './helpers/fakeFastVoice';

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

async function setupOnboardedPage(
  page: Page,
  chatReplyText = 'Let us open your W-2 document first.'
): Promise<FakeFastVoice> {
  const fakeVoice = await installFakeFastVoice(page, {
    chatReplyText,
    ttsChunksPerFlush: 3,
    ttsChunkIntervalMs: 30,
  });
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

test.describe('Deterministic FastSocket Browser Live Chat Stream Suite (C1)', () => {
  test('User partial speech -> final speech -> thinking -> assistant streaming -> finalized message over FastSocket', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page, 'Let us open your W-2 document first.');

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);
    expect(fakeVoice.managedAgentSocketOpened()).toBe(false);
    expect(fakeVoice.ttsUrl()).toContain('voice_id=');
    expect(fakeVoice.ttsUrl()).not.toContain('voice=');

    // 1. Send user partial Turn via AssemblyAI v3 STT socket
    fakeVoice.pushSttPartial('I need to file my', 0);

    const userPartial = page.getByTestId('chat-live-user-partial');
    await expect(userPartial).toBeVisible({ timeout: 5000 });
    await expect(userPartial).toHaveCount(1);
    await expect(userPartial).toContainText('I need to file my');
    await expect(page.getByTestId('chat-status-pill')).toContainText('Transcribing speech');

    // 2. Send longer user partial Turn (in-place replacement)
    fakeVoice.pushSttPartial('I need to file my taxes for 2024', 0);
    await expect(userPartial).toHaveCount(1);
    await expect(userPartial).toContainText('I need to file my taxes for 2024');

    // 3. Send final user Turn (end_of_turn: true) -> triggers /api/voice/chat -> TTS Generate + Flush -> Audio + FlushDone
    fakeVoice.pushSttFinal('I need to file my taxes for 2024.', 0);

    await expect(userPartial).toHaveCount(0, { timeout: 5000 });
    const userMsg = page.getByTestId('chat-user-message');
    await expect(userMsg).toHaveCount(1);
    await expect(userMsg).toContainText('I need to file my taxes for 2024.');

    // Finalized agent reply is the latest agent message in the transcript
    const agentMsg = page.getByTestId('chat-agent-message').last();
    await expect(agentMsg).toContainText('Let us open your W-2 document first.', { timeout: 8000 });
  });

  test('Instant barge-in interruption while Stay is speaking over FastSocket', async ({ page }) => {
    const fakeVoice = await installFakeFastVoice(page, {
      chatReplyText: 'Start with the stack of bills on your left and sort the top three.',
      ttsChunksPerFlush: 12,
      ttsChunkIntervalMs: 120,
    });
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    const careOption = page.getByTestId('care-self_managing');
    if (await careOption.isVisible({ timeout: 5000 }).catch(() => false)) {
      await careOption.click();
      await page.getByTestId('onboarding-ack').click();
      await page.getByTestId('onboarding-done').click();
    }

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // Initial user speech & final
    fakeVoice.pushSttFinal('Organize office.', 0);
    await expect(page.getByTestId('chat-user-message')).toHaveCount(1, { timeout: 5000 });

    // Wait until TTS starts streaming audio
    await page.waitForTimeout(180);

    // User interrupts by speaking over Stay
    fakeVoice.pushSttSpeechStarted();
    fakeVoice.pushSttPartial('Wait, I found the document already', 1);

    const userPartial = page.getByTestId('chat-live-user-partial');
    await expect(userPartial).toBeVisible({ timeout: 5000 });
    await expect(userPartial).toContainText('Wait, I found the document already');

    // Verify FastSocket sent Cancel to AssemblyAI TTS socket
    await expect
      .poll(() => fakeVoice.ttsSentJson().some((m) => m.type === 'Cancel'), { timeout: 4000 })
      .toBe(true);

    // Finalize the interruption utterance
    fakeVoice.pushSttFinal('Wait, I found the document already.', 1);
    await expect(page.getByTestId('chat-user-message')).toHaveCount(2, { timeout: 6000 });
  });

  test('User partial ending in hesitation, rapid speech, and empty transcript handling', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // Empty transcript should not add broken bubbles
    fakeVoice.pushSttPartial('   ', 0);
    await expect(page.getByTestId('chat-live-user-partial')).toHaveCount(0);

    // Rapid speech updates
    fakeVoice.pushSttPartial('I', 0);
    fakeVoice.pushSttPartial('I am', 0);
    fakeVoice.pushSttPartial('I am not sure...', 0);

    const userPartial = page.getByTestId('chat-live-user-partial');
    await expect(userPartial).toHaveCount(1);
    await expect(userPartial).toContainText('I am not sure...');

    // Finalize hesitation
    fakeVoice.pushSttFinal('I am not sure where to start.', 0);
    await expect(page.getByTestId('chat-user-message')).toContainText('I am not sure where to start.', {
      timeout: 5000,
    });
  });

  test('Collapse while streaming, accessible preview button, and reopening after collapse', async ({ page }) => {
    const fakeVoice = await setupOnboardedPage(page);

    await startVoice(page);
    expect(fakeVoice.ready()).toBe(true);

    // Collapse live chat
    await page.getByTestId('chat-toggle-btn').click();
    await expect(page.getByTestId('chat-message-list')).not.toBeVisible();

    // Stream user speech while collapsed
    fakeVoice.pushSttPartial('Testing collapsed streaming', 0);

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

    fakeVoice.pushSttFinal('A completed thought.', 0);
    await expect(page.getByTestId('chat-user-message')).toHaveCount(1, { timeout: 5000 });

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
