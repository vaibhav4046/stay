import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const X = createRequire(import.meta.url)('../src/shared.js');
const NOW = new Date('2026-10-19T12:00:00Z');

test('mergeParked mirrors the app: newest first, trimmed, 140 chars, no duplicates, max 50', () => {
  const a = X.mergeParked([], ['  buy   milk ', 'Call mum'], NOW);
  assert.deepEqual(a.map((i) => i.text), ['Call mum', 'buy milk']);
  assert.ok(a.every((i) => /^p-\d+-[a-z0-9]+$/.test(i.id) && !Number.isNaN(Date.parse(i.at))));
  assert.equal(X.mergeParked(a, ['BUY MILK', '', '   '], NOW).length, 2); // case-insensitive duplicate, empties
  assert.equal(X.mergeParked([], ['x'.repeat(300)], NOW)[0].text.length, 140);
  const many = X.mergeParked([], Array.from({ length: 60 }, (_, i) => 'thought ' + i), NOW);
  assert.equal(many.length, 50);
  assert.equal(many[0].text, 'thought 59');
  assert.deepEqual(X.mergeParked('garbage', ['ok'], NOW).map((i) => i.text), ['ok']); // corrupt storage tolerated
});

test('badge counts down to the next reminder', () => {
  const t = NOW.getTime();
  const list = [{ id: 'b', text: 'water', dueAt: t + 12 * 60000 }, { id: 'a', text: 'stretch', dueAt: t + 4.2 * 60000 }];
  assert.equal(X.badgeFor(list, t).text, '5'); // rounds up: never says 4 when 4.2 minutes remain
  assert.match(X.badgeFor(list, t).title, /check in 5 min \(stretch\)/);
  assert.equal(X.badgeFor([{ id: 'c', text: '', dueAt: t - 1000 }], t).text, 'now');
  assert.equal(X.badgeFor([{ id: 'old', text: 'x', dueAt: t - 2 * 3600000 }], t).text, ''); // over an hour overdue: dropped like the app does
  assert.equal(X.badgeFor([{ id: 'far', text: 'x', dueAt: t + 500 * 60000 }], t).text, '99+');
  assert.equal(X.badgeFor([], t).text, '');
  assert.equal(X.badgeFor(null, t).text, '');
});

test('isStayUrl accepts only the Stay origin', () => {
  assert.ok(X.isStayUrl('https://stay-two-swart.vercel.app/app/today'));
  assert.ok(!X.isStayUrl('https://stay-two-swart.vercel.app.evil.com/'));
  assert.ok(!X.isStayUrl('javascript:alert(1)'));
});
