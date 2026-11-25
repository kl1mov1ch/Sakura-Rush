// Artifacts found in chests. They last for one run and stack: a second copy doubles the effect.
// `apply(stats, game)` changes the run stats (see freshStats in abilities.js) once per copy.
export const RARITY = Object.freeze({
  common: { name: 'Обычный', color: '#9fb1c8', weight: 60 },
  rare: { name: 'Редкий', color: '#5590c2', weight: 30 },
  legendary: { name: 'Легендарный', color: '#e3b65c', weight: 10 },
});

const heal = (game, amount) => { const p = game.player; p.maxHp += amount; p.hp = Math.min(p.maxHp, p.hp + amount); };

export const RELICS = Object.freeze([
  { id: 'magatama', name: 'Магатама', glyph: '勾', rarity: 'common', desc: '+10% урона', apply: s => { s.dmg += 0.1; } },
  { id: 'omamori', name: 'Омамори здоровья', glyph: '守', rarity: 'common', desc: '+20 к здоровью и лечение', apply: (s, g) => heal(g, 20) },
  { id: 'geta', name: 'Гэта тэнгу', glyph: '駄', rarity: 'common', desc: '+8% скорости бега', apply: s => { s.speed += 0.08; } },
  { id: 'bell', name: 'Храмовый колокольчик', glyph: '鈴', rarity: 'common', desc: '+15% опыта', apply: s => { s.xp += 0.15; } },
  { id: 'koban', name: 'Монета кобан', glyph: '判', rarity: 'common', desc: 'Монеты падают на 25% чаще', apply: s => { s.coinDrop += 0.25; } },
  { id: 'fan', name: 'Веер тэнгу', glyph: '扇', rarity: 'common', desc: '+30% радиуса сбора', apply: s => { s.magnet *= 1.3; } },
  { id: 'tsuba', name: 'Цуба мастера', glyph: '鍔', rarity: 'common', desc: '−8% перезарядки техник', apply: s => { s.cd *= 0.92; } },
  { id: 'flyingsword', name: 'Летающий меч', glyph: '剣', rarity: 'rare', desc: 'Меч кружит рядом с героем и рубит ёкаев', apply: s => { s.flySwords += 1; } },
  { id: 'hannya', name: 'Маска ханья', glyph: '般', rarity: 'rare', desc: '+8% шанса крита и +30% силы крита', apply: s => { s.crit += 0.08; s.critMul += 0.3; } },
  { id: 'daruma', name: 'Кукла дарума', glyph: '達', rarity: 'rare', desc: 'Ещё одна жизнь в этом забеге', apply: s => { s.revive += 1; } },
  { id: 'mirror', name: 'Зеркало Ята', glyph: '鏡', rarity: 'rare', desc: '−12% получаемого урона', apply: s => { s.armor = Math.min(0.75, s.armor + 0.12); } },
  { id: 'lantern', name: 'Фонарь душ', glyph: '灯', rarity: 'rare', desc: '+0,8 здоровья в секунду', apply: s => { s.regen += 0.8; } },
  { id: 'scroll', name: 'Свиток ветра', glyph: '巻', rarity: 'rare', desc: 'Рывок перезаряжается на 25% быстрее', apply: s => { s.dash *= 0.75; } },
  { id: 'kusanagi', name: 'Меч Кусанаги', glyph: '草', rarity: 'legendary', desc: 'Три летающих меча и +15% урона', apply: s => { s.flySwords += 3; s.dmg += 0.15; } },
  { id: 'pearl', name: 'Жемчужина дракона', glyph: '珠', rarity: 'legendary', desc: '+25% урона и +10% скорости', apply: s => { s.dmg += 0.25; s.speed += 0.1; } },
  { id: 'tanuki', name: 'Золотой тануки', glyph: '狸', rarity: 'legendary', desc: '+40% опыта и монеты падают на 40% чаще', apply: s => { s.xp += 0.4; s.coinDrop += 0.4; } },
  { id: 'phoenix', name: 'Перо феникса', glyph: '鳳', rarity: 'legendary', desc: 'Ещё одна жизнь и +1 здоровья в секунду', apply: s => { s.revive += 1; s.regen += 1; } },
].map(Object.freeze));
const BY_ID = new Map(RELICS.map(r => [r.id, r]));
export const getRelic = id => BY_ID.get(id);

/** Pick `count` different relics. `luck` (0..1) moves weight from common towards rare and legendary;
 *  `min` is the lowest rarity allowed ('rare' for the boost and boss chests). */
export function rollRelics(count = 3, { luck = 0, min = 'common', random = Math.random } = {}) {
  const order = ['common', 'rare', 'legendary'];
  const weight = r => {
    if (order.indexOf(r.rarity) < order.indexOf(min)) return 0;
    const base = RARITY[r.rarity].weight;
    return r.rarity === 'common' ? base * Math.max(0.2, 1 - luck) : base * (1 + luck * (r.rarity === 'legendary' ? 2 : 1));
  };
  const pool = RELICS.filter(r => weight(r) > 0), out = [];
  while (out.length < count && pool.length) {
    let roll = random() * pool.reduce((sum, r) => sum + weight(r), 0), i = 0;
    while (i < pool.length - 1 && (roll -= weight(pool[i])) > 0) i++;
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}
