import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const candidates = [process.env.BLENDER_PATH, 'blender'];
if (process.platform === 'win32') {
  const registry = spawnSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Steam App 365670', '/v', 'InstallLocation'], { encoding: 'utf8', windowsHide: true });
  const steamInstall = registry.stdout?.match(/InstallLocation\s+REG_SZ\s+(.+)/)?.[1]?.trim();
  if (steamInstall) candidates.push(path.join(steamInstall, 'blender.exe'));
  for (const drive of ['C:', 'D:', 'E:']) {
    candidates.push(path.join(drive + path.sep, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'));
  }
  for (const programFiles of [process.env.ProgramFiles, process.env['ProgramFiles(x86)']]) {
    if (!programFiles) continue;
    candidates.push(path.join(programFiles, 'Steam', 'steamapps', 'common', 'Blender', 'blender.exe'));
    const foundation = path.join(programFiles, 'Blender Foundation');
    if (fs.existsSync(foundation)) {
      for (const entry of fs.readdirSync(foundation).sort().reverse()) candidates.push(path.join(foundation, entry, 'blender.exe'));
    }
  }
}
const executable = candidates.filter(Boolean).find(candidate => {
  if (candidate !== 'blender' && !fs.existsSync(candidate)) return false;
  return spawnSync(candidate, ['--background', '--version'], { stdio: 'ignore', windowsHide: true }).status === 0;
});
if (!executable) {
  console.error('Blender не найден. Установите Blender или задайте BLENDER_PATH с полным путём к blender.exe.');
  process.exit(1);
}
console.log(`Blender: ${executable}`);
// Resolve the pinned, licensed source before overwriting any existing game model.
const source = spawnSync(process.execPath, [path.join(root, 'scripts', 'fetch-motion.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true });
if (source.status !== 0) process.exit(source.status || 1);
const build = spawnSync(executable, ['--background', '--python', path.join(root, 'blender', 'build_models.py')], { cwd: root, stdio: 'inherit', windowsHide: true });
if (build.status !== 0) process.exit(build.status || 1);
const motion = spawnSync(executable, ['--background', '--python', path.join(root, 'blender', 'build_motion.py')], { cwd: root, stdio: 'inherit', windowsHide: true });
if (motion.status !== 0) process.exit(motion.status || 1);
const pack = spawnSync(process.execPath, [path.join(root, 'scripts', 'pack-motion.mjs')], { cwd: root, stdio: 'inherit', windowsHide: true });
if (pack.status !== 0) process.exit(pack.status || 1);
if (process.argv.includes('--preview')) {
  const preview = spawnSync(executable, ['--background', '--python', path.join(root, 'blender', 'preview_models.py'), '--', path.join(root, 'docs', 'models-after.png')], { cwd: root, stdio: 'inherit', windowsHide: true });
  if (preview.status !== 0) process.exit(preview.status || 1);
}
