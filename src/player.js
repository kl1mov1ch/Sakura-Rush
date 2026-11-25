import * as THREE from 'three';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { toonify, loadModel } from './assets.js';

// Class heroes are skinned KayKit Adventurers (CC0) restyled in Blender (blender/build_heroes.py).
// Each class owns its model, weapon and attack clip; the run equips one of them.
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a, b, rate, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-rate * dt));
const ease = t => { t = THREE.MathUtils.clamp(t, 0, 1); return t * t * (3 - 2 * t); };
// KayKit bone names (chibi heroes) and VRM humanoid names (anime heroines): the upper body plays attacks.
const UPPER = /^(spine|chest|head|Kasa|upperarm|lowerarm|wrist|hand|handslot|J_Bip_C_(Spine|Chest|UpperChest|Neck|Head)|J_Bip_[LR]_(Shoulder|UpperArm|LowerArm|Hand))/;
const HERO_SCALE = 0.8;
// VRoid heroines have real-life proportions (small heads), so they stand taller than the chibis to read as well.
const ANIME_SCALE = 1.22;

// VRoid heroines arrive unlit (KHR_materials_unlit); a two-tone toon ramp gives them anime cel shading.
let toonRamp = null;
function animeMaterial(src) {
  if (!toonRamp) {
    toonRamp = new THREE.DataTexture(new Uint8Array([150, 150, 150, 255, 255, 255, 255, 255]), 2, 1);
    toonRamp.magFilter = toonRamp.minFilter = THREE.NearestFilter; toonRamp.needsUpdate = true;
  }
  const m = new THREE.MeshToonMaterial({ map: src.map, color: src.color, gradientMap: toonRamp, transparent: src.transparent, alphaTest: src.alphaTest, side: src.side, depthWrite: src.depthWrite });
  m.name = src.name;
  return m;
}

export const HEROES = Object.freeze({
  staff: { model: 'hero_mage', weapon: 'staff', slot: 'handslotr', attacks: ['Spellcast_Shoot'], awaken: 'Spellcast_Raise', muzzle: [0, 1.03, 0], weaponScale: 1.05, animeScale: 0.7 },
  // The archer's "bow" models are KayKit crossbows. They hang on the heroine's `weaponmount` node,
  // which build_anime_heroes.py places exactly where KayKit's own rogue holds its crossbow.
  bow: { model: 'hero_archer', weapon: 'bow', slot: 'weaponmount', native: true, attacks: ['2H_Ranged_Shoot'], hold: '2H_Ranged_Aiming', awaken: 'Cheer', muzzle: [0, 0.12, 1.15], weaponScale: 0.66, bolt: { position: [0, 0.2, 0.42], scale: 0.62 } },
  sword: { model: 'hero_ninja', weapon: 'katana', slot: 'handslotr', attacks: ['1H_Melee_Attack_Slice_Diagonal', '1H_Melee_Attack_Slice_Horizontal'], awaken: '2H_Melee_Attack_Spin', muzzle: [0, 0.9, 0], weaponScale: 0.95, weaponTilt: [-Math.PI / 2, 0, 0] },
});

export class Player {
  constructor(scene, assets) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.assets = assets;
    this.heroes = {}; this.skinHeroes = {}; this.weaponLooks = {}; this._fxColor = new THREE.Color(); this._fxPos = new THREE.Vector3();
    for (const [kind, spec] of Object.entries(HEROES)) this.heroes[kind] = this._buildHero(kind, spec, assets);
    this.targetRing = new THREE.Mesh(new THREE.RingGeometry(.5, .58, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff3a8', transparent: true, opacity: .7, depthWrite: false }));
    scene.add(this.targetRing);
    // A soft coloured disc under the hero keeps them readable in a crowd.
    this.halo = new THREE.Mesh(new THREE.CircleGeometry(.62, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .28, depthWrite: false }));
    this.halo.position.y = .03; this.root.add(this.halo);
    this.speed = 6.2; this.maxHp = 100; this.radius = .45; this.dashMax = 1.1;
    this.skin = 'classic'; this.skinSpec = null;
    this.resetRun(); this.equipWeapon('staff');
  }

  _buildHero(kind, spec, assets, skin = null) {
    const source = skin || assets[spec.model];
    // Skinned meshes need their own skeleton per instance: class heroes use their GLB scene once,
    // skin characters are shared by every class and get a skeleton-aware clone each.
    const model = skin ? cloneSkinned(source) : source;
    model.scale.setScalar(model.getObjectByName('J_Bip_C_Hips') ? ANIME_SCALE : HERO_SCALE);
    // The straw hat reads well in the menu but hides the hero from the top-down battle camera.
    model.traverse(o => { if (/^Kasa/.test(o.name) && !o.isBone) o.scale.multiplyScalar(0.72); });
    model.visible = false;
    const materials = [];
    model.traverse(o => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      if (o.material.map) {
        o.material = o.material.isMeshBasicMaterial ? animeMaterial(o.material) : o.material.clone();
        if (o.material.isMeshStandardMaterial) { o.material.roughness = .75; o.material.metalness = 0; }
        o.material.emissive = new THREE.Color(0); o.material.userData.baseMap = o.material.map;
        materials.push(o.material);
      } else materials.push(...toonify(o));
    });
    this.root.add(model);
    const slot = model.getObjectByName(spec.slot);
    const weapon = assets[spec.weapon].clone(true);
    toonify(weapon);
    weapon.scale.setScalar(spec.weaponScale);
    const holder = new THREE.Group();
    if (!spec.native) holder.rotation.set(0, Math.PI, 0);
    // Anime heroines are scaled up as a whole; staffs sized for chibi hands would tower over them.
    if (model.getObjectByName('J_Bip_C_Hips') && spec.animeScale) holder.scale.setScalar(spec.animeScale);
    if (spec.weaponTilt) weapon.rotation.set(...spec.weaponTilt);
    holder.add(weapon);
    (slot || model).add(holder);
    const muzzle = new THREE.Object3D(); muzzle.position.set(...spec.muzzle); weapon.add(muzzle);
    let arrow = null;
    if (spec.bolt && assets.arrow) {
      arrow = assets.arrow.clone(true); toonify(arrow); arrow.scale.setScalar(spec.bolt.scale); arrow.position.set(...spec.bolt.position); weapon.add(arrow);
    }
    const mixer = new THREE.AnimationMixer(model);
    const lower = {}, upper = {};
    for (const clip of source.userData.clips || []) {
      for (const [isUpper, actions] of [[false, lower], [true, upper]]) {
        const tracks = clip.tracks.filter(track => UPPER.test(track.name) === isUpper);
        if (!tracks.length) continue;
        const action = mixer.clipAction(new THREE.AnimationClip(clip.name + (isUpper ? '_U' : '_L'), clip.duration, tracks));
        action.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0).play();
        actions[clip.name] = action;
      }
    }
    mixer.update(0);
    const hero = { kind, spec, model, mixer, lower, upper, materials, weapon, muzzle, arrow, holder, weaponModel: spec.weapon };
    const look = this.weaponLooks[kind];
    if (look && this.assets[look.model]) this._attachWeapon(hero, look.model);
    return hero;
  }

  /** Weapon looks from the forge (progression.js WEAPON_SKINS); models load on first use. */
  setWeaponLook(look) {
    if (!look || !HEROES[look.cls]) return;
    this.weaponLooks[look.cls] = look;
    const apply = () => {
      if (this.weaponLooks[look.cls] !== look) return;
      for (const hero of [...Object.values(this.heroes), ...Object.values(this.skinHeroes)]) if (hero.kind === look.cls) this._attachWeapon(hero, look.model);
      this.onSkinReady?.();
    };
    if (this.assets[look.model]) apply();
    else loadModel(look.model).then(scene => { if (scene) { this.assets[look.model] = scene; apply(); } });
  }

  _attachWeapon(hero, name) {
    if (hero.weaponModel === name || !this.assets[name]) return;
    const spec = hero.spec, weapon = this.assets[name].clone(true);
    toonify(weapon);
    weapon.scale.setScalar(spec.weaponScale);
    if (spec.weaponTilt) weapon.rotation.set(...spec.weaponTilt);
    hero.holder.remove(hero.weapon); hero.holder.add(weapon);
    weapon.add(hero.muzzle); if (hero.arrow) weapon.add(hero.arrow);
    hero.weapon = weapon; hero.weaponModel = name;
  }

  get hero() { return this.current || this.heroes[this.weaponType]; }

  resetRun() {
    this.x = this.z = this.face = this.turnSpeed = this.vx = this.vz = this.moveBlend = 0;
    this.hp = this.maxHp; this.iframe = this.dash = this.dashCd = this.dashBuffer = 0;
    this.lastMove = [0, 1]; this.dashDir = [0, 1]; this.moving = false;
    this.time = this.attack = this.attackElapsed = 0; this.attackDuration = .56; this.attackIndex = 0; this.attackAngle = 0;
    this.aimTarget = null; this.aimId = null; this.aimAngle = this.aimTimer = 0;
    this.oneShot = null; this.dead = false; this.cheer = 0;
    this.targetRing.visible = false; this.root.position.set(0, 0, 0); this.root.rotation.set(0, 0, 0);
    for (const hero of [...Object.values(this.heroes || {}), ...Object.values(this.skinHeroes || {})]) { hero.mixer.setTime(0); hero.model.rotation.set(0, 0, 0); }
    if (this.weaponType) this._updateAnimation(0);
  }

  /** Swap the whole character. Skin models load on first use; the class hero stands in meanwhile. */
  applySkin(id = 'classic', spec = null) {
    this.skin = id; this.skinSpec = spec?.model ? spec : null;
    const model = this.skinSpec?.model;
    if (model && !this.assets[model]) {
      this.skinLoading = loadModel(model).then(scene => { this.assets[model] = scene; if (this.skinSpec?.model === model) this._showHero(); this.onSkinReady?.(); });
    }
    this._showHero(); return true;
  }

  _showHero() {
    const kind = this.weaponType, model = this.skinSpec?.model;
    let hero = this.heroes[kind];
    if (model && this.assets[model]) hero = this.skinHeroes[`${kind}:${model}`] ??= this._buildHero(kind, HEROES[kind], this.assets, this.assets[model]);
    for (const other of [...Object.values(this.heroes), ...Object.values(this.skinHeroes)]) other.model.visible = other === hero;
    if (this.current !== hero) { this.current = hero; this.oneShot = null; }
    this._updateAnimation(0);
  }

  equipWeapon(kind = 'staff') {
    if (!HEROES[kind]) return false;
    this.weaponType = this.attackKind = kind; this.attack = 0; this.attackElapsed = 0;
    this.aimRange = kind === 'bow' ? 18 : kind === 'staff' ? 16 : 9;
    this.halo.material.color.set(kind === 'bow' ? '#9ff0b8' : kind === 'staff' ? '#d4c8ff' : '#ffc7a8');
    this._showHero(); return true;
  }

  getAttackDelay(kind = this.weaponType) { return kind === 'bow' ? .18 : kind === 'staff' ? .22 : .10; }

  /** Combat releases projectiles on this simulation timeline, at the end of the visible windup. */
  attackWeapon(kind = this.weaponType, angle = this.aimAngle) {
    const family = kind === 'arrow' ? 'bow' : kind === 'arcane' ? 'staff' : kind === 'katana' ? 'sword' : kind;
    if (family !== this.weaponType || this.dead || (this.attack > 0 && this.attackElapsed < this.getAttackDelay(family) + .035)) return false;
    this.attackKind = family; this.attack = 1; this.attackElapsed = 0;
    this.attackDuration = family === 'bow' ? .55 : family === 'staff' ? .64 : .56;
    this.attackAngle = Number.isFinite(angle) ? angle : this.face;
    const hero = this.hero, names = hero.spec.attacks, name = names[this.attackIndex++ % names.length];
    for (const n of names) hero.upper[n]?.setEffectiveWeight(0);
    const action = hero.upper[name];
    if (action) { action.reset().setLoop(THREE.LoopOnce, 1).play(); action.clampWhenFinished = true; action.timeScale = action.getClip().duration / this.attackDuration; }
    this.currentAttack = name;
    return true;
  }

  /** Full-body one-shot clips: hit reaction, victory cheer, awakening, death. */
  play(name, { hold = false, speed = 1 } = {}) {
    const hero = this.hero;
    if (!hero.lower[name] && !hero.upper[name]) return;
    this.oneShot = { name, hold, t: 0, duration: (hero.lower[name] || hero.upper[name]).getClip().duration / speed };
    for (const actions of [hero.lower, hero.upper]) {
      const action = actions[name];
      if (action) { action.reset().setLoop(hold ? THREE.LoopOnce : THREE.LoopOnce, 1).play(); action.clampWhenFinished = true; action.timeScale = speed; }
    }
  }

  die() { this.dead = true; this.attack = 0; this.targetRing.visible = false; this.play('Death_A', { hold: true }); }
  revive() { this.dead = false; this.oneShot = null; this.play('Jump_Idle', { speed: 1.4 }); }

  getMuzzlePosition(out = new THREE.Vector3()) {
    this.root.updateMatrixWorld(true);
    return this.hero.muzzle.getWorldPosition(out);
  }

  update(dt, input, stats, vfx, enemies) {
    this.time += dt;
    if (this.dead) { this._updateAnimation(dt); return; }
    if (this.inputVersion !== input.resetVersion) { this.inputVersion = input.resetVersion; this.dashBuffer = 0; this.vx = this.vz = 0; }
    let [mx, mz] = input.move(); const len = Math.hypot(mx, mz);
    this.moving = len > .1; if (len > 1) { mx /= len; mz /= len; }
    if (this.moving) { this.lastMove[0] = mx / Math.max(1, len); this.lastMove[1] = mz / Math.max(1, len); }
    this.dashCd = Math.max(0, this.dashCd - dt); this.iframe = Math.max(0, this.iframe - dt); this.dashBuffer = Math.max(0, this.dashBuffer - dt);
    if (input.consumeDash()) this.dashBuffer = .14;
    if (this.dashBuffer > 0 && this.dashCd <= 0) {
      this.dashMax = 1.1 * (stats.dash ?? 1) * (stats.buffDash ?? 1); this.dash = .2; this.dashCd = this.dashMax; this.dashBuffer = 0;
      this.dashDir = [...this.lastMove]; this.iframe = Math.max(this.iframe, .3 + (stats.dashGuard || 0));
      vfx?.ring(this.x, this.z, 2.2, '#ffffff', .45); input.onDash?.();
      this.play('Dodge_Forward', { speed: 1.6 });
    }
    input.updateDash?.(this.dashCd);
    const speed = this.speed * (stats.speed ?? 1) * (stats.buffSpeed ?? 1), dashing = this.dash > 0;
    if (dashing) {
      this.dash = Math.max(0, this.dash - dt); this.vx = this.dashDir[0] * speed * 3.6; this.vz = this.dashDir[1] * speed * 3.6;
      if (vfx && Math.random() < .7) vfx.glow?.emit(this.x, .6, this.z, 0, .5, 0, .35, 1.2, 1.2, 1.4, .35);
    } else {
      this.vx = damp(this.vx, mx * speed, this.moving ? 18 : 22, dt); this.vz = damp(this.vz, mz * speed, this.moving ? 18 : 22, dt);
    }
    this.x += this.vx * dt; this.z += this.vz * dt;
    // Trees, rocks and gates are solid: slide along them instead of walking through.
    if (this.collider?.pushOut(this, this.radius)) {
      const { nx, nz } = this.collider.colliders.contact, into = this.vx * nx + this.vz * nz;
      if (into < 0) { this.vx -= nx * into; this.vz -= nz * into; }
    }
    this._updateAim(dt, enemies);
    // Legendary and forged looks leave a glowing trail from the weapon.
    const fx = this.weaponLooks[this.weaponType]?.fx;
    if (fx && vfx && Math.random() < dt * 22) {
      this._fxColor.set(fx); this.getMuzzlePosition(this._fxPos);
      vfx.glow.emit(this._fxPos.x, this._fxPos.y, this._fxPos.z, (Math.random() - .5) * .6, .5 + Math.random() * .6, (Math.random() - .5) * .6, .5, .45, this._fxColor.r * 1.8, this._fxColor.g * 1.8, this._fxColor.b * 1.8, { sizeEnd: .05 });
    }
    const velocity = Math.hypot(this.vx, this.vz);
    if (velocity > .1 || this.aimTarget || this.attack > 0) {
      const heading = dashing ? Math.atan2(this.vx, this.vz) : (this.aimTarget && (this.weaponType !== 'sword' || !this.moving || this.attack > 0)) ? this.aimAngle : Math.atan2(this.vx, this.vz);
      const delta = wrap(heading - this.face);
      this.turnSpeed = damp(this.turnSpeed, THREE.MathUtils.clamp(delta * 12, -9, 9), 18, dt);
      this.face = wrap(this.face + Math.sign(delta) * Math.min(Math.abs(delta), Math.abs(this.turnSpeed * dt)));
    } else this.turnSpeed = damp(this.turnSpeed, 0, 18, dt);
    this.moveBlend = damp(this.moveBlend, THREE.MathUtils.clamp(velocity / Math.max(1, speed), 0, 1), this.moving ? 12 : 16, dt);
    if (this.attack > 0) { this.attackElapsed += dt; this.attack = Math.max(0, 1 - this.attackElapsed / this.attackDuration); }
    this._updateAnimation(dt);
    this.root.position.set(this.x, 0, this.z); this.root.rotation.y = this.face;
    const flash = this.iframe > 0 && !dashing ? .35 + .25 * Math.sin(this.time * 40) : 0;
    for (const m of this.hero.materials) { if (m.emissive) m.emissive.setScalar(flash * .5); if (m.userData.uFlash) m.userData.uFlash.value = flash * .2; }
    if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + (stats.regen ?? 0) * dt);
  }

  _updateAnimation(dt) {
    const hero = this.hero; if (!hero) return;
    const shot = this.oneShot;
    let shotWeight = 0;
    if (shot) {
      shot.t += dt;
      shotWeight = shot.hold ? ease(shot.t / .12) : ease(shot.t / .08) * ease((shot.duration - shot.t) / .15);
      if (!shot.hold && shot.t >= shot.duration) { this.oneShot = null; shotWeight = 0; }
    }
    const attackWeight = this.attack > 0 ? ease(this.attackElapsed / .07) * ease((this.attackDuration - this.attackElapsed) / .19) : 0;
    const run = this.moveBlend, idle = this.cheer > 0 ? 0 : 1 - run;
    const base = { Idle: idle, Running_A: run, Cheer: this.cheer > 0 ? 1 : 0 };
    for (const [name, action] of Object.entries(hero.lower)) {
      const w = shot?.name === name ? shotWeight : (base[name] || 0) * (1 - shotWeight);
      action.setEffectiveWeight(w);
      if (name === 'Running_A') action.timeScale = THREE.MathUtils.clamp(Math.hypot(this.vx, this.vz) / 5.2, .6, 1.6);
    }
    // A class with a hold pose (the crossbow) keeps its arms on the weapon while idling and running.
    const hold = hero.upper[hero.spec.hold] ? hero.spec.hold : null;
    const upperBase = hold ? { [hold]: base.Idle + base.Running_A, Cheer: base.Cheer } : base;
    for (const [name, action] of Object.entries(hero.upper)) {
      let w;
      if (shot?.name === name) w = shotWeight;
      else if (name === this.currentAttack) w = attackWeight * (1 - shotWeight);
      else w = (upperBase[name] || 0) * (1 - attackWeight) * (1 - shotWeight);
      action.setEffectiveWeight(w);
      if (name === 'Running_A' && hero.lower.Running_A) { action.timeScale = hero.lower.Running_A.timeScale; action.time = hero.lower.Running_A.time; }
    }
    hero.mixer.update(dt);
    if (hero.arrow) hero.arrow.visible = !(this.attack > 0 && this.attackElapsed > .18 && this.attackElapsed < .4);
  }

  /** Menu podium: idle, with a happy cheer now and then. */
  updatePreview(dt) {
    this.time += dt;
    this.cheer = Math.max(0, this.cheer - dt);
    if (!this.oneShot && Math.floor(this.time / 7) !== Math.floor((this.time - dt) / 7)) this.play('Cheer');
    this.moveBlend = 0; this.vx = this.vz = 0;
    this._updateAnimation(dt); this.root.updateMatrixWorld(true);
  }

  _updateAim(dt, enemies) {
    if (!enemies) return;
    this.aimTimer -= dt; const target = this.aimTarget, range = this.aimRange || 9;
    const valid = target?.alive && target.id === this.aimId && (target.x - this.x) ** 2 + (target.z - this.z) ** 2 < (range + 1) ** 2;
    if (!valid || this.aimTimer <= 0) {
      this.aimTimer = .08; const nearest = enemies.nearest(this.x, this.z, range);
      if (!valid || (nearest && (nearest.x - this.x) ** 2 + (nearest.z - this.z) ** 2 < ((target.x - this.x) ** 2 + (target.z - this.z) ** 2) * .72)) { this.aimTarget = nearest; this.aimId = nearest?.id; }
    }
    const aim = this.aimTarget; this.targetRing.visible = !!aim;
    if (aim) { this.aimAngle = Math.atan2(aim.x - this.x, aim.z - this.z); this.targetRing.position.set(aim.x, .07, aim.z); this.targetRing.scale.setScalar(((aim.t?.radius ?? .4) + .25) * 1.8); }
    else this.aimAngle = this.face;
  }

  swing() { this.attackWeapon('sword'); }
}
