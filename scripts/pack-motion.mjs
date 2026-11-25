import { readFileSync, writeFileSync } from 'node:fs';
const file = 'src/models/hero.glb';
const original = readFileSync(file);
const jsonLength = original.readUInt32LE(12);
const gltf = JSON.parse(original.subarray(20, 20 + jsonLength));
const binaryOffset = 20 + jsonLength;
const binaryLength = original.readUInt32LE(binaryOffset);
let chunks = [original.subarray(binaryOffset + 8, binaryOffset + 8 + binaryLength)];
let length = chunks[0].length;
const { clips } = JSON.parse(readFileSync('tmp/motion-clips.json', 'utf8'));
function accessor(values, type, min, max) {
  const pad = (4 - length % 4) % 4;
  if (pad) { chunks.push(Buffer.alloc(pad)); length += pad; }
  const data = Buffer.from(new Float32Array(values).buffer);
  const view = gltf.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: data.length }) - 1;
  chunks.push(data); length += data.length;
  return gltf.accessors.push({ bufferView: view, componentType: 5126, count: values.length / (type === 'VEC4' ? 4 : type === 'VEC3' ? 3 : 1), type, ...(min ? { min, max } : {}) }) - 1;
}
gltf.animations = [];
for (const clip of clips) {
  const input = accessor(clip.times, 'SCALAR', [0], [clip.duration]);
  const animation = { name: clip.name, samplers: [], channels: [] };
  for (const [name, data] of Object.entries(clip.tracks)) {
    const node = gltf.nodes.findIndex(n => n.name === name);
    if (node < 0) throw new Error(`Missing joint ${name}`);
    for (const [field, path, type] of [['rotations', 'rotation', 'VEC4'], ...(name === 'Pelvis' ? [['positions', 'translation', 'VEC3']] : [])]) {
      const output = accessor(data[field], type);
      const sampler = animation.samplers.push({ input, output, interpolation: 'LINEAR' }) - 1;
      animation.channels.push({ sampler, target: { node, path } });
    }
  }
  gltf.animations.push(animation);
}
gltf.buffers[0].byteLength = length;
gltf.asset.extras = { animationAuthor: 'Quaternius', animationLicense: 'CC0-1.0', source: 'https://opengameart.org/content/universal-animation-library', adaptedFor: 'Sakura Rush articulated samurai' };
const json = Buffer.from(JSON.stringify(gltf));
const jsonPad = Buffer.alloc((4 - json.length % 4) % 4, 32);
const binaryPad = Buffer.alloc((4 - length % 4) % 4);
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8);
header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4);
jsonHeader.writeUInt32LE(json.length + jsonPad.length); jsonHeader.writeUInt32LE(0x4e4f534a, 4);
binHeader.writeUInt32LE(length + binaryPad.length); binHeader.writeUInt32LE(0x004e4942, 4);
const output = Buffer.concat([header, jsonHeader, json, jsonPad, binHeader, ...chunks, binaryPad]);
output.writeUInt32LE(output.length, 8); writeFileSync(file, output);
console.log(`Packed ${gltf.animations.length} authored animation clips into ${file}: ${output.length} bytes`);
const statsFile = 'src/models/model-stats.json';
const stats = JSON.parse(readFileSync(statsFile, 'utf8'));
stats.hero = {
  triangles: gltf.meshes.reduce((total, mesh) => total + mesh.primitives.reduce((n, primitive) => n + (primitive.indices !== undefined ? gltf.accessors[primitive.indices].count : gltf.accessors[primitive.attributes.POSITION].count) / 3, 0), 0),
  bytes: output.length,
  joints: 15,
  animationClips: gltf.animations.length,
};
writeFileSync(statsFile, JSON.stringify(stats, null, 2) + '\n');
