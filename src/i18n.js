'use strict';
// UI strings for English and Simplified Chinese.
// `{name}` placeholders are filled by format(). Shared by the main process and (via IPC) the renderer.

const en = {
  appName: 'ChargePoint Tracker',
  loading: 'Loading…',
  emptyTitle: 'Add a station to start',
  emptySub: 'Enter the number at the end of the station’s ChargePoint link below.',
  stationPlaceholder: 'Number from the URL',
  cantRead: "Can't read this station",
  portName: 'Port {n}',
  watching: 'Watching',
  pickHint: 'Tap a port to choose which one to watch',
  'state.available': 'Available',
  'state.busy': 'In use',
  'state.mine': 'In use by you',
  'state.offline': 'Unavailable',
  'state.missing': 'No such port',

  'status.idle': 'Not tracking',
  'status.idleSub': "Start to get notified when port {n} frees up",
  'status.running': 'Watching port {n}',
  'status.runningSub': "You'll get a notification when it frees up",
  'status.free': 'Port {n} is available now',
  'status.freeSub': "We'll notify you again next time it frees up",
  'status.paused': 'Tracking paused',
  'status.pausedSub': 'Resume to pick up from the last known state',
  'status.retry': 'Retrying automatically',
  'status.checkInput': 'Check the station number or connection, then refresh',
  countdown: '{updated}, next in {s}s',
  checking: '{updated}, checking…',

  start: 'Start tracking',
  resume: 'Resume tracking',
  pause: 'Pause tracking',
  stop: 'Stop',
  stopTracking: 'Stop tracking',
  refresh: 'Refresh now',
  hide: 'Hide to tray',
  station: 'Station',
  switch: 'Switch',
  interval: 'Interval',
  'interval.30': '~30 seconds',
  'interval.60': '~1 minute',
  'interval.120': '~2 minutes',
  'interval.300': '~5 minutes',
  launchAtLogin: 'Launch at login',
  launchAtLoginHint: 'Start quietly in the tray when you sign in',
  openWeb: 'View on web',
  updatedAt: 'Updated {t}',
  language: 'Language',
  langToggle: '中文',
  langToggleTitle: '切换到中文',

  'toast.watchPort': 'Now watching port {n}',
  'toast.pickedPort': 'Port {n} selected',
  'toast.sameStation': 'Already on this station',
  'toast.switched': 'Switched to {name}',
  'toast.interval': 'Check interval updated (varies ±20% at random)',

  'tray.open': 'Open panel',
  'tray.tracking': 'tracking',
  'tray.paused': 'paused',
  'tray.stopped': 'not tracking',
  'tray.station': 'Station {id}',
  'tray.noStation': 'No station set',
  'tray.quit': 'Quit',

  'notify.title': 'Port {n} is free',
  'notify.body': '{name}\n{spec}. Go plug in!',

  'err.rateLimited': 'Too many requests, slowing down automatically',
  'err.noPorts': 'This station returned no ports. Check the station number.',
  'err.notFound': 'Station {id} not found',
  'err.badId': 'Station numbers are digits only',
  'err.needConfig': 'Set a station number and pick a port first',
  'err.http': 'ChargePoint returned HTTP {status}',
  'err.network': 'Network error: {msg}',
};

const zh = {
  appName: 'ChargePoint Tracker',
  loading: '正在加载…',
  emptyTitle: '先添加一个充电桩',
  emptySub: '在下方输入 ChargePoint 链接末尾的桩号。',
  stationPlaceholder: '链接末尾的数字',
  cantRead: '无法读取充电桩',
  portName: '{n}号枪',
  watching: '跟踪',
  pickHint: '点一下枪位，选择要跟踪哪一把',
  'state.available': '空闲',
  'state.busy': '使用中',
  'state.mine': '你在使用',
  'state.offline': '不可用',
  'state.missing': '无此枪',

  'status.idle': '未在跟踪',
  'status.idleSub': '开始后，{n}号枪空出时会通知你',
  'status.running': '正在跟踪 {n}号枪',
  'status.runningSub': '空出来时会弹出通知',
  'status.free': '{n}号枪现在空闲',
  'status.freeSub': '已提醒过你，再次空出时会再提醒',
  'status.paused': '跟踪已暂停',
  'status.pausedSub': '继续后从上次状态接着判断',
  'status.retry': '会自动重试',
  'status.checkInput': '检查桩号或网络后点刷新',
  countdown: '{updated}，{s} 秒后再查',
  checking: '{updated}，正在查询…',

  start: '开始跟踪',
  resume: '继续跟踪',
  pause: '暂停跟踪',
  stop: '停止',
  stopTracking: '停止跟踪',
  refresh: '立即刷新',
  hide: '收到托盘',
  station: '桩号',
  switch: '切换',
  interval: '查询间隔',
  'interval.30': '约 30 秒',
  'interval.60': '约 1 分钟',
  'interval.120': '约 2 分钟',
  'interval.300': '约 5 分钟',
  launchAtLogin: '开机启动',
  launchAtLoginHint: '开机后在托盘里自动运行',
  openWeb: '在 ChargePoint 网页打开',
  updatedAt: '更新于 {t}',
  language: '语言',
  langToggle: 'EN',
  langToggleTitle: 'Switch to English',

  'toast.watchPort': '改为跟踪 {n}号枪',
  'toast.pickedPort': '已选择 {n}号枪',
  'toast.sameStation': '已经是这个桩了',
  'toast.switched': '已切换到 {name}',
  'toast.interval': '查询间隔已更新（会随机浮动 ±20%）',

  'tray.open': '打开面板',
  'tray.tracking': '跟踪中',
  'tray.paused': '已暂停',
  'tray.stopped': '未跟踪',
  'tray.station': '桩 {id}',
  'tray.noStation': '未设置充电桩',
  'tray.quit': '退出',

  'notify.title': '{n}号枪空出来了',
  'notify.body': '{name}\n{spec}，快去插枪吧。',

  'err.rateLimited': '请求过于频繁，已自动放慢查询',
  'err.noPorts': '这个桩号没有返回任何枪位，请检查桩号',
  'err.notFound': '找不到桩号 {id}',
  'err.badId': '桩号只能是数字',
  'err.needConfig': '请先设置桩号和要跟踪的枪',
  'err.http': 'ChargePoint 返回 HTTP {status}',
  'err.network': '网络错误：{msg}',
};

const DICTS = { en, zh };

function resolveLang(pref, systemLocale) {
  if (pref === 'en' || pref === 'zh') return pref;
  return String(systemLocale || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function format(str, params = {}) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
}

function translator(lang) {
  const d = DICTS[lang] || en;
  return (key, params) => format(d[key] ?? en[key] ?? key, params);
}

// An error carried as { code, params } so it can be re-rendered when the language changes.
function errorText(t, err) {
  if (!err) return '';
  if (typeof err === 'string') return err;
  return t(`err.${err.code}`, err.params);
}

module.exports = { DICTS, resolveLang, format, translator, errorText };
