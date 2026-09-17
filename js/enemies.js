// ---------- Enemies: director, AI, statuses, elites, bosses, giant allies ----------
import * as THREE from 'three';
import { clamp, rand, randInt, TAU } from './utils.js';

const TIER = {
  normal: { hp: 420, dmg: 26, speed: 5.2, scale: 1, color: 0x5a4a8a, eye: 0xff4444, xp: 1 },
  elite:  { hp: 3400, dmg: 70, speed: 4.4, scale: 1.65, color: 0xb45c1a, eye: 0xffee44, xp: 6 },
  boss:   { hp: 22000, dmg: 160, speed: 3.6, scale: 3.1, color: 0xc01a3a, eye: 0xffffff, xp: 30 },
};

let EID = 1;

export class Enemy {
  constructor(game, tier, pos) {
    this.game = game;
    this.id = EID++;
    this.tier = tier;
    const T = TIER[tier];
    const wave = game.wave;
    const hpScale = 1 + (wave - 1) * 0.35 + game.time * 0.004;
    this.maxHp = T.hp * hpScale;
    this.hp = this.maxHp;
    this.dmg = T.dmg * (1 + (wave - 1) * 0.12);
    this.speed = T.speed * rand(0.9, 1.1);
    this.pos = pos.clone();
    this.yaw = rand(0, TAU);
    this.dead = false;
    this.atkCd = rand(0, 0.8);
    this.windup = 0;
    this.touchCd = 0;
    // statuses
    this.stunT = 0; this.freezeT = 0; this.imprisonT = 0; this.blindT = 0;
    this.fleeT = 0; this.liftT = 0; this.liftDur = 1;
    this.suckT = 0; this.suckPoint = new THREE.Vector3(); this.suckSpeed = 20;
    this.knockV = new THREE.Vector3();
    this.burnT = 0; this.burnDps = 0; this.bleedT = 0; this.bleedDps = 0;
    this.wanderA = rand(0, TAU); this.wanderT = 0;
    this.buildMesh(T);
  }

  buildMesh(T) {
    const g = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: T.color, roughness: 0.7 });
    this.bodyMat = body;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1426, roughness: 0.9 });
    const s = T.scale;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 1.1 * s, 0.55 * s), body);
    torso.position.y = 1.35 * s;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.55 * s, 0.6 * s), dark);
    head.position.y = 2.2 * s;
    const eyeM = new THREE.MeshBasicMaterial({ color: T.eye });
    const eL = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.02), eyeM);
    eL.position.set(-0.15 * s, 2.22 * s, 0.31 * s);
    const eR = eL.clone(); eR.position.x = 0.15 * s;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.9 * s, 0.3 * s), dark);
    legL.position.set(-0.24 * s, 0.45 * s, 0);
    const legR = legL.clone(); legR.position.x = 0.24 * s;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.95 * s, 0.26 * s), body);
    armL.position.set(-0.62 * s, 1.35 * s, 0);
    const armR = armL.clone(); armR.position.x = 0.62 * s;
    this.armR = armR; this.legL = legL; this.legR = legR;
    g.add(torso, head, eL, eR, legL, legR, armL, armR);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // tier ring
    if (this.tier !== 'normal') {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.2 * s, 0.1 * s, 8, 24),
        new THREE.MeshBasicMaterial({ color: this.tier === 'boss' ? 0xff2e4d : 0xffaa22 }));
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.15;
      g.add(ring);
    }
    // status overlays
    this.cage = new THREE.Mesh(new THREE.BoxGeometry(1.6 * s, 3 * s, 1.6 * s),
      new THREE.MeshBasicMaterial({ color: 0xff2e4d, transparent: true, opacity: 0.22, depthWrite: false }));
    this.cage.position.y = 1.5 * s; this.cage.visible = false; g.add(this.cage);
    const cageEdge = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 3.1 * s, 1.7 * s),
      new THREE.MeshBasicMaterial({ color: 0xff2e4d, wireframe: true, transparent: true, opacity: 0.8 }));
    cageEdge.position.y = 1.5 * s; cageEdge.visible = false; g.add(cageEdge);
    this.cageEdge = cageEdge;
    this.ice = new THREE.Mesh(new THREE.BoxGeometry(1.5 * s, 2.9 * s, 1.5 * s),
      new THREE.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.ice.position.y = 1.5 * s; this.ice.visible = false; g.add(this.ice);
    this.stunStar = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffd94d, transparent: true, opacity: 0.95, depthWrite: false }));
    this.stunStar.scale.set(1.2, 1.2, 1); this.stunStar.position.y = 3 * s;
    this.stunStar.visible = false; g.add(this.stunStar);
    // hp bar
    const bw = 2.2 * s;
    this.hpBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x110611, depthWrite: false }));
    this.hpBg.scale.set(bw, 0.22 * s, 1); this.hpBg.position.y = 2.9 * s;
    this.hpFg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x49ffa6, depthWrite: false }));
    this.hpFg.scale.set(bw, 0.16 * s, 1); this.hpFg.position.y = 2.9 * s;
    g.add(this.hpBg, this.hpFg);
    this.hpW = bw;
    this.mesh = g;
    this.mesh.position.copy(this.pos);
    this.game.scene.add(g);
    this.ph = rand(0, TAU);
  }

  get rooted() { return this.stunT > 0 || this.freezeT > 0 || this.imprisonT > 0 || this.liftT > 0; }
  stun(d) { if (this.tier === 'boss') d *= 0.4; this.stunT = Math.max(this.stunT, d); }
  freeze(d) { if (this.tier === 'boss') d *= 0.4; this.freezeT = Math.max(this.freezeT, d); }
  imprison(d) { if (this.tier === 'boss') d *= 0.35; this.imprisonT = Math.max(this.imprisonT, d); }
  blind(d) { this.blindT = Math.max(this.blindT, d); }
  flee(d) { this.fleeT = Math.max(this.fleeT, d); }
  lift(d) { if (this.tier === 'boss') return; this.liftT = Math.max(this.liftT, d); this.liftDur = Math.max(this.liftDur, d); }
  suck(point, dur, speed = 26) { if (this.tier === 'boss') { dur *= 0.3; speed *= 0.4; } this.suckPoint.copy(point); this.suckT = Math.max(this.suckT, dur); this.suckSpeed = speed; }
  knockback(from, power) {
    _t1.copy(this.pos).sub(from).setY(0);
    if (_t1.lengthSq() < 0.01) _t1.set(rand(-1, 1), 0, rand(-1, 1));
    _t1.normalize().multiplyScalar(power * (this.tier === 'boss' ? 0.25 : this.tier === 'elite' ? 0.6 : 1));
    this.knockV.add(_t1);
  }
  burn(dps, dur) { this.burnDps = Math.max(this.burnDps, dps); this.burnT = Math.max(this.burnT, dur); }
  bleed(dps, dur) { this.bleedDps += dps; this.bleedT = Math.max(this.bleedT, dur); } // stacks!

  update(dt) {
    if (this.dead) return;
    const P = this.game.player;
    // dots
    if (this.burnT > 0) {
      this.burnT -= dt;
      this.rawDamage(this.burnDps * dt, 0xFF7a1a, true);
      if (Math.random() < dt * 14) this.game.effects.burst(this.pos.clone().setY(1.5), { count: 1, color: [0xff7a1a, 0xffdd88], speed: 2, up: 5, life: 0.5, size: 1.8, gravity: -2 });
      if (this.burnT <= 0) this.burnDps = 0;
    }
    if (this.bleedT > 0) {
      this.bleedT -= dt;
      this.rawDamage(this.bleedDps * dt, 0xff2e4d, true);
      if (Math.random() < dt * 10) this.game.effects.burst(this.pos.clone().setY(1.2), { count: 1, color: 0xff2e4d, speed: 4, up: 3, life: 0.4, size: 1.4 });
      if (this.bleedT <= 0) this.bleedDps = 0;
    }
    if (this.dead) return;
    // timers
    this.stunT -= dt; this.freezeT -= dt; this.imprisonT -= dt; this.blindT -= dt;
    this.fleeT -= dt; this.atkCd -= dt; this.touchCd -= dt; this.suckT -= dt;
    // knockback
    this.pos.addScaledVector(this.knockV, dt);
    this.knockV.multiplyScalar(Math.max(0, 1 - 5 * dt));
    // lift
    if (this.liftT > 0) {
      this.liftT -= dt;
      const k = Math.sin((1 - this.liftT / this.liftDur) * Math.PI);
      this.mesh.position.y = k * 6;
    } else this.mesh.position.y = 0;

    const toP = _t1.copy(P.pos).sub(this.pos).setY(0);
    const dist = toP.length();
    const dir = dist > 0.01 ? toP.multiplyScalar(1 / dist) : _t1.set(0, 0, 1);

    if (!this.rooted && !P.dead) {
      let mvx = 0, mvz = 0, spd = this.speed;
      if (this.suckT > 0) {
        _t2.copy(this.suckPoint).sub(this.pos).setY(0);
        const d = _t2.length();
        if (d > 0.5) { _t2.multiplyScalar(1 / d); mvx = _t2.x * this.suckSpeed; mvz = _t2.z * this.suckSpeed; }
        this.yaw = Math.atan2(_t2.x, _t2.z);
      } else if (this.fleeT > 0) {
        mvx = -dir.x * spd * 1.2; mvz = -dir.z * spd * 1.2;
        this.yaw = Math.atan2(mvx, mvz);
      } else if (this.blindT > 0) {
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.wanderT = rand(0.5, 1.4); this.wanderA = rand(0, TAU); }
        mvx = Math.sin(this.wanderA) * spd * 0.5; mvz = Math.cos(this.wanderA) * spd * 0.5;
        this.yaw = Math.atan2(mvx, mvz);
      } else if (dist > 2.4 * TIER[this.tier].scale) {
        mvx = dir.x * spd; mvz = dir.z * spd;
        this.yaw = Math.atan2(dir.x, dir.z);
        this.windup = 0;
      } else {
        // melee attack
        this.yaw = Math.atan2(dir.x, dir.z);
        if (this.atkCd <= 0 && this.windup <= 0) this.windup = 0.45;
      }
      this.pos.x += mvx * dt; this.pos.z += mvz * dt;
      this.ph += dt * (Math.abs(mvx) + Math.abs(mvz) > 0.5 ? 9 : 2);
      // windup strike
      if (this.windup > 0) {
        this.windup -= dt;
        this.armR.rotation.x = -2.2 * (1 - this.windup / 0.45);
        if (this.windup <= 0) {
          this.atkCd = this.tier === 'boss' ? 2.2 : 1.5;
          this.armR.rotation.x = 0.8;
          const reach = 3.4 * TIER[this.tier].scale;
          if (this.pos.distanceTo(P.pos) < reach + 1) {
            P.takeDamage(this.dmg * rand(0.85, 1.15), this.pos);
            this.game.audio.hit();
          }
          if (this.tier === 'boss') {
            this.game.effects.ring(this.pos, { color: 0xff2e4d, maxR: 8, dur: 0.4 });
            this.game.shakeFrom(this.pos, 0.25, 30);
          }
        }
      } else this.armR.rotation.x *= 0.9;
    }

    this.game.world.clampToArena(this.pos);
    this.mesh.position.x = this.pos.x; this.mesh.position.z = this.pos.z;
    this.mesh.rotation.y = this.yaw;
    const w = Math.sin(this.ph) * (this.rooted ? 0.05 : 0.45);
    this.legL.rotation.x = w; this.legR.rotation.x = -w;
    // status visuals
    this.cage.visible = this.cageEdge.visible = this.imprisonT > 0;
    this.ice.visible = this.freezeT > 0;
    this.stunStar.visible = this.stunT > 0;
    if (this.stunStar.visible) this.stunStar.position.x = Math.sin(this.game.time * 8) * 0.7;
    if (this.freezeT > 0) this.bodyMat.emissive.setHex(0x2266aa);
    else if (this.burnT > 0) this.bodyMat.emissive.setHex(0x661100);
    else this.bodyMat.emissive.setHex(0x000000);
    // hp bar
    const f = clamp(this.hp / this.maxHp, 0, 1);
    this.hpFg.scale.x = Math.max(0.001, this.hpW * f);
    this.hpFg.position.x = -this.hpW * (1 - f) / 2;
    this.hpFg.material.color.setHex(f > 0.5 ? 0x49ffa6 : f > 0.25 ? 0xffd94d : 0xff3b5c);
  }

  rawDamage(amount, color = 0xffffff, quiet = false) {
    if (this.dead || amount <= 0) return 0;
    this.hp -= amount;
    if (!quiet) {
      this.game.ui.damageNum(this.pos, amount, ''); // styled by caller usually
    }
    if (this.hp <= 0) { this.hp = 0; this.game.enemies.kill(this); }
    return amount;
  }

  dispose() {
    this.game.scene.remove(this.mesh);
  }
}
const _t1 = new THREE.Vector3(), _t2 = new THREE.Vector3();

// ================= GIANT ALLIES (Amber Alert) =================
export class Giant {
  constructor(game, pos) {
    this.game = game;
    this.pos = pos.clone();
    this.life = 15; this.dead = false;
    this.target = null;
    this.atkCd = 1; this.skillCd = 3;
    this.yaw = 0; this.ph = rand(0, TAU);
    const g = new THREE.Group();
    const armor = new THREE.MeshStandardMaterial({ color: 0x8a1020, roughness: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a0a10, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.6, 3.2, 1.6), armor); torso.position.y = 4;
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.6, 1.7), dark); head.position.y = 6.3;
    const siren = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 0.8, 10), new THREE.MeshBasicMaterial({ color: 0xff2e4d }));
    siren.position.y = 7.4; this.siren = siren;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.6, 0.9), dark); legL.position.set(-0.7, 1.3, 0);
    const legR = legL.clone(); legR.position.x = 0.7;
    this.arm = new THREE.Group(); this.arm.position.set(1.8, 5.2, 0);
    const armM = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.6, 0.8), armor); armM.position.y = -1.2;
    const sword = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.4, 0.5), new THREE.MeshBasicMaterial({ color: 0xff5a5a }));
    sword.position.y = -3.4; this.arm.add(armM, sword);
    g.add(torso, head, siren, legL, legR, this.arm);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.mesh = g; this.mesh.position.copy(this.pos);
    game.scene.add(g);
  }
  update(dt) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.die(); return; }
    this.siren.material.color.setHex(Math.floor(this.game.time * 6) % 2 ? 0xff2e4d : 0xffaa00);
    // distinct target (not targeted by other giants)
    if (!this.target || this.target.dead) {
      const taken = new Set(this.game.enemies.allies.filter(a => a !== this && a.target).map(a => a.target.id));
      const cands = this.game.enemies.list.filter(e => !e.dead && !taken.has(e.id) && e.pos.distanceTo(this.pos) < 80);
      cands.sort((a, b) => a.pos.distanceToSquared(this.pos) - b.pos.distanceToSquared(this.pos));
      this.target = cands[0] || null;
    }
    this.atkCd -= dt; this.skillCd -= dt;
    if (this.target && !this.target.dead) {
      const d = this.target.pos.distanceTo(this.pos);
      this.yaw = Math.atan2(this.target.pos.x - this.pos.x, this.target.pos.z - this.pos.z);
      if (d > 6) {
        this.pos.x += Math.sin(this.yaw) * 9 * dt;
        this.pos.z += Math.cos(this.yaw) * 9 * dt;
        this.ph += dt * 6;
      } else if (this.atkCd <= 0) {
        this.atkCd = 1.1;
        this.arm.rotation.x = -2.4;
        this.game.scheduler.after(0.18, () => {
          if (this.dead) return;
          this.arm.rotation.x = 0.9;
          this.game.enemies.damage(this.target, 400 * this.game.player.dmgMul(), 0.03, { color: 0xff2e4d, source: 'giant', from: this.pos, knock: 8 });
          this.game.audio.swing();
        });
      }
      if (this.skillCd <= 0) {
        this.skillCd = 5; // auto skill: red stomp
        this.game.effects.explode(this.pos, { radius: 40, flat: 500 * this.game.player.dmgMul(), pct: 0.04, color: 0xff2e4d, shake: 0.5, knock: 30, source: 'giant' });
        // launch visual
        for (const e of this.game.enemies.list) {
          if (!e.dead && e.pos.distanceTo(this.pos) < 40 && e.tier === 'normal') e.lift(1.2);
        }
        this.game.audio.stomp();
      }
    }
    this.arm.rotation.x *= 0.9;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.yaw;
    if (this.life < 2) this.mesh.visible = Math.floor(this.game.time * 8) % 2 === 0;
  }
  die() {
    this.dead = true;
    this.game.effects.burst(this.pos.clone().setY(3), { count: 40, color: [0xff2e4d, 0xffffff], speed: 12, life: 0.8, size: 2.4 });
    this.game.scene.remove(this.mesh);
  }
}

// ================= MANAGER =================
export class EnemyManager {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.allies = [];
    this.kills = 0;
    this.spawnT = 0;
  }
  get aliveCount() { return this.list.filter(e => !e.dead).length; }

  spawn(tier, pos) {
    if (this.list.length >= this.game.settings.get('enemyCap') + 10) return null;
    const e = new Enemy(this.game, tier, pos);
    this.list.push(e);
    this.game.effects.burst(pos.clone().setY(1), { count: 12, color: 0xb45cff, speed: 8, life: 0.5, size: 2 });
    return e;
  }
  spawnGiants(n = 5) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const p = this.game.player.pos.clone();
      p.x += Math.cos(a) * 8; p.z += Math.sin(a) * 8;
      this.game.world.clampToArena(p);
      this.allies.push(new Giant(this.game, p));
      this.game.effects.beam(p, { color: 0xff2e4d, radius: 2.5, dur: 1 });
    }
    this.game.ui.announce('🚨 AMBER ALERT — GIANTS DEPLOYED', '#ff2e4d');
    this.game.audio.alarm();
  }

  clearAll() {
    for (const e of this.list) e.dispose();
    this.list.length = 0;
    for (const a of this.allies) { a.dead = true; this.game.scene.remove(a.mesh); }
    this.allies.length = 0;
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    const big = e.tier === 'boss' ? 2.5 : e.tier === 'elite' ? 1.5 : 1;
    this.game.effects.burst(e.pos.clone().setY(1.5), { count: Math.round(24 * big), color: [0xb45cff, TIER[e.tier].color, 0xffffff], speed: 10, life: 0.7, size: 2.2 });
    this.game.effects.debris(e.pos, { count: Math.round(8 * big), color: TIER[e.tier].color, speed: 10, scale: 0.5 });
    this.game.effects.glow(e.pos.clone().setY(2), TIER[e.tier].color, 7 * big, 0.3, 10);
    this.game.audio.hit();
    this.game.player.heal(this.game.player.maxHp * 0.008);
    this.game.skills.onKill(e);
    if (e.tier === 'boss') {
      this.game.ui.announce('👑 BOSS SLAIN!', '#ffd94d');
      this.game.shakeFrom(e.pos, 0.6, 60);
      this.game.player.heal(this.game.player.maxHp * 0.25);
    }
  }

  damage(e, flat, pct = 0, opts = {}) {
    if (!e || e.dead) return 0;
    let amount = flat + (pct || 0) * e.maxHp;
    if (opts.crit) amount *= 2;
    if (amount <= 0) return 0;
    // statuses
    if (opts.stun) e.stun(opts.stun);
    if (opts.freeze) e.freeze(opts.freeze);
    if (opts.imprison) e.imprison(opts.imprison);
    if (opts.blind) e.blind(opts.blind);
    if (opts.lift) e.lift(opts.lift);
    if (opts.knock && opts.from) e.knockback(opts.from, opts.knock);
    if (opts.burn) e.burn((opts.burnPct ?? 0.02) * e.maxHp, opts.burn);
    if (opts.bleed) e.bleed((opts.bleedPct ?? 0.01) * e.maxHp, opts.bleed);
    // superstate riders
    const ss = this.game.player.superState;
    if (ss && (opts.source === 'skill' || opts.source === 'm1' || opts.source === 'gun')) {
      if (ss.kind === 'ice') e.freeze(3); else e.burn(0.03 * e.maxHp, 3);
    }
    e.hp -= amount;
    if (!opts.quiet) this.game.ui.damageNum(e.pos, amount, opts.crit ? 'crit' : '', opts.color);
    this.game.skills.onDamageDealt(e, amount);
    // hit flash
    e.bodyMat.emissive.setHex(0x555555);
    if (e.hp <= 0) { e.hp = 0; this.kill(e); }
    return amount;
  }

  damageInRadius(pos, radius, flat, pct = 0, opts = {}) {
    let n = 0;
    const r2 = radius * radius;
    for (const e of this.list) {
      if (e.dead) continue;
      const d2 = e.pos.distanceToSquared(pos);
      if (d2 > r2) continue;
      let f = flat, p = pct;
      if (opts.falloff && radius > 0) {
        const k = 1 - Math.sqrt(d2) / radius * 0.5;
        f *= k; p *= k;
      }
      this.damage(e, f, p, opts);
      n++;
    }
    return n;
  }

  suckAll(point, dur, speed) { for (const e of this.list) if (!e.dead) e.suck(point, dur, speed); }
  nearest(pos, maxD = 999, filter = null) {
    let best = null, bd = maxD * maxD;
    for (const e of this.list) {
      if (e.dead || (filter && !filter(e))) continue;
      const d = e.pos.distanceToSquared(pos);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  highestHp(maxD = 999) {
    let best = null;
    for (const e of this.list) {
      if (e.dead || e.pos.distanceTo(this.game.player.pos) > maxD) continue;
      if (!best || e.hp > best.hp) best = e;
    }
    return best;
  }
  random(n, maxD = 999, from = null) {
    const origin = from || this.game.player.pos;
    const pool = this.list.filter(e => !e.dead && e.pos.distanceTo(origin) <= maxD);
    for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, n);
  }
  touching(pos, r) {
    const r2 = r * r;
    for (const e of this.list) {
      if (e.dead) continue;
      const dx = e.pos.x - pos.x, dz = e.pos.z - pos.z, dy = (e.mesh.position.y + 1.2) - pos.y;
      if (dx * dx + dz * dz < r2 && Math.abs(dy) < 4) return e;
    }
    return null;
  }
  rayHit(from, dir, maxDist) {
    let best = null, bd = maxDist;
    for (const e of this.list) {
      if (e.dead) continue;
      _t1.copy(e.pos).setY(1.2).sub(from);
      const t = _t1.dot(dir);
      if (t < 0 || t > bd) continue;
      _t2.copy(dir).multiplyScalar(t).sub(_t1);
      if (_t2.length() < 1.6) { bd = t; best = e; }
    }
    return best;
  }

  director(dt) {
    const g = this.game;
    if (g.player.dead) return;
    this.spawnT -= dt;
    const cap = g.settings.get('enemyCap');
    const target = Math.min(cap, 5 + g.wave * 2);
    if (this.spawnT <= 0 && this.aliveCount < target) {
      this.spawnT = Math.max(0.25, 1.4 - g.wave * 0.06);
      const batch = 1 + Math.floor(g.wave / 3);
      for (let i = 0; i < batch && this.aliveCount < target; i++) {
        const p = g.world.randomEdgePoint(new THREE.Vector3());
        // don't spawn on top of player
        if (p.distanceTo(g.player.pos) < 12) { p.x *= -0.7; p.z *= -0.7; }
        const roll = Math.random();
        const tier = roll < 0.02 + g.wave * 0.004 ? 'boss' : roll < 0.12 + g.wave * 0.01 ? 'elite' : 'normal';
        const e = this.spawn(tier, p);
        if (e && tier === 'boss') { g.ui.announce('👑 BOSS INBOUND', '#ff2e4d'); g.audio.roar(); }
      }
    }
  }

  update(dt) {
    this.director(dt);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i];
      if (e.dead) { e.dispose(); this.list.splice(i, 1); continue; }
      e.update(dt);
    }
    // separation (cheap, capped pairs)
    const L = this.list, n = Math.min(L.length, 60);
    for (let i = 0; i < n; i++) {
      const a = L[i]; if (a.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const b = L[j]; if (b.dead) continue;
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < 2.6 && d2 > 0.0001) {
          const d = Math.sqrt(d2), push = (1.6 - d) * 2.4 * 0.016;
          const nx = dx / d, nz = dz / d;
          a.pos.x -= nx * push; a.pos.z -= nz * push;
          b.pos.x += nx * push; b.pos.z += nz * push;
        }
      }
    }
    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      a.update(dt);
      if (a.dead) this.allies.splice(i, 1);
    }
  }
}
