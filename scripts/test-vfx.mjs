import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';

// Keep real visual pools/animations; replace canvas-generated textures only.
const source = (await readFile(new URL('../src/vfx.js', import.meta.url), 'utf8'))
  .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
  .replace("import atlasUrl from './art/fx-atlas.webp?url';", "const atlasUrl = '';")
  .replace('new THREE.TextureLoader().load(atlasUrl)', 'new THREE.Texture()')
  .replace(/\/\/ -+ textures[\s\S]*?\/\/ -+ particles/, 'export const TEX = {glow:new THREE.Texture(),star:new THREE.Texture(),petal:new THREE.Texture(),shadow:new THREE.Texture()};');
globalThis.document = { getElementById: () => ({ appendChild() {} }) };
globalThis.innerWidth = 1440; globalThis.innerHeight = 900;
const { VFX } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const camera = new THREE.PerspectiveCamera(); camera.position.set(0, 12, 10);
const vfx = new VFX(new THREE.Scene(), camera);

// Textured slashes, rings and summoning circles live in instanced sprite layers.
vfx.slash(0, 1, 0, 0, 3, '#ff4455', 1);
assert.equal(vfx.ground.list.length, 2, 'A slash is a coloured crescent plus a white core');
vfx.update(.5);
assert.equal(vfx.ground.geo.instanceCount, 2, 'Live slashes are drawn');
vfx.update(.6);
assert.equal(vfx.ground.geo.instanceCount, 0, 'Slashes expire on their own timeline');
for (let i = 0; i < 400; i++) {
  vfx.ring(0, 0, 3);
  vfx.slash(0, 1, 0, 0, 3);
  vfx.explode(0, 0, 3);
  vfx.magicCircle(0, 0, 2);
  vfx.bolt(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, 0));
}
vfx.update(.01);
for (const layer of [vfx.ground, vfx.flares, vfx.fireballs, vfx.decals]) assert.ok(layer.geo.instanceCount <= layer.cap, 'Sprite layers stay within their capacity');
assert.equal(vfx.live.length, new Set(vfx.live.map(effect => effect.obj)).size);
assert.ok(vfx.live.length <= 24, 'Lightning timelines remain bounded by the pool');
const bolt = vfx.bolts.items.at(3);
vfx.update(.04);
const opacity = bolt.material.uniforms.uA.value;
vfx.update(.04);
assert.ok(bolt.material.uniforms.uA.value <= opacity, 'Lightning fades without strobing');
const timelines = vfx.live.map(effect => effect.t), sprites = vfx.ground.list.map(effect => effect.t);
const version = vfx.sparks.geo.attributes.position.version;
vfx.update(0);
assert.deepEqual(vfx.live.map(effect => effect.t), timelines, 'Paused effects do not advance');
assert.deepEqual(vfx.ground.list.map(effect => effect.t), sprites, 'Paused sprites do not advance');
assert.equal(vfx.sparks.geo.attributes.position.version, version, 'Paused particles do not upload buffers');
vfx.lightFlash(0, 3, 0, 0xffffff, 80);
assert.equal(vfx.flashLight.intensity, 0, 'Calm effects suppress lighting flashes');
vfx.sparks.emit(0,1,0,1,1,1,1,.2,1,1,1); vfx.update(.01);
assert.ok(vfx.sparks.geo.drawRange.count > 0);
vfx.clear();
assert.equal(vfx.live.length,0);
assert.equal(vfx.ground.geo.instanceCount + vfx.flares.geo.instanceCount + vfx.decals.geo.instanceCount, 0, 'Clearing removes every sprite');
assert.equal(vfx.sparks.n,0);
assert.equal(vfx.sparks.geo.drawRange.count,0,'Returning to a frozen menu removes the old GPU particle draw range immediately');
console.log('VFX regression passed: textured slashes and explosions, bounded sprite layers, smooth lightning fade, paused particles and calm lighting.');
