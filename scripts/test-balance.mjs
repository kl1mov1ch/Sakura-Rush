import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';
import { fixture } from './test-combat.mjs';
import { seeded } from './test-engine.mjs';

// Same precomputed wave positions/types/times for every weapon. Real enemy
// pursuit, separation, spatial queries, collisions and shipped attacks run here.
const profiles = {
  sword: { starter: 'katana', range: 9, build: { katana: 5, kunai: 5, shuriken: 5, aura: 5 } },
  bow: { starter: 'arrow', range: 18, build: { arrow: 5, arrowrain: 5, explosivearrow: 5, windvolley: 5 } },
  staff: { starter: 'arcane', range: 16, build: { arcane: 5, runeburst: 5, spiritbeam: 5, spiritguard: 5 } },
};
const path = t => ({ x: Math.sin(t * .33) * 5, z: Math.cos(t * .27) * 5 });
function schedule(duration, rate) {
  const random = seeded(90210), result = [];
  for (let time = 0; time < duration; time += 1 / rate) {
    const choice = random(), angle = random() * Math.PI * 2, radius = 12 + random() * 5;
    const center = path(time);
    result.push({ time, type: choice < .62 ? 'ashigaru' : choice < .82 ? 'bat' : choice < .95 ? 'yurei' : 'oni', x: center.x + Math.sin(angle) * radius, z: center.z + Math.cos(angle) * radius });
  }
  return result;
}

function simulate(weapon, scenario) {
  const originalRandom = Math.random;
  Math.random = seeded(42173);
  try {
    const profile = profiles[weapon], levels = scenario.build ? profile.build : { [profile.starter]: scenario.level };
    const f = fixture(levels), g = f.game, p = g.player, enemies = f.enemies;
    p.aimRange = profile.range; p.radius = .45; p.iframe = 0; p.maxHp = p.hp = 10000;
    p.getAttackDelay = kind => kind === 'bow' ? .18 : kind === 'staff' ? .22 : .10;
    p.attackWeapon = () => true;
    p.getMuzzlePosition = out => out.set(p.x + Math.sin(p.face) * .55, 1.15, p.z + Math.cos(p.face) * .55);
    f.abilities.stats.crit = 0;
    let kills = 0, damage = 0, incomingDamage = 0, waveIndex = 0, spawned = 0, peakEnemies = 0, peakArrows = 0, peakOrbs = 0;
    const waves = schedule(scenario.duration, scenario.rate);
    g.hurtPlayer = amount => { incomingDamage += amount; p.iframe = .6; };
    g.damageEnemy = (enemy, amount, crit, kx, kz, knock) => {
      if (!enemy.alive) return;
      damage += Math.min(enemy.hp, amount); enemy.hp -= amount;
      const length = Math.hypot(kx, kz);
      if (length > 0) { const strength = knock * (enemy.t.boss ? .08 : enemy.type === 'oni' ? .4 : 1); enemy.kx += kx / length * strength; enemy.kz += kz / length * strength; }
      if (enemy.hp <= 0) { enemy.alive = false; kills++; }
    };
    const dt = 1 / 60;
    for (let frame = 0; frame < scenario.duration * 60; frame++) {
      const time = frame * dt; g.time = time;
      Object.assign(p, path(time)); p.iframe = Math.max(0, p.iframe - dt);
      while (waveIndex < waves.length && waves[waveIndex].time <= time) {
        const wave = waves[waveIndex++];
        if (enemies.spawn(wave.type, wave.x, wave.z, scenario.hp)) spawned++;
      }
      enemies.update(dt, p, g);
      const target = enemies.nearest(p.x, p.z, profile.range);
      if (target) p.face = p.aimAngle = Math.atan2(target.x - p.x, target.z - p.z);
      f.abilities.update(dt);
      peakEnemies = Math.max(peakEnemies, enemies.list.length);
      peakArrows = Math.max(peakArrows, f.abilities.arrows.filter(item => item.active).length);
      peakOrbs = Math.max(peakOrbs, f.abilities.orbs.filter(item => item.active).length);
    }
    assert.ok(peakArrows <= 112 && peakOrbs <= 40, 'Projectile caps survive a full combat workload');
    return { weapon, scenario: scenario.id, kills, spawned, killRate: +(kills / spawned).toFixed(3), effectiveDamage: damage, incomingDamage, peakEnemies, peakArrows, peakOrbs };
  } finally { Math.random = originalRandom; }
}

const scenarios = [
  { id: 'starter-early', level: 1, hp: 1, rate: 3, duration: 60 },
  { id: 'primary-awakened-late', level: 5, hp: 4, rate: 5, duration: 70 },
  { id: 'four-arts-late', build: true, hp: 4, rate: 8, duration: 90 },
];
const results = scenarios.flatMap(scenario => Object.keys(profiles).map(weapon => simulate(weapon, scenario)));
console.table(results);
const lateBuilds = results.filter(result => result.scenario === 'four-arts-late');
assert.ok(lateBuilds.every(result => result.killRate > .78), 'Every full weapon build must clear the majority of late chapter-one waves');
assert.ok(Math.min(...lateBuilds.map(result => result.kills)) / Math.max(...lateBuilds.map(result => result.kills)) > .75, 'No full build is left with a fraction of the other weapons’ clear rate');
await mkdir('docs', { recursive: true });
await writeFile('docs/combat-balance.json', JSON.stringify({ method: 'Deterministic 60 Hz pursuit simulation; identical scheduled mixed waves, moving player, actual collision/piercing/splash/knockback; no permanent bonuses or crits; late chapter-one HP multiplier 4. Incoming damage is measured without ending the benchmark on death.', results }, null, 2));
console.log('Balance regression passed: all three actual combat builds clear comparable late waves, with bounded projectiles.');
