'use strict';
/* Sandboxed preload. Exposes only a tiny read-only descriptor to the page, and forwards the app's own `stay:host` events to the
 * main process (which validates them). The page never receives ipcRenderer or any Node API. */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'stayHost',
  Object.freeze({ kind: 'electron', platform: process.platform, handlesNotifications: true }),
);

window.addEventListener('stay:host', (ev) => {
  const detail = ev && ev.detail;
  if (typeof detail === 'string' && detail.length <= 2000) ipcRenderer.send('stay:host-event', detail);
});
