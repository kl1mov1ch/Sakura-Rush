import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Campaign, CAMPAIGN_KEY, LEGACY_KEY, CHAPTERS, STORY_CHAPTERS, ENDLESS_ID, TALENTS, TALENT_BRANCHES, TALENT_GRID, SKINS, PRODUCTS, RUN_SECONDS, AD_COINS, AD_COINS_PER_DAY, talentPosition, WEAPON_SKINS, BOOSTS, BOOST_ADS_PER_DAY, weaponUpgradeCost } from '../src/progression.js';
import { RELICS, rollRelics } from '../src/relics.js';
import { CoinDrops } from '../src/coins.js';

const memoryStore = (seed = {}) => {
  const records = new Map(Object.entries(seed));
  return { getItem: key => records.get(key) ?? null, setItem: (key, value) => records.set(key, value), records };
};
const own = (object, property) => Object.hasOwn(object, property);
const near = (a, b) => Math.abs(a - b) < 1e-9;

assert.equal(RUN_SECONDS, 600);
assert.equal(STORY_CHAPTERS.length, 10);
assert.equal(CHAPTERS.length, 11);
assert.ok(STORY_CHAPTERS.slice(2).every(c => Object.keys(c.foes).length >= 1), 'Every later chapter brings its own special yokai');
assert.ok(CHAPTERS.find(c => c.id === ENDLESS_ID).endless);
assert.ok(STORY_CHAPTERS.every(chapter => chapter.duration === RUN_SECONDS));
assert.ok(STORY_CHAPTERS.slice(1).every((chapter, i) => chapter.hpMul > STORY_CHAPTERS[i].hpMul && chapter.spawnMul > STORY_CHAPTERS[i].spawnMul));
assert.equal(TALENT_BRANCHES.length, 7);
assert.equal(TALENTS.length, 57);
assert.equal(TALENTS.filter(t => t.frame === 'challenge').length, 7, 'Each branch ends in a challenge');
assert.equal(new Set(TALENTS.map(t => `${t.x},${t.y}`)).size, TALENTS.length, 'No two nodes share a spot on the map');
assert.equal(TALENT_BRANCHES.filter(b => b.cls).length, 3, 'Mage, archer and ninja each have their own branch');
assert.ok(TALENTS.every(node => node.costs.length === node.maxRank && node.costs.every((c, i) => i === 0 || c > node.costs[i - 1])));
for (const node of TALENTS) {
  const p = talentPosition(node);
  assert.ok(p.x >= 0 && p.x < TALENT_GRID.cols && p.y >= 0 && p.y < TALENT_GRID.rows, `${node.id} sits inside the advancement map`);
  for (const parent of node.requires) assert.ok(TALENTS.some(t => t.id === parent), `${node.id} requires a real node`);
}
assert.ok(Campaign.treeCost() > 10000, 'The full tree takes many runs, not one');
assert.equal(SKINS.length, 7);
assert.ok(SKINS.slice(1).every(s => /^skin_/.test(s.model) && s.cost >= 900), 'Every paid skin is a whole Blender character');
assert.deepEqual(PRODUCTS.map(p => p.id), ['coins_small', 'coins_medium', 'coins_large', 'golden_pass', 'boost_pack', 'weapon_phoenix', 'weapon_storm', 'weapon_muramasa']);
assert.equal(WEAPON_SKINS.length, 9); assert.equal(WEAPON_SKINS.filter(w => w.premium).length, 3);
assert.ok(WEAPON_SKINS.filter(w => w.premium).every(w => PRODUCTS.some(p => p.weapon === w.id)), 'Every legendary weapon is a store product');
assert.equal(RELICS.length, 17); assert.equal(BOOSTS.length, 4);

{
  const storage = memoryStore(), game = new Campaign(storage);
  assert.equal(game.coins, 0); assert.equal(game.selectedChapter, 1); assert.equal(game.selectedSkin, 'classic'); assert.equal(game.selectedClass, 'staff');
  assert.equal(game.selectChapter(2).reason, 'locked');
  assert.equal(game.selectChapter(ENDLESS_ID).ok, true, 'Endless mode is open from the start');
  assert.equal(game.selectChapter(1).ok, true);
  assert.equal(game.buyTalent('heart').reason, 'insufficient-coins');
  assert.equal(game.buyTalent('body1').reason, 'locked');
  assert.equal(game.buyTalent('constructor').reason, 'unknown-talent');
  assert.equal(game.equipSkin('samurai').reason, 'not-owned');
  assert.equal(game.beginRun(5, 'bow'), null);
  assert.equal(game.beginRun(1, 'unknown'), null);
  const run = game.beginRun(1, 'bow');
  assert.equal(typeof run, 'string');
  assert.equal(game.selectedClass, 'bow');
  assert.equal(game.collectCoins('forged-id', 100).ok, false);
  for (const amount of [-1, 0, 1.5, NaN, Infinity, 10001, '20']) assert.equal(game.collectCoins(run, amount).ok, false);
  assert.equal(game.collectCoins(run, 100).amount, 100);
  assert.equal(game.buyTalent('heart').reason, 'run-active');
  assert.equal(game.selectClass('sword').reason, 'run-active');
  const restored = new Campaign(storage);
  assert.equal(restored.coins, 100, 'Collected coins are saved before the run ends');
  assert.equal(restored.activeRun.id, run);
  const lost = restored.finishRun(run, { victory: false, time: 95.6, kills: 41 });
  assert.equal(lost.ok, true); assert.equal(lost.bonus, 0); assert.equal(lost.time, 95);
  assert.equal(restored.coins, 100, 'Losing never removes collected money');
  assert.equal(restored.finishRun(run, { victory: false, time: 95, kills: 41 }).reason, 'already-finished');
  assert.equal(restored.buyTalent('heart').ok, true); assert.equal(restored.coins, 85);
  assert.equal(restored.buyTalent('body1').ok, true); assert.equal(restored.coins, 65);
  assert.equal(restored.buyTalent('mage1').ok, true); assert.equal(restored.coins, 45);
  assert.equal(restored.bonuses('staff').maxHp, 12);
  assert.ok(near(restored.bonuses('staff').damage, 1.06), 'The mage branch helps the mage');
  assert.ok(near(restored.bonuses('bow').damage, 1.01), 'The mage branch does not help the archer');
  assert.equal(restored.classLevel('staff'), 1); assert.equal(restored.classLevel('bow'), 0);
  assert.equal(new Campaign(storage).rank('mage1'), 1);
}

{
  const storage = memoryStore(), game = new Campaign(storage), run = game.beginRun(1, 'staff');
  game.collectCoins(run, 400);
  assert.equal(game.finishRun(run, { victory: true, time: 599.999, kills: 99 }).reason, 'unfinished');
  assert.ok(game.activeRun, 'An early victory claim cannot erase the active run');
  assert.equal(game.finishRun(run, { victory: true, time: 600, kills: NaN }).reason, 'invalid-result');
  const won = game.finishRun(run, { victory: true, time: 600, kills: 123 });
  assert.equal(won.unlocked, 2); assert.equal(won.firstClear, true);
  assert.equal(won.bonus, 110); assert.equal(game.coins, 510);
  assert.equal(new Campaign(storage).finishRun(run, { victory: true, time: 600, kills: 123 }).reason, 'already-finished');
  assert.equal(game.doubleLastRun(run).amount, 400, 'A rewarded video doubles the coins picked up in the run');
  assert.equal(game.doubleLastRun(run).reason, 'already-doubled'); assert.equal(game.coins, 910);
  assert.equal(game.selectChapter(2).ok, true);
  assert.equal(game.selectChapter(3).reason, 'locked');
  assert.equal(game.buySkin('samurai').ok, true); assert.equal(game.coins, 10);
  assert.equal(game.buySkin('samurai').reason, 'owned');
  assert.equal(game.equipSkin('samurai').ok, true);
  assert.equal(new Campaign(storage).selectedSkin, 'samurai');
  const repeat = game.beginRun(1, 'sword');
  const replay = game.finishRun(repeat, { victory: true, time: 602, kills: 150 });
  assert.equal(replay.bonus, 60); assert.equal(replay.unlocked, 0); assert.equal(replay.time, 600);
}

{
  const game = new Campaign(memoryStore());
  let run = game.beginRun(); for (let i = 0; i < 6; i++) game.collectCoins(run, 10000); game.finishRun(run, { victory: false, time: 10, kills: 5 });
  assert.ok(game.coins >= Campaign.treeCost());
  for (const node of TALENTS) {
    for (let rank = 1; rank <= node.maxRank; rank++) {
      const before = game.coins, cost = node.costs[rank - 1], result = game.buyTalent(node.id);
      assert.equal(result.ok, true, `Buy ${node.id} rank ${rank}`);
      assert.equal(game.coins, before - cost); assert.equal(game.rank(node.id), rank);
    }
    assert.equal(game.buyTalent(node.id).reason, 'max-rank');
  }
  assert.equal(game.spentOnTalents(), Campaign.treeCost());
  const staff = game.bonuses('staff');
  assert.equal(staff.maxHp, 235);
  assert.ok(near(staff.coinGain, 2.05));
  assert.ok(near(staff.cooldown, .65));
  assert.ok(near(staff.armor, .45), 'Armour is capped');
  assert.ok(near(staff.speed, 1.45), 'Speed is capped');
  assert.equal(staff.revive, 1); assert.equal(staff.relicChoices, 1); assert.equal(staff.rerolls, 3); assert.equal(staff.startLevel, 1);
  assert.equal(game.bonuses('bow').startLevel, 1, 'Each class capstone counts for its own class');
  assert.equal(game.classLevel('staff'), 36);
  const before = game.coins;
  run = game.beginRun(1, 'sword');
  for (let i = 0; i < 100; i++) game.collectCoins(run, 1);
  assert.equal(game.coins - before, 205, 'Fractional coin bonuses accumulate across single-coin pickups');
  game.abandonRun();
  assert.equal(game.finishRun(run, { victory: true, time: 600, kills: 1 }).ok, false);
}

{
  const game = new Campaign(memoryStore());
  for (const chapter of STORY_CHAPTERS) {
    assert.equal(game.selectChapter(chapter.id).ok, true);
    const run = game.beginRun(chapter.id, 'bow');
    assert.equal(game.collectCoins(run, 100).amount, Math.floor(100 * chapter.coinMul + 1e-9));
    assert.equal(game.finishRun(run, { victory: true, time: 600, kills: chapter.id * 100 }).ok, true);
  }
  assert.equal(game.state.unlockedChapter, 10);
  assert.equal(game.selectChapter(12).reason, 'unknown-chapter');
  const endless = game.beginRun(ENDLESS_ID, 'staff');
  assert.equal(game.finishRun(endless, { victory: true, time: 9999, kills: 1 }).reason, 'unfinished', 'Endless mode has no victory');
  const first = game.finishRun(endless, { victory: false, time: 754.4, kills: 812 });
  assert.equal(first.newRecord, true); assert.equal(first.time, 754);
  assert.equal(game.state.endless.bestTime, 754); assert.equal(game.state.endless.bestKills, 812);
  const second = game.beginRun(ENDLESS_ID, 'bow');
  assert.equal(game.finishRun(second, { victory: false, time: 300, kills: 900 }).newRecord, false);
  assert.equal(game.state.endless.bestKills, 900); assert.equal(game.state.endless.runs, 2);
  assert.deepEqual(game.state.records.map(r => r.time), [754, 300]);
}

{
  const game = new Campaign(memoryStore());
  const run = game.beginRun(1, 'staff'); game.collectCoins(run, 200);
  assert.equal(game.reviveCost(run), 60);
  assert.equal(game.payRevive(run).cost, 60); assert.equal(game.coins, 140);
  assert.equal(game.reviveCost(run), 150);
  assert.equal(game.payRevive(run).reason, 'insufficient-coins');
  assert.equal(game.payRevive('forged').reason, 'invalid-run');
  game.collectCoins(run, 100); assert.equal(game.payRevive(run).ok, true);
  assert.equal(game.reviveCost(run), null); assert.equal(game.payRevive(run).reason, 'limit');
}

{
  const game = new Campaign(memoryStore());
  for (let i = 0; i < AD_COINS_PER_DAY; i++) assert.equal(game.grantAdCoins().amount, AD_COINS);
  assert.equal(game.grantAdCoins().reason, 'daily-limit'); assert.equal(game.coins, AD_COINS * AD_COINS_PER_DAY);
  assert.equal(game.creditPurchase('coins_small', 'tok-1').ok, true);
  assert.equal(game.creditPurchase('coins_small', 'tok-1').reason, 'already-credited', 'A purchase token pays once');
  assert.equal(game.creditPurchase('nope', 'tok-2').reason, 'unknown-product');
  assert.equal(game.coins, AD_COINS * AD_COINS_PER_DAY + 600);
  assert.ok(near(game.bonuses().coinGain, 1));
  assert.equal(game.creditPurchase('golden_pass', 'tok-3').ok, true);
  assert.ok(near(game.bonuses().coinGain, 1.25)); assert.ok(game.state.ownedSkins.includes('gold'));
  assert.equal(game.restorePass(), false);
  assert.equal(game.creditPurchase('weapon_storm', 'tok-4').ok, true);
  assert.ok(game.state.ownedWeapons.includes('bow_storm')); assert.equal(game.weapon('bow').skin, 'bow_storm', 'A bought legendary is equipped at once');
  assert.ok(near(game.bonuses('bow').damage, 1.1), 'Legendary looks add 10% damage');
  assert.equal(game.restorePermanent('weapon_storm'), false); assert.equal(game.restorePermanent('weapon_phoenix'), true);
  assert.equal(game.creditPurchase('boost_pack', 'tok-5').ok, true); assert.equal(game.state.boostTokens, 10);
}

{
  // v2 saves: five chapters become ten, endless moves to its own id.
  const v2 = new Campaign(memoryStore({ [CAMPAIGN_KEY]: JSON.stringify({ version: 2, coins: 50, unlockedChapter: 4, selectedChapter: 6, chapters: { 1: { wins: 2, attempts: 3, bestTime: 600, bestKills: 9 }, 3: { wins: 1, attempts: 1, bestTime: 600, bestKills: 4 }, 6: { wins: 0, attempts: 2, bestTime: 900, bestKills: 50 } }, talents: { heart: 2 } }) }));
  assert.equal(v2.state.unlockedChapter, 6); assert.equal(v2.selectedChapter, ENDLESS_ID);
  assert.deepEqual(Object.keys(v2.state.chapters).map(Number), [1, 4, ENDLESS_ID]); assert.equal(v2.rank('heart'), 2); assert.equal(v2.coins, 50);
}

{
  // Forge and boosts.
  const game = new Campaign(memoryStore()), run = game.beginRun();
  game.collectCoins(run, 5000);
  assert.equal(game.upgradeWeapon('bow').reason, 'run-active');
  game.finishRun(run, { victory: false, time: 1, kills: 0 });
  assert.equal(game.upgradeWeapon('bow').cost, weaponUpgradeCost(0)); assert.equal(game.weapon('bow').level, 1);
  assert.ok(near(game.bonuses('bow').damage, 1.05)); assert.ok(near(game.bonuses('staff').damage, 1), 'Weapon levels belong to one class');
  assert.equal(game.buyWeapon('bow_storm').reason, 'store-only');
  assert.equal(game.equipWeapon('bow_sakura').reason, 'not-owned');
  assert.equal(game.buyWeapon('bow_sakura').ok, true); assert.equal(game.weapon('bow').skin, 'bow_sakura');
  assert.ok(near(game.bonuses('bow').crit, .08), 'Sakura bow gives +8% crit');
  assert.equal(game.equipWeapon('bow').ok, true);
  assert.equal(game.armBoost('xp').ok, true); assert.equal(game.armBoost('xp').reason, 'armed');
  assert.equal(game.armBoost('hp', 'token').reason, 'no-tokens');
  for (let i = 0; i < BOOST_ADS_PER_DAY; i++) { game.state.armedBoosts.length = 0; assert.equal(game.armBoost('relic', 'ad').ok, true); }
  game.state.armedBoosts.length = 0;
  assert.equal(game.armBoost('relic', 'ad').reason, 'daily-limit');
  game.armBoost('coins');
  const next = game.beginRun();
  assert.deepEqual(game.activeRun.boosts, ['coins'], 'Armed boosts go into the run'); assert.deepEqual(game.state.armedBoosts, []);
  game.abandonRun();
  const rolled = rollRelics(3, { min: 'rare', random: () => 0.5 });
  assert.equal(rolled.length, 3); assert.equal(new Set(rolled).size, 3); assert.ok(rolled.every(r => r.rarity !== 'common'));
  assert.ok(next);
}

{
  for (const corrupt of [null, 'not-json', 'null', '[]', '{"version":99,"coins":9999}', '{"version":2,"coins":"9999","unlockedChapter":"5"}']) {
    const game = new Campaign(memoryStore({ [CAMPAIGN_KEY]: corrupt }));
    assert.equal(game.coins, 0); assert.equal(game.selectedChapter, 1);
  }
  const malicious = JSON.parse('{"version":2,"coins":-100,"selectedSkin":"night","ownedSkins":["constructor","classic","classic"],"talents":{"__proto__":{"polluted":true},"heart":3,"body1":99,"unknown":3},"activeRun":{"id":"x","chapterId":9,"loadout":"staff"}}');
  const game = new Campaign(memoryStore({ [CAMPAIGN_KEY]: JSON.stringify(malicious) }));
  assert.equal(game.coins, 0); assert.equal(game.rank('heart'), 3); assert.equal(game.rank('body1'), 5);
  assert.equal(game.selectedSkin, 'classic'); assert.deepEqual(game.state.ownedSkins, ['classic']);
  assert.equal(own(game.state.talents, '__proto__'), false); assert.equal(own(game.state.talents, 'unknown'), false); assert.equal({}.polluted, undefined);
  assert.equal(game.activeRun, null);
  assert.equal(new Campaign(memoryStore({ [CAMPAIGN_KEY]: '{"version":2,"talents":{"body2":3}}' })).rank('body2'), 0, 'A corrupted save cannot skip a prerequisite');
  const legacy = new Campaign(memoryStore({ [LEGACY_KEY]: '{"version":1,"coins":100,"unlockedChapter":3,"talents":{"vigor":2},"ownedSkins":["crimson","indigo"],"selectedSkin":"indigo"}' }));
  assert.equal(legacy.coins, 185, 'Old talents are refunded into the wallet'); assert.equal(legacy.migratedRefund, 85);
  assert.equal(legacy.state.unlockedChapter, 4, 'v1 chapter 3 is chapter 4 of the ten'); assert.equal(legacy.selectedSkin, 'samurai');
  const recolours = new Campaign(memoryStore({ [CAMPAIGN_KEY]: '{"version":2,"ownedSkins":["classic","sakura","jade","night"],"selectedSkin":"jade"}' }));
  assert.deepEqual(recolours.state.ownedSkins, ['classic', 'kitsune', 'dragon', 'ronin'], 'Bought recolours become whole characters'); assert.equal(recolours.selectedSkin, 'dragon');
  const cloud = new Campaign(memoryStore());
  assert.equal(cloud.adopt({ ...legacy.state, totalCollected: 500 }), true); assert.equal(cloud.coins, 185);
  assert.equal(cloud.adopt({ version: 2, totalCollected: 1 }), false, 'An older cloud copy never replaces newer progress');
  const unavailable = new Campaign({ getItem() { throw Error('blocked'); }, setItem() { throw Error('quota'); } });
  const run = unavailable.beginRun();
  assert.equal(unavailable.collectCoins(run, 20).ok, true); assert.equal(unavailable.coins, 20); assert.equal(unavailable.persisted, false);
}

{
  const scene = new THREE.Scene(), coins = new CoinDrops(scene, 3);
  assert.equal(scene.children.length, 1, 'All coins use one render object');
  assert.equal(coins.drop(0, 0, 1), true); coins.drop(1, 0, 2); coins.drop(2, 0, 3); coins.drop(2.1, 0, 4);
  assert.equal(coins.count, 3); assert.equal(coins.value, 10, 'Full pool merges value instead of dropping currency');
  assert.equal(coins.drop(NaN, 0), false); assert.equal(coins.drop(1, 0, -3), false);
  coins.draw(); assert.equal(coins.mesh.count, 3);
  assert.deepEqual(coins.mesh.instanceMatrix.updateRanges, [{ start: 0, count: 48 }]);
  const age = coins.items[0].age;
  assert.equal(coins.update(0, { x: 0, z: 0 }, 10), 0); assert.equal(coins.items[0].age, age, 'Coins freeze on pause');
  let collected = 0, callbacks = 0;
  for (let frame = 0; frame < 90; frame++) coins.update(1 / 60, { x: 0, z: 0 }, 10, value => { collected += value; callbacks++; });
  assert.equal(collected, 10); assert.equal(coins.count, 0);
  assert.ok(callbacks <= 3);
  coins.drop(10, 0, 4); coins.drop(12, 0, 5); coins.draw();
  assert.equal(coins.clear(), 9); assert.equal(coins.mesh.count, 0);
  const size = coins.pool.length; coins.drop(0, 0, 1);
  assert.equal(coins.pool.length, size - 1, 'Dropped coins reuse returned objects');
  coins.dispose(); assert.equal(scene.children.length, 0);
}

{
  const coins = new CoinDrops(new THREE.Scene());
  coins.drop(0, 0, 5); let collected = 0;
  for (let frame = 0; frame < 360; frame++) {
    const t = frame / 60;
    coins.update(1/60, { x: 1.8 * Math.cos(t * 4), z: 1.8 * Math.sin(t * 4) }, 2.4, value => collected += value);
  }
  assert.equal(collected, 5, 'Magnetised coins catch a moving player instead of orbiting indefinitely');
  coins.dispose();
}
console.log('Campaign regression passed: ten chapters plus endless, banked coins, 57-node advancement tree, forge, boosts, artifacts, v2 migration, revive prices, ad and store rewards, records, v1 migration, corrupted saves and bounded pickups.');
