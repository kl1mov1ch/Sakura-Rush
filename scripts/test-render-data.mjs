import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeOutline } from '../src/toon.js';

// Node cannot evaluate Vite's asset glob; replace only that build-time macro.
const assetsUrl = new URL('../src/assets.js', import.meta.url);
const assetsSource = (await readFile(assetsUrl, 'utf8'))
  .replace(/import\.meta\.glob\([^;]+\)/, '{}')
  .replace(/from '([^']+)'/g, (_, spec) => `from '${spec.startsWith('.') ? new URL(spec, assetsUrl).href : import.meta.resolve(spec)}'`);
const { bakeMerged, InstancedModel, toonify } = await import(`data:text/javascript;base64,${Buffer.from(assetsSource).toString('base64')}`);

const loader = new GLTFLoader();
let vertices = 0;
const NAMES = ['hero', 'bow', 'staff', 'arrow', 'ashigaru', 'bat', 'yurei', 'oni', 'oni_lord', 'gem', 'shuriken', 'chest', 'onigiri', 'ofuda', 'bomb', 'scroll', 'tree', 'rock', 'grass', 'torii', 'lantern', 'banner', 'nature_tree', 'nature_pine', 'nature_rock', 'nature_bush', 'nature_grass', 'nature_flower', 'nature_fence'];
const RIGGED = { bat: [1, 2], ashigaru: [3, 4, 5, 6], oni: [3, 4, 5, 6], oni_lord: [3, 4, 5, 6], yurei: [7], kappa: [3, 4, 5, 6], tengu: [3, 4, 5, 6], shaman: [3, 4, 5, 6] };
NAMES.push('nature_bamboo', 'kappa', 'tengu', 'shaman', 'feather');
for (const name of NAMES) {
  const buffer = await readFile(new URL(`../src/models/${name}.glb`, import.meta.url));
  const root = (await loader.parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '')).scene;
  const merged = bakeMerged(root);
  assert.equal(bakeMerged(root), merged, 'Baked model geometry is cached');
  assert.ok(merged.attributes.position.count > 0);
  for (const attr of ['position', 'normal', 'color', 'emit', 'rm', 'rig']) {
    assert.ok(merged.attributes[attr].array.every(Number.isFinite), `${name}/${attr} must be finite`);
  }
  const kinds = new Set(); for (let i = 3; i < merged.attributes.rig.array.length; i += 4) kinds.add(merged.attributes.rig.array[i]);
  for (const kind of RIGGED[name] || []) assert.ok(kinds.has(kind), `${name} has animated joint kind ${kind}`);
  vertices += merged.attributes.position.count;
  const scene = new THREE.Scene();
  const a = new InstancedModel(scene, merged, 8, { castOutline: true, rig: RIGGED[name] ? [1, 1, 1, 1] : null });
  const b = new InstancedModel(scene, merged, 8);
  assert.equal(a.mesh.geometry.attributes.position, b.mesh.geometry.attributes.position, 'Variants share immutable vertex buffers');
  assert.notEqual(a.flash, b.flash, 'Variants keep independent hit-flash state');
  assert.equal(a.mesh.instanceMatrix, a.hull.instanceMatrix, 'Body and outline share transforms');
  a.begin(); a.push(3, 2, 1, 0, 2, 2, 2, .8, 0, 0, 1.5); a.end();
  if (RIGGED[name]) assert.equal(a.phase.array[0], 1.5, 'Animation phase is stored per instance');
  assert.equal(a.mesh.count, 1); assert.equal(a.hull.count, 1);
  assert.deepEqual(a.mesh.instanceMatrix.updateRanges, [{ start: 0, count: 16 }]);
  assert.deepEqual(a.flash.updateRanges, [{ start: 0, count: 1 }]);
  assert.equal(a.mesh.instanceMatrix.array[12], 3);
  const version = a.mesh.instanceMatrix.version;
  a.begin(); a.end();
  assert.equal(a.mesh.count, 0);
  assert.equal(a.mesh.instanceMatrix.version, version, 'Empty batches do not upload unused capacity');
  const clone = root.clone(true), materials = toonify(clone);
  assert.ok(materials.length > 0);
}
assert.equal(makeOutline(.04), makeOutline(.04), 'Outline materials are reused');
assert.equal(makeOutline(.04).customProgramCacheKey(), makeOutline(.02).customProgramCacheKey(), 'Outline widths share shader programs');
console.log(`Render data regression: all ${NAMES.length} GLBs parsed and checked (${vertices} baked vertices); joint rigs, shared buffers, flash isolation and active GPU ranges passed.`);
