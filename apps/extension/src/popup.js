(function () {
  'use strict';
  var X = self.StayExt;
  var $ = function (id) { return document.getElementById(id); };

  function renderNext() {
    chrome.storage.local.get('reminders').then(function (r) {
      var b = X.badgeFor(r.reminders || [], Date.now());
      $('next').textContent = b.text ? b.title.replace(/^Stay: /, 'Next: ') : 'No check-in set.';
    });
  }

  $('park').addEventListener('submit', function (e) {
    e.preventDefault();
    chrome.runtime.sendMessage({ type: 'park', text: $('thought').value }).then(function (res) {
      $('status').textContent = res && res.ok ? 'Parked. It will be in Stay next time you open it.' : 'Nothing to park.';
      if (res && res.ok) $('thought').value = '';
    });
  });
  $('voice').addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'open', voice: true }).then(function () { window.close(); });
  });
  $('open').addEventListener('click', function () {
    chrome.runtime.sendMessage({ type: 'open', voice: false }).then(function () { window.close(); });
  });
  renderNext();
  $('thought').focus();
})();
