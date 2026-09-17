// ---------- Procedural WebAudio SFX (no assets needed) ----------
import { rand, clamp } from './utils.js';

export class AudioSys {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null; this.master = null; this.noiseBuf = null;
    this.unlocked = false;
  }
  unlock() {
    if (this.unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 1.2;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.unlocked = true;
      this.applyVolume();
    } catch (e) { /* audio unavailable */ }
  }
  applyVolume() {
    if (!this.master) return;
    this.master.gain.value = this.settings.get('mute') ? 0 : this.settings.get('volume');
  }
  toggleMute() {
    this.settings.set('mute', !this.settings.get('mute'));
    this.applyVolume();
    return this.settings.get('mute');
  }
  now() { return this.ctx ? this.ctx.currentTime : 0; }

  _noise(dur, { freq = 1000, q = 0.8, type = 'lowpass', gain = 0.5, slideTo = null, delay = 0 } = {}) {
    if (!this.unlocked) return;
    const t = this.now() + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  _tone(freq, dur, { type = 'sine', gain = 0.4, slideTo = null, delay = 0 } = {}) {
    if (!this.unlocked) return;
    const t = this.now() + delay;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  ui() { this._tone(660, 0.07, { type: 'square', gain: 0.12 }); }
  shoot() { this._noise(0.09, { freq: 3200, type: 'highpass', gain: 0.22 }); this._tone(880, 0.08, { type: 'sawtooth', gain: 0.1, slideTo: 220 }); }
  swing() { this._noise(0.12, { freq: 2400, type: 'bandpass', q: 2, gain: 0.18, slideTo: 500 }); }
  hit() { this._noise(0.08, { freq: 900, gain: 0.3 }); this._tone(160, 0.1, { gain: 0.3, slideTo: 60 }); }
  explosion(big = 1) {
    big = clamp(big, 0.3, 3);
    this._noise(0.5 * big, { freq: 900, gain: 0.5, slideTo: 60 });
    this._tone(90, 0.6 * big, { gain: 0.5, slideTo: 28 });
    this._noise(0.2, { freq: 5000, type: 'highpass', gain: 0.2 });
  }
  zap() {
    this._noise(0.22, { freq: 6000, type: 'highpass', gain: 0.3, slideTo: 800 });
    this._tone(rand(1400, 2200), 0.16, { type: 'sawtooth', gain: 0.16, slideTo: rand(150, 300) });
  }
  thunder() {
    this._noise(1.1, { freq: 500, gain: 0.5, slideTo: 50, delay: 0.03 });
    this._tone(55, 1.2, { gain: 0.4, slideTo: 26, delay: 0.03 });
  }
  charge(pct = 0.5) { this._tone(120 + pct * 500, 0.12, { type: 'sawtooth', gain: 0.1 }); }
  alarm() {
    for (let i = 0; i < 3; i++) {
      this._tone(740, 0.16, { type: 'square', gain: 0.14, delay: i * 0.34 });
      this._tone(560, 0.16, { type: 'square', gain: 0.14, delay: i * 0.34 + 0.17 });
    }
  }
  freeze() { this._tone(1800, 0.3, { type: 'sine', gain: 0.15, slideTo: 3200 }); this._noise(0.25, { freq: 8000, type: 'highpass', gain: 0.12 }); }
  dash() { this._noise(0.18, { freq: 1200, type: 'bandpass', q: 1.5, gain: 0.25, slideTo: 4500 }); }
  stomp() { this._tone(70, 0.5, { gain: 0.6, slideTo: 24 }); this._noise(0.4, { freq: 700, gain: 0.5, slideTo: 80 }); }
  roar() { this._tone(140, 0.5, { type: 'sawtooth', gain: 0.3, slideTo: 70 }); this._noise(0.5, { freq: 600, gain: 0.3, slideTo: 150 }); }
  horn() {
    this._tone(98, 0.55, { type: 'sawtooth', gain: 0.22 });
    this._tone(147, 0.55, { type: 'sawtooth', gain: 0.18, delay: 0.03 });
    this._tone(196, 0.4, { type: 'square', gain: 0.08, delay: 0.05 });
  }
  heal() { this._tone(520, 0.2, { gain: 0.12, slideTo: 1040 }); }
  die() { this._tone(300, 0.5, { type: 'sawtooth', gain: 0.2, slideTo: 50 }); }
}
