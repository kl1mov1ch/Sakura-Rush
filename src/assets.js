import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeShaded, makeOutline, addSmoothNormals } from './toon.js';

// Heroes (hero_*) and map props (kk_*) are KayKit CC0 assets restyled in Blender
// (blender/build_heroes.py, blender/build_nature.py); nature_* are Kenney CC0; the rest
// come from blender/build_models.py. Vite inlines all GLBs so the game works offline.
const URLS = import.meta.glob(['./models/*.glb', '!./models/slime.glb', '!./models/ghost.glb', '!./models/hero.glb', '!./models/{tree,rock,grass}.glb', '!./models/nature_{tree,pine,rock,bush,fence}.glb'], { query: '?url', import: 'default', eager: true });
export const NAMES = ['hero_mage', 'hero_archer', 'hero_ninja', 'bow', 'staff', 'katana', 'arrow', 'ashigaru', 'bat', 'yurei', 'oni', 'oni_lord', 'kappa', 'tengu', 'shaman', 'feather', 'gem', 'shuriken', 'chest', 'onigiri', 'ofuda', 'bomb', 'scroll', 'torii', 'lantern', 'banner', 'nature_flower', 'nature_grass', 'nature_bamboo',
  'kk_tree', 'kk_tree_b', 'kk_sakura', 'kk_sakura_grove', 'kk_grove', 'kk_pines', 'kk_rock_a', 'kk_rock_b', 'kk_rock_c', 'kk_hill'];
const RIG_KINDS = { WingL: 1, WingR: 2, LegL: 3, LegR: 4, ArmL: 5, ArmR: 6, Sway: 7 };
const bakedModels = new WeakMap();
const noRaycast = () => {};

const loader = new GLTFLoader();

async function loadGlb(n) {
  const url = URLS[`./models/${n}.glb`];
  if (!url) throw new Error(`Missing model: ${n}.glb`);
  // inlined models arrive as data: URIs; decode them here instead of fetch() (strict CSPs block data: fetches)
  const gltf = url.startsWith('data:')
    ? await loader.parseAsync(Uint8Array.from(atob(url.slice(url.indexOf(',') + 1)), (c) => c.charCodeAt(0)).buffer, '')
    : await loader.loadAsync(url);
  const scene = gltf.scene;
  scene.userData.clips = gltf.animations;
  // Kenney nature greens are teal; warm them up to match the KayKit meadow.
  if (n === 'nature_grass' || n === 'nature_flower') scene.traverse(o => { if (o.isMesh && o.material.name === 'grass') { o.material = o.material.clone(); o.material.color.set('#6aa84f'); } });
  if (n === 'nature_bamboo') scene.traverse(o => { if (o.isMesh) { o.material = o.material.clone(); o.material.color.set('#79a865'); o.material.roughness = 0.8; } });
  return scene;
}

export async function loadAssets(onProgress = () => {}) {
  const out = {};
  let done = 0;
  await Promise.all(NAMES.map(async (n) => {
    out[n] = await loadGlb(n);
    onProgress(++done / NAMES.length);
  }));
  return out;
}

// Skin characters (skin_*) are only fetched when a player looks at or wears one.
const lazy = new Map();
export function loadModel(name) {
  if (!lazy.has(name)) lazy.set(name, loadGlb(name));
  return lazy.get(name);
}

/** Swap glTF materials for shaded ones (optionally with an outline hull). Keeps hierarchy (for limb animation). */
export function toonify(root, outline = 0) {
  const outlineMat = outline ? makeOutline(outline) : null;
  const meshes = [];
  root.traverse((o) => { if (o.isMesh) meshes.push(o); });
  const mats = [];
  const materialCache = new Map();
  for (const o of meshes) {
    const src = o.material;
    let m = materialCache.get(src);
    if (!m) {
      m = makeShaded({ color: src.color.clone(), emissive: src.emissive.clone(), emissiveIntensity: src.emissiveIntensity ?? 1, roughness: src.roughness ?? 0.75, metalness: src.metalness ?? 0 });
      materialCache.set(src, m);
      mats.push(m);
    }
    o.material = m;
    if (!outlineMat) continue;
    addSmoothNormals(o.geometry);
    const hull = new THREE.Mesh(o.geometry, outlineMat);
    hull.raycast = noRaycast;
    hull.matrixAutoUpdate = false;
    o.add(hull);
  }
  return mats;
}

/**
 * Flatten a model into one geometry: material colour -> `color`, emission -> `emit`,
 * roughness/metalness -> `rm`, and the joint each vertex hangs from -> `rig` (pivot + kind).
 * One geometry per model lets hundreds of monsters render as a single InstancedMesh.
 */
export function bakeMerged(root) {
  if (bakedModels.has(root)) return bakedModels.get(root);
  root.updateMatrixWorld(true);
  let geos = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const vertexColor = g.attributes.color; // KayKit props carry their palette as COLOR_0
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3), emit = new Float32Array(n * 3), rm = new Float32Array(n * 2), rig = new Float32Array(n * 4);
    const c = o.material.color;
    const e = o.material.emissive.clone().multiplyScalar(o.material.emissiveIntensity ?? 1);
    let joint = o;
    while (joint && !RIG_KINDS[joint.name]) joint = joint.parent;
    const kind = joint ? RIG_KINDS[joint.name] : 0;
    const pivot = joint ? joint.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const j = i * 3;
      if (vertexColor) { col[j] = c.r * vertexColor.getX(i); col[j + 1] = c.g * vertexColor.getY(i); col[j + 2] = c.b * vertexColor.getZ(i); }
      else { col[j] = c.r; col[j + 1] = c.g; col[j + 2] = c.b; }
      emit[j] = e.r; emit[j + 1] = e.g; emit[j + 2] = e.b;
      rm[i * 2] = o.material.roughness ?? 0.75; rm[i * 2 + 1] = o.material.metalness ?? 0;
      rig[i * 4] = pivot.x; rig[i * 4 + 1] = pivot.y; rig[i * 4 + 2] = pivot.z; rig[i * 4 + 3] = kind;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('emit', new THREE.BufferAttribute(emit, 3));
    g.setAttribute('rm', new THREE.BufferAttribute(rm, 2));
    g.setAttribute('rig', new THREE.BufferAttribute(rig, 4));
    geos.push(g);
  });
  if (geos.some((g) => !g.index)) geos = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = mergeGeometries(geos);
  merged.computeBoundingSphere();
  for (const g of geos) g.dispose();
  bakedModels.set(root, merged);
  return merged;
}

/** InstancedMesh (optionally with an outline hull) with per-instance hit flash and joint animation phase. */
export class InstancedModel {
  constructor(scene, geometry, capacity, { outline = 0.04, tint = 0xffffff, castOutline = false, rig = null } = {}) {
    this.capacity = capacity;
    this.material = makeShaded({ vertexColors: true, instanced: true, color: tint, rigged: !!rig, rig: rig || undefined });
    this.flash = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.flash.setUsage(THREE.DynamicDrawUsage);
    this.phase = rig ? new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1) : null;
    this.phase?.setUsage(THREE.DynamicDrawUsage);
    // Vertex data is immutable after baking. Share those buffers between model
    // variants; only the hit-flash attribute belongs to this instance batch.
    const source = geometry;
    if (castOutline) addSmoothNormals(source);
    geometry = new THREE.BufferGeometry();
    for (const [name, attribute] of Object.entries(source.attributes)) geometry.setAttribute(name, attribute);
    geometry.setIndex(source.index);
    geometry.boundingSphere = source.boundingSphere;
    geometry.setAttribute('aFlash', this.flash);
    if (this.phase) geometry.setAttribute('aPhase', this.phase);
    this.mesh = new THREE.InstancedMesh(geometry, this.material, capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.raycast = noRaycast;
    scene.add(this.mesh);
    if (castOutline) {
      this.hull = new THREE.InstancedMesh(geometry, makeOutline(outline), capacity);
      this.hull.instanceMatrix = this.mesh.instanceMatrix; // share transforms
      this.hull.frustumCulled = false;
      this.hull.count = 0;
      this.hull.matrixAutoUpdate = false;
      this.hull.raycast = noRaycast;
      scene.add(this.hull);
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this.n = 0;
  }
  begin() { this.n = 0; }
  push(x, y, z, rotY, sx, sy = sx, sz = sx, flash = 0, rotX = 0, rotZ = 0, phase = 0) {
    if (this.n >= this.capacity) return;
    this._e.set(rotX, rotY, rotZ, 'YXZ');
    this._q.setFromEuler(this._e);
    this._m.compose(this._p.set(x, y, z), this._q, this._s.set(sx, sy, sz));
    this.mesh.setMatrixAt(this.n, this._m);
    this.flash.array[this.n] = flash;
    if (this.phase) this.phase.array[this.n] = phase;
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    if (this.hull) this.hull.count = this.n;
    if (this.n) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(0, this.n * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
      this.flash.clearUpdateRanges();
      this.flash.addUpdateRange(0, this.n);
      this.flash.needsUpdate = true;
      if (this.phase) {
        this.phase.clearUpdateRanges();
        this.phase.addUpdateRange(0, this.n);
        this.phase.needsUpdate = true;
      }
    }
  }
}
