// ---------- UI: HUD, skill bar, inventory, settings, touch ----------
import * as THREE from 'three';
import { clamp, fmt, fmtTime } from './utils.js';
import { FRUITS, SWORDS, FRUIT_ORDER, SWORD_ORDER, FRUIT_KEYS, SWORD_KEYS } from './config.js';
import { PRESETS } from './graphics.js';

const $ = id => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.dmgPool = [];
    this.dmgIdx = 0;
    this.announceT = null;
  }

  init() {
    this.cache();
    this.buildSkillRows();
    this.buildDmgPool();
    this.buildSettings();
    this.buildHelp();
    this.wire();
    this.refreshSlots();
    this.refreshM1();
  }

  cache() {
    this.el = {
      hpFill: $('hp-fill'), hpText: $('hp-text'), buffRow: $('buff-row'),
      bladeWrap: $('blade-charge-wrap'), bladeFill: $('blade-charge-fill'),
      wave: $('wave-banner'), kills: $('stat-kills'), enemies: $('stat-enemies'), time: $('stat-time'),
      fps: $('fps-counter'), announce: $('announce'),
      chargeHud: $('charge-hud'), chargeFill: $('charge-fill'), chargeLabel: $('charge-label'),
      channelHud: $('channel-hud'), channelFill: $('channel-fill'), channelLabel: $('channel-label'),
      panel: $('skill-panel'), fruitSkills: $('fruit-skills'), swordSkills: $('sword-skills'),
      fruitName: $('fruit-name-mini'), swordName: $('sword-name-mini'),
      fab: $('skills-fab'), m1Name: $('m1-name'), m1Hint: $('m1-hint'),
      slotFruit: $('slot-fruit'), slotSword: $('slot-sword'),
      slotFruitIcon: $('slot-fruit-icon'), slotSwordIcon: $('slot-sword-icon'),
      slotFruitName: $('slot-fruit-name'), slotSwordName: $('slot-sword-name'),
      picker: $('picker-modal'), pickerTitle: $('picker-title'), pickerList: $('picker-list'),
      settings: $('settings-modal'), settingsBody: $('settings-body'),
      help: $('help-modal'),
      death: $('death-screen'), deathStats: $('death-stats'),
      flash: $('flash'), redshift: $('redshift'), lowhp: $('lowhp'),
      joy: $('joystick'), knob: $('joy-knob'), fire: $('btn-fire'),
      mute: $('btn-mute'),
    };
  }

  // ================= SKILL PANEL =================
  buildSkillRows() {
    this.fruitRows = [];
    this.swordRows = [];
    for (let i = 0; i < 6; i++) this.fruitRows.push(this.makeRow(this.el.fruitSkills, 'fruit', i, FRUIT_KEYS[i]));
    for (let i = 0; i < 5; i++) this.swordRows.push(this.makeRow(this.el.swordSkills, 'sword', i, SWORD_KEYS[i]));
    this.refreshSkillRows();
  }
  makeRow(parent, type, i, key) {
    const row = document.createElement('div');
    row.className = 'skill-row empty';
    row.innerHTML = `<div class="cd-sweep"></div>
      <div class="key-badge">${key}</div>
      <button class="use-btn">USE</button>
      <div class="skill-ico">·</div>
      <div class="skill-meta"><div class="skill-name">—</div><div class="skill-sub">empty slot</div></div>
      <div class="cd-text"></div><div class="pips"></div>`;
    parent.appendChild(row);
    const R = { row, sweep: row.querySelector('.cd-sweep'), cdText: row.querySelector('.cd-text'), type, i };
    row.querySelector('.use-btn').addEventListener('pointerdown', (e) => { e.stopPropagation(); this.pressSkill(type, i); });
    row.addEventListener('pointerdown', (e) => {
      if (e.target.classList.contains('use-btn')) return;
      if (!this.game.isTouch) this.pressSkill(type, i);
    });
    return R;
  }
  pressSkill(type, i) {
    this.game.audio.unlock(); this.game.audio.ui();
    if (type === 'fruit') {
      // hold-skill toggle for touch / mouse
      if (this.game.player.fruitId === 'lightning' && i === 3) {
        if (this.game.skills.thunder.active) this.game.skills.releaseFruit(i);
        else this.game.skills.castFruit(i);
        return;
      }
      this.game.skills.castFruit(i);
    } else this.game.skills.castSword(i);
  }
  refreshSkillRows() {
    const f = this.game.player.fruit(), s = this.game.player.sword();
    this.el.fruitName.textContent = f ? f.name : 'unequipped';
    this.el.swordName.textContent = s ? s.name : 'unequipped';
    this.fruitRows.forEach((R, i) => this.fillRow(R, f && f.skills[i], f && f.color));
    this.swordRows.forEach((R, i) => this.fillRow(R, s && s.skills[i], s && s.color));
  }
  fillRow(R, skill, color) {
    const row = R.row;
    if (!skill) {
      row.classList.add('empty');
      row.querySelector('.skill-ico').textContent = '·';
      row.querySelector('.skill-name').textContent = '—';
      row.querySelector('.skill-sub').textContent = 'empty slot';
      row.querySelector('.pips').innerHTML = '';
      row.title = '';
      R.skill = null;
      return;
    }
    row.classList.remove('empty');
    row.querySelector('.skill-ico').textContent = skill.ico;
    row.querySelector('.skill-ico').style.borderColor = '#' + color.toString(16).padStart(6, '0');
    row.querySelector('.skill-name').textContent = skill.name;
    row.querySelector('.skill-sub').textContent = `${skill.sub} • ${skill.cd}s`;
    row.title = skill.desc;
    R.skill = skill;
    // destello pips
    const pips = row.querySelector('.pips');
    if (R.type === 'fruit' && this.game.player.fruitId === 'lightning' && R.i === 4) {
      pips.innerHTML = '<div class="pip"></div><div class="pip"></div><div class="pip"></div>';
    } else pips.innerHTML = '';
  }
  updateSkillRows() {
    const S = this.game.skills;
    this.fruitRows.forEach((R, i) => this.updateRow(R, S.fruitCds[i], S.fruitCdTotal[i]));
    this.swordRows.forEach((R, i) => this.updateRow(R, S.swordCds[i], S.swordCdTotal[i]));
    // destello pips
    const d = this.fruitRows[4];
    if (d && d.row.querySelectorAll('.pip').length) {
      const pips = d.row.querySelectorAll('.pip');
      pips.forEach((p, k) => p.classList.toggle('on', k < S.destello.n));
    }
    // blade charge bar
    const showBlade = this.game.player.swordId === 'gravityBlade';
    this.el.bladeWrap.classList.toggle('hidden', !showBlade);
    if (showBlade) this.el.bladeFill.style.width = S.bladeCharge.toFixed(0) + '%';
  }
  updateRow(R, remain, total) {
    if (!R.skill) { R.sweep.style.width = '0%'; R.row.classList.remove('on-cd'); return; }
    if (remain > 0) {
      R.row.classList.add('on-cd');
      R.sweep.style.width = clamp(remain / total * 100, 0, 100).toFixed(1) + '%';
      R.cdText.textContent = remain > 0.95 ? Math.ceil(remain) : remain.toFixed(1);
    } else {
      R.row.classList.remove('on-cd');
      R.sweep.style.width = '0%';
    }
  }
  refreshM1() {
    const k = this.game.player.m1Kind();
    if (k === 'sword') {
      const s = this.game.player.sword();
      this.el.m1Name.textContent = s.m1.name;
      this.el.m1Hint.textContent = `${s.m1.cd}s • ${s.m1.endlag}s lag`;
      this.el.m1Name.title = s.m1.desc;
    } else if (k === 'gun') {
      const g = this.game.player.gun();
      this.el.m1Name.textContent = g.name + ' (manual)';
      this.el.m1Hint.textContent = `${Math.round(g.proc * 100)}% proc • auto-aim`;
      this.el.m1Name.title = 'Manual precise rifle (LMB / FIRE).';
    } else {
      this.el.m1Name.textContent = 'Punch';
      this.el.m1Hint.textContent = 'equip a sword!';
      this.el.m1Name.title = 'Bare fists. Equip a sword or gun fruit.';
    }
    this.refreshSkillRows();
  }

  // ================= INVENTORY =================
  refreshSlots() {
    const P = this.game.player, f = P.fruit(), s = P.sword();
    this.el.slotFruitIcon.textContent = f ? f.icon : '▫️';
    this.el.slotFruitName.textContent = f ? f.name : '— empty —';
    this.el.slotFruit.style.setProperty('--slotc', f ? f.css : 'rgba(180,92,255,.5)');
    this.el.slotFruit.classList.toggle('fruit-glow', !!f);
    this.el.slotSwordIcon.textContent = s ? s.icon : '▫️';
    this.el.slotSwordName.textContent = s ? s.name : '— empty —';
    this.el.slotSword.style.setProperty('--slotc', s ? s.css : 'rgba(180,92,255,.5)');
    this.el.slotSword.classList.toggle('fruit-glow', !!s);
  }
  openPicker(type) {
    this.pickerType = type;
    this.el.pickerTitle.textContent = type === 'fruit' ? '🍇 EQUIP FRUIT' : '🗡️ EQUIP SWORD';
    const list = this.el.pickerList;
    list.innerHTML = '';
    const order = type === 'fruit' ? FRUIT_ORDER : SWORD_ORDER;
    const db = type === 'fruit' ? FRUITS : SWORDS;
    const equipped = type === 'fruit' ? this.game.player.fruitId : this.game.player.swordId;
    for (const id of order) {
      const d = db[id];
      const card = document.createElement('div');
      card.className = 'picker-card' + (equipped === id ? ' equipped' : '');
      const skills = (d.skills || []).filter(Boolean).map(s => s.ico + ' ' + s.name).join(' • ');
      card.innerHTML = `<div class="pic">${d.icon}</div>
        <div class="pmeta"><div class="pname" style="color:${d.css}">${d.name}</div>
        <div class="pdesc">${d.desc}${d.m1 ? `<br>👊 M1: ${d.m1.name} (${d.m1.cd}s)` : ''}${d.gun ? `<br>🔫 Passive: ${d.gun.name}` : ''}<br><span style="color:#cfc6ff">${skills}</span></div></div>
        <button class="pequip">${equipped === id ? 'ON ✓' : 'EQUIP'}</button>`;
      card.querySelector('.pequip').addEventListener('click', (e) => {
        e.stopPropagation();
        this.game.audio.unlock(); this.game.audio.ui();
        if (type === 'fruit') this.game.player.equipFruit(id);
        else this.game.player.equipSword(id);
        this.openPicker(type);
      });
      list.appendChild(card);
    }
    this.el.picker.classList.remove('hidden');
  }

  // ================= SETTINGS =================
  buildSettings() {
    const S = this.game.settings;
    const b = this.el.settingsBody;
    b.innerHTML = '';
    const sec = (t) => { const d = document.createElement('div'); d.className = 'set-section'; d.textContent = t; b.appendChild(d); };
    const mkRow = (name, desc) => {
      const r = document.createElement('div'); r.className = 'set-row';
      r.innerHTML = `<div class="set-name">${name}<div class="set-desc">${desc}</div></div>`;
      b.appendChild(r); return r;
    };
    const slider = (name, desc, key, min, max, step, fmtF) => {
      const r = mkRow(name, desc);
      const inp = document.createElement('input');
      inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = S.get(key);
      const val = document.createElement('span'); val.className = 'set-val';
      val.textContent = fmtF ? fmtF(S.get(key)) : S.get(key);
      inp.addEventListener('input', () => { S.set(key, parseFloat(inp.value)); val.textContent = fmtF ? fmtF(parseFloat(inp.value)) : inp.value; });
      r.appendChild(inp); r.appendChild(val);
      this._setCtl = this._setCtl || []; this._setCtl.push({ key, update: () => { inp.value = S.get(key); val.textContent = fmtF ? fmtF(S.get(key)) : S.get(key); } });
    };
    const toggle = (name, desc, key, onFlip) => {
      const r = mkRow(name, desc);
      const t = document.createElement('div'); t.className = 'toggle' + (S.get(key) ? ' on' : '');
      t.addEventListener('click', () => { S.set(key, !S.get(key)); t.classList.toggle('on', S.get(key)); if (onFlip) onFlip(S.get(key)); });
      r.appendChild(t);
      this._setCtl = this._setCtl || []; this._setCtl.push({ key, update: () => t.classList.toggle('on', S.get(key)) });
    };
    const select = (name, desc, key, opts) => {
      const r = mkRow(name, desc);
      const el = document.createElement('select');
      for (const [v, label] of opts) { const o = document.createElement('option'); o.value = v; o.textContent = label; el.appendChild(o); }
      el.value = S.get(key);
      el.addEventListener('change', () => S.set(key, isNaN(+el.value) ? el.value : +el.value));
      r.appendChild(el);
      this._setCtl = this._setCtl || []; this._setCtl.push({ key, update: () => { el.value = S.get(key); } });
    };
    // preset
    sec('QUALITY PRESET');
    const pr = document.createElement('div'); pr.className = 'preset-row';
    for (const name of Object.keys(PRESETS)) {
      const btn = document.createElement('button');
      btn.className = 'preset-btn' + (S.get('preset') === name ? ' active' : '');
      btn.textContent = name.toUpperCase();
      btn.addEventListener('click', () => {
        S.applyPreset(name);
        pr.querySelectorAll('.preset-btn').forEach(x => x.classList.remove('active'));
        btn.classList.add('active');
        this.refreshSettingsCtl();
      });
      pr.appendChild(btn);
    }
    b.appendChild(pr);
    sec('RENDERING');
    slider('Resolution scale', 'Render resolution multiplier.', 'resolutionScale', 0.5, 1.5, 0.05, v => v.toFixed(2) + '×');
    toggle('Antialiasing (MSAA)', 'Needs reload — toggles now.', 'antialias', () => setTimeout(() => location.reload(), 350));
    select('Pixel ratio cap', 'Max device pixel ratio.', 'maxPixelRatio', [[1, '1×'], [1.5, '1.5×'], [2, '2×']]);
    toggle('Shadows', 'Dynamic sun shadows.', 'shadows');
    select('Shadow map size', 'Higher = crisper shadows.', 'shadowSize', [[1024, '1024'], [2048, '2048'], [4096, '4096']]);
    slider('Fog density', 'Atmosphere thickness.', 'fogDensity', 0, 0.01, 0.0002, v => v.toFixed(4));
    sec('EFFECTS (EXPLOSIONS • DEBRIS • LIGHTNING)');
    slider('Particle density', 'Scales all particle counts.', 'particleDensity', 0.25, 2, 0.05, v => v.toFixed(2) + '×');
    slider('Debris limit', 'Max flying debris chunks.', 'debrisLimit', 0, 520, 10, v => v.toFixed(0));
    select('Lightning detail', 'Bolt segment density.', 'boltDetail', [[0, 'Low (12 seg)'], [1, 'High (26 seg)']]);
    toggle('Glow sprites', 'Additive impact halos.', 'glowSprites');
    slider('Enemy cap', 'Max simultaneous enemies.', 'enemyCap', 20, 100, 5, v => v.toFixed(0));
    sec('CAMERA SHAKE (POSITION ONLY — NO ROTATION)');
    toggle('Camera shake', 'Master switch for all shake.', 'shakeEnabled');
    slider('Shake intensity', 'Multiplier on displacement.', 'shakeIntensity', 0, 2, 0.05, v => v.toFixed(2) + '×');
    sec('DISPLAY & AUDIO');
    toggle('Damage numbers', 'Floating combat text.', 'damageNumbers');
    toggle('Screen flash', 'Bright flashes on big skills.', 'screenFlash');
    toggle('FPS counter', 'Show framerate.', 'fpsCounter');
    toggle('Mute', 'Silence all SFX.', 'mute');
    slider('Volume', 'Master SFX volume.', 'volume', 0, 1, 0.05, v => Math.round(v * 100) + '%');
  }
  refreshSettingsCtl() { if (this._setCtl) for (const c of this._setCtl) c.update(); }

  // ================= HELP =================
  buildHelp() {
    $('help-body').innerHTML = `
    <h4>⌨️ PC CONTROLS</h4>
    <table>
    <tr><td><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> / arrows</td><td>Move (camera-relative)</td></tr>
    <tr><td><kbd>Shift</kbd></td><td>Sprint</td></tr>
    <tr><td>Mouse</td><td>Aim (ground target ring)</td></tr>
    <tr><td><kbd>LMB</kbd></td><td>M1 — sword slash / manual gun / punch</td></tr>
    <tr><td><kbd>Z</kbd><kbd>X</kbd><kbd>C</kbd><kbd>V</kbd><kbd>B</kbd><kbd>F</kbd></td><td>Fruit skills 1-6 (hold <kbd>V</kbd> on Lightning #4 to charge, release to fire)</td></tr>
    <tr><td><kbd>1</kbd>–<kbd>5</kbd></td><td>Sword skills (press Pole #2 again to stop channeling)</td></tr>
    <tr><td><kbd>M</kbd> <kbd>H</kbd> <kbd>Esc</kbd></td><td>Mute • Help • Close panels</td></tr>
    </table>
    <h4>📱 MOBILE / TABLET</h4>
    <table><tr><td>Left stick</td><td>Move (auto-aims nearest enemy)</td></tr>
    <tr><td>⚔️ button</td><td>M1 basic attack (hold to repeat)</td></tr>
    <tr><td>USE buttons</td><td>Cast skills (tap again to release holds/toggles)</td></tr></table>
    <h4>🎒 LOADOUT — FRUIT & SWORD ARE SEPARATE</h4>
    <p>Tap the two square slots at the bottom to equip / unequip your <b style="color:#a64dff">FRUIT</b> and <b style="color:#37e6ff">SWORD</b> independently. Unequipped = no skills from that slot. The compact skill bar (middle-right) can be closed and re-opened with the 🎯 tab.</p>
    <h4>🍇 FRUITS</h4>
    <table>${FRUIT_ORDER.map(id => { const f = FRUITS[id]; return `<tr><td>${f.icon} <b style="color:${f.css}">${f.name}</b></td><td>${f.desc}</td></tr>`; }).join('')}</table>
    <h4>🗡️ SWORDS</h4>
    <table>${SWORD_ORDER.map(id => { const s = SWORDS[id]; return `<tr><td>${s.icon} <b style="color:${s.css}">${s.name}</b></td><td>${s.desc}</td></tr>`; }).join('')}</table>
    <h4>💡 TIPS</h4>
    <p>• Purple Gravity fruit: Asteroid leaves 10s firepits — herd enemies through them.<br>• Gravity Blade charge grows as you fight — a full bar can erase whole packs.<br>• Pole's Juicio Continuo drains HP — it auto-stops below 50%.<br>• Quake Fatal Destruction needs a victim in front of you or nothing happens.<br>• Gun fruits (🧊🔥) fire with <kbd>LMB</kbd> — manual, ultra-precise, watch for procs.<br>• Camera shake is <b>position-only</b> — your aim never rotates. Tune it in ⚙️.</p>`;
  }

  // ================= WIRING =================
  wire() {
    $('btn-settings').addEventListener('click', () => { this.game.audio.unlock(); this.refreshSettingsCtl(); this.el.settings.classList.remove('hidden'); });
    $('settings-x').addEventListener('click', () => this.el.settings.classList.add('hidden'));
    $('settings-close').addEventListener('click', () => this.el.settings.classList.add('hidden'));
    $('settings-reset').addEventListener('click', () => { this.game.settings.reset(); this.refreshSettingsCtl(); });
    $('btn-help').addEventListener('click', () => this.el.help.classList.remove('hidden'));
    $('help-x').addEventListener('click', () => this.el.help.classList.add('hidden'));
    $('help-close').addEventListener('click', () => this.el.help.classList.add('hidden'));
    this.el.mute.addEventListener('click', () => {
      this.game.audio.unlock();
      const m = this.game.audio.toggleMute();
      this.el.mute.textContent = m ? '🔇' : '🔊';
      this.refreshSettingsCtl();
    });
    $('btn-skills-toggle').addEventListener('click', () => this.togglePanel());
    $('btn-close-skills').addEventListener('click', () => this.togglePanel(false));
    this.el.fab.addEventListener('click', () => this.togglePanel(true));
    this.el.slotFruit.addEventListener('click', () => { this.game.audio.unlock(); this.openPicker('fruit'); });
    this.el.slotSword.addEventListener('click', () => { this.game.audio.unlock(); this.openPicker('sword'); });
    $('picker-x').addEventListener('click', () => this.el.picker.classList.add('hidden'));
    $('picker-unequip').addEventListener('click', () => {
      if (this.pickerType === 'fruit') this.game.player.equipFruit(null);
      else this.game.player.equipSword(null);
      this.openPicker(this.pickerType);
    });
    $('btn-respawn').addEventListener('click', () => this.game.player.respawn());
    // touch joystick
    const joy = this.el.joy, knob = this.el.knob;
    let joyId = null;
    const setKnob = (dx, dy) => { knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; };
    joy.addEventListener('pointerdown', (e) => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); });
    joy.addEventListener('pointermove', (e) => {
      if (e.pointerId !== joyId) return;
      const r = joy.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const m = Math.hypot(dx, dy), max = r.width / 2 - 10;
      if (m > max) { dx *= max / m; dy *= max / m; }
      setKnob(dx, dy);
      this.game.input.joyX = dx / max; this.game.input.joyZ = dy / max;
    });
    const joyEnd = (e) => {
      if (e.pointerId !== joyId) return;
      joyId = null; setKnob(0, 0);
      this.game.input.joyX = 0; this.game.input.joyZ = 0;
    };
    joy.addEventListener('pointerup', joyEnd); joy.addEventListener('pointercancel', joyEnd);
    this.el.fire.addEventListener('pointerdown', (e) => { e.preventDefault(); this.game.audio.unlock(); this.game.input.firing = true; });
    window.addEventListener('pointerup', () => { this.game.input.firing = false; });
  }
  togglePanel(show) {
    const p = this.el.panel;
    const willShow = show !== undefined ? show : p.classList.contains('hidden');
    p.classList.toggle('hidden', !willShow);
    this.el.fab.classList.toggle('hidden', willShow);
  }

  // ================= DAMAGE NUMBERS =================
  buildDmgPool() {
    const layer = $('dmg-layer');
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div');
      el.className = 'dmg-num'; el.style.display = 'none';
      layer.appendChild(el);
      this.dmgPool.push({ el, life: 0, x: 0, y: 0, z: 0, vy: 0 });
    }
  }
  damageNum(worldPos, amount, cls = '', color = null) {
    if (!this.game.settings.get('damageNumbers')) return;
    if (amount < 1 && cls !== 'hurt') return;
    const d = this.dmgPool[this.dmgIdx++ % this.dmgPool.length];
    d.life = cls === 'crit' ? 1.1 : 0.8;
    d.max = d.life;
    d.x = worldPos.x + (Math.random() - 0.5) * 1.5;
    d.y = (worldPos.y || 0) + 2.2 + Math.random();
    d.z = worldPos.z + (Math.random() - 0.5) * 1.5;
    d.el.className = 'dmg-num' + (cls ? ' ' + cls : '');
    d.el.textContent = cls === 'hurt' ? '-' + fmt(amount) : fmt(amount);
    if (color !== null && color !== undefined) d.el.style.color = '#' + new THREE.Color(color).getHexString();
    else d.el.style.color = '';
    d.el.style.display = 'block';
  }
  updateDmg(dt) {
    const cam = this.game.camera;
    const w = window.innerWidth, h = window.innerHeight;
    for (const d of this.dmgPool) {
      if (d.life <= 0) continue;
      d.life -= dt;
      if (d.life <= 0) { d.el.style.display = 'none'; continue; }
      d.y += dt * 2.2;
      _pv.set(d.x, d.y, d.z).project(cam);
      if (_pv.z > 1) { d.el.style.display = 'none'; d.life = 0; continue; }
      d.el.style.display = 'block';
      d.el.style.left = ((_pv.x * 0.5 + 0.5) * w) + 'px';
      d.el.style.top = ((-_pv.y * 0.5 + 0.5) * h) + 'px';
      d.el.style.opacity = clamp(d.life / (d.max * 0.4), 0, 1);
    }
  }

  // ================= MISC =================
  announce(text, color = '#fff') {
    this.el.announce.textContent = text;
    this.el.announce.style.color = color;
    this.el.announce.style.opacity = 1;
    clearTimeout(this.announceT);
    this.announceT = setTimeout(() => { this.el.announce.style.opacity = 0; }, 2200);
  }
  flash(color, alpha, ms) {
    if (!this.game.settings.get('screenFlash')) return;
    const f = this.el.flash;
    f.style.background = color; f.style.opacity = alpha;
    f.style.transition = 'none';
    requestAnimationFrame(() => { f.style.transition = `opacity ${ms}ms`; f.style.opacity = 0; });
  }
  setRedshift(v) { this.el.redshift.style.opacity = clamp(v, 0, 1); }
  pulseLowHp(frac) {
    this.el.lowhp.style.opacity = frac < 0.35 ? (0.35 - frac) * 2.4 : 0;
  }
  showCharge(label) { this.el.chargeHud.classList.remove('hidden'); this.el.chargeLabel.textContent = label; this.updateCharge(0); }
  updateCharge(pct) { this.el.chargeFill.style.width = pct.toFixed(0) + '%'; }
  hideCharge() { this.el.chargeHud.classList.add('hidden'); }
  showChannel(label) { this.el.channelHud.classList.remove('hidden'); this.el.channelLabel.textContent = label; }
  updateChannel(frac) { this.el.channelFill.style.width = (frac * 100).toFixed(0) + '%'; }
  hideChannel() { this.el.channelHud.classList.add('hidden'); }
  showDeath() {
    this.el.deathStats.textContent = `Wave ${this.game.wave} • ${this.game.enemies.kills} kills • survived ${fmtTime(this.game.time)}`;
    this.el.death.classList.remove('hidden');
  }
  hideDeath() { this.el.death.classList.add('hidden'); }
  refreshBuffs() {
    const P = this.game.player;
    this.el.buffRow.innerHTML = '';
    for (const b of P.buffs) {
      const c = document.createElement('span');
      c.className = 'buff-chip';
      c.style.borderColor = b.css; c.style.color = b.css;
      c.textContent = `${b.label} ${(b.dur - b.t).toFixed(0)}s`;
      this.el.buffRow.appendChild(c);
    }
  }

  updateHUD() {
    const P = this.game.player;
    this.el.hpFill.style.width = (P.hp / P.maxHp * 100).toFixed(1) + '%';
    this.el.hpText.textContent = `${fmt(P.hp)} / ${fmt(P.maxHp)}`;
    this.el.wave.textContent = 'WAVE ' + this.game.wave;
    this.el.kills.textContent = '⚔ ' + this.game.enemies.kills;
    this.el.enemies.textContent = '👾 ' + this.game.enemies.aliveCount;
    this.el.time.textContent = '⏱ ' + fmtTime(this.game.time);
    // buff timers tick display (cheap: every frame text update)
    const chips = this.el.buffRow.children;
    for (let i = 0; i < chips.length && i < P.buffs.length; i++) {
      const b = P.buffs[i];
      chips[i].textContent = `${b.label} ${(b.dur - b.t).toFixed(0)}s`;
    }
  }
}
const _pv = new THREE.Vector3();
