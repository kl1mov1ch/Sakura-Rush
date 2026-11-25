/** Pin the author-hosted CC0 Standard archive; never downloaded by the shipped game. */
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const cache = resolve(root, 'tmp/motion-source');
const archive = resolve(cache, 'universal-animation.zip');
const extracted = resolve(cache, 'quaternius');
const model = resolve(extracted, 'Animation Library[Standard]/Godot/AnimationLibrary_Godot_Standard.glb');
const url = 'https://opengameart.org/sites/default/files/universal_animation_librarystandard.zip';
const sha256 = '18ff1a7215f4852b320203e8aaf02a1578b5c8eef9027fbaedfcedc7b85a3ac2';
mkdirSync(cache, {recursive: true});
if (!existsSync(archive)) {
  console.log('Downloading Quaternius CC0 animation source from its author-hosted archive...');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Animation source HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Animation archive checksum changed. Review author source before accepting a new archive.');
  writeFileSync(archive, bytes);
}
if (createHash('sha256').update(readFileSync(archive)).digest('hex') !== sha256) throw new Error('Cached animation archive checksum mismatch');
if (!existsSync(model)) {
  const quote = value => "'" + value.replaceAll("'", "''") + "'";
  const unpack = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath ${quote(archive)} -DestinationPath ${quote(extracted)} -Force`], {stdio:'inherit',windowsHide:true})
    : spawnSync('unzip', ['-q', archive, '-d', extracted], {stdio:'inherit'});
  if (unpack.status !== 0 || !existsSync(model)) throw new Error('Could not extract CC0 animation source');
}
mkdirSync(resolve(root,'docs/licenses'), {recursive:true});
copyFileSync(resolve(extracted,'Animation Library[Standard]/License.txt'),resolve(root,'docs/licenses/quaternius-animation-CC0.txt'));
console.log('CC0 animation source is ready (SHA-256 verified).');
