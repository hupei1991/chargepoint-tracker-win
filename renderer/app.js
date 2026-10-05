'use strict';
const $ = (id) => document.getElementById(id);
let snap = null;
let lang = 'en';
let strings = {};

// Same placeholder format as src/i18n.js
const t = (key, params = {}) =>
  String(strings[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => (params[k] ?? `{${k}}`));
const errText = (err) => (!err ? '' : typeof err === 'string' ? err : t(`err.${err.code}`, err.params));

function applyStrings(l) {
  lang = l.lang;
  strings = l.strings;
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  document.querySelectorAll('[data-i18n-label]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nLabel)));
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  $('ports').setAttribute('aria-label', t('pickHint'));
  if (snap) render(snap);
}

// J1772-style socket face, ring color comes from CSS (--c)
const SOCKET = `
<svg class="socket" viewBox="0 0 64 64" aria-hidden="true">
  <circle class="face" cx="32" cy="32" r="27"/>
  <circle class="ring" cx="32" cy="32" r="27"/>
  <circle class="pin" cx="22" cy="26" r="5.2"/>
  <circle class="pin" cx="42" cy="26" r="5.2"/>
  <circle class="pin" cx="32" cy="44" r="4.4"/>
  <circle class="pin" cx="22.5" cy="40" r="2.2"/>
  <circle class="pin" cx="41.5" cy="40" r="2.2"/>
</svg>`;
const BELL = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2a4 4 0 0 0-4 4v2.6L2.8 11h10.4L12 8.6V6a4 4 0 0 0-4-4zM6.5 12.5a1.5 1.5 0 0 0 3 0" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function fmtTime(ts) {
  return ts ? new Date(ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-US', { hour12: false }) : '';
}

function renderPorts(s) {
  const box = $('ports');
  const ports = s.station?.ports || [];
  box.innerHTML = '';
  for (const p of ports) {
    const b = document.createElement('button');
    b.className = `port ${p.state}`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(p.number === s.port));
    const stateText = strings['state.' + p.state] ? t('state.' + p.state) : p.raw;
    b.setAttribute('aria-label', `${t('portName', { n: p.number })}, ${stateText}`);
    b.innerHTML = `${SOCKET}
      <span class="watch-tag">${BELL}${t('watching')}</span>
      <div class="port-name">${t('portName', { n: p.number })}</div>
      <div class="port-state">${stateText}</div>
      <div class="port-spec">${[p.level, p.plug, p.kw ? p.kw + ' kW' : ''].filter(Boolean).join('  ')}</div>`;
    b.addEventListener('click', async () => {
      if (p.number === snap.port) return;
      render(await window.cp.setPort(p.number));
      toast(t(snap.state === 'running' ? 'toast.watchPort' : 'toast.pickedPort', { n: p.number }));
    });
    box.appendChild(b);
  }
  $('hint').style.visibility = ports.length > 1 ? 'visible' : 'hidden';
}

function statusCopy(s) {
  const port = s.station?.ports.find((x) => x.number === s.port);
  const n = { n: s.port };
  if (s.error && s.state !== 'stopped') return [errText(s.error), t('status.retry'), 'error'];
  if (s.error) return [errText(s.error), t('status.checkInput'), 'error'];
  if (s.state === 'running') {
    if (port?.state === 'available') return [t('status.free', n), t('status.freeSub'), 'running'];
    return [t('status.running', n), t('status.runningSub'), 'running'];
  }
  if (s.state === 'paused') return [t('status.paused'), t('status.pausedSub'), 'paused'];
  return [t('status.idle'), t('status.idleSub', n), ''];
}

function render(s) {
  snap = s;
  const st = s.station;
  const empty = !s.deviceId;
  document.body.classList.toggle('empty', empty);
  $('name').textContent = empty ? t('emptyTitle') : st?.name || (s.error ? t('cantRead') : t('loading'));
  $('address').textContent = empty ? t('emptySub') : st ? [st.address, st.description].filter(Boolean).join(', ') : '';
  renderPorts(s);

  const [text, sub, cls] = empty ? ['', '', ''] : statusCopy(s);
  $('status-text').textContent = text;
  $('status-sub').textContent = sub;
  $('dot').className = `dot ${cls}`;
  tickCountdown();

  const primary = $('primary');
  primary.textContent = t(s.state === 'running' ? 'pause' : s.state === 'paused' ? 'resume' : 'start');
  primary.classList.toggle('pause', s.state === 'running');
  primary.disabled = !st;
  $('stop').disabled = s.state === 'stopped';

  if (document.activeElement !== $('station-input')) $('station-input').value = s.deviceId || '';
}

function tickCountdown() {
  const el = $('checked');
  if (!snap?.lastChecked) { el.textContent = ''; return; }
  const updated = t('updatedAt', { t: fmtTime(snap.lastChecked) });
  if (snap.state === 'running' && snap.nextAt) {
    const sec = Math.max(0, Math.round((snap.nextAt - Date.now()) / 1000));
    el.textContent = sec > 0 ? t('countdown', { updated, s: sec }) : t('checking', { updated });
  } else {
    el.textContent = updated;
  }
}
setInterval(tickCountdown, 1000);

// ---------- events ----------
$('primary').addEventListener('click', async () => {
  render(await window.cp.action(snap.state === 'running' ? 'pause' : 'start'));
});
$('stop').addEventListener('click', async () => render(await window.cp.action('stop')));

$('refresh').addEventListener('click', async () => {
  const b = $('refresh');
  b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin');
  render(await window.cp.refresh());
});
$('hide').addEventListener('click', () => window.cp.hide());
$('web').addEventListener('click', () => window.cp.openWeb());
$('lang').addEventListener('click', async () => applyStrings(await window.cp.setLang(lang === 'zh' ? 'en' : 'zh')));

$('station-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('station-input').value.trim();
  if (id === String(snap.deviceId) && snap.station) return toast(t('toast.sameStation'));
  $('switch').disabled = true;
  try {
    const s = await window.cp.setStation(id);
    render(s);
    if (!s.error) {
      toast(t('toast.switched', { name: s.station.name }));
      $('station-input').blur();
      addRecent(id);
    }
  } catch (err) {
    toast(String(err.message || err).replace(/^Error invoking remote method '\w+': (Error: )?/, ''));
  } finally {
    $('switch').disabled = false;
  }
});

$('interval').addEventListener('change', async (e) => {
  render(await window.cp.setInterval(Number(e.target.value)));
  toast(t('toast.interval'));
});
$('login').addEventListener('change', async (e) => {
  e.target.checked = await window.cp.setLogin(e.target.checked);
});

function addRecent(id) {
  const dl = $('recent');
  if ([...dl.options].some((o) => o.value === id)) return;
  const o = document.createElement('option');
  o.value = id;
  dl.prepend(o);
}

window.cp.onUpdate(render);
window.cp.onToast(toast);
window.cp.onLang(applyStrings);

(async () => {
  const { snapshot, settings, openAtLogin, lang: l, strings: str } = await window.cp.get();
  applyStrings({ lang: l, strings: str });
  $('interval').value = String([30, 60, 120, 300].includes(settings.intervalSec) ? settings.intervalSec : 60);
  $('login').checked = openAtLogin;
  (settings.recent || []).forEach(addRecent);
  render(snapshot);
  if (!snapshot.deviceId) $('station-input').focus();
})();
