import * as THREE from 'three';

function coinGeometry() {
  const coin = new THREE.Shape();
  coin.absarc(0, 0, .17, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.moveTo(-.047, -.047); hole.lineTo(-.047, .047);
  hole.lineTo(.047, .047); hole.lineTo(.047, -.047); hole.closePath();
  coin.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(coin, { depth: .045, bevelEnabled: false, curveSegments: 10, steps: 1 });
  geometry.translate(0, 0, -.0225);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Japanese square-holed mon coins: one instanced draw, no per-drop materials.
 * Values merge when the bounded pool is full, so heavy waves never erase money.
 */
export class CoinDrops {
  constructor(scene, capacity = 256) {
    this.capacity = Number.isSafeInteger(capacity) ? Math.min(512, Math.max(1, capacity)) : 256;
    this.items = [];
    this.pool = [];
    this.material = new THREE.MeshStandardMaterial({ color: '#d9a73e', metalness: .68, roughness: .32, emissive: '#5d3406', emissiveIntensity: .18 });
    this.mesh = new THREE.InstancedMesh(coinGeometry(), this.material, this.capacity);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
    this._pose = new THREE.Object3D();
  }

  get count() { return this.items.length; }
  get value() { let sum = 0; for (const coin of this.items) sum += coin.value; return sum; }

  drop(x, z, value = 1) {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isSafeInteger(value) || value <= 0 || value > 10000) return false;
    if (this.items.length >= this.capacity) {
      let nearest = this.items[0], distanceSq = Infinity;
      for (const coin of this.items) {
        const d = (coin.x - x) ** 2 + (coin.z - z) ** 2;
        if (d < distanceSq) { nearest = coin; distanceSq = d; }
      }
      nearest.value += value;
      return true;
    }
    const coin = this.pool.pop() || {};
    Object.assign(coin, { x, z, value, vx: 0, vz: 0, age: 0, phase: Math.random() * Math.PI * 2, pulling: false });
    this.items.push(coin);
    return true;
  }

  /** Calls onCollect once per simulation step, aggregating a whole pickup burst.
   * Pass the raw value to Campaign.collectCoins; its chapter/talent multipliers
   * must be applied only once by the wallet, not by the physical coin object.
   */
  update(dt, player, magnet = 2.4, onCollect) {
    if (!(dt > 0) || !Number.isFinite(dt) || !Number.isFinite(player?.x) || !Number.isFinite(player?.z)) return 0;
    const radius = Number.isFinite(magnet) ? Math.max(.65, magnet) : 2.4;
    const radiusSq = radius * radius;
    let collected = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const coin = this.items[i];
      coin.age += dt;
      const dx = player.x - coin.x, dz = player.z - coin.z, d2 = dx * dx + dz * dz;
      if (d2 <= radiusSq) coin.pulling = true;
      let touched = d2 < .65 * .65;
      if (!touched && coin.pulling) {
        const distance = Math.sqrt(d2), speed = Math.min(28, 5 + coin.age * 30), blend = 1 - Math.exp(-14 * dt);
        coin.vx += (dx / distance * speed - coin.vx) * blend;
        coin.vz += (dz / distance * speed - coin.vz) * blend;
        const oldX = coin.x, oldZ = coin.z;
        coin.x += coin.vx * dt; coin.z += coin.vz * dt;
        // Swept collection prevents a fast magnetised coin jumping past a
        // stationary player on a slower frame and orbiting forever.
        const sx = coin.x - oldX, sz = coin.z - oldZ, lengthSq = sx * sx + sz * sz;
        const t = lengthSq ? Math.min(1, Math.max(0, ((player.x - oldX) * sx + (player.z - oldZ) * sz) / lengthSq)) : 0;
        touched = (oldX + sx * t - player.x) ** 2 + (oldZ + sz * t - player.z) ** 2 <= .65 * .65;
      }
      if (touched) {
        collected += coin.value;
        this.items[i] = this.items[this.items.length - 1];
        this.items.pop(); this.pool.push(coin);
      }
    }
    if (collected) onCollect?.(collected);
    return collected;
  }

  draw() {
    const pose = this._pose;
    for (let i = 0; i < this.items.length; i++) {
      const coin = this.items[i], size = 1 + Math.min(2.6, Math.log2(coin.value + 1)) * .13;
      pose.position.set(coin.x, .29 + Math.sin(coin.phase + coin.age * 2.1) * .035, coin.z);
      pose.rotation.set(Math.sin(coin.phase + coin.age) * .12, coin.phase + coin.age * .8, .1);
      pose.scale.setScalar(size);
      pose.updateMatrix();
      this.mesh.setMatrixAt(i, pose.matrix);
    }
    this.mesh.count = this.items.length;
    if (this.mesh.count) {
      this.mesh.instanceMatrix.clearUpdateRanges();
      this.mesh.instanceMatrix.addUpdateRange(0, this.mesh.count * 16);
      this.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    const uncollected = this.value;
    for (const coin of this.items) this.pool.push(coin);
    this.items.length = 0;
    this.mesh.count = 0;
    return uncollected;
  }

  dispose() {
    this.clear(); this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose();
  }
}

export default CoinDrops;
