// Builds the game and inlines CSS + JS into one file: play/SakuraRush.html.
// That file opens by double-click (file://), no server needed.
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

execSync('npx vite build', { stdio: 'inherit' });
let html = readFileSync('dist/index.html', 'utf8');
// Never copy the development file:// redirect into the standalone file.
html = html.replace(/<!-- dev-redirect:[\s\S]*?<!-- \/dev-redirect -->\s*/g, '');
html = html.replace(/<script>if \(location\.protocol === 'file:'\) location\.replace\('\.\/play\/SakuraRush\.html'\);<\/script>/g, '');
html = html.replace(/<link rel="stylesheet"[^>]*href="\.\/(assets\/[^"]+\.css)"[^>]*>/, (_, f) => `<style>${readFileSync('dist/' + f, 'utf8')}</style>`);
html = html.replace(/<script type="module"[^>]*src="\.\/(assets\/[^"]+\.js)"[^>]*><\/script>/, (_, f) =>
  `<script type="module">${readFileSync('dist/' + f, 'utf8').replace(/<\/script/g, '<\\/script')}</script>`);
// the inline script must run after the page markup exists
html = html.replace(/(<script type="module">[\s\S]*<\/script>)([\s\S]*)<\/body>/, '$2$1</body>');
mkdirSync('play', { recursive: true });
writeFileSync('play/SakuraRush.html', html);
// dist/index.html gets the same single-file build, so it also works when opened from disk
writeFileSync('dist/index.html', html);
console.log('play/SakuraRush.html ready');
