import { expect, test, type Page } from '@playwright/test';

/**
 * The reply-length learning reaches the model: when this person has often cut in, the notes sent with their next message say to keep replies to one
 * short sentence; when they have not, or learning is off, the notes say nothing about it. The model is stubbed (CI has no model keys), so this
 * checks exactly what the app sends.
 */
const STYLE = 'stay_reply_style_v1';
const LINE = /keep each reply to one short sentence/i;

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

async function captureNotes(page: Page) {
  const notes: string[] = [];
  await page.route('**/api/voice/chat', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    notes.push((route.request().postDataJSON() as { context?: { personal?: string } }).context?.personal ?? '');
    return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream' }, body: `data: ${JSON.stringify({ choices: [{ delta: { content: 'Stub reply.' } }] })}\n\ndata: [DONE]\n\n` });
  });
  return notes;
}

async function ask(page: Page) {
  await page.waitForTimeout(450);
  await page.getByTestId('task-input').fill('how do plants make food?');
  await page.getByTestId('send').click();
  await expect(page.locator('body')).toContainText('Stub reply.');
}

const cutIns = (n: number) => Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? 'r' : 'c'));

test('after many cut-ins, the notes sent with the next message ask for short replies', async ({ page }) => {
  await onboard(page);
  const notes = await captureNotes(page);
  await page.evaluate(([k, events]) => localStorage.setItem(k as string, JSON.stringify({ v: 1, events })), [STYLE, cutIns(8)]);
  await ask(page);
  expect(notes.at(-1)).toMatch(LINE);
});

test('with no cut-ins, or too few to tell, it says nothing about length', async ({ page }) => {
  await onboard(page);
  const notes = await captureNotes(page);
  await ask(page);
  expect(notes.at(-1)).not.toMatch(LINE);
  await page.evaluate(([k, events]) => localStorage.setItem(k as string, JSON.stringify({ v: 1, events })), [STYLE, cutIns(3)]);
  await ask(page);
  expect(notes.at(-1)).not.toMatch(LINE);
});

test('with learning switched off it never does', async ({ page }) => {
  await onboard(page);
  const notes = await captureNotes(page);
  await page.evaluate(([k, events]) => {
    localStorage.setItem(k as string, JSON.stringify({ v: 1, events }));
    localStorage.setItem('stay_patience_enabled_v1', '0');
  }, [STYLE, cutIns(8)]);
  await ask(page);
  expect(notes.at(-1)).not.toMatch(LINE);
});
