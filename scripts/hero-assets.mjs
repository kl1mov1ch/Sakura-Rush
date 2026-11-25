// Loads the class heroes and their weapons in Node. Textures are stripped from the GLB first,
// because Node has no Image/WebP decoder; geometry, skeletons and clips stay untouched.
import { readFile } from 'node:fs/promises';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export const HERO_ASSETS = ['hero_mage', 'hero_archer', 'hero_ninja', 'staff', 'bow', 'katana', 'arrow'];

export function stripTextures(bytes) {
  const jsonLength = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString('utf8'));
  for (const material of json.materials || []) {
    if (material.pbrMetallicRoughness) delete material.pbrMetallicRoughness.baseColorTexture;
    delete material.normalTexture; delete material.emissiveTexture; delete material.occlusionTexture;
  }
  delete json.textures; delete json.images; delete json.samplers;
  for (const key of ['extensionsUsed', 'extensionsRequired']) if (json[key]) json[key] = json[key].filter(name => name !== 'EXT_texture_webp');
  let text = Buffer.from(JSON.stringify(json), 'utf8');
  if (text.length % 4) text = Buffer.concat([text, Buffer.alloc(4 - text.length % 4, 0x20)]);
  const rest = bytes.subarray(20 + jsonLength);
  const header = Buffer.alloc(20);
  header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + text.length + rest.length, 8);
  header.writeUInt32LE(text.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, text, rest]);
}

export async function loadHeroAssets(base = new URL('../src/models/', import.meta.url), names = HERO_ASSETS) {
  const loader = new GLTFLoader(), assets = {};
  for (const name of names) {
    const bytes = stripTextures(await readFile(new URL(`${name}.glb`, base)));
    const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    assets[name] = gltf.scene;
    assets[name].userData.clips = gltf.animations;
    assets[name].updateMatrixWorld(true);
  }
  return assets;
}
