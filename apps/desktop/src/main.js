'use strict';
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const {
  app, BrowserWindow, Tray, Menu, Notification, globalShortcut, nativeTheme, nativeImage,
  session, shell, systemPreferences, screen, dialog, ipcMain,
} = require('electron');
const cfg = require('./config');
const { createNotifier } = require('./notifier');
const theme = require('./theme.json');

const TEST = process.env.STAY_TEST === '1';
const target = cfg.resolveTarget(process.argv, process.env);
const SRC_URL = pathToFileURL(__dirname + path.sep).href;
const OFFLINE_FILE = path.join(__dirname, 'offline.html');
const ASSETS = path.join(__dirname, '..', 'assets');
const STARTED_HIDDEN = process.argv.includes('--hidden');

if (process.env.STAY_USER_DATA) app.setPath('userData', process.env.STAY_USER_DATA);
if (TEST) {
  // a fake microphone and an auto-accepted Chromium prompt: our own permission handler is still the gate being tested
  app.commandLine.appendSwitch('use-fake-device-for-media-stream');
  app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
}
app.setAppUserModelId('app.stay.desktop');

let win = null;
let tray = null;
let quitting = false;
let voiceLive = false;
let settings = cfg.sanitizeSettings(null);
let micPromptShown = false;
const testState = { external: [], notified: [], hotkeyOk: null };

// ---------- settings ----------
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');
function loadSettings() {
  try {
    settings = cfg.sanitizeSettings(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch {
    settings = cfg.sanitizeSettings(null);
  }
  if (process.env.STAY_HOTKEY !== undefined) settings.hotkey = process.env.STAY_HOTKEY;
}
function saveSettings(patch) {
  settings = { ...settings, ...patch };
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error('could not save settings:', err.message);
  }
}

// ---------- helpers ----------
const icon = (name) => nativeImage.createFromPath(path.join(ASSETS, name));
const bgColor = () => (nativeTheme.shouldUseDarkColors ? theme.dark.canvas : theme.color.canvas);
const onToday = () => {
  try {
    return win && new URL(win.webContents.getURL()).pathname === '/app/today';
  } catch {
    return false;
  }
};

function openExternal(url) {
  if (!cfg.isSafeExternal(url)) return;
  if (TEST) testState.external.push(url);
  else void shell.openExternal(url);
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/** Sends a command to the page. A cold or off-screen page is reached through the URL parameters the app already understands. */
function sendCommand(cmd) {
  if (!win) return;
  const q = { 'voice-start': '?voice=auto', grounding: '?action=grounding', timer: cmd.minutes ? `?timer=${cmd.minutes}` : '' }[cmd.type];
  const ready = onToday() && !win.webContents.isLoading();
  if (!ready) {
    if (q !== undefined) void win.loadURL(`${target.origin}${cfg.START_PATH}${q}`);
    return;
  }
  const detail = JSON.stringify(JSON.stringify(cmd));
  void win.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('stay:command',{detail:${detail}}))`).catch(() => undefined);
}

// ---------- notifications ----------
const notifier = createNotifier({
  show(title, body) {
    if (TEST) testState.notified.push({ title, body });
    // the page already chimes and shows a note when it is in front; only interrupt when it is not
    if (!TEST && win && win.isVisible() && win.isFocused()) return;
    if (!Notification.isSupported()) return;
    const n = new Notification({ title, body, icon: icon('tray.png') });
    n.on('click', showWindow);
    n.show();
  },
});

ipcMain.on('stay:host-event', (event, raw) => {
  if (!win || event.sender !== win.webContents || !cfg.isAppUrl(event.senderFrame.url, target.origin)) return;
  let e;
  try {
    e = JSON.parse(raw);
  } catch {
    return;
  }
  if (e && e.type === 'voice-state') {
    voiceLive = e.live === true;
    refreshTray();
    return;
  }
  notifier.handle(e);
});

// ---------- microphone ----------
async function ensureMicAccess() {
  if (process.platform === 'darwin') return systemPreferences.askForMediaAccess('microphone');
  if (process.platform === 'win32' && systemPreferences.getMediaAccessStatus('microphone') === 'denied') {
    if (!micPromptShown && !TEST) {
      micPromptShown = true;
      const { response } = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Open microphone settings', 'Not now'],
        defaultId: 0,
        title: 'Stay needs the microphone',
        message: 'Windows is blocking microphone access for desktop apps.',
        detail: 'Turn on "Let desktop apps access your microphone", then talk to Stay again. Nothing is recorded or kept.',
      });
      if (response === 0) void shell.openExternal('ms-settings:privacy-microphone');
    }
    return false;
  }
  return true;
}

function lockDownSession() {
  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest((details, cb) => {
    const ok = cfg.isAllowedRequest(details.url, target.origin) || details.url.startsWith(SRC_URL);
    cb({ cancel: !ok });
  });
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const ok = cfg.isPermissionGranted(permission, details.requestingUrl, target.origin, details);
    if (ok && permission === 'media') void ensureMicAccess().then(callback, () => callback(false));
    else callback(ok);
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
    const mediaType = details.mediaType === 'unknown' ? 'audio' : details.mediaType;
    return cfg.isPermissionGranted(permission, details.requestingUrl || requestingOrigin, target.origin, { mediaType });
  });
  ses.setDevicePermissionHandler(() => false);
}

// ---------- window ----------
function createWindow() {
  const displays = screen.getAllDisplays().map((d) => d.workArea);
  const b = cfg.boundsVisible(settings.bounds, displays) ? settings.bounds : { width: 480, height: 820 };
  win = new BrowserWindow({
    ...b,
    minWidth: 360,
    minHeight: 560,
    show: false,
    title: 'Stay',
    icon: icon('tray.png'),
    backgroundColor: bgColor(),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      backgroundThrottling: false, // reminders and the focus timer must keep ticking while hidden in the tray
      devTools: !app.isPackaged,
    },
  });
  if (settings.maximized) win.maximize();

  const wc = win.webContents;
  wc.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  const guard = (e, url) => {
    if (cfg.isAppUrl(url, target.origin) || url.startsWith(SRC_URL)) return;
    e.preventDefault();
    openExternal(url);
  };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', (e, url) => {
    if (!cfg.isAppUrl(url, target.origin)) e.preventDefault();
  });
  wc.on('will-attach-webview', (e) => e.preventDefault());
  wc.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || url.startsWith(SRC_URL)) return; // -3 = aborted by a newer navigation
    void win.loadFile(OFFLINE_FILE, { query: { u: target.url, e: desc } });
  });

  let saveTimer = null;
  const remember = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!win || win.isDestroyed() || win.isMinimized()) return;
      saveSettings({ maximized: win.isMaximized(), ...(win.isMaximized() ? {} : { bounds: win.getBounds() }) });
    }, 400);
  };
  win.on('resize', remember);
  win.on('move', remember);
  win.on('maximize', remember);
  win.on('unmaximize', remember);
  win.on('close', (e) => {
    if (!quitting && settings.closeToTray && tray) {
      e.preventDefault();
      win.hide();
      return;
    }
    if (!win.isMaximized() && !win.isMinimized()) saveSettings({ bounds: win.getBounds(), maximized: false });
  });
  win.on('closed', () => {
    win = null;
  });
  win.once('ready-to-show', () => {
    if (!STARTED_HIDDEN || !tray) win.show();
  });
  void win.loadURL(target.url);
}

// ---------- tray ----------
function summon() {
  if (win && win.isVisible() && win.isFocused()) return win.hide();
  showWindow();
  if (settings.voiceOnSummon) sendCommand({ type: 'voice-start' });
}

function registerHotkey() {
  globalShortcut.unregisterAll();
  testState.hotkeyOk = null;
  if (!settings.hotkey) return;
  try {
    testState.hotkeyOk = globalShortcut.register(settings.hotkey, summon);
  } catch {
    testState.hotkeyOk = false;
  }
  if (!testState.hotkeyOk && !TEST && Notification.isSupported()) {
    new Notification({ title: 'Stay', body: `${settings.hotkey} is already taken by another app. Pick another summon shortcut from the tray menu.` }).show();
  }
}

function buildMenu() {
  const hotkeyItems = [...cfg.HOTKEY_PRESETS, ''].map((k) => ({
    label: k || 'Off',
    type: 'radio',
    checked: settings.hotkey === k,
    click: () => (saveSettings({ hotkey: k }), registerHotkey(), refreshTray()),
  }));
  const custom = settings.hotkey && !cfg.HOTKEY_PRESETS.includes(settings.hotkey);
  if (custom) hotkeyItems.unshift({ label: `${settings.hotkey} (custom)`, type: 'radio', checked: true });
  return Menu.buildFromTemplate([
    { label: 'Open Stay', click: showWindow },
    { id: 'voice', label: voiceLive ? 'Stop voice' : 'Start voice', click: () => (showWindow(), sendCommand({ type: voiceLive ? 'voice-stop' : 'voice-start' })) },
    { id: 'block', label: 'Start a 20 minute block', click: () => (showWindow(), sendCommand({ type: 'timer', minutes: 20 })) },
    { id: 'ground', label: 'Ground me', click: () => (showWindow(), sendCommand({ type: 'grounding' })) },
    { type: 'separator' },
    { id: 'hotkey', label: `Summon shortcut${settings.hotkey ? ': ' + settings.hotkey : ': off'}`, submenu: hotkeyItems },
    {
      id: 'login',
      label: 'Start when I sign in',
      type: 'checkbox',
      checked: settings.launchAtLogin,
      visible: process.platform !== 'linux', // Electron cannot manage Linux autostart
      click: (item) => applyLaunchAtLogin(item.checked),
    },
    { id: 'summonVoice', label: 'Start listening when summoned', type: 'checkbox', checked: settings.voiceOnSummon, click: (i) => saveSettings({ voiceOnSummon: i.checked }) },
    { id: 'closeToTray', label: 'Keep running in the tray when closed', type: 'checkbox', checked: settings.closeToTray, click: (i) => saveSettings({ closeToTray: i.checked }) },
    { label: 'Open settings file', click: () => shell.showItemInFolder(settingsFile()) },
    { type: 'separator' },
    { id: 'quit', label: 'Quit Stay', click: () => app.quit() },
  ]);
}

function applyLaunchAtLogin(on) {
  saveSettings({ launchAtLogin: on });
  if (app.isPackaged) app.setLoginItemSettings({ openAtLogin: on, args: ['--hidden'] });
}

function refreshTray() {
  if (!tray) return;
  tray.setImage(icon(voiceLive ? 'tray-live.png' : process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'));
  tray.setToolTip(voiceLive ? 'Stay: listening' : 'Stay');
  const menu = buildMenu();
  tray.setContextMenu(menu);
  if (TEST) testState.menu = menu;
}

function createTray() {
  tray = new Tray(icon(process.platform === 'darwin' ? 'trayTemplate.png' : 'tray.png'));
  tray.on('click', showWindow);
  refreshTray();
}

function buildAppMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: 'appMenu' }] : []),
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
      { role: 'windowMenu' },
    ]),
  );
}

// ---------- lifecycle ----------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    showWindow();
    if (argv.includes('--voice')) sendCommand({ type: 'voice-start' });
  });

  app.whenReady().then(() => {
    loadSettings();
    lockDownSession();
    buildAppMenu();
    createTray();
    registerHotkey();
    createWindow();
    nativeTheme.on('updated', () => win && win.setBackgroundColor(bgColor()));
    if (TEST) {
      global.__stay = {
        win: () => win, tray: () => tray, menu: () => testState.menu, state: testState, settings: () => settings,
        notifier, target, sendCommand, summon, setHotkey: (k) => (saveSettings({ hotkey: k }), registerHotkey(), refreshTray()),
      };
    }
  });

  app.on('activate', showWindow);
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    notifier.dispose();
  });
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin' || quitting) app.quit();
  });
  app.on('web-contents-created', (_e, contents) => {
    contents.on('will-attach-webview', (e) => e.preventDefault());
  });
}
