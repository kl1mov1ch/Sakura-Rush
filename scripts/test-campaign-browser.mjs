import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = createRequire(resolve(process.env.PLAYWRIGHT_MODULES, 'package.json'))('playwright'); }
const executablePath = process.env.BROWSER_EXECUTABLE || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
const browser = await pw.chromium.launch({ executablePath, headless: true });
const report = { checks: [], errors: [] }, check = name => { report.checks.push(name); console.log('PASS', name); };
const url = process.env.GAME_URL || pathToFileURL(resolve('play/SakuraRush.html')).href;
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('pageerror', e => report.errors.push(e.message));
page.on('console', e => { if (e.type() === 'error') report.errors.push(e.text()); });
try {
  await page.goto(url);
  await page.waitForFunction(() => window.__sakuraBooted);
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 9);
  await page.locator('.tab-bar [data-lobby-tab=talents]').click();
  assert.equal(await page.locator('.adv-node').count(), 57);
  assert.equal(await page.locator('.adv-node.challenge').count(), 7);
  assert.equal(await page.locator('#buy-talent').isDisabled(), true);
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__game.state), 'title');
  check('Locked chapters, 57-node advancement map and menu keyboard isolation');

  // Earn test currency through the same run wallet API used by real pickups.
  await page.evaluate(() => {
    const g = window.__game, id = g.campaign.beginRun(1, 'bow');
    g.campaign.collectCoins(id, 1200);
    g.campaign.finishRun(id, { victory: false, time: 60, kills: 10 });
    g.lobby.render();
  });
  await page.locator('[data-talent=heart]').click();
  await page.locator('#buy-talent').click();
  assert.equal(await page.evaluate(() => window.__game.campaign.rank('heart')), 1);
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), 1185);
  assert.equal(await page.locator('[data-talent=heart] em').textContent(), '1/5');
  await page.locator('[data-talent=body1]').click();
  assert.equal(await page.locator('#buy-talent').isDisabled(), false);
  await page.locator('#buy-talent').click();
  await page.screenshot({ path: 'docs/ui-talent-tree.png' });
  check('Buying a star debits its exact price, lights it and unlocks the next node');

  await page.locator('.tab-bar [data-lobby-tab=shop]').click();
  await page.locator('[data-skin=samurai]').click();
  assert.equal(await page.evaluate(() => window.__game.player.skin), 'samurai');
  await page.waitForFunction(() => window.__game.player.hero !== window.__game.player.heroes[window.__game.player.weaponType], null, { timeout: 30000 });
  assert.equal(await page.evaluate(() => window.__game.campaign.selectedSkin), 'classic', 'Preview must not silently equip an unowned skin');
  await page.locator('#skin-action').click();
  await page.locator('#confirm:not(.hidden)').waitFor();
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), 1165, 'Nothing is charged before the player confirms');
  await page.locator('#confirm-ok').click();
  assert.equal(await page.evaluate(() => window.__game.campaign.selectedSkin), 'samurai');
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), 265);
  await page.locator('#confirm-ok').click(); // close the receipt
  await page.locator('#confirm').waitFor({ state: 'hidden' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'docs/ui-shop.png' });
  check('Whole-character skin preview, purchase confirmation and receipt use the saved wallet');

  await page.reload();
  await page.waitForFunction(() => window.__sakuraBooted);
  assert.deepEqual(await page.evaluate(() => [window.__game.campaign.coins, window.__game.campaign.rank('heart'), window.__game.campaign.selectedSkin]), [265,1,'samurai']);
  await page.locator('.class-card[data-loadout=bow]').click();
  await page.locator('#startbtn').click();
  assert.equal(await page.evaluate(() => window.__game.player.maxHp), 112);
  assert.equal(await page.evaluate(() => window.__game.abilities.stats.speed), 1);
  await page.evaluate(() => { const g = window.__game; g.player.iframe = 10000; g.coinDrops.drop(g.player.x, g.player.z, 25); });
  await page.waitForFunction(() => window.__game.campaign.coins >= 290);
  await page.waitForFunction(() => document.getElementById('run-coins').textContent === '25');
  assert.equal(await page.locator('#run-coins').textContent(), '25');
  check('Reload preserves purchases, permanent stats apply, physical coins reach the wallet');

  await page.locator('#pausebtn').click();
  const paused = await page.evaluate(() => window.__game.runElapsed);
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__game.runElapsed), paused);
  await page.locator('#leave-run').click();
  assert.equal(await page.locator('#gameover').isVisible(), true, 'Leaving shows the coins earned in the run');
  await page.locator('#restartbtn').click();
  assert.equal(await page.evaluate(() => window.__game.state), 'title');
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), 290);
  assert.equal(await page.evaluate(() => window.__game.enemies.list.length + window.__game.coinDrops.count + window.__game.vfx.live.length), 0);
  check('Pause freezes the ten-minute clock; leaving retains money and clears actors/effects');

  await page.locator('.class-card[data-loadout=staff]').click();
  await page.locator('#startbtn').click();
  await page.evaluate(() => { const g = window.__game; g.player.iframe = 10000; g.runElapsed = 599.99; });
  await page.waitForFunction(() => window.__game.state === 'victory');
  assert.equal(await page.evaluate(() => window.__game.campaign.state.unlockedChapter), 2);
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), 400);
  const bank = await page.evaluate(() => { const g = window.__game; g.completeChapter(); g.finishRun(true); return g.campaign.coins; });
  assert.equal(bank, 400, 'Completing twice must never duplicate victory money');
  await page.screenshot({ path: 'docs/ui-chapter-victory.png' });
  await page.locator('#restartbtn').click();
  await page.waitForFunction(() => window.__game.state === 'title');
  assert.equal(await page.evaluate(() => window.__game.chapter.id), 2);
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 8);
  check('Ten-minute completion awards once, opens chapter II and returns to the same live menu');

  await page.locator('#startbtn').click();
  await page.evaluate(() => { const g = window.__game; g.player.iframe = 10000; g.coinDrops.drop(g.player.x,g.player.z,10); });
  await page.waitForFunction(() => window.__game.campaign.coins >= 411);
  assert.equal(await page.evaluate(() => window.__game.world.chapter.biome), 'bamboo');
  assert.ok(await page.evaluate(() => window.__game.world.decor.find(d => d.name === 'nature_bamboo').model.mesh.count > 0));
  await page.evaluate(() => { const g = window.__game; g.finishRun(false); g.showResults(false); });
  assert.equal(await page.evaluate(() => window.__game.campaign.activeRun), null);
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), 411);
  await page.locator('#restartbtn').click();
  await page.waitForFunction(() => window.__game.state === 'title');
  check('Chapter coin multiplier applies once, real bamboo renders, death retains earnings');

  // Walk through every remaining chapter using the actual game completion path.
  for (let chapter = 2; chapter <= 10; chapter++) {
    await page.locator(`[data-chapter="${chapter}"]`).click();
    await page.locator('#startbtn').click();
    await page.evaluate(() => { const g = window.__game; g.player.iframe = 10000; g.runElapsed = 599.99; });
    await page.waitForFunction(() => window.__game.state === 'victory');
    await page.locator('#restartbtn').click();
    await page.waitForFunction(() => window.__game.state === 'title');
  }
  assert.equal(await page.locator('[data-chapter]:disabled').count(), 0);
  assert.equal(await page.evaluate(() => Object.values(window.__game.campaign.state.chapters).filter(c => c.wins > 0).length), 10);
  check('All ten chapter completions and repeated menu/run transitions work');

  if (process.argv.includes('--soak')) {
    await page.locator('[data-chapter="1"]').click();
    await page.locator('.class-card[data-loadout=staff]').click();
    await page.locator('#startbtn').click();
    report.soak = await page.evaluate(() => {
      const g = window.__game, start = performance.now();
      // Invulnerability isolates lifecycle, spawning and storage from player skill.
      g.player.iframe = 1e9;
      for (const name of Object.getOwnPropertyNames(Object.getPrototypeOf(g.audio))) if (name !== 'constructor') g.audio[name] = () => {};
      g.input.move = () => [Math.cos(g.time * .19), Math.sin(g.time * .19)];
      const peaks = { enemies: 0, coins: 0, gems: 0, pending: 0, arrows: 0, orbs: 0 };
      let choices = 0;
      for (let i = 0; i < 36010 && g.state !== 'victory'; i++) {
        while (g.state === 'levelup' || g.state === 'relic') { if (g.state === 'levelup') { g.choose(0); choices++; } else g.chooseRelic(0); }
        g.update(1/60); g.vfx.update(1/60);
        peaks.enemies = Math.max(peaks.enemies,g.enemies.list.length);
        peaks.coins = Math.max(peaks.coins,g.coinDrops.count);
        peaks.gems = Math.max(peaks.gems,g.gems.length);
        peaks.pending = Math.max(peaks.pending,g.abilities.pendingShots.length);
        peaks.arrows = Math.max(peaks.arrows,g.abilities.arrows.filter(p=>p.active).length);
        peaks.orbs = Math.max(peaks.orbs,g.abilities.orbs.filter(p=>p.active).length);
      }
      return { accelerated: true, invulnerable: true, state: g.state, seconds: g.runElapsed, kills: g.enemies.kills, level: g.level, choices, peaks, elapsedMs: Math.round(performance.now()-start) };
    });
    assert.equal(report.soak.state,'victory'); assert.equal(report.soak.seconds,600);
    assert.ok(report.soak.choices >= 12, 'A ten-minute run must offer enough development for a ranged build');
    assert.ok(report.soak.peaks.enemies <= 604 && report.soak.peaks.coins <= 256 && report.soak.peaks.gems <= 700);
    assert.ok(report.soak.peaks.arrows <= 112 && report.soak.peaks.orbs <= 40 && report.soak.peaks.pending <= 16);
    await page.locator('#restartbtn').click();
    await page.waitForFunction(() => window.__game.state === 'title');
    check('Full 600-second accelerated simulation: real waves, auto-picked upgrades and bounded pools');
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.tab-bar [data-lobby-tab=talents]').click();
  await page.screenshot({ path: 'docs/ui-mobile-talents.png', fullPage: true });
  assert.ok(await page.locator('#talent-scroll').evaluate(el => el.getBoundingClientRect().right <= innerWidth));
  await page.locator('[data-talent=mage1]').click();
  await page.locator('#buy-talent').click();
  assert.equal(await page.evaluate(() => window.__game.campaign.rank('mage1')), 1);
  check('Mobile talent tree fits the viewport and remains interactive');

  // Forge, boosts and chest artifacts.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { const g = window.__game, id = g.campaign.beginRun(1, 'staff'); g.campaign.collectCoins(id, 3000); g.campaign.finishRun(id, { victory: false, time: 1, kills: 0 }); g.lobby.render(); });
  await page.locator('.tab-bar [data-lobby-tab=forge]').click();
  await page.locator('[data-weapon=staff_moon]').click();
  const before = await page.evaluate(() => window.__game.campaign.coins);
  await page.locator('#weapon-upgrade').click();
  assert.equal(await page.evaluate(() => window.__game.campaign.weapon('staff').level), 1);
  await page.locator('#weapon-action').click();
  await page.locator('#confirm:not(.hidden)').waitFor();
  await page.locator('#confirm-ok').click();
  await page.locator('#confirm-ok').click();
  assert.equal(await page.evaluate(() => window.__game.campaign.weapon('staff').skin), 'staff_moon');
  assert.equal(await page.evaluate(() => window.__game.campaign.coins), before - 120 - 2400);
  await page.waitForFunction(() => window.__game.player.hero.weaponModel === 'w_staff_moon', null, { timeout: 30000 });
  await page.screenshot({ path: 'docs/ui-forge.png' });
  check('Forge upgrades the class weapon and the bought look appears in the hero hands');
  await page.locator('.tab-bar [data-lobby-tab=play]').click();
  await page.locator('[data-chapter="1"]').click();
  await page.locator('[data-boost=hp][data-via=coins]').click();
  assert.equal(await page.evaluate(() => window.__game.campaign.isArmed('hp')), true);
  await page.locator('#startbtn').click();
  assert.equal(await page.evaluate(() => window.__game.player.maxHp), 152, 'Talents plus the +40 health boost');
  await page.evaluate(() => { const g = window.__game; g.player.iframe = 1e9; g.spawnChest(g.player.x + 0.5, g.player.z); });
  // The chest may also hand out a level first: take those cards until the artifact pick shows.
  await page.waitForFunction(() => { const g = window.__game; if (g.state === 'levelup') g.choose(0); return g.state === 'relic'; }, null, { timeout: 10000 });
  await page.locator('#relicpick:not(.hidden)').waitFor({ timeout: 10000 });
  assert.equal(await page.locator('.relic-card').count(), 3);
  await page.locator('.relic-card').first().click();
  assert.equal(await page.evaluate(() => [window.__game.state, window.__game.relics.length]).then(r => r.join()), 'play,1');
  assert.equal(await page.locator('#hud-relics .relic-chip').count(), 1);
  check('Boost armed in the menu applies to the run; a chest offers three artifacts and the pick shows in the HUD');
  assert.deepEqual(report.errors, []);
  check('No runtime or shader errors across campaign, purchases and previews');
} finally {
  writeFileSync('docs/campaign-browser-check.json', JSON.stringify(report,null,2));
  await browser.close();
}
