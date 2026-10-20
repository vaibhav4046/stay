/* Service worker. Local only: it never makes a network request. It owns the context menu, the keyboard command, and the
 * toolbar badge. Parked thoughts wait in chrome.storage.local until a Stay page is open, where content.js files them
 * into the app's own parking lot. */
importScripts('shared.js');
const { STAY_ORIGIN, badgeFor, clean } = self.StayExt;

const MENU_ID = 'park-thought';
const VOICE_URL = STAY_ORIGIN + '/app/today?voice=auto';

async function park(text) {
  const t = clean(text);
  if (!t) return false;
  const { inbox = [] } = await chrome.storage.local.get('inbox');
  await chrome.storage.local.set({ inbox: [...inbox, t].slice(-50) });
  await flash('+');
  return true;
}

/** A brief badge confirmation, then the reminder badge again. */
async function flash(text) {
  await chrome.action.setBadgeBackgroundColor({ color: '#006A67' });
  await chrome.action.setBadgeText({ text });
  setTimeout(refreshBadge, 1600);
}

async function refreshBadge() {
  const { reminders = [] } = await chrome.storage.local.get('reminders');
  const b = badgeFor(reminders, Date.now());
  await chrome.action.setBadgeBackgroundColor({ color: '#006A67' });
  await chrome.action.setBadgeText({ text: b.text });
  await chrome.action.setTitle({ title: b.title });
}

/** Focuses a Stay tab if one is open, otherwise opens a small window so Stay sits beside what you are doing. */
async function openStay(url) {
  const tabs = await chrome.tabs.query({ url: STAY_ORIGIN + '/*' });
  if (tabs[0]) {
    await chrome.tabs.update(tabs[0].id, { active: true, url });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
    return tabs[0].id;
  }
  const win = await chrome.windows.create({ url, type: 'popup', width: 440, height: 780 });
  return win.tabs && win.tabs[0] && win.tabs[0].id;
}

async function onMenuClick(info) {
  if (info.menuItemId === MENU_ID) await park(info.selectionText);
}

async function onCommand(command) {
  if (command === 'open-voice') await openStay(VOICE_URL);
}

function installMenu() {
  chrome.contextMenus.create({ id: MENU_ID, title: 'Park this thought in Stay', contexts: ['selection'] }, () => void chrome.runtime.lastError);
}

chrome.runtime.onInstalled.addListener(() => {
  installMenu();
  chrome.alarms.create('badge', { periodInMinutes: 1 });
  refreshBadge();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('badge', { periodInMinutes: 1 });
  refreshBadge();
});
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'badge') refreshBadge();
});
chrome.contextMenus.onClicked.addListener(onMenuClick);
chrome.commands.onCommand.addListener(onCommand);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.reminders) refreshBadge();
});
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg && msg.type === 'park') park(msg.text).then((ok) => reply({ ok }));
  else if (msg && msg.type === 'open') openStay(STAY_ORIGIN + (msg.voice ? '/app/today?voice=auto' : '/app/today')).then(() => reply({ ok: true }));
  else return false;
  return true; // async reply
});

// exposed so the verification script can drive the handlers (a native context-menu click cannot be automated)
self.StayBg = { park, refreshBadge, openStay, onMenuClick, onCommand };
