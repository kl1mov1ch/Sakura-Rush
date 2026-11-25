import * as THREE from 'three';

export const OUTLINE_COLOR = 0x040306;

const outlineMaterials = new Map();

// Joint animation baked into instanced monsters. Each vertex carries `rig` =
// (pivot.xyz, kind); each instance carries `aPhase`. Kinds: 1/2 wing on +X/-X
// (flap about the forward axis), 3/4 left/right leg, 5/6 left/right arm
// (swing about the side axis), 7 drifting hem (slow sway).
const RIG_GLSL = /* glsl */`
  attribute vec4 rig;
  attribute float aPhase;
  uniform vec4 uRig;
  mat3 rigRot(float kind, float ph) {
    if (kind < 0.5) return mat3(1.0);
    float s = sin(ph), a = 0.0;
    bool zAxis = false;
    if (kind < 2.5) { a = (s * 0.9 + 0.2) * uRig.x * (kind < 1.5 ? 1.0 : -1.0); zAxis = true; }
    else if (kind < 4.5) a = s * uRig.y * (kind < 3.5 ? 1.0 : -1.0);
    else if (kind < 6.5) a = s * uRig.z * (kind < 5.5 ? -1.0 : 1.0);
    else { a = sin(ph * 0.6) * uRig.w; zAxis = true; }
    float c = cos(a), n = sin(a);
    return zAxis ? mat3(c, n, 0.0, -n, c, 0.0, 0.0, 0.0, 1.0) : mat3(1.0, 0.0, 0.0, 0.0, c, n, 0.0, -n, c);
  }`;

/**
 * Physically based material for the grounded, non-cartoon look.
 * vertexColors: geometry carries `color`, `emit` and `rm` (roughness, metalness) baked from glTF materials.
 * instanced: per-instance `aFlash` (hit flash); `rigged` adds joint animation in the vertex shader.
 */
export function makeShaded({ color = 0xffffff, emissive = 0x000000, emissiveIntensity = 1, roughness = 0.75, metalness = 0, vertexColors = false, instanced = false, rigged = false, rig = [0, 0, 0, 0], transparent = false, opacity = 1 } = {}) {
  const m = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness, vertexColors, transparent, opacity });
  m.userData.uFlash = { value: 0 };
  m.userData.uRig = { value: new THREE.Vector4(...rig) };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uFlash = m.userData.uFlash;
    shader.uniforms.uRig = m.userData.uRig;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        ${vertexColors ? 'attribute vec3 emit; attribute vec2 rm; varying vec3 vEmit; varying vec2 vRM;' : ''}
        ${instanced ? 'attribute float aFlash; varying float vFlash;' : ''}
        ${rigged ? RIG_GLSL : ''}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${rigged ? 'mat3 rigR = rigRot(rig.w, aPhase); objectNormal = rigR * objectNormal;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${rigged ? 'transformed = rigR * (transformed - rig.xyz) + rig.xyz;' : ''}
        ${vertexColors ? 'vEmit = emit; vRM = rm;' : ''}
        ${instanced ? 'vFlash = aFlash;' : ''}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFlash;
        ${vertexColors ? 'varying vec3 vEmit; varying vec2 vRM;' : ''}
        ${instanced ? 'varying float vFlash;' : ''}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        ${vertexColors ? 'roughnessFactor = vRM.x;' : ''}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        ${vertexColors ? 'metalnessFactor = vRM.y;' : ''}`)
      .replace('#include <opaque_fragment>', `
        float rimF = 1.0 - max(dot(normalize(vViewPosition), normal), 0.0);
        outgoingLight += vec3(0.42, 0.5, 0.75) * pow(rimF, 3.0) * 0.32;  // cold moonlight on silhouettes
        ${vertexColors ? 'outgoingLight += vEmit;' : ''}
        float fl = clamp(uFlash ${instanced ? '+ vFlash' : ''}, 0.0, 1.0);
        outgoingLight = mix(outgoingLight, vec3(1.5, 1.35, 1.3), fl);
        #include <opaque_fragment>`);
  };
  m.customProgramCacheKey = () => `shaded-${vertexColors}-${instanced}-${rigged}`;
  return m;
}

/** Kept for older call sites: the game no longer uses banded cel shading. */
export const makeToon = makeShaded;

/** Inverted-hull outline: back faces pushed out along smoothed normals (`snormal`). */
export function makeOutline(thickness = 0.035, color = OUTLINE_COLOR) {
  const key = `${thickness}-${color}`;
  if (outlineMaterials.has(key)) return outlineMaterials.get(key);
  const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  m.userData.uThickness = { value: thickness };
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uThickness = m.userData.uThickness;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 snormal; uniform float uThickness;')
      .replace('#include <begin_vertex>', 'vec3 transformed = position + snormal * uThickness;');
  };
  m.customProgramCacheKey = () => 'outline-uniform';
  outlineMaterials.set(key, m);
  return m;
}

/** Average normals of coincident vertices so hard-edged meshes still get a closed outline. */
export function addSmoothNormals(geo) {
  if (geo.attributes.snormal) return geo;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const acc = new Map();
  const keys = new Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const k = `${Math.round(pos.getX(i) * 500)},${Math.round(pos.getY(i) * 500)},${Math.round(pos.getZ(i) * 500)}`;
    keys[i] = k;
    const a = acc.get(k) || [0, 0, 0];
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
    acc.set(k, a);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(keys[i]);
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  geo.setAttribute('snormal', new THREE.BufferAttribute(out, 3));
  return geo;
}
