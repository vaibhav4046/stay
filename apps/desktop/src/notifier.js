'use strict';
/* Turns the web app's host events (src/lib/host.ts) into native notifications that fire on time even when the window is
 * hidden in the tray. Dedupes against the page's own "due" events, so a reminder shows exactly once. Pure: timers and the
 * show function are injected, so it is unit-tested without Electron. */

const MAX_DELAY_MS = 2 ** 31 - 1;
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function createNotifier({ show, setTimer = setTimeout, clearTimer = clearTimeout, now = Date.now }) {
  const pending = new Map();
  const fired = new Set();

  function cancel(key) {
    if (pending.has(key)) clearTimer(pending.get(key));
    pending.delete(key);
  }

  function fire(key, title, body) {
    cancel(key);
    if (fired.has(key)) return;
    if (fired.size > 200) fired.clear();
    fired.add(key);
    show(title, body);
  }

  function schedule(key, at, title, body) {
    cancel(key);
    fired.delete(key);
    const ms = Math.max(0, at - now());
    if (ms > MAX_DELAY_MS) return;
    pending.set(key, setTimer(() => fire(key, title, body), ms));
  }

  /** @param {unknown} e a parsed host event; anything malformed is ignored */
  function handle(e) {
    if (!e || typeof e !== 'object') return;
    switch (e.type) {
      case 'timer-started':
        if (Number.isFinite(e.endsAt)) schedule('timer', e.endsAt, 'Stay', 'Your block is up. How did it go?');
        break;
      case 'timer-ended':
        fire('timer', 'Stay', 'Your block is up. How did it go?');
        break;
      case 'timer-stopped':
        cancel('timer');
        break;
      case 'reminder-added':
        if (typeof e.id === 'string' && Number.isFinite(e.dueAt)) schedule('rem:' + e.id, e.dueAt, 'Stay', clip(e.text, 100) || 'Check in');
        break;
      case 'reminder-removed':
        if (typeof e.id === 'string') cancel('rem:' + e.id);
        break;
      case 'reminder-due':
        if (typeof e.id === 'string') fire('rem:' + e.id, 'Stay', clip(e.text, 100) || 'Check in');
        break;
      default:
    }
  }

  return { handle, pendingCount: () => pending.size, dispose: () => [...pending.keys()].forEach(cancel) };
}

module.exports = { createNotifier };
