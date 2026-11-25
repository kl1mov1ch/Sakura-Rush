import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { loadEnemyLogic } from './test-engine.mjs';

// Keep the real combat algorithms and Three.js objects; only canvas texture
// creation and the imported asset loader are replaced for this GPU-free test.
const source = (await readFile(new URL('../src/abilities.js', import.meta.url), 'utf8'))
  .replace("from 'three'", `from '${import.meta.resolve('three')}'`)
  .replace("from 'three/examples/jsm/utils/BufferGeometryUtils.js'", `from '${import.meta.resolve('three/examples/jsm/utils/BufferGeometryUtils.js')}'`)
  .replace("import { toonify } from './assets.js';", 'const toonify = () => [];')
  .replace("import { TEX, Particles, CELL } from './vfx.js';", 'const TEX = { glow: new THREE.Texture() }; const Particles = { budget: 1 }; const CELL = {};');
const { ABILITIES, Abilities, segmentDistanceSq, segmentHitFraction, getAbilityStats } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const { Enemies } = await loadEnemyLogic();
// Level-up cards compare real table values: "now -> next" for upgrades, plain values for new picks.
assert.deepEqual(getAbilityStats('katana', 0).map(s => [s.key, s.from, s.to]), [['dmg', null, 20], ['radius', null, 3], ['cd', null, 1.05]]);
assert.deepEqual(getAbilityStats('katana', 1).map(s => [s.key, s.from, s.to, s.better]), [['dmg', 20, 25, true], ['radius', 3, 3.2, true], ['cd', 1.05, 0.99, true]]);
assert.ok(getAbilityStats('foxfire', 1).every(s => s.key !== 'aoe'), 'A stat that stays at zero is not shown');
assert.deepEqual(getAbilityStats('swift', 0), []); assert.deepEqual(getAbilityStats('katana', 5), []);
const noop = () => {};
function fixture(levels = { katana: 1 }) {
  const scene = new THREE.Scene(), enemies = new Enemies({}, {}), hits = [];
  const player = { x: 0, z: 0, face: 0, aimAngle: 0, maxHp: 100, hp: 100, swing: noop };
  const particle = { emit: noop, burst: noop };
  const game = { state: 'play', time: 0, player, enemies, shake: noop,
    audio: { slash: noop, whoosh: noop, zap: noop, boom: noop },
    vfx: { sparks: particle, glow: particle, petals: particle, smoke: particle, fire: particle, ground: { add: noop }, flares: { add: noop }, decals: { add: noop }, slash: noop, ring: noop, bolt: noop, lightFlash: noop, explode: noop, magicCircle: noop, flash: noop, hit: noop, muzzle: noop },
    damageEnemy(e, damage) { hits.push({ id: e.id, damage }); },
  };
  const abilities = new Abilities(scene, { shuriken: new THREE.Group() }, game);
  abilities.levels = levels;
  const step = (dt = 1 / 60) => { game.time += dt; abilities.update(dt); };
  return { abilities, game, enemies, hits, step };
}

assert.equal(Object.values(ABILITIES).filter((a) => a.weapon).length, 20);
for (const [id, spec] of Object.entries(ABILITIES)) if (spec.weapon) {
  assert.equal(spec.desc.length, 5, `${id} has five descriptions`);
  for (const value of Object.values(spec)) if (Array.isArray(value)) assert.equal(value.length, 5);
}
assert.equal(segmentDistanceSq(0, 2, 0, 0, 0, 4), 0);
assert.equal(segmentDistanceSq(3, 2, 0, 0, 0, 4), 9);
assert.equal(segmentDistanceSq(0, 6, 0, 0, 0, 4), 4);
assert.equal(segmentHitFraction(0, 2, .5, 0, 0, 0, 4), .375);
assert.equal(segmentHitFraction(0, 2, .5, 0, 2, 0, 4), 0);
assert.equal(segmentHitFraction(3, 2, .5, 0, 0, 0, 4), Infinity);

{
  const f = fixture({ katana: 5 });
  f.enemies.spawn('ashigaru', 0, -2);
  f.abilities.timers.katana = 0; f.step(.01);
  assert.equal(f.hits.length, 1, 'Katana autoaim hits a threat behind movement direction');
  assert.equal(f.abilities.pendingSlashes.length, 7, 'Awakened katana cuts in four directions with echoes');
  const pending = f.abilities.pendingSlashes.map(s => s.delay);
  f.game.state = 'pause'; f.step(10);
  assert.deepEqual(f.abilities.pendingSlashes.map(s => s.delay), pending);
  assert.equal(f.hits.length, 1, 'Pause blocks queued combat');
  f.game.state = 'over'; f.step(10);
  assert.equal(f.hits.length, 1, 'Death blocks queued combat');
  f.game.state = 'play'; f.step(.4);
  assert.ok(f.hits.length > 1, 'Queued combo resumes with simulation');
  assert.equal(f.abilities.pendingSlashes.length, 0);
}
{
  const f = fixture({ foxfire: 5 });
  f.enemies.spawn('oni', 0, 12);
  f.abilities.timers.foxfire = 0; f.step(.01);
  assert.equal(f.abilities.fires.length, 7);
  assert.equal(new Set(f.abilities.fires.map(fire => fire.sprite)).size, 7, 'Every flame reserves a different sprite');
}
{
  const f = fixture({ foxfire: 1 });
  const target = f.enemies.spawn('oni', 0, 12);
  f.abilities.timers.foxfire = 0; f.step(.01);
  const flame = f.abilities.fires[0];
  flame.life = .001; f.step(.01);
  assert.equal(f.hits.length, 0, 'Expired flames do not remotely damage a target');
  f.abilities.timers.foxfire = 0; f.step(.01);
  const recycledFlame = f.abilities.fires[0];
  target.id += 1000;
  f.enemies.nearest = () => null;
  f.step(.01);
  assert.equal(recycledFlame.target, null, 'Recycled enemy reference is discarded before homing');
}
{
  const f = fixture({ kunai: 1 });
  const a = f.enemies.spawn('ashigaru', 0, .8), b = f.enemies.spawn('ashigaru', 0, 1.7), c = f.enemies.spawn('ashigaru', 0, 2.5);
  f.abilities.timers.kunai = 0; f.step(.15);
  assert.deepEqual(f.hits.map(hit => hit.id), [a.id, b.id], 'Swept projectile hits two enemies and stops before a third');
  assert.ok(!f.hits.some(hit => hit.id === c.id));
}
{
  const f = fixture({ frost: 5 });
  const enemy = f.enemies.spawn('oni', 0, 3), boss = f.enemies.spawn('boss', 1, 3);
  f.abilities.timers.frost = 0; f.step(.01);
  assert.equal(f.hits.length, 2);
  assert.equal(enemy.freeze, 2.2);
  assert.equal(boss.freeze, .2, 'Boss freeze is bounded');
}
{
  const f = fixture({ meteor: 3 });
  const first = f.enemies.spawn('oni', 0, 4), second = f.enemies.spawn('oni', 5, 0);
  f.abilities.timers.meteor = 0; f.step(.01);
  assert.equal(f.abilities.meteors.filter(m => m.active).length, 2);
  assert.equal(f.hits.length, 0, 'Meteor shows a warning before damage');
  for (let i = 0; i < 60; i++) f.step();
  assert.ok(f.hits.some(hit => hit.id === first.id));
  assert.ok(f.hits.some(hit => hit.id === second.id));
  assert.equal(f.abilities.meteors.filter(m => m.active).length, 0);
}
{
  const f = fixture({ vortex: 2 });
  f.enemies.spawn('oni', 0, 3);
  const nearby = f.enemies.spawn('ashigaru', 1, 3);
  f.abilities.timers.vortex = 0; f.step(.1);
  assert.ok(nearby.kx < 0, 'Vortex attracts nearby enemies toward its centre');
  assert.ok(f.hits.length > 0);
  const count = f.hits.length; f.step(.05);
  assert.equal(f.hits.length, count, 'Vortex damage ticks are bounded independently of frame rate');
}
{
  const f = fixture({ katana: 5, frost: 5, meteor: 5, vortex: 5 });
  assert.equal(f.abilities.take('kunai'), false, 'Four-weapon build cap is enforced');
  assert.equal(f.abilities.take('katana'), false, 'Levels cannot exceed five');
  assert.equal(f.abilities.take('unknown'), false);
  for (let i = 0; i < 50; i++) {
    const offers = f.abilities.offers();
    assert.equal(new Set(offers).size, offers.length);
    assert.ok(offers.every(id => !ABILITIES[id].weapon));
  }
}
{
  const f = fixture({ kunai: 5 });
  f.enemies.spawn('oni', 0, 8);
  f.abilities.timers.kunai = 0; f.step(.01);
  assert.equal(f.abilities.kunai.filter(k => k.active).length, 19, 'Awakened kunai adds a ring of 12 blades');
}
{
  const f = fixture({ vortex: 5 });
  f.enemies.spawn('oni', 0, 3); f.enemies.spawn('oni', 5, 3);
  f.abilities.timers.vortex = 0; f.step(.01);
  assert.equal(f.abilities.vortices.filter(v => v.active).length, 2, 'Awakened vortex opens two gates');
}
{
  const f = fixture({});
  f.abilities.levels = { might: 4, vitality: 4, swift: 4 };
  f.abilities.take('might'); f.abilities.take('vitality'); f.abilities.take('swift');
  assert.equal(f.abilities.stats.crit, .25);
  assert.equal(f.abilities.stats.revive, 1);
  assert.equal(f.abilities.stats.dash, .55);
}
{
  const f = fixture();
  assert.equal(f.abilities.setLoadout('bow'), false, 'Loadout cannot be changed during combat');
  f.game.state = 'title';
  assert.equal(f.abilities.setLoadout('unknown'), false);
  assert.equal(f.abilities.setLoadout('bow'), true);
  assert.deepEqual(f.abilities.levels, { arrow: 1 });
  assert.equal(f.abilities.take('katana'), false, 'Archer cannot acquire new sword physical attacks');
  assert.equal(f.abilities.take('arcane'), false, 'Archer cannot acquire new staff physical attacks');
  assert.equal(f.abilities.take('frost'), true, 'Elemental arts are shared across classes');
  for (let i = 0; i < 100; i++) {
    const offers = f.abilities.offers();
    assert.ok(offers.every(id => !ABILITIES[id].weapon || ['bow', 'shared'].includes(ABILITIES[id].family)));
    assert.ok(offers.some(id => ABILITIES[id].family === 'bow'), 'An archer always has a bow-family offer while any remain available');
    if (i % 2 === 0) assert.ok(offers.includes('arrow'), 'The chosen primary can be upgraded at least every other offer');
  }
  f.abilities.stats.dmg = 8;
  f.abilities._launchArrow('arrow', 0, 10, 1);
  assert.ok(f.abilities.arrows.some(arrow => arrow.active));
  assert.equal(f.abilities.setLoadout('staff'), true);
  assert.deepEqual(f.abilities.levels, { arcane: 1 });
  assert.equal(f.abilities.stats.dmg, 1);
  assert.ok(f.abilities.arrows.every(arrow => !arrow.active), 'Title loadout changes clear old projectile activity');
}
{
  const f = fixture({});
  // Deliberately insert the rear enemy first; broadphase iteration order must
  // never make an arrow pass through the front target.
  const rear = f.enemies.spawn('ashigaru', 0, 2.5), front = f.enemies.spawn('ashigaru', 0, 1.4);
  f.abilities._launchArrow('arrow', 0, 20, 1); f.step(.12);
  assert.deepEqual(f.hits.map(hit => hit.id), [front.id], 'Arrow swept collisions resolve in travel order');
  assert.ok(!f.hits.some(hit => hit.id === rear.id));
}
{
  const f = fixture({});
  const first = f.enemies.spawn('ashigaru', 0, 1.4), second = f.enemies.spawn('ashigaru', 0, 2.5), third = f.enemies.spawn('ashigaru', 0, 3.5);
  f.abilities._launchArrow('arrow', 0, 20, 2); f.step(.15);
  assert.deepEqual(f.hits.map(hit => hit.id), [first.id, second.id], 'Upgraded bow pierces exactly two targets');
  assert.ok(!f.hits.some(hit => hit.id === third.id));
}
{
  const f = fixture({ arrow: 1 });
  f.enemies.spawn('oni', 0, 12);
  f.abilities.timers.arrow = 0; f.step(.01);
  const arrow = f.abilities.arrows.find(item => item.active), position = { x: arrow.x, z: arrow.z, life: arrow.life };
  f.game.state = 'pause'; f.step(3);
  assert.deepEqual({ x: arrow.x, z: arrow.z, life: arrow.life }, position, 'Pause freezes new projectile simulation');
}
{
  const f = fixture({ ricochet: 1 });
  f.enemies.spawn('oni', 0, 2);
  f.enemies.spawn('oni', 2, 2);
  f.enemies.spawn('oni', 2, 4);
  f.enemies.spawn('oni', 4, 4);
  f.abilities.timers.ricochet = 0;
  for (let i = 0; i < 90; i++) f.step();
  assert.equal(f.hits.length, 4, 'Ricochet initial hit plus three distinct bounces');
  assert.equal(new Set(f.hits.map(hit => hit.id)).size, 4, 'Ricochet never damages the same enemy twice');
}
{
  const f = fixture({ arrowrain: 1 });
  f.enemies.spawn('oni', 0, 3);
  f.abilities.timers.arrowrain = 0; f.step(.01);
  assert.equal(f.abilities.arrowFields.filter(field => field.active).length, 1);
  assert.equal(f.hits.length, 0, 'Arrow rain warns before any impact');
  for (let i = 0; i < 35; i++) f.step();
  assert.equal(f.hits.length, 0, 'Falling rain arrows must travel to ground before causing damage');
  for (let i = 0; i < 50; i++) f.step();
  assert.ok(f.hits.length > 0, 'Arrow rain impacts cause local damage');
}
{
  const f = fixture({ arcane: 1 });
  const target = f.enemies.spawn('oni', 0, 12);
  f.abilities.timers.arcane = 0; f.step(.01);
  const orb = f.abilities.orbs.find(item => item.active);
  orb.life = 0; target.id += 100;
  f.step(.01);
  assert.equal(f.hits.length, 0, 'Expired magic bolts never cause remote splash damage');
}
{
  const f = fixture({ arcane: 1 });
  const target = f.enemies.spawn('oni', 0, 12);
  f.abilities.timers.arcane = 0; f.step(.01);
  const orb = f.abilities.orbs.find(item => item.active);
  target.id += 100;
  f.enemies.nearest = () => null;
  f.step(.01);
  assert.equal(orb.target, null, 'Magic homing rejects recycled enemy generations');
}
{
  const f = fixture({ arcane: 2 });
  const a = f.enemies.spawn('oni', 0, 2.4), b = f.enemies.spawn('oni', .7, 2.4);
  f.abilities.timers.arcane = 0;
  for (let i = 0; i < 35; i++) f.step();
  assert.ok(f.hits.some(hit => hit.id === a.id) && f.hits.some(hit => hit.id === b.id), 'A real magic-bolt collision creates local splash damage');
}
{
  const f = fixture({ runeburst: 3 });
  const enemy = f.enemies.spawn('oni', 0, 3);
  f.abilities.timers.runeburst = 0; f.step(.01);
  assert.equal(f.hits.length, 0, 'Rune telegraph precedes detonation');
  const rune = f.abilities.runes.find(item => item.active);
  f.game.state = 'pause'; f.step(10);
  assert.equal(rune.age, .01, 'Rune warnings use simulation time');
  f.game.state = 'play';
  for (let i = 0; i < 80; i++) f.step();
  assert.equal(f.hits.filter(hit => hit.id === enemy.id).length, 1, 'Expanding rune wave hits each enemy once');
  assert.ok(enemy.slow > 0);
}
{
  const f = fixture({ katana: 5 });
  const enemy = f.enemies.spawn('oni', 0, 2);
  f.abilities.timers.katana = 0;
  f.step(.01);
  for (let i = 0; i < 35; i++) f.step();
  const strikes = f.hits.filter(hit => hit.id === enemy.id);
  assert.equal(strikes.length, 2, 'Overlapping awakened katana arcs give one full strike and one weaker echo, not eight full hits');
  assert.ok(strikes[1].damage < strikes[0].damage);
}
{
  const f = fixture({ arrow: 1 });
  let motions = 0;
  f.game.player.getAttackDelay = () => .18;
  f.game.player.attackWeapon = () => motions++;
  f.enemies.spawn('oni', 0, 12);
  f.abilities.timers.arrow = 0; f.step(.01);
  assert.equal(f.abilities.arrows.filter(arrow => arrow.active).length, 0, 'Bow winds up before releasing arrows');
  assert.equal(motions, 1);
  f.game.state = 'pause'; f.step(1);
  assert.equal(f.abilities.pendingShots[0].delay, .18, 'Pause freezes attack preparation');
  f.game.state = 'play'; f.step(.17);
  assert.equal(f.abilities.arrows.filter(arrow => arrow.active).length, 0);
  f.step(.02);
  assert.equal(f.abilities.arrows.filter(arrow => arrow.active).length, 2, 'Bow releases the correct volley after its windup');
}
{
  const f = fixture({ explosivearrow: 1 });
  const a = f.enemies.spawn('oni', 0, 3), b = f.enemies.spawn('oni', 1, 3);
  f.abilities.timers.explosivearrow = 0;
  for (let i = 0; i < 20; i++) f.step();
  assert.ok(f.hits.some(hit => hit.id === a.id) && f.hits.some(hit => hit.id === b.id), 'Explosive arrow deals local impact splash');
}
{
  const f = fixture({ windvolley: 5 });
  for (const x of [-4, 0, 4]) f.enemies.spawn('oni', x, 5);
  f.abilities.timers.windvolley = 0;
  f.step(.01);
  assert.equal(f.abilities.arrows.filter(arrow => arrow.active).length, 15, 'Awakened fan has fifteen visible arrows');
  for (let i = 0; i < 25; i++) f.step();
  assert.ok(new Set(f.hits.map(hit => hit.id)).size >= 2, 'A fan reaches enemies in different directions');
}
{
  const f = fixture({ spiritbeam: 1 });
  const a = f.enemies.spawn('oni', 0, 3), b = f.enemies.spawn('oni', 0, 6);
  f.abilities.timers.spiritbeam = 0; f.step(.01);
  assert.ok(f.hits.some(hit => hit.id === a.id) && f.hits.some(hit => hit.id === b.id), 'Beam pierces a line of enemies');
  const first = f.hits.length; f.step(.05);
  assert.equal(f.hits.length, first, 'Beam damage uses fixed ticks rather than render frame count');
  f.game.state = 'over'; f.step(2);
  assert.equal(f.hits.length, first, 'Death stops channeled beam damage');
}
{
  const f = fixture({ spiritguard: 1 });
  f.enemies.spawn('oni', 0, 2.5); f.step(.1);
  assert.equal(f.abilities.guards.filter(guard => guard.active).length, 2);
  assert.ok(f.hits.length > 0, 'Guardian orbit can actually hit an approaching enemy');
  const first = f.hits.length; f.step(.01);
  assert.equal(f.hits.length, first, 'Guardian contact cooldown prevents per-frame damage');
}
{
  const f = fixture({ might: 4 });
  f.abilities.stats.crit = .145;
  assert.equal(f.abilities.take('might'), true);
  assert.ok(Math.abs(f.abilities.stats.crit - .295) < 1e-9, 'Awakening preserves the permanent critical chance talent');
}
{
  // Flying swords from the technique and from relics share one ring; quake hits everyone around.
  const f = fixture({ flyswords: 2 });
  f.abilities.stats.flySwords = 1;
  f.step();
  assert.equal(f.abilities.flySwords.filter(m => m.visible).length, 3, 'Two technique swords plus one relic sword');
  const g = fixture({ quake: 1 });
  g.enemies.spawn('oni', 2, 0); g.enemies.spawn('oni', -2.5, 0.5); g.enemies.spawn('oni', 9, 0);
  g.abilities.timers.quake = 0; g.step(.01);
  assert.equal(g.hits.length, 2, 'Quake reaches the two oni inside its radius only');
}
console.log('Combat regression passed: 20 techniques, finite katana overlap damage, synchronized windups, 5 bow arts, 4 staff arts, shared arts and bounded simulation.');

export { ABILITIES, Abilities, fixture };
