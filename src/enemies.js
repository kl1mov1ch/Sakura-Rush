import { bakeMerged, InstancedModel } from './assets.js';

// rig: joint swing amplitudes (wings, legs, arms, hem) baked into the instanced shader; gait: animation cycles per second.
export const TYPES = {
  ashigaru: { name: 'Скелет-асигару', model: 'ashigaru', hp: 13, speed: 2.35, dmg: 7, xp: 1, radius: 0.42, scale: 1.0, color: [1.6, 0.5, 0.3], rig: [0, 0.55, 0.35, 0], gait: 1.15 },
  bat: { name: 'Летучая мышь', model: 'bat', hp: 7, speed: 3.9, dmg: 6, xp: 1, radius: 0.4, scale: 1.0, fly: 1.0, color: [1.6, 0.3, 0.4], rig: [0.85, 0, 0, 0], gait: 2.6 },
  yurei: { name: 'Юрэй', model: 'yurei', ghost: true, hp: 30, speed: 2.8, dmg: 10, xp: 3, radius: 0.45, scale: 1.0, color: [1.0, 1.4, 2.0], rig: [0, 0, 0, 0.2], gait: 0.45 },
  oni: { name: 'Синий они', model: 'oni', hp: 105, speed: 1.9, dmg: 16, xp: 8, radius: 0.75, scale: 0.92, color: [2.0, 0.5, 0.3], rig: [0, 0.4, 0.45, 0], gait: 0.75 },
  // Round 3 yokai with their own attacks (see `ai` in Enemies.update):
  // kappa leap onto the hero, tengu keep their distance and throw feather darts, shamans raise minions.
  kappa: { name: 'Жаба-прыгун', model: 'kappa', ai: 'jump', hp: 34, speed: 2.2, dmg: 12, xp: 3, radius: 0.5, scale: 1.0, color: [0.5, 1.6, 0.6], rig: [0, 0.5, 0.4, 0], gait: 1.0 },
  tengu: { name: 'Ниндзя-метатель', model: 'tengu', ai: 'shoot', hp: 26, speed: 2.6, dmg: 7, shot: 9, xp: 3, radius: 0.45, scale: 1.0, color: [1.8, 0.5, 0.4], rig: [0.55, 0.45, 0.3, 0], gait: 0.9 },
  shaman: { name: 'Скелет-колдун', model: 'shaman', ai: 'summon', hp: 60, speed: 1.7, dmg: 9, xp: 6, radius: 0.5, scale: 1.0, color: [1.3, 0.6, 2.0], rig: [0, 0, 0.3, 0.2], gait: 0.6 },
  boss: { name: 'Они-сёгун', model: 'oni_lord', hp: 2600, speed: 2.25, dmg: 28, xp: 0, radius: 1.8, scale: 2.2, color: [1.4, 0.6, 2.2], boss: true, ai: 'boss', rig: [0, 0.35, 0.5, 0], gait: 0.55 },
};

const CELL = 2;
const MAX_NORMAL = 600;
const AIRBORNE = 1;

// Fast exact integer keys in the common case; long runs fall back to strings
// rather than wrapping into an unrelated cell like the old 13-bit encoding.
function cellKey(x, z) {
  if (x >= -32768 && x <= 32767 && z >= -32768 && z <= 32767) return (x << 16) | (z & 65535);
  return `${x}:${z}`;
}

export class Enemies {
  constructor(scene, assets) {
    this.list = [];
    this.pool = [];
    this.models = {};
    this.counts = {};
    const geos = {};
    for (const [k, t] of Object.entries(TYPES)) {
      geos[t.model] ??= bakeMerged(assets[t.model]);
      this.models[k] = new InstancedModel(scene, geos[t.model], t.boss ? 4 : MAX_NORMAL, { tint: t.tint ?? 0xffffff, rig: t.rig });
      this.counts[k] = 0;
    }
    this.modelList = Object.values(this.models);
    this.grid = new Map();
    this._buckets = [];
    this._maxRadius = 0.75;
    this._nextId = 1;
    this._normalCount = 0;
    this.kills = 0;
    this.boss = null;
  }

  spawn(type, x, z, hpMul = 1) {
    const t = TYPES[type];
    if (!t) throw new Error(`Unknown enemy type: ${type}`);
    // Swarms used to bypass the main-loop cap, creating invisible damaging actors.
    if (this.counts[type] >= this.models[type].capacity || (!t.boss && this._normalCount >= MAX_NORMAL)) return null;
    const e = this.pool.pop() || { hitCd: {} };
    for (const k in e.hitCd) delete e.hitCd[k];
    Object.assign(e, { id: this._nextId++, type, t, x, z, kx: 0, kz: 0, hp: t.hp * hpMul, maxHp: t.hp * hpMul, flash: 0, phase: Math.random() * 10, face: 0, alive: true, slow: 0, freeze: 0, spawnT: 0, elite: false, dmgMul: 1, speedMul: 1, st: 'walk', st_t: 0, cd: 1.5 + Math.random() * 2, air: 0, sx: 0, sz: 0, tx: 0, tz: 0, owner: 0, squash: 0 });
    this.list.push(e);
    this.counts[type]++;
    if (t.boss) this.boss = e;
    else this._normalCount++;
    this._maxRadius = Math.max(this._maxRadius, t.radius);
    this._insert(e);
    return e;
  }

  _insert(e, key = cellKey(Math.floor(e.x / CELL), Math.floor(e.z / CELL))) {
    let bucket = this.grid.get(key);
    if (!bucket) {
      bucket = this._buckets.pop() || [];
      this.grid.set(key, bucket);
    }
    e._cell = key;
    e._slot = bucket.length;
    bucket.push(e);
  }

  _moveCell(e) {
    const key = cellKey(Math.floor(e.x / CELL), Math.floor(e.z / CELL));
    if (key === e._cell) return;
    this._removeCell(e);
    this._insert(e, key);
  }

  _removeCell(e) {
    const old = this.grid.get(e._cell);
    const tail = old.pop();
    if (tail !== e) { old[e._slot] = tail; tail._slot = e._slot; }
    if (!old.length) { this.grid.delete(e._cell); this._buckets.push(old); }
  }

  _compact() {
    let live = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (e.alive) { this.list[live++] = e; continue; }
      this._removeCell(e);
      this.counts[e.type]--;
      if (!e.t.boss) this._normalCount--;
      if (this.boss === e) this.boss = null;
      this.pool.push(e);
    }
    this.list.length = live;
    this._maxRadius = this.counts.boss ? 1.8 : .75;
  }

  /** Recycle buckets and compact the live list in place, without per-frame arrays. */
  _rebuildGrid() {
    for (const bucket of this.grid.values()) { bucket.length = 0; this._buckets.push(bucket); }
    this.grid.clear();
    this._maxRadius = 0;
    let live = 0;
    for (let i = 0; i < this.list.length; i++) {
      const e = this.list[i];
      if (!e.alive) {
        this.counts[e.type]--;
        if (!e.t.boss) this._normalCount--;
        if (this.boss === e) this.boss = null;
        this.pool.push(e);
        continue;
      }
      this.list[live++] = e;
      this._maxRadius = Math.max(this._maxRadius, e.t.radius);
      this._insert(e);
    }
    this.list.length = live;
  }

  query(x, z, r, out = []) {
    out.length = 0;
    const reach = r + this._maxRadius;
    const x0 = Math.floor((x - reach) / CELL), x1 = Math.floor((x + reach) / CELL);
    const z0 = Math.floor((z - reach) / CELL), z1 = Math.floor((z + reach) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
      const bucket = this.grid.get(cellKey(cx, cz));
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i++) {
        const e = bucket[i];
        if (!e.alive) continue;
        const dx = e.x - x, dz = e.z - z, rr = r + e.t.radius;
        if (dx * dx + dz * dz <= rr * rr) out.push(e);
      }
    }
    return out;
  }

  nearest(x, z, maxR = 30, skip) {
    let best = null, bd = maxR * maxR;
    const x0 = Math.floor((x - maxR) / CELL), x1 = Math.floor((x + maxR) / CELL);
    const z0 = Math.floor((z - maxR) / CELL), z1 = Math.floor((z + maxR) / CELL);
    // Large searches on a sparse field are cheaper as a direct scan. Small
    // homing/chain queries only inspect local cells, not the whole horde.
    if ((x1 - x0 + 1) * (z1 - z0 + 1) > this.list.length) {
      for (const e of this.list) {
        if (!e.alive || skip?.has(e)) continue;
        const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz;
        if (d < bd) { bd = d; best = e; }
      }
    } else {
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const bucket = this.grid.get(cellKey(cx, cz));
        if (!bucket) continue;
        for (const e of bucket) {
          if (!e.alive || skip?.has(e)) continue;
          const dx = e.x - x, dz = e.z - z, d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = e; }
        }
      }
    }
    return best;
  }

  update(dt, player, game) {
    this._compact();
    const kd = Math.exp(-dt * 8);
    for (const e of this.list) {
      if (!e.alive) continue;
      const t = e.t;
      e.spawnT = Math.min(1, e.spawnT + dt * 3);
      e.phase += dt;
      e.flash = Math.max(0, e.flash - dt * 6);
      e.slow = Math.max(0, e.slow - dt);
      e.freeze = Math.max(0, e.freeze - dt);
      const dx = player.x - e.x, dz = player.z - e.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      let spd = e.freeze > 0 ? 0 : t.speed * e.speedMul * (e.slow > 0 ? 0.6 : 1);
      if (e.type === 'ashigaru') spd *= 0.75 + Math.max(0, Math.sin(e.phase * 7.2)) * 0.5; // lurching, uneven steps
      let vx = (dx / d) * spd, vz = (dz / d) * spd;
      if (e.type === 'yurei' && e.freeze <= 0) { const w = Math.sin(e.phase * 3) * 1.6; vx += (-dz / d) * w; vz += (dx / d) * w; }
      if (t.ai && e.freeze <= 0) {
        const steer = this._think(e, t, dt, d, dx, dz, spd, player, game);
        if (steer === AIRBORNE) { this._moveCell(e); continue; }
        if (steer) { vx = steer[0]; vz = steer[1]; }
      }

      // A bounded local neighbourhood keeps dense crowds from becoming O(N²).
      const reach = t.radius + this._maxRadius;
      const x0 = Math.floor((e.x - reach) / CELL), x1 = Math.floor((e.x + reach) / CELL);
      const z0 = Math.floor((e.z - reach) / CELL), z1 = Math.floor((e.z + reach) / CELL);
      let separated = 0, checked = 0;
      neighbours: for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) {
        const bucket = this.grid.get(cellKey(cx, cz));
        if (!bucket) continue;
        // Rotate through crowded buckets so the same few enemies do not win
        // every separation check; no temporary neighbour list is allocated.
        const offset = e.id % bucket.length;
        for (let i = 0; i < bucket.length; i++) {
          const index = i + offset;
          const o = bucket[index < bucket.length ? index : index - bucket.length];
          if (o === e || !o.alive) continue;
          if (++checked > 28) break neighbours;
          let ox = e.x - o.x, oz = e.z - o.z;
          const min = t.radius + o.t.radius;
          let od2 = ox * ox + oz * oz;
          if (od2 >= min * min) continue;
          if (od2 < 1e-8) { const a = e.id * 2.399963; ox = Math.sin(a) * 0.01; oz = Math.cos(a) * 0.01; od2 = .0001; }
          const od = Math.sqrt(od2), push = (min - od) * (o.t.boss ? 8 : 4);
          vx += (ox / od) * push; vz += (oz / od) * push;
          if (++separated >= 6) break neighbours;
        }
      }
      e.x += (vx + e.kx) * dt; e.z += (vz + e.kz) * dt;
      // Walkers go around trees and rocks: on contact they slide along the obstacle, each enemy
      // picking a side by id so a crowd splits around it. Bats and ghosts fly over.
      if (game?.world && !t.fly && !t.ghost && game.world.pushOut(e, t.radius * .8)) {
        const { nx, nz } = game.world.colliders.contact, side = e.id & 1 ? 1 : -1;
        e.x += -nz * side * spd * .7 * dt; e.z += nx * side * spd * .7 * dt;
      }
      e.kx *= kd; e.kz *= kd;
      e.face = Math.atan2(dx, dz);

      const contactX = player.x - e.x, contactZ = player.z - e.z;
      if (contactX * contactX + contactZ * contactZ < (t.radius + player.radius) ** 2 && player.iframe <= 0 && player.hp > 0) game.hurtPlayer(Math.round(t.dmg * e.dmgMul), e);
      if (d > 45 && !t.boss && !e.elite) {
        // Re-enter beyond the view ahead of the player, rather than repeatedly
        // teleporting onto the same trailing side of an endless run.
        e.x = player.x + (dx / d) * 30 + (Math.random() - 0.5) * 10;
        e.z = player.z + (dz / d) * 30;
      }
      this._moveCell(e);
    }
  }

  /** Special behaviours. Returns a velocity to use instead of walking straight at the hero,
   *  AIRBORNE while a leap is in flight (no pushing, contact or walls), or null to walk normally. */
  _think(e, t, dt, d, dx, dz, spd, player, game) {
    e.cd -= dt; e.st_t += dt;
    const hz = game?.hazards, ux = dx / d, uz = dz / d;
    const leap = t.ai === 'jump' || (t.ai === 'boss' && e.cd2 === 'leap');
    if (e.st === 'crouch') { // telegraph: the landing spot glows red before the jump
      if (e.st_t >= (t.boss ? 0.9 : 0.55)) { e.st = 'air'; e.st_t = 0; e.sx = e.x; e.sz = e.z; }
      return [0, 0];
    }
    if (e.st === 'air') {
      const dur = t.boss ? 0.95 : 0.7, k = Math.min(1, e.st_t / dur);
      e.x = e.sx + (e.tx - e.sx) * k; e.z = e.sz + (e.tz - e.sz) * k;
      e.air = Math.sin(k * Math.PI) * (t.boss ? 4 : 2.6);
      if (k >= 1) {
        e.air = 0; e.st = 'recover'; e.st_t = 0; e.squash = 1;
        const r = t.boss ? 4.2 : 1.9, px = player.x - e.x, pz = player.z - e.z;
        if (px * px + pz * pz < (r + player.radius) ** 2 && player.iframe <= 0 && player.hp > 0) game.hurtPlayer(Math.round(t.dmg * e.dmgMul * (t.boss ? 1.3 : 1.2)), e);
        game?.vfx?.ring(e.x, e.z, r, t.boss ? '#ff6a4a' : '#9fe07a', 0.45);
        game?.vfx?.sparks.burst(e.x, 0.3, e.z, t.boss ? 30 : 10, { speed: t.boss ? 10 : 5, up: 4, life: 0.4, size: 0.5, color: [1.2, 1.1, 0.8], grav: -14 });
        if (t.boss) { game?.shake?.(0.5); game?.audio?.boom?.(); }
      }
      return AIRBORNE;
    }
    if (e.st === 'recover') { if (e.st_t > (t.boss ? 0.7 : 0.45)) e.st = 'walk'; return [0, 0]; }
    if (e.st === 'aim') { // tengu: raises the arm, then throws
      if (e.st_t >= 0.45) {
        e.st = 'walk'; e.cd = 2.4 + Math.random() * 1.2;
        const a = Math.atan2(dx, dz), n = e.elite || e.dmgMul > 1.25 ? 3 : 1;
        for (let i = 0; i < n; i++) hz?.shoot(e.x + ux * 0.5, e.z + uz * 0.5, a + (i - (n - 1) / 2) * 0.22, { dmg: Math.round(t.shot * e.dmgMul), speed: 9.5 });
      }
      return [0, 0];
    }
    if (e.st === 'cast') { // shaman (and the shogun): a circle of light, then minions climb out of the ground
      if (e.st_t >= 1.0) {
        e.st = 'walk'; e.cd = t.boss ? 9 : 6.5 + Math.random() * 2;
        game?.summonMinions?.(e, t.boss ? 6 : 3);
      }
      return [0, 0];
    }
    if (leap && e.cd <= 0 && d < (t.boss ? 14 : 8) && d > 2) {
      e.st = 'crouch'; e.st_t = 0; e.cd = t.boss ? 7 : 3 + Math.random() * 1.5;
      // Aim where the hero is now: moving keeps you safe, standing still does not.
      e.tx = player.x; e.tz = player.z;
      hz?.mark(e.tx, e.tz, t.boss ? 4.2 : 1.9, (t.boss ? 0.9 + 0.95 : 0.55 + 0.7), e);
      if (t.boss) e.cd2 = 'summon';
      return [0, 0];
    }
    if (t.ai === 'boss') {
      if (e.cd <= 0 && e.cd2 === 'summon') { e.st = 'cast'; e.st_t = 0; e.cd2 = 'leap'; game?.vfx?.ring(e.x, e.z, 3.5, '#b48cff', 1.0); }
      e.cd2 ??= 'leap';
      return null;
    }
    if (t.ai === 'shoot') {
      if (e.cd <= 0 && d < 13) { e.st = 'aim'; e.st_t = 0; return [0, 0]; }
      // Keep about 8 m away and circle the hero instead of running into the blades.
      const want = d > 10 ? 1 : d < 6.5 ? -1.1 : 0, side = (e.id & 1 ? 1 : -1) * 0.75;
      return [(ux * want - uz * side) * spd, (uz * want + ux * side) * spd];
    }
    if (t.ai === 'summon') {
      if (e.cd <= 0 && d < 16) { e.st = 'cast'; e.st_t = 0; game?.vfx?.ring(e.x, e.z, 2.4, '#b48cff', 1.0); return [0, 0]; }
      const want = d > 12 ? 1 : d < 9 ? -0.9 : 0;
      return [ux * want * spd, uz * want * spd];
    }
    return null;
  }

  /** Minions raised by `owner` that are still alive. */
  minionsOf(owner) { let n = 0; for (const e of this.list) if (e.alive && e.owner === owner.id) n++; return n; }

  clear() {
    for (const e of this.list) e.alive = false;
    this._compact();
    this.kills = 0;
    for (const model of this.modelList) { model.begin(); model.end(); }
  }

  draw(world) {
    for (const m of this.modelList) m.begin();
    for (const e of this.list) {
      if (!e.alive) continue;
      if (world.isVisible && !world.isVisible(e.x, e.z, e.t.radius + 2)) continue;
      const t = e.t, m = this.models[e.type];
      const pop = e.spawnT < 1 ? 0.3 + 0.7 * e.spawnT : 1;
      const s = t.scale * pop * (e.elite ? 1.3 : 1);
      // Frozen monsters stop mid-stride; slowed ones move their limbs slower too.
      const gait = e.phase * t.gait * Math.PI * 2;
      if (e.freeze <= 0) e.anim = gait;
      const anim = e.anim ?? gait;
      let y = 0, tilt = 0, lean = 0;
      if (e.type === 'bat') {
        y = t.fly + Math.sin(anim + 1.2) * 0.12; lean = 0.15;
      } else if (e.type === 'yurei') {
        y = 0.25 + Math.sin(e.phase * 2.2) * 0.15; lean = 0.18;
      } else if (e.st === 'air' || e.st === 'crouch' || e.squash > 0) {
        y = e.air; lean = e.st === 'crouch' ? 0.25 : -0.1;
      } else {
        y = Math.abs(Math.sin(anim)) * 0.05 * s; tilt = Math.sin(anim) * 0.05; lean = e.type === 'ashigaru' ? 0.12 : 0.06;
      }
      let glint = e.elite ? 0.12 + Math.sin(e.phase * 6) * 0.08 : 0;
      // Wind-ups pulse so the player can read the attack; landings squash.
      if (e.st === 'crouch' || e.st === 'aim' || e.st === 'cast') glint = Math.max(glint, 0.25 + Math.sin(e.st_t * 30) * 0.15);
      const squash = e.st === 'crouch' ? 0.25 * Math.min(1, e.st_t * 3) : e.squash * 0.3;
      if (e.squash > 0) e.squash = Math.max(0, e.squash - 0.06);
      const sy = s * (1 - squash), sw = s * (1 + squash * 0.6);
      m.push(e.x, y, e.z, e.face, sw, sy, sw, Math.max(e.flash, glint), lean, tilt, anim);
      world.shadow(e.x, e.z, t.radius * 2.6 * pop);
    }
    for (const m of this.modelList) m.end();
  }
}
