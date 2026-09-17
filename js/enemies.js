// ---------- Enemies: 7 kinds x 3 tiers, unique AI, statuses, bosses, giant allies ----------
import * as THREE from 'three';
import { clamp, rand, randInt, choice, TAU } from './utils.js';

export const KIND = {
  grunt:    { hp: 420,  dmg: 26, speed: 5.2, scale: 1.0,  color: 0x5a4a8a, eye: 0xff4444, name: 'Grunt' },
  runner:   { hp: 220,  dmg: 18, speed: 8.6, scale: 0.85, color: 0x3aa655, eye: 0xffff44, name: 'Runner' },
  brute:    { hp: 1500, dmg: 55, speed: 3.1, scale: 1.9,  color: 0x7a4a2a, eye: 0xff6600, name: 'Brute' },
  spitter:  { hp: 300,  dmg: 22, speed: 4.2, scale: 1.0,  color: 0xa53aa6, eye: 0xff44ff, name: 'Spitter' },
  bomber:   { hp: 260,  dmg: 0,  speed: 7.2, scale: 1.0,  color: 0xcc3333, eye: 0xffffff, name: 'Bomber' },
  wraith:   { hp: 340,  dmg: 24, speed: 5.6, scale: 1.1,  color: 0x3a6aa6, eye: 0x99eeff, name: 'Wraith' },
  splitter: { hp: 620,  dmg: 22, speed: 4.6, scale: 1.35, color: 0x7aa63a, eye: 0xddff44, name: 'Splitter' },
};
const TIERM = {
  normal: { hp: 1,  dmg: 1,   speed: 1,    scale: 1 },
  elite:  { hp: 6,  dmg: 2.4, speed: 0.95, scale: 1.5 },
  boss:   { hp: 42, dmg: 5,   speed: 0.9,  scale: 2.4 },
};

let EID = 1;

export class Enemy {
  constructor(game, tier, kind, pos) {
    this.game = game;
    this.id = EID++;
    this.tier = tier;
    this.kind = kind in KIND ? kind : 'grunt';
    const K = KIND[this.kind], T = TIERM[tier];
    const wave = game.wave;
    const hpScale = (1 + (wave - 1) * 0.35 + game.time * 0.004) * T.hp;
    this.maxHp = K.hp * hpScale;
    this.hp = this.maxHp;
    this.dmg = K.dmg * T.dmg * (1 + (wave - 1) * 0.12);
    this.speed = K.speed * T.speed * rand(0.9, 1.1);
    this.s = K.scale * T.scale; // overall scale
    this.pos = pos.clone(); this.pos.y = 0;
    this.yaw = rand(0, TAU);
    this.dead = false;
    this.moving = false;
    // shared timers
    this.atkCd = rand(0, 0.8);
    this.windup = 0;
    this.touchCd = 0;
    this.flashT = 0;
    // statuses
    this.stunT = 0; this.freezeT = 0; this.imprisonT = 0; this.blindT = 0;
    this.fleeT = 0; this.liftT = 0; this.liftDur = 1;
    this.suckT = 0; this.suckPoint = new THREE.Vector3(); this.suckSpeed = 20;
    this.knockV = new THREE.Vector3();
    this.burnT = 0; this.burnDps = 0; this.bleedT = 0; this.bleedDps = 0;
    this.wanderA = rand(0, TAU); this.wanderT = 0;
    // kind AI state
    this.lungeCd = 1; this.lungeTele = 0; this.lungeFly = 0; this.lungeDir = new THREE.Vector3();
    this.slamCd = 1; this.slamT = 0;
    this.shotCd = rand(1, 2);
    this.strafeDir = Math.random() < 0.5 ? 1 : -1; this.strafeT = rand(1, 3);
    this.diveT = rand(2, 4); this.diveState = 'orbit'; this.diveT2 = 0; this.orbitA = rand(0, TAU);
    this.hoverY = 6.5;
    this.fuseT = -1; this.beepT = 0; this.fuseBoom = false;
    this.trailT = 0;
    this.buildMesh(K);
  }

  buildMesh(K) {
    const g = new THREE.Group();
    const s = this.s;
    const body = new THREE.MeshStandardMaterial({ color: K.color, roughness: 0.7 });
    this.bodyMat = body;
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1426, roughness: 0.9 });
    const eyeM = new THREE.MeshBasicMaterial({ color: K.eye });

    if (this.kind === 'bomber') {
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.85 * s, 14, 12), body);
      ball.position.y = 1.25 * s; g.add(ball);
      this.core = new THREE.Mesh(new THREE.SphereGeometry(0.3 * s, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      this.core.position.set(0, 1.35 * s, 0.72 * s); g.add(this.core);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.6 * s, 0.28 * s), dark);
      legL.position.set(-0.3 * s, 0.3 * s, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.3 * s; g.add(legR);
      this.legL = legL; this.legR = legR;
      const eL = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.14 * s, 0.02), eyeM);
      eL.position.set(-0.25 * s, 1.7 * s, 0.72 * s); g.add(eL);
      const eR = eL.clone(); eR.position.x = 0.25 * s; g.add(eR);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 0.7 * s, 0.22 * s), body);
      arm.position.set(0.95 * s, 1.2 * s, 0); g.add(arm);
      this.armR = arm;
    } else if (this.kind === 'splitter') {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.95 * s, 14, 12), body);
      blob.position.y = 1.3 * s; g.add(blob);
      for (let i = 0; i < 3; i++) {
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.22 * s, 8, 6), eyeM);
        const a = i * 2.1;
        spot.position.set(Math.cos(a) * 0.8 * s, 1.3 * s + (i - 1) * 0.3 * s, Math.sin(a) * 0.8 * s);
        g.add(spot);
      }
      const eL = new THREE.Mesh(new THREE.BoxGeometry(0.14 * s, 0.14 * s, 0.02), eyeM);
      eL.position.set(-0.25 * s, 1.6 * s, 0.85 * s); g.add(eL);
      const eR = eL.clone(); eR.position.x = 0.25 * s; g.add(eR);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.6 * s, 0.3 * s), dark);
      legL.position.set(-0.35 * s, 0.3 * s, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.35 * s; g.add(legR);
      this.legL = legL; this.legR = legR;
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.26 * s, 0.9 * s, 0.26 * s), body);
      armR.position.set(1.05 * s, 1.3 * s, 0); g.add(armR);
      this.armR = armR;
    } else if (this.kind === 'wraith') {
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8 * s, 1.1 * s, 0.5 * s), body);
      torso.position.y = 1.35 * s; g.add(torso);
      const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.7 * s, 1.6 * s, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
      cloak.position.y = 0.35 * s; g.add(cloak);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.5 * s, 0.55 * s), dark);
      head.position.y = 2.15 * s; g.add(head);
      const eL = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.1 * s, 0.02), eyeM);
      eL.position.set(-0.14 * s, 2.17 * s, 0.29 * s); g.add(eL);
      const eR = eL.clone(); eR.position.x = 0.14 * s; g.add(eR);
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 1.0 * s, 0.22 * s), body);
      armR.position.set(0.58 * s, 1.35 * s, 0); g.add(armR);
      const armL = armR.clone(); armL.position.x = -0.58 * s; g.add(armL);
      this.armR = armR; this.legL = null; this.legR = null;
    } else {
      // humanoid base: grunt / runner / brute / spitter
      const wide = this.kind === 'brute' ? 1.45 : 1;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s * wide, 1.1 * s, 0.55 * s), body);
      torso.position.y = 1.35 * s; g.add(torso);
      if (this.kind === 'runner') torso.rotation.x = 0.28;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.55 * s, 0.6 * s), dark);
      head.position.y = 2.2 * s; g.add(head);
      const eL = new THREE.Mesh(new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.02), eyeM);
      eL.position.set(-0.15 * s, 2.22 * s, 0.31 * s); g.add(eL);
      const eR = eL.clone(); eR.position.x = 0.15 * s; g.add(eR);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.3 * s, 0.9 * s, 0.3 * s), dark);
      legL.position.set(-0.24 * s, 0.45 * s, 0); g.add(legL);
      const legR = legL.clone(); legR.position.x = 0.24 * s; g.add(legR);
      this.legL = legL; this.legR = legR;
      const armT = this.kind === 'brute' ? 0.4 * s : 0.26 * s;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(armT, 0.95 * s, armT), body);
      armL.position.set(-0.62 * s * wide, 1.35 * s, 0); g.add(armL);
      const armR = armL.clone(); armR.position.x = 0.62 * s * wide; g.add(armR);
      this.armR = armR;
      if (this.kind === 'brute') {
        for (const sx of [-1, 1]) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.55 * s, 0.3 * s, 0.55 * s), dark);
          plate.position.set(sx * 0.75 * s * wide, 1.95 * s, 0); g.add(plate);
        }
      }
      if (this.kind === 'runner') {
        for (let i = 0; i < 2; i++) {
          const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.5 * s, 6), dark);
          spike.position.set(0, (1.5 - i * 0.4) * s, -0.4 * s);
          spike.rotation.x = -1.1; g.add(spike);
        }
      }
      if (this.kind === 'spitter') {
        const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.2 * s, 0.9 * s, 8), dark);
        cannon.rotation.x = Math.PI / 2;
        cannon.position.set(0.62 * s * wide, 1.35 * s, 0.55 * s); g.add(cannon);
        this.muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 8, 6), eyeM);
        this.muzzle.position.set(0.62 * s * wide, 1.35 * s, 1.0 * s); g.add(this.muzzle);
      }
    }
    // boss crown spikes
    if (this.tier === 'boss') {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.55 * s, 5),
          new THREE.MeshBasicMaterial({ color: 0xffd94d }));
        spike.position.set(Math.cos(a) * 0.55 * s, 2.6 * s, Math.sin(a) * 0.55 * s);
        g.add(spike);
      }
    }
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
  bleed(dps, dur) { this.bleedDps += dps; this.bleedT = Math.max(this.bleedT, dur); }

  stepToward(tx, tz, speed, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      this.pos.x += dx / d * speed * dt;
      this.pos.z += dz / d * speed * dt;
      this.moving = true;
    }
    this.yaw = Math.atan2(dx, dz);
  }
  touchPlayer(mult = 1) {
    const P = this.game.player;
    if (P.dead || this.touchCd > 0 || this.dmg <= 0) return false;
    const dx = P.pos.x - this.pos.x, dz = P.pos.z - this.pos.z;
    if (dx * dx + dz * dz > 7.3) return false;
    this.touchCd = 1.1;
    P.takeDamage(this.dmg * mult * rand(0.9, 1.1), this.pos);
    this.game.audio.hit();
    return true;
  }

  // ---------- per-kind brains ----------
  kindAI(dt, P, dist, dir) {
    const K = this.kind;
    if (K === 'grunt' || K === 'splitter') {
      const reach = 2.4 * this.s;
      if (dist > reach) { this.stepToward(P.pos.x, P.pos.z, this.speed, dt); this.windup = 0; }
      else {
        this.yaw = Math.atan2(dir.x, dir.z);
        if (this.atkCd <= 0 && this.windup <= 0) this.windup = 0.45;
      }
    } else if (K === 'runner') {
      if (this.lungeFly > 0) {
        this.lungeFly -= dt;
        this.pos.x += this.lungeDir.x * 26 * dt;
        this.pos.z += this.lungeDir.z * 26 * dt;
        this.moving = true;
        this.touchPlayer(1.3);
      } else if (this.lungeTele > 0) {
        this.lungeTele -= dt;
        this.yaw = Math.atan2(dir.x, dir.z);
        if (this.lungeTele <= 0) {
          this.lungeDir.set(dir.x, 0, dir.z).normalize();
          this.lungeFly = 0.22; this.lungeCd = 2.8;
          this.flashT = Math.max(this.flashT, 0.15);
        }
      } else if (dist > 2.2) {
        this.stepToward(P.pos.x, P.pos.z, this.speed, dt);
        if (dist < 10 && dist > 3.5 && this.lungeCd <= 0) this.lungeTele = 0.28;
        this.touchPlayer(1);
      } else this.touchPlayer(1);
    } else if (K === 'brute') {
      if (this.slamT > 0) {
        this.slamT -= dt;
        this.yaw = Math.atan2(dir.x, dir.z);
        if (this.slamT <= 0) {
          this.slamCd = 2.8;
          const FX = this.game.effects;
          FX.ring(this.pos, { color: 0xff6600, maxR: 7, dur: 0.4 });
          FX.debris(this.pos, { count: 10, color: 0x8a7f70, speed: 12, scale: 0.6 });
          FX.burst(this.pos, { count: 16, color: [0xff6600, 0xffdd88], speed: 12, life: 0.5, size: 2 });
          this.game.audio.stomp();
          this.game.shakeFrom(this.pos, 0.3, 32);
          if (dist < 6.5) P.takeDamage(this.dmg * 1.5 * rand(0.9, 1.1), this.pos);
        }
      } else if (dist > 3.6 * this.s) this.stepToward(P.pos.x, P.pos.z, this.speed, dt);
      else {
        this.yaw = Math.atan2(dir.x, dir.z);
        if (this.slamCd <= 0) {
          this.slamT = 0.9;
          this.game.effects.ring(this.pos, { color: 0xff6600, maxR: 6.5, dur: 0.9 });
        } else this.touchPlayer(1);
      }
    } else if (K === 'spitter') {
      this.yaw = Math.atan2(dir.x, dir.z);
      const aiming = this.shotCd <= 0.45;
      if (!aiming) {
        if (dist > 24) this.stepToward(P.pos.x, P.pos.z, this.speed, dt);
        else if (dist < 13) {
          this.pos.x -= dir.x * this.speed * 0.8 * dt;
          this.pos.z -= dir.z * this.speed * 0.8 * dt;
          this.moving = true;
        } else {
          this.strafeT -= dt;
          if (this.strafeT <= 0) { this.strafeT = rand(1.2, 2.6); this.strafeDir *= -1; }
          this.pos.x += -dir.z * this.strafeDir * this.speed * 0.7 * dt;
          this.pos.z += dir.x * this.strafeDir * this.speed * 0.7 * dt;
          this.moving = true;
        }
      }
      if (this.shotCd <= 0 && dist < 34) {
        this.shootSpread(dir);
        this.shotCd = this.tier === 'boss' ? 1.3 : this.tier === 'elite' ? 1.7 : 2.4;
      }
    } else if (K === 'bomber') {
      if (this.fuseT >= 0) {
        // fusing: slow crawl + accelerating beeps + blinking core
        this.fuseT -= dt;
        this.stepToward(P.pos.x, P.pos.z, this.speed * 0.35, dt);
        this.beepT -= dt;
        if (this.beepT <= 0) { this.beepT = Math.max(0.05, this.fuseT * 0.3); this.game.audio.charge(1 - this.fuseT / 0.7); }
        if (this.core) this.core.material.color.setHex(Math.floor(this.game.time * 22) % 2 ? 0xffffff : 0xff2222);
        if (this.fuseT <= 0) this.detonate();
      } else {
        // zigzag rush
        this.zig = (this.zig || 0) + dt * 5;
        const px = -dir.z * Math.sin(this.zig) * 0.5;
        this.stepToward(P.pos.x + px * 4, P.pos.z - dir.x * Math.sin(this.zig) * 2, this.speed, dt);
        if (dist < 3.4) { this.fuseT = 0.7; this.beepT = 0; }
      }
    } else if (K === 'wraith') {
      this.trailT -= dt;
      if (this.trailT <= 0) {
        this.trailT = 0.12;
        this.game.effects.burst(_t2.set(this.pos.x, this.hoverY, this.pos.z), { count: 1, color: 0x3a6aa6, speed: 1, up: 0, life: 0.5, size: 2, gravity: 0, drag: 2 });
      }
      if (this.diveState === 'orbit') {
        this.hoverY += (6.5 - this.hoverY) * dt * 2;
        this.orbitA += dt * 0.85;
        this.stepToward(P.pos.x + Math.cos(this.orbitA) * 11, P.pos.z + Math.sin(this.orbitA) * 11, this.speed, dt);
        this.diveT -= dt;
        if (this.diveT <= 0 && dist < 20) { this.diveState = 'tele'; this.diveT2 = 0.5; }
      } else if (this.diveState === 'tele') {
        this.hoverY += (8 - this.hoverY) * dt * 4;
        this.yaw = Math.atan2(dir.x, dir.z);
        this.diveT2 -= dt;
        if (this.diveT2 <= 0) {
          this.diveState = 'dive'; this.diveT2 = 0.7;
          this.lungeDir.set(dir.x, 0, dir.z).normalize();
          this.game.audio.swing();
        }
      } else {
        this.hoverY += (1.4 - this.hoverY) * dt * 6;
        this.pos.x += this.lungeDir.x * 24 * dt;
        this.pos.z += this.lungeDir.z * 24 * dt;
        this.moving = true;
        this.touchPlayer(1.2);
        this.diveT2 -= dt;
        if (this.diveT2 <= 0) { this.diveState = 'orbit'; this.diveT = rand(2.5, 4.5); }
      }
    }
  }

  shootSpread(dir) {
    const n = this.tier === 'boss' ? 5 : this.tier === 'elite' ? 3 : 1;
    const base = Math.atan2(dir.x, dir.z);
    const from = this.pos.clone(); from.y = 1.8 * this.s;
    for (let i = 0; i < n; i++) {
      const a = base + (n === 1 ? 0 : (i - (n - 1) / 2) * 0.22);
      const d = new THREE.Vector3(Math.sin(a), -0.03, Math.cos(a));
      this.game.effects.fire('foebolt', from, d.multiplyScalar(26), {
        life: 3.2, hitR: 1.3, gravity: 0, spin: 5, foe: true, foeDmg: this.dmg,
        color: 0xff44ff, trail: { color: 0xff44ff, count: 2 },
      });
    }
    this.game.effects.burst(from, { count: 5, color: 0xff44ff, speed: 5, life: 0.3, size: 1.6, gravity: 0 });
    this.game.audio.shoot();
    if (this.muzzle) this.flashT = Math.max(this.flashT, 0.08);
  }

  detonate() {
    if (this.dead) return;
    this.fuseBoom = true; this.dead = true;
    const pct = this.tier === 'boss' ? 0.2 : this.tier === 'elite' ? 0.14 : 0.09;
    this.game.effects.explode(this.pos, {
      radius: 7.5, flat: 200, pct: 0.05, color: 0xff5533,
      shake: 0.45, hitPlayer: true, playerPct: pct, knock: 16, source: 'foe',
    });
    this.game.effects.debris(this.pos, { count: 14, color: 0xcc3333, speed: 12, scale: 0.6 });
  }

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
    this.fleeT -= dt; this.atkCd -= dt; this.touchCd -= dt; this.suckT -= dt; this.flashT -= dt;
    this.lungeCd -= dt; this.slamCd -= dt; this.shotCd -= dt;
    // knockback
    this.pos.addScaledVector(this.knockV, dt);
    this.knockV.multiplyScalar(Math.max(0, 1 - 5 * dt));
    // lift curve
    let liftY = 0;
    if (this.liftT > 0) {
      this.liftT -= dt;
      liftY = Math.sin((1 - this.liftT / this.liftDur) * Math.PI) * 6;
    }

    const toP = _t1.copy(P.pos).sub(this.pos).setY(0);
    const dist = toP.length();
    const dir = dist > 0.01 ? toP.multiplyScalar(1 / dist) : _t1.set(0, 0, 1);
    const canAct = !this.rooted && !P.dead;
    this.moving = false;

    if (canAct) {
      if (this.suckT > 0) {
        _t2.copy(this.suckPoint).sub(this.pos).setY(0);
        const d = _t2.length();
        if (d > 0.5) {
          _t2.multiplyScalar(1 / d);
          this.pos.x += _t2.x * this.suckSpeed * dt;
          this.pos.z += _t2.z * this.suckSpeed * dt;
          this.moving = true;
        }
        this.yaw = Math.atan2(_t2.x, _t2.z);
      } else if (this.fleeT > 0) {
        this.pos.x -= dir.x * this.speed * 1.2 * dt;
        this.pos.z -= dir.z * this.speed * 1.2 * dt;
        this.moving = true;
        this.yaw = Math.atan2(-dir.x, -dir.z);
      } else if (this.blindT > 0) {
        this.wanderT -= dt;
        if (this.wanderT <= 0) { this.wanderT = rand(0.5, 1.4); this.wanderA = rand(0, TAU); }
        this.pos.x += Math.sin(this.wanderA) * this.speed * 0.5 * dt;
        this.pos.z += Math.cos(this.wanderA) * this.speed * 0.5 * dt;
        this.moving = true;
        this.yaw = this.wanderA;
      } else {
        this.kindAI(dt, P, dist, dir);
        // shared melee windup resolution (grunt / splitter)
        if (this.windup > 0) {
          this.windup -= dt;
          if (this.armR) this.armR.rotation.x = -2.2 * (1 - this.windup / 0.45);
          if (this.windup <= 0) {
            this.atkCd = this.tier === 'boss' ? 2.2 : 1.5;
            if (this.armR) this.armR.rotation.x = 0.8;
            const reach = 3.4 * this.s;
            if (this.pos.distanceTo(P.pos) < reach + 1) {
              P.takeDamage(this.dmg * rand(0.85, 1.15), this.pos);
              this.game.audio.hit();
            }
            if (this.tier === 'boss') {
              this.game.effects.ring(this.pos, { color: 0xff2e4d, maxR: 8, dur: 0.4 });
              this.game.shakeFrom(this.pos, 0.25, 30);
            }
          }
        } else if (this.armR && this.kind !== 'spitter') this.armR.rotation.x *= 0.9;
      }
    }

    this.ph += dt * (this.moving ? 9 : 2);
    this.game.world.clampToArena(this.pos);
    this.mesh.position.x = this.pos.x; this.mesh.position.z = this.pos.z;
    this.mesh.position.y = (this.kind === 'wraith' ? this.hoverY : 0) + liftY;
    this.mesh.rotation.y = this.yaw;
    const w = Math.sin(this.ph) * (this.rooted ? 0.05 : 0.45);
    if (this.legL) this.legL.rotation.x = w;
    if (this.legR) this.legR.rotation.x = -w;
    if (this.kind === 'wraith') this.mesh.rotation.z = Math.sin(this.ph * 0.7) * 0.12;
    // bomber idle core pulse
    if (this.core && this.fuseT < 0) {
      const p = 1 + Math.sin(this.game.time * 5 + this.ph) * 0.15;
      this.core.scale.set(p, p, p);
    }
    // status visuals
    this.cage.visible = this.cageEdge.visible = this.imprisonT > 0;
    this.ice.visible = this.freezeT > 0;
    this.stunStar.visible = this.stunT > 0;
    if (this.stunStar.visible) this.stunStar.position.x = Math.sin(this.game.time * 8) * 0.7;
    if (this.flashT > 0) this.bodyMat.emissive.setHex(0xaaaaaa);
    else if (this.freezeT > 0) this.bodyMat.emissive.setHex(0x2266aa);
    else if (this.burnT > 0) this.bodyMat.emissive.setHex(0x661100);
    else if (this.tier !== 'normal') {
      const p = 0.3 + 0.28 * Math.sin(this.game.time * 5 + this.ph);
      this.bodyMat.emissive.setHex(this.tier === 'boss' ? 0xff2e4d : 0xffaa22).multiplyScalar(p);
    }
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
    if (!quiet) this.game.ui.damageNum(this.pos, amount, '');
    if (this.hp <= 0) { this.hp = 0; this.game.enemies.kill(this); }
    return amount;
  }

  dispose() { this.game.scene.remove(this.mesh); }
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
        this.skillCd = 5;
        this.game.effects.explode(this.pos, { radius: 40, flat: 500 * this.game.player.dmgMul(), pct: 0.04, color: 0xff2e4d, shake: 0.5, knock: 30, source: 'giant' });
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
    this.pending = []; // spawn portals
    this.kills = 0;
    this.spawnT = 0;
  }
  get aliveCount() { return this.list.filter(e => !e.dead).length; }

  pickKind(tier) {
    const w = this.game.wave;
    if (tier === 'boss') return choice(['brute', 'brute', 'spitter', 'wraith', 'splitter', 'grunt']);
    const pool = ['grunt', 'grunt', 'runner'];
    if (w >= 2) pool.push('spitter', 'runner');
    if (w >= 3) pool.push('bomber', 'bomber', 'runner');
    if (w >= 4) pool.push('brute', 'brute');
    if (w >= 5) pool.push('wraith', 'wraith');
    if (w >= 6) pool.push('splitter', 'splitter');
    return choice(pool);
  }

  spawn(tier, pos, kind = 'grunt', instant = false) {
    const cap = this.game.settings.get('enemyCap') + 10;
    if (this.list.length + this.pending.length >= cap) return null;
    if (!instant) {
      // spawn portal telegraph, enemy arrives shortly after
      this.pending.push({ t: 0.7, tier, kind, pos: pos.clone() });
      this.game.effects.ring(pos, { color: 0xb45cff, maxR: 3.5, dur: 0.7 });
      this.game.effects.beam(pos, { color: 0xb45cff, radius: 1.1, dur: 0.7 });
      this.game.effects.burst(pos.clone().setY(1), { count: 8, color: 0xb45cff, speed: 5, up: 8, life: 0.6, size: 2, gravity: -4 });
      return null;
    }
    return this._doSpawn(tier, kind, pos);
  }
  _doSpawn(tier, kind, pos) {
    const e = new Enemy(this.game, tier, kind, pos);
    this.list.push(e);
    this.game.effects.burst(pos.clone().setY(1), { count: 12, color: 0xb45cff, speed: 8, life: 0.5, size: 2 });
    if (tier === 'boss') {
      this.game.ui.announce(`👑 ${KIND[e.kind].name.toUpperCase()} BOSS INBOUND`, '#ff2e4d');
      this.game.audio.roar();
    }
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
    this.pending.length = 0;
    for (const a of this.allies) { a.dead = true; this.game.scene.remove(a.mesh); }
    this.allies.length = 0;
  }

  kill(e) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    const big = e.tier === 'boss' ? 2.5 : e.tier === 'elite' ? 1.5 : 1;
    const col = KIND[e.kind].color;
    this.game.effects.burst(e.pos.clone().setY(1.5), { count: Math.round(24 * big), color: [0xb45cff, col, 0xffffff], speed: 10, life: 0.7, size: 2.2 });
    this.game.effects.debris(e.pos, { count: Math.round(8 * big), color: col, speed: 10, scale: 0.5 });
    this.game.effects.glow(e.pos.clone().setY(2), col, 7 * big, 0.3, 10);
    this.game.audio.hit();
    this.game.player.heal(this.game.player.maxHp * 0.008);
    this.game.onEnemyKilled(e);
    // bomber chain: killed safely = small chain boom, no self-harm
    if (e.kind === 'bomber' && !e.fuseBoom) {
      this.game.effects.explode(e.pos, { radius: 5, flat: 120, pct: 0.02, color: 0xff5533, shake: 0.2, source: 'chain' });
    }
    // splitter babies
    if (e.kind === 'splitter') {
      const n = e.tier === 'boss' ? 4 : e.tier === 'elite' ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const p = e.pos.clone(); p.x += rand(-2, 2); p.z += rand(-2, 2);
        this.game.world.clampToArena(p);
        this.spawn('normal', p, 'runner', true);
      }
      this.game.effects.burst(e.pos.clone().setY(1), { count: 20, color: 0x7aa63a, speed: 10, life: 0.6, size: 2 });
    }
    if (e.tier === 'elite') this.game.hitstop(0.07);
    if (e.tier === 'boss') {
      this.game.hitstop(0.4);
      this.game.ui.flash('#ff2e4d', 0.35, 400);
      this.game.addKick(12);
      this.game.ui.announce('👑 BOSS SLAIN!', '#ffd94d');
      this.game.shakeFrom(e.pos, 0.6, 60);
      this.game.player.heal(this.game.player.maxHp * 0.25);
    }
    this.game.skills.onKill(e);
  }

  damage(e, flat, pct = 0, opts = {}) {
    if (!e || e.dead) return 0;
    let amount = flat + (pct || 0) * e.maxHp;
    if (opts.crit) amount *= 2;
    if (amount <= 0) return 0;
    if (opts.stun) e.stun(opts.stun);
    if (opts.freeze) e.freeze(opts.freeze);
    if (opts.imprison) e.imprison(opts.imprison);
    if (opts.blind) e.blind(opts.blind);
    if (opts.lift) e.lift(opts.lift);
    if (opts.knock && opts.from) e.knockback(opts.from, opts.knock);
    if (opts.burn) e.burn((opts.burnPct ?? 0.02) * e.maxHp, opts.burn);
    if (opts.bleed) e.bleed((opts.bleedPct ?? 0.01) * e.maxHp, opts.bleed);
    const ss = this.game.player.superState;
    if (ss && (opts.source === 'skill' || opts.source === 'm1' || opts.source === 'gun')) {
      if (ss.kind === 'ice') e.freeze(3); else e.burn(0.03 * e.maxHp, 3);
    }
    e.hp -= amount;
    e.flashT = Math.max(e.flashT, 0.09); // white hit-flash
    if (!opts.quiet) this.game.ui.damageNum(e.pos, amount, opts.crit ? 'crit' : '', opts.color);
    this.game.skills.onDamageDealt(e, amount);
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
      _t1.copy(e.pos).setY(e.mesh.position.y + 1.2).sub(from);
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
    if (this.spawnT <= 0 && this.aliveCount + this.pending.length < target) {
      this.spawnT = Math.max(0.25, 1.4 - g.wave * 0.06);
      const batch = 1 + Math.floor(g.wave / 3);
      for (let i = 0; i < batch && this.aliveCount + this.pending.length < target; i++) {
        const p = g.world.randomEdgePoint(new THREE.Vector3());
        if (p.distanceTo(g.player.pos) < 12) { p.x *= -0.7; p.z *= -0.7; }
        const roll = Math.random();
        const tier = roll < 0.02 + g.wave * 0.004 ? 'boss' : roll < 0.12 + g.wave * 0.01 ? 'elite' : 'normal';
        this.spawn(tier, p, this.pickKind(tier)); // arrives via portal
      }
    }
  }

  update(dt) {
    this.director(dt);
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i];
      p.t -= dt;
      if (p.t <= 0) { this.pending.splice(i, 1); this._doSpawn(p.tier, p.kind, p.pos); }
    }
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
