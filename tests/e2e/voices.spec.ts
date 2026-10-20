import { expect, test, type Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

/** Pretend the device has exactly the voices this Windows machine reports: two Indian English, no Mexican Spanish. */
async function withDeviceVoices(page: Page) {
  await page.addInitScript(() => {
    const voices = [
      { name: 'Microsoft David - English (United States)', lang: 'en-US', localService: true, default: true, voiceURI: 'david' },
      { name: 'Microsoft Ravi - English (India)', lang: 'en-IN', localService: true, default: false, voiceURI: 'ravi' },
      { name: 'Microsoft Heera - English (India)', lang: 'en-IN', localService: true, default: false, voiceURI: 'heera' },
    ];
    window.speechSynthesis.getVoices = () => voices as unknown as SpeechSynthesisVoice[];
  });
}

async function openVoices(page: Page) {
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  await expect(page.getByTestId('voice-picker')).toBeVisible();
}

test.describe('accurate voices', () => {
  test('Indian English works from the device voice; Mexican Spanish says exactly what it needs, then works with an Azure key', async ({ page }) => {
    await withDeviceVoices(page);
    await onboard(page);
    await openVoices(page);

    // Indian English: the device's own en-IN voice, named
    await expect(page.getByTestId('voice-engine-cardamom')).toHaveText('Browser voice: Microsoft Heera - English (India)');
    await expect(page.getByTestId('voice-cardamom')).toHaveAttribute('data-usable', 'true');
    // Mexican Spanish: no es-MX voice here, so it is not offered as a stand-in
    const taco = page.getByTestId('voice-taco');
    await expect(taco).toHaveAttribute('data-usable', 'false');
    await expect(taco).toContainText('Needs an Azure Speech key');
    await expect(page.getByTestId('preview-taco')).toBeDisabled();
    await taco.getByRole('button', { name: /^Taco Tornado/ }).click();
    expect(await page.evaluate(() => localStorage.getItem('stay_selected_voice'))).not.toBe('taco');

    // choosing the usable Indian English voice sticks
    await page.getByTestId('voice-cardamom').getByRole('button', { name: /^Cardamom Calm/ }).click();
    await expect(page.getByTestId('voice-cardamom').getByRole('button', { name: /^Cardamom Calm/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('stay_selected_voice'))).toBe('cardamom');

    // an Azure key makes Mexican Spanish available, and picking it moves the conversation to Spanish
    await page.getByTestId('voice-engines').locator('summary').click();
    await page.getByTestId('tts-key').fill('k'.repeat(32));
    await page.getByTestId('tts-region').fill('centralindia');
    await expect(page.getByTestId('voice-engine-taco')).toHaveText('Azure Neural: Dalia');
    await expect(taco).toHaveAttribute('data-usable', 'true');
    await taco.getByRole('button', { name: /^Taco Tornado/ }).click();
    await expect(taco.getByRole('button', { name: /^Taco Tornado/ })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => localStorage.getItem('stay_selected_voice'))).toBe('taco');
    expect(await page.evaluate(() => localStorage.getItem('stay_selected_language'))).toMatch(/^es/);

    // the key lives in this browser only, and not in the shared byok headers
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('stay_byok') || '{}'));
    expect(stored.ttsRegion).toBe('centralindia');
    await page.screenshot({ path: 'test-results/voices-picker.png', fullPage: false });
  });

  test('previews: AssemblyAI voices play a shipped clip; Azure voices go through the relay with the person’s key', async ({ page }) => {
    await withDeviceVoices(page);
    const calls: Array<{ url: string; headers: Record<string, string>; body: string }> = [];
    await page.route('**/api/voice/tts', async (route) => {
      calls.push({ url: route.request().url(), headers: route.request().headers(), body: route.request().postData() || '' });
      await route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.alloc(48000) });
    });
    await onboard(page);
    await openVoices(page);

    const clip = page.waitForResponse((r) => r.url().endsWith('/voices/previews/anna.mp3'));
    await page.getByTestId('preview-anna').click();
    const res = await clip;
    expect([200, 206]).toContain(res.status());
    expect(res.headers()['content-type']).toMatch(/audio\/(mpeg|mp3)/);
    await page.getByTestId('preview-anna').click(); // stop

    await page.getByTestId('voice-engines').locator('summary').click();
    await page.getByTestId('tts-key').fill('k'.repeat(32));
    await page.getByTestId('tts-region').fill('centralindia');
    await page.getByTestId('preview-taco').click();
    await expect.poll(() => calls.length).toBeGreaterThan(0);
    const sent = JSON.parse(calls[0].body);
    expect(sent.voice).toBe('es-MX-DaliaNeural');
    expect(sent.locale).toBe('es-MX');
    expect(sent.text).toContain('Taco Tornado');
    expect(calls[0].headers['x-stay-tts-key']).toBe('k'.repeat(32));
    expect(calls[0].headers['x-stay-tts-region']).toBe('centralindia');

    await page.getByTestId('tts-check').click();
    await expect(page.getByRole('status').filter({ hasText: /key works|almost no audio/ })).toBeVisible();
  });

  test('the speech key never rides on chat or token requests', async ({ page }) => {
    await onboard(page);
    await page.evaluate(() => localStorage.setItem('stay_byok', JSON.stringify({ provider: 'default', llmKey: '', model: '', baseUrl: '', assemblyKey: '', ttsKey: 'k'.repeat(32), ttsRegion: 'eastus' })));
    const seen: string[] = [];
    page.on('request', (r) => { if ('x-stay-tts-key' in r.headers() && !r.url().includes('/api/voice/tts')) seen.push(r.url()); });
    await page.reload();
    await page.getByTestId('task-input').fill('Sort the paperwork pile in the hallway');
    await page.getByTestId('send').click();
    await expect(page.getByTestId('plan-card')).toBeVisible({ timeout: 20000 });
    expect(seen).toEqual([]);
  });
});
