import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadHeroAssets, HERO_ASSETS } from './hero-assets.mjs';

const source = (await readFile('src/player.js', 'utf8')).replace("from 'three'", `from '${import.meta.resolve('three')}'`).replace("import { toonify, loadModel } from './assets.js';", 'const toonify = () => []; const loadModel = async () => null;').replace("from 'three/examples/jsm/utils/SkeletonUtils.js'", `from '${import.meta.resolve('three/examples/jsm/utils/SkeletonUtils.js')}'`);
const { Player, HEROES: HEROES_SPEC } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const assets = await loadHeroAssets(undefined, [...HERO_ASSETS, 'skin_dragon', 'skin_samurai']);
for (const name of ['hero_mage', 'hero_archer', 'hero_ninja']) assert.ok(assets[name].userData.clips.length >= 10, `${name} keeps its retargeted KayKit clips`);
const scene = new THREE.Scene(), player = new Player(scene, assets), input = { resetVersion: 0, move: () => [0, 1], consumeDash: () => false };
const stats = { speed: 1, regen: 0 }, particles = { emit() {} }, vfx = { ring() {}, glow: particles, petals: particles }, enemies = { nearest: () => null };
for (const kind of ['staff', 'bow', 'sword']) {
  player.resetRun(); player.equipWeapon(kind);
  const knee = player.hero.model.getObjectByName('J_Bip_L_LowerLeg') || player.hero.model.getObjectByName('lowerlegl');
  assert.ok(knee, `${kind} has a knee bone`);
  const rotations = [];
  for (let i = 0; i < 90; i++) { player.update(1 / 60, input, stats, vfx, enemies); rotations.push(knee.quaternion.clone()); }
  assert.ok(rotations.some(q => q.angleTo(rotations[45]) > .2), `${kind} legs move while running`);
  assert.ok(player.z > 3, `${kind} actually runs forward: ${player.z}`);
}
input.move = () => [-1, -.01];
player.face = Math.PI - .01;
const oldFace = player.face; player.update(1 / 60, input, stats, vfx, enemies);
assert.ok(Math.abs(Math.atan2(Math.sin(player.face - oldFace), Math.cos(player.face - oldFace))) <= 9 / 60, 'Turn follows the shortest angle within angular speed limit');
// A skin swaps the whole character but keeps the class weapon in its hand.
for (const kind of ['staff', 'bow', 'sword']) for (const model of ['skin_dragon', 'skin_samurai']) {
  player.equipWeapon(kind); player.applySkin(model, { model });
  assert.notEqual(player.hero, player.heroes[kind], `${kind} wears ${model}`);
  assert.ok(player.hero.model.visible && !player.heroes[kind].model.visible, 'Only the skin character is shown');
  assert.ok(player.hero.weapon.parent?.parent?.name === HEROES_SPEC[kind].slot, `${model} holds the ${kind} weapon`);
  assert.ok(player.hero.lower.Running_A && player.hero.upper[HEROES_SPEC[kind].attacks[0]], `${model} has the ${kind} clips`);
}
player.applySkin('classic', null); player.equipWeapon('staff');
assert.equal(player.hero, player.heroes.staff, 'Classic restores the class hero');
player.equipWeapon('bow'); player.attackWeapon('bow'); player.update(.1, input, stats, vfx, enemies);
assert.equal(player.attackWeapon('bow'), false, 'Overlapping skills cannot restart the visible draw');
player.resetRun();
assert.equal(player.attack, 0); assert.equal(player.x, 0); assert.equal(player.vx, 0); assert.equal(player.aimTarget, null);
console.log('Motion regression passed: 3 skinned VRoid heroines run (KayKit clips retargeted) with animated legs, smooth shortest turns, whole-character skins with class weapons, bow windup guard and clean run reset.');
