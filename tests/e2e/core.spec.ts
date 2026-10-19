import { test, expect, type Page, type Browser } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

async function runLoop(page: Page, task: string, outcomeKey = 'started') {
  await page.getByTestId('task-input').fill(task);
  await page.getByTestId('send').click();
  await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('first-step')).not.toBeEmpty();
  await page.getByTestId('start-timer').click();
  await expect(page.getByTestId('clock')).toBeVisible();
  await page.getByTestId('stop-timer').click();
  await page.getByTestId(`outcome-${outcomeKey}`).click();
  await expect(page.getByTestId('done-card')).toBeVisible();
}

const shapeOf = (page: Page, root = '[data-shape]') => page.locator(root).first().getAttribute('data-shape');

test.describe('Landing', () => {
  test('promise, real orb, and no demo surfaces', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText("Start the thing you've been avoiding.");
    await page.waitForSelector('[data-testid="hero-orb"] canvas');
    await expect(page.getByTestId('hero-start')).toBeVisible();
    await expect(page.getByText(/not a diagnosis/i).first()).toBeVisible();
    for (const banned of ['Interactive Preview', 'Try the demo', 'Guided preview', 'example data', 'AGI']) {
      await expect(page.getByText(banned, { exact: false })).toHaveCount(0);
    }
    expect((await page.request.get('/demo')).status()).toBe(404);
  });

  test('typing words reshapes the orb: library, offline emoji, and a fallback for anything', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-orb"] canvas');
    const input = page.getByTestId('hero-input');
    const cases: Array<[string, RegExp]> = [
      ['my taxes', /^coin$/],
      ['I feel overwhelmed', /^tangle$/],
      ['stuck on the first step', /^stairs$/],
      ['I have no energy', /^battery$/],
      ['zebra', /^emoji:/],
      ['hedgehog', /^emoji:/], // not in any local table: drawn by the shape service
      ['landlord email', /^envelope$/],
    ];
    for (const [text, expected] of cases) {
      await input.fill(text);
      await expect.poll(() => shapeOf(page, '[data-testid="hero-orb"] [data-shape]'), { timeout: 8000 }).toMatch(expected);
    }
  });

  test('crisis wording never turns into a playful shape', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('hero-input').fill('my taxes');
    await expect.poll(() => shapeOf(page, '[data-testid="hero-orb"] [data-shape]')).toBe('coin');
    await page.getByTestId('hero-input').fill('I want to take my own life');
    await expect.poll(() => shapeOf(page, '[data-testid="hero-orb"] [data-shape]'), { timeout: 5000 }).toBe('orb');
  });

  test('the orb is drawn with dots only (canvas has coloured pixels, no img or svg overlay)', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="hero-orb"] canvas');
    await page.waitForTimeout(1200);
    await expect(page.locator('[data-testid="hero-orb"] img, [data-testid="hero-orb"] svg')).toHaveCount(0);
    const shot = await page.getByTestId('hero-orb').screenshot();
    expect(shot.length).toBeGreaterThan(8000); // a blank canvas compresses to almost nothing
  });
});

test.describe('The loop', () => {
  test('say it, shrink it, start it, log it, see it in history', async ({ page }) => {
    await onboard(page);
    await runLoop(page, 'Reply to my landlord about the renewal');
    await page.goto('/app/history');
    await expect(page.getByText(/landlord/i).first()).toBeVisible();
  });

  test('a task typed on the landing page is handed to the app once, not through the URL', async ({ page }) => {
    await onboard(page);
    await page.goto('/');
    await page.getByTestId('hero-input').fill('write my dissertation introduction');
    await page.getByTestId('hero-start').click();
    await expect(page).toHaveURL(/\/app\/today$/);
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => sessionStorage.getItem('stay_handoff_task'))).toBeNull();
  });

  test('the orb in the app reshapes with what you type', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('task-input').fill('I feel so overwhelmed');
    await page.getByTestId('send').click();
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('tangle');
  });
});

test.describe('Safety', () => {
  test('crisis wording stops coaching and shows UK emergency help', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('task-input').fill('I want to take my own life');
    await page.getByTestId('send').click();
    await expect(page.getByText('116 123').first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('plan-card')).toHaveCount(0);
  });

  test('a dosing question gets the boundary, never a plan', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('task-input').fill('should I increase my elvanse dose');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('note')).toContainText(/prescri|pharmac|clinician/i, { timeout: 8000 });
    await expect(page.getByTestId('plan-card')).toHaveCount(0);
  });
});

test.describe('Menu and memory', () => {
  test('new users start with an empty memory, and the sheet works', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('menu-button').click();
    await page.getByRole('button', { name: 'What Stay remembers' }).click();
    await expect(page.getByTestId('memory-list')).toContainText(/nothing yet/i);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

test('the voice sheet lists all 16 named voices, honest about which are native accents', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Captain Crumpet', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Goblin Mode Gus', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Native Spanish voice').first()).toBeVisible();
  await expect(dialog.getByText('British voice').first()).toBeVisible();
  expect(await dialog.locator('button.chip', { hasText: /voice/i }).count()).toBeGreaterThanOrEqual(16);
});

test('two people on two browsers never see each other’s history', async ({ browser }: { browser: Browser }) => {
  test.setTimeout(75_000); // two onboardings and a full loop; slower over a real network
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await onboard(a);
  await onboard(b);
  await runLoop(a, 'Sort my VAT paperwork');
  await b.goto('/app/history');
  await expect(b.getByText(/VAT/i)).toHaveCount(0);
  await a.goto('/app/history');
  await expect(a.getByText(/VAT/i).first()).toBeVisible();
});

test.describe('Your own keys and block lengths', () => {
  test('own-key settings: a private address is refused, the choice survives a reload, and removal clears it', async ({ page }) => {
    await onboard(page);
    await page.goto('/app/settings');
    await page.getByTestId('provider-custom').click();
    await page.getByTestId('llm-key').fill('sk-test-key-123');
    await page.getByTestId('llm-base').fill('https://127.0.0.1/v1');
    await page.getByTestId('llm-model').fill('some-model');
    await page.getByTestId('llm-check').click();
    await expect(page.getByTestId('keys-section')).toContainText(/not allowed/i, { timeout: 8000 });
    await page.reload();
    await expect(page.getByTestId('provider-custom')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('llm-key')).toHaveValue('sk-test-key-123');
    await page.getByTestId('keys-clear').click();
    await expect(page.getByTestId('provider-default')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('stay_byok'))).toBeNull();
  });

  test('delete-all-data also removes saved keys', async ({ page }) => {
    await onboard(page);
    await page.goto('/app/settings');
    await page.getByTestId('provider-groq').click();
    await page.getByTestId('llm-key').fill('gsk_not_real_key');
    expect(await page.evaluate(() => localStorage.getItem('stay_byok'))).not.toBeNull();
    await page.getByTestId('delete-start').click();
    await page.getByTestId('delete-confirm').click();
    await page.waitForURL(/\/app\/today/, { timeout: 8000 });
    expect(await page.evaluate(() => localStorage.getItem('stay_byok'))).toBeNull();
  });

  test('short blocks are the default and long ones are one tap away', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('task-input').fill('Reply to my landlord about the renewal');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('start-timer')).toContainText(/Start (5|10) min/);
    await page.getByRole('button', { name: '90 minute block' }).click();
    await expect(page.getByTestId('start-timer')).toContainText('Start 90 min');
  });

  test('all-day mode is a visible switch in the menu', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('menu-button').click();
    const t = page.getByTestId('companion-toggle');
    await expect(t).toContainText('off');
    await t.click();
    await expect(t).toContainText('on');
    expect(await page.evaluate(() => localStorage.getItem('stay_companion'))).toBe('1');
  });
});

test.describe('Parking lot and reply-speed readout', () => {
  test('parked thoughts list, start-from, and remove; wiped with all data', async ({ page }) => {
    await onboard(page);
    await page.evaluate(() => localStorage.setItem('stay_parking_lot', JSON.stringify([{ id: 'p-1', text: 'call the dentist', at: new Date().toISOString() }, { id: 'p-2', text: 'buy printer ink', at: new Date().toISOString() }])));
    await page.getByTestId('menu-button').click();
    await page.getByTestId('parking-open').click();
    const list = page.getByTestId('parking-list');
    await expect(list).toContainText('call the dentist');
    await page.getByRole('button', { name: 'Remove buy printer ink' }).click();
    await expect(list).not.toContainText('printer ink');
    await list.getByRole('button', { name: 'Start this' }).click();
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 15000 });
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('stay_parking_lot') || '[]').length)).toBe(0);
  });

  test('the voice sheet shows a measured-here reply speed, never a claim', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('menu-button').click();
    await page.getByRole('button', { name: 'Voice and language' }).click();
    await expect(page.getByTestId('reply-speed')).toContainText(/Talk to Stay/);
  });
});

test('fast voice is on by default, can be switched off in the voice sheet, and the choice is remembered', async ({ page }) => {
  await onboard(page);
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  const t = page.getByTestId('fast-voice-toggle');
  await expect(t).toBeChecked();
  await t.uncheck();
  expect(await page.evaluate(() => localStorage.getItem('stay_fast_voice'))).toBe('0');
  await page.reload();
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  await expect(page.getByTestId('fast-voice-toggle')).not.toBeChecked();
});

test('one typed task makes exactly one plan request and the card never jumps back after you start', async ({ page }) => {
  await onboard(page);
  const planCalls: number[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/coach/plan')) planCalls.push(Date.now()); });
  await page.getByTestId('task-input').fill('Sort the paperwork pile in the hallway');
  await page.getByTestId('send').click();
  await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('start-timer').click();
  await expect(page.getByTestId('clock')).toBeVisible();
  await page.waitForTimeout(3000); // any late plan response would land in this window
  await expect(page.getByTestId('clock')).toBeVisible();
  await expect(page.getByTestId('plan-card')).toHaveCount(0);
  expect(planCalls).toHaveLength(1);
});

test('the landing page shows measured results with their limits, and no claim against other products', async ({ page }) => {
  await page.goto('/');
  const sec = page.getByTestId('measured');
  await expect(sec).toContainText('Measured, not promised');
  await expect(sec).toContainText('about 1.2 seconds');
  await expect(sec).toContainText(/synthesized voices/i);
  await expect(sec).toContainText(/make no claim against them/i);
  await expect(page.getByText(/faster than chatgpt|beats chatgpt|better than google/i)).toHaveCount(0);
});

test.describe('Brain dump and today list', () => {
  test('dump everything, get one thing to start, tick a win, and it persists', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('chip-dump').click();
    await page.getByTestId('dump-input').fill('email the landlord, pay the council tax, call mum someday, the bins');
    await page.getByTestId('dump-sort').click();
    await expect(page.getByTestId('dump-result')).toBeVisible({ timeout: 25000 });
    await expect(page.getByTestId('dump-start')).toHaveCount(1); // exactly one thing to start
    await page.getByTestId('dump-result').getByRole('button', { name: 'Done', exact: true }).click();
    const card = page.getByTestId('today-card');
    await expect(card).toBeVisible();
    await expect(card).toContainText(/start here/i);
    await page.getByTestId('today-check').first().click();
    await expect(page.getByTestId('wins-count')).toContainText('1 win today');
    await page.reload();
    await expect(page.getByTestId('wins-count')).toContainText('1 win today');
  });

  test('a crisis in a brain dump goes to help, never into a list', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('chip-dump').click();
    await page.getByTestId('dump-input').fill('taxes, and I want to take my own life');
    await page.getByTestId('dump-sort').click();
    await expect(page.getByText('116 123').first()).toBeVisible({ timeout: 10000 });
    expect(await page.evaluate(() => localStorage.getItem('stay_today_list_v1'))).toBeNull();
  });

  test('feeling chips start a plan, and the mobile bottom nav and urgent help are reachable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await onboard(page);
    await expect(page.getByTestId('bottom-nav')).toBeVisible();
    await expect(page.getByTestId('crisis-help-trigger')).toBeVisible();
    await page.getByRole('button', { name: 'I feel overwhelmed' }).click();
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 20000 });
  });
});

test.describe('Routines, check-ins and the offline shell', () => {
  test('run the morning routine step by step and finish with a win', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('chip-routines').click();
    await page.getByTestId('routine-start-morning').click();
    await expect(page.getByTestId('routine-step')).toContainText(/water/i);
    for (let i = 0; i < 4; i++) await page.getByTestId('routine-next').click();
    await expect(page.getByTestId('routine-step')).toContainText(/ONE thing/i);
    await page.getByTestId('routine-next').click(); // Finish
    await expect(page.getByTestId('wins-count')).toContainText('1 win today');
  });

  test('a custom routine can be written and run', async ({ page }) => {
    await onboard(page);
    await page.getByTestId('chip-routines').click();
    await page.getByTestId('routine-new').click();
    await page.getByTestId('routine-name').fill('Study session');
    await page.getByTestId('routine-steps').fill(['water and snack - 3', 'phone in another room', 'open the notes - 2'].join('\n'));
    await page.getByTestId('routine-save').click();
    await expect(page.getByTestId('routine-list')).toContainText('Study session');
    await expect(page.getByTestId('routine-list')).toContainText('3 steps');
  });

  test('a check-in that is due shows up, and a new one can be set', async ({ page }) => {
    await onboard(page);
    await page.evaluate(() => localStorage.setItem('stay_reminders_v1', JSON.stringify([{ id: 'r1', text: 'is the laundry on', dueAt: Date.now() - 1000 }])));
    await page.reload();
    await expect(page.getByTestId('note')).toContainText('Check-in: is the laundry on', { timeout: 20000 });
    await page.getByTestId('menu-button').click();
    await page.getByTestId('remind-open').click();
    await page.getByTestId('remind-20').click();
    await expect(page.getByTestId('reminder-list')).toContainText('20 min');
  });

  test('the app shell registers an offline service worker', async ({ page }) => {
    await page.goto('/app/today');
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker?.getRegistration())), { timeout: 15000 }).toBe(true);
  });
});
