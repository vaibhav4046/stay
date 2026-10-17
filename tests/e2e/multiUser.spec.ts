import { test, expect } from '@playwright/test';

test.describe('Stay — Multi-User Concurrency, Executive Engine & Session Isolation E2E Suite', () => {
  test('Two concurrent users have strictly isolated onboarding, tasks, Executive Engine (Calculate/Brainstorm/Path), timers, and history', async ({
    browser,
  }) => {
    const contextA = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) UserA-Session',
    });
    const contextB = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) UserB-Session',
    });

    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await Promise.all([pageA.goto('/app/today'), pageB.goto('/app/today')]);

      await Promise.all([
        pageA.evaluate(() => localStorage.clear()),
        pageB.evaluate(() => localStorage.clear()),
      ]);
      await Promise.all([pageA.reload(), pageB.reload()]);

      // Both see onboarding gate independently
      await expect(pageA.getByTestId('onboarding')).toBeVisible();
      await expect(pageB.getByTestId('onboarding')).toBeVisible();

      // User A selects "waitlisted"; User B selects "medicated"
      await pageA.getByTestId('care-waitlisted').click();
      await pageA.getByTestId('onboarding-ack').click();
      await pageA.getByTestId('onboarding-done').click();

      await pageB.getByTestId('care-medicated').click();
      await pageB.getByTestId('onboarding-ack').click();
      await pageB.getByTestId('onboarding-done').click();

      // Switch both from Living Orb view to Grid Workspace view to test full interactive loop
      await pageA.getByTestId('switch-to-grid').click();
      await pageB.getByTestId('switch-to-grid').click();

      // Verify both arrive at independent task capture inputs
      await expect(pageA.getByTestId('task-input')).toBeVisible();
      await expect(pageB.getByTestId('task-input')).toBeVisible();

      // User A enters Task A (Taxes/Admin)
      const taskA = 'Submit overdue quarterly VAT tax report to HMRC';
      await pageA.getByTestId('task-input').fill(taskA);
      await pageA.getByTestId('task-continue').click();

      // User B enters Task B (Writing/Essay)
      const taskB = 'Write conference proposal abstract';
      await pageB.getByTestId('task-input').fill(taskB);
      await pageB.getByTestId('task-continue').click();

      // User A selects Overwhelm barrier; User B selects Perfectionism barrier
      await expect(pageA.getByTestId('barrier-overwhelm')).toBeVisible();
      await expect(pageB.getByTestId('barrier-perfectionism_or_fear')).toBeVisible();

      await pageA.getByTestId('barrier-overwhelm').click();
      await pageA.getByTestId('get-plan').click();

      await pageB.getByTestId('barrier-perfectionism_or_fear').click();
      await pageB.getByTestId('get-plan').click();

      // Verify tailored coaching plans are independent
      await expect(pageA.getByTestId('plan-panel')).toBeVisible();
      await expect(pageB.getByTestId('plan-panel')).toBeVisible();

      // Verify ADHD Executive Engine: Time Reality Calculator & Blindness Debunker
      await expect(pageA.getByTestId('executive-engine-box')).toBeVisible();
      await expect(pageB.getByTestId('executive-engine-box')).toBeVisible();

      // Tax task reality (~180m perceived vs 45s entry, 86% momentum)
      await expect(pageA.getByTestId('exec-perceived-min')).toHaveText('~180m');
      await expect(pageA.getByTestId('exec-entry-sec')).toHaveText('45s');
      await expect(pageA.getByTestId('exec-inertia-rate')).toHaveText('86%');

      // Writing task reality (~240m perceived vs 90s entry, 78% momentum)
      await expect(pageB.getByTestId('exec-perceived-min')).toHaveText('~240m');
      await expect(pageB.getByTestId('exec-entry-sec')).toHaveText('90s');
      await expect(pageB.getByTestId('exec-inertia-rate')).toHaveText('78%');

      // User B tests Brainstorm 3 Starter Angles and selects Angle 0 ('The "Garbage First Pass"')
      await pageB.getByTestId('exec-btn-brainstorm').click();
      await expect(pageB.getByTestId('exec-panel-brainstorm')).toBeVisible();
      await pageB.getByTestId('exec-angle-0').click();
      await expect(pageB.getByTestId('plan-first-step')).toContainText('write 3 terrible, messy bullet points');

      // User A tests 3-Phase Action Path Synthesis
      await pageA.getByTestId('exec-btn-path').click();
      await expect(pageA.getByTestId('exec-panel-path')).toBeVisible();
      await expect(pageA.getByTestId('exec-phase-1')).toContainText('Phase 1');
      await expect(pageA.getByTestId('exec-phase-2')).toContainText('Phase 2');
      await expect(pageA.getByTestId('exec-phase-3')).toContainText('Phase 3');

      // Verify User A does NOT see User B's task or plan
      await expect(pageA.locator('body')).not.toContainText(taskB);
      await expect(pageB.locator('body')).not.toContainText(taskA);

      // Both start focus timers
      await pageA.getByTestId('start-timer').click();
      await expect(pageA.getByTestId('timer-panel')).toBeVisible();

      await pageB.getByTestId('start-timer').click();
      await expect(pageB.getByTestId('timer-panel')).toBeVisible();

      // User A records "Started"; User B records "Did Not Start"
      await pageA.getByTestId('end-early').click();
      await pageA.getByTestId('outcome-started').click();
      await expect(pageA.getByTestId('done-panel')).toBeVisible();

      await pageB.getByTestId('end-early').click();
      await pageB.getByTestId('outcome-not_started').click();
      await expect(pageB.getByTestId('done-panel')).toBeVisible();

      // Check History isolation
      await pageA.goto('/app/history');
      await pageB.goto('/app/history');

      // User A history contains taskA, but NOT taskB
      await expect(pageA.locator('body')).toContainText(taskA);
      await expect(pageA.locator('body')).not.toContainText(taskB);

      // User B history contains taskB, but NOT taskA
      await expect(pageB.locator('body')).toContainText(taskB);
      await expect(pageB.locator('body')).not.toContainText(taskA);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Multi-user data deletion isolation: User B deletion never affects User A', async ({
    browser,
  }) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await pageA.goto('/app/today');
      await pageA.evaluate(() => {
        localStorage.clear();
        localStorage.setItem(
          'stay_v1_coach_sessions',
          JSON.stringify([
            {
              id: 'sess-a-1',
              userId: 'user-a',
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              mode: 'text',
              careContext: 'waitlisted',
              taskText: 'User A confidential work project',
              barrierType: 'overwhelm',
              strategyKey: 'task_shrinking',
              firstStep: 'Open doc',
              plannedMinutes: 10,
              actualSeconds: 600,
              outcome: 'started',
              helpfulRating: 5,
              crisisTriggered: false,
            },
          ])
        );
        localStorage.setItem(
          'stay_v1_profile',
          JSON.stringify({
            userId: 'user-a',
            careContext: 'waitlisted',
            interactionMode: 'voice_and_text',
            proactiveCheckins: true,
            onboardingCompleted: true,
            updatedAt: new Date().toISOString(),
          })
        );
      });

      await pageB.goto('/app/today');
      await pageB.evaluate(() => {
        localStorage.clear();
        localStorage.setItem(
          'stay_v1_coach_sessions',
          JSON.stringify([
            {
              id: 'sess-b-1',
              userId: 'user-b',
              createdAt: new Date().toISOString(),
              completedAt: new Date().toISOString(),
              mode: 'text',
              careContext: 'self_managing',
              taskText: 'User B private medical form',
              barrierType: 'low_energy',
              strategyKey: 'task_shrinking',
              firstStep: 'Download PDF',
              plannedMinutes: 5,
              actualSeconds: 300,
              outcome: 'partly_started',
              helpfulRating: 4,
              crisisTriggered: false,
            },
          ])
        );
        localStorage.setItem(
          'stay_v1_profile',
          JSON.stringify({
            userId: 'user-b',
            careContext: 'self_managing',
            interactionMode: 'voice_and_text',
            proactiveCheckins: true,
            onboardingCompleted: true,
            updatedAt: new Date().toISOString(),
          })
        );
      });

      // Verify initial presence in History
      await pageA.goto('/app/history');
      await expect(pageA.locator('body')).toContainText('User A confidential work project');

      await pageB.goto('/app/history');
      await expect(pageB.locator('body')).toContainText('User B private medical form');

      // User B goes to Settings and deletes all their data
      await pageB.goto('/app/settings');
      await pageB.getByTestId('delete-start').click();
      await pageB.getByTestId('delete-confirm').click();

      // Verify User B's history is wiped
      await pageB.goto('/app/history');
      await expect(pageB.locator('body')).not.toContainText('User B private medical form');

      // Verify User A's history is STILL 100% intact
      await pageA.reload();
      await expect(pageA.locator('body')).toContainText('User A confidential work project');
      await expect(pageA.locator('body')).not.toContainText('User B private medical form');
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });

  test('Concurrent multi-user API load: 3 simultaneous multilingual requests to /api/coach/plan', async ({
    page,
  }) => {
    const userPayloads = [
      {
        taskText: 'Finish drafting dissertation chapter 4',
        barrierType: 'perfectionism_or_fear',
        careContext: 'waitlisted',
      },
      {
        taskText: 'Declaración de la renta y organizar facturas',
        barrierType: 'overwhelm',
        careContext: 'self_managing',
      },
      {
        taskText: 'पेंडिंग ईमेल का जवाब देना और इनबॉक्स खाली करना',
        barrierType: 'low_energy',
        careContext: 'medicated',
      },
    ];

    const responses = await Promise.all(
      userPayloads.map((payload) =>
        page.request.post('/api/coach/plan', {
          data: payload,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );

    for (let i = 0; i < responses.length; i++) {
      const res = responses[i];
      expect(res.status()).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('firstStep');
      expect(json).toHaveProperty('strategyKey');
      expect(json).toHaveProperty('strategyLabel');
      expect(json).toHaveProperty('timerMinutes');
      expect(typeof json.firstStep).toBe('string');
      expect(json.firstStep.length).toBeGreaterThan(5);
    }
  });

  test('Responsive multi-user layout: Mobile PWA viewport vs Desktop viewport side-by-side', async ({
    browser,
  }) => {
    const mobileContext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const desktopContext = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });

    const mobilePage = await mobileContext.newPage();
    const desktopPage = await desktopContext.newPage();

    try {
      await Promise.all([mobilePage.goto('/demo'), desktopPage.goto('/demo')]);

      const mobileBodyWidth = await mobilePage.evaluate(() => document.body.scrollWidth);
      expect(mobileBodyWidth).toBeLessThanOrEqual(395);

      await expect(mobilePage.getByTestId('demo-banner')).toBeVisible();
      await expect(desktopPage.getByTestId('demo-banner')).toBeVisible();

      await expect(mobilePage.getByTestId('task-input')).toBeVisible();
      await expect(desktopPage.getByTestId('task-input')).toBeVisible();

      await Promise.all([
        mobilePage.goto('/demo/orb-diagnostic'),
        desktopPage.goto('/demo/orb-diagnostic'),
      ]);

      await expect(mobilePage.locator('h1')).toContainText('Signal Orb Diagnostic');
      await expect(desktopPage.locator('h1')).toContainText('Signal Orb Diagnostic');
    } finally {
      await mobileContext.close();
      await desktopContext.close();
    }
  });

  test('Living Voice Orb mode: messy ADHD brain-dump hook, Orb Executive Engine (Reality/Angles/Path), and Halo Sprint timer', async ({
    page,
  }) => {
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();

    // Stay in default Living Voice Orb mode — click the messy ADHD brain-dump starter hook
    await page.getByRole('button', { name: /Brain is fried, 10 tabs open/i }).click();

    // Floating ADHD First-Step Card appears with Executive Engine pills & de-jargoned task
    await expect(page.getByTestId('orb-first-step')).toBeVisible();
    await expect(page.getByTestId('orb-panel-reality')).toBeVisible();
    await expect(page.getByTestId('orb-panel-reality')).toContainText('Dread: ~180m');

    // Switch to 3 Angles in Orb card and apply Angle 0
    await page.getByTestId('orb-exec-brainstorm').click();
    await expect(page.getByTestId('orb-panel-brainstorm')).toBeVisible();
    await page.getByTestId('orb-angle-0').click();
    await expect(page.getByTestId('orb-first-step')).toContainText('write 3 terrible, messy bullet points');

    // Switch to 3-Phase Path in Orb card
    await page.getByTestId('orb-exec-path').click();
    await expect(page.getByTestId('orb-panel-path')).toBeVisible();
    await expect(page.getByTestId('orb-panel-path')).toContainText('Phase 1');

    // Start Halo Timer directly in Orb mode
    await page.getByTestId('start-halo-timer').click();
    await expect(page.getByRole('button', { name: 'Log Done' })).toBeVisible();
  });

  test('AGI Voice Commands & True Topic-Reactive Orb Shape Morphing: chaotic speech morphs, interactive shape switcher, memory, chat history, and route navigation', async ({
    page,
  }) => {
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await page.getByTestId('care-self_managing').click();
    await page.getByTestId('onboarding-ack').click();
    await page.getByTestId('onboarding-done').click();

    const input = page.getByTestId('task-input');

    // 1. Chaotic ADHD speech ("uhh my brain is fried and I'm stuck spiraling") -> auto-morphs to Mode 4 (Therapeutic Lotus Calm) without clinical jargon
    await input.fill("uhh my brain is fried and I'm stuck spiraling right now");
    await expect(page.getByTestId('orb-morph-badge')).toHaveAttribute('data-topic-shape', '4');
    await expect(page.getByTestId('orb-morph-badge')).toContainText('Therapeutic Lotus Calm');
    await expect(page.locator('[data-signal-state]').first()).toHaveAttribute('data-topic-shape', '4');

    // 2. Live Topic Shape Morphing on typing ("ice cream" -> Mode 1 Reward Swirl)
    await input.fill('I want some ice cream as a reward');
    await expect(page.getByTestId('orb-morph-badge')).toHaveAttribute('data-topic-shape', '1');
    await expect(page.getByTestId('orb-morph-badge')).toContainText('Reward Swirl');
    await expect(page.locator('[data-signal-state]').first()).toHaveAttribute('data-topic-shape', '1');

    // 3. Live Topic Shape Morphing ("write letters" -> Mode 2 Crystalline Letterforms)
    await input.fill('Write letters and tax paperwork');
    await expect(page.getByTestId('orb-morph-badge')).toHaveAttribute('data-topic-shape', '2');
    await expect(page.getByTestId('orb-morph-badge')).toContainText('Crystalline Letterforms');

    // 4. Direct Interactive Shape Switcher buttons (Creative Star Mode 3)
    await page.getByTestId('orb-shape-btn-3').click();
    await expect(page.getByTestId('orb-morph-badge')).toHaveAttribute('data-topic-shape', '3');
    await expect(page.getByTestId('orb-morph-badge')).toContainText('Creative Ribbon');

    // 5. Voice Command: "show me memory" opens Cognitive Memory panel WITHOUT triggering task decomposition
    await input.fill('show me memory');
    await input.press('Enter');
    await expect(page.locator('body')).toContainText('Voice command: Displaying user memory');
    await expect(page.getByTestId('orb-first-step')).toHaveCount(0);

    // 6. Voice Command: "close panel" closes open modals
    await input.fill('close panel');
    await input.press('Enter');
    await expect(page.locator('body')).toContainText('Voice command: Closed panels');

    // 7. Voice Command: "show me chat history" opens Session History modal
    await input.fill('show me chat history');
    await input.press('Enter');
    await expect(page.locator('body')).toContainText('Voice command: Displaying session history');

    // 8. Voice Command: "go to settings" navigates to /app/settings
    await page.keyboard.press('Escape');
    await input.fill('go to settings');
    await input.press('Enter');
    await expect(page).toHaveURL(/\/app\/settings/);
  });
});
