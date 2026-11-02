import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { installFakeFastVoice } from './helpers/fakeFastVoice';

/**
 * T4.3: axe finds no serious or critical violation on the pages a visitor sees, and nothing scrolls sideways from 320 px to 1920 px.
 * Axe checks what a machine can check (names, roles, contrast, landmarks); it does not replace a person using a screen reader.
 */
test.use({
  permissions: ['microphone'],
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] },
});

const WIDTHS = [320, 375, 768, 1024, 1440, 1920];

async function violations(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}) e.g. ${v.nodes[0]?.target.join(' ')}`);
}

async function onboard(page: Page) {
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();
}

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('accessibility (axe, serious and critical only)', () => {
  test('landing page', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(800);
    expect(await violations(page)).toEqual([]);
  });

  test('the first screen of the app', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await onboard(page);
    expect(await violations(page)).toEqual([]);
  });

  test('onboarding', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/app/today');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForTimeout(500);
    expect(await violations(page)).toEqual([]);
  });

  test('during a call, with words on screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay. Open the email and type one word. Want to do that now?' });
    await onboard(page);
    await page.getByTestId('mic-button').click();
    await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
    fake.pushSttFinal('I need to reply to my landlord and I keep avoiding it.', 0);
    await expect(page.getByTestId('chat-agent-message').last()).toContainText('Open the email', { timeout: 10000 });
    expect(await violations(page)).toEqual([]);
  });

  test('the menu and the voice picker', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await onboard(page);
    await page.getByTestId('menu-button').click();
    await page.waitForTimeout(500);
    expect(await violations(page), 'menu').toEqual([]);
  });
});

test.describe('nothing scrolls sideways', () => {
  for (const width of WIDTHS) {
    test(`landing at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.waitForTimeout(800);
      expect(await overflow(page)).toBeLessThanOrEqual(1);
    });
    test(`app at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await onboard(page);
      expect(await overflow(page)).toBeLessThanOrEqual(1);
    });
  }
});

test('the whole first screen can be reached and used with the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await onboard(page);
  const reached = new Set<string>();
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return '';
      const rect = el.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      return visible ? el.getAttribute('data-testid') || el.getAttribute('aria-label') || el.tagName : 'hidden:' + el.tagName;
    });
    if (label) reached.add(label);
  }
  // the controls a person needs to talk, type and open the menu can be focused in order
  expect([...reached].filter((l) => l.startsWith('hidden:')), 'focus landed on something invisible').toEqual([]);
  expect(reached.has('orb-button') || reached.has('Talk to Stay')).toBe(true);
  expect(reached.has('menu-button') || reached.has('More')).toBe(true);
});

test('reduced motion: the orb moves to its small place with no animation, and the call still works', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  // count every animation started on the orb (the glide uses element.animate)
  await page.addInitScript(() => {
    const w = window as unknown as { __orbAnimations: number };
    w.__orbAnimations = 0;
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element['animate']>) {
      if (this.closest('[data-glide]')) w.__orbAnimations += 1;
      return original.apply(this, args);
    };
  });
  const fake = await installFakeFastVoice(page, { chatReplyText: 'Okay. Open the email and type one word. Want to do that now?' });
  await onboard(page);
  await page.getByTestId('mic-button').click();
  await expect(page.getByTestId('orb-status')).toHaveText('Listening', { timeout: 10000 });
  fake.pushSttPartial('I need to', 0);
  await expect(page.getByTestId('orb-stage')).toHaveAttribute('data-compact', 'true', { timeout: 5000 });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => (window as unknown as { __orbAnimations: number }).__orbAnimations), 'the orb was animated although the person asked for reduced motion').toBe(0);
});
