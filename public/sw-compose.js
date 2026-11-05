/* Writes Stay's check-in sentence on the person's own device. The server only says which window it is (morning or evening);
 * the name and the thing on the list are read here, from a small note the app keeps in this browser, and never leave it.
 * Loaded by the service worker (importScripts) and by the unit tests (require). Plain ES5 on purpose. */
(function (root) {
  function clean(text, max) {
    return String(text || '')
      .replace(/[\r\n"“”]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  var VARIANTS = {
    morning: [
      function (who, open) { return 'Morning' + who + '. "' + open + '" is still on your list, whenever you want it. No rush.'; },
      function (who, open) { return 'Good morning' + who + '. Want to take one small step on "' + open + '"? Say the first bit out loud.'; },
      function (who, open) { return 'Morning' + who + '. "' + open + '" can start tiny. Tap and tell me what is in the way.'; },
    ],
    timer: [
      function (who, block) { return 'Time is up' + who + '. Did you get started on "' + block + '"?'; },
      function (who, block) { return 'Your block is done' + who + '. How did "' + block + '" go? Tap to tell me.'; },
    ],
    evening: [
      function (who, open) { return 'Evening' + who + '. Want to park "' + open + '" for tomorrow, or take one small step on it now?'; },
      function (who, open) { return 'Hi' + who + '. If "' + open + '" is still in your head, say it out loud and I will hold it.'; },
      function (who, open) { return 'Evening' + who + '. No pressure on "' + open + '". Tell me how it is sitting and we will decide together.'; },
    ],
  };

  /** slot: 'morning' | 'evening' (about the newest open item) or 'timer' (about the block that just ended). ctx: { name?, open?, block? } from this device. fallback: the server's general line, used when there is nothing personal to say. */
  function composeNudge(slot, ctx, fallback, day) {
    var open = clean(ctx && (slot === 'timer' ? ctx.block : ctx.open), 60);
    var list = VARIANTS[slot];
    if (!open || !list) return fallback;
    var name = clean(ctx && ctx.name, 24);
    var n = typeof day === 'number' ? day : new Date().getDate();
    return list[Math.abs(n) % list.length](name ? ', ' + name : '', open);
  }

  root.composeNudge = composeNudge;
  if (typeof module !== 'undefined' && module.exports) module.exports = { composeNudge: composeNudge, clean: clean };
})(typeof self !== 'undefined' ? self : this);
