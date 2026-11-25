import * as THREE from 'three';
import atlasUrl from './art/fx-atlas.webp?url';

// Textured effects come from the Kenney Particle Pack (CC0), packed by scripts/build-fx-atlas.py.
export const CELL = { ring: 0, summon: 1, cross: 2, slash: 3, lightning: 4, flash: 5, sparkle: 6, muzzle: 7, smoke: 8, fire: 9, flame: 10, scorch: 11, glow: 12, swirl: 13, streak: 14, heart: 15 };
const ATLAS_GRID = 4;
let atlasTex = null;
function atlas() {
  if (!atlasTex) {
    atlasTex = new THREE.TextureLoader().load(atlasUrl);
    atlasTex.colorSpace = THREE.SRGBColorSpace;
  }
  return atlasTex;
}

// ---------------------------------------------------------------- textures
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export const TEX = {
  glow: canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,.75)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }),
  star: canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.2, 'rgba(255,255,255,.4)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2, rr = i % 2 ? s * 0.08 : s * 0.5;
      g.lineTo(s / 2 + Math.cos(a) * rr, s / 2 + Math.sin(a) * rr);
    }
    g.fill();
  }),
  petal: canvasTex(64, (g, s) => {
    g.translate(s / 2, s / 2); g.rotate(0.6);
    const r = g.createLinearGradient(0, -s * 0.4, 0, s * 0.4);
    r.addColorStop(0, '#ffe3ef'); r.addColorStop(1, '#ff8fbd');
    g.fillStyle = r;
    g.beginPath(); g.ellipse(0, 0, s * 0.2, s * 0.4, 0, 0, Math.PI * 2); g.fill();
  }),
  shadow: canvasTex(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, 'rgba(26,16,48,.55)'); r.addColorStop(0.6, 'rgba(26,16,48,.35)'); r.addColorStop(1, 'rgba(26,16,48,0)');
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  }),
};

// --------------------------------------------------------------- particles
/** CPU-simulated point sprites. One draw call per system. */
export class Particles {
  constructor(scene, cap, { texture = TEX.glow, additive = true, cell = -1 } = {}) {
    this.cap = cap; this.n = 0;
    this.pos = new Float32Array(cap * 3);
    this.col = new Float32Array(cap * 3);
    this.size = new Float32Array(cap);
    this.alpha = new Float32Array(cap);
    this.vel = new Float32Array(cap * 3);
    this.life = new Float32Array(cap);
    this.max = new Float32Array(cap);
    this.s0 = new Float32Array(cap);
    this.s1 = new Float32Array(cap);
    this.grav = new Float32Array(cap);
    this.drag = new Float32Array(cap);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    // cell >= 0 samples one cell of the FX atlas instead of a whole texture.
    this.uniforms = { map: { value: cell >= 0 ? atlas() : texture }, uScale: { value: 500 }, uCell: { value: new THREE.Vector2(cell % ATLAS_GRID, ATLAS_GRID - 1 - Math.floor(cell / ATLAS_GRID)) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: `
        attribute float size; attribute float alpha; attribute vec3 color;
        varying vec3 vC; varying float vA; uniform float uScale;
        void main() {
          vC = color; vA = alpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = size * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; uniform vec2 uCell; varying vec3 vC; varying float vA;
        void main() {
          vec2 uv = gl_PointCoord;
          ${cell >= 0 ? `uv = (uCell + vec2(uv.x, 1.0 - uv.y)) / ${ATLAS_GRID}.0;` : ''}
          vec4 t = texture2D(map, uv);
          gl_FragColor = vec4(vC * t.rgb, t.a * vA);
          ${additive ? 'gl_FragColor.rgb *= gl_FragColor.a;' : ''}
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
      blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, life, size, r, g, b, { grav = 0, drag = 0, sizeEnd = 0 } = {}) {
    if (this.n >= this.cap) return;
    const i = this.n++, i3 = i * 3;
    const P = this.pos, V = this.vel, C = this.col;
    P[i3] = x; P[i3 + 1] = y; P[i3 + 2] = z;
    V[i3] = vx; V[i3 + 1] = vy; V[i3 + 2] = vz;
    C[i3] = r; C[i3 + 1] = g; C[i3 + 2] = b;
    this.life[i] = this.max[i] = life;
    this.s0[i] = size; this.s1[i] = sizeEnd;
    this.grav[i] = grav; this.drag[i] = drag;
  }
  burst(x, y, z, count, { speed = 6, up = 3, life = 0.5, size = 0.5, color = [1, 1, 1], grav = -12, drag = 2, spread = 1, sizeEnd = 0 } = {}) {
    count = Math.ceil(count * Particles.budget);
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2, s = speed * (0.3 + Math.random() * 0.7);
      this.emit(x + (Math.random() - 0.5) * spread * 0.3, y, z + (Math.random() - 0.5) * spread * 0.3,
        Math.cos(a) * s, up * (0.4 + Math.random()), Math.sin(a) * s,
        life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.6), color[0], color[1], color[2], { grav, drag, sizeEnd });
    }
  }
  update(dt) {
    if (dt <= 0) return;
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._kill(i); continue; }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 2] *= d;
      this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.grav[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const t = this.life[i] / this.max[i];
      this.size[i] = this.s1[i] + (this.s0[i] - this.s1[i]) * t;
      this.alpha[i] = Math.min(1, t * 2.5);
      i++;
    }
    const g = this.geo, n = this.n;
    g.setDrawRange(0, n);
    // upload only the live part of each buffer
    for (const [k, w] of Particles.ATTRS) {
      const a = g.attributes[k];
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(1, n * w));
      a.needsUpdate = true;
    }
  }
  static ATTRS = [['position', 3], ['color', 3], ['size', 1], ['alpha', 1]];
  static budget = 1; // lowered by the auto-quality controller when frames get slow

  _kill(i) {
    const j = --this.n;
    if (i === j) return;
    const i3 = i * 3, j3 = j * 3, P = this.pos, V = this.vel, C = this.col;
    for (let k = 0; k < 3; k++) { P[i3 + k] = P[j3 + k]; V[i3 + k] = V[j3 + k]; C[i3 + k] = C[j3 + k]; }
    this.size[i] = this.size[j]; this.alpha[i] = this.alpha[j]; this.life[i] = this.life[j]; this.max[i] = this.max[j];
    this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.grav[i] = this.grav[j]; this.drag[i] = this.drag[j];
  }
}

class Pool {
  constructor(make, n) { this.items = Array.from({ length: n }, make); this.i = 0; }
  next() { const it = this.items[this.i]; this.i = (this.i + 1) % this.items.length; return it; }
}

// ------------------------------------------------------------ atlas sprites
/**
 * Instanced quads that show one atlas cell each: flat on the ground (rings, summoning circles,
 * slashes, scorch marks) or facing the camera (flashes, fireballs). Effects are animated on the
 * CPU and rewritten into the instance buffers every frame.
 */
class SpriteLayer {
  constructor(scene, cap, { billboard = false, additive = true, order = 0 } = {}) {
    this.cap = cap; this.list = [];
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.a = {
      iPos: new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3),
      iShape: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4), // width, height, rotation, cell
      iColor: new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4),
    };
    for (const [k, attr] of Object.entries(this.a)) { attr.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attr); }
    g.instanceCount = 0;
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: atlas() } },
      vertexShader: `
        attribute vec3 iPos; attribute vec4 iShape; attribute vec4 iColor;
        varying vec2 vUv; varying vec4 vColor;
        void main() {
          float c = cos(iShape.z), s = sin(iShape.z);
          vec2 p = vec2(position.x * iShape.x, position.y * iShape.y);
          p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
          float cell = iShape.w;
          vUv = (vec2(mod(cell, ${ATLAS_GRID}.0), ${ATLAS_GRID - 1}.0 - floor(cell / ${ATLAS_GRID}.0)) + uv) / ${ATLAS_GRID}.0;
          vColor = iColor;
          ${billboard
            ? 'vec4 mv = modelViewMatrix * vec4(iPos, 1.0); mv.xy += p; gl_Position = projectionMatrix * mv;'
            : 'gl_Position = projectionMatrix * modelViewMatrix * vec4(iPos + vec3(p.x, 0.0, -p.y), 1.0);'}
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec2 vUv; varying vec4 vColor;
        void main() {
          float a = texture2D(map, vUv).a * vColor.a;
          if (a < 0.004) discard;
          gl_FragColor = vec4(vColor.rgb * ${additive ? 'a' : '1.0'}, a);
        }`,
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = order;
    scene.add(this.mesh);
  }

  /** o: { cell, x, y, z, size | w/h, size1, rot, spin, color, alpha, dur, fadeIn, hold, grow } */
  add(o) {
    if (this.list.length >= this.cap) this.list.shift();
    const c = new THREE.Color(o.color ?? '#ffffff');
    this.list.push({ t: 0, rot: 0, spin: 0, alpha: 1, fadeIn: 0.06, hold: 0.3, glow: 1, ...o, c, w: o.w ?? o.size, h: o.h ?? o.size });
  }

  update(dt) {
    const P = this.a.iPos.array, S = this.a.iShape.array, C = this.a.iColor.array;
    let n = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      e.t += dt;
      const k = e.t / e.dur;
      if (k >= 1) continue;
      this.list[n] = e;
      // grow: ease-out from size to size1; alpha: quick fade-in, hold, then fade-out.
      const g = e.size1 != null ? 1 + (e.size1 / e.size - 1) * (1 - (1 - k) ** (e.ease ?? 2)) : 1;
      const a = e.alpha * Math.min(1, e.t / Math.max(1e-3, e.fadeIn)) * (k < e.hold ? 1 : 1 - (k - e.hold) / (1 - e.hold));
      const x = e.follow ? e.follow.x : e.x, z = e.follow ? e.follow.z : e.z;
      P[n * 3] = x; P[n * 3 + 1] = e.y; P[n * 3 + 2] = z;
      S[n * 4] = e.w * g; S[n * 4 + 1] = e.h * g; S[n * 4 + 2] = e.rot + e.spin * e.t; S[n * 4 + 3] = e.cell;
      C[n * 4] = e.c.r * e.glow; C[n * 4 + 1] = e.c.g * e.glow; C[n * 4 + 2] = e.c.b * e.glow; C[n * 4 + 3] = a;
      n++;
    }
    this.list.length = n;
    this.geo.instanceCount = n;
    for (const attr of Object.values(this.a)) { attr.clearUpdateRanges(); attr.addUpdateRange(0, Math.max(1, n * attr.itemSize)); attr.needsUpdate = true; }
  }

  clear() { this.list.length = 0; this.geo.instanceCount = 0; }
}

// --------------------------------------------------------------- the VFX hub
export class VFX {
  constructor(scene, camera) {
    this.scene = scene; this.camera = camera;
    this.sparks = new Particles(scene, 3000, { cell: CELL.sparkle });
    this.glow = new Particles(scene, 2500, { texture: TEX.glow });
    this.petals = new Particles(scene, 600, { texture: TEX.petal, additive: false });
    this.smoke = new Particles(scene, 400, { cell: CELL.smoke, additive: false });
    this.fire = new Particles(scene, 900, { cell: CELL.fire });
    this.decals = new SpriteLayer(scene, 60, { additive: false, order: -1 });
    this.ground = new SpriteLayer(scene, 220);
    this.flares = new SpriteLayer(scene, 260, { billboard: true, order: 2 });
    // Alpha-blended fireballs keep their orange on the bright meadow, where additive light washes out.
    this.fireballs = new SpriteLayer(scene, 120, { billboard: true, additive: false, order: 1 });
    this.live = [];

    this.bolts = new Pool(() => this._makeBolt(), 24);

    this.flashLight = new THREE.PointLight(0x9fd8ff, 0, 14, 1.5);
    scene.add(this.flashLight);

    // floating damage numbers (DOM, positioned by projecting world points)
    this.dmgLayer = document.getElementById('dmg-layer');
    this.nums = [];
    this.liveNums = 0;
    this.maxNums = 28;
    this._v = new THREE.Vector3();
    this._boltDir = new THREE.Vector3();
    this._boltCam = new THREE.Vector3();
    this._boltWidth = new THREE.Vector3();
    this._boltPerp = new THREE.Vector3();
    this._boltPoint = new THREE.Vector3();
  }

  /** Crescent sword trail on the ground plane, its bulge pointing along `angle`. */
  slash(x, y, z, angle, radius, color = '#ff6fae', dur = 0.28, flip = false) {
    const fx = Math.sin(angle) * radius * 0.25, fz = Math.cos(angle) * radius * 0.25;
    const w = radius * 2.3 * (flip ? -1 : 1);
    this.ground.add({ cell: CELL.slash, x: x + fx, y, z: z + fz, w, h: radius * 2.3, size: radius * 2.3, size1: radius * 2.6, rot: angle, color, dur, hold: 0.35, glow: 1.8 });
    this.ground.add({ cell: CELL.slash, x: x + fx * 1.1, y: y + 0.02, z: z + fz * 1.1, w: w * 0.92, h: radius * 2.1, size: radius * 2.1, size1: radius * 2.4, rot: angle, color: '#ffffff', alpha: 0.7, dur: dur * 0.7, hold: 0.2 });
  }

  /** Expanding shock ring on the ground (Kenney circle) with a soft glow inside. */
  ring(x, z, radius, color = '#ffd36e', dur = 0.5, y = 0.08) {
    this.ground.add({ cell: CELL.ring, x, y, z, size: 0.4, size1: radius * 2.15, color, dur, hold: 0.25, glow: 1.6 });
    this.ground.add({ cell: CELL.glow, x, y: y - 0.01, z, size: radius * 0.6, size1: radius * 1.9, color, alpha: 0.45, dur: dur * 0.8, hold: 0.1 });
  }

  /** Rotating summoning circle under a caster or a spell target. `follow` keeps it under a moving object. */
  magicCircle(x, z, radius, color = '#b48cff', dur = 0.8, follow = null) {
    this.ground.add({ cell: CELL.summon, x, y: 0.06, z, follow, size: radius * 0.5, size1: radius * 2, ease: 4, rot: Math.random() * 6.28, spin: 1.6, color, dur, fadeIn: 0.08, hold: 0.65, glow: 1.7 });
    this.ground.add({ cell: CELL.glow, x, y: 0.05, z, follow, size: radius * 1.8, color, alpha: 0.4, dur, hold: 0.6 });
  }

  /** Bright star flash where a spell leaves the hand or a projectile lands. */
  flash(x, y, z, color = '#ffffff', size = 1, dur = 0.22) {
    this.flares.add({ cell: CELL.cross, x, y, z, size: size * 0.5, size1: size * 1.4, rot: Math.random() * 0.6 - 0.3, spin: 2, color, dur, hold: 0.2, glow: 1.6 });
    this.flares.add({ cell: CELL.flash, x, y, z, size: size * 0.9, color: '#ffffff', alpha: 0.7, dur: dur * 0.6, hold: 0.1 });
  }

  /** Small sparkle on a hit. */
  hit(x, y, z, color = '#fff2a8', size = 0.9) {
    this.flares.add({ cell: CELL.sparkle, x, y, z, size: size * 0.4, size1: size, rot: Math.random() * 3, color, dur: 0.16, hold: 0.3, glow: 1.4 });
  }

  /** Muzzle flame from a crossbow or wand, lying along the shot direction. */
  muzzle(x, y, z, angle, color = '#ffe6a0', size = 1) {
    this.ground.add({ cell: CELL.muzzle, x: x + Math.sin(angle) * size * 0.35, y, z: z + Math.cos(angle) * size * 0.35, w: size * 0.7, h: size, size, rot: angle + Math.PI, color, dur: 0.12, hold: 0.3, glow: 1.6 });
  }

  /** Fireball: flash, rolling flames, shock ring, smoke and a scorch mark that fades. */
  explode(x, z, radius = 3, color = '#ff8a3c') {
    const r = Math.random;
    for (let i = 0; i < 5; i++) {
      const hot = i < 2;
      this.fireballs.add({ cell: i % 2 ? CELL.fire : CELL.smoke, x: x + (r() - 0.5) * radius * 0.6, y: 0.5 + r() * 0.7, z: z + (r() - 0.5) * radius * 0.6,
        size: radius * (hot ? 0.5 : 0.7), size1: radius * (hot ? 1.3 : 1.7) * (0.9 + r() * 0.3), rot: r() * 6.28, spin: (r() - 0.5) * 2.5,
        color: hot ? '#ffd257' : i === 4 ? '#7a5a4a' : color, alpha: 0.95, dur: 0.45 + r() * 0.25, fadeIn: 0.03, hold: 0.3 });
    }
    this.flares.add({ cell: CELL.flash, x, y: 1, z, size: radius * 0.8, size1: radius * 1.8, color: '#ffe9a8', dur: 0.2, hold: 0.1, glow: 1.2 });
    this.flares.add({ cell: CELL.flame, x, y: 0.9, z, size: radius * 0.6, size1: radius * 1.4, rot: r() * 6.28, color, dur: 0.35, hold: 0.2, glow: 1.3 });
    this.ground.add({ cell: CELL.ring, x, y: 0.1, z, size: 0.5, size1: radius * 2.5, color, dur: 0.38, hold: 0.2, glow: 1.5 });
    this.ground.add({ cell: CELL.glow, x, y: 0.09, z, size: radius * 2.2, color, alpha: 0.55, dur: 0.3, hold: 0.1 });
    this.decals.add({ cell: CELL.scorch, x, y: 0.03, z, size: radius * 1.5, rot: r() * 6.28, color: '#20140e', alpha: 0.5, dur: 2.6, fadeIn: 0.05, hold: 0.5 });
    const n = Math.ceil(6 * Particles.budget);
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28, s = radius * (0.6 + r());
      this.smoke.emit(x, 0.6 + r() * 0.6, z, Math.cos(a) * s, 1 + r() * 1.5, Math.sin(a) * s, 0.9 + r() * 0.5, radius * 0.6, 0.45, 0.4, 0.42, { grav: 1.2, drag: 3, sizeEnd: radius * 1.4 });
    }
    this.fire.burst(x, 0.5, z, 14, { speed: radius * 3, up: 3, life: 0.45, size: radius * 0.5, color: [1.6, 0.9, 0.4], grav: -2, drag: 4, sizeEnd: 0.1 });
    this.sparks.burst(x, 0.6, z, 18, { speed: radius * 4, up: 6, life: 0.5, size: 0.5, color: [1.8, 1.4, 0.8], grav: -14 });
    this.lightFlash(x, 1.5, z, color, 70);
  }

  _makeBolt() {
    const N = 12;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const side = [], along = [], idx = [];
    for (let i = 0; i < N; i++) { side.push(-1, 1); along.push(i / (N - 1), i / (N - 1)); if (i < N - 1) { const b = i * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); } }
    g.setAttribute('side', new THREE.Float32BufferAttribute(side, 1));
    g.setAttribute('along', new THREE.Float32BufferAttribute(along, 1));
    g.setIndex(idx);
    const mat = new THREE.ShaderMaterial({
      // The ribbon samples the Kenney lightning strip (atlas cell "lightning") along its length.
      uniforms: { uA: { value: 0 }, uColor: { value: new THREE.Color('#5fb8ff') }, map: { value: atlas() }, uSeed: { value: 0 } },
      vertexShader: `attribute float side; attribute float along; varying float vS; varying float vL;
        void main(){ vS = side; vL = along; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `uniform float uA; uniform vec3 uColor; uniform sampler2D map; uniform float uSeed; varying float vS; varying float vL;
        void main(){
          vec2 cell = vec2(${CELL.lightning % ATLAS_GRID}.0, ${ATLAS_GRID - 1 - Math.floor(CELL.lightning / ATLAS_GRID)}.0);
          float v = fract(vL * 0.999 + uSeed);
          float t = texture2D(map, (cell + vec2(vS * 0.5 + 0.5, v)) / ${ATLAS_GRID}.0).a;
          float halo = (1.0 - abs(vS)) * 0.35;
          vec3 c = mix(uColor, vec3(1.0), t * t);
          float a = (t + halo * halo) * uA;
          gl_FragColor = vec4(c * a * 2.4, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false; m.visible = false; m.N = N;
    this.scene.add(m);
    return m;
  }

  /** Jagged lightning ribbon from a to b. */
  bolt(a, b, { width = 0.5, jitter = 0.6, color = '#5fb8ff', dur = 0.22 } = {}) {
    const m = this.bolts.next();
    const N = m.N, p = m.geometry.attributes.position.array;
    const dir = this._boltDir.subVectors(b, a);
    const toCam = this._boltCam.subVectors(this.camera.position, a).normalize();
    const w = this._boltWidth.crossVectors(dir, toCam).normalize();
    const perp2 = this._boltPerp.crossVectors(dir, w).normalize();
    const pt = this._boltPoint;
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1);
      pt.copy(a).addScaledVector(dir, u);
      if (i > 0 && i < N - 1) {
        pt.addScaledVector(w, (Math.random() - 0.5) * jitter * 2).addScaledVector(perp2, (Math.random() - 0.5) * jitter);
      }
      const ww = width * (1 - u * 0.4);
      const j = i * 6;
      p[j] = pt.x - w.x * ww; p[j + 1] = pt.y - w.y * ww; p[j + 2] = pt.z - w.z * ww;
      p[j + 3] = pt.x + w.x * ww; p[j + 4] = pt.y + w.y * ww; p[j + 5] = pt.z + w.z * ww;
    }
    m.geometry.attributes.position.needsUpdate = true;
    m.material.uniforms.uColor.value.set(color);
    m.material.uniforms.uSeed.value = Math.random();
    m.visible = true;
    this._track(m, dur, (k) => { m.material.uniforms.uA.value = (1 - k) * 0.9; });
    this.flares.add({ cell: CELL.flash, x: b.x, y: b.y, z: b.z, size: width * 2.5, color, dur: dur * 0.9, hold: 0.2, glow: 1.5 });
  }

  lightFlash(x, y, z, color = 0x9fd8ff, intensity = 60) {
    if (this.calm !== false) return;
    this.flashLight.position.set(x, y, z);
    this.flashLight.color.set(color);
    this.flashLight.intensity = intensity;
  }

  number(x, y, z, value, kind = '') {
    if (this.showNumbers === false && kind !== 'heal' && kind !== 'player') return;
    if (this.liveNums >= this.maxNums && kind === '') return; // crits, heals and player damage always show
    let el = this.nums.find((n) => n.life <= 0);
    if (!el) {
      if (this.nums.length >= 48) return;
      const d = document.createElement('div');
      this.dmgLayer.appendChild(d);
      el = { d, life: 0 };
      this.nums.push(el);
    }
    el.d.className = 'dmg ' + kind;
    el.d.textContent = value;
    el.d.style.display = '';
    el.x = x + (Math.random() - 0.5) * 0.6; el.y = y; el.z = z;
    el.life = el.max = kind === 'crit' ? 0.9 : 0.7;
  }

  _track(obj, dur, fn) {
    // Reusing a visual must replace its old animation, otherwise an expired
    // animation can hide a freshly issued slash or lightning bolt.
    let entry = this.live.find((item) => item.obj === obj);
    if (entry) { entry.t = 0; entry.dur = dur; entry.fn = fn; }
    else this.live.push({ obj, t: 0, dur, fn });
    fn(0);
  }

  update(dt) {
    for (const p of [this.sparks, this.glow, this.petals, this.smoke, this.fire]) p.update(dt);
    for (const l of [this.decals, this.ground, this.fireballs, this.flares]) l.update(dt);
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i];
      l.t += dt;
      const k = Math.min(1, l.t / l.dur);
      l.fn(k);
      if (k >= 1) { l.obj.visible = false; this.live[i] = this.live[this.live.length - 1]; this.live.pop(); }
    }
    this.flashLight.intensity *= Math.exp(-dt * 14);

    const w = innerWidth, h = innerHeight;
    this.liveNums = 0;
    for (const n of this.nums) {
      if (n.life <= 0) continue;
      this.liveNums++;
      n.life -= dt;
      if (n.life <= 0) { n.d.style.display = 'none'; continue; }
      const k = 1 - n.life / n.max;
      this._v.set(n.x, n.y + k * 1.2, n.z).project(this.camera);
      const sx = (this._v.x * 0.5 + 0.5) * w, sy = (-this._v.y * 0.5 + 0.5) * h;
      const sc = k < 0.15 ? 0.6 + k / 0.15 * 0.7 : 1.3 - Math.min(0.3, (k - 0.15) * 1.5);
      n.d.style.transform = `translate3d(${sx | 0}px, ${sy | 0}px, 0) translate(-50%, -50%) scale(${sc.toFixed(2)})`;
      if (k > 0.7) n.d.style.opacity = (1 - k) / 0.3; else if (n.d.style.opacity !== '1') n.d.style.opacity = 1;
    }
  }

  clear() {
    for (const p of [this.sparks, this.glow, this.petals, this.smoke, this.fire]) { p.n = 0; p.geo.setDrawRange(0, 0); }
    for (const l of [this.decals, this.ground, this.fireballs, this.flares]) l.clear();
    for (const entry of this.live) entry.obj.visible = false;
    this.live.length = 0;
    for (const n of this.nums) { n.life = 0; n.d.style.display = 'none'; }
    this.liveNums = 0; this.flashLight.intensity = 0;
  }

  setScale(px) { for (const p of [this.sparks, this.glow, this.petals, this.smoke, this.fire]) p.uniforms.uScale.value = px; }
}
