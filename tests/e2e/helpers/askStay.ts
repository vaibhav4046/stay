import type { Page } from '@playwright/test';

/**
 * Panels that are not in the More menu (history, memory, parked thoughts, check-ins, call me later) open when the person asks: the typed
 * message goes to the model, which opens them through Stay's app tool. This types the message and answers that one turn as the model
 * would, with the tool call, so the panel opens without a live model while the real client code (send, tool call, panel) still runs.
 * Only that turn is answered here: anything the test sends afterwards goes to the server as usual.
 */
export async function askStay(page: Page, text: string, call: { action: string; value?: string }) {
  let toolServed = false;
  let followUpServed = false;
  const sse = (delta: object) => ({
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
    body: `data: ${JSON.stringify({ choices: [{ delta }] })}\n\ndata: [DONE]\n\n`,
  });
  await page.route('**/api/voice/chat', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    const { withTools } = route.request().postDataJSON() as { withTools?: boolean };
    if (withTools && !toolServed) {
      toolServed = true;
      return route.fulfill(sse({ tool_calls: [{ id: 'call-1', function: { name: 'app', arguments: JSON.stringify(call) } }] }));
    }
    if (!withTools && toolServed && !followUpServed) {
      followUpServed = true;
      return route.fulfill(sse({ content: 'Here it is.' }));
    }
    return route.fallback();
  });
  await page.waitForTimeout(1300); // the app ignores an identical or instant second message (double-tap guard)
  await page.getByTestId('task-input').fill(text);
  await page.getByTestId('send').click();
}
