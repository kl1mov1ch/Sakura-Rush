import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// Exercise game logic without a browser/GPU; renderer construction is the only
// seam replaced, so assertions run against the actual shipped enemy code.
export async function loadEnemyLogic(url = new URL('../src/enemies.js', import.meta.url)) {
  const source = await readFile(url, 'utf8');
  const stub = `const bakeMerged = () => ({}); class InstancedModel {
    constructor(scene, geometry, capacity) { this.capacity = capacity; this.n = 0; }
    begin() { this.n = 0; } push() { this.n++; } end() {}
  }`;
  return import(`data:text/javascript;base64,${Buffer.from(source.replace(/^import .*?;\r?\n/, stub + '\n')).toString('base64')}`);
}

export function seeded(seed = 12345) {
  return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}

async function test() {
  const { Enemies, TYPES } = await loadEnemyLogic();
  const make = () => new Enemies({}, {});
  const player = { x: 0, z: 0, hp: 100, radius: 0.45, iframe: 1 };
  const game = { time: 0, hurtPlayer() { throw new Error('Unexpected damage'); } };
  const random = seeded();
  const en = make();
  const types = Object.keys(TYPES).filter(k => k !== 'boss');
  for (let i = 0; i < 350; i++) en.spawn(types[i % types.length], (random() - .5) * 70, (random() - .5) * 70);
  en.spawn('boss', 6, 3);
  const scratch = [];
  const compareQueries = () => {
    for (let i = 0; i < 200; i++) {
      const x = (random() - .5) * 60, z = (random() - .5) * 60, r = random() * 8;
      const want = en.list.filter(e => e.alive && (e.x - x) ** 2 + (e.z - z) ** 2 <= (r + e.t.radius) ** 2).map(e => e.id).sort((a,b) => a-b);
      const actual = en.query(x, z, r, scratch).map(e => e.id).sort((a,b) => a-b);
      assert.deepEqual(actual, want, 'Spatial query must match exact circle overlaps');
      const skip = new Set([en.list[i % en.list.length]]);
      const nearest = en.list.filter(e => e.alive && !skip.has(e) && (e.x - x) ** 2 + (e.z - z) ** 2 < r*r)
        .sort((a,b) => (a.x-x)**2 + (a.z-z)**2 - (b.x-x)**2 - (b.z-z)**2)[0] ?? null;
      assert.equal(en.nearest(x, z, r, skip), nearest, 'Nearest respects radius and exclusions');
    }
  };
  compareQueries();
  for (let step = 0; step < 10; step++) en.update(1/60, player, game);
  compareQueries();

  const far = make();
  const remote = far.spawn('ashigaru', 20000, -20000);
  assert.deepEqual(far.query(remote.x, remote.z, .1), [remote], 'Endless-world coordinates do not wrap grid keys');
  far.update(1/60, player, game);
  assert.deepEqual(far.query(remote.x, remote.z, .1), [remote], 'Teleported enemies are queryable in their new cell immediately');
  assert.equal(far.query(20000, -20000, .1).length, 0, 'Teleported actor leaves old bucket');

  const pooled = make();
  const dead = pooled.spawn('ashigaru', 0, 0), oldId = dead.id;
  dead.alive = false; dead.freeze = 10; dead.hitCd.shuri = 100;
  pooled.update(1/60, { ...player, iframe: 0 }, game);
  assert.equal(pooled.list.length, 0, 'Dead actors cannot deal contact damage');
  const recycled = pooled.spawn('yurei', 5, 5);
  assert.equal(recycled, dead, 'Enemy object is reused');
  assert.notEqual(recycled.id, oldId, 'Recycled target receives a fresh generation id');
  assert.equal(recycled.freeze, 0);
  assert.deepEqual(recycled.hitCd, {});
  recycled.freeze = .3;
  pooled.update(.1, player, game);
  assert.equal(recycled.x, 5); assert.equal(recycled.z, 5);
  assert.ok(recycled.freeze > 0 && recycled.freeze < .3);
  pooled.update(.3, player, game);
  assert.ok(recycled.x !== 5 || recycled.z !== 5, 'Frozen actors resume after the timer');

  const dense = make();
  for (let i = 0; i < 620; i++) dense.spawn('ashigaru', 5, 5);
  assert.equal(dense.list.length, 600, 'Swarm spawning cannot exceed visible instance capacity');
  assert.equal(dense.spawn('ashigaru', 1, 1), null);
  dense.update(1/60, player, game);
  assert.ok(dense.list.every(e => Number.isFinite(e.x) && Number.isFinite(e.z)), 'Coincident crowd stays finite');
  assert.ok(dense.list.some(e => Math.abs(e.x - dense.list[0].x) > .001), 'Coincident actors separate');
  const list = dense.list;
  for (const e of list) e.alive = false;
  dense.update(1/60, player, game);
  assert.equal(dense.list, list, 'Live array is compacted rather than allocated every frame');
  assert.equal(dense.list.length, 0);
  assert.ok(dense.spawn('ashigaru', 1, 1), 'Capacity is restored after deaths');

  {
    // Special yokai: the kappa telegraphs and leaps, the tengu keeps away and throws, the shaman summons.
    const en2 = make(), hits = [], shots = [], marks = [], summons = [];
    const hero = { x: 0, z: 0, hp: 100, radius: 0.45, iframe: 0 };
    const g = { time: 0, hurtPlayer: (d) => hits.push(d), summonMinions: (e, n) => summons.push(n),
      hazards: { shoot: (...a) => shots.push(a), mark: (...a) => marks.push(a) }, vfx: { ring() {}, sparks: { burst() {} } } };
    const kappa = en2.spawn('kappa', 5, 0); kappa.cd = 0;
    en2.update(1 / 60, hero, g);
    assert.equal(kappa.st, 'crouch', 'A kappa crouches before the leap'); assert.equal(marks.length, 1, 'The landing spot is marked');
    let peak = 0;
    for (let i = 0; i < 90; i++) { en2.update(1 / 60, hero, g); peak = Math.max(peak, kappa.air); }
    assert.ok(peak > 2, 'The kappa flies in an arc'); assert.ok(Math.hypot(kappa.x, kappa.z) < 1.5, 'It lands where the hero stood');
    assert.ok(hits.length >= 1, 'Standing still under a kappa hurts');
    const tengu = en2.spawn('tengu', 3, 0); tengu.cd = 5;
    const before = Math.hypot(tengu.x, tengu.z);
    for (let i = 0; i < 30; i++) en2.update(1 / 60, hero, g);
    assert.ok(Math.hypot(tengu.x, tengu.z) > before, 'A tengu backs away from a close hero');
    tengu.cd = 0; for (let i = 0; i < 40; i++) en2.update(1 / 60, hero, g);
    assert.ok(shots.length >= 1, 'A tengu throws feather darts');
    const shaman = en2.spawn('shaman', 10, 0); shaman.cd = 0;
    for (let i = 0; i < 70; i++) en2.update(1 / 60, hero, g);
    assert.deepEqual(summons, [3], 'A shaman raises three minions after casting');
  }

  console.log('Engine regression: 800 spatial/nearest checks plus pooling, freeze, teleport, crowd, capacity and special yokai checks passed.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await test();
