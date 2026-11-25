// Browser-local campaign save. Run pickups are banked at collection time, so a
// lost fight or closing the tab never charges the player for already earned coins.
// Version 2 adds hero classes, the radial talent tree, the endless mode with its
// records, rewarded-ad bonuses and store purchases. Version 3 adds ten chapters, weapon
// levels and looks, and one-run boosts. Version 1 saves are migrated: coins, chapters and
// skins carry over and old talents are refunded in full; version 2 chapter ids are renumbered.
export const RUN_SECONDS = 600;
export const CAMPAIGN_KEY = 'sakura-rush-campaign-v2';
export const LEGACY_KEY = 'sakura-rush-campaign-v1';
const MAX_COINS = 1_000_000_000;
export const ENDLESS_ID = 99;
// Version 2 numbered the five chapters 1..5 and endless 6; version 3 has ten.
const V2_CHAPTERS = { 1: 1, 2: 2, 3: 4, 4: 6, 5: 10, 6: 99 };

export const CLASSES = Object.freeze(['staff', 'bow', 'sword']);

// `foes`: special yokai of the chapter, as [first appearance in seconds, spawn weight].
export const CHAPTERS = Object.freeze([
  { id: 1, numeral: '1', name: 'Сакуровая долина', subtitle: 'Первые шаги среди цветущих деревьев', biome: 'sakura', color: '#d9718f', colors: { accent: '#e7a3b8', ground: '#7aa35e', fog: '#d7e0e0', sky: '#b7cdd6' }, foes: { kappa: [240, 0.8] }, hpMul: 1, speedMul: 1, spawnMul: 1, coinMul: 1, reward: 60 },
  { id: 2, numeral: '2', name: 'Бамбуковая роща', subtitle: 'Каппы прыгают из зарослей', biome: 'bamboo', color: '#5aa86e', colors: { accent: '#9cc7b8', ground: '#6a9a55', fog: '#d3e2d4', sky: '#a9c8bd' }, foes: { kappa: [70, 1.6] }, hpMul: 1.3, speedMul: 1.04, spawnMul: 1.08, coinMul: 1.15, reward: 75 },
  { id: 3, numeral: '3', name: 'Жабье болото', subtitle: 'Здесь прыгают все. Не стой на месте!', biome: 'marsh', color: '#5f9a8a', colors: { accent: '#9cc7b8', ground: '#5f8a5a', fog: '#c9d8cf', sky: '#9fb8b0' }, foes: { kappa: [20, 3], shaman: [320, 0.5] }, hpMul: 1.6, speedMul: 1.07, spawnMul: 1.15, coinMul: 1.3, reward: 90 },
  { id: 4, numeral: '4', name: 'Храм на закате', subtitle: 'Ниндзя метают кунаи с крыш', biome: 'ember', color: '#d98c4f', colors: { accent: '#e0a86e', ground: '#9a9a5a', fog: '#e6d2bd', sky: '#d3ae92' }, foes: { tengu: [45, 2], kappa: [90, 1] }, hpMul: 1.9, speedMul: 1.09, spawnMul: 1.2, coinMul: 1.45, reward: 105 },
  { id: 5, numeral: '5', name: 'Кленовое ущелье', subtitle: 'Багровые клёны и засады ниндзя', biome: 'autumn', color: '#d0703c', colors: { accent: '#e8a26a', ground: '#8f8a4f', fog: '#ead7c0', sky: '#d8b89a' }, foes: { tengu: [20, 3], kappa: [100, 1.5] }, hpMul: 2.25, speedMul: 1.11, spawnMul: 1.26, coinMul: 1.6, reward: 125 },
  { id: 6, numeral: '6', name: 'Снежная гора', subtitle: 'Колдуны поднимают мёртвых из снега', biome: 'snow', color: '#5590c2', colors: { accent: '#a9c6dc', ground: '#dfe7ec', fog: '#e2e9ee', sky: '#b4c8d6' }, foes: { tengu: [60, 1.5], shaman: [90, 1.2] }, hpMul: 2.6, speedMul: 1.13, spawnMul: 1.32, coinMul: 1.75, reward: 145 },
  { id: 7, numeral: '7', name: 'Лисья деревня', subtitle: 'Фонари, маски и призыватели', biome: 'fox', color: '#c76a5a', colors: { accent: '#f0b27a', ground: '#6f8a5a', fog: '#d9c6c6', sky: '#b39aa8' }, foes: { shaman: [30, 2.2], kappa: [70, 1.5] }, hpMul: 3.0, speedMul: 1.15, spawnMul: 1.37, coinMul: 1.95, reward: 165 },
  { id: 8, numeral: '8', name: 'Пепельный вулкан', subtitle: 'Все ёкаи разом, жар и пепел', biome: 'ash', color: '#a0705a', colors: { accent: '#d98a5a', ground: '#77715f', fog: '#cfc4b8', sky: '#9a8f8a' }, foes: { kappa: [30, 2], tengu: [60, 2], shaman: [120, 1.2] }, hpMul: 3.45, speedMul: 1.17, spawnMul: 1.42, coinMul: 2.15, reward: 190 },
  { id: 9, numeral: '9', name: 'Пик ниндзя', subtitle: 'Небо в кунаях: уворачивайся рывком', biome: 'peak', color: '#6a88b8', colors: { accent: '#b8cde0', ground: '#a9b8a0', fog: '#e0e6ec', sky: '#a8bdd6' }, foes: { tengu: [15, 4], shaman: [60, 1.5] }, hpMul: 3.9, speedMul: 1.19, spawnMul: 1.47, coinMul: 2.35, reward: 215 },
  { id: 10, numeral: '10', name: 'Лунный замок', subtitle: 'Финальная битва с Они-сёгуном', biome: 'bloodmoon', color: '#7f73b8', colors: { accent: '#b8a3d6', ground: '#6c8a62', fog: '#c4bbd6', sky: '#8f88b8' }, foes: { kappa: [30, 2], tengu: [30, 2], shaman: [60, 1.5] }, hpMul: 4.4, speedMul: 1.21, spawnMul: 1.52, coinMul: 2.6, reward: 240 },
  // Endless survival for the leaderboard: no dawn, every minute is harder than the last.
  { id: ENDLESS_ID, numeral: '∞', name: 'Бесконечная ночь', subtitle: 'Продержись как можно дольше и попади в рейтинг', biome: 'endless', endless: true, color: '#e3b65c', colors: { accent: '#e3c46a', ground: '#738f60', fog: '#c9c3dc', sky: '#8b93c0' }, foes: { kappa: [60, 1.5], tengu: [120, 1.5], shaman: [180, 1] }, hpMul: 1.15, speedMul: 1.04, spawnMul: 1.1, coinMul: 1.25, reward: 0 },
].map(chapter => Object.freeze({ duration: chapter.endless ? Infinity : RUN_SECONDS, ...chapter, colors: Object.freeze(chapter.colors), foes: Object.freeze(chapter.foes) })));
export const STORY_CHAPTERS = CHAPTERS.filter(chapter => !chapter.endless);

// ---------------------------------------------------------------- talent tree
// An advancement map in the spirit of Minecraft mods: the heart on the left, seven branches
// growing to the right, each with a side path and a capstone perk (`frame: 'challenge'`).
// Class branches only work for their class; the shared branches help everyone.
// `row` is the branch's lane on the map; nodes carry their own grid position (x, y).
export const TALENT_BRANCHES = Object.freeze([
  { id: 'mage', name: 'Волшебница', subtitle: 'Только для волшебницы', color: '#8f7bff', cls: 'staff', row: 0 },
  { id: 'archer', name: 'Арбалетчица', subtitle: 'Только для арбалетчицы', color: '#3fbf6f', cls: 'bow', row: 2 },
  { id: 'ninja', name: 'Ниндзя', subtitle: 'Только для ниндзя', color: '#ff7a3d', cls: 'sword', row: 4 },
  { id: 'body', name: 'Здоровье', subtitle: 'Для всех героев', color: '#ff5d73', row: 6 },
  { id: 'agility', name: 'Ловкость', subtitle: 'Скорость и рывок', color: '#2fb7ff', row: 8 },
  { id: 'fortune', name: 'Удача', subtitle: 'Монеты и опыт', color: '#ffb800', row: 10 },
  { id: 'relic', name: 'Реликвии', subtitle: 'Сундуки и артефакты', color: '#c48bff', row: 12 },
].map(Object.freeze));
const TIER_COST = [1, 1.7, 2.6, 4, 5.4, 7];
const MAX_RANK = 5;
const costs = (base, tier, ranks = MAX_RANK) => Object.freeze(Array.from({ length: ranks }, (_, rank) => Math.round(base * TIER_COST[tier] * Math.pow(1.45, rank))));
const BRANCH_ROWS = Object.fromEntries(TALENT_BRANCHES.map(branch => [branch.id, branch.row]));
// tier: column on the main path (0..5); side nodes sit one row lower. `requires` defaults to the previous main node.
const node = (id, branch, tier, name, glyph, description, stat, value, { extra = null, side = false, requires = null, ranks = MAX_RANK, perk = false, price = 0 } = {}) => Object.freeze({
  id, branch, tier, name, glyph, description, stat, value, extra: extra && Object.freeze(extra), maxRank: perk ? 1 : ranks,
  frame: perk ? 'challenge' : side ? 'goal' : 'task',
  x: 1.25 + tier * 1.05, y: BRANCH_ROWS[branch] + (side ? 1 : 0),
  costs: perk ? Object.freeze([price]) : costs(20, tier, ranks),
  requires: Object.freeze(requires || (tier === 0 ? ['heart'] : [`${branch}${tier}`])),
});
const classNodes = (branch, names, glyphs, perkName, perkGlyph) => [
  node(`${branch}1`, branch, 0, names[0], glyphs[0], '+5% урона за звезду', 'damage', .05),
  node(`${branch}2`, branch, 1, names[1], glyphs[1], '−3% перезарядки за звезду', 'cooldown', -.03),
  node(`${branch}3`, branch, 2, names[2], glyphs[2], '+2% шанса крита за звезду', 'crit', .02),
  node(`${branch}4`, branch, 3, names[3], glyphs[3], '+10% силы крита и +2% урона за звезду', 'critMul', .1, { extra: ['damage', .02] }),
  node(`${branch}a`, branch, 2, names[4], glyphs[4], '+6% урона по боссам и элитным ёкаям за звезду', 'bossDamage', .06, { side: true, requires: [`${branch}2`] }),
  node(`${branch}b`, branch, 3, names[5], glyphs[5], '+3% скорости и +1% крита за звезду', 'speed', .03, { side: true, requires: [`${branch}a`], extra: ['crit', .01] }),
  node(`${branch}5`, branch, 4, names[6], glyphs[6], '+4% урона и +4 здоровья за звезду', 'damage', .04, { requires: [`${branch}4`], extra: ['maxHp', 4] }),
  node(`${branch}6`, branch, 5, perkName, perkGlyph, 'Испытание: стартовая техника класса сразу 2-го уровня', 'startLevel', 1, { requires: [`${branch}5`, `${branch}b`], perk: true, price: 2400 }),
];
export const TALENTS = Object.freeze([
  Object.freeze({ id: 'heart', branch: 'heart', tier: -1, name: 'Сердце героя', glyph: '❤', description: '+4 здоровья и +1% урона за звезду', stat: 'maxHp', value: 4, extra: Object.freeze(['damage', .01]), maxRank: MAX_RANK, frame: 'goal', x: 0, y: 6.5, costs: Object.freeze([15, 25, 40, 60, 90]), requires: Object.freeze([]) }),
  ...classNodes('mage', ['Сила печатей', 'Быстрые свитки', 'Звёздный глаз', 'Гнев дракона', 'Изгнание демонов', 'Шёлковые рукава', 'Тысяча печатей'], ['印', '巻', '星', '龍', '祓', '袖', '千'], 'Мастер-онмёдзи', '陰'),
  ...classNodes('archer', ['Меткий болт', 'Лёгкий взвод', 'Глаз сокола', 'Болт феникса', 'Охота на сёгуна', 'Ветер в оперении', 'Сто болтов'], ['矢', '弦', '鷹', '鳳', '狩', '羽', '百'], 'Глаз ястреба', '眼'),
  ...classNodes('ninja', ['Острый клинок', 'Тихий шаг', 'Удар тени', 'Танец сюрикенов', 'Убийца ёкаев', 'Шаг призрака', 'Тысяча порезов'], ['刀', '影', '忍', '嵐', '殺', '霊', '斬'], 'Путь сёгуна', '将'),
  node('body1', 'body', 0, 'Крепкое тело', '命', '+8 здоровья за звезду', 'maxHp', 8),
  node('body2', 'body', 1, 'Горячий чай', '茶', '+0,15 здоровья в секунду за звезду', 'regen', .15),
  node('body3', 'body', 2, 'Доспех из бамбука', '守', '−3% получаемого урона за звезду', 'armor', .03),
  node('body4', 'body', 3, 'Сердце горы', '山', '+12 здоровья и −2% урона по тебе за звезду', 'maxHp', 12, { extra: ['armor', .02] }),
  node('bodya', 'body', 2, 'Омамори', '札', '+0,2 здоровья в секунду и +4 здоровья за звезду', 'regen', .2, { side: true, requires: ['body2'], extra: ['maxHp', 4] }),
  node('bodyb', 'body', 3, 'Закалка', '鉄', '−2% урона по тебе и +2% урона за звезду', 'armor', .02, { side: true, requires: ['bodya'], extra: ['damage', .02] }),
  node('body5', 'body', 4, 'Дыхание дракона', '息', '+15 здоровья за звезду', 'maxHp', 15, { requires: ['body4'] }),
  node('body6', 'body', 5, 'Бессмертный дух', '不', 'Испытание: один раз за забег встаёшь после поражения бесплатно', 'revive', 1, { requires: ['body5', 'bodyb'], perk: true, price: 3000 }),
  node('agility1', 'agility', 0, 'Быстрые ноги', '足', '+3% скорости за звезду', 'speed', .03),
  node('agility2', 'agility', 1, 'Ветер в спину', '風', '−5% перезарядки рывка за звезду', 'dash', -.05),
  node('agility3', 'agility', 2, 'Ясная голова', '心', '−2% перезарядки всех техник за звезду', 'cooldown', -.02),
  node('agility4', 'agility', 3, 'Крылья тэнгу', '翼', '+2% скорости и +2% урона за звезду', 'speed', .02, { extra: ['damage', .02] }),
  node('agilitya', 'agility', 2, 'Лёгкие гэта', '駄', '+3% скорости и −3% перезарядки рывка за звезду', 'speed', .03, { side: true, requires: ['agility2'], extra: ['dash', -.03] }),
  node('agilityb', 'agility', 3, 'Танец ветра', '舞', '−2% перезарядки и +1% крита за звезду', 'cooldown', -.02, { side: true, requires: ['agilitya'], extra: ['crit', .01] }),
  node('agility5', 'agility', 4, 'Тень в листве', '葉', '+3% скорости и −2% урона по тебе за звезду', 'speed', .03, { requires: ['agility4'], extra: ['armor', .02] }),
  node('agility6', 'agility', 5, 'Неуловимый', '雲', 'Испытание: после рывка ещё полсекунды неуязвимости', 'dashGuard', .5, { requires: ['agility5', 'agilityb'], perk: true, price: 2600 }),
  node('fortune1', 'fortune', 0, 'Счастливая монета', '金', '+5% монет за звезду', 'coinGain', .05),
  node('fortune2', 'fortune', 1, 'Мудрая сова', '知', '+4% опыта за звезду', 'xp', .04),
  node('fortune3', 'fortune', 2, 'Магнит кицунэ', '狐', '+8% радиуса сбора за звезду', 'magnet', .08),
  node('fortune4', 'fortune', 3, 'Манэки-нэко', '猫', '+6% монет и +3% опыта за звезду', 'coinGain', .06, { extra: ['xp', .03] }),
  node('fortunea', 'fortune', 2, 'Игральная кость', '賽', '+1 бесплатная замена карточек за звезду', 'rerolls', 1, { side: true, requires: ['fortune2'], ranks: 3 }),
  node('fortuneb', 'fortune', 3, 'Свиток учёного', '学', '+5% опыта за звезду', 'xp', .05, { side: true, requires: ['fortunea'] }),
  node('fortune5', 'fortune', 4, 'Золотой дождь', '雨', '+7% монет за звезду', 'coinGain', .07, { requires: ['fortune4'] }),
  node('fortune6', 'fortune', 5, 'Сокровищница', '宝', 'Испытание: каждый забег начинается с случайным артефактом', 'relicStart', 1, { requires: ['fortune5', 'fortuneb'], perk: true, price: 3200 }),
  node('relic1', 'relic', 0, 'Знаток древностей', '古', '+6% шанса на редкий артефакт за звезду', 'relicLuck', .06),
  node('relic2', 'relic', 1, 'Сундук стража', '箱', '+15% монет из сундуков за звезду', 'chestCoins', .15),
  node('relic3', 'relic', 2, 'Нюх тануки', '狸', 'Сундуки появляются на 5% чаще за звезду', 'chestRate', .05),
  node('relic4', 'relic', 3, 'Священная верёвка', '縄', '+6% шанса на легендарный артефакт за звезду', 'relicLuck', .06, { extra: ['chestCoins', .1] }),
  node('relica', 'relic', 2, 'Кузнец Масамунэ', '鍛', '+3% урона оружия за звезду', 'damage', .03, { side: true, requires: ['relic2'] }),
  node('relicb', 'relic', 3, 'Хранитель клада', '蔵', '+8% монет из сундуков и +3% монет за звезду', 'chestCoins', .08, { side: true, requires: ['relica'], extra: ['coinGain', .03] }),
  node('relic5', 'relic', 4, 'Зеркало Ята', '鏡', '+5% шанса на редкий артефакт и +2% урона за звезду', 'relicLuck', .05, { requires: ['relic4'], extra: ['damage', .02] }),
  node('relic6', 'relic', 5, 'Третий путь', '道', 'Испытание: в сундуке на выбор 4 артефакта вместо 3', 'relicChoices', 1, { requires: ['relic5', 'relicb'], perk: true, price: 3400 }),
]);
const BRANCH_MAP = new Map(TALENT_BRANCHES.map(branch => [branch.id, branch]));
/** Grid position on the advancement map (columns to the right, rows downwards). */
export function talentPosition(item) { return { x: item.x, y: item.y }; }
export const TALENT_GRID = Object.freeze({ cols: Math.max(...TALENTS.map(t => t.x)) + 1, rows: Math.max(...TALENTS.map(t => t.y)) + 1 });

// ----------------------------------------------------------------- cosmetics
// Whole-character looks: VRoid anime heroines (blender/build_anime_heroes.py). Any class can wear
// any of them: the body changes, the class weapon and abilities stay. They never change strength.
// Ids stay from the old chibi skins so purchases carry over.
export const SKINS = Object.freeze([
  { id: 'classic', name: 'Героиня класса', description: 'Виктория-волшебница, Виви-арбалетчица или Вита-ниндзя', cost: 0, model: null, swatches: ['#f4d6e4', '#b9d98a', '#2f4f9a'] },
  { id: 'samurai', name: 'Школьница Сино', description: 'Длинные чёрные волосы и школьная форма', cost: 900, model: 'skin_samurai', swatches: ['#1c1d2e', '#f2f2f2', '#2d6fb8'] },
  { id: 'kitsune', name: 'Неко', description: 'Кошачьи ушки, хвостики и белое платье', cost: 1300, model: 'skin_kitsune', swatches: ['#f4f4f8', '#2a2226', '#9cc4ff'] },
  { id: 'oni', name: 'Алая Вита', description: 'Боевой наряд Виты в багровых тонах', cost: 1700, model: 'skin_oni', swatches: ['#c2312e', '#f2f2f6', '#3a2a4a'] },
  { id: 'ronin', name: 'Изумрудная Сино', description: 'Сино в зелёной форме и с каштановыми волосами', cost: 2200, model: 'skin_ronin', swatches: ['#2f7a4a', '#f2f2f2', '#6a4a3a'] },
  { id: 'dragon', name: 'Мятная Виктория', description: 'Волшебное платье и волосы цвета мяты', cost: 2800, model: 'skin_dragon', swatches: ['#9fe0c8', '#f2f2f2', '#4fae8e'] },
  { id: 'gold', name: 'Золотая Неко', description: 'Золотое платье. Есть в «Золотом пропуске»', cost: 3500, model: 'skin_gold', swatches: ['#f2c14e', '#2a2226', '#fff1c9'], pass: true },
].map(skin => Object.freeze({ ...skin, swatches: Object.freeze(skin.swatches) })));

// ------------------------------------------------------------------- weapons
// Each class weapon is upgraded for coins (10 levels) and has three looks built in Blender
// (blender/build_cc0_weapons.py). A look changes the model, adds a trail colour and one property.
// The archer's looks are crossbows; their ids still say 'bow' so saves keep working.
export const WEAPON_MAX_LEVEL = 10;
export const WEAPON_SKINS = Object.freeze([
  { id: 'staff', cls: 'staff', name: 'Посох мудреца', model: 'staff', cost: 0, fx: null, perk: null, perkText: 'Надёжный посох онмёдзи. Прокачивай его за монеты.' },
  { id: 'staff_moon', cls: 'staff', name: 'Лунный посох', model: 'w_staff_moon', cost: 2400, fx: '#8fd0ff', perk: 'frost', perkText: 'Каждый 5-й удар замораживает ёкая на секунду' },
  { id: 'staff_phoenix', cls: 'staff', name: 'Посох феникса', model: 'w_staff_phoenix', product: 'weapon_phoenix', premium: true, fx: '#ff7a1a', perk: 'burn', perkText: 'Побеждённые ёкаи вспыхивают и обжигают соседей. +10% урона' },
  { id: 'bow', cls: 'bow', name: 'Арбалет охотницы', model: 'bow', cost: 0, fx: null, perk: null, perkText: 'Тяжёлый арбалет с болтами. Прокачивай его за монеты.' },
  { id: 'bow_sakura', cls: 'bow', name: 'Арбалет сакуры', model: 'w_bow_sakura', cost: 2400, fx: '#f59ab8', perk: 'bloom', perkText: '+8% шанса крита, криты осыпают лепестками' },
  { id: 'bow_storm', cls: 'bow', name: 'Арбалет бури', model: 'w_bow_storm', product: 'weapon_storm', premium: true, fx: '#5fd0ff', perk: 'storm', perkText: 'Каждый 6-й удар бьёт молнией по трём ёкаям. +10% урона' },
  { id: 'katana', cls: 'sword', name: 'Катана', model: 'katana', cost: 0, fx: null, perk: null, perkText: 'Острая катана ниндзя. Прокачивай её за монеты.' },
  { id: 'katana_jade', cls: 'sword', name: 'Нефритовый клинок', model: 'w_katana_jade', cost: 2400, fx: '#7fe0b0', perk: 'jade', perkText: 'Каждые 6 побед лечат 2 здоровья' },
  { id: 'katana_muramasa', cls: 'sword', name: 'Мурамаса', model: 'w_katana_muramasa', product: 'weapon_muramasa', premium: true, fx: '#ff3030', perk: 'bloodlust', perkText: 'Каждая победа +0,1% урона до +40% за забег. +10% урона' },
].map(Object.freeze));
const WEAPON_MAP = new Map(WEAPON_SKINS.map(item => [item.id, item]));
const BASE_WEAPON = Object.freeze({ staff: 'staff', bow: 'bow', sword: 'katana' });
export const weaponUpgradeCost = level => level >= WEAPON_MAX_LEVEL ? 0 : Math.round(120 * Math.pow(1.5, level));
/** What one weapon level gives, shown in the forge. */
export function weaponLevelBonus(level) { return { damage: .05 * level, crit: level >= 5 ? .05 : 0, cooldown: level >= 10 ? -.1 : 0 }; }

// --------------------------------------------------------------------- boosts
// One-run boosts armed in the menu: watch a short video, spend coins or a boost token.
export const BOOSTS = Object.freeze([
  { id: 'relic', name: 'Древний артефакт', glyph: '🏺', description: 'Забег начнётся с редким артефактом', cost: 200 },
  { id: 'xp', name: 'Свиток мудрости', glyph: '📜', description: '+40% опыта в этом забеге', cost: 120 },
  { id: 'hp', name: 'Чай силы', glyph: '🍵', description: '+40 здоровья в этом забеге', cost: 120 },
  { id: 'coins', name: 'Кошелёк манэки-нэко', glyph: '🐱', description: 'Монеты падают вдвое чаще', cost: 160 },
].map(Object.freeze));
const BOOST_MAP = new Map(BOOSTS.map(item => [item.id, item]));
export const BOOST_ADS_PER_DAY = 8;

// ----------------------------------------------------------------- store items
// Yandex Games in-app purchases. Ids must match the products created in the console.
export const PRODUCTS = Object.freeze([
  { id: 'coins_small', name: 'Мешочек монет', coins: 600, glyph: '🪙' },
  { id: 'coins_medium', name: 'Сундучок монет', coins: 1800, glyph: '💰', badge: '+20%' },
  { id: 'coins_large', name: 'Сокровищница', coins: 4500, glyph: '👑', badge: '+50%' },
  { id: 'golden_pass', name: 'Золотой пропуск', coins: 0, glyph: '⭐', badge: 'навсегда', permanent: true, description: '+25% монет навсегда и облик «Золотой самурай»' },
  { id: 'boost_pack', name: 'Набор бустов', coins: 0, tokens: 10, glyph: '🎒', badge: '×10', description: '10 жетонов: каждый включает любой буст на забег' },
  { id: 'weapon_phoenix', name: 'Посох феникса', coins: 0, glyph: '🔥', permanent: true, weapon: 'staff_phoenix', description: 'Легендарный посох мага с огненным следом' },
  { id: 'weapon_storm', name: 'Арбалет бури', coins: 0, glyph: '⚡', permanent: true, weapon: 'bow_storm', description: 'Легендарный арбалет с молниями' },
  { id: 'weapon_muramasa', name: 'Мурамаса', coins: 0, glyph: '🩸', permanent: true, weapon: 'katana_muramasa', description: 'Легендарный клинок ниндзя с алым следом' },
].map(Object.freeze));
const PRODUCT_MAP = new Map(PRODUCTS.map(item => [item.id, item]));
export const AD_COINS = 25;
export const AD_COINS_PER_DAY = 5;
export const REVIVE_COIN_COST = [60, 150];

const CHAPTER_MAP = new Map(CHAPTERS.map(item => [item.id, item]));
const TALENT_MAP = new Map(TALENTS.map(item => [item.id, item]));
const SKIN_MAP = new Map(SKINS.map(item => [item.id, item]));
const LOADOUTS = new Set(CLASSES);
const clampInteger = (value, low, high, fallback = low) => Number.isFinite(value) ? Math.min(high, Math.max(low, Math.floor(value))) : fallback;
const number = value => typeof value === 'number' && Number.isFinite(value);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => plain(object) && Object.hasOwn(object, key);
const reject = reason => ({ ok: false, reason });
const today = () => new Date().toISOString().slice(0, 10);

// Version 1 talent prices, used to refund an old save when the tree changes.
const LEGACY_TALENT_COSTS = { vigor: [30, 55, 90], stride: [45, 75, 115], recovery: [65, 100, 145], armor: [90, 135, 185], discipline: [30, 55, 90], focus: [45, 75, 115], precision: [65, 100, 145], mastery: [90, 135, 185], reach: [30, 55, 90], fortune: [45, 75, 115], wisdom: [65, 100, 145], resolve: [90, 135, 185] };
const LEGACY_SKINS = { crimson: 'classic', indigo: 'samurai', jade: 'dragon', ivory: 'kitsune' };
// The first v2 build sold recolours; each one becomes a whole character of similar rank.
const RECOLOUR_SKINS = { sakura: 'kitsune', jade: 'dragon', sky: 'samurai', night: 'ronin' };
const skinId = id => RECOLOUR_SKINS[id] || id;

function freshState() {
  return { version: 3, weapons: { staff: { level: 0, skin: 'staff' }, bow: { level: 0, skin: 'bow' }, sword: { level: 0, skin: 'katana' } }, ownedWeapons: ['staff', 'bow', 'katana'], armedBoosts: [], boostTokens: 0, boostAds: { day: '', count: 0 }, coins: 0, totalCollected: 0, unlockedChapter: 1, selectedChapter: 1, selectedClass: 'staff', selectedSkin: 'classic', ownedSkins: ['classic'], talents: {}, chapters: {}, endless: { bestTime: 0, bestKills: 0, runs: 0 }, records: [], serial: 0, activeRun: null, lastRun: null, adCoins: { day: '', count: 0 }, purchases: [], pass: false, tutorial: true };
}

/** v1 -> v2: keep the wallet, chapters and skins; refund the old 12-node tree. */
function migrate(raw) {
  if (!plain(raw) || raw.version !== 1) return raw;
  let refund = 0;
  for (const [id, prices] of Object.entries(LEGACY_TALENT_COSTS)) {
    const rank = own(raw.talents, id) ? clampInteger(raw.talents[id], 0, 3) : 0;
    for (let i = 0; i < rank; i++) refund += prices[i];
  }
  const skins = Array.isArray(raw.ownedSkins) ? raw.ownedSkins.map(id => LEGACY_SKINS[id]).filter(Boolean) : [];
  const loadout = plain(raw.activeRun) ? raw.activeRun.loadout : null;
  return { ...raw, version: 2, coins: clampInteger(raw.coins, 0, MAX_COINS) + refund, talents: {}, ownedSkins: ['classic', ...skins], selectedSkin: LEGACY_SKINS[raw.selectedSkin] || 'classic', selectedClass: LOADOUTS.has(loadout) ? loadout : 'staff', activeRun: null, migratedRefund: refund };
}

/** v2 -> v3: ten chapters instead of five, endless moves from id 6 to 99; talent ids are unchanged. */
function migrate3(raw) {
  if (!plain(raw) || raw.version !== 2) return raw;
  const id = value => Number.isInteger(value) ? V2_CHAPTERS[value] ?? value : value;
  const chapters = {};
  if (plain(raw.chapters)) for (const [key, record] of Object.entries(raw.chapters)) if (V2_CHAPTERS[key]) chapters[V2_CHAPTERS[key]] = record;
  const run = plain(raw.activeRun) ? { ...raw.activeRun, chapterId: id(raw.activeRun.chapterId) } : raw.activeRun;
  const last = plain(raw.lastRun) ? { ...raw.lastRun, chapterId: id(raw.lastRun.chapterId), unlocked: raw.lastRun.unlocked ? id(raw.lastRun.unlocked) : 0 } : raw.lastRun;
  return { ...raw, version: 3, unlockedChapter: id(raw.unlockedChapter), selectedChapter: id(raw.selectedChapter), chapters, activeRun: run, lastRun: last };
}

function normalize(raw) {
  const result = freshState();
  raw = migrate3(migrate(raw));
  if (!plain(raw) || raw.version !== 3) return result;
  result.coins = clampInteger(raw.coins, 0, MAX_COINS);
  result.totalCollected = clampInteger(raw.totalCollected, 0, MAX_COINS);
  result.unlockedChapter = clampInteger(raw.unlockedChapter, 1, STORY_CHAPTERS.length);
  result.selectedChapter = raw.selectedChapter === ENDLESS_ID ? ENDLESS_ID : clampInteger(raw.selectedChapter, 1, result.unlockedChapter);
  result.serial = clampInteger(raw.serial, 0, MAX_COINS);
  if (LOADOUTS.has(raw.selectedClass)) result.selectedClass = raw.selectedClass;
  result.pass = raw.pass === true;
  result.tutorial = raw.tutorial !== false;
  if (Array.isArray(raw.ownedSkins)) result.ownedSkins = [...new Set(['classic', ...raw.ownedSkins.map(skinId).filter(id => SKIN_MAP.has(id))])];
  if (result.pass && !result.ownedSkins.includes('gold')) result.ownedSkins.push('gold');
  if (result.ownedSkins.includes(skinId(raw.selectedSkin))) result.selectedSkin = skinId(raw.selectedSkin);
  // Process the graph from the centre outwards: a corrupted save cannot equip a descendant
  // without its parent, and inherited object properties never become purchases.
  for (const item of TALENTS) if (own(raw.talents, item.id)) {
    const rank = clampInteger(raw.talents[item.id], 0, item.maxRank);
    if (rank && item.requires.every(id => result.talents[id] > 0)) result.talents[item.id] = rank;
  }
  for (const chapter of CHAPTERS) if (own(raw.chapters, chapter.id)) {
    const record = raw.chapters[chapter.id];
    if (!plain(record)) continue;
    result.chapters[chapter.id] = { wins: clampInteger(record.wins, 0, MAX_COINS), attempts: clampInteger(record.attempts, 0, MAX_COINS), bestTime: clampInteger(record.bestTime, 0, chapter.endless ? MAX_COINS : RUN_SECONDS), bestKills: clampInteger(record.bestKills, 0, MAX_COINS) };
  }
  if (plain(raw.endless)) result.endless = { bestTime: clampInteger(raw.endless.bestTime, 0, MAX_COINS), bestKills: clampInteger(raw.endless.bestKills, 0, MAX_COINS), runs: clampInteger(raw.endless.runs, 0, MAX_COINS) };
  if (Array.isArray(raw.records)) result.records = raw.records.filter(plain).slice(0, 10).map(r => ({ time: clampInteger(r.time, 0, MAX_COINS), kills: clampInteger(r.kills, 0, MAX_COINS), cls: LOADOUTS.has(r.cls) ? r.cls : 'staff', date: typeof r.date === 'string' ? r.date.slice(0, 10) : '' }));
  if (plain(raw.adCoins) && typeof raw.adCoins.day === 'string') result.adCoins = { day: raw.adCoins.day.slice(0, 10), count: clampInteger(raw.adCoins.count, 0, 99) };
  if (Array.isArray(raw.ownedWeapons)) result.ownedWeapons = [...new Set([...result.ownedWeapons, ...raw.ownedWeapons.filter(id => WEAPON_MAP.has(id))])];
  if (plain(raw.weapons)) for (const cls of CLASSES) if (own(raw.weapons, cls) && plain(raw.weapons[cls])) {
    const skin = raw.weapons[cls].skin;
    result.weapons[cls] = { level: clampInteger(raw.weapons[cls].level, 0, WEAPON_MAX_LEVEL), skin: WEAPON_MAP.get(skin)?.cls === cls && result.ownedWeapons.includes(skin) ? skin : BASE_WEAPON[cls] };
  }
  if (Array.isArray(raw.armedBoosts)) result.armedBoosts = [...new Set(raw.armedBoosts.filter(id => BOOST_MAP.has(id)))];
  result.boostTokens = clampInteger(raw.boostTokens, 0, 9999, 0);
  if (plain(raw.boostAds) && typeof raw.boostAds.day === 'string') result.boostAds = { day: raw.boostAds.day.slice(0, 10), count: clampInteger(raw.boostAds.count, 0, 99) };
  if (Array.isArray(raw.purchases)) result.purchases = raw.purchases.filter(token => typeof token === 'string').slice(-50).map(token => token.slice(0, 200));
  const run = raw.activeRun;
  if (plain(run) && typeof run.id === 'string' && run.id.length <= 100 && CHAPTER_MAP.has(run.chapterId) && (run.chapterId === ENDLESS_ID || run.chapterId <= result.unlockedChapter) && LOADOUTS.has(run.loadout)) {
    result.activeRun = { id: run.id, chapterId: run.chapterId, loadout: run.loadout, runCoins: clampInteger(run.runCoins, 0, MAX_COINS), rawCoins: clampInteger(run.rawCoins, 0, MAX_COINS), coinRemainder: number(run.coinRemainder) ? Math.min(.99999999, Math.max(0, run.coinRemainder)) : 0, startedAt: clampInteger(run.startedAt, 0, Number.MAX_SAFE_INTEGER), revives: clampInteger(run.revives, 0, 9), boosts: Array.isArray(run.boosts) ? run.boosts.filter(id => BOOST_MAP.has(id)) : [] };
  }
  if (plain(raw.lastRun) && typeof raw.lastRun.id === 'string' && CHAPTER_MAP.has(raw.lastRun.chapterId)) {
    result.lastRun = { id: raw.lastRun.id.slice(0, 100), chapterId: raw.lastRun.chapterId, victory: raw.lastRun.victory === true, time: clampInteger(raw.lastRun.time, 0, MAX_COINS), kills: clampInteger(raw.lastRun.kills, 0, MAX_COINS), runCoins: clampInteger(raw.lastRun.runCoins, 0, MAX_COINS), bonus: clampInteger(raw.lastRun.bonus, 0, 100000), unlocked: clampInteger(raw.lastRun.unlocked, 0, STORY_CHAPTERS.length), doubled: raw.lastRun.doubled === true };
  }
  return result;
}

export class Campaign {
  constructor(store) {
    try { this.store = store === undefined ? globalThis.localStorage : store; } catch { this.store = null; }
    let saved = null, legacy = null;
    try { saved = JSON.parse(this.store?.getItem(CAMPAIGN_KEY) || 'null'); } catch { saved = null; }
    if (!saved) try { legacy = JSON.parse(this.store?.getItem(LEGACY_KEY) || 'null'); } catch { legacy = null; }
    this._state = normalize(saved || legacy);
    this.migratedRefund = !saved && legacy ? migrate(legacy)?.migratedRefund || 0 : 0;
    this.persisted = true;
    if (this.migratedRefund || (!saved && legacy)) this.save();
  }

  get state() { return this._state; }
  get coins() { return this._state.coins; }
  get selectedChapter() { return this._state.selectedChapter; }
  get chapter() { return CHAPTER_MAP.get(this.selectedChapter); }
  get selectedSkin() { return this._state.selectedSkin; }
  get selectedClass() { return this._state.selectedClass; }
  get activeRun() { return this._state.activeRun; }
  getChapter(id) { return CHAPTER_MAP.get(id); }
  getTalent(id) { return TALENT_MAP.get(id); }
  getSkin(id) { return SKIN_MAP.get(id); }
  getProduct(id) { return PRODUCT_MAP.get(id); }
  rank(id) { return TALENT_MAP.has(id) ? this._state.talents[id] || 0 : 0; }

  save() {
    try { this.store?.setItem(CAMPAIGN_KEY, JSON.stringify(this._state)); this.persisted = !!this.store; }
    catch { this.persisted = false; }
    this.onChange?.(this._state);
    return this.persisted;
  }

  /** Replace the local save with a newer cloud copy (Yandex player data). */
  adopt(raw) {
    const next = normalize(raw);
    if (next.totalCollected < this._state.totalCollected) return false;
    next.activeRun = this._state.activeRun;
    this._state = next; this.save();
    return true;
  }

  selectChapter(id) {
    if (!CHAPTER_MAP.has(id)) return reject('unknown-chapter');
    if (id !== ENDLESS_ID && id > this._state.unlockedChapter) return reject('locked');
    if (this.activeRun) return reject('run-active');
    this._state.selectedChapter = id; this.save();
    return { ok: true, chapter: CHAPTER_MAP.get(id) };
  }

  selectClass(id) {
    if (!LOADOUTS.has(id)) return reject('unknown-class');
    if (this.activeRun) return reject('run-active');
    this._state.selectedClass = id; this.save();
    return { ok: true };
  }

  talentStatus(id) {
    const item = TALENT_MAP.get(id);
    if (!item) return { ...reject('unknown-talent'), rank: 0, cost: 0 };
    const rank = this.rank(id), cost = item.costs[rank] || 0;
    const reason = rank >= item.maxRank ? 'max-rank' : !item.requires.every(parent => this.rank(parent) > 0) ? 'locked' : this.coins < cost ? 'insufficient-coins' : null;
    return { ok: !reason, reason, rank, cost, maxRank: item.maxRank, node: item };
  }

  buyTalent(id) {
    if (this.activeRun) return reject('run-active');
    const status = this.talentStatus(id);
    if (!status.ok) return status;
    this._state.coins -= status.cost;
    this._state.talents[id] = status.rank + 1;
    this.save();
    return { ok: true, rank: status.rank + 1, cost: status.cost, coins: this.coins };
  }

  /** Total price of the whole tree, for the progress meter. */
  static treeCost() { return TALENTS.reduce((sum, item) => sum + item.costs.reduce((a, b) => a + b, 0), 0); }
  spentOnTalents() { return TALENTS.reduce((sum, item) => sum + item.costs.slice(0, this.rank(item.id)).reduce((a, b) => a + b, 0), 0); }

  buySkin(id) {
    if (this.activeRun) return reject('run-active');
    const skin = SKIN_MAP.get(id);
    if (!skin) return reject('unknown-skin');
    if (this._state.ownedSkins.includes(id)) return reject('owned');
    if (this.coins < skin.cost) return { ...reject('insufficient-coins'), cost: skin.cost };
    this._state.coins -= skin.cost; this._state.ownedSkins.push(id);
    this.save();
    return { ok: true, cost: skin.cost, coins: this.coins, skin };
  }

  equipSkin(id) {
    if (this.activeRun) return reject('run-active');
    if (!SKIN_MAP.has(id)) return reject('unknown-skin');
    if (!this._state.ownedSkins.includes(id)) return reject('not-owned');
    this._state.selectedSkin = id; this.save();
    return { ok: true, skin: SKIN_MAP.get(id) };
  }

  /** Permanent bonuses for a class: shared branches always, a class branch only for its own class. */
  bonuses(cls = this.selectedClass) {
    const bonuses = { damage: 1, speed: 1, maxHp: 0, regen: 0, magnet: 1, cooldown: 1, crit: 0, critMul: 0, armor: 0, coinGain: this._state.pass ? 1.25 : 1, xp: 1, dash: 1,
      bossDamage: 1, rerolls: 0, startLevel: 0, revive: 0, dashGuard: 0, relicStart: 0, relicLuck: 0, chestCoins: 1, chestRate: 0, relicChoices: 0 };
    for (const item of TALENTS) {
      const rank = this.rank(item.id);
      if (!rank) continue;
      const branch = BRANCH_MAP.get(item.branch);
      if (branch?.cls && branch.cls !== cls) continue;
      for (const [stat, value] of [[item.stat, item.value], item.extra || []]) if (stat) bonuses[stat] += value * rank;
    }
    const weapon = this._state.weapons[cls], look = WEAPON_MAP.get(weapon?.skin);
    if (weapon) { const w = weaponLevelBonus(weapon.level); bonuses.damage += w.damage + (look?.premium ? .1 : 0); bonuses.crit += w.crit + (look?.perk === 'bloom' ? .08 : 0); bonuses.cooldown += w.cooldown; }
    bonuses.armor = Math.min(.45, bonuses.armor);
    bonuses.speed = Math.min(1.45, bonuses.speed);
    bonuses.chestRate = Math.min(.4, bonuses.chestRate);
    bonuses.cooldown = Math.max(.55, bonuses.cooldown);
    bonuses.dash = Math.max(.5, bonuses.dash);
    return bonuses;
  }

  /** Talent stars bought for one class branch, shown as the class level in the menu. */
  classLevel(cls) {
    const branch = TALENT_BRANCHES.find(item => item.cls === cls);
    return branch ? TALENTS.filter(item => item.branch === branch.id).reduce((sum, item) => sum + this.rank(item.id), 0) : 0;
  }

  // ---------------------------------------------------------------- weapons
  getWeapon(id) { return WEAPON_MAP.get(id); }
  /** The look and level of a class weapon. */
  weapon(cls = this.selectedClass) { const w = this._state.weapons[cls] || { level: 0, skin: BASE_WEAPON[cls] }; return { ...w, look: WEAPON_MAP.get(w.skin) }; }
  upgradeWeapon(cls) {
    if (this.activeRun) return reject('run-active');
    const w = this._state.weapons[cls];
    if (!w) return reject('unknown-class');
    if (w.level >= WEAPON_MAX_LEVEL) return reject('max-rank');
    const cost = weaponUpgradeCost(w.level);
    if (this.coins < cost) return { ...reject('insufficient-coins'), cost };
    this._state.coins -= cost; w.level++;
    this.save();
    return { ok: true, level: w.level, cost, coins: this.coins };
  }
  buyWeapon(id) {
    if (this.activeRun) return reject('run-active');
    const look = WEAPON_MAP.get(id);
    if (!look) return reject('unknown-weapon');
    if (this._state.ownedWeapons.includes(id)) return reject('owned');
    if (look.product) return reject('store-only');
    if (this.coins < look.cost) return { ...reject('insufficient-coins'), cost: look.cost };
    this._state.coins -= look.cost; this._state.ownedWeapons.push(id);
    this._state.weapons[look.cls].skin = id;
    this.save();
    return { ok: true, cost: look.cost, coins: this.coins };
  }
  equipWeapon(id) {
    if (this.activeRun) return reject('run-active');
    const look = WEAPON_MAP.get(id);
    if (!look) return reject('unknown-weapon');
    if (!this._state.ownedWeapons.includes(id)) return reject('not-owned');
    this._state.weapons[look.cls].skin = id; this.save();
    return { ok: true };
  }

  // ----------------------------------------------------------------- boosts
  getBoost(id) { return BOOST_MAP.get(id); }
  boostAdsLeft() { return this._state.boostAds.day === today() ? Math.max(0, BOOST_ADS_PER_DAY - this._state.boostAds.count) : BOOST_ADS_PER_DAY; }
  isArmed(id) { return this._state.armedBoosts.includes(id); }
  /** Arm a boost for the next run, paid by a watched video ('ad'), a token or coins. */
  armBoost(id, via = 'coins') {
    if (this.activeRun) return reject('run-active');
    const boost = BOOST_MAP.get(id);
    if (!boost) return reject('unknown-boost');
    if (this.isArmed(id)) return reject('armed');
    if (via === 'ad') {
      if (!this.boostAdsLeft()) return reject('daily-limit');
      if (this._state.boostAds.day !== today()) this._state.boostAds = { day: today(), count: 0 };
      this._state.boostAds.count++;
    } else if (via === 'token') {
      if (this._state.boostTokens <= 0) return reject('no-tokens');
      this._state.boostTokens--;
    } else {
      if (this.coins < boost.cost) return { ...reject('insufficient-coins'), cost: boost.cost };
      this._state.coins -= boost.cost;
    }
    this._state.armedBoosts.push(id);
    this.save();
    return { ok: true, coins: this.coins };
  }

  beginRun(chapterId = this.selectedChapter, loadout = this.selectedClass) {
    if (!CHAPTER_MAP.has(chapterId) || (chapterId !== ENDLESS_ID && chapterId > this._state.unlockedChapter) || !LOADOUTS.has(loadout)) return null;
    // Previously banked coins survive replacing an abandoned run after reload.
    this._state.serial++;
    const nonce = typeof globalThis.crypto?.randomUUID === 'function' ? globalThis.crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
    const id = `run-${this._state.serial.toString(36)}-${Date.now().toString(36)}-${nonce}`;
    this._state.activeRun = { id, chapterId, loadout, runCoins: 0, rawCoins: 0, coinRemainder: 0, startedAt: Date.now(), revives: 0, boosts: this._state.armedBoosts };
    this._state.armedBoosts = [];
    this._state.selectedChapter = chapterId;
    this._state.selectedClass = loadout;
    this.save();
    return id;
  }

  collectCoins(runId, amount) {
    const run = this.activeRun;
    if (!run || run.id !== runId) return reject('invalid-run');
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 10000) return reject('invalid-amount');
    const scaled = amount * CHAPTER_MAP.get(run.chapterId).coinMul * this.bonuses(run.loadout).coinGain + run.coinRemainder;
    const awarded = Math.floor(scaled + 1e-9), credited = Math.min(awarded, MAX_COINS - this.coins);
    run.coinRemainder = Math.max(0, scaled - awarded);
    run.rawCoins += amount; run.runCoins += credited;
    this._state.coins += credited; this._state.totalCollected = Math.min(MAX_COINS, this._state.totalCollected + credited);
    this.save();
    return { ok: true, amount: credited, total: this.coins, runCoins: run.runCoins };
  }

  /** Coins spent on a second chance during a run; the price rises with each use. */
  reviveCost(runId) {
    const run = this.activeRun;
    if (!run || run.id !== runId) return null;
    return REVIVE_COIN_COST[run.revives] ?? null;
  }

  payRevive(runId) {
    const cost = this.reviveCost(runId);
    if (cost === null) return reject(this.activeRun?.id === runId ? 'limit' : 'invalid-run');
    if (this.coins < cost) return { ...reject('insufficient-coins'), cost };
    this._state.coins -= cost; this.activeRun.revives++;
    this.save();
    return { ok: true, cost, coins: this.coins };
  }

  finishRun(runId, outcome = {}) {
    const run = this.activeRun;
    if (!run || run.id !== runId) return reject(this._state.lastRun?.id === runId ? 'already-finished' : 'invalid-run');
    if (!plain(outcome) || !number(outcome.time) || outcome.time < 0 || !number(outcome.kills) || outcome.kills < 0) return reject('invalid-result');
    const chapter = CHAPTER_MAP.get(run.chapterId);
    if (outcome.victory === true && (chapter.endless || outcome.time < RUN_SECONDS)) return reject('unfinished');
    const victory = outcome.victory === true, previous = this._state.chapters[chapter.id] || { wins: 0, attempts: 0, bestTime: 0, bestKills: 0 };
    const firstClear = victory && previous.wins === 0;
    const bonus = victory ? chapter.reward + (firstClear ? 40 + chapter.id * 10 : 0) : 0;
    this._state.coins = Math.min(MAX_COINS, this.coins + bonus);
    this._state.totalCollected = Math.min(MAX_COINS, this._state.totalCollected + bonus);
    const unlocked = victory && chapter.id === this._state.unlockedChapter && chapter.id < STORY_CHAPTERS.length ? chapter.id + 1 : 0;
    if (unlocked) this._state.unlockedChapter = unlocked;
    const time = clampInteger(outcome.time, 0, chapter.endless ? MAX_COINS : RUN_SECONDS), kills = clampInteger(outcome.kills, 0, MAX_COINS);
    let newRecord = false;
    if (chapter.endless) {
      const best = this._state.endless;
      newRecord = time > best.bestTime;
      this._state.endless = { bestTime: Math.max(best.bestTime, time), bestKills: Math.max(best.bestKills, kills), runs: best.runs + 1 };
      this._state.records = [...this._state.records, { time, kills, cls: run.loadout, date: today() }].sort((a, b) => b.time - a.time || b.kills - a.kills).slice(0, 10);
    }
    const summary = { id: run.id, chapterId: chapter.id, victory, time, kills, runCoins: run.runCoins, bonus, unlocked, doubled: false };
    this._state.chapters[chapter.id] = { wins: previous.wins + Number(victory), attempts: previous.attempts + 1, bestTime: Math.max(previous.bestTime, time), bestKills: Math.max(previous.bestKills, kills) };
    this._state.lastRun = summary;
    this._state.activeRun = null;
    this.save();
    return { ok: true, ...summary, coins: this.coins, firstClear, newRecord };
  }

  /** Rewarded ad after a run: the coins collected in that run are paid once more. */
  doubleLastRun(runId) {
    const last = this._state.lastRun;
    if (!last || last.id !== runId) return reject('invalid-run');
    if (last.doubled) return reject('already-doubled');
    const amount = Math.min(last.runCoins, MAX_COINS - this.coins);
    last.doubled = true;
    this._state.coins += amount; this._state.totalCollected = Math.min(MAX_COINS, this._state.totalCollected + amount);
    this.save();
    return { ok: true, amount, coins: this.coins };
  }

  /** A few rewarded videos per day give a small coin gift. */
  adCoinsLeft() { return this._state.adCoins.day === today() ? Math.max(0, AD_COINS_PER_DAY - this._state.adCoins.count) : AD_COINS_PER_DAY; }
  grantAdCoins() {
    if (!this.adCoinsLeft()) return reject('daily-limit');
    if (this._state.adCoins.day !== today()) this._state.adCoins = { day: today(), count: 0 };
    this._state.adCoins.count++;
    this._state.coins = Math.min(MAX_COINS, this.coins + AD_COINS);
    this.save();
    return { ok: true, amount: AD_COINS, coins: this.coins, left: this.adCoinsLeft() };
  }

  /** Credit a store purchase exactly once per purchase token. */
  creditPurchase(productId, token) {
    const product = PRODUCT_MAP.get(productId);
    if (!product) return reject('unknown-product');
    if (typeof token !== 'string' || !token) return reject('invalid-token');
    if (this._state.purchases.includes(token)) return reject('already-credited');
    this._state.purchases = [...this._state.purchases, token.slice(0, 200)].slice(-50);
    if (product.permanent) this._grantPermanent(product);
    this._state.coins = Math.min(MAX_COINS, this.coins + product.coins);
    if (product.tokens) this._state.boostTokens = Math.min(9999, this._state.boostTokens + product.tokens);
    this.save();
    return { ok: true, product, coins: this.coins };
  }

  _grantPermanent(product) {
    if (product.weapon) {
      if (this._state.ownedWeapons.includes(product.weapon)) return false;
      this._state.ownedWeapons.push(product.weapon);
      this._state.weapons[WEAPON_MAP.get(product.weapon).cls].skin = product.weapon;
      return true;
    }
    if (this._state.pass) return false;
    this._state.pass = true;
    if (!this._state.ownedSkins.includes('gold')) this._state.ownedSkins.push('gold');
    return true;
  }

  /** A permanent product found in the player's purchase list (e.g. on another device). */
  restorePermanent(productId = 'golden_pass') {
    const product = PRODUCT_MAP.get(productId);
    if (!product?.permanent || !this._grantPermanent(product)) return false;
    this.save();
    return true;
  }
  restorePass() { return this.restorePermanent('golden_pass'); }
  ownsProduct(id) { const p = PRODUCT_MAP.get(id); return p?.weapon ? this._state.ownedWeapons.includes(p.weapon) : id === 'golden_pass' ? this._state.pass : false; }

  finishTutorial() { if (this._state.tutorial) { this._state.tutorial = false; this.save(); } }

  /** Close an interrupted browser session without inventing a victory or bonus. */
  abandonRun() {
    if (!this.activeRun) return false;
    this._state.activeRun = null; this.save();
    return true;
  }
}

export default Campaign;
