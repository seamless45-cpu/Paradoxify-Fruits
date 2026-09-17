// ---------- Player: avatar, movement, HP, buffs, M1 (sword/gun/punch) ----------
import * as THREE from 'three';
import { clamp, lerp, rand, randInt, TAU, angleLerp } from './utils.js';
import { FRUITS, SWORDS } from './config.js';

export class Player {
  constructor(game) {
    this.game = game;
    this.pos = new THREE.Vector3(0, 0, 18);
    this.vel = new THREE.Vector3();
    this.yaw = Math.PI; // facing arena center
    this.speed = 11;
    this.maxHp = 1000; this.hp = 1000;
    this.regenPct = 0.015;
    this.dead = false;
    this.invuln = 0;
    // equipment
    this.fruitId = 'gravity';
    this.swordId = 'gravityBlade';
    // M1 state
    this.m1Cd = 0; this.m1Combo = 0; this.m1ComboT = 0; this.endlag = 0;
    this.swingT = 0;
    // buffs
    this.buffs = []; // {id,label,css,t,dur}
    this.dmgBuff = 1; this.aoeBuff = 1; this.cdBuff = 1;
    this.superState = null; // {kind:'ice'|'hell', t}
    this.thorns = 0;
    // dash
    this.dashing = 0; this.dashDir = new THREE.Vector3();
    this.knockV = new THREE.Vector3();
  }

  fruit() { return this.fruitId ? FRUITS[this.fruitId] : null; }
  sword() { return this.swordId ? SWORDS[this.swordId] : null; }
  gun() { const f = this.fruit(); return f && f.gun ? f.gun : null; }
  dmgMul() { return this.dmgBuff * (this.superState ? 1 : 1); }
  aoeMul() { return this.aoeBuff; }
  cdMul() { return this.cdBuff; }

  build() {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color: 0x23203a, roughness: 0.8 });
    const accent = new THREE.MeshStandardMaterial({ color: 0xa64dff, emissive: 0x5a1aaa, roughness: 0.4 });
    // legs
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.9, 0.34), cloth);
    this.legR = this.legL.clone();
    this.legL.position.set(-0.22, 0.45, 0); this.legR.position.set(0.22, 0.45, 0);
    // torso
    this.torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.45), cloth);
    this.torso.position.y = 1.4;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.16, 0.49), accent);
    belt.position.y = 0.95; g.add(belt);
    // head
    this.head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), skin);
    this.head.position.y = 2.2;
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
    const eL = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.02), eyeMat);
    eL.position.set(-0.13, 2.22, 0.29); const eR = eL.clone(); eR.position.x = 0.13;
    // arms (pivot groups at shoulder)
    this.armR = new THREE.Group(); this.armR.position.set(0.55, 1.8, 0);
    const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.26), cloth);
    armMesh.position.y = -0.4; this.armR.add(armMesh);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.24, 0.24), skin);
    hand.position.y = -0.9; this.armR.add(hand);
    this.armL = this.armR.clone(); this.armL.position.x = -0.55;
    // sword in right hand
    this.swordMesh = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.2), new THREE.MeshStandardMaterial({ color: 0xdde6ff, metalness: 0.85, roughness: 0.25 }));
    blade.position.y = -1.85;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.08, 0.3), accent);
    guard.position.y = -1.0; this.swordMesh.add(blade, guard);
    this.bladeMat = blade.material;
    this.swordGlowMat = new THREE.MeshBasicMaterial({ color: 0xa64dff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
    const bladeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.75, 0.26), this.swordGlowMat);
    bladeGlow.position.y = -1.85; this.swordMesh.add(bladeGlow);
    this.armR.add(this.swordMesh);
    // gun in left hand (rifle)
    this.gunMesh = new THREE.Group();
    const gbody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.1), new THREE.MeshStandardMaterial({ color: 0x2a2a3a, metalness: 0.6, roughness: 0.4 }));
    const gtip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.3), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
    gtip.position.z = 0.65; this.gunMesh.add(gbody, gtip);
    this.gunTipMat = gtip.material;
    this.gunMesh.position.set(0, -0.9, 0.4);
    this.armL.add(this.gunMesh);
    g.add(this.legL, this.legR, this.torso, this.head, eL, eR, this.armR, this.armL);
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    // fruit aura
    this.auraMat = new THREE.SpriteMaterial({ color: 0xa64dff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
    this.aura = new THREE.Sprite(this.auraMat);
    this.aura.scale.set(3.2, 4.4, 1); this.aura.position.y = 1.4;
    g.add(this.aura);
    this.light = new THREE.PointLight(0xa64dff, 6, 14, 2);
    this.light.position.y = 2;
    g.add(this.light);
    this.mesh = g;
    this.game.scene.add(g);
    this.mesh.position.copy(this.pos);
    this.walkPh = 0;
    this.refreshGear();
  }

  refreshGear() {
    const f = this.fruit(), s = this.sword();
    const fc = f ? f.color : 0x888899;
    this.auraMat.color.setHex(fc);
    this.light.color.setHex(fc);
    this.aura.visible = !!f;
    this.swordMesh.visible = !!s;
    const hasGun = !!this.gun();
    this.gunMesh.visible = hasGun;
    if (hasGun) this.gunTipMat.color.setHex(this.gun().color);
    if (s) this.swordGlowMat.color.setHex(s.color);
    if (!this.game.ui) return; // UI builds after player
    this.game.ui.refreshM1();
    this.game.ui.refreshSlots();
    this.game.ui.refreshSkillRows();
  }

  equipFruit(id) {
    this.fruitId = id;
    this.game.skills.onEquipChanged();
    this.refreshGear();
    const f = this.fruit();
    this.game.ui.announce(f ? `${f.icon} ${f.name} EQUIPPED` : 'FRUIT UNEQUIPPED', f ? f.css : '#888');
  }
  equipSword(id) {
    this.swordId = id;
    this.game.skills.onEquipChanged();
    this.refreshGear();
    const s = this.sword();
    this.game.ui.announce(s ? `${s.icon} ${s.name} EQUIPPED` : 'SWORD UNEQUIPPED', s ? s.css : '#888');
  }

  addBuff(id, label, css, dur, apply) {
    let b = this.buffs.find(b => b.id === id);
    if (!b) { b = { id, label, css, t: 0, dur, apply }; this.buffs.push(b); }
    else { b.t = 0; b.dur = dur; }
    this.game.ui.refreshBuffs();
  }
  hasBuff(id) { return this.buffs.some(b => b.id === id); }

  takeDamage(amount, fromPos) {
    if (this.dead || this.invuln > 0 || amount <= 0) return;
    this.hp -= amount;
    this.game.ui.damageNum(this.pos, amount, 'hurt');
    this.game.ui.pulseLowHp(this.hp / this.maxHp);
    // alarm buffer thorns
    if (this.thorns > 0 && fromPos) {
      this.game.enemies.damageInRadius(fromPos, 6, 0, this.thorns, { color: 0xff5a5a, source: 'thorns', from: this.pos });
      this.game.effects.strike(fromPos, { color: 0xff5a5a, count: 2, radius: 1, flat: 0, sound: false, shake: 0 });
    }
    if (this.hp <= 0) { this.hp = 0; this.die(); }
  }
  heal(amount) {
    if (this.dead) return;
    this.hp = clamp(this.hp + amount, 0, this.maxHp);
  }
  die() {
    this.dead = true;
    this.game.recordBest();
    this.game.audio.die();
    this.game.effects.burst(this.pos, { count: 60, color: [0xff3b5c, 0xffffff], speed: 14, life: 1.2, size: 2.6 });
    this.game.ui.showDeath();
  }
  respawn() {
    this.dead = false; this.hp = this.maxHp;
    this.pos.set(0, 0, 18); this.vel.set(0, 0, 0);
    this.invuln = 2;
    this.game.enemies.clearAll();
    this.game.ui.hideDeath();
    this.game.audio.heal();
  }

  // ---------- M1 ----------
  m1Kind() {
    if (this.sword()) return 'sword';
    if (this.gun()) return 'gun';
    return 'punch';
  }
  tryM1() {
    if (this.dead || this.m1Cd > 0 || this.endlag > 0 || this.dashing > 0) return;
    const kind = this.m1Kind();
    if (kind === 'sword') this.swordM1();
    else if (kind === 'gun') this.gunFire();
    else this.punch();
  }
  faceAim() {
    const aim = this.game.aimPoint;
    const dx = aim.x - this.pos.x, dz = aim.z - this.pos.z;
    if (dx * dx + dz * dz > 0.04) this.yaw = Math.atan2(dx, dz);
  }

  swordM1() {
    const s = this.sword();
    this.faceAim();
    this.m1Cd = s.m1.cd;
    this.m1Combo++; this.m1ComboT = 1.2;
    this.swingT = 0.22;
    this.game.audio.swing();
    // swing arc visual + damage
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const hitPos = this.pos.clone().addScaledVector(fwd, 2.6);
    this.game.effects.ring(hitPos, { color: s.color, maxR: 4.2, dur: 0.25 });
    this.game.effects.burst(hitPos, { count: 8, color: [s.color, 0xffffff], speed: 9, up: 4, life: 0.35, size: 1.8 });
    const flat = s.m1.flat * this.dmgMul();
    this.game.enemies.damageInRadius(hitPos, 4.2, flat, 0.008, { color: s.color, source: 'm1', from: this.pos });
    this.endlag = s.m1.endlag;
    // per-sword M1 passives
    if (s.id === 'gravityBlade' && this.m1Combo % 4 === 0) {
      const n = randInt(6, 24);
      for (let i = 0; i < n; i++) {
        const p = hitPos.clone(); p.x += rand(-6, 6); p.z += rand(-6, 6);
        this.game.effects.strike(p, { color: 0xa64dff, count: 1, radius: 2.5, flat: 30 * this.dmgMul(), pct: 0.004, sound: false, shake: 0.02, thick: 0.7, height: 40 });
      }
      this.game.audio.thunder();
    }
    if (s.id === 'pole' && this.m1Combo % 4 === 0) {
      const e = this.game.enemies.nearest(this.pos, 12);
      const p = e ? e.pos : hitPos;
      this.game.effects.strike(p, { color: 0x33ccff, count: 2, radius: 3, flat: 40 * this.dmgMul(), pct: 0.006, thick: 0.7, height: 40 });
    }
    if (s.id === 'bisento') {
      this.game.effects.cracks(hitPos, { color: 0x44ddff, count: 3, scale: 0.5, life: 0.4 });
    }
    if (s.id === 'alarmSword' && this.m1Combo % 3 === 0) {
      // every 3 hits: 6 red beams imprison 4 random enemies 3s
      const targets = this.game.enemies.random(4, 45);
      for (const e of targets) {
        this.game.effects.beam(e.pos, { color: 0xff2e4d, radius: 1.4, dur: 0.7 });
        e.imprison(3);
        this.game.enemies.damage(e, 60 * this.dmgMul(), 0.01, { color: 0xff2e4d, source: 'm1' });
      }
      for (let i = 0; i < 2; i++) {
        const p = hitPos.clone(); p.x += rand(-8, 8); p.z += rand(-8, 8);
        this.game.effects.beam(p, { color: 0xff2e4d, radius: 1, dur: 0.5 });
      }
      this.game.audio.zap();
    }
  }

  gunFire() {
    const gun = this.gun();
    if (!gun) return;
    let cd = gun.fireCd;
    if (this.superState) cd *= (this.superState.kind === 'ice' ? 0.25 : 0.23);
    this.m1Cd = cd;
    this.faceAim();
    this.swingT = 0.12;
    this.game.audio.shoot();
    // ultra-precise auto-aim: nearest enemy to aim ray within range
    const aim = this.game.aimPoint;
    const e = this.game.enemies.nearest(aim, 12) || this.game.enemies.nearest(this.pos, 55);
    const from = this.pos.clone(); from.y = 1.6;
    const targetPos = e ? e.pos.clone().setY(1.4) : new THREE.Vector3(aim.x, 1.2, aim.z);
    const dir = targetPos.sub(from).normalize();
    const isIce = this.fruitId === 'rimefracture';
    // muzzle flash
    this.game.effects.burst(from.clone().addScaledVector(dir, 1.2), { count: 4, color: gun.color, speed: 4, life: 0.2, size: 1.6, gravity: 0 });
    // tracer
    this.game.effects.addZone({
      life: 0.08,
      update: (dt, z) => { z.life -= dt; return z.life > 0; },
    });
    // instant precise hit
    const superMul = this.superState ? (isIce ? 7253.25 : 12501) : 1;
    const flat = gun.flat * superMul * this.dmgMul();
    let hitEnemy = e;
    if (!hitEnemy) {
      // check anything along the ray up to 60m
      hitEnemy = this.game.enemies.rayHit(from, dir, 60);
    }
    if (hitEnemy) {
      // execute bonus (wildfire)
      let mul = 1, aoeMul = 1;
      if (gun.executePct && hitEnemy.hp / hitEnemy.maxHp < gun.executePct) { mul = gun.executeMult; aoeMul = gun.executeAoe; }
      const proc = Math.random() < gun.proc;
      if (proc) {
        // giant elemental ball explosion + fragments
        const hp = hitEnemy.pos.clone();
        this.game.effects.explode(hp, {
          radius: gun.procRadius * aoeMul, flat: flat * gun.procMult * mul, pct: 0.05 * mul,
          color: gun.color, shake: 0.3, stun: 0, burn: isIce ? 0 : 2, freeze: isIce ? 1 : 0,
        });
        // flying fragments
        for (let i = 0; i < 10; i++) {
          const a = rand(0, TAU);
          this.game.effects.fire(isIce ? 'icicle' : 'fireball', hp.clone().setY(2),
            new THREE.Vector3(Math.cos(a) * gun.fragSpeed * 0.25, rand(4, 14), Math.sin(a) * gun.fragSpeed * 0.25),
            { gravity: 20, life: 1.4, hitR: 2, radius: 5, flat: flat * 2 * mul, pct: 0.01, color: gun.color, trail: { color: gun.color } });
        }
        this.game.audio.explosion(1.4);
      } else {
        this.game.enemies.damage(hitEnemy, flat * mul, 0.002 * mul, { color: gun.color, source: 'gun', from: this.pos });
        this.game.effects.burst(hitEnemy.pos.clone().setY(1.5), { count: 5, color: gun.color, speed: 6, life: 0.3, size: 1.5 });
      }
    }
  }

  punch() {
    this.faceAim();
    this.m1Cd = 0.35;
    this.swingT = 0.18;
    this.game.audio.swing();
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const hitPos = this.pos.clone().addScaledVector(fwd, 2.2);
    this.game.enemies.damageInRadius(hitPos, 3, 25 * this.dmgMul(), 0.005, { color: 0xffffff, source: 'm1', from: this.pos, knock: 3 });
    this.game.effects.burst(hitPos, { count: 6, color: 0xffffff, speed: 7, life: 0.3, size: 1.5 });
  }

  dashTo(dir, dist, speed, dmgFlat, dmgPct, color) {
    this.dashDir.copy(dir).setY(0).normalize();
    this.dashing = dist / speed;
    this.dashSpeed = speed;
    this.dashDmg = { flat: dmgFlat, pct: dmgPct, color, hit: new Set() };
    this.invuln = Math.max(this.invuln, this.dashing + 0.05);
    this.game.audio.dash();
  }

  update(dt, input) {
    // timers
    this.m1Cd -= dt; this.endlag -= dt; this.invuln -= dt; this.swingT -= dt;
    this.m1ComboT -= dt;
    if (this.m1ComboT <= 0) this.m1Combo = 0;
    // buffs
    this.dmgBuff = 1; this.aoeBuff = 1; this.cdBuff = 1; this.thorns = 0;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      const b = this.buffs[i];
      b.t += dt;
      if (b.t >= b.dur) { this.buffs.splice(i, 1); this.game.ui.refreshBuffs(); continue; }
      if (b.apply) b.apply(this);
    }
    if (this.superState) {
      this.superState.t -= dt;
      if (this.superState.t <= 0) { this.superState = null; this.game.ui.refreshBuffs(); }
    }
    // regen
    if (!this.dead && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.maxHp * this.regenPct * dt);

    if (this.dead) { this.mesh.visible = false; return; }
    this.mesh.visible = true;

    // movement
    const sprint = input.sprint ? 1.35 : 1;
    if (this.dashing > 0) {
      this.dashing -= dt;
      this.pos.addScaledVector(this.dashDir, this.dashSpeed * dt);
      this.game.effects.burst(this.pos.clone().setY(1), { count: 3, color: this.dashDmg.color, speed: 3, life: 0.3, size: 2, gravity: 0 });
      // damage passed enemies
      for (const e of this.game.enemies.list) {
        if (e.dead || this.dashDmg.hit.has(e)) continue;
        if (e.pos.distanceToSquared(this.pos) < 9) {
          this.dashDmg.hit.add(e);
          this.game.enemies.damage(e, this.dashDmg.flat, this.dashDmg.pct, { color: this.dashDmg.color, source: 'dash', from: this.pos });
        }
      }
      this.yaw = Math.atan2(this.dashDir.x, this.dashDir.z);
    } else if (this.endlag <= 0) {
      const mx = (input.right ? 1 : 0) - (input.left ? 1 : 0) + input.joyX;
      const mz = (input.down ? 1 : 0) - (input.up ? 1 : 0) + input.joyZ;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        const cl = Math.min(1, len);
        this.pos.x += (mx / (len || 1)) * this.speed * sprint * cl * dt;
        this.pos.z += (mz / (len || 1)) * this.speed * sprint * cl * dt;
        this.walkPh += dt * 11 * cl;
      }
    }
    // knockback decay
    this.pos.addScaledVector(this.knockV, dt);
    this.knockV.multiplyScalar(Math.max(0, 1 - 6 * dt));
    this.game.world.clampToArena(this.pos);

    // face aim (desktop) / move dir handled by skills for mobile
    if (!this.game.isTouch || this.game.skills.aimLock > 0) this.faceAim();

    // animate mesh
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = angleLerp(this.mesh.rotation.y, this.yaw, dt * 14);
    const w = Math.sin(this.walkPh) * 0.5;
    this.legL.rotation.x = w; this.legR.rotation.x = -w;
    if (this.swingT > 0) {
      const k = 1 - this.swingT / 0.22;
      this.armR.rotation.x = lerp(-2.4, 0.9, k);
    } else {
      this.armR.rotation.x = lerp(this.armR.rotation.x, -w * 0.6, dt * 10);
    }
    this.armL.rotation.x = lerp(this.armL.rotation.x, this.gunMesh.visible ? -1.35 : w * 0.6, dt * 10);
    this.gunMesh.rotation.x = 0;
    // aura pulse
    const f = this.fruit();
    this.aura.material.opacity = f ? 0.3 + Math.sin(this.game.time * 4) * 0.1 : 0;
    this.light.intensity = 5 + Math.sin(this.game.time * 4) * 2;
    // invuln blink
    this.mesh.traverse(o => { if (o.isMesh) o.visible = !(this.invuln > 0 && Math.floor(this.game.time * 14) % 2 === 0); });
    // sword charge glow (gravity blade superforce windup)
    this.swordGlowMat.opacity = lerp(this.swordGlowMat.opacity, this.game.skills.bladeGlow, dt * 8);
  }
}
