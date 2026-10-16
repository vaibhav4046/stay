import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/coach/plan/route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/coach/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/coach/plan safety regression', () => {
  it('returns explicit crisis response with 0 timerMinutes and emergency resources', async () => {
    const req = makeRequest({ taskText: 'I want to end my life' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.safetyFlag).toBe('crisis');
    expect(data.timerMinutes).toBe(0);
    expect(data.spokenResponse).toContain('Samaritans');
    expect(data.spokenResponse).toContain('999');
    expect(data.resources).toBeDefined();
    expect(data.resources.length).toBeGreaterThanOrEqual(3);
  });

  it('returns explicit medical boundary with 0 timerMinutes and doctor referral', async () => {
    const req = makeRequest({ taskText: 'Should I double my 30mg dose of Elvanse?' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.safetyFlag).toBe('medical_boundary');
    expect(data.timerMinutes).toBe(0);
    expect(data.spokenResponse).toContain('prescribing clinician');
    expect(data.firstStep).toContain('prescribing clinician or pharmacist');
  });

  it('handles regular task with a valid coaching plan and positive timer block', async () => {
    const req = makeRequest({ taskText: 'Reply to landlord email about renewal' });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.safetyFlag).toBe('none');
    expect([5, 10, 15]).toContain(data.timerMinutes);
    expect(data.firstStep).toBeTruthy();
    expect(data.whyThisFits).toBeTruthy();
  });

  it('returns 400 for empty or invalid task text', async () => {
    const req = makeRequest({ taskText: '' });
    const res = await POST(req);
    expect(res.status).toBe(400);

    const data = await res.json();
    expect(data.error).toBeDefined();
  });
});
