// ---------- Advanced graphics settings ----------
export const PRESETS = {
  Low:    { resolutionScale: 0.7, shadows: false, shadowSize: 1024, particleDensity: 0.35, debrisLimit: 80,  boltDetail: 0, glowSprites: false, maxPixelRatio: 1,   fogDensity: 0.006, enemyCap: 40, bloom: false },
  Medium: { resolutionScale: 1.0, shadows: true,  shadowSize: 1024, particleDensity: 0.7,  debrisLimit: 200, boltDetail: 0, glowSprites: true,  maxPixelRatio: 1.5, fogDensity: 0.0045, enemyCap: 55, bloom: false },
  High:   { resolutionScale: 1.0, shadows: true,  shadowSize: 2048, particleDensity: 1.0,  debrisLimit: 320, boltDetail: 1, glowSprites: true,  maxPixelRatio: 2,   fogDensity: 0.0038, enemyCap: 70, bloom: true },
  Ultra:  { resolutionScale: 1.25, shadows: true, shadowSize: 4096, particleDensity: 1.8,  debrisLimit: 520, boltDetail: 1, glowSprites: true,  maxPixelRatio: 2,   fogDensity: 0.0032, enemyCap: 85, bloom: true },
};

export const DEFAULT_SETTINGS = {
  preset: 'High',
  resolutionScale: 1.0,
  antialias: true,          // applied on reload
  maxPixelRatio: 2,
  shadows: true,
  shadowSize: 2048,
  particleDensity: 1.0,
  debrisLimit: 320,
  boltDetail: 1,            // 0 = low (12 segs), 1 = high (26 segs)
  glowSprites: true,
  fogDensity: 0.0038,
  enemyCap: 70,
  shakeEnabled: true,
  shakeIntensity: 1.0,
  damageNumbers: true,
  screenFlash: true,
  fpsCounter: false,
  autoRes: false,
  fov: 55,
  minimap: true,
  bloom: true,
  bloomStrength: 0.9,
  exposure: 1.1,
  camPitch: 38,
  mute: false,
  volume: 0.55,
};

const KEY = 'paradoxify_graphics_v1';

export class GraphicsSettings {
  constructor() {
    this.values = { ...DEFAULT_SETTINGS };
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(this.values, JSON.parse(raw));
    } catch (e) { /* ignore */ }
    this.listeners = [];
  }
  get(k) { return this.values[k]; }
  set(k, v, save = true) {
    this.values[k] = v;
    if (save) this.save();
    this.emit(k, v);
  }
  applyPreset(name) {
    if (!PRESETS[name]) return;
    Object.assign(this.values, PRESETS[name], { preset: name });
    this.save(); this.emit('*');
  }
  reset() { this.values = { ...DEFAULT_SETTINGS }; this.save(); this.emit('*'); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.values)); } catch (e) {} }
  onChange(fn) { this.listeners.push(fn); }
  emit(k, v) { for (const fn of this.listeners) { try { fn(k, v); } catch (e) { console.error(e); } } }
}
