import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/safety/check/route';

const call = (body: unknown) =>
  POST(new NextRequest('http://localhost:3000/api/safety/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })).then(async (r) => ({ status: r.status, json: await r.json() }));

describe('/api/safety/check (the phone agent uses the web app\'s own checks)', () => {
  it('crisis wording gets the crisis message for the caller\'s region', async () => {
    const uk = await call({ text: 'I want to take my own life', region: 'GB' });
    expect(uk.json.verdict).toBe('crisis');
    expect(uk.json.message).toContain('116 123');
    const us = await call({ text: 'i want to kill myself', region: 'US' });
    expect(us.json.message).toContain('988');
  });
  it('a dosing question gets the medication boundary', async () => {
    const r = await call({ text: 'should I double my adderall dose' });
    expect(r.json.verdict).toBe('medication');
    expect(r.json.message).toMatch(/prescri|clinician/i);
  });
  it('ordinary talk passes', async () => {
    expect((await call({ text: 'I keep avoiding my taxes' })).json).toEqual({ verdict: 'ok', message: null });
  });
  it('rejects a malformed or oversized body', async () => {
    expect((await call({ nope: 1 })).status).toBe(400);
    expect((await call({ text: 'x'.repeat(5000) })).status).toBe(413); // too large to read
  });
});
