// ---------- Game: renderer, camera + shake, input, waves, main loop ----------
import * as THREE from 'three';
import { clamp, lerp } from './utils.js';
import { Scheduler } from './utils.js';
import { GraphicsSettings } from './graphics.js';
import { AudioSys } from './audio.js';
import { World } from './world.js';
import { Effects } from './effects.js';
import { EnemyManager } from './enemies.js';
import { Player } from './player.js';
import { SkillSystem } from './skills.js';
import { UI } from './ui.js';

export class Game {
  constructor() {
    this.settings = new GraphicsSettings();
    this.audio = new AudioSys(this.settings);
    this.scheduler = new Scheduler();
    this.input = { up: false, down: false, left: false, right: false, sprint: false, joyX: 0, joyZ: 0, firing: false };
    this.isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    this.time = 0;
    this.wave = 1;
    this.waveT = 0;
    this.timeScale = 1;
    this.hitstopT = 0;
    this.hitstopDur = 0;
    // camera shake: POSITION ONLY (x,y,z). Rotation is never touched by shake.
    this.trauma = 0;
    this.sustain = { mag: 0, t: 0, dur: 1 };
    this.shakeOffset = new THREE.Vector3();
    this.camYaw = 0;
    this.camDist = 26;
    this.camPitch = 38 * Math.PI / 180;
    this.aimPoint = new THREE.Vector3(0, 0, 10);
    this.mouseNDC = new THREE.Vector2(0, 0);
    this.hasMouse = false;
    this.fpsEMA = 60;
    this.state = 'menu';
    this.menuT = 0;
    this.best = this.loadBest();
    this.autoResT = 0;
    this.combo = { n: 0, t: 0 };
    this.baseFov = this.settings.get('fov');
    this.fovKick = 0;
    this.followVel = new THREE.Vector3();
    this._lastP = new THREE.Vector3(0, 0, 18);
    this.smoothLook = new THREE.Vector3(0, 1.6, 18);
    this.composer = null; this.bloomPass = null;
  }

  async init(onProgress) {
    const step = async (pct, msg) => { onProgress(pct, msg); await new Promise(r => setTimeout(r, 10)); };
    await step(8, 'creating renderer…');
    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: this.settings.get('antialias'), powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.settings.get('exposure');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 1500);
    this.camera.position.set(0, 25, 43); // no spawn-snap: start on the menu orbit
    this.camera.lookAt(0, 2, 0);
    this.applySize();

    await step(25, 'building arena…');
    this.world = new World(this);
    this.world.build();

    await step(45, 'forging effects…');
    this.effects = new Effects(this);
    this.effects.init();

    await step(60, 'summoning player…');
    this.player = new Player(this);
    this.player.build();
    this.enemies = new EnemyManager(this);
    this.skills = new SkillSystem(this);
    this.skills.build();

    await step(78, 'painting interface…');
    this.ui = new UI(this);
    this.ui.init();
    if (this.isTouch) document.body.classList.add('touch');

    // aim marker ring
    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.25, 40),
      new THREE.MeshBasicMaterial({ color: 0xa64dff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    this.aimMarker.geometry.rotateX(-Math.PI / 2);
    this.scene.add(this.aimMarker);

    this.settings.onChange((k) => this.applySettings(k));
    this.applySettings('*');
    this.bindInput();
    this.ui.el.mute.textContent = this.settings.get('mute') ? '🔇' : '🔊';

    await step(92, 'opening portals…');
    this.ui.showMenu();
    await step(96, 'charging bloom…');
    await this.initComposer();
    await step(100, 'ready!');
  }

  // ================= SETTINGS =================
  async initComposer() {
    // Bloom post-processing (dynamic import: import-map in browser, graceful skip in node)
    try {
      const C = await import('three/addons/postprocessing/EffectComposer.js');
      const RP = await import('three/addons/postprocessing/RenderPass.js');
      const UB = await import('three/addons/postprocessing/UnrealBloomPass.js');
      const OP = await import('three/addons/postprocessing/OutputPass.js');
      this.composer = new C.EffectComposer(this.renderer);
      this.composer.addPass(new RP.RenderPass(this.scene, this.camera));
      this.bloomPass = new UB.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), this.settings.get('bloomStrength'), 0.55, 0.55);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OP.OutputPass());
      try {
        if (this.renderer.capabilities.isWebGL2) {
          this.composer.renderTarget1.samples = 4;
          this.composer.renderTarget2.samples = 4;
        }
      } catch (e) {}
      const pr = Math.min(window.devicePixelRatio || 1, this.settings.get('maxPixelRatio')) * this.settings.get('resolutionScale');
      this.composer.setPixelRatio(pr);
      this.composer.setSize(window.innerWidth, window.innerHeight);
    } catch (e) { this.composer = null; this.bloomPass = null; }
  }
  applySize() {
    const s = this.settings;
    const pr = Math.min(window.devicePixelRatio || 1, s.get('maxPixelRatio')) * s.get('resolutionScale');
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    if (this.composer) { this.composer.setPixelRatio(pr); this.composer.setSize(window.innerWidth, window.innerHeight); }
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }
  applySettings(k) {
    if (k === '*' || k === 'resolutionScale' || k === 'maxPixelRatio') this.applySize();
    if (k === '*' || k === 'shadows' || k === 'shadowSize' || k === 'fogDensity') this.world.applySettings();
    if (k === 'boltDetail') this.effects.rebuildBoltVariants();
    if (k === '*' || k === 'fov') this.baseFov = this.settings.get('fov');
    if (k === '*' || k === 'camPitch') this.camPitch = this.settings.get('camPitch') * Math.PI / 180;
    if (k === '*' || k === 'bloomStrength') { if (this.bloomPass) this.bloomPass.strength = this.settings.get('bloomStrength'); }
    if (k === '*' || k === 'exposure') this.renderer.toneMappingExposure = this.settings.get('exposure');
    if (k === '*' || k === 'fpsCounter') this.ui.el.fps.classList.toggle('hidden', !this.settings.get('fpsCounter'));
    if (k === '*' || k === 'volume' || k === 'mute') this.audio.applyVolume();
    if (!this.settings.get('shakeEnabled')) { this.trauma = 0; }
  }

  // ================= SHAKE (position-only) =================
  // ================= RUN STATE / MENU / PAUSE =================
  loadBest() {
    try {
      if (typeof localStorage === 'undefined') return { wave: 0, kills: 0, time: 0, combo: 0 };
      const raw = localStorage.getItem('paradoxify_best_v1');
      if (raw) return Object.assign({ wave: 0, kills: 0, time: 0, combo: 0 }, JSON.parse(raw));
    } catch (e) {}
    return { wave: 0, kills: 0, time: 0, combo: 0 };
  }
  recordBest() {
    let changed = false;
    if (this.wave > this.best.wave) { this.best.wave = this.wave; changed = true; }
    if (this.enemies.kills > this.best.kills) { this.best.kills = this.enemies.kills; changed = true; }
    if (this.time > this.best.time) { this.best.time = Math.floor(this.time); changed = true; }
    if ((this.best.combo || 0) >= 5) changed = true;
    if (changed) { try { if (typeof localStorage !== 'undefined') localStorage.setItem('paradoxify_best_v1', JSON.stringify(this.best)); } catch (e) {} }
  }
  startRun() {
    this.audio.unlock();
    this.enemies.clearAll();
    this.scheduler.clear();
    this.effects.zones.length = 0;
    this.time = 0; this.wave = 1; this.waveT = 0;
    this.enemies.kills = 0;
    this.trauma = 0;
    this.skills.cancelChannels();
    const P = this.player;
    P.dead = false; P.hp = P.maxHp; P.pos.set(0, 0, 18); P.vel.set(0, 0, 0);
    P.buffs.length = 0; P.superState = null; P.invuln = 1;
    for (let i = 0; i < 6; i++) this.skills.fruitCds[i] = 0;
    for (let i = 0; i < 5; i++) this.skills.swordCds[i] = 0;
    this.ui.hideDeath(); this.ui.hideMenu();
    document.getElementById('pause-modal').classList.add('hidden');
    this.state = 'playing';
    for (let i = 0; i < 4; i++) this.enemies.spawn('normal', this.world.randomEdgePoint(new THREE.Vector3()));
    this.ui.announce('⚔️ WAVE 1 — FIGHT!', '#ffd94d');
    this.ui.refreshBuffs();
  }
  pauseGame() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.showPause();
  }
  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    document.getElementById('pause-modal').classList.add('hidden');
  }
  togglePause() {
    if (this.state === 'playing') this.pauseGame();
    else if (this.state === 'paused') this.resumeGame();
  }
  toMenu() {
    this.state = 'menu';
    this.recordBest();
    this.skills.cancelChannels();
    document.getElementById('pause-modal').classList.add('hidden');
    this.ui.hideDeath(); this.ui.hideCharge(); this.ui.hideChannel();
    this.ui.showMenu();
  }
  restartRun() { this.startRun(); }
  addKick(x) { this.fovKick = Math.min(24, this.fovKick + x); }
  onEnemyKilled(e) {
    this.combo.n++; this.combo.t = 3.5;
    if (this.combo.n > (this.best.combo || 0)) this.best.combo = this.combo.n;
    const n = this.combo.n;
    const label = n === 5 ? '🔥 RAMPAGE x5' : n === 10 ? '🔥🔥 FRENZY x10' : n === 20 ? '⚡ UNSTOPPABLE x20' : n === 35 ? '💀 ANNIHILATION x35' : n === 50 ? '🌌 GODLIKE x50' : n === 100 ? '♾️ PARADOX x100' : null;
    if (label) { this.ui.announce(label, '#ffd94d'); this.audio.roar(); }
  }
  updateBoss() {
    let boss = null;
    for (const e of this.enemies.list) {
      if (!e.dead && e.tier === 'boss') { if (!boss || e.hp > boss.hp) boss = e; }
    }
    this.ui.updateBoss(boss);
  }
  autoResTick(rawDt) {
    if (!this.settings.get('autoRes') || this.state !== 'playing') return;
    this.autoResT += rawDt;
    if (this.autoResT < 2.5) return;
    this.autoResT = 0;
    const fps = this.fpsEMA, cur = this.settings.get('resolutionScale');
    if (fps < 48 && cur > 0.5) this.settings.set('resolutionScale', Math.round((cur - 0.1) * 20) / 20);
    else if (fps > 58 && cur < 1.25) this.settings.set('resolutionScale', Math.round((cur + 0.05) * 20) / 20);
  }

  shakeFrom(pos, power, maxDist = 40) {
    if (!this.settings.get('shakeEnabled') || power <= 0) return;
    const d = this.camera.position.distanceTo(pos);
    const fall = clamp(1 - d / maxDist, 0, 1); // closer = stronger, farther = weaker
    if (fall <= 0) return;
    this.trauma = clamp(this.trauma + power * fall * (0.35 + 0.65 * fall), 0, 1);
    if (fall > 0.35) this.fovKick = Math.min(24, this.fovKick + power * fall * 7);
  }
  sustainShake(mag, dur) {
    if (!this.settings.get('shakeEnabled')) return;
    this.sustain.mag = clamp(mag, 0, 1); this.sustain.t = dur; this.sustain.dur = dur;
  }
  updateShake(dt) {
    this.fovKick = Math.max(0, this.fovKick - dt * 26);
    if (this.sustain.t > 0) {
      this.sustain.t -= dt;
      this.trauma = Math.max(this.trauma, this.sustain.mag * clamp(this.sustain.t / this.sustain.dur + 0.25, 0, 1));
    }
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    const I = this.settings.get('shakeEnabled') ? this.settings.get('shakeIntensity') : 0;
    const amp = this.trauma * this.trauma * 3.2 * I;
    // high-frequency random positional offsets on X, Y, Z only — NEVER rotation
    this.shakeOffset.set(
      (Math.random() * 2 - 1) * amp,
      (Math.random() * 2 - 1) * amp * 0.7,
      (Math.random() * 2 - 1) * amp
    );
  }

  hitstop(dur) {
    this.hitstopT = dur; this.hitstopDur = dur;
    this.timeScale = 0;
  }

  // ================= INPUT =================
  bindInput() {
    const inp = this.input;
    const keyMap = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      this.audio.unlock();
      if (keyMap[e.code]) { inp[keyMap[e.code]] = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.sprint = true;
      if (e.code === 'KeyQ') this.qHeld = true;
      if (e.code === 'KeyE') this.eHeld = true;
      if (e.repeat) return;
      const modalIds = ['picker-modal', 'settings-modal', 'help-modal'];
      const anyModal = modalIds.some(id => !document.getElementById(id).classList.contains('hidden'));
      if (e.code === 'Escape') {
        if (anyModal) for (const id of modalIds) document.getElementById(id).classList.add('hidden');
        else this.togglePause();
        return;
      }
      if (e.code === 'KeyM') { const m = this.audio.toggleMute(); this.ui.el.mute.textContent = m ? '🔇' : '🔊'; this.ui.refreshSettingsCtl(); return; }
      if (e.code === 'KeyH') { this.ui.el.help.classList.toggle('hidden'); return; }
      if (e.code === 'KeyP') { this.togglePause(); return; }
      if (this.state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) { this.startRun(); return; }
      if (e.code === 'Space') { if (this.state === 'playing') this.player.tryDodge(); e.preventDefault(); return; }
      if (anyModal || this.state !== 'playing') return; // ignore game keys while modal open / not playing
      const FI = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyB: 4, KeyF: 5 };
      const SI = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4 };
      if (e.code in FI) this.skills.castFruit(FI[e.code]);
      else if (e.code in SI) this.skills.castSword(SI[e.code]);
    });
    window.addEventListener('keyup', (e) => {
      if (keyMap[e.code]) inp[keyMap[e.code]] = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.sprint = false;
      if (e.code === 'KeyQ') this.qHeld = false;
      if (e.code === 'KeyE') this.eHeld = false;
      const FI = { KeyZ: 0, KeyX: 1, KeyC: 2, KeyV: 3, KeyB: 4, KeyF: 5 };
      if (e.code in FI) this.skills.releaseFruit(FI[e.code]);
    });
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', (e) => {
      this.mouseNDC.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
      this.hasMouse = true;
      if (this.rmb) this.camYaw -= e.movementX * 0.005;
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      if (e.button === 0) inp.firing = true;
      if (e.button === 2) this.rmb = true;
    });
    window.addEventListener('pointerup', (e) => {
      if (e.button === 0) inp.firing = false;
      if (e.button === 2) this.rmb = false;
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.camDist = clamp(this.camDist + Math.sign(e.deltaY) * 2.5, 14, 46);
    }, { passive: true });
    window.addEventListener('resize', () => this.applySize());
  }

  updateAim() {
    if (this.isTouch) {
      const e = this.enemies.nearest(this.player.pos, 48);
      if (e) this.aimPoint.copy(e.pos);
      else this.aimPoint.copy(this.player.pos).add(_aim.set(Math.sin(this.player.yaw) * 10, 0, Math.cos(this.player.yaw) * 10));
    } else if (this.hasMouse) {
      _ray.setFromCamera(this.mouseNDC, this.camera);
      const t = -_ray.ray.origin.y / _ray.ray.direction.y;
      if (t > 0 && t < 500) {
        this.aimPoint.copy(_ray.ray.origin).addScaledVector(_ray.ray.direction, t);
        this.world.clampToArena(this.aimPoint, -40);
      }
    }
    this.aimMarker.position.set(this.aimPoint.x, 0.12, this.aimPoint.z);
    const f = this.player.fruit();
    this.aimMarker.material.color.setHex(f ? f.color : 0x888899);
    const s = 1 + Math.sin(this.time * 6) * 0.08;
    this.aimMarker.scale.set(s, 1, s);
  }

  // ================= LOOP =================
  start() {
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  frame() {
    const rawDt = Math.min(this.clock.getDelta(), 0.05);
    // fps
    if (rawDt > 0) this.fpsEMA = lerp(this.fpsEMA, 1 / rawDt, 0.05);
    if (this.settings.get('fpsCounter')) this.ui.el.fps.textContent = Math.round(this.fpsEMA) + ' FPS';
    // hitstop (real-time countdown, world frozen)
    if (this.hitstopT > 0) {
      this.hitstopT -= rawDt;
      const k = 1 - this.hitstopT / this.hitstopDur;
      this.ui.setRedshift(k < 0.7 ? k : 1 - (k - 0.7) / 0.3 * 0.3);
      if (this.hitstopT <= 0) { this.timeScale = 1; this.ui.setRedshift(0); }
    }
    const playing = this.state === 'playing';
    const dt = playing ? rawDt * this.timeScale : 0;
    if (playing) this.time += dt;
    else this.menuT += rawDt;

    // waves (30s cadence)
    if (playing && !this.player.dead) {
      this.waveT += dt;
      if (this.waveT >= 30) {
        this.waveT = 0; this.wave++;
        this.recordBest();
        this.ui.announce('⚔️ WAVE ' + this.wave, '#ffd94d');
        this.audio.roar(); this.audio.horn();
      }
    }
    // camera rotate keys
    if (this.qHeld) this.camYaw += rawDt * 1.8;
    if (this.eHeld) this.camYaw -= rawDt * 1.8;

    // combo decay
    if (playing && this.combo.n > 0) {
      this.combo.t -= dt;
      if (this.combo.t <= 0) { if (this.combo.n >= 5) this.recordBest(); this.combo.n = 0; }
    }

    // firing (hold)
    if (playing && this.input.firing) this.player.tryM1();

    // simulate (frozen when paused / in menu)
    if (playing) {
      this.scheduler.update(dt);
      this.player.update(dt, this.input);
      this.enemies.update(dt);
      this.skills.update(dt);
      this.effects.update(dt);
    }
    this.world.update(playing ? dt : rawDt, playing ? this.time : this.menuT);
    this.updateAim();
    this.updateShake(playing ? dt : rawDt);

    if (this.state === 'menu') {
      // slow cinematic orbit behind the main menu
      this.camYaw += rawDt * 0.12;
      _bp.set(Math.sin(this.camYaw) * 43, 25, Math.cos(this.camYaw) * 43);
      this.camera.position.lerp(_bp, 1 - Math.pow(0.01, rawDt));
      this.camera.lookAt(0, 2, 0);
      if (Math.abs(this.camera.fov - this.baseFov) > 0.05) { this.camera.fov = this.baseFov; this.camera.updateProjectionMatrix(); }
      this.camera.updateMatrixWorld();
    } else {
      // --- third-person follow camera (rotation NEVER shaken; shake is positional only) ---
      const P = this.player.pos;
      // smoothed player velocity for look-ahead
      _vel.set(P.x - this._lastP.x, 0, P.z - this._lastP.z).multiplyScalar(1 / Math.max(1e-4, rawDt));
      if (_vel.lengthSq() > 900) _vel.setLength(30);
      this._lastP.copy(P);
      this.followVel.lerp(_vel, 1 - Math.pow(0.001, rawDt));
      // dynamic distance: breathes with shake trauma
      const dEff = this.camDist * (1 + this.trauma * 0.1);
      const back = Math.cos(this.camPitch) * dEff, h = Math.sin(this.camPitch) * dEff;
      const sy = Math.sin(this.camYaw), cy = Math.cos(this.camYaw);
      // shoulder offset (screen-right), applied to both eye and target
      const shX = cy * 1.3, shZ = -sy * 1.3;
      _bp.set(P.x + sy * back + shX, h, P.z + cy * back + shZ);
      _lt.set(
        lerp(P.x, this.aimPoint.x, 0.16) + this.followVel.x * 0.22 + shX,
        1.6,
        lerp(P.z, this.aimPoint.z, 0.16) + this.followVel.z * 0.22 + shZ
      );
      this.smoothLook.lerp(_lt, 1 - Math.pow(1e-6, rawDt));
      this.camera.position.lerp(_bp, 1 - Math.pow(0.0001, rawDt));
      this.camera.lookAt(this.smoothLook);        // rotation set from UNSHAKEN position
      this.camera.position.add(this.shakeOffset); // positional displacement only
      const wantFov = this.baseFov + this.fovKick;
      if (Math.abs(this.camera.fov - wantFov) > 0.05) { this.camera.fov = wantFov; this.camera.updateProjectionMatrix(); }
      this.camera.updateMatrixWorld();
    }

    // ui
    if (this.state !== 'menu') {
      this.ui.updateSkillRows();
      this.ui.updateHUD();
      this.ui.updateDmg(rawDt);
      this.ui.pulseLowHp(this.player.dead ? 0 : this.player.hp / this.player.maxHp);
      if (playing) { this.updateBoss(); this.autoResTick(rawDt); this.ui.updateCombo(this.combo.n, this.combo.t / 3.5); }
    }

    if (this.composer && this.settings.get('bloom')) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
}
const _ray = new THREE.Raycaster();
const _bp = new THREE.Vector3(), _lt = new THREE.Vector3(), _aim = new THREE.Vector3(), _vel = new THREE.Vector3();
