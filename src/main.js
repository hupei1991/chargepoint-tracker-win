'use strict';
const { app, BrowserWindow, Tray, Menu, Notification, ipcMain, nativeImage, net, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { Tracker, HttpError, toErrorInfo } = require('./tracker');
const { DICTS, resolveLang, translator, errorText } = require('./i18n');

const APP_ID = 'io.github.hupei1991.cptracker';
const ASSETS = path.join(__dirname, '..', 'assets');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// ---------- single instance ----------
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.setAppUserModelId(APP_ID); // required for Windows toast notifications

// ---------- settings ----------
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const DEFAULTS = { deviceId: '', port: 1, intervalSec: 60, resumeOnLaunch: true, wasRunning: false, recent: [], lang: 'auto' };
let settings = { ...DEFAULTS };
function loadSettings() {
  try { settings = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) }; } catch { /* first run */ }
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2)); } catch (e) { console.error(e); }
}

// ---------- language ----------
let lang = 'en';
let t = translator('en');
function applyLang() {
  lang = resolveLang(settings.lang, app.getLocale());
  t = translator(lang);
}

// ---------- launch at login ----------
// The portable .exe unpacks to a temp dir on each run; register the real exe path instead.
const EXE = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
const LOGIN_ARGS = ['--hidden'];
const getLogin = () => app.getLoginItemSettings({ path: EXE, args: LOGIN_ARGS }).openAtLogin;
const setLogin = (on) => app.setLoginItemSettings({ openAtLogin: on, path: EXE, args: LOGIN_ARGS });

// ---------- network ----------
async function fetchJson(url) {
  if (process.env.CP_MOCK) return require('../dev/mock').next(url);
  const res = await net.fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/json', Origin: 'https://driver.chargepoint.com', Referer: 'https://driver.chargepoint.com/' },
  });
  if (!res.ok) throw new HttpError(res.status);
  return res.json();
}

const tracker = new Tracker({ fetchJson });

// ---------- tray ----------
let tray = null;
let win = null;
let isQuitting = false;

function icon(name) {
  return nativeImage.createFromPath(path.join(ASSETS, `tray-${name}.png`));
}

function trayVariant() {
  const snap = tracker.snapshot();
  if (snap.state === 'stopped') return 'idle';
  if (snap.state === 'paused') return 'paused';
  const p = snap.station?.ports.find((x) => x.number === snap.port);
  return p?.state === 'available' ? 'free' : 'watching';
}

function trayTooltip() {
  const s = tracker.snapshot();
  const p = s.station?.ports.find((x) => x.number === s.port);
  const portName = t('portName', { n: s.port });
  const portLine = p ? `${portName}: ${t('state.' + p.state)}` : portName;
  const mode = t('tray.' + s.state);
  if (!s.deviceId) return `${t('appName')}\n${t('tray.noStation')}`;
  return `${t('appName')}\n${s.station?.name || t('tray.station', { id: s.deviceId })}\n${portLine} (${mode})`.slice(0, 127);
}

function refreshTray() {
  if (!tray) return;
  tray.setImage(icon(trayVariant()));
  tray.setToolTip(trayTooltip());
  const st = tracker.state;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: t('tray.open'), click: showWindow },
    { type: 'separator' },
    { label: st === 'paused' ? t('resume') : t('start'), enabled: st !== 'running', click: () => doAction('start') },
    { label: t('pause'), enabled: st === 'running', click: () => doAction('pause') },
    { label: t('stopTracking'), enabled: st !== 'stopped', click: () => doAction('stop') },
    { type: 'separator' },
    { label: t('openWeb'), enabled: !!settings.deviceId, click: () => openWeb() },
    { label: t('launchAtLogin'), type: 'checkbox', checked: getLogin(), click: (m) => setLogin(m.checked) },
    { label: t('language'), submenu: [
      { label: 'Auto', type: 'radio', checked: settings.lang === 'auto', click: () => setLang('auto') },
      { label: 'English', type: 'radio', checked: settings.lang === 'en', click: () => setLang('en') },
      { label: '中文', type: 'radio', checked: settings.lang === 'zh', click: () => setLang('zh') },
    ] },
    { type: 'separator' },
    { label: t('tray.quit'), click: () => { isQuitting = true; app.quit(); } },
  ]));
}

// ---------- window ----------
function positionNearTray() {
  const W = 380, H = 560;
  const b = tray?.getBounds?.();
  const display = b && b.width ? screen.getDisplayNearestPoint({ x: b.x, y: b.y }) : screen.getPrimaryDisplay();
  const wa = display.workArea;
  let x = wa.x + wa.width - W - 12;
  let y = wa.y + wa.height - H - 12;
  if (b && b.width) {
    x = Math.min(Math.max(b.x + b.width / 2 - W / 2, wa.x + 8), wa.x + wa.width - W - 8);
    y = b.y > wa.y + wa.height / 2 ? wa.y + wa.height - H - 8 : wa.y + 8; // taskbar bottom vs top
  }
  return { x: Math.round(x), y: Math.round(y), width: W, height: H };
}

function createWindow() {
  win = new BrowserWindow({
    ...positionNearTray(),
    show: false,
    frame: false,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: false,
    backgroundColor: '#f4f6f8',
    title: 'ChargePoint Tracker',
    icon: path.join(ASSETS, 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
  win.on('close', (e) => { if (!isQuitting) { e.preventDefault(); win.hide(); } });
  win.on('show', () => { if (tracker.state !== 'running') refreshNow(); });
}

function showWindow() {
  if (!win) createWindow();
  if (!win.isVisible()) win.setBounds(positionNearTray());
  win.show();
  win.focus();
}

function toggleWindow() {
  if (win && win.isVisible() && win.isFocused()) win.hide(); else showWindow();
}

function push(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// ---------- actions ----------
async function refreshNow() {
  if (!tracker.deviceId) { push('update', tracker.snapshot()); refreshTray(); return; }
  try {
    await tracker.fetchOnce();
  } catch (e) {
    tracker.lastError = toErrorInfo(e, tracker.deviceId);
  }
  push('update', tracker.snapshot());
  refreshTray();
}

function doAction(action) {
  try {
    if (action === 'start') tracker.start();
    if (action === 'pause') tracker.pause();
    if (action === 'stop') tracker.stop();
    settings.wasRunning = tracker.state === 'running';
    saveSettings();
  } catch (e) {
    push('toast', errorText(t, toErrorInfo(e)));
  }
  refreshTray();
  return tracker.snapshot();
}

tracker.on('update', (snap) => { push('update', snap); refreshTray(); });
tracker.on('state', () => refreshTray());
tracker.on('freed', (station, port) => {
  const spec = [port.level, port.plug, port.kw ? port.kw + ' kW' : ''].filter(Boolean).join(' ');
  const n = new Notification({
    title: t('notify.title', { n: port.number }),
    body: t('notify.body', { name: station.name, spec }),
    icon: path.join(ASSETS, 'icon.png'),
    urgency: 'critical',
  });
  n.on('click', showWindow);
  n.show();
});

// ---------- IPC ----------
function setLang(pref) {
  settings.lang = ['auto', 'en', 'zh'].includes(pref) ? pref : 'auto';
  saveSettings();
  applyLang();
  refreshTray();
  push('lang', { lang, pref: settings.lang, strings: DICTS[lang] });
  return { lang, pref: settings.lang, strings: DICTS[lang] };
}

ipcMain.handle('get', () => ({
  snapshot: tracker.snapshot(), settings, openAtLogin: getLogin(),
  lang, strings: DICTS[lang],
}));
ipcMain.handle('setLang', (_e, pref) => setLang(pref));
ipcMain.handle('action', (_e, action) => doAction(action));
ipcMain.handle('refresh', async () => { await refreshNow(); return tracker.snapshot(); });
ipcMain.handle('setStation', async (_e, id) => {
  id = String(id || '').trim();
  if (!/^\d{3,10}$/.test(id)) throw new Error(t('err.badId'));
  const wasRunning = tracker.state === 'running';
  if (wasRunning) tracker.stop();
  tracker.configure({ deviceId: id });
  try {
    await tracker.fetchOnce();
  } catch (e) {
    tracker.lastError = toErrorInfo(e, id);
    push('update', tracker.snapshot());
    refreshTray();
    return tracker.snapshot();
  }
  // keep the watched port if the new station has it, otherwise pick the first port
  const nums = tracker.lastStation.ports.map((p) => p.number);
  if (!nums.includes(tracker.port)) tracker.configure({ port: nums[0] });
  settings.deviceId = id;
  settings.port = tracker.port;
  settings.recent = [id, ...settings.recent.filter((x) => x !== id)].slice(0, 5);
  saveSettings();
  refreshTray();
  return tracker.snapshot();
});
ipcMain.handle('setPort', (_e, port) => {
  tracker.configure({ port });
  settings.port = tracker.port;
  saveSettings();
  refreshTray();
  return tracker.snapshot();
});
ipcMain.handle('setInterval', (_e, sec) => {
  tracker.configure({ intervalSec: sec });
  settings.intervalSec = tracker.intervalSec;
  saveSettings();
  if (tracker.state === 'running') tracker.schedule();
  return tracker.snapshot();
});
ipcMain.handle('setLogin', (_e, on) => {
  setLogin(!!on);
  refreshTray();
  return getLogin();
});
function openWeb() {
  shell.openExternal(settings.deviceId ? `https://driver.chargepoint.com/stations/${settings.deviceId}` : 'https://driver.chargepoint.com/');
}
ipcMain.handle('openWeb', () => openWeb());
ipcMain.handle('hide', () => win?.hide());

// ---------- lifecycle ----------
app.on('second-instance', showWindow);
app.on('window-all-closed', (e) => e.preventDefault()); // stay in tray
app.on('before-quit', () => { isQuitting = true; });

app.whenReady().then(() => {
  loadSettings();
  applyLang();
  tracker.configure({ deviceId: settings.deviceId, port: settings.port, intervalSec: settings.intervalSec });

  tray = new Tray(icon('idle'));
  tray.on('click', toggleWindow);
  refreshTray();

  createWindow();
  const hidden = process.argv.includes('--hidden');
  if (!hidden) win.once('ready-to-show', showWindow);

  if (settings.resumeOnLaunch && settings.wasRunning && settings.deviceId) tracker.start();
  else refreshNow();

  if (process.env.CP_SCREENSHOT) require('../dev/screenshot')(win, tracker, doAction, setLang);
});
