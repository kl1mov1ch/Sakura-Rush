// A class picks the hero model, the starting attack and the techniques offered during a run.
// Ids stay 'sword' / 'bow' / 'staff' so saves and ability families keep working.
export const LOADOUTS = Object.freeze({
  staff: Object.freeze({
    name: 'Волшебница', title: 'Девушка-онмёдзи с волшебным посохом', path: 'Магия печатей', glyph: '杖', emoji: '🔮',
    starter: 'arcane', color: '#7f73b8', start: 'Играть за волшебницу',
    role: 'Взрывы по площади',
    description: 'Волшебные искры взрываются в толпе. Позже — луч дракона и духи-хранители.',
    techniques: ['arcane', 'runeburst', 'spiritbeam', 'spiritguard'],
  }),
  bow: Object.freeze({
    name: 'Арбалетчица', title: 'Меткая охотница с арбалетом', path: 'Путь болта', glyph: '弓', emoji: '🏹',
    starter: 'arrow', color: '#5aa86e', start: 'Играть за арбалетчицу',
    role: 'Дальний бой',
    description: 'Бьёт из арбалета издалека, болты пробивают врагов насквозь. Позже — дождь болтов и взрывные болты.',
    techniques: ['arrow', 'ricochet', 'arrowrain', 'explosivearrow', 'windvolley'],
  }),
  sword: Object.freeze({
    name: 'Ниндзя', title: 'Быстрая куноити с катаной', path: 'Путь клинка', glyph: '刀', emoji: '🥷',
    starter: 'katana', color: '#d98c4f', start: 'Играть за ниндзя',
    role: 'Ближний бой',
    description: 'Режет всех рядом широкими взмахами. Позже — сюрикены и кунаи.',
    techniques: ['katana', 'kunai', 'shuriken'],
  }),
});

export const FAMILY_LABELS = Object.freeze({ sword: 'НИНДЗЯ', bow: 'АРБАЛЕТ', staff: 'МАГИЯ', shared: 'ДЛЯ ВСЕХ' });
export function isLoadout(id) { return Object.hasOwn(LOADOUTS, id); }
