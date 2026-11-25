import * as THREE from 'three';
import { bakeMerged, InstancedModel } from './assets.js';

// Enemy attacks that are not plain body contact: tengu feather darts and the red
// ground warnings that show where a kappa (or the shogun) is about to land.
const MAX_SHOTS = 160;
const MAX_MARKS = 24;

const markShader = {
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uK, uA; uniform vec3 uColor; varying vec2 vUv;
    void main(){
      vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
      float rim = smoothstep(0.86, 0.94, r) * (1.0 - smoothstep(0.97, 1.0, r));
      float fill = (1.0 - smoothstep(uK - 0.04, uK, r)) * 0.42;
      float a = (rim * 0.9 + fill + 0.1) * uA;
      gl_FragColor = vec4(uColor * (0.6 + rim), a);
    }`,
};

export class Hazards {
  constructor(scene, assets) {
    this.shots = [];
    this.model = new InstancedModel(scene, bakeMerged(assets.feather), MAX_SHOTS);
    const geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.marks = Array.from({ length: MAX_MARKS }, () => {
      const mesh = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
        ...markShader, transparent: true, depthWrite: false,
        uniforms: { uK: { value: 0 }, uA: { value: 0 }, uColor: { value: new THREE.Color('#e04a4a') } },
      }));
      mesh.visible = false; mesh.position.y = 0.06; mesh.renderOrder = 2;
      scene.add(mesh);
      return { mesh, active: false, t: 0, dur: 1, owner: null };
    });
  }

  /** A feather dart flying straight at `angle`; `src` is the shooter (gets the hit knockback). */
  shoot(x, z, angle, { speed = 9, dmg = 8, life = 2.6 } = {}) {
    if (this.shots.length >= MAX_SHOTS) return null;
    const s = { x, z, vx: Math.sin(angle) * speed, vz: Math.cos(angle) * speed, face: angle, dmg, life, kx: 0, kz: 0, age: 0 };
    this.shots.push(s);
    return s;
  }

  /** A ground warning that fills up over `dur` seconds. */
  mark(x, z, radius, dur, owner = null, color = '#e04a4a') {
    const m = this.marks.find(it => !it.active) || this.marks[0];
    Object.assign(m, { active: true, t: 0, dur, owner });
    m.mesh.position.set(x, 0.06, z);
    m.mesh.scale.setScalar(radius);
    m.mesh.material.uniforms.uColor.value.set(color);
    m.mesh.visible = true;
    return m;
  }

  release(owner) { for (const m of this.marks) if (m.owner === owner) { m.active = false; m.mesh.visible = false; } }

  update(dt, player, game) {
    const world = game.world;
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.age += dt; s.life -= dt;
      s.x += s.vx * dt; s.z += s.vz * dt;
      const dx = player.x - s.x, dz = player.z - s.z;
      let gone = s.life <= 0;
      if (!gone && dx * dx + dz * dz < (player.radius + 0.25) ** 2 && player.hp > 0) {
        if (player.iframe <= 0 && !(player.dash > 0)) game.hurtPlayer(s.dmg, s);
        gone = player.iframe > 0 && !(player.dash > 0); // a dash passes through the dart
      }
      if (!gone && world?.blocked(s.x, s.z, 0.05)) {
        gone = true;
        game.vfx.sparks.burst(s.x, 0.9, s.z, 5, { speed: 3, life: 0.3, size: 0.35, color: [1.4, 0.9, 0.6] });
      }
      if (gone) { this.shots[i] = this.shots[this.shots.length - 1]; this.shots.pop(); }
    }
    for (const m of this.marks) {
      if (!m.active) continue;
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      m.mesh.material.uniforms.uK.value = k;
      m.mesh.material.uniforms.uA.value = Math.min(1, m.t * 6) * (k >= 1 ? Math.max(0, 1 - (m.t - m.dur) * 8) : 1);
      if (m.t > m.dur + 0.15) { m.active = false; m.mesh.visible = false; }
    }
  }

  draw(world) {
    this.model.begin();
    for (const s of this.shots) {
      if (world.isVisible && !world.isVisible(s.x, s.z, 1)) continue;
      this.model.push(s.x, 0.95, s.z, s.face, 1.7, 1.7, 1.7, 0.35 + Math.sin(s.age * 20) * 0.1, 0, 0, 0);
    }
    this.model.end();
  }

  clear() {
    this.shots.length = 0;
    for (const m of this.marks) { m.active = false; m.mesh.visible = false; }
    this.model.begin(); this.model.end();
  }
}
