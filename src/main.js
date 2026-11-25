window.__sakuraModuleStarted = true; // lets the boot guard in index.html know the bundle is running
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { loadAssets, bakeMerged, InstancedModel, toonify } from './assets.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Enemies } from './enemies.js';
import { Hazards } from './hazards.js';
import { Abilities, ABILITIES, getAbilityUpgradeText, getAbilityStats } from './abilities.js';
import { VFX, Particles, CELL } from './vfx.js';
import { Audio } from './audio.js';
import { Input } from './input.js';
import { abilityArt, abilityPreview } from './art.js';
import { platform, BOARDS } from './platform.js';
import { LOADOUTS, FAMILY_LABELS, isLoadout } from './loadouts.js';
import { Campaign, RUN_SECONDS, PRODUCTS } from './progression.js';
import { RARITY, rollRelics, getRelic } from './relics.js';
import { CoinDrops } from './coins.js';
import { Lobby } from './lobby.js';

const $ = (id) => document.getElementById(id);
// Souls are magatama beads; colour tells their worth.
const GEM_TIERS = [
  { min: 0, color: '#5fb8ff', emit: [0.3, 0.7, 1.6], scale: 1.0 },
  { min: 5, color: '#5fe39a', emit: [0.3, 1.4, 0.7], scale: 1.25 },
  { min: 20, color: '#ff5fa2', emit: [1.7, 0.35, 0.8], scale: 1.6 },
];
// Rare drops lying on the battlefield; walking over them uses them at once.
const PICKUPS = {
  onigiri: { scale: 1.7, chance: 1 / 110 },
  ofuda: { scale: 1.6, chance: 1 / 400 },
  bomb: { scale: 1.6, chance: 1 / 500 },
  scroll: { scale: 1.6, chance: 1 / 620 },
};
// What a chest can hold. Boss chests always add the shogun's treasure.
const CHEST_REWARDS = [
  { id: 'heal', w: 3, name: 'Целебный чай', icon: '🍵', desc: 'Здоровье восстановлено полностью' },
  { id: 'magnet', w: 3, name: 'Магнит', icon: '🧲', desc: 'Все кристаллы летят к тебе' },
  { id: 'xp', w: 3, name: 'Свиток мастера', icon: '📜', desc: 'Мгновенный новый уровень' },
  { id: 'bomb', w: 2, name: 'Огненная печать', icon: '💥', desc: 'Взрыв сжигает ёкаев вокруг' },
  { id: 'fury', w: 2, name: 'Ярость', icon: '🔥', desc: '+50% урона на 20 секунд' },
  { id: 'wind', w: 2, name: 'Сандалии тэнгу', icon: '💨', desc: '+35% скорости на 20 секунд' },
  { id: 'ward', w: 1.5, name: 'Оберег омамори', icon: '🛡️', desc: 'Неуязвимость на 6 секунд' },
];
const TREASURE = { id: 'treasure', name: 'Сокровище сёгуна', icon: '👑', desc: 'Одна из техник стала сильнее' };
const BUFFS = { fury: ['🔥', 'Ярость'], wind: ['💨', 'Ветер'], ward: ['🛡️', 'Оберег'] };
const SETTINGS_KEY = 'sakura-rush-settings';
const DEFAULT_SETTINGS = { volume: 0.7, quality: 'auto', calm: true, shake: false, numbers: true, hints: true, ui: 1, zoom: 1.05 };
const REVIVE_SECONDS = 10;
const rating = (rank, next = false, max = 5) => `<span class="ability-stars" aria-label="${rank} из ${max} звёзд">${Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'lit' : next && i === rank ? 'next' : ''}">★</i>`).join('')}</span>`;
export const formatTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

class Game {
  constructor(assets) {
    this.assets = assets;
    this.campaign = new Campaign();
    this.campaign.abandonRun();
    this.campaign.onChange = (state) => platform.saveProgress(state);
    this.chapter = this.campaign.chapter;
    this.runElapsed = 0; this.runId = null;
    const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.info.autoReset = false;
    $('app').appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, 0.5, 200);

    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 0 });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.4, 1.0);
    this.composer.addPass(this.bloom);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.composer.addPass(new OutputPass());

    this.vfx = new VFX(this.scene, this.camera);
    this.world = new World(this.scene, assets, renderer);
    this.world.setChapter(this.chapter);
    this.player = new Player(this.scene, assets);
    this.player.collider = this.world;
    this.enemies = new Enemies(this.scene, assets);
    this.hazards = new Hazards(this.scene, assets);
    this.audio = new Audio();
    this.input = new Input();
    this.input.onDash = () => this.audio.dash();
    this.abilities = new Abilities(this.scene, assets, this);
    this.coinDrops = new CoinDrops(this.scene);
    this.selectedLoadout = this.campaign.selectedClass;

    const gemGeo = bakeMerged(assets.gem);
    this.gemModels = GEM_TIERS.map((t) => {
      const g = gemGeo.clone();
      const c = new THREE.Color(t.color);
      const col = g.attributes.color.array, em = g.attributes.emit.array;
      for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; em.set(t.emit, i); }
      return new InstancedModel(this.scene, g, 700);
    });
    this.gems = [];
    this.pickupModels = Object.fromEntries(Object.keys(PICKUPS).map((k) => [k, new InstancedModel(this.scene, bakeMerged(assets[k]), 40)]));
    this.pickups = [];
    // Chests are few, so each is a real object whose lid can swing open.
    const beamMaterial = new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const beamGeometry = new THREE.CylinderGeometry(0.22, 0.5, 5, 12, 1, true).translate(0, 2.5, 0);
    this.chestPool = Array.from({ length: 5 }, () => {
      const group = new THREE.Group();
      const model = assets.chest.clone(true);
      toonify(model);
      model.scale.setScalar(1.15);
      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      group.add(model, beam);
      group.visible = false;
      this.scene.add(group);
      return { group, model, beam, lid: model.getObjectByName('Lid'), active: false };
    });
    this.chests = [];
    this.buffs = { fury: 0, wind: 0, ward: 0 };

    this.time = 0; this.level = 1; this.xp = 0; this.combo = 0; this.comboT = 0; this.wave = 1;
    this.state = 'title';
    this.resetDirector();
    this.shakeAmt = 0; this.slowmo = 0; this.pendingLevels = 0; this.levelDelay = 0;
    this.camPos = new THREE.Vector3(0, 16, 12);
    this.cameraZoom = 1.05;
    this._ui = {};
    this._wantCam = new THREE.Vector3();
    this._lookAt = new THREE.Vector3();
    this._hudElapsed = 0;
    this.qualityMode = 'auto';
    this.calmEffects = true;
    this.motionReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.qualityLevel = 0;
    this.metrics = { fps: null, frameMs: null, enemies: 0, drawCalls: 0 };
    this.applyQuality(1);

    addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onKey = (code) => this.onKey(code);
    $('resumebtn').onclick = () => this.togglePause();
    $('restartbtn').onclick = () => this.restart();
    $('leave-run').onclick = () => { this.finishRun(false); this.showResults(false); };
    $('revive-ad').onclick = () => this.reviveForAd();
    $('revive-coins').onclick = () => this.reviveForCoins();
    $('revive-skip').onclick = () => this.declineRevive();
    $('double-ad').onclick = () => this.doubleForAd();
    $('rerollbtn').onclick = () => this.reroll(false);
    $('reroll-ad').onclick = () => this.reroll(true);
    $('relic-cards').onclick = e => { const b = e.target.closest('[data-relic]'); if (b) this.chooseRelic(+b.dataset.relic); };
    $('relic-all').onclick = () => this.takeAllRelics();
    // Platform overlays (ads, dialogs) pause the run silently and mute the sound.
    platform.on('pause', () => {
      this.audio.ctx?.suspend();
      if (this.state === 'play') { this._platformPaused = true; this.setState('pause'); }
    });
    platform.on('resume', () => {
      if (!document.hidden) this.audio.ctx?.resume();
      if (this._platformPaused) { this._platformPaused = false; if (this.state === 'pause' && $('pause').classList.contains('hidden')) this.setState('play'); }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.audio.ctx?.suspend(); else if (!platform.adOpen) this.audio.ctx?.resume(); });
    addEventListener('contextmenu', (e) => e.preventDefault());
    // Menu clicks get sound too; browsers only allow audio after a user gesture.
    addEventListener('pointerdown', () => this.audio.init(), { once: true });
    $('pausebtn').onclick = () => this.togglePause();
    $('soundbtn').onclick = () => this.toggleSound();
    this.initSettings();
    addEventListener('blur', () => { if (this.state === 'play') this.togglePause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'play') this.togglePause(); });
    renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      if (this.state === 'play') this.togglePause();
      $('pause-message').textContent = 'Графика временно недоступна. После восстановления можно продолжить.';
    });
    renderer.domElement.addEventListener('webglcontextrestored', () => {
      $('pause-message').textContent = 'Графика восстановлена. Можно продолжить.';
      this.resize();
    });
    this.lobby = new Lobby(this, this.campaign);
    this.selectLoadout(this.selectedLoadout, false);
    this.applySkin(this.campaign.selectedSkin);
    this.lobby.show('play');
  }

  resetDirector() {
    this.spawnAcc = 0; this.nextSwarm = 45; this.nextBoss = 180; this.nextChest = 50; this.nextElite = 65; this.soulCallT = 15;
  }

  applySkin(id) { this.player.onSkinReady = () => { this._renderDirty = true; }; this.player.applySkin(id, this.campaign.getSkin(id)); this._renderDirty = true; }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    // Bloom is a soft glow, so it does not need full scene resolution. Merely
    // changing bloom.resolution did not resize its internal render targets.
    const glowScale = this.qualityLevel === 0 ? 0.65 : 0.5;
    this.bloom.setSize(Math.max(2, Math.round(w * this.renderer.getPixelRatio() * glowScale)), Math.max(2, Math.round(h * this.renderer.getPixelRatio() * glowScale)));
    this.fxaa.material.uniforms.resolution.value.set(1 / (w * this.renderer.getPixelRatio()), 1 / (h * this.renderer.getPixelRatio()));
    this._renderDirty = true;
    this.camDist = w / h < 1 ? Math.min(1.35, 1 / Math.pow(w / h, 0.3)) : 1;
    this.vfx.setScale((h * this.renderer.getPixelRatio()) / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))));
  }

  get endless() { return !!this.chapter?.endless; }

  start() {
    if (this.state !== 'title') return;
    if (!$('settings').classList.contains('hidden')) return;
    if (this.lobby.view !== 'play') return;
    this.chapter = this.campaign.chapter;
    this.runId = this.campaign.beginRun(this.chapter.id, this.selectedLoadout);
    if (!this.runId) return;
    this.runElapsed = 0; this.result = null; this.revived = false; this.rerolls = 1; this.adReroll = true; this.wave = 1;
    this.meta = this.campaign.bonuses(this.selectedLoadout);
    this.player.maxHp = 100 + this.meta.maxHp; this.player.hp = this.player.maxHp;
    const stats = this.abilities.stats;
    stats.dmg *= this.meta.damage; stats.speed *= this.meta.speed;
    stats.magnet *= this.meta.magnet; stats.cd *= this.meta.cooldown;
    stats.regen += this.meta.regen; stats.crit += this.meta.crit; stats.critMul += this.meta.critMul;
    stats.dash *= this.meta.dash;
    stats.bossDamage *= this.meta.bossDamage; stats.revive += this.meta.revive; stats.dashGuard = this.meta.dashGuard; stats.relicLuck += this.meta.relicLuck;
    this.rerolls += this.meta.rerolls;
    this.relics = []; this.relicAd = true; this.pendingRelics = 0; this.relicDelay = 0; this.weaponHits = 0; this.weaponKills = 0; this.bloodlust = 0;
    this.weaponLook = this.campaign.weapon(this.selectedLoadout).look;
    this.player.equipWeapon(this.selectedLoadout);
    this.player.setWeaponLook?.(this.weaponLook);
    this.player.resetRun(); this.player.maxHp = 100 + this.meta.maxHp; this.player.hp = this.player.maxHp;
    // Talent capstones and the boosts armed in the menu.
    if (this.meta.startLevel) this.abilities.take(this.abilities.starter);
    const boosts = this.campaign.activeRun?.boosts || [];
    this.runBoosts = boosts;
    if (boosts.includes('hp')) { this.player.maxHp += 40; this.player.hp = this.player.maxHp; }
    if (boosts.includes('xp')) stats.xp += 0.4;
    if (boosts.includes('coins')) stats.coinDrop *= 2;
    const starting = [];
    if (boosts.includes('relic')) starting.push(rollRelics(1, { luck: stats.relicLuck, min: 'rare' })[0]);
    if (this.meta.relicStart) starting.push(rollRelics(1, { luck: stats.relicLuck })[0]);
    for (const relic of starting) this.addRelic(relic, true);
    this.world.setChapter(this.chapter);
    this.world.setDecorVisible(true);
    this.audio.init();
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    document.body.dataset.view = 'battle';
    this.setState('play');
    this.vfx.magicCircle(0, 0, 3, '#ffd23f', 1.1);
    this.vfx.ring(0, 0, 4, '#ffd23f', 0.6);
    this.enemies.spawn('ashigaru', 10, -8);
    this.enemies.spawn('ashigaru', -11, -6);
    const cls = LOADOUTS[this.selectedLoadout];
    this.banner(cls.emoji, this.endless ? 'Бесконечная ночь' : `Глава ${this.chapter.numeral}: ${this.chapter.name}`, this.endless ? 'Каждую минуту ёкаев больше. Продержись подольше!' : 'Продержись 10 минут до рассвета!');
    if (this.campaign.state.tutorial) { setTimeout(() => this.toast('🕹️', 'Беги от ёкаев — герой атакует сам!'), 3400); this.campaign.finishTutorial(); }
  }

  selectLoadout(id, persist = true) {
    if (this.state !== 'title' || !isLoadout(id)) return false;
    if (!this.abilities.setLoadout(id)) return false;
    this.selectedLoadout = id;
    if (persist) this.campaign.selectClass(id);
    this.player.equipWeapon(id);
    this.player.play('Cheer');
    document.body.dataset.loadout = id;
    this.renderSkills();
    this.lobby?.render();
    this._renderDirty = true;
    return true;
  }

  onKey(code) {
    if (!$('settings').classList.contains('hidden')) { if (code === 'Escape') this.closeSettings(); return; }
    if (this.state === 'title' && this.lobby.view !== 'play') { if (code === 'Escape') this.lobby.show('play'); return; }
    if (this.state === 'title' && ['Digit1', 'Digit2', 'Digit3'].includes(code)) {
      this.selectLoadout(Object.keys(LOADOUTS)[+code.slice(5) - 1]);
      return;
    }
    if (this.state === 'title' && (code === 'Enter' || code === 'Space') && !$('startbtn').classList.contains('hidden') && !document.activeElement?.closest('button:not(#startbtn), input, select')) this.start();
    else if (code === 'KeyP' || code === 'Escape') this.togglePause();
    else if (code === 'KeyM') this.toggleSound();
    else if (this.state === 'levelup' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) this.choose(+code.slice(5) - 1);
    else if (this.state === 'relic' && ['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(code)) this.chooseRelic(+code.slice(5) - 1);
    else if (this.state === 'levelup' && code === 'KeyR') this.reroll(false);
  }

  togglePause() {
    if (this.state === 'play') { this.setState('pause'); $('pause').classList.remove('hidden'); }
    else if (this.state === 'pause') { this.closeSettings(); this.setState('play'); $('pause').classList.add('hidden'); this.audio.ctx?.resume(); }
  }

  setState(state) {
    this.state = state;
    platform.gameplay(state === 'play');
    this._renderDirty = true;
    this.input.setEnabled(state === 'play');
    this.player.dashBuffer = 0;
  }

  toggleSound() {
    this.audio.toggle();
    $('soundbtn').textContent = this.audio.muted ? '🔇' : '🔊';
    $('soundbtn').setAttribute('aria-pressed', String(!this.audio.muted));
  }

  // ------------------------------------------------------------ settings
  initSettings() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch { saved = {}; }
    this.settings = { ...DEFAULT_SETTINGS, ...saved };
    const bind = (id, key, read = (el) => el.checked) => {
      const el = $(id);
      if (el.type === 'checkbox') el.checked = !!this.settings[key]; else el.value = this.settings[key];
      el.addEventListener(el.type === 'range' ? 'input' : 'change', () => { this.settings[key] = read(el); this.applySettings(); this.saveSettings(); });
    };
    bind('set-volume', 'volume', (el) => +el.value / 100);
    $('set-volume').value = Math.round(this.settings.volume * 100);
    bind('set-quality', 'quality', (el) => el.value);
    bind('effects-toggle', 'calm');
    bind('set-shake', 'shake');
    bind('set-numbers', 'numbers');
    bind('set-hints', 'hints');
    bind('set-ui', 'ui', (el) => +el.value);
    $('set-zoom').value = Math.round(this.settings.zoom * 100);
    $('set-zoom').addEventListener('input', e => { this.settings.zoom = +e.target.value / 100; this.applySettings(); this.saveSettings(); });
    document.querySelectorAll('[data-open-settings]').forEach((b) => (b.onclick = () => this.openSettings()));
    $('settings-close').onclick = () => this.closeSettings();
    this.applySettings();
  }

  applySettings() {
    const st = this.settings;
    this.audio.volume = st.volume;
    this.audio.applyVolume?.();
    $('volume-value').textContent = Math.round(st.volume * 100) + '%';
    this.calmEffects = st.calm;
    document.body.classList.toggle('calm-effects', st.calm);
    this.vfx.calm = st.calm;
    this.player.calmEffects = st.calm;
    if (st.calm) $('flash').style.opacity = 0;
    if (!st.shake) this.shakeAmt = 0;
    this.vfx.showNumbers = st.numbers;
    document.body.classList.toggle('no-hints', !st.hints);
    document.documentElement.style.setProperty('--ui-scale', st.ui);
    st.zoom = Math.min(1.3, Math.max(0.85, Number(st.zoom) || 1.05));
    $('zoom-value').textContent = Math.round(st.zoom * 100) + '%';
    if (this.qualityMode !== st.quality) {
      this.qualityMode = st.quality;
      this._q = null;
      this.applyQuality(st.quality === 'auto' ? 1 : +st.quality);
    }
  }

  saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* private mode: settings last for this visit */ } }

  openSettings() { $('settings').classList.remove('hidden'); this._renderDirty = true; $('settings-close').focus(); }
  closeSettings() { $('settings').classList.add('hidden'); this._renderDirty = true; }

  shake(a) { if (this.settings.shake && !this.motionReduced) this.shakeAmt = Math.min(0.7, this.shakeAmt + a); }

  // ------------------------------------------------------------- combat
  hurtPlayer(dmg, e) {
    if (this.state !== 'play' || this.player.iframe > 0 || this.buffs.ward > 0) return;
    const p = this.player;
    const armor = Math.min(0.75, (this.meta?.armor || 0) + (this.abilities.stats.armor || 0));
    dmg = Math.max(1, Math.round(dmg * (1 - armor)));
    p.hp -= dmg;
    p.iframe = 0.6;
    this.vfx.number(p.x, 2.2, p.z, '-' + dmg, 'player');
    this.vfx.sparks.burst(p.x, 1, p.z, 10, { speed: 5, life: 0.3, size: 0.5, color: [2, 0.4, 0.5] });
    this.audio.hurt();
    this.shake(0.35);
    const f = $('flash');
    f.style.background = 'radial-gradient(ellipse at center, transparent 45%, rgba(255,60,90,.5))';
    f.style.opacity = this.calmEffects ? 0.25 : 0.45;
    setTimeout(() => (f.style.opacity = 0), 110);
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
    e.kx -= (dx / d) * 6; e.kz -= (dz / d) * 6;
    if (this.abilities.stats.thorns && e.t && e.alive) this.damageEnemy(e, Math.round(this.abilities.stats.thorns * this.abilities.stats.dmg), false, -dx, -dz, 4);
    if (p.hp <= 0 && this.abilities.stats.revive > 0) {
      // Unbending Spirit, the Daruma and the talent: a second life, with a shockwave for room to breathe.
      this.abilities.stats.revive--;
      p.hp = Math.round(p.maxHp * 0.5); p.iframe = 2.5;
      this.explode(p.x, p.z, 7, 120);
      this.banner('💪', 'Несгибаемый дух', 'Герой поднялся снова!');
    }
    if (p.hp <= 0) this.playerDown();
  }

  damageEnemy(e, dmg, crit, kx, kz, knock, quiet = false) {
    if (!e.alive || this.state !== 'play') return;
    const perk = this.weaponLook?.perk;
    if (perk === 'bloodlust') dmg = Math.round(dmg * (1 + this.bloodlust));
    if (perk && !this._perkBusy) this.weaponPerk(perk, e, crit);
    e.hp -= dmg;
    e.flash = this.calmEffects ? 0.25 : 0.65;
    const kd = Math.hypot(kx, kz);
    if (kd > 0) { const k = knock * (e.t.boss ? 0.08 : e.type === 'oni' ? 0.4 : 1); e.kx += (kx / kd) * k; e.kz += (kz / kd) * k; }
    if (quiet && !crit) { if (e.hp <= 0) this.killEnemy(e); return; } // aura ticks: no number/sparks spam
    this.vfx.number(e.x, 1.4 * e.t.scale + 0.4, e.z, dmg, crit ? 'crit' : '');
    this.vfx.sparks.burst(e.x, 0.7 * e.t.scale, e.z, crit ? 8 : 4, { speed: 6, life: 0.25, size: crit ? 0.6 : 0.4, color: [2.2, 1.8, 0.6], grav: -8 });
    this.audio.hit();
    if (crit) this.shake(0.05);
    if (e.hp <= 0) this.killEnemy(e);
  }

  /** Properties of the weapon looks (progression.js WEAPON_SKINS). */
  weaponPerk(perk, e, crit) {
    this._perkBusy = true;
    const n = ++this.weaponHits;
    if (perk === 'frost' && n % 5 === 0 && !e.t.boss) { e.freeze = Math.max(e.freeze, 1); this.vfx.glow.burst(e.x, 0.8, e.z, 6, { speed: 2, life: 0.4, size: 0.6, color: [0.6, 1.2, 2.2], grav: 0 }); }
    else if (perk === 'bloom' && crit) this.vfx.petals.burst(e.x, 1, e.z, 6, { speed: 3, life: 0.6, size: 0.3, color: [1, 0.6, 0.75] });
    else if (perk === 'storm' && n % 6 === 0) {
      let from = e;
      for (const o of this.enemies.query(e.x, e.z, 5, []).filter(o => o !== e && o.alive).slice(0, 3)) {
        this.vfx.bolt(new THREE.Vector3(from.x, 1, from.z), new THREE.Vector3(o.x, 1, o.z), { color: '#7fdcff', width: 0.35 });
        this.abilities.hit(o, 18, o.x - from.x, o.z - from.z, 2);
        from = o;
      }
    }
    this._perkBusy = false;
  }

  killEnemy(e) {
    if (!e.alive) return;
    e.alive = false;
    this.enemies.kills++;
    const look = this.weaponLook?.perk;
    if (look === 'bloodlust') this.bloodlust = Math.min(0.4, this.bloodlust + 0.001);
    else if (look === 'jade' && ++this.weaponKills % 6 === 0) this.heal(2);
    else if (look === 'burn' && !this._perkBusy && Math.random() < 0.3) {
      this._perkBusy = true;
      this.vfx.glow.burst(e.x, 0.6, e.z, 10, { speed: 4, up: 3, life: 0.45, size: 0.7, color: [2.2, 0.9, 0.3], grav: -4 });
      for (const o of this.enemies.query(e.x, e.z, 2.4, [])) if (o.alive && o !== e) this.abilities.hit(o, 22, o.x - e.x, o.z - e.z, 3);
      this._perkBusy = false;
    }
    const t = e.t, c = t.color, st = this.abilities.stats;
    const rich = st.richDrops && (t.boss || e.elite) ? 2 : 1;
    if (t.boss || e.elite || Math.random() < 0.48 * st.coinDrop) this.coinDrops.drop(e.x, e.z, (t.boss ? 25 : e.elite ? 8 : e.type === 'oni' || e.type === 'shaman' ? 3 : t.ai ? 2 : 1) * rich);
    this.vfx.glow.burst(e.x, 0.6 * t.scale, e.z, t.boss ? 80 : 8, { speed: t.boss ? 14 : 5, up: 4, life: 0.5, size: t.boss ? 1.6 : 0.6, color: t.boss ? c : [c[0] * 0.6, c[1] * 0.6, c[2] * 0.6], grav: -6, sizeEnd: 0.1 });
    this.vfx.sparks.burst(e.x, 0.6 * t.scale, e.z, t.boss ? 60 : 6, { speed: t.boss ? 16 : 7, up: 6, life: 0.5, size: 0.5, color: [2, 2, 2], grav: -14 });
    this.audio.kill();
    if (t.boss) {
      this.enemies.boss = null;
      this.vfx.explode(e.x, e.z, 6, '#ffb03a');
      this.vfx.ring(e.x, e.z, 12, '#ffd23f', 0.9);
      this.vfx.magicCircle(e.x, e.z, 7, '#ff5fa2', 1.2);
      this.vfx.lightFlash(e.x, 4, e.z, 0xffe0a0, 200);
      this.shake(1.2); this.slowmo = 0.8;
      this.audio.boom();
      for (let i = 0; i < 24; i++) this.dropGem(e.x + (Math.random() - 0.5) * 6, e.z + (Math.random() - 0.5) * 6, 20);
      this.spawnChest(e.x, e.z, true);
      this.banner('🏆', 'Они-сёгун побеждён!', 'Он оставил сундук с сокровищами');
      return;
    }
    this.dropGem(e.x, e.z, t.xp * (e.elite ? 6 : 1));
    if (e.elite) { this.spawnChest(e.x, e.z); return; }
    for (const [k, spec] of Object.entries(PICKUPS)) {
      if (Math.random() < spec.chance) { this.dropPickup(k, e.x + 0.5, e.z); break; }
    }
  }

  /** A shaman (or the shogun) raises minions in a ring around itself; each caster keeps at most 8. */
  summonMinions(owner, n) {
    const diff = this.difficulty(this.time), en = this.enemies;
    const room = Math.min(n, 8 - en.minionsOf(owner), 430 - en.list.length);
    this.vfx.magicCircle(owner.x, owner.z, 3, '#b48cff', 0.9);
    for (let i = 0; i < room; i++) {
      const a = (i / Math.max(1, room)) * Math.PI * 2 + Math.random(), r = 1.6 + Math.random() * 0.8;
      let x = owner.x + Math.cos(a) * r, z = owner.z + Math.sin(a) * r;
      if (this.world.blocked(x, z, 0.4)) { x = owner.x; z = owner.z; }
      const type = owner.t.boss ? (i % 2 ? 'kappa' : 'ashigaru') : (this.time > 240 && i === 0 ? 'yurei' : i % 2 ? 'bat' : 'ashigaru');
      const e = en.spawn(type, x, z, diff.hp * 0.8);
      if (!e) break;
      e.dmgMul = diff.dmg; e.speedMul = diff.speed; e.owner = owner.id;
      this.vfx.glow.burst(x, 0.4, z, 6, { speed: 2, up: 3, life: 0.5, size: 0.7, color: [1.0, 0.6, 1.8], grav: 0, sizeEnd: 0.1 });
      this.vfx.magicCircle(x, z, 0.9, '#b48cff', 0.6);
    }
  }

  dropGem(x, z, v) {
    if (this.gems.length >= 650) { const g = this.gems[(Math.random() * this.gems.length) | 0]; g.v += v; g.tier = this.tierOf(g.v); return; }
    this.gems.push({ x, z, v, tier: this.tierOf(v), phase: Math.random() * 6, age: 0, mag: false, vx: 0, vz: 0, pop: 0 });
  }

  // --------------------------------------------------- loot and blessings
  dropPickup(kind, x, z) {
    const spot = { x, z }; this.world.pushOut(spot, .5); x = spot.x; z = spot.z;
    if (this.pickups.length >= 40) this.pickups.shift();
    this.pickups.push({ kind, x, z, phase: Math.random() * 6, pop: 0 });
  }

  usePickup(kind) {
    const p = this.player;
    if (kind === 'onigiri') this.heal(30);
    else if (kind === 'ofuda') { this.magnetAll(); this.toast('🧲', 'Офуда: кристаллы летят к тебе'); }
    else if (kind === 'bomb') this.explode(p.x, p.z, 6.5, 90);
    else if (kind === 'scroll') { this.addXp(Math.ceil(this.xpNeed() * 0.5)); this.toast('📜', 'Свиток: +опыт'); }
    this.audio.pick();
  }

  heal(amount) {
    const p = this.player, h = Math.min(amount, p.maxHp - p.hp);
    p.hp += h;
    this.vfx.number(p.x, 2.3, p.z, '+' + Math.round(h), 'heal');
    this.vfx.glow.burst(p.x, 1, p.z, 16, { speed: 3, up: 4, life: 0.6, size: 0.7, color: [0.6, 2, 0.8], grav: 2 });
    this.vfx.magicCircle(p.x, p.z, 1.4, '#7dff9a', 0.7, p);
    for (let i = 0; i < 3; i++) this.vfx.flares.add({ cell: CELL.heart, x: p.x + (Math.random() - 0.5), y: 1.4 + i * 0.35, z: p.z + (Math.random() - 0.5), size: 0.35, size1: 0.6, color: '#ff7aa8', dur: 0.8, hold: 0.5, glow: 1.3 });
  }

  magnetAll() {
    for (const g of this.gems) g.mag = true;
    this.vfx.ring(this.player.x, this.player.z, 9, '#5fb8ff', 0.6);
  }

  /** Fire seal: wipes ordinary yokai in range, hurts bosses and elites. */
  explode(x, z, radius, bossDamage) {
    this.vfx.explode(x, z, radius * 0.75, '#ff8a3c');
    this.vfx.sparks.burst(x, 0.6, z, 30, { speed: radius * 2.2, up: 5, life: 0.7, size: 0.6, color: [2.5, 0.9, 0.25], grav: -6 });
    this.audio.boom(); this.shake(0.6);
    for (const e of this.enemies.query(x, z, radius, [])) {
      if (e.t.boss || e.elite) this.damageEnemy(e, bossDamage, true, e.x - x, e.z - z, 6);
      else this.killEnemy(e);
    }
  }

  spawnChest(x, z, rich = false) {
    const slot = this.chestPool.find((c) => !c.active);
    if (!slot) return;
    // Never inside a rock or tree: step out along the push direction.
    const spot = { x, z }; this.world.pushOut(spot, 1.1); x = spot.x; z = spot.z;
    Object.assign(slot, { active: true, x, z, rich, opened: false, t: 0, openT: 0 });
    slot.group.position.set(x, 0, z);
    slot.group.rotation.y = Math.atan2(this.player.x - x, this.player.z - z);
    slot.group.scale.setScalar(rich ? 1.35 : 1);
    slot.group.visible = true; slot.beam.visible = true;
    if (slot.lid) slot.lid.rotation.x = 0;
    this.chests.push(slot);
    this.vfx.ring(x, z, 2.2, '#ffd23f', 0.5);
  }

  openChest(c) {
    c.opened = true;
    c.beam.visible = false;
    this.bankCoins(Math.round((c.rich ? 18 : 5) * (this.meta?.chestCoins || 1)));
    // Every chest holds artifacts: pick one of three (four with the talent), boss chests hold rarer ones.
    this.pendingRelics = (this.pendingRelics || 0) + 1;
    this._relicRich = c.rich;
    const rewards = [];
    const pool = CHEST_REWARDS.slice();
    for (let n = c.rich ? 2 : 1; n > 0 && pool.length; n--) {
      let r = Math.random() * pool.reduce((sum, item) => sum + item.w, 0), pick = 0;
      while ((r -= pool[pick].w) > 0) pick++;
      rewards.push(pool.splice(pick, 1)[0]);
    }
    if (c.rich) rewards.unshift(TREASURE);
    for (const reward of rewards) this.grant(reward.id);
    this.audio.levelUp();
    this.vfx.sparks.burst(c.x, 0.8, c.z, 40, { speed: 6, up: 9, life: 0.9, size: 0.55, color: [2.4, 1.6, 0.5], grav: -9 });
    this.vfx.ring(c.x, c.z, 3, '#ffd27a', 0.6);
    this.banner(rewards[0].icon, rewards.map((r) => r.name).join(' · '), rewards.map((r) => r.desc).join(' · '), 'chest');
    this.relicDelay = 0.6;
  }

  // ------------------------------------------------------------- artifacts
  addRelic(relic, quiet = false) {
    if (!relic) return;
    relic.apply(this.abilities.stats, this);
    const have = this.relics.find(r => r.id === relic.id);
    if (have) have.count++; else this.relics.push({ id: relic.id, count: 1 });
    this.renderRelics();
    if (!quiet) this.toast(relic.glyph, `${relic.name}: ${relic.desc}`);
  }

  renderRelics() {
    $('hud-relics').innerHTML = (this.relics || []).map(({ id, count }) => {
      const r = getRelic(id);
      return `<span class="relic-chip r-${r.rarity}" title="${r.name}: ${r.desc}" style="--r:${RARITY[r.rarity].color}">${r.glyph}${count > 1 ? `<em>${count}</em>` : ''}</span>`;
    }).join('');
  }

  openRelicPick() {
    this.setState('relic');
    const st = this.abilities.stats, n = 3 + (this.meta?.relicChoices || 0);
    this.relicOffers = rollRelics(n, { luck: st.relicLuck, min: this._relicRich ? 'rare' : 'common' });
    $('relic-cards').innerHTML = this.relicOffers.map((r, i) => {
      const rar = RARITY[r.rarity], have = this.relics.find(x => x.id === r.id);
      return `<button type="button" class="relic-card r-${r.rarity}" data-relic="${i}" style="--r:${rar.color};animation-delay:${i * 70}ms"><span class="key">${i + 1}</span><span class="card-tag">${rar.name.toUpperCase()}</span>
        <span class="relic-gem"><b>${r.glyph}</b></span><span class="name">${r.name}</span><span class="desc">${r.desc}</span>${have ? `<small class="stack">Уже есть ×${have.count}: эффект сложится</small>` : ''}</button>`;
    }).join('');
    $('relic-all').classList.toggle('hidden', !(platform.available && this.relicAd));
    $('relicpick').classList.remove('hidden');
  }

  chooseRelic(i) {
    if (this.state !== 'relic' || !this.relicOffers?.[i]) return;
    this.addRelic(this.relicOffers[i]);
    this._closeRelicPick();
  }

  /** Rewarded video, once per run: keep every artifact offered in this chest. */
  async takeAllRelics() {
    if (this.state !== 'relic' || !this.relicAd) return;
    $('relic-all').disabled = true;
    const ok = await platform.showRewarded();
    $('relic-all').disabled = false;
    if (!ok || this.state !== 'relic') return;
    this.relicAd = false;
    for (const r of this.relicOffers) this.addRelic(r, true);
    this.toast('🎁', `Все артефакты твои: ${this.relicOffers.map(r => r.name).join(', ')}`);
    this._closeRelicPick();
  }

  _closeRelicPick() {
    this.audio.pick();
    this.pendingRelics = Math.max(0, this.pendingRelics - 1);
    $('relicpick').classList.add('hidden');
    this.setState('play');
    if (this.pendingRelics > 0) this.relicDelay = 0.3;
  }

  grant(id) {
    const p = this.player;
    if (id === 'heal') this.heal(p.maxHp);
    else if (id === 'magnet') this.magnetAll();
    else if (id === 'xp') this.addXp(Math.max(0, this.xpNeed() - this.xp));
    else if (id === 'bomb') this.explode(p.x, p.z, 9, 250);
    else if (id === 'fury' || id === 'wind') this.buffs[id] = 20;
    else if (id === 'ward') this.buffs.ward = 6;
    else if (id === 'treasure') {
      const owned = Object.keys(this.abilities.levels).filter((k) => this.abilities.lv(k) < 5);
      const k = owned[(Math.random() * owned.length) | 0];
      if (k && this.abilities.take(k)) { this.renderSkills(); if (this.abilities.lv(k) === 5) this.awaken(k); }
      else this.heal(p.maxHp);
    }
  }

  updateLoot(dt) {
    const p = this.player, b = this.buffs;
    for (const k in b) b[k] = Math.max(0, b[k] - dt);
    this.abilities.stats.buffSpeed = b.wind > 0 ? 1.35 : 1;
    this.abilities.stats.buffDash = b.wind > 0 ? 0.5 : 1;
    if (b.ward > 0 && Math.random() < dt * 3) this.vfx.ring(p.x, p.z, 1.3, '#ffd27a', 0.4);
    if (this.abilities.stats.soulCall && (this.soulCallT -= dt) <= 0) { this.soulCallT = 15; if (this.gems.length) this.magnetAll(); }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const it = this.pickups[i];
      it.phase += dt; it.pop = Math.min(1, it.pop + dt * 3);
      if ((it.x - p.x) ** 2 + (it.z - p.z) ** 2 < 1.0) { this.pickups.splice(i, 1); this.usePickup(it.kind); }
    }
    for (let i = this.chests.length - 1; i >= 0; i--) {
      const c = this.chests[i];
      c.t += dt;
      if (!c.opened) {
        if ((c.x - p.x) ** 2 + (c.z - p.z) ** 2 < 1.8 ** 2) this.openChest(c);
        else if (Math.random() < dt * 6 * Particles.budget) this.vfx.glow.emit(c.x + (Math.random() - 0.5), 0.5, c.z + (Math.random() - 0.5), 0, 1.6, 0, 0.9, 0.5, 1.8, 1.1, 0.3);
        continue;
      }
      c.openT += dt;
      if (c.lid) c.lid.rotation.x = -1.9 * Math.min(1, c.openT * 2.5);
      if (c.openT > 3) {
        c.group.scale.multiplyScalar(Math.max(0, 1 - dt * 6));
        if (c.openT > 3.6) { c.active = false; c.group.visible = false; this.chests.splice(i, 1); }
      }
    }
  }

  /** Level 5 turns a technique into its awakened form. */
  awaken(k) {
    const a = ABILITIES[k], p = this.player;
    this.slowmo = 0.6;
    this.vfx.ring(p.x, p.z, 8, '#ffd27a', 0.8);
    this.vfx.magicCircle(p.x, p.z, 3.2, a.color, 1.4, p);
    this.vfx.flash(p.x, 1.4, p.z, '#fff0b0', 3.5, 0.45);
    this.vfx.flares.add({ cell: CELL.streak, x: p.x, y: 3, z: p.z, w: 2.2, h: 9, size: 1, color: a.color, dur: 0.9, fadeIn: 0.05, hold: 0.4, glow: 1.8 });
    this.vfx.lightFlash(p.x, 3, p.z, 0xffd27a, 120);
    this.vfx.sparks.burst(p.x, 0.5, p.z, 60, { speed: 7, up: 10, life: 1, size: 0.6, color: [2.4, 1.8, 0.7], grav: -8 });
    this.audio.levelUp();
    this.player.play(this.player.hero.spec.awaken);
    this.banner('✨', 'Суперсила: ' + a.super.name, a.weapon ? a.desc[4] : a.super.desc, 'super');
  }

  /** Large centred title card for big moments (awakening, chest, boss, new wave). */
  banner(icon, title, sub = '', kind = '') {
    const el = $('banner');
    el.className = kind;
    el.innerHTML = `<span class="b-icon">${icon}</span><span class="b-title">${title}</span><span class="b-sub">${sub}</span>`;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(this._bannerT);
    this._bannerT = setTimeout(() => el.classList.remove('show'), 3000);
  }

  /** Small line for minor pickups. */
  toast(icon, text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<b>${icon}</b>${text}`;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  tierOf(v) { return v >= 20 ? 2 : v >= 5 ? 1 : 0; }

  updateGems(dt) {
    const p = this.player, R = this.abilities.stats.magnet;
    this.comboT -= dt;
    if (this.comboT <= 0) this.combo = 0;
    for (let i = this.gems.length - 1; i >= 0; i--) {
      const g = this.gems[i];
      g.phase += dt; g.age = (g.age || 0) + dt; g.pop = Math.min(1, g.pop + dt * 4);
      const dx = p.x - g.x, dz = p.z - g.z, d = Math.hypot(dx, dz) || 0.0001;
      let touched = d < .7;
      // Ranged kills must develop their weapon too: old souls return on their own.
      if (d < R || g.age >= 8) g.mag = true;
      if (g.mag) {
        g.pullT = (g.pullT || 0) + dt;
        const speed = Math.min(22, 5 + 40 * g.pullT), blend = 1 - Math.exp(-14 * dt);
        g.vx += (dx / d * speed - g.vx) * blend;
        g.vz += (dz / d * speed - g.vz) * blend;
        const oldX = g.x, oldZ = g.z;
        g.x += g.vx * dt; g.z += g.vz * dt;
        const sx = g.x - oldX, sz = g.z - oldZ, lengthSq = sx * sx + sz * sz;
        const along = lengthSq ? Math.max(0, Math.min(1, ((p.x - oldX) * sx + (p.z - oldZ) * sz) / lengthSq)) : 0;
        touched ||= (oldX + sx * along - p.x) ** 2 + (oldZ + sz * along - p.z) ** 2 < .49;
      }
      if (touched) {
        this.gems[i] = this.gems[this.gems.length - 1];
        this.gems.pop();
        this.addXp(g.v);
        this.combo++; this.comboT = 0.4;
        this.audio.pickup(this.combo);
        this.vfx.glow.emit(p.x, 1.1, p.z, 0, 2, 0, 0.25, 0.9, 0.4, 1.6, 2.0, { sizeEnd: 0.1 });
      }
    }
  }

  // Early levels come quickly so a build forms in the first minutes; later ones slow down.
  // Gentler early levels than before: about one card every 15–20 s at first, slowing later.
  xpNeed() { const l = this.level - 1; return Math.round(6 + l * 9 + l * l * 0.9); }

  addXp(v) {
    this.xp += v * (this.meta?.xp || 1) * (this.abilities.stats.xp || 1);
    while (this.xp >= this.xpNeed()) { this.xp -= this.xpNeed(); this.level++; this.pendingLevels++; }
    if (this.pendingLevels && this.levelDelay <= 0 && this.state === 'play') this.beginLevelUp();
  }

  beginLevelUp() {
    const p = this.player;
    this.levelDelay = 0.45;
    this.slowmo = 0.45;
    this.audio.levelUp();
    this.vfx.ring(p.x, p.z, 7, '#ffd23f', 0.7);
    this.vfx.magicCircle(p.x, p.z, 2.2, '#5fb8ff', 0.9, p);
    this.vfx.flares.add({ cell: CELL.streak, x: p.x, y: 2.5, z: p.z, w: 1.6, h: 7, size: 1, color: '#9fe0ff', dur: 0.7, fadeIn: 0.05, hold: 0.3, glow: 1.6 });
    for (let i = 0; i < 50; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.2;
      this.vfx.sparks.emit(p.x + Math.cos(a) * r, 0.2, p.z + Math.sin(a) * r, Math.cos(a) * 0.6, 6 + Math.random() * 8, Math.sin(a) * 0.6, 0.9, 0.6, 2.4, 2.0, 0.6, { drag: 1.5 });
    }
    // knock back everyone nearby for breathing room
    for (const e of this.enemies.query(p.x, p.z, 5, [])) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      if (!e.t.boss) { e.kx += (dx / d) * 14; e.kz += (dz / d) * 14; }
    }
  }

  openLevelUp(keep = false) {
    this.setState('levelup');
    if (!keep) this.offers = this.abilities.offers(4);
    const box = $('cards');
    box.innerHTML = '';
    if (!this.offers.length) this.offers = ['__heal'];
    this.offers.forEach((k, i) => {
      const a = ABILITIES[k] || { name: 'Чашка чая', icon: '🍵', color: '#5fbf6a', desc: ['Восстанавливает 50 здоровья.'] };
      const lv = this.abilities.lv(k);
      const awakening = lv === 4 && a.super;
      const family = a.weapon ? a.family : k === '__heal' ? 'heal' : 'passive';
      const d = document.createElement('button');
      d.type = 'button';
      d.className = `card fam-${family}${awakening ? ' super' : ''}${lv ? '' : ' fresh'}`;
      d.style.setProperty('--card', a.color);
      d.style.animationDelay = `${i * 60}ms`;
      const desc = k === '__heal' ? a.desc[0] : getAbilityUpgradeText(k, lv);
      const tag = k === '__heal' ? 'ЛЕЧЕНИЕ' : awakening ? 'СУПЕРСИЛА!' : lv ? `УРОВЕНЬ ${lv + 1}` : 'НОВОЕ';
      const num = v => String(Math.round(v * 100) / 100).replace('.', ',');
      const stats = getAbilityStats(k, lv).map(s => `<li class="${s.better ? 'up' : ''}"><span>${s.label}</span><b>${s.from === null ? '' : `${num(s.from)} → `}<em>${num(s.to)}</em>${s.unit}</b></li>`).join('');
      const preview = abilityPreview(k);
      if (stats) d.classList.add('has-stats');
      d.innerHTML = `<span class="key">${i + 1}</span><span class="card-tag">${tag}</span><div class="icon${preview ? ' has-preview' : ''}">${preview || abilityArt(k, a.icon)}</div>
        <div class="name">${awakening ? a.super.name : a.name}</div>
        <div class="lv"><small class="discipline">${a.weapon ? FAMILY_LABELS[a.family] || FAMILY_LABELS.shared : k === '__heal' ? 'ВОССТАНОВЛЕНИЕ' : 'УСИЛЕНИЕ'}</small>${k === '__heal' ? '' : rating(lv, true)}</div>
        <div class="desc">${desc}</div>${stats ? `<ul class="stats">${stats}</ul>` : ''}`;
      d.onclick = () => this.choose(i);
      box.appendChild(d);
    });
    $('reroll-count').textContent = this.rerolls;
    $('rerollbtn').disabled = this.rerolls <= 0;
    $('rerollbtn').classList.toggle('hidden', this.rerolls <= 0 && platform.available && this.adReroll);
    $('reroll-ad').classList.toggle('hidden', !(platform.available && this.adReroll && this.rerolls <= 0));
    $('levelup').classList.remove('hidden');
  }

  /** New set of cards: a free reroll per run, then one per level-up for a rewarded video. */
  async reroll(withAd) {
    if (this.state !== 'levelup') return;
    if (withAd) {
      if (!this.adReroll) return;
      $('reroll-ad').disabled = true;
      const ok = await platform.showRewarded();
      $('reroll-ad').disabled = false;
      if (!ok || this.state !== 'levelup') return;
      this.adReroll = false;
    } else {
      if (this.rerolls <= 0) return;
      this.rerolls--;
    }
    this.audio.pick();
    this.openLevelUp();
  }

  choose(i) {
    if (this.state !== 'levelup' || i < 0 || i >= this.offers.length) return;
    const k = this.offers[i];
    if (k === '__heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 50);
    else this.abilities.take(k);
    this.audio.pick();
    this.pendingLevels--;
    this.adReroll = true;
    $('levelup').classList.add('hidden');
    this.renderSkills();
    this.setState('play');
    if (ABILITIES[k] && this.abilities.lv(k) === 5) this.awaken(k);
    if (this.pendingLevels > 0) this.openLevelUp();
  }

  // ------------------------------------------------------- death & results
  /** The hero falls: offer a second chance before the run is settled. */
  playerDown() {
    if (this.state !== 'play') return;
    this.setState('down');
    this.player.die();
    this.audio.boom();
    $('banner').classList.remove('show');
    const price = this.campaign.reviveCost(this.runId);
    const canAd = platform.available && !this.revived;
    const canCoins = price !== null;
    if (!canAd && !canCoins) { setTimeout(() => this.declineRevive(), 900); return; }
    $('revive-ad').classList.toggle('hidden', !canAd);
    $('revive-coins').classList.toggle('hidden', !canCoins);
    $('revive-price').textContent = price ?? '';
    $('revive-coins').disabled = !canCoins || this.campaign.coins < price;
    $('revive').classList.remove('hidden');
    this.reviveLeft = REVIVE_SECONDS;
    const bar = $('revive-timer');
    bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)';
    void bar.offsetWidth;
    bar.style.transition = `transform ${REVIVE_SECONDS}s linear`; bar.style.transform = 'scaleX(0)';
    clearTimeout(this._reviveT);
    this._reviveT = setTimeout(() => { if (this.state === 'down' && !platform.adOpen) this.declineRevive(); }, REVIVE_SECONDS * 1000);
  }

  standUp(text) {
    const p = this.player;
    clearTimeout(this._reviveT);
    $('revive').classList.add('hidden');
    p.revive();
    p.hp = Math.round(p.maxHp * 0.6); p.iframe = 3;
    this.setState('play');
    this.explode(p.x, p.z, 8, 200);
    this.banner('💖', 'Второй шанс!', text);
  }

  /** Rewarded video on Yandex Games: one second chance per run. */
  async reviveForAd() {
    if (this.state !== 'down' || this.revived) return;
    clearTimeout(this._reviveT);
    $('revive-ad').disabled = true;
    const ok = await platform.showRewarded();
    $('revive-ad').disabled = false;
    if (this.state !== 'down') return;
    if (!ok) { this.toast('🎬', 'Видео не досмотрено'); this._reviveT = setTimeout(() => this.declineRevive(), 4000); return; }
    this.revived = true;
    this.standUp('Ёкаи отброшены огненной печатью');
  }

  reviveForCoins() {
    if (this.state !== 'down') return;
    const result = this.campaign.payRevive(this.runId);
    if (!result.ok) { this.toast('🪙', 'Не хватает монет'); return; }
    this.audio.pick(); this.lobby.render();
    this.standUp(`Потрачено ${result.cost} монет`);
  }

  declineRevive() {
    if (this.state !== 'down') return;
    clearTimeout(this._reviveT);
    $('revive').classList.add('hidden');
    this.finishRun(false);
    this.showResults(false);
  }

  bankCoins(amount) {
    const result = this.campaign.collectCoins(this.runId, amount);
    if (result.ok && result.amount) { this.audio.pickup(1); this._walletDirty = true; }
    return result;
  }

  finishRun(victory) {
    if (this.result || !this.runId) return this.result;
    const time = this.endless ? this.time : victory ? RUN_SECONDS : Math.max(this.runElapsed, this.time);
    const result = this.campaign.finishRun(this.runId, { victory, time, kills: this.enemies.kills });
    if (result.ok) {
      this.result = result;
      if (this.endless) {
        platform.submitScore(BOARDS.time, result.time, this.selectedLoadout);
        platform.submitScore(BOARDS.kills, result.kills, this.selectedLoadout);
      }
    }
    return result;
  }

  showResults(victory) {
    this.setState(victory ? 'victory' : 'over');
    $('banner').classList.remove('show');
    for (const id of ['pause', 'levelup', 'relicpick', 'revive', 'settings']) $(id).classList.add('hidden');
    const r = this.result || { runCoins: 0, bonus: 0, time: Math.floor(this.time), kills: this.enemies.kills };
    const awakened = Object.keys(this.abilities.levels).filter((k) => this.abilities.lv(k) === 5).length;
    const coins = (r.runCoins || 0) + (r.bonus || 0);
    $('go-title').textContent = victory ? 'Победа! Рассвет наступил' : this.endless ? 'Ночь окончена' : 'Забег окончен';
    $('go-stats').innerHTML = `<div class="stat-grid">
      <div><span>⏱</span><b>${formatTime(r.time)}</b><small>время</small></div>
      <div><span>☠</span><b>${r.kills}</b><small>ёкаев</small></div>
      <div><span>⭐</span><b>${this.level}</b><small>уровень</small></div>
      <div><span>✨</span><b>${awakened}</b><small>суперсил</small></div></div>
      <div class="run-reward"><span class="coin-ico"></span><b id="reward-amount">+${coins}</b> монет</div>
      ${victory ? `<small>${r.unlocked ? 'Открыта следующая глава!' : 'Глава пройдена. Можно повторить.'}</small>` : ''}`;
    const best = this.campaign.state.endless;
    $('go-record').textContent = this.endless ? (r.newRecord ? '🏆 Новый рекорд!' : `Рекорд: ${formatTime(best.bestTime)} · ${best.bestKills} ёкаев`) : 'Монеты можно потратить в дереве талантов';
    $('go-record').classList.toggle('new', !!r.newRecord);
    $('double-ad').classList.toggle('hidden', !(platform.available && r.runCoins > 0 && this.result));
    $('double-ad').disabled = false;
    $('gameover').classList.remove('hidden');
    $('restartbtn').disabled = false;
    if (victory) this.audio.levelUp();
  }

  async doubleForAd() {
    if (!this.result) return;
    $('double-ad').disabled = true;
    const ok = await platform.showRewarded();
    if (!ok) { $('double-ad').disabled = false; return; }
    const res = this.campaign.doubleLastRun(this.result.id);
    if (res.ok) {
      $('reward-amount').textContent = `+${(this.result.runCoins || 0) * 2 + (this.result.bonus || 0)}`;
      $('double-ad').classList.add('hidden');
      this.toast('🪙', `+${res.amount} монет`);
      this.audio.levelUp();
    }
  }

  completeChapter() {
    if (this.state !== 'play' || this.result || this.endless) return;
    this.runElapsed = RUN_SECONDS;
    this.finishRun(true);
    this.player.play('Cheer');
    this.showResults(true);
  }

  returnToTitle() {
    this.campaign.abandonRun();
    if (this.result?.unlocked) this.campaign.selectChapter(this.result.unlocked);
    this.runId = null; this.result = null; this.runElapsed = 0;
    this.setState('title');
    this.enemies.clear?.();
    this.hazards.clear();
    if (!this.enemies.clear) { for (const e of this.enemies.list) e.alive = false; this.enemies.update(0, this.player, this); }
    this.enemies.kills = 0;
    this.gems.length = this.pickups.length = this.chests.length = 0;
    for (const c of this.chestPool) { c.active = false; c.group.visible = false; }
    this.coinDrops.clear(); this.vfx.clear?.();
    for (const k in this.buffs) this.buffs[k] = 0;
    this.time = 0; this.level = 1; this.xp = 0; this.pendingLevels = 0; this.levelDelay = 0; this.slowmo = 0; this.shakeAmt = 0; this.wave = 1;
    this.resetDirector();
    this.nextChest = 50 * (1 - this.meta.chestRate);
    this.renderRelics();
    this.combo = this.comboT = 0;
    this.revived = false; this.player.resetRun();
    Object.assign(this.player, { maxHp: 100, hp: 100 });
    for (const id of ['hud', 'pause', 'levelup', 'relicpick', 'gameover', 'settings', 'revive']) $(id).classList.add('hidden');
    $('title').classList.remove('hidden'); $('restartbtn').disabled = false;
    document.body.classList.remove('lowhp');
    document.body.dataset.view = 'title';
    clearTimeout(this._bannerT); $('banner').classList.remove('show'); $('toasts').innerHTML = '';
    this.selectLoadout(this.selectedLoadout, false);
    this.chapter = this.campaign.chapter; this.world.setChapter(this.chapter);
    this.applySkin(this.campaign.selectedSkin);
    this.lobby.show('play');
    this._ui = {}; this._renderDirty = true;
  }

  /** Interstitial between runs (shown only on Yandex Games, which caps its frequency). */
  async restart() {
    $('restartbtn').disabled = true;
    await platform.showFullscreen();
    this.returnToTitle();
  }

  // ------------------------------------------------------------ spawning
  /** Difficulty climbs every minute; the endless night keeps climbing for the leaderboard. */
  difficulty(t = this.time) {
    const m = t / 60, c = this.chapter;
    if (c.endless) return { hp: (1 + 0.24 * m + 0.035 * m * m) * c.hpMul, dmg: (1 + 0.1 * m) * c.hpMul ** 0.5, spawn: Math.min(18, (1.2 + t / 18) * c.spawnMul), speed: c.speedMul * Math.min(1.35, 1 + 0.02 * m) };
    return { hp: (1 + t / 300 + Math.pow(t / 600, 2)) * c.hpMul, dmg: (1 + t / 700) * Math.sqrt(c.hpMul), spawn: Math.min(13, (1.1 + t / 22) * c.spawnMul), speed: c.speedMul };
  }

  spawnTick(dt) {
    const t = this.time, p = this.player, en = this.enemies;
    const wave = Math.floor(t / 60) + 1;
    if (wave !== this.wave) {
      this.wave = wave;
      this.banner('🌊', `Волна ${wave}`, wave % 3 === 0 ? 'Ёкаи стали намного сильнее!' : 'Ёкаев стало больше!', 'wave');
      this.audio.boss?.();
    }
    const diff = this.difficulty(t);
    // A short lull before every swarm gives a moment to collect souls and open chests.
    const lull = this.nextSwarm - t < 7 ? 0.35 : 1;
    this.spawnAcc += dt * diff.spawn * lull;
    const weights = [['ashigaru', Math.max(1.5, 6 - t / 40)], ['bat', t > 20 ? 3 : 0], ['yurei', t > 75 ? 2 + t / 120 : 0], ['oni', t > 130 ? 1 + t / 160 : 0]];
    // Each chapter adds its own special yokai: [first appearance in seconds, weight].
    for (const [type, [from, w]] of Object.entries(this.chapter.foes || {})) weights.push([type, t > from ? w * (1 + (t - from) / 240) : 0]);
    const total = weights.reduce((s, w) => s + w[1], 0);
    const spawn = (type, x, z, mul = diff.hp) => { const e = en.spawn(type, x, z, mul); if (e) { e.dmgMul = diff.dmg; e.speedMul = diff.speed; } return e; };
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (en.list.length >= 420) { this.spawnAcc = Math.min(this.spawnAcc, 1); break; }
      let r = Math.random() * total, type = 'ashigaru';
      for (const [k, w] of weights) { if ((r -= w) <= 0) { type = k; break; } }
      const a = Math.random() * Math.PI * 2, d = 18 + Math.random() * 4;
      spawn(type, p.x + Math.cos(a) * d * this.camDist, p.z + Math.sin(a) * d * this.camDist);
    }
    if (t > this.nextSwarm) { // encircling swarm
      this.nextSwarm += 45;
      const type = t > 120 ? 'yurei' : 'bat', n = 16 + Math.floor(t / 30);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; spawn(type, p.x + Math.cos(a) * 17, p.z + Math.sin(a) * 17); }
    }
    if (t > this.nextElite) { // a stronger, shimmering yokai guarding a chest
      this.nextElite += 50;
      const a = Math.random() * Math.PI * 2;
      const e = spawn(t > 130 ? 'oni' : 'ashigaru', p.x + Math.cos(a) * 16, p.z + Math.sin(a) * 16, diff.hp * (t > 130 ? 4 : 12));
      if (e) { e.elite = true; this.toast('🎁', 'Ёкай-хранитель несёт сундук'); }
    }
    if (t > this.nextChest) { // a forgotten chest somewhere nearby
      this.nextChest += 70 * (1 - (this.meta?.chestRate || 0));
      const a = Math.random() * Math.PI * 2, d = 10 + Math.random() * 4;
      this.spawnChest(p.x + Math.cos(a) * d, p.z + Math.sin(a) * d);
      this.toast('🎁', 'Рядом появился сундук');
    }
    if (t > this.nextBoss) {
      this.nextBoss += this.endless ? 150 : 180;
      const a = Math.random() * Math.PI * 2;
      spawn('boss', p.x + Math.cos(a) * 18, p.z + Math.sin(a) * 18, (1 + t / 180) * this.chapter.hpMul * (this.endless ? 1 + t / 600 : 1));
      this.audio.boss();
      this.shake(0.6);
      this.banner('👹', 'Они-сёгун', 'Главный ёкай вышел на бой!', 'boss');
    }
  }

  // ----------------------------------------------------------------- loop
  update(dt) {
    this.time += dt;
    if (!this.endless && this.time >= RUN_SECONDS) { this.completeChapter(); return; }
    const p = this.player;
    p.update(dt, this.input, this.abilities.stats, this.vfx, this.enemies);
    this.spawnTick(dt);
    this.enemies.update(dt, p, this);
    this.hazards.update(dt, p, this);
    if (this.state !== 'play') return;
    this.abilities.update(dt);
    this.updateGems(dt);
    this.updateLoot(dt);
    this.coinDrops.update(dt, p, this.abilities.stats.magnet, amount => this.bankCoins(amount));
    if (this.levelDelay > 0) { this.levelDelay -= dt / 0.2; if (this.levelDelay <= 0 && this.state === 'play') this.openLevelUp(); }
    else if (this.pendingRelics > 0 && (this.relicDelay -= dt) <= 0 && this.state === 'play') this.openRelicPick();
  }

  /** Menu podium: the hero stands in the meadow, framed in the free middle of the screen. */
  podiumCamera() {
    const stage = document.querySelector(`#lobby-${this.lobby?.view || 'play'} .stage`);
    const rect = stage?.getBoundingClientRect();
    // Fit the whole hero (about 2.1 units with the hat) into ~70% of the stage height.
    const share = rect && rect.height > 40 ? Math.min(1, rect.height / innerHeight) * 0.7 : 0.55;
    const distance = THREE.MathUtils.clamp(2.1 / share / (2 * Math.tan(THREE.MathUtils.degToRad(this.camera.fov) / 2)), 4, 16);
    this.camera.position.set(distance * 0.2, 1.25 + distance * 0.1, distance);
    this.camera.lookAt(0, 1.2, 0);
    if (rect && rect.width > 0) {
      // Shift the projection so the hero sits in the middle of the stage element.
      const cx = rect.left + rect.width / 2, cy = rect.top + rect.height * 0.56;
      this.camera.setViewOffset(innerWidth, innerHeight, innerWidth / 2 - cx, innerHeight / 2 - cy, innerWidth, innerHeight);
    }
  }

  draw(dt, realDt) {
    const p = this.player;
    const podium = this.state === 'title';
    if (!podium && this.camera.view?.enabled) this.camera.clearViewOffset();
    if (podium) {
      this.podiumCamera();
    } else {
      this.cameraZoom = THREE.MathUtils.damp(this.cameraZoom, this.settings.zoom, 5, realDt);
      const height = 15 * this.camDist * this.cameraZoom, offset = 11.5 * this.camDist * this.cameraZoom;
      this._wantCam.set(p.x, height, p.z + offset);
      this.camPos.lerp(this._wantCam, 1 - Math.exp(-realDt * 6));
      this.shakeAmt = Math.max(0, this.shakeAmt - realDt * 2.5);
      const s = this.motionReduced || this.calmEffects ? 0 : this.shakeAmt * this.shakeAmt * 0.6;
      this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * s, this.camPos.y + (Math.random() - 0.5) * s, this.camPos.z + (Math.random() - 0.5) * s);
      this.camera.lookAt(this.camPos.x, 0.8, this.camPos.z - offset);
    }
    p.root.visible = !podium || ['play', 'shop', 'forge'].includes(this.lobby?.view);
    this.camera.updateMatrixWorld();
    this.world.setView(this.camera);
    this.world.update(p.x, p.z, this.vfx, dt);
    this.world.beginShadows();
    this.world.shadow(p.x, p.z, 1.3);
    this.enemies.draw(this.world);
    this.hazards.draw(this.world);
    for (const m of this.gemModels) m.begin();
    for (const g of this.gems) {
      const tier = GEM_TIERS[g.tier];
      this.gemModels[g.tier].push(g.x, 0.45 + Math.sin(g.phase * 3) * 0.12, g.z, g.phase * 2, tier.scale * g.pop);
    }
    for (const m of this.gemModels) m.end();
    for (const m of Object.values(this.pickupModels)) m.begin();
    for (const it of this.pickups) {
      this.pickupModels[it.kind].push(it.x, 0.25 + Math.sin(it.phase * 2.5) * 0.08, it.z, it.phase * 1.2, PICKUPS[it.kind].scale * it.pop);
      this.world.shadow(it.x, it.z, 0.8);
    }
    for (const m of Object.values(this.pickupModels)) m.end();
    for (const c of this.chests) if (!c.opened) { c.beam.material.opacity = 0.12 + Math.sin(c.t * 3) * 0.05; this.world.shadow(c.x, c.z, 1.6); }
    this.world.endShadows();
    this.coinDrops.draw();
    this.vfx.update(dt);

    this.renderer.info.reset();
    this.composer.render();
    this.metrics.enemies = this.enemies.list.length;
    this.metrics.drawCalls = this.renderer.info.render.calls;
    this._hudElapsed += realDt;
    if (this.state !== 'title' && (this._hudElapsed >= 0.08 || this.state !== 'play')) { this._hudElapsed = 0; this.updateHud(); }
  }

  updateHud() {
    const p = this.player, u = this._ui;
    const set = (k, v, fn) => { if (u[k] !== v) { u[k] = v; fn(v); } };
    set('xp', Math.floor((this.xp / this.xpNeed()) * 100), (v) => ($('xpfill').style.width = v + '%'));
    set('lvl', this.level, (v) => ($('lvl').textContent = v));
    set('hp', Math.ceil(Math.max(0, p.hp)) + '/' + p.maxHp, (v) => { $('hptext').textContent = v.replace('/', ' / '); $('hpfill').style.width = (Math.max(0, p.hp) / p.maxHp) * 100 + '%'; });
    const shown = this.endless ? this.time : Math.max(0, RUN_SECONDS - this.runElapsed);
    set('time', formatTime(Math.ceil(shown)), (v) => ($('timer').textContent = v));
    set('wave', this.wave, (v) => ($('wave').textContent = this.endless ? `Волна ${v} · рекорд ${formatTime(this.campaign.state.endless.bestTime)}` : `Волна ${v}`));
    set('kills', this.enemies.kills, (v) => ($('kills').textContent = v));
    set('run-coins', this.campaign.activeRun?.runCoins || this.result?.runCoins || 0, v => $('run-coins').textContent = v);
    set('run-progress', this.endless ? 100 : Math.floor(this.runElapsed / RUN_SECONDS * 100), v => $('run-progress').firstElementChild.style.transform = `scaleX(${v / 100})`);
    set('low', p.hp / p.maxHp < 0.3, (v) => document.body.classList.toggle('lowhp', v));
    const b = this.enemies.boss;
    set('boss', !!b, (v) => $('boss').classList.toggle('hidden', !v));
    if (b) $('bossfill').style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
    set('dash', Math.round(Math.max(0, 1 - p.dashCd / (p.dashMax || 1.1)) * 20), (v) => {
      $('dashfill').style.transform = `scaleX(${v / 20})`;
      $('dash-meter').classList.toggle('ready', v === 20);
    });
    const primary = LOADOUTS[this.selectedLoadout].starter;
    const cooldown = (this.abilities.timers[primary] || 0) / (this.abilities.val(primary, 'cd') * this.abilities.stats.cd);
    set('primary-cd', Math.round(Math.min(1, Math.max(0, cooldown)) * 30), (v) => { const fill = $('primary-cooldown'); if (fill) fill.style.transform = `scaleY(${v / 30})`; });
    const buffs = Object.entries(this.buffs).filter(([, v]) => v > 0).map(([k, v]) => `<span><b>${BUFFS[k][0]}</b>${BUFFS[k][1]} ${Math.ceil(v)}</span>`).join('');
    set('buffs', buffs, (v) => ($('buffs').innerHTML = v));
    this.updateChestPointer();
  }

  /** Edge-of-screen arrow towards the nearest unopened chest when it is out of view. */
  updateChestPointer() {
    const el = $('chest-pointer'), p = this.player;
    let best = null, bd = Infinity;
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = (c.x - p.x) ** 2 + (c.z - p.z) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
    const v = this._ptr ??= new THREE.Vector3();
    if (!best || this.state !== 'play') { el.classList.add('hidden'); return; }
    v.set(best.x, 0.5, best.z).project(this.camera);
    const onScreen = v.z < 1 && Math.abs(v.x) < 0.92 && Math.abs(v.y) < 0.88;
    el.classList.toggle('hidden', onScreen);
    if (onScreen) return;
    const a = Math.atan2(v.y, v.x), k = 0.86 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const x = (Math.cos(a) * k * 0.5 + 0.5) * innerWidth, y = (-Math.sin(a) * k * 0.5 + 0.5) * innerHeight;
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
    el.firstElementChild.style.transform = `rotate(${-a}rad)`;
    el.lastElementChild.textContent = Math.round(Math.sqrt(bd)) + ' м';
  }

  renderSkills() {
    $('skills').innerHTML = Object.entries(this.abilities.levels).map(([k, lv]) => {
      const a = ABILITIES[k];
      const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('');
      const awakened = lv >= 5;
      const primary = k === LOADOUTS[this.selectedLoadout].starter;
      return `<div class="skill ${a.weapon ? 'weapon' : ''} ${awakened ? 'super' : ''} ${primary ? 'primary' : ''}" style="--skill:${a.color}" title="${awakened ? a.super.name : a.name} · ур. ${lv}">${abilityArt(k, a.icon)}${primary ? '<i id="primary-cooldown" aria-hidden="true"></i>' : ''}<div class="pips">${pips}</div></div>`;
    }).join('');
    delete this._ui['primary-cd'];
  }

  /** Steps quality down when the frame rate stays low: fewer particles, lower resolution, then no bloom. */
  autoQuality(rawDt) {
    if (this.state !== 'play' || rawDt <= 0 || rawDt > 2) return;
    const q = (this._q ??= { t: 0, n: 0, bad: 0 });
    q.t += rawDt; q.n++;
    if (q.t < 1.5) return;
    const fps = q.n / q.t;
    q.t = 0; q.n = 0;
    this.metrics.fps = Math.round(fps); this.metrics.frameMs = +(1000 / fps).toFixed(1);
    q.bad = fps < 47 ? q.bad + 1 : 0;
    if (this.qualityMode === 'auto' && (fps < 37 || q.bad >= 2) && this.qualityLevel < 2) { this.applyQuality(this.qualityLevel + 1); q.bad = 0; }
  }

  applyQuality(level) {
    this.qualityLevel = level;
    const profiles = [{ pixel: 1.5, particles: 1, bloom: true, numbers: 28 }, { pixel: 1, particles: 0.65, bloom: true, numbers: 18 }, { pixel: 0.8, particles: 0.35, bloom: false, numbers: 12 }];
    const q = profiles[level];
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, q.pixel));
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.bloom.enabled = q.bloom;
    Particles.budget = q.particles; this.vfx.maxNums = q.numbers;
    if (this.camera) this.resize();
    if ($('quality-status')) $('quality-status').textContent = ['КРАСИВО', 'БАЛАНС', 'БЫСТРО'][level];
  }

  run() {
    let last = performance.now();
    let accumulator = 0, lastDraw = 0;
    const frame = (now) => {
      requestAnimationFrame(frame);
      const rawDt = (now - last) / 1000;
      const realDt = Math.min(0.05, rawDt);
      last = now;
      if (document.hidden) { accumulator = 0; return; }
      this.autoQuality(rawDt);
      let dt = realDt;
      if (this.slowmo > 0 && this.state === 'play') { this.slowmo -= realDt; dt *= 0.2; }
      if (this.state === 'play') {
        if (!this.endless) {
          this.runElapsed = Math.min(RUN_SECONDS, this.runElapsed + Math.min(rawDt, 0.25));
          if (this.runElapsed >= RUN_SECONDS) this.completeChapter();
        }
        accumulator = Math.min(accumulator + dt, 0.1);
        while (accumulator >= 1 / 60 && this.state === 'play') { this.update(1 / 60); accumulator -= 1 / 60; }
      }
      if (this.state !== 'play') accumulator = 0;
      const posing = this.state === 'title' || this.state === 'down' || this.state === 'over' || this.state === 'victory';
      if (posing) {
        if (this.state === 'title') this.player.updatePreview(realDt);
        else { this.player._updateAnimation(realDt); this.player.root.updateMatrixWorld(true); }
        this._renderDirty = true;
      }
      const frozen = this.state === 'pause' || this.state === 'levelup' || this.state === 'relic';
      if (frozen && !this._renderDirty) return;
      const interval = frozen ? 100 : posing ? 1000 / 30 : 0;
      if (now - lastDraw < interval) return;
      lastDraw = now;
      this._renderDirty = false;
      this.draw(frozen || posing ? 0 : dt, frozen ? 0 : realDt);
    };
    requestAnimationFrame(frame);
  }
}

// ------------------------------------------------------------------ boot
const platformReady = platform.init();
loadAssets((f) => ($('loadpct').textContent = Math.round(f * 100) + '%')).then(async (assets) => {
  const game = new Game(assets);
  window.__game = game; window.__relics = getRelic; // handy for debugging in the console
  $('loading').textContent = 'Готовим поле боя…';
  game.draw(0, 1 / 60);
  // Shader pre-warm is optional: some GPU drivers never report completion, so never wait on it for long.
  await Promise.race([
    game.renderer.compileAsync(game.scene, game.camera).catch(() => {}),
    new Promise((r) => setTimeout(r, 3000)),
  ]);
  game.run();
  $('loading').classList.add('hidden');
  $('startbtn').classList.remove('hidden');
  $('startbtn').onclick = () => game.start();
  window.__sakuraBooted = true;
  await platformReady;
  if (platform.available) {
    document.body.classList.add('on-yandex');
    // A newer cloud copy (another device) replaces the local wallet and tree.
    const cloud = await platform.loadProgress();
    if (cloud && game.state === 'title' && game.campaign.adopt(cloud)) { game.selectLoadout(game.campaign.selectedClass, false); game.applySkin(game.campaign.selectedSkin); }
    await game.lobby.restorePurchases(true);
  }
  game.lobby.render();
  platform.loadingReady();
}).catch((err) => {
  console.error(err);
  const msg = String(err?.message || err);
  $('loading').classList.add('boot-error');
  $('loading').textContent = /webgl|context/i.test(msg)
    ? 'Браузер не дал доступ к видеокарте (WebGL). Включи аппаратное ускорение в настройках браузера и перезапусти его.'
    : 'Игра не запустилась: ' + msg;
});

export { PRODUCTS };
