import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  if (!process.env.PLAYWRIGHT_MODULES) throw new Error('Set PLAYWRIGHT_MODULES to a node_modules folder containing playwright, or install playwright locally.');
  playwright = createRequire(resolve(process.env.PLAYWRIGHT_MODULES, 'package.json'))('playwright');
}
const executablePath = process.env.BROWSER_EXECUTABLE || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync);
const browser = await playwright.chromium.launch({ executablePath, headless: true });
const report = { checks: [], errors: [] };
mkdirSync('docs', { recursive: true });
const url = process.env.GAME_URL || 'http://127.0.0.1:5173';
const check = (name) => { report.checks.push(name); console.log('PASS', name); };
const watch = (page) => {
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('favicon.ico')) report.errors.push(message.text()); });
};
const boot = async (page, address = url) => {
  watch(page);
  await page.goto(address);
  await page.waitForFunction(() => window.__game && !document.getElementById('startbtn').classList.contains('hidden'), { timeout: 30000 });
};
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await boot(page);
  for (const [equipment, starter] of [['bow', 'arrow'], ['staff', 'arcane'], ['sword', 'katana']]) {
    await page.locator(`.class-card[data-loadout="${equipment}"]`).click();
    assert.deepEqual(await page.evaluate(() => Object.keys(window.__game.abilities.levels)), [starter]);
    assert.equal(await page.evaluate(() => window.__game.player.weaponType), equipment);
    assert.equal(await page.evaluate(() => window.__game.state), 'title');
    assert.equal(await page.locator(`.class-card[data-loadout="${equipment}"]`).getAttribute('aria-pressed'), 'true');
  }
  await page.locator('.class-card[data-loadout="bow"]').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => window.__game.state), 'title', 'Selecting equipment with Space must not start a run');
  await page.keyboard.press('Digit1');
  await page.locator('.class-card[data-loadout="sword"]').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => window.__game.selectedLoadout), 'bow');
  await page.keyboard.press('Digit1');
  check('Equipment selection previews correct weapons and supports keyboard navigation');
  await page.screenshot({ path: 'docs/ui-title.png' });
  await page.locator('#startbtn').click();
  await page.waitForFunction(() => window.__game.time > .5);
  assert.equal(await page.evaluate(() => window.__game.input.enabled), true);
  assert.ok(await page.evaluate(() => document.getElementById('hud-actions').getBoundingClientRect().top > document.getElementById('kills').getBoundingClientRect().bottom), 'HUD buttons must not cover the counters');
  check('Start enables gameplay input');
  const beforeMove = await page.evaluate(() => window.__game.player.x);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(220);
  await page.keyboard.up('KeyD');
  assert.ok(await page.evaluate(x => window.__game.player.x > x + .1, beforeMove));
  await page.keyboard.press('Space');
  await page.waitForTimeout(60);
  assert.ok(await page.evaluate(() => window.__game.player.dashCd > 0));
  check('Keyboard movement and dash');
  await page.locator('#pausebtn').click();
  const paused = await page.evaluate(() => ({ time: window.__game.time, x: window.__game.player.x, hp: window.__game.player.hp }));
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(() => ({ time: window.__game.time, x: window.__game.player.x, hp: window.__game.player.hp })), paused);
  assert.equal(await page.evaluate(() => window.__game.input.enabled), false);
  check('Pause freezes simulation and clears controls');
  await page.locator('#pause [data-open-settings]').click();
  assert.equal(await page.locator('#settings').isVisible(), true);
  for (const quality of ['2', '1', '0', 'auto']) {
    await page.locator('#set-quality').selectOption(quality);
    assert.equal(await page.evaluate(() => window.__game.qualityMode), quality);
    await page.waitForTimeout(80);
  }
  check('All graphics settings apply');
  assert.equal(await page.locator('#effects-toggle').isChecked(), true);
  assert.equal(await page.evaluate(() => window.__game.vfx.calm), true);
  check('Calm effects enabled by default');
  await page.locator('#set-numbers').uncheck();
  assert.equal(await page.evaluate(() => window.__game.vfx.showNumbers), false);
  await page.locator('#set-numbers').check();
  await page.locator('#set-volume').fill('40');
  assert.equal(await page.evaluate(() => window.__game.audio.volume), .4);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('sakura-rush-settings')).volume), .4);
  check('Settings change volume and damage numbers and are remembered');
  await page.screenshot({ path: 'docs/ui-settings.png' });
  await page.locator('#settings-close').click();
  await page.screenshot({ path: 'docs/ui-pause.png' });
  await page.locator('#resumebtn').click();
  await page.evaluate(() => { const g = window.__game; g.pendingLevels = 1; g.openLevelUp(); });
  assert.equal(await page.locator('#cards .card').count(), 4, 'Four cards to choose from on every level');
  assert.ok(await page.locator('#cards .card .name').first().textContent());
  assert.equal(await page.locator('#cards .card .icon .preview img').count(), 4, 'Every card plays its Blender preview');
  assert.ok(await page.locator('#cards .card .preview img').first().evaluate(img => img.complete && img.naturalWidth === 12 * 192), 'Preview strips hold 12 frames');
  await page.screenshot({ path: 'docs/ui-upgrades.png' });
  await page.locator('#cards .card').first().focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => window.__game.state), 'play');
  check('Upgrade cards support keyboard selection and resume input');
  await page.evaluate(() => {
    const g = window.__game;
    g.nextSwarm = g.nextBoss = Infinity;
    g.addXp = () => {};
    for (let i = 0; i < 420; i++) {
      const a = i * 2.399963, r = 5 + i % 12;
      g.enemies.spawn(['ashigaru', 'bat', 'yurei', 'oni'][i % 4], g.player.x + Math.cos(a) * r, g.player.z + Math.sin(a) * r);
    }
    g.player.iframe = 1000;
  });
  await page.waitForTimeout(1500);
  report.frameTiming = await page.evaluate(async () => {
    const samples = [];
    let last = performance.now();
    await new Promise(resolve => {
      const tick = now => {
        samples.push(now - last); last = now;
        if (samples.length >= 75) resolve(); else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    samples.splice(0, 5); samples.sort((a, b) => a - b);
    return { medianMs: +samples[Math.floor(samples.length * .5)].toFixed(2), p95Ms: +samples[Math.floor(samples.length * .95)].toFixed(2), sampledFrames: samples.length, enemies: window.__game.enemies.list.length, quality: window.__game.qualityLevel };
  });
  await page.screenshot({ path: 'docs/ui-battle.png' });
  await page.evaluate(() => { const g = window.__game; g.spawnChest(g.player.x + 1, g.player.z); });
  await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__game.chests.every(c => c.opened)), true);
  check('Touching a chest opens it and grants a reward');
  await page.evaluate(() => { const g = window.__game; g.abilities.levels.katana = 4; g.pendingLevels = 1; g.offers = []; g.abilities.offers = () => ['katana', 'swift', 'might']; g.openLevelUp(); });
  assert.equal(await page.locator('#cards .card.super').count(), 1);
  await page.screenshot({ path: 'docs/ui-awakening.png' });
  await page.locator('#cards .card.super').click();
  assert.equal(await page.evaluate(() => window.__game.abilities.isSuper('katana')), true);
  check('Level five card awakens a super ability');
  report.metrics = await page.evaluate(() => ({ ...window.__game.metrics, enemies: window.__game.enemies.list.length, glError: window.__game.renderer.getContext().getError(), geometries: window.__game.renderer.info.memory.geometries, textures: window.__game.renderer.info.memory.textures }));
  assert.equal(report.metrics.glError, 0);
  check('Crowd renders without WebGL errors');
  await page.locator('#soundbtn').click();
  assert.equal(await page.evaluate(() => window.__game.audio.muted), true);
  check('Sound button toggles audio');
  await page.evaluate(() => { window.__game.player.iframe = 0; window.__game.playerDown(); });
  assert.equal(await page.locator('#revive').isVisible(), true, 'A fallen hero is offered a second chance first');
  await page.screenshot({ path: 'docs/ui-revive.png' });
  await page.locator('#revive-skip').click();
  assert.equal(await page.locator('#gameover').isVisible(), true);
  await page.screenshot({ path: 'docs/ui-results.png' });
  assert.equal(await page.evaluate(() => window.__game.input.enabled), false);
  check('Game over stops controls and presents restart');
  await page.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const phone = await mobile.newPage();
  await boot(phone);
  await phone.screenshot({ path: 'docs/ui-mobile-title.png' });
  await phone.locator('#startbtn').tap();
  await phone.waitForFunction(() => window.__game.state === 'play');
  assert.equal(await phone.locator('#dashbtn').isVisible(), true);
  assert.ok(await phone.evaluate(() => document.getElementById('hud-actions').getBoundingClientRect().top > document.getElementById('kills').getBoundingClientRect().bottom), 'Mobile HUD buttons must not cover the counters');
  const x = await phone.evaluate(() => window.__game.player.x);
  const cdp = await mobile.newCDPSession(phone);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 41, x: 90, y: 580 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 41, x: 142, y: 580 }] });
  await phone.waitForTimeout(200);
  assert.ok(await phone.evaluate(before => window.__game.player.x > before + .1, x));
  const dash = await phone.locator('#dashbtn').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 41, x: 142, y: 580 }, { id: 42, x: dash.x + dash.width / 2, y: dash.y + dash.height / 2 }] });
  await phone.waitForTimeout(50);
  assert.ok(await phone.evaluate(() => window.__game.player.dashCd > 0));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  check('Mobile joystick and independent dash work together');
  await phone.screenshot({ path: 'docs/ui-mobile-battle.png' });
  await phone.evaluate(() => { window.__game.pendingLevels = 1; window.__game.openLevelUp(); });
  const fits = await phone.locator('#cards').evaluate(el => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
  assert.ok(fits);
  await phone.screenshot({ path: 'docs/ui-mobile-upgrades.png' });
  await phone.locator('#cards .card').first().tap();
  check('Mobile upgrade cards fit screen and remain usable');
  await mobile.close();

  report.loadouts = [];
  for (const [equipment, starter, techniques] of [
    ['bow', 'arrow', ['arrow', 'ricochet', 'arrowrain', 'frost']],
    ['staff', 'arcane', ['arcane', 'runeburst', 'meteor', 'lightning']],
  ]) {
    const ranged = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await boot(ranged);
    await ranged.locator(`.class-card[data-loadout="${equipment}"]`).click();
    await ranged.reload();
    await ranged.waitForFunction(() => window.__sakuraBooted);
    assert.equal(await ranged.evaluate(() => window.__game.selectedLoadout), equipment);
    assert.deepEqual(await ranged.evaluate(() => Object.keys(window.__game.abilities.levels)), [starter]);
    await ranged.locator('#startbtn').click();
    const targetId = await ranged.evaluate(() => {
      const g = window.__game;
      g.player.iframe = 1000; g.addXp = () => {};
      return g.enemies.spawn('oni', g.player.x, g.player.z + 7, 200).id;
    });
    await ranged.waitForFunction(id => window.__game.enemies.list.some(e => e.id === id && e.hp < e.maxHp), targetId, { timeout: 12000 });
    assert.equal(await ranged.evaluate(() => window.__game.player.heroes.sword.model.visible), false);
    assert.equal(await ranged.evaluate(id => window.__game.player.heroes[id].model.visible, equipment), true);
    assert.equal(await ranged.evaluate(() => window.__game.selectLoadout('sword')), false);
    check(`${equipment}: remembered loadout, correct held model, real ranged hits and no mid-run equipment reset`);
    await ranged.screenshot({ path: `docs/weapon-${equipment}-game.png` });
    await ranged.evaluate(ids => {
      const g = window.__game;
      g.abilities.levels = Object.fromEntries(ids.map(id => [id, 5]));
      g.abilities.timers = {};
      g.renderSkills();
      for (let i = 0; i < 360; i++) {
        const a = i * 2.399963, r = 4 + i % 15;
        g.enemies.spawn(['ashigaru', 'bat', 'yurei', 'oni'][i % 4], g.player.x + Math.cos(a) * r, g.player.z + Math.sin(a) * r, 10000);
      }
    }, techniques);
    await ranged.waitForTimeout(3200);
    const timing = await ranged.evaluate(async () => {
      const deltas = []; let last = performance.now();
      await new Promise(resolve => {
        const step = now => { deltas.push(now - last); last = now; if (deltas.length === 65) resolve(); else requestAnimationFrame(step); };
        requestAnimationFrame(step);
      });
      deltas.splice(0, 5); deltas.sort((a, b) => a - b);
      const g = window.__game;
      return { medianMs: +deltas[30].toFixed(2), p95Ms: +deltas[57].toFixed(2), enemies: g.enemies.list.length, quality: g.qualityLevel, glError: g.renderer.getContext().getError(), drawCalls: g.metrics.drawCalls, geometries: g.renderer.info.memory.geometries };
    });
    assert.equal(timing.glError, 0);
    report.loadouts.push({ equipment, ...timing });
    await ranged.screenshot({ path: `docs/weapon-${equipment}-stress.png` });
    await ranged.locator('#pausebtn').click();
    const pausedTime = await ranged.evaluate(() => window.__game.time);
    await ranged.waitForTimeout(200);
    assert.equal(await ranged.evaluate(() => window.__game.time), pausedTime);
    check(`${equipment}: four awakened techniques and a large crowd render without errors; pause remains stable`);
    await ranged.close();
  }

  if (existsSync('play/SakuraRush.html') && process.env.TEST_OFFLINE === '1') {
    const offline = await browser.newPage();
    await boot(offline, pathToFileURL(resolve('play/SakuraRush.html')).href);
    await offline.locator('#startbtn').click();
    await offline.waitForFunction(() => window.__game.time > .25);
    check('Standalone offline HTML starts without a server');
    await offline.close();
  }
  assert.deepEqual(report.errors, [], 'No runtime or shader errors');
  check('No runtime or shader errors');
} finally {
  writeFileSync('docs/browser-check.json', JSON.stringify(report, null, 2));
  await browser.close();
}
