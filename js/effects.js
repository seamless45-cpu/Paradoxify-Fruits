// ---------- Paradoxify Fruits: pooled VFX + damaging zones ----------
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { clamp, lerp, rand, randInt, choice, TAU, Pool } from './utils.js';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
const _m = new THREE.Matrix4(), _s = new THREE.Vector3(), _e = new THREE.Euler();
const _c = new THREE.Color();

function hexRGB(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }
function pickColor(c) { return Array.isArray(c) ? choice(c) : c; }

function buildBoltGeometry(height, segs, spread, radius) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const w = Math.sin(t * Math.PI) * 0.9 + 0.1;
    pts.push(new THREE.Vector3(rand(-spread, spread) * w, height * (1 - t), rand(-spread, spread) * w));
  }
  pts[0].x *= 0.15; pts[0].z *= 0.15;
  pts[segs].x *= 0.3; pts[segs].z *= 0.3;
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.max(0.001, a.distanceTo(b));
    const r = radius * (1 - 0.45 * (i / segs));
    const g = new THREE.CylinderGeometry(r * 0.65, r, len, 5, 1, true);
    g.translate(0, len / 2, 0);
    const dir = b.clone().sub(a).normalize();
    g.applyQuaternion(_q.setFromUnitVectors(up, dir));
    g.translate(a.x, a.y, a.z);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  geos.forEach(g => g.dispose());
  return merged;
}

function buildCrackGeometry(length, segs, spread) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(rand(-spread, spread) * t, 0.12, t * length));
  }
  const geos = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < segs; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.max(0.001, a.distanceTo(b));
    const r = 0.22 * (1 - 0.6 * (i / segs)) + 0.05;
    const g = new THREE.CylinderGeometry(r * 0.7, r, len, 4, 1, true);
    g.translate(0, len / 2, 0);
    const dir = b.clone().sub(a).normalize();
    g.applyQuaternion(_q.setFromUnitVectors(up, dir));
    g.translate(a.x, a.y, a.z);
    geos.push(g);
  }
  const merged = mergeGeometries(geos);
  geos.forEach(g => g.dispose());
  return merged;
}

export class Effects {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.matCache = new Map();
    this.spriteCache = new Map();
    this.zones = [];
    this.lightIdx = 0;
  }

  mat(color, opacity = 1) {
    const key = color + '_' + opacity;
    if (!this.matCache.has(key)) {
      this.matCache.set(key, new THREE.MeshBasicMaterial({
        color, transparent: opacity < 1 || true, opacity,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
    }
    return this.matCache.get(key);
  }
  solidMat(color) {
    const key = 's' + color;
    if (!this.matCache.has(key)) this.matCache.set(key, new THREE.MeshLambertMaterial({ color }));
    return this.matCache.get(key);
  }
  spriteMat(color) {
    if (!this.spriteCache.has(color)) {
      const cv = document.createElement('canvas'); cv.width = cv.height = 64;
      const ctx = cv.getContext('2d');
      const grd = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      const css = '#' + color.toString(16).padStart(6, '0');
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.35, css); grd.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grd; ctx.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(cv);
      this.spriteCache.set(color, new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    }
    return this.spriteCache.get(color);
  }

  init() {
    this.initParticles();
    this.initDebris();
    this.rebuildBoltVariants();
    this.initPools();
    // pooled point lights for big moments
    this.lights = [];
    for (let i = 0; i < 6; i++) {
      const L = new THREE.PointLight(0xffffff, 0, 60, 1.8);
      L.visible = false; this.scene.add(L);
      this.lights.push({ L, t: 0, dur: 0, peak: 0 });
    }
  }

  // ================= PARTICLES (single GPU point cloud) =================
  initParticles() {
    const cap = 9000;
    this.pCap = cap; this.pIdx = 0;
    this.pPos = new Float32Array(cap * 3);
    this.pCol = new Float32Array(cap * 3);
    this.pSize = new Float32Array(cap);
    this.pAlpha = new Float32Array(cap);
    this.pVel = new Float32Array(cap * 3);
    this.pLife = new Float32Array(cap);
    this.pMax = new Float32Array(cap);
    this.pGrav = new Float32Array(cap);
    this.pDrag = new Float32Array(cap);
    this.pSize0 = new Float32Array(cap);
    for (let i = 0; i < cap; i++) this.pPos[i * 3 + 1] = -999;
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(this.pPos, 3);
    this.aCol = new THREE.BufferAttribute(this.pCol, 3);
    this.aSize = new THREE.BufferAttribute(this.pSize, 1);
    this.aAlpha = new THREE.BufferAttribute(this.pAlpha, 1);
    geo.setAttribute('position', this.aPos);
    geo.setAttribute('aColor', this.aCol);
    geo.setAttribute('aSize', this.aSize);
    geo.setAttribute('aAlpha', this.aAlpha);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        varying vec3 vC; varying float vA;
        void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0);
        gl_PointSize = aSize*(260.0/max(1.0,-mv.z)); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 uv=gl_PointCoord-0.5; float d=length(uv);
        float m=smoothstep(0.5,0.06,d); if(m*vA<0.01) discard;
        gl_FragColor=vec4(vC, vA*m); }`,
    });
    this.pPoints = new THREE.Points(geo, mat);
    this.pPoints.frustumCulled = false;
    this.scene.add(this.pPoints);
  }

  spawnP(x, y, z, vx, vy, vz, life, size, hex, grav = 9, drag = 1.2) {
    const i = this.pIdx; this.pIdx = (this.pIdx + 1) % this.pCap;
    this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
    this.pVel[i * 3] = vx; this.pVel[i * 3 + 1] = vy; this.pVel[i * 3 + 2] = vz;
    const [r, g, b] = hexRGB(hex);
    this.pCol[i * 3] = r; this.pCol[i * 3 + 1] = g; this.pCol[i * 3 + 2] = b;
    this.pLife[i] = life; this.pMax[i] = life;
    this.pSize0[i] = size; this.pGrav[i] = grav; this.pDrag[i] = drag;
    this.pSize[i] = size; this.pAlpha[i] = 1;
  }

  burst(pos, { count = 30, color = 0xffaa33, speed = 12, up = 6, life = 0.8, size = 2.2, gravity = 12, drag = 1.5, dir = null, dirSpread = 1 } = {}) {
    const dens = this.game.settings.get('particleDensity');
    count = Math.max(1, Math.round(count * dens));
    for (let n = 0; n < count; n++) {
      let vx, vy, vz;
      if (dir) {
        vx = dir.x * speed + rand(-1, 1) * speed * dirSpread * 0.4;
        vy = dir.y * speed + rand(0, 1) * up;
        vz = dir.z * speed + rand(-1, 1) * speed * dirSpread * 0.4;
      } else {
        const a = rand(0, TAU), r = rand(0.2, 1) * speed;
        vx = Math.cos(a) * r; vz = Math.sin(a) * r; vy = rand(0, 1) * up + rand(-2, 3);
      }
      this.spawnP(pos.x + rand(-0.5, 0.5), pos.y + rand(0, 0.8), pos.z + rand(-0.5, 0.5),
        vx, vy, vz, life * rand(0.5, 1.2), size * rand(0.6, 1.4), pickColor(color), gravity, drag);
    }
  }

  updateParticles(dt) {
    const n = this.pCap;
    for (let i = 0; i < n; i++) {
      if (this.pLife[i] <= 0) continue;
      this.pLife[i] -= dt;
      const i3 = i * 3;
      if (this.pLife[i] <= 0) { this.pAlpha[i] = 0; this.pPos[i3 + 1] = -999; continue; }
      const dr = Math.max(0, 1 - this.pDrag[i] * dt);
      this.pVel[i3] *= dr; this.pVel[i3 + 2] *= dr;
      this.pVel[i3 + 1] = this.pVel[i3 + 1] * dr - this.pGrav[i] * dt;
      this.pPos[i3] += this.pVel[i3] * dt;
      this.pPos[i3 + 1] += this.pVel[i3 + 1] * dt;
      this.pPos[i3 + 2] += this.pVel[i3 + 2] * dt;
      if (this.pPos[i3 + 1] < 0.05) { this.pPos[i3 + 1] = 0.05; this.pVel[i3 + 1] *= -0.3; }
      const t = this.pLife[i] / this.pMax[i];
      this.pAlpha[i] = t < 0.6 ? t / 0.6 : 1;
      this.pSize[i] = this.pSize0[i] * (0.4 + 0.6 * t);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true;
    this.aSize.needsUpdate = true; this.aAlpha.needsUpdate = true;
  }

  // ================= DEBRIS (instanced chunks) =================
  initDebris() {
    const cap = 600;
    this.dCap = cap;
    this.dMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({}), cap);
    this.dMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.dMesh.frustumCulled = false;
    this.dMesh.castShadow = false;
    this.scene.add(this.dMesh);
    this.dPos = []; this.dVel = []; this.dRot = []; this.dRV = [];
    this.dLife = new Float32Array(cap); this.dMax = new Float32Array(cap); this.dScale = new Float32Array(cap);
    for (let i = 0; i < cap; i++) {
      this.dPos.push(new THREE.Vector3(0, -999, 0)); this.dVel.push(new THREE.Vector3());
      this.dRot.push(new THREE.Euler()); this.dRV.push(new THREE.Vector3());
      this.dMesh.setColorAt(i, _c.setHex(0xffffff));
      _m.makeScale(0, 0, 0); this.dMesh.setMatrixAt(i, _m);
    }
    this.dMesh.instanceColor.needsUpdate = true;
    this.dIdx = 0;
  }
  debris(pos, { count = 14, color = 0x8a7f70, speed = 14, up = 12, life = 2.2, scale = 0.7 } = {}) {
    const limit = this.game.settings.get('debrisLimit');
    const dens = this.game.settings.get('particleDensity');
    count = Math.round(count * clamp(dens, 0.3, 1.5));
    for (let n = 0; n < count; n++) {
      const i = this.dIdx; this.dIdx = (this.dIdx + 1) % this.dCap;
      if (i >= limit) continue;
      this.dPos[i].set(pos.x + rand(-1, 1), pos.y + rand(0, 1.5), pos.z + rand(-1, 1));
      const a = rand(0, TAU), r = rand(0.3, 1) * speed;
      this.dVel[i].set(Math.cos(a) * r, rand(0.3, 1) * up, Math.sin(a) * r);
      this.dRot[i].set(rand(0, TAU), rand(0, TAU), rand(0, TAU));
      this.dRV[i].set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
      this.dLife[i] = this.dMax[i] = life * rand(0.6, 1.3);
      this.dScale[i] = scale * rand(0.5, 1.4);
      this.dMesh.setColorAt(i, _c.setHex(pickColor(color)));
    }
    this.dMesh.instanceColor.needsUpdate = true;
  }
  updateDebris(dt) {
    for (let i = 0; i < this.dCap; i++) {
      if (this.dLife[i] <= 0) continue;
      this.dLife[i] -= dt;
      if (this.dLife[i] <= 0) { _m.makeScale(0, 0, 0); _m.setPosition(0, -999, 0); this.dMesh.setMatrixAt(i, _m); continue; }
      const v = this.dVel[i], p = this.dPos[i];
      v.y -= 26 * dt;
      p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt;
      if (p.y < 0.2) { p.y = 0.2; v.y *= -0.35; v.x *= 0.7; v.z *= 0.7; }
      const r = this.dRot[i], rv = this.dRV[i];
      r.x += rv.x * dt; r.y += rv.y * dt; r.z += rv.z * dt;
      const s = this.dScale[i] * clamp(this.dLife[i] / (this.dMax[i] * 0.25), 0, 1);
      _q.setFromEuler(r); _s.set(s, s, s);
      _m.compose(p, _q, _s);
      this.dMesh.setMatrixAt(i, _m);
    }
    this.dMesh.instanceMatrix.needsUpdate = true;
  }

  // ================= BOLTS / CRACKS =================
  rebuildBoltVariants() {
    const hi = this.game.settings.get('boltDetail') === 1;
    if (this.boltGeos) this.boltGeos.forEach(g => g.dispose());
    if (this.crackGeos) this.crackGeos.forEach(g => g.dispose());
    const segs = hi ? 26 : 12;
    this.boltGeos = [];
    for (let i = 0; i < 6; i++) this.boltGeos.push(buildBoltGeometry(55, segs, 3.2, 0.55));
    this.crackGeos = [];
    for (let i = 0; i < 4; i++) this.crackGeos.push(buildCrackGeometry(11, hi ? 14 : 8, 2.2));
  }

  initPools() {
    const S = this.scene;
    // bolts
    this.boltPool = new Pool(() => {
      const m = new THREE.Mesh(this.boltGeos[0], this.mat(0xa64dff));
      m.visible = false; m.frustumCulled = false; S.add(m);
      return { mesh: m, life: 0, max: 1 };
    }, o => { o.mesh.visible = false; o.life = 0; }, 170);
    // cracks
    this.crackPool = new Pool(() => {
      const m = new THREE.Mesh(this.crackGeos[0], this.mat(0x44ddff));
      m.visible = false; S.add(m);
      return { mesh: m, life: 0, max: 1 };
    }, o => { o.mesh.visible = false; o.life = 0; }, 90);
    // glow sprites
    this.glowPool = new Pool(() => {
      const s = new THREE.Sprite(this.spriteMat(0xffffff));
      s.visible = false; S.add(s);
      return { s, life: 0, max: 1, grow: 0, fade: true };
    }, o => { o.s.visible = false; o.life = 0; }, 90);
    // rings (flat)
    const ringGeo = new THREE.RingGeometry(0.82, 1, 56);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringGeo = ringGeo;
    this.ringPool = new Pool(() => {
      const m = new THREE.Mesh(ringGeo, this.mat(0xffffff).clone());
      m.visible = false; S.add(m);
      return { mesh: m, life: 0, max: 1, maxR: 8, y: 0.3 };
    }, o => { o.mesh.visible = false; o.life = 0; }, 48);
    // pillars
    this.pillarPool = new Pool(() => {
      const g = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 60, 12, 1, true), this.mat(0xa64dff).clone());
      cyl.position.y = 30; g.add(cyl);
      const rings = [];
      for (let i = 0; i < 6; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(2.2 + i * 0.35, 0.22, 8, 32), this.mat(0xa64dff).clone());
        t.rotation.x = Math.PI / 2; t.position.y = 3 + i * 5; g.add(t); rings.push(t);
      }
      g.visible = false; S.add(g);
      return { g, cyl, rings, life: 0, max: 1 };
    }, o => { o.g.visible = false; o.life = 0; }, 10);
    // tall beams
    this.beamPool = new Pool(() => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 70, 10, 1, true), this.mat(0xff2e4d).clone());
      m.visible = false; m.frustumCulled = false; S.add(m);
      return { mesh: m, life: 0, max: 1 };
    }, o => { o.mesh.visible = false; o.life = 0; }, 26);
    // shockwave shells
    this.shellPool = new Pool(() => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.frustumCulled = false; S.add(m);
      return { mesh: m, life: 0, max: 1, maxR: 10 };
    }, o => { o.mesh.visible = false; o.life = 0; }, 14);
    // pits
    const pitGeo = new THREE.CircleGeometry(1, 40); pitGeo.rotateX(-Math.PI / 2);
    this.pitPool = new Pool(() => {
      const m = new THREE.Mesh(pitGeo, new THREE.MeshBasicMaterial({ color: 0xff6a00, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      m.visible = false; S.add(m);
      return { mesh: m, life: 0, max: 1, r: 8, tick: 1, timer: 0, flat: 0, pct: 0, color: 0xff6a00, ptimer: 0, burn: 0, freeze: false, owner: null };
    }, o => { o.mesh.visible = false; o.life = 0; }, 26);
    // tsunamis
    this.tsuPool = new Pool(() => {
      const g = new THREE.Group();
      const wall = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2e9dff, transparent: true, opacity: 0.72 }));
      const crest = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.85 }));
      g.add(wall); g.add(crest); g.visible = false; S.add(g);
      return { g, wall, crest, life: 0, dir: new THREE.Vector3(), speed: 20, dist: 0, maxDist: 130, flat: 0, pct: 0, hits: new Map(), w: 20, h: 9 };
    }, o => { o.g.visible = false; o.life = 0; o.hits.clear(); }, 18);
    // projectiles (mesh per kind, created lazily)
    this.projPool = new Pool(() => ({ mesh: null, kind: '', active: false }), null, 150);
    this.projKindMesh = {};
    this.activeProjs = [];
  }

  projMesh(kind) {
    if (this.projKindMesh[kind]) return this.projKindMesh[kind];
    let m;
    const glow = (hex, s) => { const sp = new THREE.Sprite(this.spriteMat(hex)); sp.scale.set(s, s, 1); return sp; };
    switch (kind) {
      case 'beast': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), this.mat(0x33ccff)));
        m.children[0].add(glow(0x33ccff, 7)); break;
      case 'orb': m = new THREE.Mesh(new THREE.SphereGeometry(1.4, 14, 12), this.mat(0xbfeaff)); break;
      case 'quakeOrb': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), this.mat(0x44ddff)));
        m.children[0].add(glow(0x44ddff, 6)); break;
      case 'cloud': m = new THREE.Group();
        for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(this.spriteMat(0x222233)); sp.position.set(rand(-1.5, 1.5), rand(-0.6, 0.6), rand(-1, 1)); sp.scale.set(5, 3.4, 1); m.add(sp); }
        m.children[0].material = this.spriteMat(0x555566); break;
      case 'thundercloud': m = new THREE.Group();
        for (let i = 0; i < 3; i++) { const sp = new THREE.Sprite(this.spriteMat(0x1a1a2e)); sp.position.set(rand(-2, 2), rand(-0.8, 0.8), rand(-1.5, 1.5)); sp.scale.set(7, 4.4, 1); m.add(sp); }
        break;
      case 'fireball': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), this.mat(0xff8a2a)));
        m.children[0].add(glow(0xff6a00, 5)); break;
      case 'lava': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), this.solidMat(0x5a1e0a)));
        m.children[0].add(glow(0xff5a00, 8)); break;
      case 'icicle': m = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.4, 7), this.solidMat(0xbfefff)); break;
      case 'meteor': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), this.solidMat(0x6b5a4a)));
        m.children[0].add(glow(0xff7a2a, 5)); break;
      case 'asteroid': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.DodecahedronGeometry(2.6, 1), this.solidMat(0x5c4a3c)));
        m.children[0].add(glow(0xa64dff, 11)); break;
      case 'rock': m = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4, 0), this.solidMat(0x777788)); break;
      case 'slash': m = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.22, 6, 20, 2.4), this.mat(0xffffff)); break;
      case 'thunderball': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 12), new THREE.MeshBasicMaterial({ color: 0x050508 })));
        m.children[0].add(glow(0x33ccff, 9)); break;
      case 'bullet': m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), this.mat(0xffffff)); break;
      case 'laserbit': m = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 6), this.mat(0xff2e4d)); break;
      case 'foebolt': m = new THREE.Group();
        m.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), this.mat(0xff44ff)));
        m.children[0].add(glow(0xff44ff, 5)); break;
      default: m = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), this.mat(0xffffff));
    }
    this.projKindMesh[kind] = m;
    return m;
  }

  fire(kind, from, vel, opts = {}) {
    const p = this.projPool.obtain();
    if (!p) return null;
    const proto = this.projMesh(kind);
    if (!p.mesh || p.kind !== kind) {
      if (p.mesh) this.scene.remove(p.mesh);
      p.mesh = proto.clone();
      p.kind = kind;
      this.scene.add(p.mesh);
    }
    p.mesh.visible = true;
    p.mesh.position.copy(from);
    p.mesh.scale.setScalar(opts.scale || 1);
    Object.assign(p, {
      vel: vel.clone(), life: opts.life || 5, age: 0,
      gravity: opts.gravity ?? 0, radius: opts.radius ?? 6,
      flat: opts.flat || 0, pct: opts.pct || 0,
      color: opts.color ?? 0xffaa33, trail: opts.trail || null, trailT: 0,
      hitR: opts.hitR ?? 1.6, groundY: opts.groundY ?? 0.4,
      hitEnemy: opts.hitEnemy !== false, hitGround: opts.hitGround !== false,
      onHit: opts.onHit || null, onGround: opts.onGround || null, onTick: opts.onTick || null,
      target: opts.target || null, homing: opts.homing || 0,
      spin: opts.spin ?? 3, pierce: opts.pierce || false,
      foe: opts.foe || false, foeDmg: opts.foeDmg || 0,
      stun: opts.stun || 0, knock: opts.knock || 0, burn: opts.burn || 0, freeze: opts.freeze || 0,
      active: true, data: opts.data || {},
    });
    p.mesh.visible = true;
    this.activeProjs.push(p);
    return p;
  }

  updateProjectiles(dt) {
    const EM = this.game.enemies;
    for (let i = this.activeProjs.length - 1; i >= 0; i--) {
      const p = this.activeProjs[i];
      p.age += dt; p.life -= dt;
      let dead = p.life <= 0;
      if (!dead) {
        if (p.target && (p.target.dead || !p.target.mesh)) p.target = null;
        if (p.target && p.homing > 0) {
          _v1.copy(p.target.pos).setY(p.target.pos.y + 1.5).sub(p.mesh.position).normalize().multiplyScalar(p.vel.length());
          p.vel.lerp(_v1, clamp(p.homing * dt, 0, 1));
        }
        p.vel.y -= p.gravity * dt;
        p.mesh.position.addScaledVector(p.vel, dt);
        p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.y += p.spin * 0.7 * dt;
        if (p.trail && (p.trailT -= dt) <= 0) {
          p.trailT = p.trail.rate || 0.03;
          this.burst(p.mesh.position, { count: p.trail.count || 2, color: p.trail.color || p.color, speed: 2, up: 2, life: 0.4, size: 1.8, gravity: 0, drag: 2 });
        }
        if (p.onTick) p.onTick(p, dt);
        // hostile (enemy) projectile vs player
        if (p.foe) {
          const PP = this.game.player;
          if (!PP.dead && p.hitEnemy) {
            const dx = p.mesh.position.x - PP.pos.x, dz = p.mesh.position.z - PP.pos.z;
            const dy = p.mesh.position.y - 1.2;
            const rr = p.hitR + 0.9;
            if (dx * dx + dz * dz < rr * rr && Math.abs(dy) < 2.8) {
              PP.takeDamage(p.foeDmg || 20, p.mesh.position);
              this.burst(PP.pos.clone().setY(1.4), { count: 8, color: p.color || 0xff44ff, speed: 8, life: 0.4, size: 1.8 });
              if (p.onHit) p.onHit(p, null);
              dead = true;
            }
          }
        }
        // enemy collision
        else if (p.hitEnemy) {
          const e = EM.touching(p.mesh.position, p.hitR);
          if (e) {
            if (p.onHit) p.onHit(p, e); else {
              EM.damage(e, p.flat, p.pct, { color: p.color, knock: p.knock, stun: p.stun, burn: p.burn, freeze: p.freeze });
              this.burst(p.mesh.position, { count: 10, color: p.color, speed: 8, life: 0.4, size: 1.6 });
            }
            if (!p.pierce) dead = true;
          }
        }
        // ground collision
        if (!dead && p.hitGround && p.mesh.position.y <= p.groundY && p.vel.y < 0) {
          p.mesh.position.y = p.groundY;
          if (p.onGround) p.onGround(p);
          else if (p.foe) { this.burst(p.mesh.position, { count: 6, color: p.color || 0xff44ff, speed: 5, life: 0.35, size: 1.5 }); }
          else {
            this.explode(p.mesh.position, { radius: p.radius, flat: p.flat, pct: p.pct, color: p.color, stun: p.stun });
          }
          dead = true;
        }
      }
      if (dead) {
        p.mesh.visible = false; p.active = false;
        this.activeProjs.splice(i, 1);
        this.projPool.release(p);
      }
    }
  }

  // ================= LIGHTS =================
  flashLight(pos, color = 0xffaa33, peak = 60, dist = 55, dur = 0.35) {
    const o = this.lights[this.lightIdx++ % this.lights.length];
    o.L.position.copy(pos).y += 3;
    o.L.position.y = pos.y + 3;
    o.L.color.setHex(color); o.peak = peak; o.L.distance = dist;
    o.t = dur; o.dur = dur; o.L.visible = true; o.L.intensity = peak;
  }
  updateLights(dt) {
    for (const o of this.lights) {
      if (o.t <= 0) continue;
      o.t -= dt;
      if (o.t <= 0) { o.L.visible = false; o.L.intensity = 0; }
      else o.L.intensity = o.peak * (o.t / o.dur);
    }
  }

  // ================= HIGH-LEVEL VFX =================
  glow(pos, color, size = 8, life = 0.3, grow = 6) {
    if (!this.game.settings.get('glowSprites') && size > 4) size = 4;
    const o = this.glowPool.obtain(); if (!o) return;
    o.s.material = this.spriteMat(color);
    o.s.position.copy(pos); o.s.scale.set(size, size, 1);
    o.s.visible = true; o.life = o.max = life; o.grow = grow;
  }

  ring(pos, { color = 0xffffff, maxR = 10, dur = 0.5, y = 0.35 } = {}) {
    const o = this.ringPool.obtain(); if (!o) return;
    o.mesh.material.color.setHex(color);
    o.mesh.position.set(pos.x, y, pos.z);
    o.mesh.visible = true; o.life = o.max = dur; o.maxR = maxR;
  }

  shell(pos, { color = 0xffffff, maxR = 12, dur = 0.45, y = 1 } = {}) {
    const o = this.shellPool.obtain(); if (!o) return;
    o.mesh.material.color.setHex(color);
    o.mesh.position.set(pos.x, y, pos.z);
    o.mesh.visible = true; o.life = o.max = dur; o.maxR = maxR;
  }

  pillar(pos, { color = 0xa64dff, dur = 2.2 } = {}) {
    const o = this.pillarPool.obtain(); if (!o) return null;
    o.g.position.set(pos.x, 0, pos.z);
    o.cyl.material.color.setHex(color);
    o.rings.forEach(r => r.material.color.setHex(color));
    o.g.visible = true; o.life = o.max = dur;
    return o;
  }

  beam(pos, { color = 0xff2e4d, radius = 1.6, dur = 0.6, height = 70 } = {}) {
    const o = this.beamPool.obtain(); if (!o) return;
    o.mesh.material.color.setHex(color);
    o.mesh.position.set(pos.x, height / 2, pos.z);
    o.mesh.scale.set(radius, height / 70, radius);
    o.mesh.visible = true; o.life = o.max = dur;
  }

  bolt(pos, { color = 0xa64dff, height = 55, thick = 1, life = 0.28 } = {}) {
    const o = this.boltPool.obtain(); if (!o) return;
    o.mesh.geometry = choice(this.boltGeos);
    o.mesh.material = this.mat(color);
    o.mesh.position.set(pos.x, 0, pos.z);
    o.mesh.rotation.y = rand(0, TAU);
    o.thick = thick;
    o.mesh.scale.set(thick, height / 55, thick);
    o.mesh.visible = true; o.life = o.max = life * rand(0.8, 1.3);
  }

  cracks(pos, { color = 0x44ddff, count = 8, scale = 1, life = 0.8 } = {}) {
    for (let i = 0; i < count; i++) {
      const o = this.crackPool.obtain(); if (!o) return;
      o.mesh.geometry = choice(this.crackGeos);
      o.mesh.material = this.mat(color);
      o.mesh.position.set(pos.x, 0, pos.z);
      o.mesh.rotation.y = (i / count) * TAU + rand(-0.3, 0.3);
      o.mesh.scale.set(scale, 1, scale * rand(0.7, 1.4));
      o.mesh.visible = true; o.life = o.max = life * rand(0.7, 1.2);
    }
  }

  pit(pos, { radius = 8, dur = 10, tick = 0.5, flat = 0, pct = 0.03, color = 0xff6a00, burn = 0, freeze = false } = {}) {
    const o = this.pitPool.obtain(); if (!o) return null;
    o.mesh.material.color.setHex(color);
    o.mesh.position.set(pos.x, 0.15, pos.z);
    o.mesh.scale.set(radius, 1, radius);
    o.mesh.visible = true;
    o.life = o.max = dur; o.r = radius; o.tick = tick; o.timer = 0;
    o.flat = flat; o.pct = pct; o.color = color; o.burn = burn; o.freeze = freeze; o.ptimer = 0;
    return o;
  }

  tsunami(from, dir, { w = 22, h = 9, speed = 22, maxDist = 150, flat = 200, pct = 0.06, big = false } = {}) {
    const o = this.tsuPool.obtain(); if (!o) return;
    o.g.position.copy(from);
    o.g.rotation.y = Math.atan2(dir.x, dir.z);
    o.wall.scale.set(w, h, 3.2); o.wall.position.y = h / 2;
    o.crest.scale.set(w, 1.1, 3.8); o.crest.position.y = h + 0.3;
    o.wall.material.color.setHex(big ? 0x1e6dff : 0x2e9dff);
    o.g.visible = true;
    o.life = 30; o.dir.copy(dir); o.speed = speed; o.dist = 0; o.maxDist = maxDist;
    o.flat = flat; o.pct = pct; o.w = w; o.h = h;
  }

  addZone(zone) { zone.age = 0; this.zones.push(zone); return zone; }

  // ---- damage-dealing composites ----
  explode(pos, { radius = 8, flat = 100, pct = 0, color = 0xffaa33, shake = 0.3, shakeMax = 45, debris = true, ring = true, flash = true, cracks = false, crackColor = 0x44ddff, light = true, sound = true, stun = 0, knock = 0, burn = 0, freeze = 0, lift = false, falloff = true, hitPlayer = false, playerPct = 0, crit = false, source = 'skill' } = {}) {
    const g = this.game;
    const r = radius * g.player.aoeMul();
    g.enemies.damageInRadius(pos, r, flat * g.player.dmgMul(), pct, { falloff, color, stun, knock, burn, freeze, lift, crit, source, from: g.player.pos });
    if (hitPlayer && playerPct > 0) g.player.takeDamage(g.player.maxHp * playerPct, pos);
    // visuals
    this.burst(pos, { count: 26 + r * 2, color: [color, 0xffffff, 0xffdd88], speed: 8 + r * 0.7, up: 10 + r * 0.5, life: 0.9, size: 2.4 + r * 0.08, gravity: 14 });
    if (debris) this.debris(pos, { count: 8 + r * 0.9, color: [0x8a7f70, 0x5c4a3c, color], speed: 10 + r * 0.5, scale: 0.5 + r * 0.03 });
    if (ring) this.ring(pos, { color, maxR: r * 1.25, dur: 0.5 });
    if (flash) this.glow(_v1.set(pos.x, pos.y + 2, pos.z), color, 6 + r, 0.3, 20);
    this.shell(pos, { color: 0xffffff, maxR: r, dur: 0.35 });
    if (cracks) this.cracks(pos, { color: crackColor, count: 9, scale: r / 9, life: 0.9 });
    if (light) this.flashLight(pos, color, 40 + r * 3, 40 + r * 2);
    if (sound) g.audio.explosion(clamp(r / 12, 0.4, 2.4));
    g.shakeFrom(pos, shake, shakeMax);
  }

  strike(pos, { color = 0xa64dff, height = 55, count = 1, spread = 1.6, thick = 1, radius = 5, flat = 80, pct = 0, stun = 0, lift = false, burn = 0, freeze = false, shake = 0.12, shakeMax = 30, sound = true, crit = false, source = 'skill' } = {}) {
    const g = this.game;
    for (let i = 0; i < count; i++) {
      _v2.set(pos.x + rand(-spread, spread), 0, pos.z + rand(-spread, spread));
      this.bolt(_v2, { color, height, thick, life: 0.3 });
    }
    const r = radius * g.player.aoeMul();
    g.enemies.damageInRadius(pos, r, flat * g.player.dmgMul(), pct, { color, stun, lift, burn, freeze, crit, source, from: g.player.pos });
    this.ring(pos, { color, maxR: r * 1.4, dur: 0.4 });
    this.glow(_v1.set(pos.x, 2, pos.z), color, 8, 0.25, 14);
    this.burst(pos, { count: 14, color: [color, 0xffffff], speed: 10, up: 12, life: 0.5, size: 2, gravity: 10 });
    if (sound) { g.audio.zap(); if (count >= 3) g.audio.thunder(); }
    g.shakeFrom(pos, shake, shakeMax);
  }

  // ================= UPDATE =================
  update(dt) {
    this.updateParticles(dt);
    this.updateDebris(dt);
    this.updateProjectiles(dt);
    this.updateLights(dt);
    const S = this.scene;
    // bolts flicker
    for (const o of this.boltPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.boltPool.release(o); continue; }
      const t = o.life / o.max;
      const w = (o.thick || 1) * (0.75 + Math.random() * 0.5);
      o.mesh.scale.x = w; o.mesh.scale.z = w;
      o.mesh.visible = t > 0.15 && Math.random() > 0.3;
    }
    for (const o of this.crackPool.active) {
      o.life -= dt;
      if (o.life <= 0) this.crackPool.release(o);
    }
    for (const o of this.glowPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.glowPool.release(o); continue; }
      const t = o.life / o.max;
      const s = o.s.scale.x + o.grow * dt;
      o.s.scale.set(s, s, 1);
      o.s.material.opacity = 1; // shared mat; fade via scale only
      if (t < 0.3) { const k = t / 0.3; o.s.scale.set(s * k + 1, s * k + 1, 1); }
    }
    for (const o of this.ringPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.ringPool.release(o); continue; }
      const t = 1 - o.life / o.max;
      const r = Math.max(0.1, o.maxR * (0.15 + 0.85 * t));
      o.mesh.scale.set(r, 1, r);
      o.mesh.material.opacity = 1 - t;
    }
    for (const o of this.shellPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.shellPool.release(o); continue; }
      const t = 1 - o.life / o.max;
      const r = Math.max(0.1, o.maxR * t);
      o.mesh.scale.set(r, r * 0.7, r);
      o.mesh.material.opacity = 0.45 * (1 - t);
    }
    for (const o of this.pillarPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.pillarPool.release(o); continue; }
      const t = 1 - o.life / o.max;
      o.g.position.y = lerp(-46, 0, clamp(t * 4, 0, 1));
      o.rings.forEach((r, i) => { r.position.y = 3 + i * 5 + (t * 30 + i * 4) % 30; r.rotation.z += dt * 2; });
      const fade = o.life < 0.5 ? o.life / 0.5 : 1;
      o.cyl.material.opacity = 0.55 * fade;
      o.rings.forEach(r => r.material.opacity = 0.9 * fade);
    }
    for (const o of this.beamPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.beamPool.release(o); continue; }
      o.mesh.material.opacity = clamp(o.life / o.max, 0, 1);
    }
    // pits
    for (const o of this.pitPool.active) {
      o.life -= dt;
      if (o.life <= 0) { this.pitPool.release(o); continue; }
      const fade = clamp(o.life / 1.2, 0, 1) * clamp((o.max - o.life) / 0.3 + 0.2, 0, 1);
      o.mesh.material.opacity = 0.55 * fade;
      o.mesh.rotation.y += dt * 0.4;
      o.timer -= dt;
      if (o.timer <= 0) {
        o.timer = o.tick;
        this.game.enemies.damageInRadius(o.mesh.position, o.r, o.flat, o.pct, { color: o.color, burn: o.burn, freeze: o.freeze, source: 'pit', from: o.mesh.position, quiet: true });
      }
      o.ptimer -= dt;
      if (o.ptimer <= 0) {
        o.ptimer = 0.12;
        _v1.set(o.mesh.position.x + rand(-o.r, o.r) * 0.7, 0.3, o.mesh.position.z + rand(-o.r, o.r) * 0.7);
        this.burst(_v1, { count: 2, color: [o.color, 0xffdd88], speed: 1.5, up: 7, life: 0.7, size: 2, gravity: -4, drag: 1 });
      }
    }
    // tsunamis
    for (const o of this.tsuPool.active) {
      o.life -= dt;
      const step = o.speed * dt;
      o.g.position.addScaledVector(o.dir, step);
      o.dist += step;
      o.g.position.y = Math.sin(o.dist * 0.08) * 0.6;
      const now = this.game.time;
      for (const e of this.game.enemies.list) {
        if (e.dead) continue;
        _v1.copy(e.pos).sub(o.g.position);
        const fwd = _v1.dot(o.dir), side = Math.abs(_v1.x * o.dir.z - _v1.z * o.dir.x);
        if (Math.abs(fwd) < 3.5 && side < o.w / 2) {
          const last = o.hits.get(e) || -9;
          if (now - last > 0.6) {
            o.hits.set(e, now);
            this.game.enemies.damage(e, o.flat, o.pct, { color: 0x2e9dff, knock: 6, source: 'tsunami', from: o.g.position });
          }
        }
      }
      this.burst(o.g.position, { count: 3, color: [0x9fd8ff, 0xffffff], speed: 6, up: 8, life: 0.6, size: 2.4, gravity: 8 });
      if (o.life <= 0 || o.dist > o.maxDist) this.tsuPool.release(o);
    }
    // generic zones
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.age += dt;
      let alive = true;
      try { alive = z.update(dt, z) !== false; } catch (e) { console.error(e); alive = false; }
      if (!alive) { this.zones.splice(i, 1); if (z.dispose) { try { z.dispose(z); } catch (e) {} } }
    }
  }
}
