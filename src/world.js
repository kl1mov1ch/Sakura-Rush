import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { bakeMerged, InstancedModel } from './assets.js';
import { TEX, Particles } from './vfx.js';

const TILE = 112; // repeats remain beyond the fog and camera, including maximum zoom

// Bright storybook Japan: KayKit trees and rocks (CC0), sakura variants, torii and lanterns.
// `biomes` lists where a prop grows; `solid` is the collider radius (trunk, rock, post) at scale 1,
// `pillars` splits it into the two posts of a torii gate.
const DECOR = [
  { name: 'kk_sakura', count: 30, height: 4.4, scale: [.85, 1.25], clear: 9, solid: .45, wind: .02, biomes: ['sakura', 'bloodmoon', 'endless', 'ember'] },
  { name: 'kk_sakura_grove', count: 7, height: 4.6, scale: [.9, 1.15], clear: 14, solid: 1.3, wind: .012, biomes: ['sakura', 'bloodmoon', 'endless'] },
  { name: 'kk_tree', count: 22, height: 4.0, scale: [.8, 1.2], clear: 9, solid: .45, wind: .018, biomes: ['sakura', 'bamboo', 'ember', 'endless'] },
  { name: 'kk_tree_b', count: 16, height: 4.6, scale: [.8, 1.2], clear: 9, solid: .45, wind: .014, biomes: ['bamboo', 'ember', 'snow', 'bloodmoon'] },
  { name: 'kk_grove', count: 6, height: 4.4, scale: [.9, 1.2], clear: 14, solid: 1.3, wind: .01, biomes: ['bamboo', 'ember', 'bloodmoon'] },
  { name: 'kk_pines', count: 12, height: 3.8, scale: [.9, 1.3], clear: 12, solid: 1.1, wind: .01, biomes: ['snow', 'endless'] },
  { name: 'nature_bamboo', count: 60, height: 4.6, scale: [.8, 1.2], clear: 7, solid: .22, wind: .02, biomes: ['bamboo'] },
  { name: 'kk_hill', count: 6, size: 6, scale: [1.6, 2.4], clear: 16, solid: 2.4, biomes: null },
  { name: 'kk_rock_a', count: 26, size: 1.1, scale: [.8, 1.6], clear: 4, solid: .5, biomes: null },
  { name: 'kk_rock_b', count: 18, size: 1.4, scale: [.8, 1.5], clear: 5, solid: .63, biomes: null },
  { name: 'kk_rock_c', count: 14, size: 1.8, scale: [.8, 1.3], clear: 6, solid: .8, biomes: null },
  { name: 'nature_grass', count: 170, height: .32, scale: [.8, 1.3], clear: 1, wind: .07, biomes: null },
  { name: 'nature_flower', count: 90, height: .34, scale: [.9, 1.4], clear: 1, wind: .05, biomes: null },
  { name: 'torii', count: 4, height: 4.1, scale: [1, 1], clear: 12, solid: .35, pillars: true, biomes: null },
  { name: 'lantern', count: 18, height: 1.3, scale: [.9, 1.1], clear: 6, solid: .3, biomes: null },
];
// Season tints for foliage, by biome (vertex colours are multiplied by this).
const TINTS = { snow: '#f2f8ff', peak: '#f2f8ff', ember: '#ffd7a6', autumn: '#ffa070', ash: '#c4b4a4', marsh: '#d6ecc0', fox: '#ffe2cc' };
// Later chapters reuse the props of an earlier biome and change the season around them.
const LIKE = { marsh: 'bamboo', autumn: 'ember', fox: 'sakura', ash: 'ember', peak: 'snow' };
export const baseBiome = biome => LIKE[biome] || biome;

export class World {
  constructor(scene, assets, renderer) {
    this.scene = scene;
    scene.background = new THREE.Color('#b7cdd6');
    scene.fog = new THREE.Fog('#d7e0e0', 34, 72);
    this.wind = { value: 0 };
    if (renderer) {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.45;
      pmrem.dispose();
    }
    this.hemi = new THREE.HemisphereLight('#f4f1ea', '#6f8a60', 1.45);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fbecd6', 2.2);
    this.sun.position.set(-7, 14, 9);
    scene.add(this.sun);
    // a soft warm light that follows the hero so they always pop out of the crowd
    this.lantern = new THREE.PointLight('#ffd9a0', 6, 10, 1.6);
    scene.add(this.lantern);

    this.groundUniforms = {
      uA: { value: new THREE.Color('#7aa35e') },
      uB: { value: new THREE.Color('#87ad68') },
      uC: { value: new THREE.Color('#678e50') },
      uPath: { value: new THREE.Color('#d6c3a0') },
      uFlower: { value: new THREE.Color('#e7a3b8') },
      uFlower2: { value: new THREE.Color('#efe0a0') },
      uLight: { value: new THREE.Vector3() },
      ...THREE.UniformsLib.fog,
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.ShaderMaterial({
      uniforms: this.groundUniforms, fog: true,
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform vec3 uA, uB, uC, uPath, uFlower, uFlower2, uLight; varying vec3 vW;
        #include <common>
        #include <fog_pars_fragment>
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec2 p = vW.xz;
          float v = n(p*0.06)*0.6 + n(p*0.19)*0.3 + n(p*0.8)*0.1;
          vec3 col = mix(uC, uB, smoothstep(0.25, 0.75, v));           // soft meadow patches
          col *= 0.94 + n(p*2.7) * 0.12;                                // gentle grain, no dark noise
          float path = n(p*0.03 + 13.0);
          float edge = smoothstep(0.6, 0.66, path);
          col = mix(col, uPath * (0.93 + n(p*1.7) * 0.14), edge);        // sandy walking paths
          col = mix(col, uPath * 0.82, smoothstep(0.58, 0.6, path) - smoothstep(0.6, 0.62, path)); // path rim
          vec2 cell = floor(p*1.4); vec2 f = fract(p*1.4) - 0.5;
          float r = h(cell);
          float fl = step(0.95, r) * (1.0 - edge) * (1.0 - smoothstep(0.07, 0.11, length(f)));
          col = mix(col, r > 0.975 ? uFlower2 : uFlower, fl);           // tiny painted flowers
          float ld = length(vW.xz - uLight.xz);
          col *= 1.0 + (1.0 - smoothstep(0.0, 6.0, ld)) * 0.08;         // hero spotlight
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    this.ground = ground;

    // decorations: deterministic scatter inside one tile, repeated around the player
    const rnd = mulberry(1337);
    this.decor = DECOR.filter(d => assets[d.name]).map((d) => {
      const geo = bakeMerged(assets[d.name]).clone();
      geo.computeBoundingBox();
      // Wide props (rocks, hills) are fitted by footprint, everything else by height.
      const box = geo.boundingBox, scale = d.size ? d.size / Math.max(.01, box.max.x - box.min.x, box.max.z - box.min.z) : d.height / Math.max(.01, box.max.y - box.min.y);
      geo.translate(-(box.max.x + box.min.x) / 2, -box.min.y, -(box.max.z + box.min.z) / 2);
      geo.scale(scale, scale, scale); geo.computeBoundingSphere();
      const items = [];
      while (items.length < d.count) {
        const x = (rnd() - 0.5) * TILE, z = (rnd() - 0.5) * TILE;
        if (Math.hypot(x, z) < d.clear || ((d.height || d.size) > .7 && Math.abs(x - Math.sin(z * .055) * 9) < 3)) continue;
        items.push({ x, z, r: rnd() * Math.PI * 2, s: d.scale[0] + rnd() * (d.scale[1] - d.scale[0]) });
      }
      const model = new InstancedModel(scene, geo, d.count);
      if (d.wind) {
        const compile = model.material.onBeforeCompile;
        model.material.onBeforeCompile = shader => {
          compile(shader);
          shader.uniforms.uWindTime = this.wind;
          shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader;
          shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed.x += sin(uWindTime * 1.4 + instanceMatrix[3].x * .37 + instanceMatrix[3].z * .19) * pow(max(0.,position.y),1.4) * ${d.wind.toFixed(3)};`);
        };
        const programKey = model.material.customProgramCacheKey();
        model.material.customProgramCacheKey = () => programKey + '-wind-' + d.wind;
      }
      // Torii posts stand at about ±36% of the gate's width, along its local x axis.
      const span = d.pillars ? (box.max.x - box.min.x) * scale * .36 : 0;
      return { model, items, name: d.name, biomes: d.biomes, solid: d.solid || 0, span, foliage: d.wind && d.height > 2, base: model.material.color.clone() };
    });
    this.colliders = new Colliders();

    // blob shadows, one instanced draw for everything
    this.shadows = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: TEX.shadow, transparent: true, opacity: .55, depthWrite: false }), 1200);
    this.shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shadows.frustumCulled = false;
    this.shadows.matrixAutoUpdate = false;
    this.shadows.renderOrder = -1;
    scene.add(this.shadows);
    this._m = new THREE.Matrix4();
    this.nShadow = 0;
    this._lastX = NaN;
    this._lastZ = NaN;
    this._frustum = new THREE.Frustum();
    this._viewProjection = new THREE.Matrix4();
    this._bounds = new THREE.Sphere();
    this._hasView = false;
  }

  setChapter(chapter) {
    if (!chapter || this.chapter?.id === chapter.id) return;
    this.chapter = chapter;
    const c = chapter.colors, biome = chapter.biome, base = baseBiome(biome);
    this.scene.background.set(c.sky); this.scene.fog.color.set(c.fog);
    this.groundUniforms.uA.value.set(c.ground);
    this.groundUniforms.uB.value.set(c.ground).multiplyScalar(1.12);
    this.groundUniforms.uC.value.set(c.ground).multiplyScalar(.86);
    this.groundUniforms.uPath.value.set({ snow: '#c9d6e2', ember: '#e9c38f', ash: '#9a8f84', marsh: '#8f9a72' }[biome === 'autumn' ? 'ember' : biome === 'peak' ? 'snow' : biome] || '#d6c3a0');
    this.groundUniforms.uFlower.value.set(base === 'snow' ? '#9fd4ff' : c.accent);
    this.groundUniforms.uFlower2.value.set(base === 'snow' ? '#ffffff' : biome === 'ash' ? '#e07040' : '#efe0a0');
    this.sun.color.set({ ember: '#ffd2a0', autumn: '#ffd2a0', ash: '#ffc8a0', fox: '#ffd8b8', bloodmoon: '#e6dcff', endless: '#e6dcff' }[biome] || '#fff1d6');
    this.hemi.intensity = biome === 'bloodmoon' || biome === 'endless' ? 1.25 : biome === 'ash' || biome === 'fox' ? 1.32 : 1.45;
    this.colliders.build(this.decor.filter(d => !d.biomes || d.biomes.includes(base)));
    for (const d of this.decor) {
      d.model.material.color.copy(d.base);
      if (d.foliage && TINTS[biome]) d.model.material.color.set(TINTS[biome]);
    }
    this._lastX = NaN;
  }

  /** Optional camera-aware culling; keep a margin for camera smoothing/shake. */
  setView(camera) {
    camera.updateMatrixWorld();
    this._viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this._frustum.setFromProjectionMatrix(this._viewProjection);
    this._hasView = true;
  }

  isVisible(x, z, radius = 2) {
    if (!this._hasView) return true;
    this._bounds.center.set(x, 1.5, z);
    this._bounds.radius = radius + 2;
    return this._frustum.intersectsSphere(this._bounds);
  }

  shadow(x, z, size) {
    if (this.nShadow >= 1200) return;
    this._m.makeScale(size, 1, size).setPosition(x, 0.02, z);
    this.shadows.setMatrixAt(this.nShadow++, this._m);
  }

  /** Hide props (all of them in the menu podium view) without touching their layout. */
  setDecorVisible(visible) { for (const d of this.decor) d.model.mesh.visible = visible; }

  update(px, pz, vfx, dt) {
    this.wind.value += dt;
    this.ground.position.set(Math.round(px / 10) * 10, 0, Math.round(pz / 10) * 10);
    this.lantern.position.set(px, 3.2, pz + 1);
    this.groundUniforms.uLight.value.set(px, 0, pz);
    const cellX = Math.round(px / 4), cellZ = Math.round(pz / 4);
    if (cellX !== this._lastX || cellZ !== this._lastZ) { // re-place decorations only when the player moved a bit
      this._lastX = cellX;
      this._lastZ = cellZ;
      const biome = baseBiome(this.chapter?.biome || 'sakura');
      for (const d of this.decor) {
        d.model.begin();
        if (d.biomes && !d.biomes.includes(biome)) { d.model.end(); continue; }
        for (const it of d.items) {
          // TILE is wider than the view, so the nearest repeat is the only one that can be visible
          const x = it.x + Math.round((px - it.x) / TILE) * TILE;
          const z = it.z + Math.round((pz - it.z) / TILE) * TILE;
          if (Math.abs(x - px) > 48 || Math.abs(z - pz) > 42) continue;
          d.model.push(x, 0, z, it.r, it.s);
        }
        d.model.end();
      }
    }
    // ambient: drifting petals (or snow) and a few fireflies
    const biome = this.chapter?.biome;
    if (Math.random() < dt * 9 * Particles.budget) {
      // Petals, snow, bamboo leaves, maple leaves or volcanic ash, by season.
      const [size, r, g, b] = { snow: [.22, 1, 1, 1], peak: [.22, 1, 1, 1], bamboo: [.34, .55, 1, .5], marsh: [.3, .6, .85, .45], autumn: [.36, 1, .45, .2], ash: [.24, .55, .52, .5] }[biome] || [.34, 1, .55, .75];
      vfx.petals.emit(px + (Math.random() - 0.3) * 40, 8 + Math.random() * 4, pz + (Math.random() - 0.7) * 30,
        -1.2 - Math.random(), -1.2, 0.8, 7, size, r, g, b);
    }
    if ((biome === 'bloodmoon' || biome === 'endless' || biome === 'marsh' || biome === 'fox' || biome === 'ash') && Math.random() < dt * 4 * Particles.budget) {
      vfx.glow.emit(px + (Math.random() - 0.5) * 30, 0.4, pz + (Math.random() - 0.6) * 24,
        (Math.random() - 0.5) * 0.4, 0.4 + Math.random() * 0.5, (Math.random() - 0.5) * 0.4, 3, 0.25, 1.6, 1.4, 0.4, { drag: 0.3 });
    }
  }

  /** Push a circle (`body.x`, `body.z`) out of trees, rocks, hills and gates. Returns true on contact. */
  pushOut(body, radius) { return this.colliders.pushOut(body, radius); }
  /** True when a circle at x, z would overlap a prop (spawns, chests). */
  blocked(x, z, radius = 0) { return this.colliders.blocked(x, z, radius); }

  beginShadows() { this.nShadow = 0; }
  endShadows() {
    this.shadows.count = this.nShadow;
    if (this.nShadow) {
      this.shadows.instanceMatrix.clearUpdateRanges();
      this.shadows.instanceMatrix.addUpdateRange(0, this.nShadow * 16);
      this.shadows.instanceMatrix.needsUpdate = true;
    }
  }
}

// Static circle colliders in tile space. The decor repeats every TILE, so a query wraps the
// position into one tile and tests the nearest repeat of each collider in its grid cell.
const CELL = 4, CELLS = TILE / CELL;
const wrap = v => v - Math.round(v / TILE) * TILE;
export class Colliders {
  constructor() { this.cells = Array.from({ length: CELLS * CELLS }, () => []); this.list = []; this.contact = { nx: 0, nz: 0 }; }

  build(decor) {
    for (const cell of this.cells) cell.length = 0;
    this.list = [];
    for (const d of decor) {
      if (!d.solid) continue;
      for (const it of d.items) {
        const r = d.solid * it.s;
        if (d.span) {
          const ox = Math.cos(it.r) * d.span * it.s, oz = -Math.sin(it.r) * d.span * it.s;
          this.add(it.x + ox, it.z + oz, r); this.add(it.x - ox, it.z - oz, r);
        } else this.add(it.x, it.z, r);
      }
    }
    this.maxR = this.list.reduce((m, c) => Math.max(m, c.r), 0);
  }

  add(x, z, r) {
    const c = { x: wrap(x), z: wrap(z), r };
    this.list.push(c);
    const n = Math.ceil(r / CELL) + 1;
    const cx = Math.floor((c.x + TILE / 2) / CELL), cz = Math.floor((c.z + TILE / 2) / CELL);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
      const bucket = this.cells[((cx + i + CELLS) % CELLS) * CELLS + (cz + j + CELLS) % CELLS];
      if (!bucket.includes(c)) bucket.push(c);
    }
  }

  _bucket(x, z) {
    const cx = Math.floor((wrap(x) + TILE / 2) / CELL), cz = Math.floor((wrap(z) + TILE / 2) / CELL);
    return this.cells[((cx % CELLS + CELLS) % CELLS) * CELLS + (cz % CELLS + CELLS) % CELLS];
  }

  pushOut(body, radius) {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const c of this._bucket(body.x, body.z)) {
        const dx = wrap(body.x - c.x), dz = wrap(body.z - c.z), min = c.r + radius, d2 = dx * dx + dz * dz;
        if (d2 >= min * min) continue;
        const d = Math.sqrt(d2) || 1e-4, nx = d2 ? dx / d : 1, nz = d2 ? dz / d : 0;
        body.x += nx * (min - d); body.z += nz * (min - d);
        this.contact.nx = nx; this.contact.nz = nz; hit = true;
      }
      if (!hit) break;
    }
    return hit;
  }

  blocked(x, z, radius = 0) {
    for (const c of this._bucket(x, z)) {
      const dx = wrap(x - c.x), dz = wrap(z - c.z), min = c.r + radius;
      if (dx * dx + dz * dz < min * min) return true;
    }
    return false;
  }
}

export function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
