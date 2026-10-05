'use strict';
const assert = require('assert');
const { Tracker, nextDelayMs, classify, HttpError, toErrorInfo } = require('../src/tracker');
const { translator, resolveLang, DICTS } = require('../src/i18n');

// jitter stays within ±20%
for (let i = 0; i < 2000; i++) {
  const ms = nextDelayMs(60);
  assert(ms >= 48000 && ms <= 72000, 'jitter out of range: ' + ms);
}
assert.strictEqual(nextDelayMs(60, { rand: () => 0.5 }), 60000);
assert.strictEqual(nextDelayMs(60, { rand: () => 0.5, failures: 2 }), 240000);   // backoff x4
assert.strictEqual(nextDelayMs(60, { rand: () => 0.5, failures: 10 }), 600000);  // cap x10
assert.strictEqual(nextDelayMs(60, { rand: () => 0.5, failures: 10, rateLimited: true }), 1800000); // 429 cap 30min
assert.strictEqual(classify('in_use_by_driver'), 'mine');
assert.strictEqual(classify('in_use'), 'busy');
assert.strictEqual(classify('unavailable'), 'offline');

// i18n: both dictionaries have the same keys, language resolution, formatting
assert.deepStrictEqual(Object.keys(DICTS.en).sort(), Object.keys(DICTS.zh).sort());
assert.strictEqual(resolveLang('auto', 'zh-CN'), 'zh');
assert.strictEqual(resolveLang('auto', 'en-US'), 'en');
assert.strictEqual(resolveLang('en', 'zh-CN'), 'en');
assert.strictEqual(translator('en')('portName', { n: 2 }), 'Port 2');
assert.strictEqual(translator('zh')('portName', { n: 2 }), '2号枪');
assert.deepStrictEqual(toErrorInfo(new HttpError(404), '9'), { code: 'notFound', params: { id: '9' } });

// state machine with fake timers
const mk = (p2) => ({ name: ['A', 'B'], portsInfo: { ports: [{ outletNumber: 1, statusV2: 'available' }, { outletNumber: 2, statusV2: p2 }] } });
(async () => {
  const seq = ['in_use', 'in_use', 'available', 'available', 'in_use', 'available', 'ERR429', 'available'];
  let i = 0;
  const fetchJson = async () => { const v = seq[i++]; if (v === 'ERR429') throw new HttpError(429); return mk(v); };
  const timers = { setTimeout: () => 1, clearTimeout: () => {} };
  const t = new Tracker({ fetchJson, timers });
  t.configure({ deviceId: '100000', port: 2 });
  const freed = [], errors = [];
  t.on('freed', (s, p) => freed.push(i));
  t.on('error', (e) => errors.push(e));

  t.start(); await new Promise((r) => setImmediate(r));          // in_use
  await t.tick(); await t.tick();                                  // in_use, available -> notify
  await t.tick();                                                  // available (no repeat)
  t.pause(); assert.strictEqual(t.nextAt, null);
  t.start(); await new Promise((r) => setImmediate(r));          // resume: in_use
  await t.tick();                                                  // available -> notify again
  await t.tick();                                                  // 429
  assert.strictEqual(t.failures, 1); assert.strictEqual(errors[0].code, 'rateLimited');
  assert(t.nextAt - Date.now() > 60000, 'backoff applied after 429');
  await t.tick();                                                  // available after avail (prev kept on error) -> no notify
  assert.deepStrictEqual(freed, [3, 6]);

  // stop resets baseline: starting while already free notifies immediately
  t.stop();
  const t2 = new Tracker({ fetchJson: async () => mk('available'), timers });
  t2.configure({ deviceId: '1', port: 2 }); let n = 0; t2.on('freed', () => n++);
  t2.start(); await new Promise((r) => setImmediate(r));
  assert.strictEqual(n, 1);
  console.log('all tracker tests passed');
})().catch((e) => { console.error(e); process.exit(1); });
