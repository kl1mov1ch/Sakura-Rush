// Vite embeds the compact artwork into both the hosted and offline editions.
const images = import.meta.glob('./art/*.{webp,svg}', { query: '?url', import: 'default', eager: true });
// Bright emoji badges for techniques: readable for kids and consistent with the sunny menu.
const EMOJI = {
  katana: '🗡️', shuriken: '✴️', foxfire: '🦊', lightning: '⚡', aura: '🌸', frost: '❄️', kunai: '🔪', meteor: '☄️', vortex: '🌀',
  arrow: '🏹', arrowrain: '🌧️', ricochet: '🎯', arcane: '✨', runeburst: '💥', explosivearrow: '🔥', windvolley: '🍃', spiritbeam: '🐉', spiritguard: '👻',
  flyswords: '⚔️', quake: '💢', thorns: '🌵', luck: '🍀', swift: '👟', vitality: '❤️', magnet: '🧲', haste: '⏱️', might: '💪', armor: '🛡️', wisdom: '🦉', greed: '🐱', __heal: '🍵',
};
// Animated card previews rendered in Blender (blender/render_ability_previews.py): 12 frames side by side.
const previews = import.meta.glob('./art/preview/*.webp', { query: '?url', import: 'default', eager: true });
export function abilityPreview(id) {
  const url = previews[`./art/preview/${id}.webp`];
  return url ? `<span class="preview" aria-hidden="true"><img src="${url}" alt="" draggable="false" decoding="async"></span>` : '';
}
export function abilityArt(id, fallback = '血') {
  if (EMOJI[id]) return `<span class="emoji">${EMOJI[id]}</span>`;
  const url = images[`./art/${id}.webp`] || images[`./art/${id}.svg`];
  return url ? `<img src="${url}" alt="" draggable="false" decoding="async">` : `<span>${fallback}</span>`;
}
