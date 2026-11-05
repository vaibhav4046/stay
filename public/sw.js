/* Stay service worker: the app shell keeps opening with no connection. History, memory and the Today list are local anyway;
 * voice and plans need the network, and say so. API calls are never cached. */
const CACHE = 'stay-shell-v3'; // v3: new logo and favicons
try {
  importScripts('/sw-compose.js'); // writes the check-in sentence on this device; if it cannot load, the server's general line is used
} catch (e) {
  // offline at install: the general wording still works
}
const INBOX = 'stay-inbox'; // check-ins that arrived while the app was closed; the page reads and clears them
const SHELL = ['/app/today', '/offline.html', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-maskable-192.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== INBOX).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/* Stay's own check-ins when the app is closed (opt-in, Settings). The server says which window it is and sends a general line;
 * this device swaps in a sentence about what is on the person's own list when it knows one. Where a tap lands never comes from the server. */
const nudgeText = async (slot, general) => {
  if (!slot || !self.composeNudge) return general;
  try {
    const hit = await (await caches.open('stay-context')).match('/__stay-context');
    return self.composeNudge(slot, hit ? await hit.json() : null, general);
  } catch (e) {
    return general;
  }
};

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title ? data.title.slice(0, 60) : 'Stay';
  const general = typeof data.body === 'string' ? data.body.slice(0, 240) : '';
  const slot = typeof data.slot === 'string' ? data.slot : '';
  const at = Date.now();
  const keep = data.inbox !== false && general; // the welcome note is shown once and not kept as a card
  event.waitUntil(
    nudgeText(slot, general).then((body) => Promise.all([
      self.registration.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'stay-proactive' }),
      // the same words wait inside the app as a "From Stay" card with an unread dot, and the app icon gets a badge
      keep ? caches.open(INBOX).then((c) => c.put('/__stay-inbox/' + at, new Response(JSON.stringify({ at, body }), { headers: { 'content-type': 'application/json' } }))).catch(() => undefined) : undefined,
      keep && self.navigator.setAppBadge ? self.navigator.setAppBadge(1).catch(() => undefined) : undefined,
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => wins.forEach((w) => w.postMessage({ type: 'stay-checkin' }))),
    ])),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow('/app/today');
    }),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // pages: the network first (always the newest), the cached copy when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/app/today').then((shell) => shell || caches.match('/offline.html')))),
    );
    return;
  }

  // hashed build files and icons never change under the same name: cache first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/') || url.pathname === '/pcm-processor.js') {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            return res;
          }),
      ),
    );
  }
});
