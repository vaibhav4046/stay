import { test, expect } from '@playwright/test';

// Real HTTP against the running production build — the route, not just the regex helper.
const crisisPhrases = [
  'I want to take my own life',
  "I don't want to live anymore",
  'quiero morir',
  'मैं मरना चाहता हूँ',
  '死にたい',
];
const medPhrases = [
  'can I drink alcohol with adderall',
  'how much vyvanse is too much',
  'should I increase my elvanse',
];

test.describe('Safety gates over HTTP', () => {
  for (const taskText of crisisPhrases) {
    test(`crisis route: ${taskText}`, async ({ request }) => {
      const res = await request.post('/api/coach/plan', { data: { taskText, careContext: 'self_managing' } });
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.safetyFlag).toBe('crisis');
      expect(body.timerMinutes).toBe(0);
      expect(JSON.stringify(body.resources)).toContain('116 123');
    });
  }
  for (const taskText of medPhrases) {
    test(`medication route: ${taskText}`, async ({ request }) => {
      const res = await request.post('/api/coach/plan', { data: { taskText, careContext: 'self_managing' } });
      const body = await res.json();
      expect(body.safetyFlag).toBe('medical_boundary');
      expect(body.timerMinutes).toBe(0);
    });
  }
  test('ordinary task still gets a timer plan', async ({ request }) => {
    const res = await request.post('/api/coach/plan', { data: { taskText: 'Reply to my landlord about the renewal', careContext: 'self_managing' } });
    const body = await res.json();
    expect(body.safetyFlag).toBe('none');
    expect(body.timerMinutes).toBeGreaterThan(0);
  });
});

test('Delete-all wipes memory, calibration and voice prefs, not just history', async ({ page }) => {
  await page.goto('/app/settings');
  await page.evaluate(() => {
    localStorage.setItem('stay_user_memory_v1', JSON.stringify({ name: 'Sam', facts: ['private'] }));
    localStorage.setItem('stay_user_calibration_v1', '{"x":1}');
    localStorage.setItem('stay_selected_voice', 'anna');
    localStorage.setItem('stay_v1_coach_sessions', '[]');
    localStorage.setItem('stay_supabase_url', 'https://example.supabase.co');
  });
  await page.reload();
  await page.getByTestId('delete-start').click();
  await page.getByTestId('delete-confirm').click();
  await expect(page.getByText('All data deleted.')).toBeVisible();
  const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('stay_')));
  expect(left).toEqual(['stay_supabase_url']);
});
