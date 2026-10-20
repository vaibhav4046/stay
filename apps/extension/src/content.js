/* Runs on Stay pages only. Two local jobs, no network:
 *  1. file any thoughts parked from other pages into the app's own parking lot (localStorage);
 *  2. mirror the app's reminders to the extension so the toolbar badge can count down to the next one. */
(function () {
  'use strict';
  var X = self.StayExt;

  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function drain() {
    chrome.storage.local.get('inbox').then(function (r) {
      var inbox = r.inbox || [];
      if (!inbox.length) return;
      var merged = X.mergeParked(readJson(X.PARKING_KEY), inbox, new Date());
      try {
        localStorage.setItem(X.PARKING_KEY, JSON.stringify(merged));
      } catch (e) {
        return; // private mode: keep them queued
      }
      chrome.storage.local.set({ inbox: [] });
    });
  }

  var last = '';
  function mirror() {
    var list = readJson(X.REMINDERS_KEY).filter(function (r) { return r && typeof r.dueAt === 'number'; });
    var s = JSON.stringify(list);
    if (s !== last) {
      last = s;
      chrome.storage.local.set({ reminders: list });
    }
  }

  function tick() {
    drain();
    mirror();
  }
  tick();
  chrome.storage.onChanged.addListener(function (c, area) {
    if (area === 'local' && c.inbox) drain();
  });
  window.addEventListener('storage', mirror);
  window.addEventListener('stay:host', function () { setTimeout(mirror, 50); }); // the app announces reminder changes
  setInterval(mirror, 15000);
})();
