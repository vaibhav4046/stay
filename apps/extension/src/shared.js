/* Pure helpers shared by the service worker, the content script and the popup (and unit-tested under node).
 * The storage shapes mirror the web app: src/lib/coach/parkingLot.ts and src/lib/reminders.ts. */
(function (root) {
  'use strict';
  var STAY_ORIGIN = 'https://stay-two-swart.vercel.app'; // build.mjs --dev rewrites this to the local origin
  var PARKING_KEY = 'stay_parking_lot';
  var REMINDERS_KEY = 'stay_reminders_v1';
  var MAX_ITEMS = 50;
  var MAX_LEN = 140;
  var OVERDUE_MS = 3600000;

  function clean(text) {
    return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, MAX_LEN);
  }

  /** Adds thoughts to the app's parking list the way the app does: newest first, exact duplicates ignored, capped. */
  function mergeParked(existing, texts, now) {
    var list = Array.isArray(existing) ? existing.filter(function (i) { return i && typeof i.text === 'string' && typeof i.id === 'string'; }) : [];
    var t0 = (now || new Date()).getTime();
    texts.forEach(function (raw, n) {
      var t = clean(raw);
      if (!t || list.some(function (i) { return i.text.toLowerCase() === t.toLowerCase(); })) return;
      var at = new Date(t0 + n);
      list = [{ id: 'p-' + at.getTime() + '-' + Math.random().toString(36).slice(2, 6), text: t, at: at.toISOString() }].concat(list).slice(0, MAX_ITEMS);
    });
    return list;
  }

  /** The soonest reminder that is not more than an hour overdue (the app drops older ones). */
  function nextReminder(list, now) {
    var t = now == null ? Date.now() : now;
    var live = (Array.isArray(list) ? list : []).filter(function (r) { return r && typeof r.dueAt === 'number' && t - r.dueAt < OVERDUE_MS; });
    live.sort(function (a, b) { return a.dueAt - b.dueAt; });
    return live[0] || null;
  }

  /** Toolbar badge for the next reminder: minutes left ("12"), "now" once due, empty when there is none. */
  function badgeFor(list, now) {
    var t = now == null ? Date.now() : now;
    var r = nextReminder(list, t);
    if (!r) return { text: '', title: 'Stay' };
    var mins = Math.max(0, Math.ceil((r.dueAt - t) / 60000));
    return {
      text: mins === 0 ? 'now' : mins > 99 ? '99+' : String(mins),
      title: 'Stay: ' + (mins === 0 ? 'check in now' : 'check in ' + mins + ' min') + (r.text ? ' (' + r.text + ')' : ''),
    };
  }

  function isStayUrl(url) {
    try { return new URL(url).origin === STAY_ORIGIN; } catch (e) { return false; }
  }

  var api = { STAY_ORIGIN: STAY_ORIGIN, PARKING_KEY: PARKING_KEY, REMINDERS_KEY: REMINDERS_KEY, clean: clean, mergeParked: mergeParked, nextReminder: nextReminder, badgeFor: badgeFor, isStayUrl: isStayUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StayExt = api;
})(typeof self !== 'undefined' ? self : this);
