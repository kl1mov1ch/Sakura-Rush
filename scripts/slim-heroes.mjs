// Needs: npm i --no-save @gltf-transform/core@4 @gltf-transform/extensions@4 @gltf-transform/functions@4
// Usage: node scripts/slim-heroes.mjs src/models/hero_*.glb src/models/skin_*.glb
// (prune is left out on purpose: it drops a skin the VRoid meshes still use and the scene renders black)
// Shrink VRoid heroine GLBs: drop unused attributes, dedup and quantize what three's GLTFLoader reads natively.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { prune, dedup, quantize, resample } from '@gltf-transform/functions';
import fs from 'fs';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const mode = process.env.SLIM || 'resample,dedup,quant';
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) for (const s of p.listSemantics()) if (/^(TEXCOORD_[1-9]|COLOR_0|TANGENT)$/.test(s)) p.setAttribute(s, null);
  const steps = [];
  if (mode.includes('resample')) steps.push(resample({ tolerance: 2e-3 }));
  if (mode.includes('dedup')) steps.push(dedup());
  if (mode.includes('prune')) steps.push(prune({ keepLeaves: true, keepAttributes: false }));
  if (mode.includes('quant')) steps.push(quantize({ pattern: new RegExp(process.env.QP || '^(NORMAL|TEXCOORD_0|WEIGHTS_0)$'), quantizeNormal: 8, quantizeTexcoord: 12, quantizeWeight: 8 }));
  await doc.transform(...steps);
  await io.write(f, doc);
  console.log(f.split('/').pop(), Math.round(fs.statSync(f).size / 1024), 'KB');
}
