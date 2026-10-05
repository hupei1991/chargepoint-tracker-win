'use strict';
// Pure tracking logic — no Electron imports, so it can be unit-tested in plain Node.
const { EventEmitter } = require('events');

const API = (id) => `https://mc.chargepoint.com/map-prod/v3/station/info?deviceId=${encodeURIComponent(id)}`;

// Map raw ChargePoint statuses to three display buckets.
function classify(raw) {
  const s = String(raw || '').toLowerCase();
  if (s === 'available') return 'available';
  if (s === 'in_use_by_driver') return 'mine';
  if (s.startsWith('in_use') || s === 'charging' || s === 'busy' || s === 'occupied') return 'busy';
  return 'offline'; // unavailable, unknown, out_of_network, etc.
}

function parseStation(json) {
  const ports = (json?.portsInfo?.ports || []).map((p) => {
    const raw = p.statusV2 || p.status || 'unknown';
    return {
      number: Number(p.outletNumber),
      raw,
      state: classify(raw),
      level: p.level || p.displayLevel || '',
      plug: p.connectorList?.[0]?.displayPlugType || '',
      kw: p.powerRange?.max ? Number(p.powerRange.max) : null,
    };
  });
  const name = Array.isArray(json?.name) ? json.name.join(' / ') : String(json?.name || '');
  const a = json?.address || {};
  return {
    deviceId: json?.deviceId,
    name,
    address: [a.address1, a.city].filter(Boolean).join(', '),
    description: json?.description || '',
    ports,
    price: json?.stationPrice || null,
  };
}

// Interval with ±jitter (fraction), multiplied by backoff factor after failures.
function nextDelayMs(baseSec, { jitter = 0.2, failures = 0, rateLimited = false, rand = Math.random } = {}) {
  const j = 1 + (rand() * 2 - 1) * jitter;
  let backoff = 1;
  if (failures > 0) backoff = Math.min(2 ** failures, rateLimited ? 30 : 10);
  const ms = baseSec * 1000 * j * backoff;
  return Math.round(Math.min(ms, 30 * 60 * 1000)); // never wait more than 30 min
}

class HttpError extends Error {
  constructor(status) { super(`HTTP ${status}`); this.status = status; }
}

// Errors carry a code + params so the UI can translate them.
class CodedError extends Error {
  constructor(code, params = {}) { super(code); this.code = code; this.params = params; }
}

function toErrorInfo(e, deviceId) {
  if (e && e.code && e instanceof CodedError) return { code: e.code, params: e.params };
  if (e && e.status === 429) return { code: 'rateLimited', params: {} };
  if (e && e.status === 404) return { code: 'notFound', params: { id: deviceId } };
  if (e && e.status) return { code: 'http', params: { status: e.status } };
  return { code: 'network', params: { msg: (e && e.message) || String(e) } };
}

/**
 * Tracker states: 'stopped' | 'running' | 'paused'
 * Events:
 *   'update'  (snapshot)            – after every fetch attempt
 *   'error'   ({ code, params })    – fetch failed
 *   'freed'   (station, port)       – watched port turned available
 *   'state'   (state)               – tracking state changed
 */
class Tracker extends EventEmitter {
  constructor({ fetchJson, intervalSec = 60, jitter = 0.2, timers = { setTimeout, clearTimeout }, rand = Math.random } = {}) {
    super();
    this.fetchJson = fetchJson;
    this.intervalSec = intervalSec;
    this.jitter = jitter;
    this.timers = timers;
    this.rand = rand;
    this.state = 'stopped';
    this.deviceId = null;
    this.port = null;
    this.prevState = null;     // last seen bucket of the watched port
    this.failures = 0;
    this.timer = null;
    this.nextAt = null;
    this.lastChecked = null;
    this.lastStation = null;
    this.lastError = null;
  }

  configure({ deviceId, port, intervalSec }) {
    if (deviceId != null && String(deviceId) !== String(this.deviceId ?? '')) {
      this.deviceId = String(deviceId) || null;
      this.prevState = null;
      this.lastStation = null;
    }
    if (port != null && Number(port) !== this.port) {
      this.port = Number(port);
      this.prevState = null;
    }
    if (intervalSec) this.intervalSec = Math.max(20, Number(intervalSec));
  }

  async fetchOnce() {
    const json = await this.fetchJson(API(this.deviceId));
    const station = parseStation(json);
    if (!station.ports.length) throw new CodedError('noPorts');
    this.lastStation = station;
    this.lastChecked = Date.now();
    this.lastError = null;
    return station;
  }

  // One poll: fetch, compare, emit.
  async tick() {
    let rateLimited = false;
    try {
      const station = await this.fetchOnce();
      this.failures = 0;
      const p = station.ports.find((x) => x.number === this.port);
      const cur = p ? p.state : 'missing';
      if (this.state === 'running' && cur === 'available' && this.prevState !== 'available') {
        this.emit('freed', station, p);
      }
      this.prevState = cur;
    } catch (e) {
      this.failures += 1;
      rateLimited = e && e.status === 429;
      this.lastError = toErrorInfo(e, this.deviceId);
      this.emit('error', this.lastError);
    }
    this.schedule(rateLimited); // schedule first so the snapshot carries nextAt
    this.emit('update', this.snapshot());
  }

  schedule(rateLimited = false) {
    this.timers.clearTimeout(this.timer);
    this.timer = null;
    if (this.state !== 'running') { this.nextAt = null; return; }
    const ms = nextDelayMs(this.intervalSec, { jitter: this.jitter, failures: this.failures, rateLimited, rand: this.rand });
    this.nextAt = Date.now() + ms;
    this.timer = this.timers.setTimeout(() => this.tick(), ms);
  }

  start() {
    if (!this.deviceId || !this.port) throw new CodedError('needConfig');
    if (this.state === 'running') return;
    const resumed = this.state === 'paused';
    this.state = 'running';
    if (!resumed) this.prevState = null; // fresh start: notify if it's free right now
    this.failures = 0;
    this.emit('state', this.state);
    this.tick();
  }

  pause() {
    if (this.state !== 'running') return;
    this.state = 'paused';
    this.schedule();
    this.emit('state', this.state);
    this.emit('update', this.snapshot());
  }

  stop() {
    if (this.state === 'stopped') return;
    this.state = 'stopped';
    this.prevState = null;
    this.failures = 0;
    this.schedule();
    this.emit('state', this.state);
    this.emit('update', this.snapshot());
  }

  snapshot() {
    return {
      state: this.state,
      deviceId: this.deviceId,
      port: this.port,
      intervalSec: this.intervalSec,
      station: this.lastStation,
      lastChecked: this.lastChecked,
      nextAt: this.nextAt,
      error: this.lastError,
      failures: this.failures,
    };
  }
}

module.exports = { Tracker, parseStation, classify, nextDelayMs, HttpError, CodedError, toErrorInfo, API };
