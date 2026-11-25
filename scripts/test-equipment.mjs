import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadHeroAssets } from './hero-assets.mjs';

const source = (await readFile(new URL('../src/player.js', import.meta.url), 'utf8'))
  .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
  .replace("import { toonify, loadModel } from './assets.js';", 'const toonify = () => []; const loadModel = async () => null;').replace("from 'three/examples/jsm/utils/SkeletonUtils.js'", `from '${import.meta.resolve('three/examples/jsm/utils/SkeletonUtils.js')}'`);
const { Player, HEROES } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const assets = await loadHeroAssets();
const input = { resetVersion: 0, move: () => [0, 0], consumeDash: () => false };
const particles = { emit() {} }, vfx = { glow: particles, petals: particles, ring() {} };
const stats = { speed: 1, regen: 0 };
const nearestRanges = [];
const enemies = { nearest: (x, z, range) => { nearestRanges.push(range); return null; } };
const player = new Player(new THREE.Scene(), assets);
for (const kind of ['sword', 'bow', 'staff']) {
  assert.equal(player.equipWeapon(kind), true);
  player.update(0, input, stats, vfx, enemies); player.update(.3, input, stats, vfx, enemies); // the crossbow hold pose raises the weapon over a few frames
  assert.equal(player.weaponType, kind);
  for (const other of Object.keys(HEROES)) assert.equal(player.heroes[other].model.visible, other === kind, 'Only the chosen class hero is shown');
  const hero = player.heroes[kind];
  assert.ok(hero.model.getObjectByName(HEROES[kind].slot), `${kind} weapon sits in the hand slot`);
  for (const clip of [...HEROES[kind].attacks, 'Idle', 'Running_A', 'Death_A', 'Cheer']) assert.ok(hero.upper[clip] || hero.lower[clip], `${kind} has clip ${clip}`);
  const muzzle = player.getMuzzlePosition(new THREE.Vector3());
  assert.ok(muzzle.toArray().every(Number.isFinite));
  assert.ok(muzzle.y > .3 && muzzle.y < 3, `${kind} muzzle is at hand height: ${muzzle.y}`);
  assert.equal(player.attackWeapon(kind, 0), true);
  player.update(.03, input, stats, vfx, enemies);
  assert.ok(player.attack > 0);
}
assert.deepEqual([...new Set(nearestRanges)], [9, 18, 16]);
assert.equal(player.equipWeapon('unknown'), false);
assert.equal(player.weaponType, 'staff');
assert.equal(player.attackWeapon('sword'), false, 'A secondary sword skill cannot turn the held staff into a sword animation');
player.die(); assert.equal(player.dead, true); assert.equal(player.attackWeapon('staff'), false, 'A fallen hero does not attack');
player.revive(); assert.equal(player.dead, false);
console.log('Equipment regression passed: 3 class heroines with their own weapon, hand slots, attack clips, muzzle heights, fall and revive.');
