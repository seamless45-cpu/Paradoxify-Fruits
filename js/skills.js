// ---------- Skill system: all fruits & swords ----------
import * as THREE from 'three';
import { clamp, rand, randInt, TAU } from './utils.js';
import { FRUITS, SWORDS } from './config.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

export class SkillSystem {
  constructor(game) {
    this.game = game;
    this.fruitCds = [0, 0, 0, 0, 0, 0];
    this.fruitCdTotal = [1, 1, 1, 1, 1, 1];
    this.swordCds = [0, 0, 0, 0, 0];
    this.swordCdTotal = [1, 1, 1, 1, 1, 1];
    this.destello = { n: 3, t: 0 };
    this.bladeCharge = 0;
    this.bladeGlow = 0;
    this.aimLock = 0;
    this.thunder = { active: false, pct: 0 };
    this.juicio = { active: false, age: 0, tick: 0 };
  }

  build() {
    // thunder ball prop (lightning skill 4)
    const g = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(1.6, 18, 14), new THREE.MeshBasicMaterial({ color: 0x05050c }));
    const halo = new THREE.Sprite(this.game.effects.spriteMat(0x33ccff));
    halo.scale.set(10, 10, 1);
    g.add(ball, halo);
    g.visible = false;
    this.game.scene.add(g);
    this.thunderMesh = g;
  }

  aim() { return this.game.aimPoint; }
  P() { return this.game.player; }
  FX() { return this.game.effects; }
  EM() { return this.game.enemies; }

  onEquipChanged() { this.cancelChannels(); }
  cancelChannels() {
    if (this.thunder.active) { this.thunder.active = false; this.thunderMesh.visible = false; this.game.ui.hideCharge(); }
    if (this.juicio.active) { this.juicio.active = false; this.game.ui.hideChannel(); }
  }

  onKill(e) {
    if (this.P().swordId === 'gravityBlade') this.bladeCharge = clamp(this.bladeCharge + 10, 0, 100);
  }
  onDamageDealt(e, amount) {
    if (this.P().swordId === 'gravityBlade' && !e.dead && amount > 0)
      this.bladeCharge = clamp(this.bladeCharge + 0.6, 0, 100);
  }

  setCd(arr, tot, i, base) {
    const t = base * this.P().cdMul();
    tot[i] = t; arr[i] = t;
  }

  // ================= CAST ROUTERS =================
  castFruit(i) {
    const P = this.P(), f = P.fruit();
    if (!f || P.dead || !f.skills[i]) return;
    if (this.fruitCds[i] > 0) return;
    P.faceAim(); this.aimLock = 0.6;
    const id = f.id, FX = this.FX();
    const S = this;
    const done = () => S.setCd(S.fruitCds, S.fruitCdTotal, i, f.skills[i].cd);
    switch (id) {
      case 'gravity':
        if (i === 0) { this.gAsteroid(this.aim(), 25, 0.03, 10); done(); }
        else if (i === 1) { this.gPressure(); done(); }
        else if (i === 2) { this.gLightning(); done(); }
        else if (i === 3) { this.gDereliction(); done(); }
        else if (i === 4) { this.gAsteroidRain(); done(); }
        else if (i === 5) { this.gPunch(); done(); }
        break;
      case 'lightning':
        if (i === 0) { this.lBestia(); done(); }
        else if (i === 1) { this.lTormenta(); done(); }
        else if (i === 2) { this.lJuicio(); done(); }
        else if (i === 3) { this.lThunderStart(i); /* cd set on release */ }
        else if (i === 4) { if (this.lDestello()) done(); }
        else if (i === 5) { this.lMasAlla(); done(); }
        break;
      case 'quake':
        if (i === 0) { if (this.qFatal()) done(); }
        else if (i === 1) { this.qAir(); done(); }
        else if (i === 2) { this.qSpatial(); done(); }
        else if (i === 3) { this.qSeaquake(); done(); }
        break;
      case 'alarm':
        if (i === 0) { this.aManual(); done(); }
        else if (i === 1) { this.aAuto(); done(); }
        else if (i === 2) { this.aSiren(); done(); }
        else if (i === 3) { this.aBuffer(); done(); }
        else if (i === 4) { this.aAmber(); done(); }
        break;
      case 'rimefracture':
        if (i === 0) { this.rIcy(); done(); }
        else if (i === 1) { this.rBombard(); done(); }
        else if (i === 2) { this.rSnowy(); done(); }
        break;
      case 'wildfire':
        if (i === 0) { this.wFirestorm(); done(); }
        else if (i === 1) { this.wHell(); done(); }
        else if (i === 2) { this.wLava(); done(); }
        break;
    }
    this.game.ui.refreshBuffs();
  }

  releaseFruit(i) {
    // thunder ball release (hold skill)
    if (this.P().fruitId === 'lightning' && i === 3 && this.thunder.active) {
      this.lThunderRelease(i);
    }
  }

  castSword(i) {
    const P = this.P(), s = P.sword();
    if (!s || P.dead || !s.skills[i]) return;
    if (this.swordCds[i] > 0) return;
    // pole juicio toggle-off
    if (s.id === 'pole' && i === 1 && this.juicio.active) {
      this.juicio.active = false; this.game.ui.hideChannel();
      this.setCd(this.swordCds, this.swordCdTotal, i, s.skills[i].cd);
      return;
    }
    P.faceAim(); this.aimLock = 0.6;
    const S = this;
    const done = (mult = 1) => S.setCd(S.swordCds, S.swordCdTotal, i, s.skills[i].cd * mult);
    switch (s.id) {
      case 'gravityBlade':
        if (i === 0) this.bSuperforce(done);
        else if (i === 1) { this.bMeteors(); done(); }
        else if (i === 2) { this.bRocks(); done(); }
        else if (i === 3) { this.bDeath(); done(); }
        else if (i === 4) { this.bSuper(); done(); }
        break;
      case 'pole':
        if (i === 0) { this.pAsalto(); done(); }
        else if (i === 1) { this.pJuicio(); /* cd on end */ }
        break;
      case 'bisento':
        if (i === 0) { this.biSlam(); done(); }
        else if (i === 1) { this.biBalls(); done(); }
        else if (i === 2) { this.biMini(); done(); }
        break;
      case 'alarmSword':
        if (i === 0) { this.asStomp(); done(); }
        break;
    }
  }

  // ================= GRAVITY FRUIT =================
  gAsteroid(target, radius, pitPct, pitDur) {
    const FX = this.FX(), from = target.clone(); from.y = 65; from.x += rand(-6, 6); from.z += rand(-6, 6);
    const dir = target.clone().sub(from).normalize();
    FX.fire('asteroid', from, dir.multiplyScalar(70), {
      gravity: 120, life: 3, hitEnemy: false, scale: 1.6,
      trail: { color: 0xa64dff, count: 3 },
      onGround: (p) => {
        FX.explode(p.mesh.position, { radius, flat: 420 * this.P().dmgMul(), pct: 0.12, color: 0xa64dff, shake: 0.55, knock: 14 });
        FX.pit(p.mesh.position, { radius, dur: pitDur, tick: 0.5, pct: pitPct, color: 0x8a2be2 });
        FX.cracks(p.mesh.position, { color: 0xa64dff, count: 6, scale: 1.4, life: 1 });
      },
    });
    this.game.audio.roar();
  }
  gPressure() {
    const g = this.game, mid = new THREE.Vector3(0, 0, 0);
    const n = this.EM().aliveCount;
    const mult = 1 + Math.min(20, n * 0.02);
    this.EM().suckAll(mid, 1.2, 34);
    this.FX().ring(mid, { color: 0xa64dff, maxR: 30, dur: 1.1 });
    this.FX().pillar(mid, { color: 0xa64dff, dur: 1.6 });
    g.audio.charge(0.8);
    g.scheduler.after(1.2, () => {
      this.FX().explode(mid, { radius: 14 * mult, flat: 500 * mult * this.P().dmgMul(), pct: 0.1 * mult, color: 0xc07aff, shake: 0.8, knock: 22 });
      this.game.ui.flash('#a64dff', 0.35, 300);
    });
  }
  gLightning() {
    const g = this.game;
    this.FX().pillar(this.P().pos, { color: 0xa64dff, dur: 2.6 });
    g.audio.thunder();
    g.scheduler.every(0.25, 8, () => {
      const foes = this.EM().random(3, 17, this.P().pos);
      const spots = foes.length ? foes.map(e => e.pos) : [this.aim()];
      for (const s of spots) {
        this.FX().strike(s, { color: 0xa64dff, count: 3, radius: 4, flat: 130 * this.P().dmgMul(), pct: 0.02, thick: 1.1 });
      }
      if (Math.random() < 0.12) {
        const m = randInt(1, 5);
        for (let k = 0; k < m; k++) {
          const p = this.P().pos.clone(); p.x += rand(-17, 17); p.z += rand(-17, 17);
          const from = p.clone(); from.y = 55;
          this.FX().fire('meteor', from, new THREE.Vector3(0, -90, 0), {
            gravity: 60, life: 2, hitEnemy: false, trail: { color: 0xa64dff },
            onGround: (pr) => this.FX().explode(pr.mesh.position, { radius: 6, flat: 120 * this.P().dmgMul(), pct: 0.02, color: 0xa64dff, shake: 0.2 }),
          });
        }
      }
    }, true);
  }
  gDereliction() {
    const g = this.game;
    const targets = this.EM().random(6, 55);
    const spots = targets.length ? targets : null;
    if (!spots) {
      for (let k = 0; k < 3; k++) g.scheduler.after(k, () => this.FX().explode(this.aim(), { radius: 9, flat: 260, pct: 0.05, color: 0xa64dff, shake: 0.35 }));
      return;
    }
    for (let k = 0; k < 3; k++) {
      g.scheduler.after(k * 1.0, () => {
        for (const e of spots) {
          if (e.dead) continue;
          this.FX().ring(e.pos, { color: 0xa64dff, maxR: 9, dur: 0.4 });
          this.FX().explode(e.pos, { radius: 8, flat: 260 * this.P().dmgMul(), pct: 0.045, color: 0xa64dff, shake: 0.3, knock: 8 });
        }
        g.audio.explosion(1);
      });
    }
  }
  gAsteroidRain() {
    const g = this.game;
    g.scheduler.every(0.3, 8, () => {
      const p = this.aim().clone(); p.x += rand(-22, 22); p.z += rand(-22, 22);
      g.world.clampToArena(p);
      this.gAsteroid(p, 25, 0.05, 10);
    }, true);
  }
  gPunch() {
    const g = this.game, P = this.P();
    // pull
    for (const e of this.EM().list) {
      if (!e.dead && e.pos.distanceTo(P.pos) < 26) e.suck(P.pos, 0.55, 40);
    }
    this.FX().ring(P.pos, { color: 0xa64dff, maxR: 26, dur: 0.5 });
    g.audio.charge(1);
    g.scheduler.after(0.55, () => {
      // punch: knock all in 12m
      const hit = [];
      for (const e of this.EM().list) {
        if (e.dead || e.pos.distanceTo(P.pos) > 13) continue;
        _v.copy(e.pos).sub(P.pos).setY(0).normalize();
        e.knockback(P.pos, 30);
        hit.push(e);
      }
      const fwd = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
      this.FX().burst(P.pos.clone().addScaledVector(fwd, 3).setY(1.5), { count: 40, color: [0xa64dff, 0xffffff], speed: 20, life: 0.6, size: 2.6, dir: fwd, dirSpread: 0.6 });
      this.FX().shell(P.pos, { color: 0xa64dff, maxR: 14, dur: 0.4 });
      g.shakeFrom(P.pos, 0.7, 50);
      g.audio.explosion(1.6);
      // 4 rows of 4 overlapped bolts where they land
      hit.forEach((e) => {
        for (let row = 0; row < 4; row++) {
          g.scheduler.after(0.7 + row * 0.5, () => {
            if (e.dead) return;
            const base = e.pos.clone();
            const ang = rand(0, TAU);
            for (let k = 0; k < 4; k++) {
              _v2.set(base.x + Math.cos(ang) * (k - 1.5) * 3, 0, base.z + Math.sin(ang) * (k - 1.5) * 3);
              this.FX().bolt(_v2, { color: 0xc07aff, height: 60, thick: 1.3 });
            }
            this.EM().damageInRadius(base, 7, 200 * P.dmgMul(), 0.04, { color: 0xa64dff, source: 'skill', from: P.pos });
            this.FX().ring(base, { color: 0xa64dff, maxR: 9, dur: 0.4 });
            g.shakeFrom(base, 0.35, 45);
            g.audio.thunder();
          });
        }
      });
    });
  }

  // ================= GRAVITY BLADE =================
  bSuperforce(done) {
    const g = this.game, P = this.P();
    const charge = this.bladeCharge;
    this.bladeGlow = 1;
    P.endlag = Math.max(P.endlag, 1.0);
    g.audio.charge(1);
    this.FX().burst(P.pos.clone().setY(2), { count: 30, color: 0xc9a7ff, speed: 6, up: 10, life: 0.9, size: 2, gravity: -6 });
    g.scheduler.after(1.0, () => {
      this.bladeGlow = 0;
      const aim = this.aim().clone();
      const full = charge >= 99.5, empty = charge <= 0.5;
      const mega = full && Math.random() < 0.33; // 20x
      const dmgMul = mega ? 20 : empty ? 0.3 : 1;
      const killChance = empty ? 0.1 : 0.1 + charge * 0.009;
      const R = 13 * (mega ? 1.8 : 1);
      // the god-bolt
      for (let i = 0; i < 8; i++) {
        _v.set(aim.x + rand(-3, 3), 0, aim.z + rand(-3, 3));
        this.FX().bolt(_v, { color: 0xc9a7ff, height: mega ? 90 : 65, thick: mega ? 2.2 : 1.4 });
      }
      this.FX().ring(aim, { color: 0xc9a7ff, maxR: R * 1.5, dur: 0.6 });
      this.FX().glow(aim.clone().setY(3), 0xc9a7ff, 16, 0.4, 20);
      this.FX().cracks(aim, { color: 0xa64dff, count: 10, scale: 1.6, life: 1 });
      g.audio.thunder(); g.audio.explosion(1.4);
      g.shakeFrom(aim, mega ? 1 : 0.6, 60);
      g.ui.flash('#c9a7ff', mega ? 0.5 : 0.3, 350);
      // effects
      for (const e of [...this.EM().list]) {
        if (e.dead || e.pos.distanceTo(aim) > R) continue;
        e.blind(10); // blinded: wander, no attack
        if (e.tier === 'normal' && Math.random() < killChance) {
          this.EM().damage(e, 1e12, 0, { color: 0xc9a7ff, source: 'skill', crit: true });
          g.ui.damageNum(e.pos, 0, ''); // death burst covers it
        } else if (e.tier === 'normal') {
          this.EM().damage(e, 300 * dmgMul * P.dmgMul(), 0.12 * dmgMul, { color: 0xc9a7ff, source: 'skill', crit: mega, from: P.pos });
        } else {
          this.EM().damage(e, 0, 0.5 * (mega ? 1 : 1), { color: 0xc9a7ff, source: 'skill', crit: mega }); // 50% max HP
          if (mega) this.EM().damage(e, 2000 * P.dmgMul(), 0, { color: 0xc9a7ff, source: 'skill' });
        }
      }
      this.bladeCharge = clamp(this.bladeCharge - 10, 0, 100);
      done(empty ? 1 / 3 : 1); // empty: 3x faster cooldown
    });
  }
  bMeteors() {
    const g = this.game;
    g.scheduler.every(0.06, 80, () => {
      const p = this.aim().clone(); p.x += rand(-18, 18); p.z += rand(-18, 18);
      g.world.clampToArena(p);
      const from = p.clone(); from.y = 55;
      this.FX().fire('meteor', from, new THREE.Vector3(rand(-8, 8), -130, rand(-8, 8)), {
        life: 1.2, hitEnemy: false, trail: { color: 0xff8a2a },
        onGround: (pr) => this.FX().explode(pr.mesh.position, { radius: 6, flat: 70 * this.P().dmgMul(), pct: 0.008, color: 0xff8a2a, shake: 0.12, sound: false }),
      });
      if (Math.random() < 0.15) g.audio.explosion(0.5);
    }, true);
  }
  bRocks() {
    const g = this.game, P = this.P();
    const cx = P.pos.x, cz = P.pos.z, half = 11;
    for (let i = 0; i < 26; i++) {
      const px = cx + rand(-half, half), pz = cz + rand(-half, half);
      this.FX().fire('rock', new THREE.Vector3(px, 0.5, pz), new THREE.Vector3(0, rand(4, 7), 0), {
        gravity: -1, life: 1.2, hitEnemy: false, hitGround: false, spin: 2,
      });
    }
    this.FX().ring(P.pos, { color: 0xa64dff, maxR: 16, dur: 1 });
    g.audio.charge(0.6);
    const used = new Set();
    for (let i = 0; i < 26; i++) {
      g.scheduler.after(1.2 + i * 0.15, () => {
        let targets = this.EM().list.filter(e => !e.dead && !used.has(e.id));
        if (!targets.length) targets = this.EM().list.filter(e => !e.dead);
        let tp;
        if (targets.length) {
          const e = targets[(Math.random() * targets.length) | 0];
          used.add(e.id); tp = e.pos.clone();
        } else { tp = P.pos.clone(); tp.x += rand(-16, 16); tp.z += rand(-16, 16); }
        const from = tp.clone(); from.y = 45;
        this.FX().fire('rock', from, new THREE.Vector3(0, -70, 0), {
          gravity: 80, life: 2, hitEnemy: false, scale: 1.8, trail: { color: 0xa64dff },
          onGround: (pr) => this.FX().explode(pr.mesh.position, { radius: 24, flat: 320 * P.dmgMul(), pct: 0.07, color: 0xa64dff, shake: 0.4, knock: 12 }),
        });
      });
    }
  }
  bDeath() {
    const g = this.game, P = this.P();
    const used = new Set();
    g.scheduler.every(0.15, 23, () => {
      let pool = this.EM().list.filter(e => !e.dead && !used.has(e.id));
      if (!pool.length) { pool = this.EM().list.filter(e => !e.dead); used.clear(); }
      const target = pool.length ? pool[(Math.random() * pool.length) | 0] : null;
      if (target) used.add(target.id);
      const mega = Math.random() < 0.22;
      const speed = mega ? 930 : 186;
      const from = P.pos.clone(); from.y = 1.6;
      let dir;
      if (target) dir = target.pos.clone().setY(1.4).sub(from).normalize();
      else { const a = rand(0, TAU); dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); }
      const slashDmg = 260 * (mega ? 26 : 1);
      this.FX().fire('slash', from, dir.multiplyScalar(speed), {
        life: 1.6, hitR: 2.4, gravity: 0, spin: mega ? 20 : 9,
        scale: mega ? 2.6 : 1.2, color: 0xc9a7ff,
        target, homing: 5,
        onHit: (pr, e) => {
          const R = mega ? 26 : 6;
          this.FX().explode(e.pos, { radius: R, flat: slashDmg * P.dmgMul(), pct: mega ? 0.2 : 0.035, color: 0xc9a7ff, shake: mega ? 0.6 : 0.15, stun: 1.2, sound: !mega });
          this.FX().strike(e.pos, { color: 0xa64dff, count: 2, radius: 3, flat: 60 * P.dmgMul(), pct: 0.008, sound: false, shake: 0 });
          e.burn(slashDmg * P.dmgMul() * 0.027, 10); // ~27% of slash over 10s
          if (mega) { g.audio.thunder(); g.ui.flash('#c9a7ff', 0.3, 200); }
          // mark crit presentation
          this.EM().damage(e, 0.01, 0, { color: 0xc9a7ff, crit: true, quiet: false, source: 'skill' });
        },
      });
      g.audio.swing();
    }, true);
  }
  bSuper() {
    const g = this.game, P = this.P();
    const R = 24;
    this.FX().ring(P.pos, { color: 0xa64dff, maxR: R, dur: 0.5 });
    g.audio.swing();
    let t = 0;
    this.FX().addZone({
      update: (dt) => {
        t += dt;
        if (t > 3 || P.dead) return false;
        // ~0.01s interval: do several per frame
        const steps = Math.max(1, Math.round(dt / 0.01));
        for (let s = 0; s < steps; s++) {
          const a = rand(0, TAU), r = rand(2, R);
          _v.set(P.pos.x + Math.cos(a) * r, 1.4, P.pos.z + Math.sin(a) * r);
          if (Math.random() < 0.25) this.FX().burst(_v, { count: 2, color: [0xc9a7ff, 0xffffff], speed: 14, life: 0.25, size: 2.2, gravity: 0 });
          const e = this.EM().nearest(_v, 5);
          if (e) {
            const dmg = 42 * P.dmgMul();
            this.EM().damage(e, dmg, 0.002, { color: 0xc9a7ff, source: 'skill', quiet: true });
            e.bleed(dmg * 0.01 / 1, 5); // 1% of slash, stacks, fast ticks
          }
        }
        if (Math.random() < dt * 8) g.audio.swing();
        return true;
      },
    });
  }

  // ================= LIGHTNING FRUIT =================
  lBestia() {
    const g = this.game, P = this.P();
    const target = this.EM().nearest(this.aim(), 40) || this.EM().nearest(P.pos, 60);
    const from = P.pos.clone(); from.y = 1.8;
    const dir = target ? target.pos.clone().setY(1.4).sub(from).normalize()
      : this.aim().clone().setY(1.4).sub(from).normalize();
    g.audio.roar();
    this.FX().fire('beast', from, dir.multiplyScalar(30), {
      life: 4, hitR: 2.4, gravity: 0, spin: 4, target, homing: 4,
      trail: { color: 0x33ccff, count: 3 },
      onHit: (p, e) => this.FX().explode(e.pos, { radius: 30, flat: 500 * P.dmgMul(), pct: 0.12, color: 0x33ccff, shake: 0.6, stun: 1 }),
      onGround: (p) => this.FX().explode(p.mesh.position, { radius: 30, flat: 500 * P.dmgMul(), pct: 0.12, color: 0x33ccff, shake: 0.6 }),
    });
  }
  lTormenta() {
    const g = this.game;
    g.scheduler.every(0.22, 17, () => {
      const p = this.aim().clone(); p.x += rand(-16, 16); p.z += rand(-16, 16);
      g.world.clampToArena(p);
      this.FX().strike(p, { color: 0x33ccff, count: 3, radius: 4.5, flat: 150 * this.P().dmgMul(), pct: 0.02, thick: 1 });
    }, true);
  }
  lJuicio() {
    const g = this.game, aim = this.aim().clone();
    this.FX().beam(aim, { color: 0x33ccff, radius: 2, dur: 1.6 });
    g.scheduler.every(0.13, 12, () => {
      this.FX().strike(aim, { color: 0x66e0ff, count: 4, spread: 2.5, radius: 7, flat: 120 * this.P().dmgMul(), pct: 0.015, stun: 3, lift: true, thick: 1.1, sound: false });
    }, true);
    g.audio.thunder();
  }
  lThunderStart(i) {
    if (this.thunder.active) return;
    this.thunder.active = true; this.thunder.pct = 0; this.thunder.slot = i;
    this.thunderMesh.visible = true;
    this.game.ui.showCharge('DESTRUCCIÓN DE BOLA DE TRUENO');
    this.game.audio.charge(0.3);
  }
  lThunderRelease(i) {
    const g = this.game;
    this.thunder.active = false; this.thunderMesh.visible = false;
    g.ui.hideCharge();
    const pct = this.thunder.pct; // 0..100
    const aim = this.aim().clone();
    const scale = 0.6 + pct / 100 * 1.8;
    const from = aim.clone(); from.y = 60;
    g.audio.roar();
    this.FX().fire('thunderball', from, new THREE.Vector3(0, -50, 0), {
      life: 3, hitEnemy: false, scale, trail: { color: 0x33ccff, count: 4 },
      onGround: (p) => {
        const maxR = (14 + pct * 0.45);
        // expanding continuous explosion 5s
        let age = 0, r = 4, tick = 0;
        const center = p.mesh.position.clone();
        this.FX().ring(center, { color: 0x33ccff, maxR, dur: 1 });
        g.audio.explosion(2);
        g.shakeFrom(center, 0.8, 70);
        this.FX().addZone({
          update: (dt) => {
            age += dt;
            if (age > 5) return false;
            r = Math.min(maxR, r + 15 * dt);
            tick -= dt;
            if (tick <= 0) {
              tick = 0.3;
              this.EM().damageInRadius(center, r, 60 * this.P().dmgMul(), 0.012 * (0.5 + pct / 100), { color: 0x33ccff, source: 'skill', from: center });
              this.FX().ring(center, { color: 0x33ccff, maxR: r, dur: 0.35 });
              this.FX().burst(center, { count: 12, color: [0x33ccff, 0x001133], speed: 12, life: 0.5, size: 2.2 });
            }
            return true;
          },
        });
      },
    });
    this.setCd(this.fruitCds, this.fruitCdTotal, i, 20);
  }
  lDestello() {
    if (this.destello.n <= 0) { this.game.audio.ui(); return false; }
    const P = this.P();
    this.destello.n--;
    _v.copy(this.aim()).sub(P.pos).setY(0);
    if (_v.lengthSq() < 0.5) _v.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    _v.normalize();
    P.yaw = Math.atan2(_v.x, _v.z);
    P.dashTo(_v, 10, 240, 160 * P.dmgMul(), 0.03, 0x33ccff);
    this.FX().strike(P.pos, { color: 0x33ccff, count: 2, radius: 3, flat: 80 * P.dmgMul(), pct: 0.01, sound: false, shake: 0.08 });
    return true;
  }
  lMasAlla() {
    const g = this.game;
    g.ui.announce('🌪️ MÁS ALLÁ DEL TRUENO', '#33ccff');
    g.scheduler.every(0.1, 120, () => {
      const p = this.P().pos.clone(); p.x += rand(-45, 45); p.z += rand(-45, 45);
      g.world.clampToArena(p);
      // thundercloud puff
      this.FX().fire('thundercloud', new THREE.Vector3(p.x, 26, p.z), new THREE.Vector3(0, -2, 0), {
        life: 0.9, hitEnemy: false, hitGround: false, spin: 0,
      });
      g.scheduler.after(0.25, () => {
        this.FX().strike(p, { color: 0x33ccff, count: 3, radius: 16, flat: 200 * this.P().dmgMul(), pct: 0.035, stun: 3, thick: 1.1, sound: Math.random() < 0.3 });
      });
    }, true);
  }

  // ================= POLE =================
  pAsalto() {
    const g = this.game, P = this.P();
    const from = P.pos.clone(); from.y = 2;
    _v.copy(this.aim()).setY(2).sub(from).normalize();
    const p = this.FX().fire('cloud', from, _v.multiplyScalar(26), { life: 1.05, hitEnemy: false, hitGround: false, spin: 0 });
    g.audio.shoot();
    g.scheduler.after(1.0, () => {
      if (p && p.active) {
        const pos = p.mesh.position.clone(); pos.y = Math.max(0.5, pos.y * 0.3);
        this.FX().explode(pos, { radius: 2, flat: 90 * P.dmgMul(), pct: 0.01, color: 0x33ccff, shake: 0.1 });
        p.life = 0;
      }
    });
  }
  pJuicio() {
    this.juicio.active = true; this.juicio.age = 0; this.juicio.tick = 0;
    this.game.ui.showChannel('JUICIO CONTINUO — press again to stop');
    this.game.audio.zap();
  }

  // ================= QUAKE =================
  qFatal() {
    const g = this.game, P = this.P();
    // pull: nearest enemy in front cone 14m
    _v.set(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    let victim = null, bd = 14 * 14;
    for (const e of this.EM().list) {
      if (e.dead) continue;
      _v2.copy(e.pos).sub(P.pos); _v2.y = 0;
      const d2 = _v2.lengthSq();
      if (d2 > bd) continue;
      _v2.normalize();
      if (_v2.dot(_v) > 0.25) { bd = d2; victim = e; }
    }
    if (!victim) { g.audio.swing(); return false; } // nothing caught: nothing happens
    victim.suck(P.pos.clone().addScaledVector(_v, 3), 0.5, 40);
    P.endlag = Math.max(P.endlag, 1.6);
    const punchDir = _v.clone(); // capture: _v is a shared temp, closures run later
    // pause + red shift, then the punch
    g.scheduler.after(0.45, () => {
      g.hitstop(1.0);
      g.audio.charge(1);
      g.scheduler.after(1.0, () => {
        const fp = P.pos.clone().addScaledVector(punchDir, 4);
        this.FX().cracks(fp, { color: 0x44ddff, count: 12, scale: 1.8, life: 1.2 });
        this.FX().shell(P.pos, { color: 0xffffff, maxR: 16, dur: 0.5 });
        this.FX().explode(fp, { radius: 11, flat: 700 * P.dmgMul(), pct: 0.18, color: 0xbfeaff, shake: 0.9, knock: 42, stun: 2, cracks: true });
        g.ui.flash('#ff2233', 0.3, 250);
      });
    });
    return true;
  }
  qAir() {
    const g = this.game, P = this.P();
    const from = P.pos.clone(); from.y = 1.8;
    _v.copy(this.aim()).setY(1.8).sub(from).normalize();
    this.FX().cracks(from, { color: 0x44ddff, count: 4, scale: 0.5, life: 0.5 });
    this.FX().ring(P.pos, { color: 0xbfeaff, maxR: 6, dur: 0.35 });
    g.audio.shoot();
    const hitSet = new Set();
    this.FX().fire('orb', from, _v.multiplyScalar(38), {
      life: 1.8, hitR: 3.2, gravity: 0, scale: 1.8, pierce: true,
      trail: { color: 0xbfeaff, count: 3 },
      onHit: (p, e) => {
        if (hitSet.has(e.id)) return;
        hitSet.add(e.id);
        this.EM().damage(e, 260 * P.dmgMul(), 0.05, { color: 0xbfeaff, stun: 2, knock: 10, source: 'skill', from: P.pos });
        this.FX().cracks(e.pos, { color: 0x44ddff, count: 4, scale: 0.7, life: 0.6 });
      },
      onGround: (p) => this.FX().explode(p.mesh.position, { radius: 8, flat: 260 * P.dmgMul(), pct: 0.05, color: 0xbfeaff, shake: 0.3, stun: 2 }),
    });
  }
  qSpatial() {
    const g = this.game, P = this.P();
    P.endlag = Math.max(P.endlag, 0.5);
    g.scheduler.after(0.15, () => {
      this.FX().shell(P.pos, { color: 0xffffff, maxR: 24, dur: 0.6 });
      this.FX().ring(P.pos, { color: 0xffffff, maxR: 24, dur: 0.6 });
      this.FX().cracks(P.pos, { color: 0x44ddff, count: 14, scale: 2.2, life: 1.2 });
      this.FX().debris(P.pos, { count: 30, color: [0x8a7f70, 0x44ddff], speed: 18, scale: 0.9 });
      this.FX().explode(P.pos, { radius: 17, flat: 450 * P.dmgMul(), pct: 0.1, color: 0xbfeaff, shake: 0.7, stun: 5, knock: 20, sound: true });
      g.audio.stomp();
    });
  }
  qSeaquake() {
    const g = this.game, P = this.P();
    // 3 rapid ground expansions
    [0, 0.25, 0.5].forEach((t, k) => {
      g.scheduler.after(t, () => {
        const R = 20 + k * 10;
        this.FX().ring(P.pos, { color: 0x44ddff, maxR: R, dur: 0.5 });
        this.FX().cracks(P.pos, { color: 0x44ddff, count: 10, scale: 2 + k, life: 1 });
        this.FX().explode(P.pos, { radius: R, flat: (200 + k * 100) * P.dmgMul(), pct: 0.04, color: 0x2e9dff, shake: 0.4, stun: 1 });
      });
    });
    // 12 tsunamis from 4 sides through player
    g.scheduler.after(0.6, () => {
      const c = P.pos.clone();
      for (let side = 0; side < 4; side++) {
        const a = side * Math.PI / 2 + Math.PI / 4;
        const dir = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a)); // toward center-ish/player
        // aim at player
        const spawn = c.clone().addScaledVector(dir, -70);
        // 1 large (8x bigger, 3x dmg, 40% slower)
        this.FX().tsunami(spawn.clone(), dir.clone(), { w: 56, h: 17, speed: 13, maxDist: 160, flat: 600 * P.dmgMul(), pct: 0.12, big: true });
        // 2 small per side
        for (let k = -1; k <= 1; k += 2) {
          const off = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(k * 22);
          this.FX().tsunami(spawn.clone().add(off), dir.clone(), { w: 15, h: 8, speed: 22, maxDist: 170, flat: 200 * P.dmgMul(), pct: 0.05 });
        }
      }
      g.audio.roar();
    });
  }

  // ================= BISENTO =================
  biSlam() {
    const g = this.game, P = this.P();
    const aim = this.aim().clone();
    P.endlag = Math.max(P.endlag, 0.4);
    g.scheduler.after(0.12, () => {
      this.FX().shell(aim, { color: 0xffffff, maxR: 18, dur: 0.5 });
      this.FX().ring(aim, { color: 0xffffff, maxR: 18, dur: 0.5 });
      this.FX().explode(aim, { radius: 14, flat: 380 * P.dmgMul(), pct: 0.08, color: 0xbfeaff, shake: 0.5, stun: 2.5, knock: 24, cracks: true });
      g.audio.stomp();
    });
  }
  biBalls() {
    const P = this.P();
    _v.copy(this.aim()).sub(P.pos).setY(0).normalize();
    const base = Math.atan2(_v.x, _v.z);
    for (let k = -2; k <= 2; k++) {
      const a = base + k * 0.28;
      const dir = new THREE.Vector3(Math.sin(a), 0.12, Math.cos(a));
      const from = P.pos.clone(); from.y = 1.8;
      this.FX().fire('quakeOrb', from, dir.multiplyScalar(32), {
        life: 2, hitR: 2, gravity: 4,
        trail: { color: 0x44ddff },
        onHit: (p, e) => this.FX().explode(e.pos, { radius: 6, flat: 170 * P.dmgMul(), pct: 0.03, color: 0x44ddff, shake: 0.2, stun: 0.8 }),
        onGround: (p) => this.FX().explode(p.mesh.position, { radius: 6, flat: 170 * P.dmgMul(), pct: 0.03, color: 0x44ddff, shake: 0.2 }),
      });
    }
    this.game.audio.shoot();
  }
  biMini() {
    const g = this.game, P = this.P();
    for (let i = 0; i < 23; i++) {
      const a = rand(0, TAU);
      const dir = new THREE.Vector3(-Math.cos(a), 0, -Math.sin(a));
      const spawn = P.pos.clone().addScaledVector(dir, -rand(50, 75));
      spawn.x += rand(-10, 10); spawn.z += rand(-10, 10);
      g.scheduler.after(i * 0.06, () => {
        const toP = P.pos.clone().sub(spawn).setY(0).normalize();
        this.FX().tsunami(spawn, toP, { w: 12, h: 7, speed: 24, maxDist: 170, flat: 150 * P.dmgMul(), pct: 0.035 });
      });
    }
    g.audio.roar();
  }

  // ================= ALARM =================
  aManual() {
    const P = this.P();
    const foes = this.EM().random(8, 40);
    if (!foes.length) {
      this.FX().beam(this.aim(), { color: 0xff2e4d, radius: 1, dur: 0.4 });
      return;
    }
    for (const e of foes) {
      this.FX().beam(e.pos, { color: 0xff2e4d, radius: 1.5, dur: 0.7 });
      this.FX().glow(e.pos.clone().setY(3), 0xff2e4d, 7, 0.3, 8);
      e.imprison(6);
      this.EM().damage(e, 120 * P.dmgMul(), 0.015, { color: 0xff2e4d, source: 'skill', from: P.pos });
    }
    this.game.audio.alarm();
  }
  aAuto() {
    const P = this.P();
    const t = this.EM().highestHp(70);
    if (!t) { this.FX().beam(this.aim(), { color: 0xff2e4d, radius: 2.5, dur: 0.6 }); return; }
    this.FX().beam(t.pos, { color: 0xff2e4d, radius: 3.4, dur: 1.1 });
    this.FX().ring(t.pos, { color: 0xff2e4d, maxR: 16, dur: 0.6 });
    t.imprison(15);
    this.EM().damage(t, 300 * P.dmgMul(), 0.06, { color: 0xff2e4d, source: 'skill', from: P.pos });
    for (const e of this.EM().list) {
      if (e.dead || e === t || e.imprisonT <= 0 || e.pos.distanceTo(t.pos) > 16) continue;
      this.FX().beam(e.pos, { color: 0xff6a6a, radius: 1.6, dur: 0.8 });
      this.EM().damage(e, 200 * P.dmgMul(), 0.04, { color: 0xff2e4d, source: 'skill', from: P.pos });
    }
    this.game.audio.alarm();
  }
  aSiren() {
    const g = this.game, P = this.P();
    for (const e of this.EM().list) {
      if (!e.dead && e.pos.distanceTo(P.pos) < 100) e.flee(7);
    }
    g.ui.announce('📢 SIREN BLASTER', '#ff2e4d');
    g.audio.alarm();
    this.FX().ring(P.pos, { color: 0xff2e4d, maxR: 60, dur: 1 });
    g.scheduler.every(1.0, 7, () => {
      for (const e of [...this.EM().list]) {
        if (e.dead || e.fleeT <= 0) continue;
        this.FX().beam(e.pos, { color: 0xff2e4d, radius: 1.3, dur: 0.6 });
        this.FX().strike(e.pos, { color: 0xff5a5a, count: 2, radius: 2, flat: 90 * P.dmgMul(), pct: 0.012, sound: false, shake: 0 });
      }
      g.audio.alarm();
    });
  }
  aBuffer() {
    const P = this.P();
    P.addBuff('alarmbuf', '🚨 BUFFER', '#ff2e4d', 30, (p) => {
      p.dmgBuff *= 3; p.aoeBuff *= 3; p.cdBuff *= 0.75; p.thorns = 0.2;
    });
    this.game.ui.announce('🛡️ ALARM BUFFER: +200% DMG/AOE, −25% CD', '#ff2e4d');
    this.game.audio.heal();
    this.FX().beam(P.pos, { color: 0xff2e4d, radius: 2.4, dur: 1.2 });
  }
  aAmber() { this.EM().spawnGiants(5); }

  // ================= ALARM SWORD =================
  asStomp() {
    const g = this.game, P = this.P();
    P.endlag = Math.max(P.endlag, 0.5);
    g.scheduler.after(0.15, () => {
      this.FX().explode(P.pos, { radius: 40, flat: 600 * P.dmgMul(), pct: 0.09, color: 0xff2e4d, shake: 0.55, shakeMax: 70, knock: 30, stun: 1 });
      for (const e of this.EM().list) {
        if (!e.dead && e.pos.distanceTo(P.pos) < 40 && e.tier === 'normal') e.lift(1.4);
      }
      g.audio.stomp();
    });
  }

  // ================= RIMEFRACTURE =================
  rIcy() {
    const g = this.game;
    g.scheduler.every(0.13, 17, () => {
      const c = this.aim().clone(); c.x += rand(-10, 10); c.z += rand(-10, 10);
      g.world.clampToArena(c);
      const from = c.clone(); from.y = 50;
      this.FX().fire('icicle', from, new THREE.Vector3(0, -80, 0), {
        gravity: 60, life: 2, hitEnemy: false, scale: 2.2, spin: 1,
        trail: { color: 0x9fe8ff, count: 2 },
        onGround: (p) => {
          const pos = p.mesh.position.clone();
          this.FX().explode(pos, { radius: 45, flat: 220 * this.P().dmgMul(), pct: 0.035, color: 0x9fe8ff, shake: 0.3, freeze: 1 });
          for (let k = 0; k < 4; k++) {
            const a = rand(0, TAU);
            this.FX().fire('icicle', pos.clone().setY(2), new THREE.Vector3(Math.cos(a) * 22, rand(6, 14), Math.sin(a) * 22), {
              gravity: 24, life: 1.2, hitR: 2, scale: 1,
              onHit: (pp, e) => this.EM().damage(e, 110 * this.P().dmgMul(), 0.017, { color: 0x9fe8ff, freeze: 1, source: 'skill', from: pos }),
            });
          }
        },
      });
      if (Math.random() < 0.3) g.audio.freeze();
    }, true);
  }
  rBombard() {
    this.P().superState = { kind: 'ice', t: 15 };
    this.P().addBuff('super', '🔷 ICE BOMBARD', '#9fe8ff', 15, null);
    this.game.ui.announce('🔷 ICE BOMBARD — GUN +725225%, FREEZING HITS', '#9fe8ff');
    this.game.audio.heal();
    this.FX().beam(this.P().pos, { color: 0x9fe8ff, radius: 2, dur: 1 });
  }
  rSnowy() {
    const g = this.game, P = this.P();
    P.invuln = Math.max(P.invuln, 0.7);
    P.endlag = Math.max(P.endlag, 0.55);
    g.audio.charge(1);
    this.FX().ring(P.pos, { color: 0x9fe8ff, maxR: 8, dur: 0.5 });
    g.scheduler.after(0.5, () => {
      this.FX().explode(P.pos, { radius: 80, flat: 900 * P.dmgMul(), pct: 0.16, color: 0x9fe8ff, shake: 1, shakeMax: 120, freeze: 10, stun: 2, knock: 20 });
      this.FX().debris(P.pos, { count: 60, color: [0x9fe8ff, 0xffffff, 0x8a7f70], speed: 26, scale: 1.1 });
      this.FX().pit(P.pos, { radius: 55, dur: 10, tick: 1, pct: 0.015, flat: 60 * P.dmgMul(), color: 0x9fe8ff, freeze: true });
      g.ui.flash('#9fe8ff', 0.65, 500);
      g.sustainShake(0.55, 11);
      g.audio.explosion(2.5); g.audio.freeze();
    });
  }

  // ================= WILDFIRE =================
  wFirestorm() {
    const g = this.game, P = this.P();
    let k = 0;
    g.scheduler.every(0.035, 150, () => {
      k++;
      _v.copy(this.aim()).sub(P.pos).setY(0).normalize();
      const base = Math.atan2(_v.x, _v.z) + rand(-0.26, 0.26);
      const dir = new THREE.Vector3(Math.sin(base), rand(0.05, 0.3), Math.cos(base));
      const from = P.pos.clone(); from.y = 1.6;
      const idx = k;
      this.FX().fire('fireball', from, dir.multiplyScalar(42), {
        gravity: 8, life: 1.6, hitR: 2.2, trail: { color: 0xff7a1a },
        onHit: (p, e) => {
          this.FX().explode(e.pos, { radius: 30, flat: 60 * P.dmgMul(), pct: 0.006, color: 0xff7a1a, shake: 0.06, burn: 2, sound: false });
          if (idx % 6 === 0) this.FX().pit(e.pos, { radius: 12, dur: 6, tick: 0.5, pct: 0.01, color: 0xff6a00, burn: 2 });
        },
        onGround: (p) => {
          this.FX().explode(p.mesh.position, { radius: 30, flat: 60 * P.dmgMul(), pct: 0.006, color: 0xff7a1a, shake: 0.06, burn: 2, sound: false });
          if (idx % 6 === 0) this.FX().pit(p.mesh.position, { radius: 12, dur: 6, tick: 0.5, pct: 0.01, color: 0xff6a00, burn: 2 });
        },
      });
      if (k % 12 === 0) g.audio.shoot();
    }, true);
  }
  wHell() {
    this.P().superState = { kind: 'hell', t: 15 };
    this.P().addBuff('super', '😈 HELL FURY', '#ff7a1a', 15, null);
    this.game.ui.announce('😈 HELL FURY — GUN +1250000%, BURNING HITS', '#ff7a1a');
    this.game.audio.heal();
    this.FX().beam(this.P().pos, { color: 0xff7a1a, radius: 2, dur: 1 });
  }
  wLava() {
    const g = this.game, P = this.P();
    let k = 0;
    g.scheduler.every(0.1, 40, () => {
      k++;
      _v.copy(this.aim()).sub(P.pos).setY(0).normalize();
      const base = Math.atan2(_v.x, _v.z) + rand(-0.52, 0.52);
      const dir = new THREE.Vector3(Math.sin(base), rand(0.15, 0.45), Math.cos(base));
      const from = P.pos.clone(); from.y = 2;
      const idx = k;
      const boom = (pos) => {
        this.FX().explode(pos, { radius: 50, flat: 130 * P.dmgMul(), pct: 0.012, color: 0xff5a00, shake: 0.1, burn: 3 });
        this.FX().strike(pos, { color: 0xff9d2e, count: 2, radius: 8, flat: 80 * P.dmgMul(), pct: 0.008, burn: 3, sound: false, shake: 0 });
        if (idx % 4 === 0) this.FX().pit(pos, { radius: 16, dur: 10, tick: 0.5, pct: 0.012, color: 0xff5a00, burn: 3 });
      };
      this.FX().fire('lava', from, dir.multiplyScalar(38), {
        gravity: 14, life: 2.2, hitR: 2.6, trail: { color: 0xff5a00, count: 3 },
        onHit: (p, e) => boom(e.pos), onGround: (p) => boom(p.mesh.position),
      });
      if (k % 5 === 0) g.audio.explosion(0.5);
    }, true);
  }

  // ================= UPDATE =================
  update(dt) {
    for (let i = 0; i < 6; i++) if (this.fruitCds[i] > 0) this.fruitCds[i] -= dt;
    for (let i = 0; i < 5; i++) if (this.swordCds[i] > 0) this.swordCds[i] -= dt;
    this.aimLock -= dt;
    // destello charges
    if (this.destello.n < 3) {
      this.destello.t += dt;
      if (this.destello.t >= 3) { this.destello.t = 0; this.destello.n++; }
    }
    // thunder charge
    if (this.thunder.active) {
      if (this.P().dead) { this.cancelChannels(); }
      else {
        this.thunder.pct = Math.min(100, this.thunder.pct + dt * 100);
        const m = this.thunderMesh;
        m.position.copy(this.P().pos); m.position.y = 22;
        const s = 0.6 + this.thunder.pct / 100 * 1.8;
        m.scale.set(s, s, s);
        m.rotation.y += dt * 3;
        this.game.ui.updateCharge(this.thunder.pct);
        if (Math.random() < dt * 20) this.game.audio.charge(this.thunder.pct / 100);
        if (Math.random() < dt * 8) this.FX().burst(m.position, { count: 2, color: 0x33ccff, speed: 4, life: 0.4, size: 2, gravity: 0 });
      }
    }
    // juicio continuo
    if (this.juicio.active) {
      const P = this.P();
      this.juicio.age += dt; this.juicio.tick -= dt;
      const hpFrac = P.hp / P.maxHp;
      this.game.ui.updateChannel(hpFrac);
      if (hpFrac < 0.5 || P.dead) {
        this.juicio.active = false; this.game.ui.hideChannel();
        if (P.swordId === 'pole') this.setCd(this.swordCds, this.swordCdTotal, 1, 10);
        if (!P.dead) this.game.ui.announce('JUICIO ENDED — HP BELOW 50%', '#ffd94d');
      } else if (this.juicio.tick <= 0) {
        this.juicio.tick = 0.4;
        const R = 8 * (1 + Math.min(0.5, this.juicio.age * 0.05));
        const at = this.aim().clone();
        P.hp = Math.max(1, P.hp - P.maxHp * 0.01); // 1% HP per strike
        // drag enemies into AoE
        for (const e of this.EM().list) {
          if (!e.dead && e.pos.distanceTo(at) < 9) e.suck(at, 0.5, 22);
        }
        this.FX().strike(at, { color: 0x33ccff, count: 4, radius: R, flat: 110 * P.dmgMul(), pct: 0.014, thick: 1.1 });
      }
    }
  }
}
