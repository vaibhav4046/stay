import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { askStay } from './helpers/askStay';

const SHOTS = 'docs/evidence/chat-first';

async function openHome(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

async function say(page: Page, text: string) {
  await page.waitForTimeout(1300); // the app ignores an identical or instant second message (double-tap guard)
  await page.getByTestId('task-input').fill(text);
  await page.getByTestId('send').click();
}

const panel = (page: Page) => page.getByTestId('inline-panel');

test.describe('Chat-first home: the conversation builds the screen', () => {
  test('the empty home is only the orb and the composer (type, talk, call)', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await openHome(page);
    await expect(page.getByTestId('orb-stage')).toHaveAttribute('data-compact', 'false');
    await expect(page.getByTestId('orb-button')).toBeVisible();
    await expect(page.getByTestId('task-input')).toBeVisible();
    await expect(page.getByTestId('mic-button')).toBeVisible();
    await expect(page.getByTestId('call-direct-stay-btn')).toBeVisible();
    for (const gone of ['caption', 'state-chips', 'today-card', 'daily-greeting', 'call-stay-card', 'header-call-stay-btn', 'chat-stream', 'inline-panel']) {
      await expect(page.getByTestId(gone), gone).toHaveCount(0);
    }
    for (const text of ['Tap the orb to talk', 'What are you putting off?']) {
      await expect(page.getByText(text)).toHaveCount(0);
    }
    await page.screenshot({ path: `${SHOTS}/01-empty-home.png` });
  });

  test('asking for history, brain dump, routines, memory and the list opens each one inside the conversation', async ({ page }) => {
    await openHome(page);

    await say(page, 'show my history');
    await expect(panel(page)).toHaveAttribute('data-panel', 'History');
    await expect(page.getByTestId('history-open-full')).toBeVisible();
    // the panel is in the page flow, not a modal over it
    expect(await page.getByRole('dialog').count()).toBe(0);
    await page.screenshot({ path: `${SHOTS}/02-history-in-chat.png` });

    await say(page, 'open brain dump');
    await expect(panel(page)).toHaveAttribute('data-panel', 'Brain dump');
    await expect(page.getByTestId('dump-input')).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/03-brain-dump-in-chat.png` });

    await say(page, 'show my routines');
    await expect(panel(page)).toHaveAttribute('data-panel', 'Routines');

    await say(page, 'what do you remember about me');
    await expect(panel(page)).toHaveAttribute('data-panel', 'What Stay remembers');

    await say(page, 'show my to-do list');
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(page.getByTestId('wins-count')).toBeVisible();

    // the words are still there above the panels, top to bottom
    await expect(page.getByTestId('chat-user-message')).toHaveCount(5);
  });

  test('a panel closes with Close, and Escape closes it too', async ({ page }) => {
    await openHome(page);
    await say(page, 'show my history');
    await expect(panel(page)).toBeVisible();
    await panel(page).getByRole('button', { name: 'Close' }).click();
    await expect(panel(page)).toHaveCount(0);

    await say(page, 'show my history');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toHaveCount(0);
  });

  test('"open settings" is still a page, and "show my history" is not mistaken for an orb shape', async ({ page }) => {
    await openHome(page);
    await say(page, 'show my history');
    await expect(page.getByText(/Morphed into/)).toHaveCount(0);
    await say(page, 'open settings page');
    await expect(page).toHaveURL(/\/app\/settings/);
  });

  test('finishing a brain dump puts the sorted list in the chat', async ({ page }) => {
    await openHome(page);
    await say(page, 'open brain dump');
    await page.getByTestId('dump-input').fill('email the landlord, pay the council tax, the bins');
    await page.getByTestId('dump-sort').click();
    await expect(page.getByTestId('dump-result')).toBeVisible({ timeout: 25000 });
    await page.getByTestId('dump-result').getByRole('button', { name: 'Done', exact: true }).click();
    await expect(page.getByTestId('today-card')).toBeVisible();
    await expect(page.getByTestId('today-card')).toContainText(/start here/i);
  });

  test('the menu is six actions, and each one works without talking', async ({ page }) => {
    await openHome(page);
    const menu = page.getByRole('dialog', { name: 'More' });
    await page.getByTestId('menu-button').click();
    await expect(menu.locator('button.btn-secondary')).toHaveCount(6);
    // the top nav already has History and Settings, so the menu does not repeat them
    await expect(menu.getByRole('button', { name: /^(History|Settings)/ })).toHaveCount(0);
    await page.keyboard.press('Escape');

    for (const [id, title] of [
      ['menu-dump', 'Brain dump'],
      ['menu-routines', 'Routines'],
    ] as const) {
      await page.getByTestId('menu-button').click();
      await page.getByTestId(id).click();
      await expect(panel(page), id).toHaveAttribute('data-panel', title);
    }
    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-today').click();
    await expect(page.getByTestId('today-card')).toBeVisible();

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-ground').click();
    await expect(page.locator('#grounding-title')).toBeVisible();
    await page.getByRole('button', { name: 'Close grounding panel' }).click();

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-voice').click();
    await expect(page.getByTestId('voice-picker')).toBeVisible();
    await page.keyboard.press('Escape');

    await page.getByTestId('menu-button').click();
    await page.getByTestId('menu-quiet').click();
    await page.getByTestId('menu-button').click();
    await expect(page.getByTestId('menu-quiet')).toHaveText('Turn voice on');
  });

  test('the menu reads cleanly on a phone: left-aligned, sentence-case labels, no wrapping, no overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openHome(page);
    await page.getByTestId('menu-button').click();
    const menu = page.getByRole('dialog', { name: 'More' });
    const items = menu.locator('button.btn-secondary');
    await expect(items).toHaveCount(6);
    for (const item of await items.all()) {
      const label = (await item.innerText()).trim();
      expect(await item.evaluate((el) => getComputedStyle(el).justifyContent), label).toBe('flex-start');
      // one line: the .btn minimum height is 44px, a second line of text would push it past 52
      expect((await item.boundingBox())!.height, label).toBeLessThan(52);
    }
    for (const label of ['Calm and focus', 'Voice']) {
      const group = menu.getByText(label, { exact: true });
      await expect(group).toBeVisible();
      expect(await group.evaluate((el) => getComputedStyle(el).textTransform), label).toBe('none');
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });

  test('what is not in the menu is one ask away: history, memory, parked thoughts, check-ins, call me later', async ({ page }) => {
    await openHome(page);
    // the footer line of the menu names the ways to ask
    await page.getByTestId('menu-button').click();
    await expect(page.getByTestId('menu-asks')).toContainText('show my memory');
    await expect(page.getByTestId('menu-asks')).toContainText('show parked thoughts');
    await page.keyboard.press('Escape');

    for (const [text, call, title] of [
      ['show my history', { action: 'open', value: 'history' }, 'History'],
      ['show my memory', { action: 'open', value: 'memory' }, 'What Stay remembers'],
      ['show parked thoughts', { action: 'park_show' }, 'Parked thoughts'],
      ['show my reminders', { action: 'open', value: 'reminders' }, 'Check-ins'],
      ['have Stay call me later', { action: 'open', value: 'call me later' }, 'Call me later'],
    ] as const) {
      await askStay(page, text, call);
      await expect(panel(page), text).toHaveAttribute('data-panel', title);
    }
  });

  test('phone: the composer sits above the bottom nav, nothing overflows, and Talk and Call fit', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await openHome(page);
    const box = async (id: string) => (await page.getByTestId(id).boundingBox())!;
    const composer = await box('composer');
    const nav = await box('bottom-nav');
    expect(composer.y + composer.height).toBeLessThanOrEqual(nav.y + 1);
    for (const id of ['mic-button', 'call-direct-stay-btn', 'task-input']) {
      const b = await box(id);
      expect(b.x, id).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, id).toBeLessThanOrEqual(375);
    }
    await say(page, 'show my history');
    await expect(panel(page)).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: `${SHOTS}/04-phone-history.png` });
  });

  test('typing text hides Talk and Call and shows Send; clearing brings them back', async ({ page }) => {
    await openHome(page);
    await page.getByTestId('task-input').fill('hello');
    await expect(page.getByTestId('send')).toBeVisible();
    await expect(page.getByTestId('call-direct-stay-btn')).toHaveCount(0);
    await page.getByTestId('task-input').fill('');
    await expect(page.getByTestId('send')).toHaveCount(0);
    await expect(page.getByTestId('call-direct-stay-btn')).toBeVisible();
    await expect(page.getByTestId('mic-button')).toBeVisible();
  });
});
