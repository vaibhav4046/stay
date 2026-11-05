import { describe, expect, it } from 'vitest';
import { allMessagesCalm, dueSlot, localParts, messageFor, MESSAGES, SLOTS, startLog, WELCOME } from '@/lib/push/schedule';
import { isPushEndpoint, parseSubscription, parseTimeZone } from '@/lib/push/validate';

const at = (iso: string) => new Date(iso);
const none = { day: '2000-01-01', slots: [] as ('morning' | 'evening')[] };

describe('push schedule', () => {
  it('reads the local day and minute in the person’s own zone', () => {
    expect(localParts(at('2026-11-05T03:30:00Z'), 'Asia/Kolkata')).toEqual({ day: '2026-11-05', minutes: 9 * 60 });
    expect(localParts(at('2026-11-05T03:30:00Z'), 'America/Los_Angeles')).toEqual({ day: '2026-11-04', minutes: 19 * 60 + 30 });
  });

  it('is due only inside a window, and never at night', () => {
    expect(dueSlot(at('2026-11-05T03:30:00Z'), 'Asia/Kolkata', none)).toBe('morning'); // 09:00 IST
    expect(dueSlot(at('2026-11-05T05:29:00Z'), 'Asia/Kolkata', none)).toBe('morning'); // 10:59 IST
    expect(dueSlot(at('2026-11-05T05:30:00Z'), 'Asia/Kolkata', none)).toBeNull(); // 11:00 IST
    expect(dueSlot(at('2026-11-05T13:00:00Z'), 'Asia/Kolkata', none)).toBe('evening'); // 18:30 IST
    expect(dueSlot(at('2026-11-05T17:00:00Z'), 'Asia/Kolkata', none)).toBeNull(); // 22:30 IST
    for (const h of [0, 1, 2, 3, 4, 5, 6, 7, 8, 21, 22, 23]) {
      const utc = at(`2026-06-15T${String(h).padStart(2, '0')}:10:00Z`);
      expect(dueSlot(utc, 'UTC', none)).toBeNull();
    }
  });

  it('sends each window once a day, then again the next day', () => {
    const now = at('2026-11-05T09:30:00Z');
    expect(dueSlot(now, 'UTC', { day: '2026-11-05', slots: ['morning'] })).toBeNull();
    expect(dueSlot(now, 'UTC', { day: '2026-11-04', slots: ['morning'] })).toBe('morning');
  });

  it('never sends more than two in a day, however often it ticks', () => {
    let log = { ...none };
    let count = 0;
    for (let m = 0; m < 24 * 60; m += 15) {
      const now = new Date(Date.UTC(2026, 10, 5, 0, m));
      const slot = dueSlot(now, 'UTC', log);
      if (slot) {
        count += 1;
        log = { day: '2026-11-05', slots: [...(log.day === '2026-11-05' ? log.slots : []), slot] };
      }
    }
    expect(count).toBe(2);
  });

  it('marks windows that already opened as sent when someone subscribes, so no message lands the moment they turn it on', () => {
    expect(startLog(at('2026-11-05T09:20:00Z'), 'UTC')).toEqual({ day: '2026-11-05', slots: ['morning'] });
    expect(startLog(at('2026-11-05T06:00:00Z'), 'UTC').slots).toEqual([]);
    expect(startLog(at('2026-11-05T21:00:00Z'), 'UTC').slots).toEqual(['morning', 'evening']);
    expect(dueSlot(at('2026-11-05T09:20:00Z'), 'UTC', startLog(at('2026-11-05T09:20:00Z'), 'UTC'))).toBeNull();
  });

  it('every message is calm, short and names no one', () => {
    expect(allMessagesCalm()).toBe(true);
    for (const text of [...SLOTS.flatMap((s) => MESSAGES[s]), WELCOME]) {
      expect(text.length).toBeLessThanOrEqual(140);
      expect(text).not.toMatch(/streak|overdue|you (didn't|did not)|still not|haven't|!/i);
    }
  });

  it('varies the line by day and by person, and is stable for the same inputs', () => {
    const lines = new Set(Array.from({ length: 30 }, (_, i) => messageFor('morning', `2026-11-${String(i + 1).padStart(2, '0')}`, 7)));
    expect(lines.size).toBe(MESSAGES.morning.length);
    expect(messageFor('evening', '2026-11-05', 3)).toBe(messageFor('evening', '2026-11-05', 3));
  });
});

describe('push validation', () => {
  const p256dh = 'B'.repeat(87);
  const auth = 'a'.repeat(22);
  const ok = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh, auth } };

  it('accepts the browsers’ own push services', () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QGx',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) expect(parseSubscription({ ...ok, endpoint })?.endpoint).toBe(endpoint);
  });

  it('refuses every other address, so the server cannot be pointed at someone else', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/x',
      'https://evil.example/fcm.googleapis.com',
      'https://fcm.googleapis.com.evil.example/x',
      'https://user:pw@fcm.googleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://127.0.0.1/x',
      'https://169.254.169.254/latest',
      'https://notpush.apple.com.evil.example/x',
      'ftp://fcm.googleapis.com/x',
      'javascript:alert(1)',
      '',
      'x'.repeat(800),
    ]) expect(isPushEndpoint(endpoint)).toBe(false);
    expect(isPushEndpoint(42)).toBe(false);
  });

  it('refuses malformed keys and bodies', () => {
    expect(parseSubscription(null)).toBeNull();
    expect(parseSubscription({ endpoint: ok.endpoint })).toBeNull();
    expect(parseSubscription({ ...ok, keys: { p256dh: 'short', auth } })).toBeNull();
    expect(parseSubscription({ ...ok, keys: { p256dh, auth: 'bad key!' + 'a'.repeat(15) } })).toBeNull();
    expect(parseSubscription({ ...ok, keys: { p256dh: 5, auth } })).toBeNull();
  });

  it('accepts real zone names and nothing else', () => {
    expect(parseTimeZone('Asia/Kolkata')).toBe('Asia/Kolkata');
    expect(parseTimeZone('UTC')).toBe('UTC');
    expect(parseTimeZone('Not/AZone')).toBeNull();
    expect(parseTimeZone('../../etc')).toBeNull();
    expect(parseTimeZone('x'.repeat(100))).toBeNull();
    expect(parseTimeZone(null)).toBeNull();
  });
});
