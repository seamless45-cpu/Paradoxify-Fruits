// ---------- Arena world: ground, sky, lights, decor ----------
import * as THREE from 'three';
import { TAU, rand } from './utils.js';

export class World {
  constructor(game) {
    this.game = game;
    this.arenaRadius = 62;
  }
  build() {
    const scene = this.game.scene;
    // --- lights ---
    this.hemi = new THREE.HemisphereLight(0x8a7dff, 0x1a1030, 0.75);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xcfd8ff, 1.6);
    this.sun.position.set(40, 70, 25);
    this.sun.castShadow = true;
    this.sun.shadow.camera.left = -75; this.sun.shadow.camera.right = 75;
    this.sun.shadow.camera.top = 75; this.sun.shadow.camera.bottom = -75;
    this.sun.shadow.camera.far = 220;
    this.sun.shadow.bias = -0.0004;
    scene.add(this.sun);
    this.rim = new THREE.DirectionalLight(0xb45cff, 0.5);
    this.rim.position.set(-50, 30, -40);
    scene.add(this.rim);

    // --- sky dome ---
    const skyGeo = new THREE.SphereGeometry(600, 24, 16);
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(0x05030f) }, mid: { value: new THREE.Color(0x1b0f3a) }, bot: { value: new THREE.Color(0x07060f) } },
      vertexShader: `varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec3 vP; uniform vec3 top,mid,bot;
        void main(){ float h=normalize(vP).y*0.5+0.5;
        vec3 c=mix(bot,mid,smoothstep(0.35,0.62,h)); c=mix(c,top,smoothstep(0.62,1.0,h));
        gl_FragColor=vec4(c,1.0);}`,
    });
    scene.add(new THREE.Mesh(skyGeo, skyMat));

    // --- stars ---
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(900 * 3);
    for (let i = 0; i < 900; i++) {
      const a = rand(0, TAU), e = rand(0.05, 1.4), r = 560;
      sp[i * 3] = Math.cos(a) * Math.cos(e) * r;
      sp[i * 3 + 1] = Math.sin(e) * r;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xbfd4ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 })));

    // --- ground: big dark plane + arena disc ---
    const plane = new THREE.Mesh(
      new THREE.CircleGeometry(590, 48),
      new THREE.MeshStandardMaterial({ color: 0x0a0818, roughness: 1, metalness: 0 })
    );
    plane.rotation.x = -Math.PI / 2; plane.position.y = -0.05;
    plane.receiveShadow = true;
    scene.add(plane);

    const R = this.arenaRadius;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(R, 72),
      new THREE.MeshStandardMaterial({ color: 0x17122e, roughness: 0.85, metalness: 0.25 })
    );
    disc.rotation.x = -Math.PI / 2; disc.receiveShadow = true;
    scene.add(disc);

    // grid rings on arena
    const grid = new THREE.PolarGridHelper(R, 8, 6, 48, 0x8a5cff, 0x2c2350);
    grid.position.y = 0.02;
    grid.material.transparent = true; grid.material.opacity = 0.5;
    scene.add(grid);

    // glowing edge ring
    const edge = new THREE.Mesh(
      new THREE.TorusGeometry(R, 0.5, 10, 120),
      new THREE.MeshBasicMaterial({ color: 0xb45cff })
    );
    edge.rotation.x = Math.PI / 2; edge.position.y = 0.4;
    scene.add(edge);
    this.edge = edge;

    // center marker (gravitational pressure target)
    const mid = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3, 48),
      new THREE.MeshBasicMaterial({ color: 0xa64dff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    mid.rotation.x = -Math.PI / 2; mid.position.y = 0.05;
    scene.add(mid);
    this.midRing = mid;
    const midDot = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 24),
      new THREE.MeshBasicMaterial({ color: 0xd9b8ff })
    );
    midDot.rotation.x = -Math.PI / 2; midDot.position.y = 0.05;
    scene.add(midDot);

    // --- floating crystals around arena ---
    this.crystals = [];
    const cmat = new THREE.MeshStandardMaterial({ color: 0x6a3aff, emissive: 0x3a1aaa, roughness: 0.3, metalness: 0.6 });
    const cmat2 = new THREE.MeshStandardMaterial({ color: 0x2ec8ff, emissive: 0x0a5a8a, roughness: 0.3, metalness: 0.6 });
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(rand(1.4, 3.2), 0), i % 2 ? cmat : cmat2);
      const rr = R + rand(8, 26);
      c.position.set(Math.cos(a) * rr, rand(2, 9), Math.sin(a) * rr);
      c.userData = { y: c.position.y, sp: rand(0.4, 1.2), ph: rand(0, TAU) };
      scene.add(c); this.crystals.push(c);
    }
    // --- pillars ---
    const pmat = new THREE.MeshStandardMaterial({ color: 0x241b45, roughness: 0.8 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const h = rand(6, 14);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.2, h, 6), pmat);
      p.position.set(Math.cos(a) * (R + 6), h / 2 - 0.5, Math.sin(a) * (R + 6));
      p.castShadow = true;
      scene.add(p);
      const cap = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), cmat2);
      cap.position.set(p.position.x, h + 0.6, p.position.z);
      cap.userData = { y: h + 0.6, sp: 1, ph: rand(0, TAU) };
      scene.add(cap); this.crystals.push(cap);
    }
    this.applySettings();
  }

  applySettings() {
    const s = this.game.settings;
    this.sun.castShadow = s.get('shadows');
    const size = s.get('shadowSize');
    if (this.sun.shadow.mapSize.x !== size) {
      this.sun.shadow.mapSize.set(size, size);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.game.scene.fog = new THREE.FogExp2(0x0a0618, s.get('fogDensity'));
  }

  clampToArena(pos, margin = 2) {
    const R = this.arenaRadius - margin;
    const d = Math.hypot(pos.x, pos.z);
    if (d > R) { pos.x *= R / d; pos.z *= R / d; }
    return pos;
  }
  randomEdgePoint(out, radius) {
    const a = rand(0, TAU), r = radius ?? this.arenaRadius - 3;
    out.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    return out;
  }

  update(dt, t) {
    for (const c of this.crystals) {
      c.position.y = c.userData.y + Math.sin(t * c.userData.sp + c.userData.ph) * 0.8;
      c.rotation.y += dt * 0.5;
    }
    const s = 1 + Math.sin(t * 2.2) * 0.06;
    this.midRing.scale.set(s, s, s);
    this.edge.material.color.setHSL(0.78 + Math.sin(t * 0.4) * 0.04, 0.9, 0.6);
  }
}
