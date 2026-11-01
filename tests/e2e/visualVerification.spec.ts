import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACT_DIR = process.env.STAY_ARTIFACT_DIR || path.resolve('docs', 'verification-screenshots');

function copyToArtifacts(filename: string) {
  const src = path.resolve('test-results', filename);
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  const dest = path.join(ARTIFACT_DIR, filename);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
  }
}

test('Capture complete browser visual verification suite', async ({ page }) => {
  fs.mkdirSync(path.resolve('test-results'), { recursive: true });
  // Set viewport to clear, high-resolution desktop view
  await page.setViewportSize({ width: 1280, height: 960 });

  // 1. TODAY PAGE - Idle with Logo, no Face button
  await page.goto('/app/today');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  // Complete calm onboarding
  await page.getByTestId('care-self_managing').click();
  await page.getByTestId('onboarding-ack').click();
  await page.getByTestId('onboarding-done').click();
  await expect(page.getByTestId('task-input')).toBeVisible();

  // Confirm face button has no visible presence (sr-only)
  const faceButton = page.locator('#face-toggle');
  if ((await faceButton.count()) > 0) {
    await expect(faceButton).not.toBeVisible();
  }

  // Ensure Talk to Stay button is visible
  const talkBtn = page.getByRole('button', { name: /Talk to Stay/i });
  await expect(talkBtn).toBeVisible();

  // Screenshot 1: Today full screen (avatar, logo in capsule, no face button, proactive buttons)
  const shot1 = '01-today-idle-with-logo-no-face.png';
  await page.screenshot({ path: path.join('test-results', shot1) });
  copyToArtifacts(shot1);

  // Screenshot 2: Closeup of the Talk to Stay capsule with the StayLogo on the left
  const shot2 = '02-talk-to-stay-capsule-closeup.png';
  await talkBtn.screenshot({ path: path.join('test-results', shot2) });
  copyToArtifacts(shot2);

  // 2. OPEN VOICE PICKER
  await page.getByTestId('menu-button').click();
  await page.getByRole('button', { name: 'Voice and language' }).click();
  const voicePicker = page.getByTestId('voice-picker');
  await expect(voicePicker).toBeVisible();

  // Screenshot 3: Recommended voice cards with 3D dot glyph logos
  const shot3 = '03-voice-picker-recommended-cards.png';
  await page.screenshot({ path: path.join('test-results', shot3) });
  copyToArtifacts(shot3);

  // Open "More voices" details disclosure
  const moreDetails = page.getByTestId('voice-more');
  await moreDetails.locator('summary').click();

  // Locate Card 22: Mariachi Metronome
  const mariachiCard = page.getByTestId('voice-mariachi');
  await expect(mariachiCard).toBeVisible();
  await mariachiCard.scrollIntoViewIfNeeded();

  // Hover over Card 22 to engage 3D transform animation
  await mariachiCard.hover();
  await page.waitForTimeout(400);

  // Screenshot 4: Card 22 Mariachi Metronome hovered with 3D transform
  const shot4 = '04-card-22-mariachi-metronome-hover.png';
  await page.screenshot({ path: path.join('test-results', shot4) });
  copyToArtifacts(shot4);

  // 3. DIRECT CLICK ON A VOICE CARD (ElevenLabs UX)
  // Click Audrey directly on the card
  const eveCard = page.getByTestId('voice-eve');
  await eveCard.scrollIntoViewIfNeeded();
  await eveCard.click();

  // Verify active selection ring
  await expect(eveCard).toHaveClass(/!border-primary/);

  // Screenshot 5: Direct clicked voice card with active border
  const shot5 = '05-voice-card-direct-click-selected.png';
  await eveCard.screenshot({ path: path.join('test-results', shot5) });
  copyToArtifacts(shot5);

  // Close sheet and verify armed receipt on Today screen
  await page.keyboard.press('Escape');
  await expect(page.getByText(/Audrey armed — ready to speak/)).toBeVisible();

  // Screenshot 6: Armed voice receipt confirmation on Today screen
  const shot6 = '06-voice-armed-today-receipt.png';
  await page.screenshot({ path: path.join('test-results', shot6) });
  copyToArtifacts(shot6);

  // 4. LANDING PAGE - MATHEMATICAL 5,200 DOT COUNT AUDIT
  await page.goto('/');
  await page.waitForTimeout(500);

  const section = page.getByText('The 5,200-dot procedural therapist figure');
  await section.scrollIntoViewIfNeeded();

  // the count is computed from the drawn buffer, not asserted
  await expect(page.getByTestId('dot-count')).toContainText('Dots in the point buffer: 5,200');
  await expect(page.getByTestId('dot-count')).toContainText('All coordinates finite: yes');

  // Screenshot 7: Mathematical 5,200 dot count audit and verifier
  const shot7 = '07-landing-5200-dot-count-verifier.png';
  await page.screenshot({ path: path.join('test-results', shot7) });
  copyToArtifacts(shot7);
});
