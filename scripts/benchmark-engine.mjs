import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { loadEnemyLogic, seeded } from './test-engine.mjs';

const args = process.argv.slice(2);
const baseline = args.includes('--baseline') ? args[args.indexOf('--baseline') + 1] : null;
const current = await loadEnemyLogic();
const previous = baseline ? await loadEnemyLogic(pathToFileURL(baseline)) : null;
const player = { x: 0, z: 0, hp: 100, radius: .45, iframe: 1 };
const game = { time: 0, hurtPlayer() {} };

function measure(Enemies, dense) {
  const samples = [];
  for (let trial = 0; trial < 7; trial++) {
    const random = seeded(77), en = new Enemies({}, {});
    for (let i = 0; i < 420; i++) {
      const a = random() * Math.PI * 2, r = dense ? random() * 1.5 : 6 + random() * 22;
      const e = en.spawn(['ashigaru', 'bat', 'yurei', 'oni'][i % 4], Math.cos(a) * r, Math.sin(a) * r);
      e.phase = random() * 10;
    }
    // Warm up the same query and update paths before timing.
    for (let i = 0; i < 100; i++) en.update(1/60, player, game);
    const start = performance.now();
    for (let i = 0; i < 300; i++) en.update(1/60, player, game);
    samples.push((performance.now() - start) / 300);
  }
  return samples.sort((a,b) => a-b)[3];
}

for (const dense of [false, true]) {
  const after = measure(current.Enemies, dense);
  const before = previous ? measure(previous.Enemies, dense) : null;
  console.log(JSON.stringify({ scenario: dense ? '420 clustered enemies' : '420 approaching enemies', metric: 'median CPU ms per update; 7 x 300 updates, excludes rendering', current: +after.toFixed(3), ...(before ? { baseline: +before.toFixed(3), improvementPercent: +(100 * (before - after) / before).toFixed(1) } : {}) }));
}
