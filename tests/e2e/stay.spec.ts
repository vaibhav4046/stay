import { test, expect } from '@playwright/test';

test.describe('Stay — End-to-End Test Suite', () => {
  test('Landing page renders correctly with core proposition and links', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Make starting easier.' })).toBeVisible();
    await expect(page.getByTestId('hero-demo')).toBeVisible();
    await expect(page.getByTestId('crisis-help-trigger')).toBeVisible();

    // Verify clinical boundary text is prominent
    await expect(page.getByText('Not a medical device. No diagnosis. No medication advice.')).toBeVisible();
  });

  test('Crisis panel opens and displays fixed UK emergency services', async ({ page }) => {
    await page.goto('/');
    const crisisBtn = page.getByTestId('crisis-help-trigger');
    await crisisBtn.click();

    const panel = page.getByTestId('crisis-panel');
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Emergency Services (UK)')).toBeVisible();
    await expect(panel.getByRole('link', { name: '999' })).toBeVisible();
    await expect(panel.getByRole('link', { name: '111' })).toBeVisible();
    await expect(panel.getByRole('link', { name: '116 123' })).toBeVisible();

    // Close on Escape
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
  });

  test('Demo page: full closed loop (task capture -> barrier -> plan -> timer -> outcome -> report)', async ({ page }) => {
    await page.goto('/demo');

    // 1. Check sample data warning banner
    const demoBanner = page.getByTestId('demo-banner');
    await expect(demoBanner).toBeVisible();
    await expect(demoBanner).toContainText('Sample data');

    // 2. Task capture in quiet/text mode
    const taskInput = page.getByTestId('task-input');
    await expect(taskInput).toBeVisible();
    await taskInput.fill('Organise my work inbox before Monday team sync');
    await page.getByTestId('task-continue').click();

    // 3. Select barrier
    await expect(page.getByTestId('barrier-overwhelm')).toBeVisible();
    await page.getByTestId('barrier-overwhelm').click();
    await page.getByTestId('get-plan').click();

    // 4. Verify plan panel
    const planPanel = page.getByTestId('plan-panel');
    await expect(planPanel).toBeVisible();
    await expect(page.getByTestId('plan-first-step')).toBeVisible();
    await expect(page.getByTestId('plan-strategy')).toBeVisible();

    // 5. Start focus timer
    await page.getByTestId('start-timer').click();
    const timerPanel = page.getByTestId('timer-panel');
    await expect(timerPanel).toBeVisible();
    await expect(page.getByTestId('timer-clock')).toBeVisible();

    // 6. End block and capture outcome
    await page.getByTestId('end-early').click();
    const outcomePanel = page.getByTestId('outcome-panel');
    await expect(outcomePanel).toBeVisible();
    await page.getByTestId('outcome-started').click();

    // 7. Verify logged panel
    const donePanel = page.getByTestId('done-panel');
    await expect(donePanel).toBeVisible();
    await expect(donePanel).toContainText('Nice. You got moving.');

    // 8. Test Check-in tab
    await page.getByTestId('demo-tab-checkin').click();
    await expect(page.getByTestId('checkin-form')).toBeVisible();
    await page.getByTestId('taken-taken').click();
    await page.getByTestId('focus-4').click();
    await page.getByTestId('sleep-3').click();
    await page.getByTestId('checkin-submit').click();
    await expect(page.getByText('Saved.')).toBeVisible();

    // 9. Test Clinician Report tab and PDF preview
    await page.getByTestId('demo-tab-report').click();
    await expect(page.getByTestId('report-preview')).toBeVisible();
    await expect(page.getByTestId('export-pdf')).toBeVisible();
  });

  test('App: Onboarding gate, workspace, history, settings, and data erasure', async ({ page }) => {
    // Clear localStorage to test fresh onboarding
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Onboarding questions
    await expect(page.getByTestId('onboarding')).toBeVisible();
    await page.getByTestId('care-waitlisted').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();

    // Main workspace should now be visible
    await expect(page.getByTestId('task-input')).toBeVisible();

    // Navigate to History
    await page.goto('/app/history');
    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible();

    // Navigate to Settings and verify export & delete
    await page.goto('/app/settings');
    await expect(page.getByTestId('export-json')).toBeVisible();
    await page.getByTestId('delete-start').click();
    await expect(page.getByTestId('delete-confirm')).toBeVisible();
  });

  test('Privacy and Terms routes load without error', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();

    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Terms and safety' })).toBeVisible();
  });
});
