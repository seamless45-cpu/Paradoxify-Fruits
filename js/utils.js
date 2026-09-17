// ---------- Paradoxify Fruits: math / format / pool helpers ----------
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = arr => arr[(Math.random() * arr.length) | 0];
export const TAU = Math.PI * 2;

export function angleLerp(a, b, t) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
  return a + d * clamp(t, 0, 1);
}

// compact number: 1500 -> 1.5K, 2.5M, 3.1B...
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  n = Math.round(n);
  if (n < 1000) return '' + n;
  const units = ['K', 'M', 'B', 'T', 'Q'];
  let u = -1, v = n;
  while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
  return (v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)) + units[u];
}

export function fmtTime(s) {
  s = Math.floor(s);
  return `${Math.floor(s / 60)}:${('' + (s % 60)).padStart(2, '0')}`;
}

// Simple fixed-capacity object pool
export class Pool {
  constructor(create, reset, cap = 256) {
    this.create = create; this.reset = reset; this.cap = cap;
    this.free = []; this.active = new Set(); this.total = 0;
  }
  obtain() {
    let o = this.free.pop();
    if (!o) { if (this.total >= this.cap) return null; o = this.create(); this.total++; }
    this.active.add(o);
    return o;
  }
  release(o) {
    if (!this.active.has(o)) return;
    this.active.delete(o);
    if (this.reset) this.reset(o);
    this.free.push(o);
  }
  releaseAll() { for (const o of [...this.active]) this.release(o); }
  setCap(c) { this.cap = c; }
}

// Central scheduler (works on scaled game-time)
export class Scheduler {
  constructor() { this.tasks = []; }
  after(delay, fn) { const t = { t: delay, fn, rep: 0 }; this.tasks.push(t); return t; }
  // repeat fn count times, every interval (first call after `interval`, or immediately if fireFirst)
  every(interval, count, fn, fireFirst = false) {
    const t = { t: fireFirst ? 0 : interval, fn, rep: count, interval };
    this.tasks.push(t); return t;
  }
  cancel(t) { const i = this.tasks.indexOf(t); if (i >= 0) this.tasks.splice(i, 1); }
  clear() { this.tasks.length = 0; }
  update(dt) {
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const t = this.tasks[i];
      t.t -= dt;
      if (t.t <= 0) {
        if (t.rep > 0) {
          t.fn(t.rep);
          t.rep--;
          if (t.rep <= 0) this.tasks.splice(i, 1);
          else t.t += t.interval;
        } else { this.tasks.splice(i, 1); t.fn(); }
      }
    }
  }
}
