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
      ['ice cream', /^icecream$/],
      ['my taxes', /^coin$/],
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
    await page.getByTestId('hero-input').fill('ice cream');
    await expect.poll(() => shapeOf(page, '[data-testid="hero-orb"] [data-shape]')).toBe('icecream');
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
    await page.getByTestId('task-input').fill('I need some ice cream');
    await page.getByTestId('send').click();
    await expect.poll(() => shapeOf(page), { timeout: 8000 }).toBe('icecream');
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
