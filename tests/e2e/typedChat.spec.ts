import { test, expect, type Page } from '@playwright/test';

/**
 * Typed messages with no voice call go to the same brain as the voice (the chat route and its app tool). Reviews, 4 Nov 2026: before this,
 * a typed question got a coaching template, "set a timer" got "Morphed into Timer (7-Fold AI Morph)!", and "remember…" saved nothing.
 * The model is stubbed (CI has no model keys): this tests the client path, the real model is covered by the soak and persona runs.
 */
async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

const sse = (delta: object) => ({
  status: 200,
  headers: { 'content-type': 'text/event-stream' },
  body: `data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`,
});

async function stubModel(page: Page) {
  const asked: string[] = [];
  await page.route('**/api/voice/chat', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const body = route.request().postDataJSON() as { messages: Array<{ role: string; content: string | null }>; withTools?: boolean };
    const last = [...body.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const tail = body.messages.at(-1);
    if (tail?.role === 'tool') return route.fulfill(sse({ content: 'Done.' })); // the follow-up after a tool call
    asked.push(last);
    if (/timer/i.test(last)) return route.fulfill(sse({ tool_calls: [{ id: 'c1', function: { name: 'app', arguments: JSON.stringify({ action: 'timer_start', minutes: 10 }) } }] }));
    if (/remember/i.test(last)) return route.fulfill(sse({ tool_calls: [{ id: 'c2', function: { name: 'app', arguments: JSON.stringify({ action: 'memory_add', value: 'I focus best with lofi on' }) } }] }));
    return route.fulfill(sse({ content: 'Stub reply: the clock starts when you say so.' }));
  });
  return asked;
}

async function send(page: Page, text: string) {
  await page.waitForTimeout(450); // the app ignores a second message inside 350 ms (double-tap guard)
  await page.getByTestId('task-input').fill(text);
  await page.getByTestId('send').click();
}

test.describe('Typed chat: one brain', () => {
  test('a question, a timer, and a memory, typed, go to the model and its app tool', async ({ page }) => {
    await onboard(page);
    const asked = await stubModel(page);

    await send(page, 'how do plants make food?');
    await expect(page.locator('body')).toContainText('Stub reply: the clock starts when you say so.');
    expect(asked).toHaveLength(1); // a question is not turned into a plan card

    await send(page, 'set a 10 minute timer');
    expect(await page.locator('body').innerText()).not.toMatch(/Morph|AI Morph|game move/i);
    await expect(page.getByTestId('stop-timer').or(page.getByText(/10:00|9:5\d/)).first()).toBeVisible({ timeout: 10_000 });

    await send(page, 'remember that I focus best with lofi on');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('stay_user_memory_v1') ?? ''), { timeout: 10_000 }).toMatch(/lofi/i);
  });
});
