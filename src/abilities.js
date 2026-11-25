import * as THREE from 'three';
import { toonify } from './assets.js';
import { TEX, Particles, CELL } from './vfx.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Level tables are indexed by (level - 1); every ability caps at level 5.
// Level 5 is an awakening: the weapon turns into its super form (`super`) with
// much stronger numbers and an extra behaviour, passives gain a unique perk.
export const ABILITIES = {
  katana: {
    name: 'Удар катаны', icon: '刀', color: '#d8342f', weapon: true,
    dmg: [20, 25, 31, 39, 52], cd: [1.05, 0.99, 0.93, 0.87, 0.8], radius: [3.0, 3.2, 3.4, 3.6, 4.0],
    desc: ['Широкий разрез: 20 урона в радиусе 3 м.', '25 урона; клинок достаёт на 3,2 м.', '31 урон и дополнительный разрез за спиной.', '39 урона; радиус 3,6 м, взмах каждые 0,87 с.', 'Круговой разрез: 52 урона и слабое эхо. Одна цель не получает повторный полный урон от перекрытия разрезов.'],
    super: { name: 'Иайдо: Тысяча лепестков', icon: '居' },
  },
  shuriken: {
    name: 'Сюрикены', icon: '手', color: '#a9b4c6', weapon: true,
    count: [2, 3, 3, 4, 8], dmg: [9, 11, 14, 17, 30], radius: [2.3, 2.5, 2.8, 3.0, 3.6], spin: [3.2, 3.4, 3.8, 4.1, 5.4],
    desc: ['Два сюрикена кружат вокруг тебя.', '+1 сюрикен.', 'Шире орбита, больше урона.', '+1 сюрикен.', '8 сюрикенов по 30 урона; орбита «дышит» и достаёт дальних врагов.'],
    super: { name: 'Стальной вихрь', icon: '嵐' },
  },
  foxfire: {
    name: 'Кицунэ-би', icon: '狐', color: '#e08a3c', weapon: true,
    count: [1, 2, 2, 3, 7], dmg: [22, 26, 30, 36, 60], cd: [1.5, 1.4, 1.25, 1.1, 0.8], aoe: [0, 0, 1.6, 1.8, 3.0],
    desc: ['Лисий огонь летит в ближайшего врага.', '+1 огонёк.', 'Огоньки взрываются по площади.', '+1 огонёк, быстрее.', 'Семь огней по 60 урона с огромными взрывами.'],
    super: { name: 'Девять хвостов', icon: '尾' },
  },
  lightning: {
    name: 'Гнев Райдзина', icon: '雷', color: '#9fb7ff', weapon: true,
    chains: [2, 3, 4, 5, 9], dmg: [30, 36, 42, 50, 95], cd: [2.4, 2.15, 1.9, 1.65, 1.0],
    desc: ['Молния бьёт врага и перескакивает на соседних.', '+1 цель в цепи.', '+1 цель, чаще удары.', '+1 цель, больше урона.', 'Две молнии за удар, цепь из 9 целей по 95 урона.'],
    super: { name: 'Барабаны Райдзина', icon: '鼓' },
  },
  aura: {
    name: 'Вихрь сакуры', icon: '桜', color: '#c2283c', weapon: true,
    radius: [2.3, 2.7, 3.1, 3.5, 5.2], dps: [12, 16, 21, 27, 58],
    desc: ['Круг из лепестков ранит и замедляет врагов рядом.', '+радиус, +урон.', '+радиус, +урон.', '+радиус, +урон.', 'Радиус 5,2 м, 58 урона/с, каждое попадание лечит тебя.'],
    super: { name: 'Сад лунной сакуры', icon: '月' },
  },
  frost: {
    name: 'Ледяной лотос', icon: '氷', color: '#8fd6ec', weapon: true,
    dmg: [18, 25, 33, 44, 95], cd: [4.2, 3.9, 3.6, 3.3, 2.5], radius: [3.4, 3.8, 4.2, 4.6, 6.6], freeze: [0.65, 0.85, 1.05, 1.25, 2.2],
    desc: ['Ледяная волна вокруг героя: 18 урона и заморозка.', '25 урона, заморозка 0,85 с.', 'Радиус 4,2 м, заморозка 1,05 с.', '44 урона, заморозка 1,25 с.', 'Волна 6,6 м: 95 урона и заморозка 2,2 с.'],
    super: { name: 'Вечная зима', icon: '冬' },
  },
  kunai: {
    name: 'Кунаи', icon: '刃', color: '#b9c9d6', weapon: true,
    dmg: [15, 19, 24, 30, 46], cd: [1.35, 1.25, 1.15, 1.0, 0.7], count: [1, 2, 3, 3, 7], pierce: [1, 1, 2, 3, 6],
    desc: ['Прицельный кунай пронзает двух врагов.', 'Два куная по 19 урона.', 'Три куная, каждый пробивает 3 цели.', '30 урона, каждый пробивает 4 цели.', 'Веер из 7 кунаев и кольцо из 12 клинков вокруг тебя.'],
    super: { name: 'Стальной дождь', icon: '雨' },
  },
  meteor: {
    name: 'Падение кометы', icon: '星', color: '#f0a050', weapon: true,
    dmg: [65, 82, 105, 135, 240], cd: [5.5, 5.1, 4.7, 4.3, 3.2], radius: [2.5, 2.8, 3.1, 3.4, 4.4], count: [1, 1, 2, 2, 5],
    desc: ['Комета падает на врага: 65 урона по площади.', '82 урона, взрыв радиусом 2,8 м.', 'Две кометы по 105 урона.', '135 урона, взрыв радиусом 3,4 м.', 'Пять комет по 240 урона, взрывы 4,4 м.'],
    super: { name: 'Звездопад', icon: '隕' },
  },
  vortex: {
    name: 'Печать пустоты', icon: '空', color: '#a98bd8', weapon: true,
    dps: [14, 19, 25, 33, 75], cd: [6.8, 6.4, 6.0, 5.6, 4.6], radius: [2.6, 2.9, 3.2, 3.5, 5.0], duration: [2.6, 2.9, 3.2, 3.5, 4.6],
    desc: ['Воронка у врага стягивает ёкаев и наносит 14 урона/с.', '19 урона/с, длительность 2,9 с.', '25 урона/с, радиус 3,2 м.', '33 урона/с, длительность 3,5 с.', 'Две воронки по 75 урона/с, радиус 5 м.'],
    super: { name: 'Врата пустоты', icon: '門' },
  },
  arrow: {
    name: 'Выстрел из арбалета', icon: '弓', color: '#d7bb7e', weapon: true,
    dmg: [18, 22, 27, 33, 42], cd: [0.78, 0.72, 0.66, 0.60, 0.54], count: [2, 3, 4, 5, 7], pierce: [1, 1, 2, 3, 5],
    desc: ['Два болта по 18 урона; каждый пробивает две цели.', 'Три болта по 22 урона каждые 0,72 с.', 'Четыре болта по 27 урона; до трёх целей на болт.', 'Пять болтов по 33 урона; до четырёх целей на болт.', 'Семь болтов по 42 урона; каждый пронзает до шести целей.'],
    super: { name: 'Арбалет: Рассветный залп', icon: '暁' },
  },
  arrowrain: {
    name: 'Дождь болтов', icon: '矢', color: '#e1b16c', weapon: true,
    dmg: [20, 25, 31, 38, 50], cd: [4.6, 4.2, 3.8, 3.4, 2.9], count: [1, 2, 2, 3, 4], radius: [2.2, 2.4, 2.7, 3.0, 3.4], shots: [7, 8, 10, 12, 16],
    desc: ['Семь болтов по 20 урона накрывают отмеченную область.', 'Две области, по восемь болтов по 25 урона.', 'Десять болтов по 31 урону, область 2,7 м.', 'Три области, по двенадцать болтов по 38 урона.', 'Четыре области: по шестнадцать болтов по 50 урона.'],
    super: { name: 'Небесный арсенал', icon: '天' },
  },
  ricochet: {
    name: 'Прыгающий болт', icon: '跳', color: '#9bceb2', weapon: true,
    dmg: [26, 34, 43, 54, 74], cd: [2.7, 2.45, 2.2, 1.95, 1.6], count: [1, 2, 2, 3, 4], bounces: [3, 4, 5, 6, 8],
    desc: ['Болт на 26 урона перескакивает ещё на три цели.', 'Два болта по 34 урона и четыре отскока.', 'Два болта по 43 урона и пять отскоков.', 'Три болта по 54 урона, шесть отскоков.', 'Четыре болта по 74 урона, до восьми отскоков у каждого.'],
    super: { name: 'Охота без промаха', icon: '狩' },
  },
  arcane: {
    name: 'Искра посоха', icon: '杖', color: '#80cee3', weapon: true,
    dmg: [28, 34, 42, 50, 64], cd: [0.9, 0.84, 0.78, 0.72, 0.64], count: [1, 2, 2, 3, 4], radius: [1.6, 1.9, 2.2, 2.6, 3.0],
    desc: ['Искра на 28 урона взрывается и задевает врагов в радиусе 1,6 м.', 'Две искры по 34 урона; взрывы 1,9 м.', 'Две искры по 42 урона; взрывы 2,2 м.', 'Три искры по 50 урона; взрывы 2,6 м.', 'Четыре искры по 64 урона со взрывами радиусом 3 м.'],
    super: { name: 'Посох: Нефритовые кометы', icon: '彗' },
  },
  runeburst: {
    name: 'Взрыв печати', icon: '印', color: '#b69ae8', weapon: true,
    dmg: [42, 55, 72, 95, 145], cd: [5.6, 5.2, 4.8, 4.4, 3.6], count: [1, 1, 1, 2, 3], radius: [3.0, 3.5, 4.0, 4.5, 5.5],
    desc: ['Печать под врагом готовится 0,65 с, затем расходится ударной волной.', '55 урона, радиус волны 3,5 м.', '72 урона, радиус 4 м; волна замедляет врагов.', 'Две печати по 95 урона, радиус 4,5 м.', 'Три печати по 145 урона с волнами радиусом 5,5 м.'],
    super: { name: 'Созвездие печатей', icon: '陣' },
  },
  explosivearrow: {
    name: 'Болт жар-птицы', icon: '炎', color: '#e5aa63', weapon: true,
    dmg: [38, 49, 63, 79, 104], cd: [3.6, 3.3, 3.0, 2.7, 2.3], count: [1, 1, 2, 2, 3], radius: [2.1, 2.4, 2.7, 3.1, 3.7],
    desc: ['Болт взрывается при попадании: 38 урона по области 2,1 м.', '49 урона; взрыв достаёт на 2,4 м.', 'Два взрывных болта по 63 урона.', 'Два болта по 79 урона; взрывы 3,1 м.', 'Три болта по 104 урона с широкими взрывами 3,7 м.'],
    super: { name: 'Крылья Феникса', icon: '鳳' },
  },
  windvolley: {
    name: 'Веер тэнгу', icon: '扇', color: '#afcdb4', weapon: true,
    dmg: [17, 22, 28, 35, 45], cd: [4.0, 3.7, 3.4, 3.1, 2.7], count: [5, 7, 9, 11, 15], pierce: [1, 1, 2, 3, 4],
    desc: ['Веер из пяти болтов по 17 урона пробивает по две цели.', 'Семь болтов по 22 урона.', 'Девять болтов по 28 урона, по три цели на болт.', 'Одиннадцать болтов по 35 урона, по четыре цели.', 'Пятнадцать болтов по 45 урона прорезают толпу широким веером.'],
    super: { name: 'Небесные крылья', icon: '翼' },
  },
  spiritbeam: {
    name: 'Луч дракона', icon: '龍', color: '#84d5cc', weapon: true,
    dmg: [14, 17, 21, 26, 34], cd: [5.6, 5.2, 4.8, 4.3, 3.8], duration: [0.8, 0.95, 1.1, 1.25, 1.45], radius: [0.55, 0.7, 0.85, 1.0, 1.2], length: [11, 12, 13, 14, 16],
    desc: ['Нефритовый луч пронзает ряд врагов: 14 урона каждые 0,16 с.', 'Луч шире и держится 0,95 с; 17 урона за удар.', '21 урон; луч достаёт на 13 м.', '26 урона; широкий луч держится 1,25 с.', 'Луч длиной 16 м держится 1,45 с и наносит 34 урона за удар.'],
    super: { name: 'Дыхание небесного дракона', icon: '天' },
  },
  spiritguard: {
    name: 'Духи-хранители', icon: '守', color: '#b1cfb9', weapon: true,
    dmg: [17, 22, 28, 35, 45], count: [2, 3, 4, 5, 6], radius: [2.5, 2.7, 2.9, 3.1, 3.4], spin: [1.8, 1.95, 2.1, 2.25, 2.5],
    desc: ['Два духа кружат рядом: 17 урона при касании и лёгкое замедление.', 'Три хранителя по 22 урона.', 'Четыре хранителя по 28 урона, орбита шире.', 'Пять хранителей по 35 урона.', 'Шесть хранителей по 45 урона образуют защитное кольцо.'],
    super: { name: 'Шесть небесных стражей', icon: '六' },
  },
  flyswords: {
    name: 'Летающие мечи', icon: '剣', color: '#9fc4e8', weapon: true,
    count: [1, 2, 3, 4, 6], dmg: [16, 20, 25, 31, 44], radius: [1.6, 1.7, 1.8, 1.95, 2.2], spin: [2.6, 2.8, 3.0, 3.2, 3.8],
    desc: ['Волшебный меч кружит рядом и рубит ёкаев: 16 урона.', 'Два меча по 20 урона.', 'Три меча по 25 урона.', 'Четыре меча по 31 урону, круг шире.', 'Шесть мечей по 44 урона; каждые 3 с они разлетаются вдвое дальше.'],
    super: { name: 'Танец тысячи мечей', icon: '舞' },
  },
  quake: {
    name: 'Удар земли', icon: '震', color: '#c49a5a', weapon: true,
    dmg: [24, 30, 38, 48, 72], cd: [5.2, 4.8, 4.4, 4.0, 3.2], radius: [3.2, 3.6, 4.0, 4.4, 5.6],
    desc: ['Герой бьёт оземь: 24 урона вокруг и враги отлетают.', '30 урона, радиус 3,6 м.', '38 урона, удар каждые 4,4 с.', '48 урона, радиус 4,4 м.', 'Двойная волна: 72 урона и вторая, ещё шире.'],
    super: { name: 'Гнев горы', icon: '岳' },
  },
  swift: { name: 'Шаг ветра', icon: '風', color: '#9fb1c8', desc: ['+10% скорость бега.'], super: { name: 'Поступь тени', desc: '+10% скорости и рывок перезаряжается на 45% быстрее.' } },
  vitality: { name: 'Стойкость', icon: '命', color: '#c2283c', desc: ['+20 к макс. HP, +0.4 HP/с регенерации.'], super: { name: 'Несгибаемый дух', desc: '+20 HP и один раз за бой ты встаёшь после смерти.' } },
  magnet: { name: 'Сбор кристаллов', icon: '魂', color: '#8fb4ff', desc: ['+40% радиус сбора кристаллов.'], super: { name: 'Зов кристаллов', desc: 'Каждые 15 с все кристаллы на поле летят к тебе.' } },
  haste: { name: 'Концентрация', icon: '心', color: '#c9a86a', desc: ['−8% перезарядка способностей.'], super: { name: 'Ясный ум', desc: '−20% перезарядки сразу.' } },
  might: { name: 'Ярость', icon: '力', color: '#e05a3c', desc: ['+12% к урону.'], super: { name: 'Путь меча', desc: '+12% урона, шанс крита 25%, криты ×2,5.' } },
  armor: { name: 'Бамбуковый доспех', icon: '甲', color: '#5fbf6a', desc: ['−7% получаемого урона.'], super: { name: 'Железная гора', desc: '−7% урона и ещё −12% сверху: удары почти не страшны.' } },
  wisdom: { name: 'Мудрая сова', icon: '知', color: '#6fa8ff', desc: ['+12% опыта за кристаллы.'], super: { name: 'Свиток мудреца', desc: '+12% опыта и сразу ещё +25%.' } },
  thorns: { name: 'Шипы ежа', icon: '棘', color: '#8f9a5a', desc: ['Ёкай, который тебя ударил, получает 30 урона.'], super: { name: 'Колючий доспех', desc: 'Ответный удар 80 урона и −10% урона по тебе.' } },
  luck: { name: 'Талисман удачи', icon: '運', color: '#e3b65c', desc: ['+5% шанса крита, в сундуках чаще редкие артефакты.'], super: { name: 'Благословение Эбису', desc: '+10% крита и легендарные артефакты попадаются втрое чаще.' } },
  greed: { name: 'Манэки-нэко', icon: '猫', color: '#ffbf1f', desc: ['Монеты падают на 15% чаще.'], super: { name: 'Золотой кот', desc: 'Монеты падают чаще, а элитные ёкаи и боссы роняют вдвое больше.' } },
};

const FAMILIES = { katana: 'sword', shuriken: 'sword', kunai: 'sword', arrow: 'bow', arrowrain: 'bow', ricochet: 'bow', explosivearrow: 'bow', windvolley: 'bow', arcane: 'staff', runeburst: 'staff', spiritbeam: 'staff', spiritguard: 'staff' };
for (const [id, ability] of Object.entries(ABILITIES)) ability.family = FAMILIES[id] || 'shared';
const STARTERS = { sword: 'katana', bow: 'arrow', staff: 'arcane' };
const freshStats = () => ({ dmg: 1, cd: 1, speed: 1, magnet: 2.4, regen: 0, dash: 1, crit: 0.1, critMul: 2, revive: 0, soulCall: false, armor: 0, xp: 1, coinDrop: 1, richDrops: false, flySwords: 0, thorns: 0, relicLuck: 0, bossDamage: 1 });

/** Solid arrow geometry and a faceted rune core, rendered in two shared batches. */
function coloredParts(parts) {
  for (const [geometry, color] of parts) {
    const c = new THREE.Color(color), values = new Float32Array(geometry.attributes.position.count * 3);
    for (let i = 0; i < values.length; i += 3) { values[i] = c.r; values[i + 1] = c.g; values[i + 2] = c.b; }
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3));
  }
  let geometries = parts.map(([geometry]) => geometry);
  if (geometries.some(geometry => !geometry.index)) geometries = geometries.map(geometry => geometry.index ? geometry.toNonIndexed() : geometry);
  const merged = mergeGeometries(geometries);
  for (const geometry of geometries) if (!parts.some(([original]) => original === geometry)) geometry.dispose();
  for (const [geometry] of parts) geometry.dispose();
  return merged;
}

function arrowGeometry() {
  return coloredParts([
    [new THREE.CylinderGeometry(0.025, 0.025, 0.88, 5).rotateX(Math.PI / 2), '#b89766'],
    [new THREE.ConeGeometry(0.09, 0.25, 4).rotateX(Math.PI / 2).translate(0, 0, 0.55), '#e7e0c7'],
    [new THREE.BoxGeometry(0.2, 0.024, 0.23).translate(0, 0, -0.34), '#c37e6a'],
    [new THREE.BoxGeometry(0.024, 0.2, 0.23).translate(0, 0, -0.34), '#c37e6a'],
  ]);
}

function projectileBatch(scene, geometry, count) {
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }), count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.frustumCulled = false; mesh.count = 0;
  scene.add(mesh);
  return mesh;
}

export class Abilities {
  constructor(scene, assets, game) {
    this.game = game;
    this.scene = scene;
    this.levels = { katana: 1 };
    this.loadout = 'sword';
    this.timers = {};
    this.stats = freshStats();

    this.shuriken = Array.from({ length: 8 }, () => {
      const m = assets.shuriken.clone(true);
      toonify(m);
      m.scale.setScalar(1.25);
      m.visible = false;
      scene.add(m);
      return m;
    });
    this.shuriAngle = 0;
    // Flying swords (technique and relics): katana copies centred on the blade so they spin around their middle.
    this.flySwords = Array.from({ length: 10 }, () => {
      const holder = new THREE.Group(), blade = assets.katana ? assets.katana.clone(true) : new THREE.Group();
      toonify(blade);
      blade.position.z = -0.7; blade.scale.setScalar(1.25);
      holder.add(blade); holder.visible = false; scene.add(holder);
      return holder;
    });
    this.swordAngle = 0;
    this.pendingQuakes = [];

    this.fires = [];
    this.firePool = [];
    this.pendingSlashes = [];
    this.pendingShots = [];
    this.shotPool = [];
    this._slashCycle = 0;
    this._actorAttackUntil = 0;
    this._offerRound = 0;
    this._usedTargets = new Set();
    const fireMaterial = new THREE.SpriteMaterial({ map: TEX.glow, color: new THREE.Color(1.4, 1.1, 3.2), blending: THREE.AdditiveBlending, depthWrite: false });
    this.fireSprites = Array.from({ length: 24 }, () => {
      const s = new THREE.Sprite(fireMaterial);
      s.scale.setScalar(1.1); s.visible = false; scene.add(s); return s;
    });

    this.auraUniforms = { uTime: { value: 0 }, uI: { value: 0 } };
    this.aura = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: this.auraUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime, uI; varying vec2 vUv;
        void main(){
          vec2 p = vUv * 2.0 - 1.0; float r = length(p); if (r > 1.0) discard;
          float ang = atan(p.y, p.x);
          float petals = smoothstep(0.55, 1.0, sin(ang * 6.0 + uTime * 2.0 - r * 4.0) * 0.5 + 0.5) * smoothstep(0.35, 0.95, r);
          float rim = smoothstep(0.86, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r));
          float a = (rim * 0.7 + petals * 0.3 + r * 0.08) * uI;
          vec3 c = mix(vec3(0.7, 0.03, 0.12), vec3(1.0, 0.25, 0.3), rim);
          gl_FragColor = vec4(c * a, a);
        }`,
    }));
    this.aura.visible = false;
    this.aura.position.y = 0.05;
    scene.add(this.aura);
    this._tmp = [];
    this._v1 = new THREE.Vector3(); this._v2 = new THREE.Vector3();
    const bladeGeometry = new THREE.ConeGeometry(0.13, 0.9, 4);
    const bladeMaterial = new THREE.MeshBasicMaterial({ color: '#c4f1ff' });
    this.kunai = Array.from({ length: 40 }, () => {
      const mesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
      mesh.visible = false; scene.add(mesh);
      return { mesh, active: false, hit: new Set() };
    });
    const meteorGeometry = new THREE.IcosahedronGeometry(0.5, 0);
    const meteorMaterial = new THREE.MeshBasicMaterial({ color: '#ffba6a' });
    const markerGeometry = new THREE.RingGeometry(0.89, 1.0, 32).rotateX(-Math.PI / 2);
    this.meteors = Array.from({ length: 6 }, () => {
      const mesh = new THREE.Mesh(meteorGeometry, meteorMaterial);
      const marker = new THREE.Mesh(markerGeometry, new THREE.MeshBasicMaterial({ color: '#ffb76d', transparent: true, opacity: 0.7, depthWrite: false }));
      mesh.visible = marker.visible = false; scene.add(mesh, marker);
      return { mesh, marker, active: false };
    });
    this.vortices = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `varying vec2 vUv; uniform float uTime,uAlpha;
          void main(){vec2 p=vUv*2.0-1.0;float r=length(p);if(r>1.0)discard;
            float a=atan(p.y,p.x);float arms=pow(0.5+0.5*sin(a*4.0-r*13.0+uTime*6.0),5.0);
            float rim=exp(-80.0*abs(r-0.91));float alpha=(arms*0.6+rim)*(1.0-smoothstep(0.92,1.0,r))*uAlpha;
            gl_FragColor=vec4(vec3(0.65,0.32,1.0)*(arms+rim)*2.0,alpha);}`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      mesh.visible = false; scene.add(mesh); return { mesh, active: false };
    });
    this.arrows = Array.from({ length: 112 }, () => ({ active: false, hit: new Set() }));
    this.orbs = Array.from({ length: 40 }, () => ({ active: false }));
    this.guards = Array.from({ length: 6 }, () => ({ active: false, kind: 'guard', age: 0 }));
    this.guardAngle = 0;
    this.arrowBatch = projectileBatch(scene, arrowGeometry(), this.arrows.length);
    this.orbBatch = projectileBatch(scene, coloredParts([
      [new THREE.IcosahedronGeometry(0.18, 0), '#84e0ed'],
      [new THREE.TorusGeometry(0.26, 0.022, 4, 12).rotateX(Math.PI / 2), '#d2b9fa'],
    ]), this.orbs.length + this.guards.length);
    this._projectileBatches = [{ pool: this.arrows, mesh: this.arrowBatch }, { pool: [...this.orbs, ...this.guards], mesh: this.orbBatch }];
    this._projectileColor = new THREE.Color();
    for (let i = 0; i < this.arrows.length; i++) this.arrowBatch.setColorAt(i, this._projectileColor);
    this.arrowBatch.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const sigilGeometry = new THREE.RingGeometry(0.9, 1.0, 40).rotateX(-Math.PI / 2);
    const runeGeometry = mergeGeometries([sigilGeometry, new THREE.RingGeometry(0.47, 0.51, 4).rotateX(-Math.PI / 2), new THREE.RingGeometry(0.23, 0.26, 16).rotateX(-Math.PI / 2)]);
    const makeField = (color, rune = false) => {
      const marker = new THREE.Mesh(rune ? runeGeometry : sigilGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
      marker.visible = false; scene.add(marker);
      let wave;
      if (rune) {
        wave = new THREE.Mesh(sigilGeometry, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
        wave.visible = false; scene.add(wave);
      }
      return { marker, wave, active: false, hit: new Set() };
    };
    this.arrowFields = Array.from({ length: 8 }, () => makeField('#d1b573'));
    this.runes = Array.from({ length: 6 }, () => makeField('#ac96df', true));
    const beamGeometry = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).rotateX(Math.PI / 2).translate(0, 0, .5);
    this.beams = Array.from({ length: 2 }, () => {
      const mesh = new THREE.Mesh(beamGeometry, new THREE.MeshBasicMaterial({ color: '#80d5c9', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      mesh.visible = false; mesh.frustumCulled = false; scene.add(mesh);
      return { mesh, active: false };
    });
    this._muzzle = new THREE.Vector3();
    this._projectilePose = new THREE.Object3D();
    this._areaTmp = []; this._chainTmp = [];
  }

  /** Loadouts are chosen before the run; random upgrades never replace held gear. */
  setLoadout(id) {
    if (!Object.hasOwn(STARTERS, id) || (this.game.state && this.game.state !== 'title')) return false;
    this.loadout = id; this.levels = { [STARTERS[id]]: 1 }; this.timers = {}; this.stats = freshStats();
    this.pendingSlashes.length = 0;
    for (const shot of this.pendingShots) this.shotPool.push(shot);
    this.pendingShots.length = 0;
    this._actorAttackUntil = 0;
    this._offerRound = 0;
    for (const fire of this.fires) { fire.sprite.visible = false; this.firePool.push(fire); }
    this.fires.length = 0;
    for (const mesh of this.shuriken) mesh.visible = false;
    for (const mesh of this.flySwords) mesh.visible = false;
    this.pendingQuakes.length = 0;
    this.aura.visible = false;
    for (const pool of [this.kunai, this.meteors, this.vortices, this.arrows, this.orbs, this.guards, this.beams, this.arrowFields, this.runes]) {
      for (const item of pool) { item.active = false; if (item.mesh) item.mesh.visible = false; if (item.marker) item.marker.visible = false; if (item.wave) item.wave.visible = false; }
    }
    this.arrowBatch.count = this.orbBatch.count = 0;
    return true;
  }

  get starter() { return STARTERS[this.loadout]; }
  lv(k) { return this.levels[k] || 0; }
  /** Level 5 is the awakened super form. */
  isSuper(k) { return this.lv(k) >= 5; }
  val(k, field) { return ABILITIES[k][field][this.lv(k) - 1]; }

  /** Random distinct offers (four by default) among abilities that are not maxed yet. */
  offers(count = 4) {
    const owned = Object.keys(this.levels);
    const weaponsOwned = owned.filter((k) => ABILITIES[k].weapon).length;
    const pool = Object.keys(ABILITIES).filter((k) => this.lv(k) < 5 && !(ABILITIES[k].weapon && !this.levels[k] && (weaponsOwned >= 4 || !this.canLearn(k))));
    const weighted = pool.map((k) => ({ k, w: Math.random() * (this.levels[k] ? 1.4 : ABILITIES[k].family === this.loadout ? 1.3 : 1) }));
    weighted.sort((a, b) => b.w - a.w);
    const offers = weighted.slice(0, count).map((o) => o.k);
    const signature = weighted.find(({ k }) => ABILITIES[k].weapon && ABILITIES[k].family === this.loadout)?.k;
    if (signature && !offers.some(id => ABILITIES[id].weapon && ABILITIES[id].family === this.loadout)) offers[offers.length - 1] = signature;
    // A player must be able to develop the weapon they deliberately chose,
    // rather than repeatedly seeing only unrelated elemental/passive offers.
    const starter = STARTERS[this.loadout];
    if ((this._offerRound++ % 2 === 0) && pool.includes(starter) && !offers.includes(starter)) offers[0] = starter;
    return offers;
  }

  canLearn(id) {
    const ability = Object.hasOwn(ABILITIES, id) ? ABILITIES[id] : null;
    return !!ability && (!!this.lv(id) || !ability.weapon || ability.family === 'shared' || ability.family === this.loadout);
  }

  take(k) {
    if (!Object.hasOwn(ABILITIES, k) || this.lv(k) >= 5 || !this.canLearn(k)) return false;
    if (ABILITIES[k].weapon && !this.lv(k) && Object.keys(this.levels).filter((id) => ABILITIES[id].weapon).length >= 4) return false;
    this.levels[k] = this.lv(k) + 1;
    const s = this.stats, p = this.game.player, awakened = this.levels[k] === 5;
    if (k === 'swift') { s.speed += 0.1; if (awakened) s.dash = 0.55; }
    if (k === 'vitality') { p.maxHp += 20; p.hp = Math.min(p.maxHp, p.hp + 40); s.regen += 0.4; if (awakened) s.revive = 1; }
    if (k === 'magnet') { s.magnet *= 1.4; if (awakened) s.soulCall = true; }
    if (k === 'haste') s.cd *= awakened ? 0.8 : 0.92;
    if (k === 'might') { s.dmg += 0.12; if (awakened) { s.crit += 0.15; s.critMul = 2.5; } }
    if (k === 'armor') s.armor = Math.min(0.6, s.armor + 0.07 + (awakened ? 0.12 : 0));
    if (k === 'wisdom') s.xp += 0.12 + (awakened ? 0.25 : 0);
    if (k === 'thorns') { s.thorns += 30; if (awakened) { s.thorns += 50; s.armor = Math.min(0.6, s.armor + 0.1); } }
    if (k === 'luck') { s.crit += 0.05; s.relicLuck += 0.15; if (awakened) { s.crit += 0.05; s.relicLuck += 0.6; } }
    if (k === 'greed') { s.coinDrop += 0.15; if (awakened) s.richDrops = true; }
    return true;
  }

  _quake({ radius, damage }) {
    const g = this.game, p = g.player, vfx = g.vfx;
    vfx.ring(p.x, p.z, radius, '#e0b070', 0.5);
    vfx.decals.add({ cell: CELL.scorch, x: p.x, y: 0.03, z: p.z, size: radius * 1.2, rot: Math.random() * 6, color: '#3a2a18', alpha: 0.35, dur: 1.4, hold: 0.4 });
    for (let i = 0; i < Math.ceil(8 * Particles.budget); i++) { const a = Math.random() * 6.28; vfx.smoke.emit(p.x + Math.cos(a) * radius * 0.5, 0.3, p.z + Math.sin(a) * radius * 0.5, Math.cos(a) * 3, 0.8, Math.sin(a) * 3, 0.7, 1.2, 0.75, 0.65, 0.5, { grav: 0.5, drag: 3, sizeEnd: 2.4 }); }
    vfx.sparks.burst(p.x, 0.2, p.z, 24, { speed: radius * 2.4, up: 3, life: 0.45, size: 0.5, color: [1.6, 1.2, 0.7], grav: -10, spread: 1 });
    g.shake?.(0.12);
    for (const e of g.enemies.query(p.x, p.z, radius, this._areaTmp)) {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      this.hit(e, damage, dx / d, dz / d, 12);
    }
  }

  hit(e, base, kx = 0, kz = 0, knock = 4, quiet = false) {
    if (!e.alive || (this.game.state && this.game.state !== 'play')) return;
    const crit = Math.random() < this.stats.crit;
    const tough = e.t.boss || e.elite ? this.stats.bossDamage : 1;
    const dmg = Math.round(base * this.stats.dmg * tough * (this.game.buffs?.fury > 0 ? 1.5 : 1) * (crit ? this.stats.critMul : 1) * (0.9 + Math.random() * 0.2));
    this.game.damageEnemy(e, dmg, crit, kx, kz, knock, quiet);
  }

  update(dt) {
    const g = this.game, p = g.player, vfx = g.vfx, en = g.enemies;
    if (g.state && g.state !== 'play') return;
    const cdMul = this.stats.cd;
    const tick = (k) => {
      this.timers[k] = (this.timers[k] ?? 0.3) - dt;
      if (this.timers[k] > 0) return false;
      this.timers[k] = this.val(k, 'cd') * cdMul;
      return true;
    };

    // Delayed strikes advance only with game simulation: pause/death cannot fire them.
    for (let i = this.pendingSlashes.length - 1; i >= 0; i--) {
      const slash = this.pendingSlashes[i];
      slash.delay -= dt;
      if (slash.delay <= 0) { this._slash(slash); this.pendingSlashes.splice(i, 1); }
    }
    for (let i = this.pendingShots.length - 1; i >= 0; i--) {
      const shot = this.pendingShots[i];
      shot.delay -= dt;
      if (shot.delay > 0) continue;
      this._releaseShot(shot);
      this.pendingShots[i] = this.pendingShots[this.pendingShots.length - 1]; this.pendingShots.pop();
      this.shotPool.push(shot);
    }

    // --- katana: automatically faces a nearby threat, even while retreating.
    if (this.lv('katana') && tick('katana')) {
      const R = this.val('katana', 'radius'), dmg = this.val('katana', 'dmg');
      const target = en.nearest(p.x, p.z, R + 1.0);
      const angle = target ? Math.atan2(target.x - p.x, target.z - p.z) : p.aimAngle ?? p.face;
      const dirs = [angle];
      if (this.lv('katana') >= 3) dirs.push(angle + Math.PI);
      if (this.isSuper('katana')) dirs.push(angle + Math.PI / 2, angle - Math.PI / 2);
      const delay = this._animateAttack('sword', angle), cycle = ++this._slashCycle;
      dirs.forEach((a, i) => {
        const slash = { delay: delay + i * 0.05, angle: a, radius: R, damage: dmg, back: i > 0, flip: false, cycle };
        if (!slash.delay) this._slash(slash); else this.pendingSlashes.push(slash);
        if (this.lv('katana') >= 5) this.pendingSlashes.push({ ...slash, delay: delay + 0.2 + i * 0.05, flip: true });
      });
    }

    // --- shuriken: orbiting blades
    const ns = this.lv('shuriken') ? this.val('shuriken', 'count') : 0;
    if (ns) {
      this.shuriAngle += dt * this.val('shuriken', 'spin');
      const breathe = this.isSuper('shuriken') ? 1 + 0.45 * Math.max(0, Math.sin(g.time * 1.6)) : 1;
      const R = this.val('shuriken', 'radius') * breathe, dmg = this.val('shuriken', 'dmg');
      for (let i = 0; i < this.shuriken.length; i++) {
        const m = this.shuriken[i];
        m.visible = i < ns;
        if (!m.visible) continue;
        const a = this.shuriAngle + (i / ns) * Math.PI * 2;
        const x = p.x + Math.sin(a) * R, z = p.z + Math.cos(a) * R;
        m.position.set(x, 0.9, z);
        m.rotation.y += dt * 20;
        if (Math.random() < dt * 18 * Particles.budget) vfx.glow.emit(x, 0.9, z, 0, 0, 0, 0.18, 0.5, 0.6, 0.7, 1.6);
        for (const e of en.query(x, z, 0.35, this._tmp)) {
          if ((e.hitCd.shuri ?? 0) > g.time) continue;
          e.hitCd.shuri = g.time + 0.45;
          this.hit(e, dmg, Math.sin(a + 1.57), Math.cos(a + 1.57), 5);
          vfx.sparks.burst(x, 0.9, z, 5, { speed: 5, life: 0.25, size: 0.4, color: [1.4, 1.8, 2.4], grav: 0 });
        }
      }
    }

    // --- flying swords: from the technique and from relics, sharing one ring
    const fromTech = this.lv('flyswords') ? this.val('flyswords', 'count') : 0;
    const nf = Math.min(this.flySwords.length, fromTech + this.stats.flySwords);
    if (nf) {
      const lvf = this.lv('flyswords');
      this.swordAngle += dt * (lvf ? this.val('flyswords', 'spin') : 2.6);
      // Awakened swords burst outwards for a moment every three seconds.
      const burst = this.isSuper('flyswords') ? 1 + 1.2 * Math.max(0, Math.sin((g.time % 3) / 3 * Math.PI * 2 - 1.2)) ** 2 : 1;
      const R = (lvf ? this.val('flyswords', 'radius') : 1.7) * burst, dmg = lvf ? this.val('flyswords', 'dmg') : 18;
      for (let i = 0; i < this.flySwords.length; i++) {
        const m = this.flySwords[i];
        m.visible = i < nf;
        if (!m.visible) continue;
        const a = this.swordAngle + (i / nf) * Math.PI * 2;
        const x = p.x + Math.sin(a) * R, z = p.z + Math.cos(a) * R;
        m.position.set(x, 1.0 + Math.sin(g.time * 3 + i) * 0.08, z);
        // Blade along the orbit, turned flat towards the overhead camera so it reads as a sword.
        m.rotation.set(0, a + Math.PI / 2, 0); m.rotateZ(Math.PI / 2); m.rotateX(-0.25);
        if (Math.random() < dt * 30 * Particles.budget) vfx.glow.emit(x, 1.0, z, 0, 0.2, 0, 0.3, 0.6, 0.9, 1.3, 2.0);
        for (const e of en.query(x, z, 0.55, this._tmp)) {
          if ((e.hitCd.fsword ?? 0) > g.time) continue;
          e.hitCd.fsword = g.time + 0.4;
          this.hit(e, dmg, Math.sin(a + 1.57), Math.cos(a + 1.57), 4);
          vfx.sparks.burst(x, 1.0, z, 5, { speed: 5, life: 0.25, size: 0.4, color: [1.6, 2.0, 2.6], grav: 0 });
        }
      }
    } else if (this.flySwords[0].visible) for (const m of this.flySwords) m.visible = false;

    // --- quake: a shockwave around the hero, the awakened form sends a second wider wave
    if (this.lv('quake') && tick('quake')) {
      const wave = { delay: 0, radius: this.val('quake', 'radius'), damage: this.val('quake', 'dmg') };
      this._quake(wave);
      if (this.isSuper('quake')) this.pendingQuakes.push({ delay: 0.35, radius: wave.radius * 1.5, damage: wave.damage * 0.7 });
    }
    for (let i = this.pendingQuakes.length - 1; i >= 0; i--) {
      const q = this.pendingQuakes[i];
      if ((q.delay -= dt) <= 0) { this._quake(q); this.pendingQuakes.splice(i, 1); }
    }

    // --- foxfire: homing spirit flames
    if (this.lv('foxfire') && tick('foxfire')) {
      const n = this.val('foxfire', 'count');
      const used = this._usedTargets; used.clear();
      for (let i = 0; i < n; i++) {
        const sprite = this.fireSprites.find((s) => !s.visible);
        if (!sprite) break;
        const target = en.nearest(p.x, p.z, 16, used) || en.nearest(p.x, p.z, 16);
        if (!target) break;
        used.add(target);
        const a = p.face + (i - (n - 1) / 2) * 0.8 + Math.PI;
        sprite.visible = true; // Reserve before the next projectile is allocated.
        const fire = this.firePool.pop() || {};
        Object.assign(fire, { x: p.x, y: 1.3, z: p.z, vx: Math.sin(a) * 6, vz: Math.cos(a) * 6, target, targetId: target.id, life: 3, sprite, impacted: false });
        this.fires.push(fire);
      }
      if (n) g.audio.whoosh();
    }
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.life -= dt;
      if (!f.target?.alive || f.target.id !== f.targetId) { f.target = en.nearest(f.x, f.z, 12); f.targetId = f.target?.id; }
      if (f.target) {
        const dx = f.target.x - f.x, dz = f.target.z - f.z, d = Math.hypot(dx, dz) || 1;
        const steer = 1 - Math.exp(-8.4 * dt);
        f.vx += ((dx / d) * 14 - f.vx) * steer; f.vz += ((dz / d) * 14 - f.vz) * steer;
      }
      const oldX = f.x, oldZ = f.z;
      f.x += f.vx * dt; f.z += f.vz * dt;
      if (f.target && segmentDistanceSq(f.target.x, f.target.z, oldX, oldZ, f.x, f.z) < (0.35 + f.target.t.radius) ** 2) { f.life = 0; f.impacted = true; }
      if (f.sprite) { f.sprite.visible = true; f.sprite.position.set(f.x, f.y, f.z); f.sprite.scale.setScalar(g.calmEffects !== false ? 1 : 1 + Math.sin(g.time * 8) * 0.08); }
      if (Math.random() < dt * 48 * Particles.budget) vfx.glow.emit(f.x, f.y, f.z, (Math.random() - 0.5), 0.8, (Math.random() - 0.5), 0.35, 0.6, 0.7, 0.5, 2.2, { sizeEnd: 0.1 });
      if (f.life <= 0) {
        if (f.sprite) f.sprite.visible = false;
        this.fires[i] = this.fires[this.fires.length - 1]; this.fires.pop(); this.firePool.push(f);
        const aoe = this.val('foxfire', 'aoe'), dmg = this.val('foxfire', 'dmg');
        vfx.glow.burst(f.x, f.y, f.z, 14, { speed: 5, life: 0.4, size: 0.9, color: [0.8, 0.6, 2.4], grav: 0 });
        if (aoe) {
          vfx.ring(f.x, f.z, aoe, '#8f7bff', 0.35);
          vfx.flash(f.x, f.y, f.z, '#a98bff', aoe, 0.22);
          for (const e of en.query(f.x, f.z, aoe, this._tmp)) { const distance = Math.hypot(e.x - f.x, e.z - f.z) || 1; this.hit(e, dmg, (e.x - f.x) / distance, (e.z - f.z) / distance, 4); }
        } else if (f.impacted && f.target?.alive && f.target.id === f.targetId) this.hit(f.target, dmg, f.vx / 14, f.vz / 14, 4);
      }
    }

    // --- lightning: sky strike that chains between enemies
    if (this.lv('lightning') && tick('lightning')) {
      const hitSet = this._usedTargets; hitSet.clear();
      for (let strike = 0; strike < (this.isSuper('lightning') ? 2 : 1); strike++) {
      let cur = en.nearest(p.x, p.z, 13, hitSet);
      if (cur) {
        hitSet.add(cur);
        const dmg = this.val('lightning', 'dmg');
        const top = new THREE.Vector3(cur.x + 1.5, 14, cur.z - 2);
        const at = (e) => new THREE.Vector3(e.x, 0.8, e.z);
        vfx.bolt(top, at(cur), { width: 0.6, jitter: 0.9, color: '#b48cff' });
        vfx.bolt(top, at(cur), { width: 0.3, jitter: 0.6, color: '#ff2a4a' });
        vfx.lightFlash(cur.x, 3, cur.z, 0xb48cff, 90);
        vfx.ring(cur.x, cur.z, 2, '#b48cff', 0.3);
        vfx.flash(cur.x, 0.9, cur.z, '#d9c2ff', 2.2, 0.25);
        vfx.decals.add({ cell: CELL.scorch, x: cur.x, y: 0.03, z: cur.z, size: 1.6, rot: Math.random() * 6, color: '#1c1428', alpha: 0.4, dur: 1.5, hold: 0.4 });
        g.audio.zap();
        g.shake(0.15);
        for (let c = 0; c < this.val('lightning', 'chains'); c++) {
          this.hit(cur, dmg, 0, 0, 0);
          vfx.sparks.burst(cur.x, 0.8, cur.z, 10, { speed: 7, life: 0.35, size: 0.5, color: [1.6, 1.1, 2.4], grav: -6 });
          const next = en.nearest(cur.x, cur.z, 6, hitSet);
          if (!next) break;
          vfx.bolt(at(cur), at(next), { width: 0.35, jitter: 0.5, color: '#b48cff', dur: 0.25 });
          hitSet.add(next);
          cur = next;
        }
      }
      }
    }

    // --- aura: damaging, slowing petal circle
    if (this.lv('aura')) {
      const R = this.val('aura', 'radius');
      this.aura.visible = true;
      this.aura.position.set(p.x, 0.05, p.z);
      this.aura.scale.setScalar(R);
      this.auraUniforms.uTime.value = g.time;
      this.timers.aura = (this.timers.aura ?? 0) - dt;
      let pulse = this.auraUniforms.uI.value;
      if (this.timers.aura <= 0) {
        this.timers.aura = 0.35;
        const dmg = this.val('aura', 'dps') * 0.35;
        let any = false;
        let touched = 0;
        for (const e of en.query(p.x, p.z, R, this._tmp)) { this.hit(e, dmg, 0, 0, 0, true); e.slow = Math.max(e.slow, 0.5); any = true; touched++; }
        if (any) pulse = 1.3;
        if (touched && this.isSuper('aura') && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + Math.min(1.4, touched * 0.25));
      }
      this.auraUniforms.uI.value = Math.max(0.65, pulse - dt * 3);
      if (Math.random() < dt * 20) {
        const a = Math.random() * Math.PI * 2;
        vfx.petals.emit(p.x + Math.sin(a) * R, 0.2, p.z + Math.cos(a) * R, Math.cos(a) * 1.5, 1.4, -Math.sin(a) * 1.5, 0.8, 0.3, 0.9, 0.15, 0.22);
      }
    }
    this._updateNewWeapons(dt, tick);
    this._updateLoadoutWeapons(dt, tick);
  }

  _slash({ angle, radius, damage, back, flip, cycle }) {
    const g = this.game, p = g.player, vfx = g.vfx;
    const fx = Math.sin(angle), fz = Math.cos(angle);
    vfx.slash(p.x, 0.9, p.z, angle, radius, back ? '#b0202c' : '#efe6d8', 0.3, flip);
    for (let i = 0, count = Math.ceil(10 * Particles.budget); i < count; i++) {
      const a = angle + (Math.random() - 0.5) * 2.2, r = radius * (0.7 + Math.random() * 0.3);
      vfx.sparks.emit(p.x + Math.sin(a) * r, 0.9, p.z + Math.cos(a) * r, Math.sin(a) * 3, 1.5, Math.cos(a) * 3, 0.35, 0.45, 2.2, 0.3, 0.35, { grav: -4, drag: 3 });
    }
    if (!back && !flip) g.audio.slash();
    for (const enemy of g.enemies.query(p.x, p.z, radius, this._tmp)) {
      const dx = enemy.x - p.x, dz = enemy.z - p.z, d = Math.hypot(dx, dz) || 1;
      if ((dx * fx + dz * fz) / d <= 0) continue;
      const key = flip ? 'katanaEchoCycle' : 'katanaCycle';
      if (enemy.hitCd[key] === cycle) continue;
      enemy.hitCd[key] = cycle;
      this.hit(enemy, damage * (flip ? 0.35 : 1), dx / d, dz / d, flip ? 3 : 7);
    }
    if (this.isSuper('katana')) vfx.ring(p.x, p.z, radius * 1.15, '#c2283c', 0.35, 0.5);
  }

  _origin(angle) {
    const p = this.game.player, position = this._muzzle;
    if (p.getMuzzlePosition) p.getMuzzlePosition(position);
    else position.set(p.x + Math.sin(angle) * 0.55, 1.2, p.z + Math.cos(angle) * 0.55);
    return position;
  }

  _animateAttack(kind, angle) {
    const p = this.game.player, now = this.game.time || 0;
    const delay = p.getAttackDelay?.(kind) || 0;
    if (now >= this._actorAttackUntil) {
      if (p.attackWeapon) p.attackWeapon(kind, angle); else if (kind === 'sword') p.swing?.();
      this._actorAttackUntil = now + delay + 0.12;
    }
    return delay;
  }

  _queueShot(skill, kind, target) {
    if (!target || this.pendingShots.length >= 16) return;
    const p = this.game.player, angle = Math.atan2(target.x - p.x, target.z - p.z);
    const shot = this.shotPool.pop() || {};
    Object.assign(shot, { skill, kind, angle, target, targetId: target.id, delay: this._animateAttack(kind, angle) });
    if (shot.delay <= 0) { this._releaseShot(shot); this.shotPool.push(shot); }
    else this.pendingShots.push(shot);
  }

  _releaseShot(shot) {
    const g = this.game, p = g.player;
    let target = shot.target;
    if (!target?.alive || target.id !== shot.targetId) target = g.enemies.nearest(p.x, p.z, p.aimRange ?? (shot.kind === 'bow' ? 18 : 16));
    if (!target) return;
    const origin = this._origin(shot.angle), angle = Math.atan2(target.x - origin.x, target.z - origin.z), id = shot.skill;
    if (id === 'arcane') {
      const used = this._usedTargets; used.clear();
      const count = this.val(id, 'count');
      for (let i = 0; i < count; i++) {
        const victim = g.enemies.nearest(p.x, p.z, p.aimRange ?? 16, used) || target;
        const orb = this.orbs.find(item => !item.active);
        if (!victim || !orb) break;
        used.add(victim);
        const heading = Math.atan2(victim.x - origin.x, victim.z - origin.z) + (i - (count - 1) * 0.5) * .07;
        Object.assign(orb, { active: true, x: origin.x, y: origin.y, z: origin.z, vx: Math.sin(heading) * 16, vz: Math.cos(heading) * 16, target: victim, targetId: victim.id, life: 2.1, age: 0, damage: this.val(id, 'dmg'), radius: this.val(id, 'radius'), trail: 0 });
      }
      g.vfx.magicCircle(p.x, p.z, 1.2, '#b48cff', 0.55, p);
      g.vfx.flash(origin.x, origin.y, origin.z, '#d8c4ff', 1.1, 0.2);
      if (g.audio.magic) g.audio.magic(); else g.audio.whoosh();
      return;
    }
    if (id === 'spiritbeam') {
      const beam = this.beams.find(item => !item.active);
      if (beam) {
        Object.assign(beam, { active: true, angle, age: 0, tick: 0, duration: this.val(id, 'duration'), width: this.val(id, 'radius'), length: this.val(id, 'length'), damage: this.val(id, 'dmg') });
        beam.mesh.visible = true;
        if (g.audio.magic) g.audio.magic(); else g.audio.whoosh();
      }
      return;
    }
    const count = this.val(id, 'count');
    for (let i = 0; i < count; i++) {
      const spread = id === 'windvolley' ? (i - (count - 1) * .5) * .115 : i === 0 ? 0 : Math.ceil(i / 2) * (i % 2 ? 1 : -1) * .065;
      const remaining = id === 'ricochet' ? this.val(id, 'bounces') + 1 : id === 'explosivearrow' ? 1 : this.val(id, 'pierce') + 1;
      const arrow = this._launchArrow(id === 'windvolley' ? 'wind' : id === 'explosivearrow' ? 'explosive' : id, angle + spread, this.val(id, 'dmg'), remaining, origin);
      if (arrow) {
        const flight = Math.max(.04, Math.hypot(target.x - origin.x, target.z - origin.z) / arrow.speed);
        arrow.vy = (Math.max(.65, target.t.scale * .9) - origin.y) / flight;
      }
      if (arrow && id === 'explosivearrow') arrow.radius = this.val(id, 'radius');
    }
    g.vfx.muzzle(origin.x, origin.y, origin.z, angle, '#ffe2a0', 1.1);
    g.vfx.hit(origin.x, origin.y, origin.z, '#fff2c0', 0.8);
    if (g.audio.arrow) g.audio.arrow(); else g.audio.whoosh();
  }

  _launchArrow(kind, angle, damage, remaining, origin = this._origin(angle)) {
    const arrow = this.arrows.find(item => !item.active);
    if (!arrow) return null;
    const speed = kind === 'ricochet' ? 27 : 31;
    Object.assign(arrow, { active: true, kind, x: origin.x, y: origin.y, z: origin.z, vx: Math.sin(angle) * speed, vy: 0, vz: Math.cos(angle) * speed, speed, life: kind === 'ricochet' ? 2.6 : 1.0, angle, damage, remaining, trail: 0 });
    arrow.hit.clear();
    return arrow;
  }

  _areaHit(x, z, radius, damage, knock = 2) {
    const enemies = this.game.enemies.query(x, z, radius, this._areaTmp);
    for (const enemy of enemies) {
      const dx = enemy.x - x, dz = enemy.z - z, distance = Math.hypot(dx, dz) || 1;
      this.hit(enemy, damage, dx / distance, dz / distance, knock);
    }
  }

  _updateLoadoutWeapons(dt, tick) {
    const g = this.game, p = g.player, enemies = g.enemies, vfx = g.vfx;
    if (this.lv('arrow') && tick('arrow')) {
      const target = enemies.nearest(p.x, p.z, p.aimRange ?? 18);
      this._queueShot('arrow', 'bow', target);
    }
    if (this.lv('ricochet') && tick('ricochet')) {
      const target = enemies.nearest(p.x, p.z, p.aimRange ?? 18);
      this._queueShot('ricochet', 'bow', target);
    }
    for (const id of ['explosivearrow', 'windvolley']) {
      if (this.lv(id) && tick(id)) this._queueShot(id, 'bow', enemies.nearest(p.x, p.z, p.aimRange ?? 18));
    }
    if (this.lv('arrowrain') && tick('arrowrain')) {
      const used = this._usedTargets; used.clear();
      let cast = false;
      for (let i = 0; i < this.val('arrowrain', 'count'); i++) {
        const target = enemies.nearest(p.x, p.z, p.aimRange ?? 18, used), field = this.arrowFields.find(item => !item.active);
        if (!target || !field) break;
        used.add(target); cast = true;
        Object.assign(field, { active: true, x: target.x, z: target.z, age: -i * 0.08, next: 0.5, emitted: 0, shots: this.val('arrowrain', 'shots'), damage: this.val('arrowrain', 'dmg'), radius: this.val('arrowrain', 'radius') });
        field.marker.visible = true; field.marker.position.set(field.x, 0.095, field.z); field.marker.scale.setScalar(field.radius);
      }
      if (cast) this._animateAttack('bow', p.aimAngle ?? p.face);
    }
    for (const field of this.arrowFields) {
      if (!field.active) continue;
      field.age += dt;
      field.marker.material.opacity = field.age < 0.5 ? 0.18 + Math.max(0, field.age) * 0.32 : 0.34;
      while (field.age >= field.next && field.emitted < field.shots) {
        const angle = field.emitted * 2.399963, radius = field.radius * Math.sqrt((field.emitted + 0.5) / field.shots) * 0.85;
        this._muzzle.set(field.x + Math.sin(angle) * radius, 8, field.z + Math.cos(angle) * radius);
        const arrow = this._launchArrow('rain', 0, field.damage, 1, this._muzzle);
        if (arrow) { arrow.life = arrow.fallDuration = 0.32; arrow.startY = 8; arrow.radius = 1.25; }
        field.emitted++; field.next += 0.1;
      }
      if (field.emitted >= field.shots && field.age > field.next + 0.5) { field.active = false; field.marker.visible = false; }
    }

    for (const arrow of this.arrows) {
      if (!arrow.active) continue;
      const step = Math.min(dt, Math.max(0, arrow.life));
      arrow.life -= dt;
      if (arrow.kind === 'rain') {
        arrow.y = Math.max(0.15, arrow.startY * Math.max(0, arrow.life) / arrow.fallDuration);
        if (arrow.life <= 0) {
          this._areaHit(arrow.x, arrow.z, arrow.radius, arrow.damage, 1.5);
          vfx.sparks.burst(arrow.x, 0.25, arrow.z, 3, { speed: 2.2, life: 0.22, size: 0.18, color: [0.9, 0.65, 0.3], grav: -4 });
          arrow.active = false;
        }
        continue;
      }
      if (step <= 0) { arrow.active = false; continue; }
      const oldX = arrow.x, oldZ = arrow.z;
      arrow.x += arrow.vx * step; arrow.z += arrow.vz * step; arrow.y += arrow.vy * step;
      const candidates = enemies.query((oldX + arrow.x) * 0.5, (oldZ + arrow.z) * 0.5, arrow.speed * step * 0.5 + 0.12, this._tmp);
      // Travel order matters: an arrow must stop at a front enemy before a rear one.
      candidates.sort((a, b) => segmentHitFraction(a.x, a.z, a.t.radius + 0.1, oldX, oldZ, arrow.x, arrow.z) - segmentHitFraction(b.x, b.z, b.t.radius + 0.1, oldX, oldZ, arrow.x, arrow.z));
      for (const enemy of candidates) {
        if (arrow.hit.has(enemy.id)) continue;
        const fraction = segmentHitFraction(enemy.x, enemy.z, enemy.t.radius + 0.1, oldX, oldZ, arrow.x, arrow.z);
        if (!Number.isFinite(fraction)) continue;
        arrow.hit.add(enemy.id);
        if (arrow.kind === 'explosive') {
          arrow.x = oldX + (arrow.x - oldX) * fraction; arrow.z = oldZ + (arrow.z - oldZ) * fraction;
          this._areaHit(arrow.x, arrow.z, arrow.radius, arrow.damage, 5);
          vfx.explode(arrow.x, arrow.z, arrow.radius * 0.7, '#ffa040');
        } else this.hit(enemy, arrow.damage, arrow.vx / arrow.speed, arrow.vz / arrow.speed, arrow.kind === 'ricochet' ? 2 : 4);
        vfx.sparks.burst(enemy.x, 0.9, enemy.z, 3, { speed: 2.6, life: 0.2, size: 0.18, color: [1.0, 0.72, 0.4], grav: -3 });
        arrow.remaining--;
        if (arrow.remaining <= 0) { arrow.active = false; break; }
        if (arrow.kind === 'ricochet') {
          arrow.x = oldX + (arrow.x - oldX) * fraction; arrow.z = oldZ + (arrow.z - oldZ) * fraction;
          let next = null, distanceSq = 8 * 8;
          for (const candidate of enemies.query(enemy.x, enemy.z, 8, this._chainTmp)) {
            if (arrow.hit.has(candidate.id)) continue;
            const d = (candidate.x - enemy.x) ** 2 + (candidate.z - enemy.z) ** 2;
            if (d < distanceSq) { next = candidate; distanceSq = d; }
          }
          if (!next) { arrow.active = false; break; }
          arrow.angle = Math.atan2(next.x - arrow.x, next.z - arrow.z);
          arrow.vx = Math.sin(arrow.angle) * arrow.speed; arrow.vz = Math.cos(arrow.angle) * arrow.speed;
          arrow.vy = (Math.max(.65, next.t.scale * .9) - arrow.y) / Math.max(.04, Math.sqrt(distanceSq) / arrow.speed);
          arrow.damage *= 0.86;
          break;
        }
      }
      arrow.trail -= dt;
      if (arrow.active && arrow.trail <= 0) {
        arrow.trail = 0.06 / Math.max(0.2, Particles.budget);
        vfx.glow.emit(arrow.x, arrow.y, arrow.z, 0, 0.1, 0, 0.16, 0.16, arrow.kind === 'ricochet' ? 0.35 : 1, 0.8, 0.4);
      }
      if (arrow.life <= 0) arrow.active = false;
    }

    if (this.lv('arcane') && tick('arcane')) {
      this._queueShot('arcane', 'staff', enemies.nearest(p.x, p.z, p.aimRange ?? 16));
    }
    for (const orb of this.orbs) {
      if (!orb.active) continue;
      const step = Math.min(dt, Math.max(0, orb.life));
      orb.life -= dt; orb.age += dt;
      if (step <= 0) { orb.active = false; continue; }
      if (!orb.target?.alive || orb.target.id !== orb.targetId) { orb.target = enemies.nearest(orb.x, orb.z, 12); orb.targetId = orb.target?.id; }
      if (orb.target) {
        const dx = orb.target.x - orb.x, dz = orb.target.z - orb.z, distance = Math.hypot(dx, dz) || 1, steer = 1 - Math.exp(-5 * step);
        orb.vx += (dx / distance * 16 - orb.vx) * steer; orb.vz += (dz / distance * 16 - orb.vz) * steer;
        orb.y += (Math.max(.65, orb.target.t.scale * .9) - orb.y) * (1 - Math.exp(-step * 5));
      }
      const oldX = orb.x, oldZ = orb.z;
      orb.x += orb.vx * step; orb.z += orb.vz * step;
      const candidates = enemies.query((oldX + orb.x) * 0.5, (oldZ + orb.z) * 0.5, 16 * step * 0.5 + 0.2, this._tmp);
      let impact = null, first = Infinity;
      for (const enemy of candidates) {
        const fraction = segmentHitFraction(enemy.x, enemy.z, enemy.t.radius + 0.18, oldX, oldZ, orb.x, orb.z);
        if (fraction < first) { impact = enemy; first = fraction; }
      }
      if (impact) {
        orb.x = oldX + (orb.x - oldX) * first; orb.z = oldZ + (orb.z - oldZ) * first;
        this._areaHit(orb.x, orb.z, orb.radius, orb.damage, 2.5);
        vfx.ring(orb.x, orb.z, orb.radius, '#9a7bff', 0.3, 0.12);
        vfx.flash(orb.x, 0.9, orb.z, '#c9a8ff', orb.radius * 1.2, 0.2);
        vfx.glow.burst(orb.x, 0.9, orb.z, 6, { speed: 2.4, life: 0.3, size: 0.24, color: [0.35, 0.8, 1.1], grav: 0 });
        orb.active = false;
      }
      orb.trail -= dt;
      if (orb.active && orb.trail <= 0) {
        orb.trail = 0.06 / Math.max(0.2, Particles.budget);
        vfx.glow.emit(orb.x, orb.y, orb.z, 0, 0.15, 0, 0.25, 0.2, 0.3, 0.8, 1.1);
      }
      if (orb.life <= 0) orb.active = false; // Expiration never creates a remote explosion.
    }

    if (this.lv('runeburst') && tick('runeburst')) {
      const used = this._usedTargets; used.clear();
      let cast = false;
      for (let i = 0; i < this.val('runeburst', 'count'); i++) {
        const target = enemies.nearest(p.x, p.z, 15, used), rune = this.runes.find(item => !item.active);
        if (!target || !rune) break;
        used.add(target); cast = true;
        Object.assign(rune, { active: true, x: target.x, z: target.z, age: -i * 0.08, radius: this.val('runeburst', 'radius'), damage: this.val('runeburst', 'dmg') });
        rune.hit.clear(); rune.marker.visible = true;
        rune.marker.position.set(rune.x, 0.1, rune.z); rune.marker.scale.setScalar(rune.radius);
        rune.wave.position.set(rune.x, 0.115, rune.z); rune.wave.visible = false;
      }
      if (cast) { this._animateAttack('staff', p.aimAngle ?? p.face); if (g.audio.rune) g.audio.rune(); else g.audio.whoosh(); }
    }
    for (const rune of this.runes) {
      if (!rune.active) continue;
      rune.age += dt;
      if (rune.age < 0.65) {
        rune.marker.material.opacity = 0.16 + Math.max(0, rune.age) * 0.3;
        continue;
      }
      const progress = Math.min(1, (rune.age - 0.65) / 0.45), radius = Math.max(0.15, rune.radius * progress);
      rune.marker.material.opacity = (1 - progress) * 0.32;
      rune.wave.visible = true; rune.wave.scale.setScalar(radius); rune.wave.material.opacity = (1 - progress) * 0.58;
      for (const enemy of enemies.query(rune.x, rune.z, radius, this._tmp)) {
        if (rune.hit.has(enemy.id)) continue;
        rune.hit.add(enemy.id);
        const dx = enemy.x - rune.x, dz = enemy.z - rune.z, distance = Math.hypot(dx, dz) || 1;
        this.hit(enemy, rune.damage, dx / distance, dz / distance, 6);
        if (this.lv('runeburst') >= 3) enemy.slow = Math.max(enemy.slow, 1.1);
        vfx.sparks.burst(enemy.x, 0.6, enemy.z, 3, { speed: 2.1, life: 0.3, size: 0.22, color: [0.65, 0.5, 1.0], grav: -2 });
      }
      if (progress >= 1) { rune.active = false; rune.marker.visible = rune.wave.visible = false; }
    }
    this._updateAdvancedWeapons(dt, tick);
    this._drawProjectiles();
  }

  _drawProjectiles() {
    const pose = this._projectilePose;
    for (const { pool, mesh } of this._projectileBatches) {
      let count = 0;
      for (const item of pool) {
        if (!item.active) continue;
        pose.position.set(item.x, item.y, item.z);
        const orb = mesh === this.orbBatch;
        pose.rotation.set(item.kind === 'rain' ? Math.PI / 2 : orb ? 0 : Math.atan2(-item.vy, item.speed), orb ? item.age * 4 : item.angle, orb ? item.age * 2 : 0, 'YXZ');
        pose.scale.setScalar(item.kind === 'guard' ? 1.7 : orb ? 1.3 : item.kind === 'rain' ? 0.9 : 1);
        pose.updateMatrix(); mesh.setMatrixAt(count, pose.matrix);
        if (!orb) {
          this._projectileColor.set(item.kind === 'explosive' ? '#edb46c' : item.kind === 'ricochet' || item.kind === 'wind' ? '#a2d3b3' : '#ffffff');
          mesh.setColorAt(count, this._projectileColor);
        }
        count++;
      }
      mesh.count = count;
      if (count) {
        mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16); mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) { mesh.instanceColor.clearUpdateRanges(); mesh.instanceColor.addUpdateRange(0, count * 3); mesh.instanceColor.needsUpdate = true; }
      }
    }
  }

  _updateAdvancedWeapons(dt, tick) {
    const g = this.game, p = g.player, enemies = g.enemies, vfx = g.vfx;
    if (this.lv('spiritbeam') && tick('spiritbeam')) this._queueShot('spiritbeam', 'staff', enemies.nearest(p.x, p.z, this.val('spiritbeam', 'length')));
    for (const beam of this.beams) {
      if (!beam.active) continue;
      beam.age += dt; beam.tick -= dt;
      if (beam.age >= beam.duration) { beam.active = false; beam.mesh.visible = false; continue; }
      const nearest = enemies.nearest(p.x, p.z, beam.length);
      if (nearest) {
        const wanted = Math.atan2(nearest.x - p.x, nearest.z - p.z), delta = Math.atan2(Math.sin(wanted - beam.angle), Math.cos(wanted - beam.angle));
        beam.angle += delta * (1 - Math.exp(-dt * 3));
      }
      const origin = this._origin(beam.angle), endX = origin.x + Math.sin(beam.angle) * beam.length, endZ = origin.z + Math.cos(beam.angle) * beam.length;
      const fade = Math.min(1, beam.age * 8, (beam.duration - beam.age) * 7);
      beam.mesh.position.set(origin.x, Math.max(.5, origin.y), origin.z);
      beam.mesh.lookAt(endX, .9, endZ);
      beam.mesh.scale.set(beam.width * .65 * fade, beam.width * .65 * fade, Math.hypot(beam.length, .9 - beam.mesh.position.y));
      beam.mesh.material.opacity = fade * .34;
      if (beam.tick <= 0) {
        beam.tick += .16;
        for (const enemy of enemies.query((origin.x + endX) * .5, (origin.z + endZ) * .5, beam.length * .5 + beam.width, this._tmp)) {
          if (segmentDistanceSq(enemy.x, enemy.z, origin.x, origin.z, endX, endZ) > (beam.width + enemy.t.radius) ** 2) continue;
          this.hit(enemy, beam.damage, Math.sin(beam.angle), Math.cos(beam.angle), 1.2, true);
        }
      }
      if (Math.random() < dt * 15 * Particles.budget) {
        const t = Math.random();
        vfx.glow.emit(origin.x + (endX - origin.x) * t, .8, origin.z + (endZ - origin.z) * t, 0, .8, 0, .3, .24, .4, .9, .7);
      }
    }
    const count = this.lv('spiritguard') ? this.val('spiritguard', 'count') : 0;
    if (count) this.guardAngle += dt * this.val('spiritguard', 'spin');
    for (let i = 0; i < this.guards.length; i++) {
      const guard = this.guards[i];
      guard.active = i < count;
      if (!guard.active) continue;
      const angle = this.guardAngle + i / count * Math.PI * 2, radius = this.val('spiritguard', 'radius');
      guard.x = p.x + Math.sin(angle) * radius; guard.z = p.z + Math.cos(angle) * radius; guard.y = .9 + Math.sin(angle * 2) * .12; guard.age += dt;
      for (const enemy of enemies.query(guard.x, guard.z, .65, this._tmp)) {
        if ((enemy.hitCd.spiritguard || 0) > g.time) continue;
        enemy.hitCd.spiritguard = g.time + .42;
        this.hit(enemy, this.val('spiritguard', 'dmg'), Math.sin(angle), Math.cos(angle), 4);
        enemy.slow = Math.max(enemy.slow, .4);
        vfx.glow.burst(guard.x, guard.y, guard.z, 3, { speed: 1.5, life: .3, size: .2, color: [.5, 1, .65], grav: 0 });
      }
    }
  }

  _updateNewWeapons(dt, tick) {
    const g = this.game, p = g.player, en = g.enemies, vfx = g.vfx;
    if (this.lv('frost') && tick('frost')) {
      const radius = this.val('frost', 'radius');
      vfx.ring(p.x, p.z, radius, '#8de8ff', 0.65, 0.12);
      vfx.magicCircle(p.x, p.z, radius * 0.5, '#bff4ff', 0.7, p);
      vfx.ground.add({ cell: CELL.swirl, x: p.x, y: 0.15, z: p.z, size: radius * 0.6, size1: radius * 2, rot: Math.random() * 6, spin: -4, color: '#e5fbff', dur: 0.5, hold: 0.3, glow: 1.5 });
      vfx.sparks.burst(p.x, 0.4, p.z, 28, { speed: radius * 2, life: 0.65, size: 0.38, color: [0.6, 1.5, 2.2], grav: -2 });
      for (const e of en.query(p.x, p.z, radius, this._tmp)) {
        this.hit(e, this.val('frost', 'dmg'), 0, 0, 0);
        e.freeze = Math.max(e.freeze || 0, e.t.boss ? 0.2 : this.val('frost', 'freeze'));
        e.slow = Math.max(e.slow, this.val('frost', 'freeze') + 1.2);
      }
      g.audio.whoosh();
    }

    if (this.lv('kunai') && tick('kunai')) {
      const target = en.nearest(p.x, p.z, 18);
      if (target) {
        const baseAngle = Math.atan2(target.x - p.x, target.z - p.z), count = this.val('kunai', 'count');
        const ring = this.isSuper('kunai') ? 12 : 0;
        for (let i = 0; i < count + ring; i++) {
          const blade = this.kunai.find((item) => !item.active);
          if (!blade) break;
          const angle = i < count ? baseAngle + (i - (count - 1) * 0.5) * 0.13 : baseAngle + ((i - count) / ring) * Math.PI * 2;
          Object.assign(blade, { active: true, x: p.x, z: p.z, vx: Math.sin(angle) * 23, vz: Math.cos(angle) * 23, life: 1.0, remaining: this.val('kunai', 'pierce') + 1, damage: this.val('kunai', 'dmg') });
          blade.hit.clear(); blade.mesh.visible = true;
          blade.mesh.position.set(p.x, 0.85, p.z);
          blade.mesh.rotation.set(Math.PI / 2, angle, 0, 'YXZ');
        }
        g.audio.whoosh();
      }
    }
    for (const blade of this.kunai) {
      if (!blade.active) continue;
      blade.life -= dt;
      const oldX = blade.x, oldZ = blade.z;
      blade.x += blade.vx * dt; blade.z += blade.vz * dt;
      const travel = 23 * dt;
      for (const e of en.query((oldX + blade.x) * 0.5, (oldZ + blade.z) * 0.5, travel * 0.5 + 0.2, this._tmp)) {
        if (blade.hit.has(e.id) || segmentDistanceSq(e.x, e.z, oldX, oldZ, blade.x, blade.z) > (e.t.radius + 0.18) ** 2) continue;
        blade.hit.add(e.id);
        this.hit(e, blade.damage, blade.vx / 23, blade.vz / 23, 3);
        vfx.sparks.burst(e.x, 0.8, e.z, 4, { speed: 3, life: 0.2, size: 0.25, color: [0.6, 1.4, 1.9], grav: 0 });
        if (--blade.remaining <= 0) { blade.life = 0; break; }
      }
      blade.mesh.position.set(blade.x, 0.85, blade.z);
      if (Math.random() < dt * 22 * Particles.budget) vfx.glow.emit(blade.x, 0.85, blade.z, 0, 0, 0, 0.16, 0.3, 0.5, 1.1, 1.6);
      if (blade.life <= 0) { blade.active = false; blade.mesh.visible = false; }
    }

    if (this.lv('meteor') && tick('meteor')) {
      const used = this._usedTargets; used.clear();
      for (let i = 0; i < this.val('meteor', 'count'); i++) {
        const target = en.nearest(p.x, p.z, 15, used) || en.nearest(p.x, p.z, 15);
        const meteor = this.meteors.find((item) => !item.active);
        if (!target || !meteor) break;
        used.add(target);
        // Snapshot impact coordinates; recycled targets cannot redirect an airborne comet.
        const dx = p.x - target.x, dz = p.z - target.z, distance = Math.hypot(dx, dz) || 1;
        const lead = Math.min(distance * 0.3, target.t.speed * 0.35);
        Object.assign(meteor, { active: true, x: target.x + dx / distance * lead, z: target.z + dz / distance * lead, age: -i * 0.12, duration: 0.72, radius: this.val('meteor', 'radius'), damage: this.val('meteor', 'dmg') });
        meteor.marker.position.set(meteor.x, 0.08, meteor.z);
        meteor.marker.scale.setScalar(meteor.radius);
        meteor.marker.visible = false; meteor.mesh.visible = false;
        vfx.magicCircle(meteor.x, meteor.z, meteor.radius * 0.55, '#ff8a3c', meteor.duration + i * 0.12 + 0.1);
      }
    }
    for (const meteor of this.meteors) {
      if (!meteor.active) continue;
      meteor.age += dt;
      if (meteor.age < 0) continue;
      const progress = Math.min(1, meteor.age / meteor.duration);
      meteor.mesh.visible = true;
      meteor.mesh.position.set(meteor.x + (1 - progress) * 5, 0.5 + (1 - progress * progress) * 13, meteor.z - (1 - progress) * 2);
      meteor.mesh.rotation.x += dt * 3; meteor.mesh.rotation.z += dt * 5;
      meteor.marker.material.opacity = 0.25 + progress * 0.55;
      if (Math.random() < dt * 60 * Particles.budget) vfx.fire.emit(meteor.mesh.position.x, meteor.mesh.position.y, meteor.mesh.position.z, 1 + Math.random(), 1, -0.4, 0.35, 1.6, 2.2, 0.9, 0.35, { sizeEnd: 0.3 });
      if (progress < 1) continue;
      meteor.active = meteor.mesh.visible = meteor.marker.visible = false;
      vfx.explode(meteor.x, meteor.z, meteor.radius * 0.8, '#ff8a3c');
      g.shake(0.13); g.audio.boom();
      for (const e of en.query(meteor.x, meteor.z, meteor.radius, this._tmp)) {
        const dx = e.x - meteor.x, dz = e.z - meteor.z, distance = Math.hypot(dx, dz) || 1;
        this.hit(e, meteor.damage, dx / distance, dz / distance, 9);
      }
    }

    if (this.lv('vortex') && tick('vortex')) {
      const used = this._usedTargets; used.clear();
      for (let n = 0; n < (this.isSuper('vortex') ? 2 : 1); n++) {
      const target = en.nearest(p.x, p.z, 12, used), vortex = this.vortices.find((item) => !item.active);
      if (target) used.add(target);
      if (target && vortex) {
        Object.assign(vortex, { active: true, x: target.x, z: target.z, age: 0, tick: 0, duration: this.val('vortex', 'duration'), radius: this.val('vortex', 'radius'), damage: this.val('vortex', 'dps') * 0.25 });
        vortex.mesh.position.set(vortex.x, 0.09, vortex.z);
        vortex.mesh.scale.setScalar(vortex.radius); vortex.mesh.visible = true;
        g.audio.whoosh();
      }
      }
    }
    for (const vortex of this.vortices) {
      if (!vortex.active) continue;
      vortex.age += dt; vortex.tick -= dt;
      if (vortex.age >= vortex.duration) { vortex.active = false; vortex.mesh.visible = false; continue; }
      vortex.mesh.material.uniforms.uTime.value = vortex.age;
      vortex.mesh.material.uniforms.uAlpha.value = Math.min(1, vortex.age * 4, (vortex.duration - vortex.age) * 3);
      const pulse = vortex.tick <= 0;
      if (pulse) vortex.tick += 0.25;
      for (const e of en.query(vortex.x, vortex.z, vortex.radius, this._tmp)) {
        const dx = vortex.x - e.x, dz = vortex.z - e.z, distance = Math.hypot(dx, dz) || 1;
        const pull = Math.min(distance, 1) * dt * (e.t.boss ? 4 : 32);
        e.kx += dx / distance * pull; e.kz += dz / distance * pull;
        e.slow = Math.max(e.slow, 0.3);
        if (pulse) this.hit(e, vortex.damage, 0, 0, 0, true);
      }
      if (Math.random() < dt * 16 * Particles.budget) {
        const a = vortex.age * 6, r = vortex.radius * 0.7;
        vfx.glow.emit(vortex.x + Math.sin(a) * r, 0.3, vortex.z + Math.cos(a) * r, -Math.sin(a), 0.8, -Math.cos(a), 0.5, 0.5, 1.0, 0.4, 2.0);
      }
    }
  }
}

// Swept collision avoids tunneling through enemies when frames are slow.
export function segmentDistanceSq(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / lengthSq)) : 0;
  return (px - ax - t * dx) ** 2 + (pz - az - t * dz) ** 2;
}

/** First segment/circle intersection, used to resolve piercing in travel order. */
export function segmentHitFraction(px, pz, radius, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, ox = ax - px, oz = az - pz;
  const a = dx * dx + dz * dz, c = ox * ox + oz * oz - radius * radius;
  if (c <= 0) return 0;
  if (a <= 1e-12) return Infinity;
  const b = ox * dx + oz * dz, discriminant = b * b - a * c;
  if (discriminant < 0) return Infinity;
  const fraction = (-b - Math.sqrt(discriminant)) / a;
  return fraction >= 0 && fraction <= 1 ? fraction : Infinity;
}

/** A next-star description for cards; the UI renders the five-star row itself. */
// Numbers a level-up card compares as "now → next", in the order they are listed.
const STAT_ROWS = [['dmg', 'Урон', ''], ['dps', 'Урон в секунду', ''], ['count', 'Снарядов', ''], ['shots', 'Стрел в залпе', ''], ['chains', 'Прыжков молнии', ''],
  ['bounces', 'Отскоков', ''], ['pierce', 'Пробивает врагов', ''], ['radius', 'Радиус', ' м'], ['aoe', 'Взрыв', ' м'], ['length', 'Длина луча', ' м'],
  ['freeze', 'Заморозка', ' с'], ['duration', 'Длительность', ' с'], ['cd', 'Перезарядка', ' с']];

/** Stat rows for a weapon technique: values at the next level and, for an upgrade, at the current one. */
export function getAbilityStats(id, currentLv = 0, limit = 3) {
  const ability = Object.hasOwn(ABILITIES, id) ? ABILITIES[id] : null;
  const level = Math.max(0, Math.min(5, Math.floor(currentLv) || 0));
  if (!ability?.weapon || level >= 5) return [];
  const rows = [];
  for (const [key, label, unit] of STAT_ROWS) {
    const values = ability[key];
    if (!Array.isArray(values)) continue;
    const to = values[level], from = level ? values[level - 1] : null;
    if (!to || from === to) continue;
    rows.push({ key, label, unit, from, to, better: from === null ? null : key === 'cd' ? to < from : to > from });
  }
  return rows.slice(0, limit);
}

export function getAbilityUpgradeText(id, currentLv = 0) {
  const ability = Object.hasOwn(ABILITIES, id) ? ABILITIES[id] : null;
  if (!ability) return '';
  const level = Math.max(0, Math.min(5, Math.floor(currentLv) || 0));
  if (level >= 5) return 'Техника полностью освоена.';
  if (level === 4 && !ability.weapon && ability.super?.desc) return ability.super.desc;
  return ability.desc[ability.weapon ? level : 0];
}
