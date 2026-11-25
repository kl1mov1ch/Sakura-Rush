import { STORY_CHAPTERS, ENDLESS_ID, TALENTS, TALENT_BRANCHES, TALENT_GRID, SKINS, PRODUCTS, AD_COINS, Campaign, CLASSES, WEAPON_SKINS, WEAPON_MAX_LEVEL, weaponUpgradeCost, weaponLevelBonus, BOOSTS } from './progression.js';
import { LOADOUTS } from './loadouts.js';
import { abilityArt } from './art.js';
import { platform, BOARDS } from './platform.js';

const $ = id => document.getElementById(id);
const VIEWS = ['play', 'talents', 'forge', 'ranking', 'shop'];
const BRANCHES = new Map(TALENT_BRANCHES.map(branch => [branch.id, branch]));
// Advancement map cells, in pixels at zoom 1.
const CW = 108, CH = 76, PAD = 56;
const CLASS_NAMES = { staff: 'Волшебница', bow: 'Арбалетчица', sword: 'Ниндзя' };
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const fmt = n => Math.round(n).toLocaleString('ru-RU');
const time = s => { s = Math.max(0, Math.floor(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const pips = (rank, max) => `<span class="pips" aria-hidden="true">${Array.from({ length: max }, (_, i) => `<i class="${i < rank ? 'on' : ''}"></i>`).join('')}</span>`;
const reasons = {
  'insufficient-coins': 'Не хватает монет. Собирай их в забегах!',
  locked: 'Сначала открой предыдущие таланты на пути к этому.',
  'store-only': 'Это легендарное оружие продаётся в магазине.',
  'no-tokens': 'Жетонов нет. Их можно купить в магазине.',
  'daily-limit': 'На сегодня видео закончились. Попробуй монетами!',
  armed: 'Этот буст уже включён.',
  'max-rank': 'Этот талант уже прокачан до конца.',
  'run-active': 'Покупки доступны между забегами.',
};

export class Lobby {
  constructor(game, campaign) {
    this.game = game; this.campaign = campaign;
    this.view = 'play'; this.selectedTalent = 'heart'; this.previewSkin = campaign.selectedSkin; this.zoom = 1;
    this.selectedWeapon = campaign.weapon(campaign.selectedClass).skin;
    for (const cls of CLASSES) game.player.setWeaponLook?.(campaign.weapon(cls).look);
    this.board = 'time'; this.boardCache = {};
    this.storyChapter = campaign.chapter.endless ? campaign.state.unlockedChapter : campaign.selectedChapter;

    document.querySelectorAll('[data-lobby-tab]').forEach(button => button.onclick = () => { game.audio?.pick?.(); this.show(button.dataset.lobbyTab); });
    document.querySelectorAll('[data-mode]').forEach(button => button.onclick = () => this.selectChapter(button.dataset.mode === 'endless' ? ENDLESS_ID : this.storyChapter));
    document.querySelectorAll('[data-play-endless]').forEach(button => button.onclick = () => { this.selectChapter(ENDLESS_ID); this.show('play'); });
    $('chapter-list').onclick = e => { const b = e.target.closest('[data-chapter]'); if (b) this.selectChapter(+b.dataset.chapter); };
    $('loadout-options').onclick = e => { const b = e.target.closest('[data-loadout]'); if (b) game.selectLoadout(b.dataset.loadout); };
    $('loadout-options').onkeydown = e => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const ids = Object.keys(LOADOUTS), current = e.target.closest('[data-loadout]')?.dataset.loadout || game.selectedLoadout;
      const next = ids[(ids.indexOf(current) + step + ids.length) % ids.length];
      game.selectLoadout(next);
      document.querySelector(`[data-loadout="${next}"]`)?.focus();
    };

    $('talent-map').onclick = e => { if (this._dragged) return; const b = e.target.closest('[data-talent]'); if (b) { this.selectedTalent = b.dataset.talent; this.renderTalents(); } };
    this._initPan($('talent-scroll'));
    $('adv-zoom-in').onclick = () => this.setZoom(this.zoom + 0.2);
    $('adv-zoom-out').onclick = () => this.setZoom(this.zoom - 0.2);
    $('branch-chips').onclick = e => { const b = e.target.closest('[data-branch]'); if (b) this.scrollToNode(TALENTS.find(t => t.branch === b.dataset.branch && t.tier === 0)); };
    $('boost-bar').onclick = e => { const b = e.target.closest('[data-boost]'); if (b) this.armBoost(b.dataset.boost, b.dataset.via); };
    $('weapon-list').onclick = e => { const b = e.target.closest('[data-weapon]'); if (b) this.previewWeapon(b.dataset.weapon); };
    $('weapon-upgrade').onclick = () => this.upgradeWeapon();
    $('weapon-action').onclick = () => this.weaponAction();
    $('buy-talent').onclick = () => {
      const result = campaign.buyTalent(this.selectedTalent);
      if (result.ok) { game.audio?.pick?.(); this.message('✨ Готово! Талант работает со следующего забега.'); this.pulse(this.selectedTalent); }
      else this.message(reasons[result.reason] || 'Сейчас улучшение недоступно.');
      this.render();
    };

    document.querySelectorAll('[data-board]').forEach(button => button.onclick = () => { this.board = button.dataset.board; this.renderRanking(true); });
    $('ranking-auth').onclick = async () => { if (await platform.openAuth()) { this.boardCache = {}; this.renderRanking(true); } };

    $('product-list').onclick = e => { const b = e.target.closest('[data-product]'); if (b) this.buyProduct(b.dataset.product); };
    $('skin-list').onclick = e => {
      const b = e.target.closest('[data-skin]'); if (!b) return;
      this.previewSkin = b.dataset.skin; game.applySkin(this.previewSkin); game.player.play?.('Cheer'); this.renderSkins();
      // On phones the preview sits above the list: bring it into view.
      if (matchMedia('(max-width: 1000px)').matches) $('lobby-shop').scrollTo({ top: 0, behavior: 'smooth' });
    };
    $('skin-action').onclick = () => this.skinAction();
    $('restore-purchases').onclick = () => this.restorePurchases();
    $('confirm-ok').onclick = () => this._closeConfirm(true);
    $('confirm-cancel').onclick = () => this._closeConfirm(false);
    $('confirm').onkeydown = e => { if (e.key === 'Escape') this._closeConfirm(false); };
    this.render();
  }

  message(text) {
    const el = $('lobby-message');
    el.textContent = text; el.classList.toggle('show', !!text);
    clearTimeout(this._msgT); this._msgT = setTimeout(() => el.classList.remove('show'), 3200);
  }

  pulse(id) { requestAnimationFrame(() => document.querySelector(`[data-talent="${id}"]`)?.classList.add('pop')); }

  show(view) {
    if (!VIEWS.includes(view) || this.game.state !== 'title') return;
    this.view = view;
    document.querySelectorAll('.tab-bar [data-lobby-tab]').forEach(button => { const on = button.dataset.lobbyTab === view; button.classList.toggle('active', on); button.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('.lobby-view').forEach(panel => panel.classList.toggle('hidden', panel.id !== `lobby-${view}`));
    if (view !== 'shop') this.previewSkin = this.campaign.selectedSkin;
    this.game.applySkin(this.previewSkin);
    if (view === 'forge') this.previewWeapon(this.campaign.weapon(this.game.selectedLoadout || this.campaign.selectedClass).skin, true);
    else for (const cls of CLASSES) this.game.player.setWeaponLook?.(this.campaign.weapon(cls).look);
    document.body.dataset.lobbyView = view; this.game._renderDirty = true;
    this.render();
    if (view === 'ranking') this.renderRanking(true);
    if (view === 'talents') requestAnimationFrame(() => this.scrollToNode(this.campaign.getTalent(this.selectedTalent), false));
  }

  selectChapter(id) {
    const result = this.campaign.selectChapter(id);
    if (!result.ok) { if (result.reason === 'locked') this.message('Сначала пройди предыдущую главу.'); return; }
    if (id !== ENDLESS_ID) this.storyChapter = id;
    this.game.chapter = this.campaign.chapter; this.game.world.setChapter?.(this.game.chapter);
    this.game.audio?.pick?.(); this.game._renderDirty = true;
    this.render();
  }

  render() {
    document.querySelectorAll('[data-wallet]').forEach(el => el.textContent = fmt(this.campaign.coins));
    this.renderPlay(); this.renderBoosts(); this.renderTalents(); this.renderForge(); this.renderShop(); this.renderSkins(); this.renderMyRecords();
    $('talent-badge').classList.toggle('hidden', !TALENTS.some(item => this.campaign.talentStatus(item.id).ok));
  }

  // ------------------------------------------------------------------ play
  renderPlay() {
    const c = this.campaign, chapter = c.chapter, endless = !!chapter.endless, cls = this.game.selectedLoadout || c.selectedClass;
    document.querySelectorAll('[data-mode]').forEach(b => { const on = (b.dataset.mode === 'endless') === endless; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
    const best = c.state.endless;
    $('endless-best').textContent = best.bestTime ? `Рекорд: ${time(best.bestTime)} · ${fmt(best.bestKills)} ☠` : 'Попади в рейтинг!';
    $('chapter-list').classList.toggle('hidden', endless);
    $('chapter-list').innerHTML = STORY_CHAPTERS.map(item => {
      const locked = item.id > c.state.unlockedChapter, won = (c.state.chapters[item.id]?.wins || 0) > 0;
      return `<button class="chapter-dot ${item.id === chapter.id ? 'selected' : ''} ${locked ? 'locked' : ''} ${won ? 'won' : ''}" data-chapter="${item.id}" style="--c:${item.color}" ${locked ? 'disabled' : ''} aria-label="Глава ${item.numeral}: ${item.name}${locked ? ', закрыта' : ''}"><b>${locked ? '🔒' : item.numeral}</b>${won ? '<i>★</i>' : ''}</button>`;
    }).join('');
    $('chapter-name').textContent = endless ? '🌙 Бесконечная ночь' : `Глава ${chapter.numeral}: ${chapter.name}`;
    $('chapter-subtitle').textContent = chapter.subtitle;
    $('chapter-difficulty').textContent = endless ? 'Каждую минуту — новая волна, враги сильнее. Монеты ×1,25' : `10 минут · сила врагов ×${String(chapter.hpMul).replace('.', ',')} · монеты ×${String(chapter.coinMul).replace('.', ',')}`;

    $('loadout-options').innerHTML = Object.entries(LOADOUTS).map(([id, item], i) => `<button class="class-card ${id === cls ? 'selected' : ''}" data-loadout="${id}" style="--c:${item.color}" aria-pressed="${id === cls}"><span class="class-portrait">${abilityArt('class-' + id, item.emoji)}</span><span class="class-text"><b>${item.emoji} ${item.name}</b><small>${item.role}</small></span><span class="class-lvl" title="Звёзд в ветке класса">★ ${c.classLevel(id)}</span><kbd>${i + 1}</kbd></button>`).join('');
    const loadout = LOADOUTS[cls];
    $('loadout-description').textContent = loadout?.description || '';
    $('class-name').textContent = loadout ? `${loadout.emoji} ${loadout.name}` : '';
    $('class-level').textContent = `Ветка класса: ★ ${c.classLevel(cls)} / ${TALENTS.filter(t => t.branch === TALENT_BRANCHES.find(b => b.cls === cls)?.id).reduce((n, t) => n + t.maxRank, 0)} · ⚒ ${c.weapon(cls).level}`;
    const b = c.bonuses(cls);
    const parts = [
      b.maxHp && ['❤️', `+${b.maxHp}`, 'здоровья'],
      b.damage > 1 && ['⚔️', `+${Math.round((b.damage - 1) * 100)}%`, 'урона'],
      b.speed > 1 && ['👟', `+${Math.round((b.speed - 1) * 100)}%`, 'скорости'],
      b.armor && ['🛡️', `−${Math.round(b.armor * 100)}%`, 'урона по тебе'],
      b.cooldown < 1 && ['⏱️', `−${Math.round((1 - b.cooldown) * 100)}%`, 'перезарядки'],
      b.coinGain > 1 && ['🪙', `+${Math.round((b.coinGain - 1) * 100)}%`, 'монет'],
    ].filter(Boolean);
    $('permanent-bonuses').innerHTML = parts.length ? parts.map(([ico, v, label]) => `<span>${ico} <b>${v}</b> ${label}</span>`).join('') : '<span class="empty">Открывай таланты, чтобы герой стал сильнее 🌳</span>';
    $('title-record').textContent = endless && best.bestTime ? `Твой рекорд: ${time(best.bestTime)}` : '';
    $('startbtn').textContent = endless ? 'ИГРАТЬ ∞' : 'ИГРАТЬ';
  }

  // ---------------------------------------------------------------- boosts
  renderBoosts() {
    const c = this.campaign, tokens = c.state.boostTokens, ads = c.boostAdsLeft(), live = platform.available;
    const head = `<div class="boost-head"><b>Бусты на забег</b><small>${tokens ? `🎒 жетонов: ${tokens} · ` : ''}${live ? `🎬 видео сегодня: ${ads}` : 'видео работают в Яндекс Играх'}</small></div>`;
    $('boost-bar').innerHTML = head + '<div class="boost-row">' + BOOSTS.map(b => {
      const armed = c.isArmed(b.id);
      const pay = armed ? '<span class="armed">Включён ✔</span>'
        : `${live && ads ? `<button class="via ad" data-boost="${b.id}" data-via="ad" title="Посмотреть короткое видео">🎬</button>` : ''}${tokens ? `<button class="via token" data-boost="${b.id}" data-via="token" title="Потратить жетон">🎒</button>` : ''}<button class="via coins" data-boost="${b.id}" data-via="coins" ${c.coins < b.cost ? 'disabled' : ''}>${fmt(b.cost)} <span class="coin-ico"></span></button>`;
      return `<div class="boost ${armed ? 'on' : ''}" title="${esc(b.description)}"><span class="boost-glyph">${b.glyph}</span><span class="boost-text"><b>${b.name}</b><small>${b.description}</small></span><span class="boost-pay">${pay}</span></div>`;
    }).join('') + '</div>';
  }

  async armBoost(id, via) {
    if (this._buying) return;
    this._buying = true;
    try {
      if (via === 'ad') {
        if (!this.campaign.boostAdsLeft()) { this.message(reasons['daily-limit']); return; }
        if (!(await platform.showRewarded())) { this.message('Видео не досмотрено, буст не включён.'); return; }
      }
      const result = this.campaign.armBoost(id, via);
      if (result.ok) { this.game.audio?.pick?.(); this.message(`${this.campaign.getBoost(id).glyph} Буст включён на следующий забег!`); }
      else this.message(reasons[result.reason] || 'Буст сейчас недоступен.');
    } finally { this._buying = false; this.render(); }
  }

  // --------------------------------------------------------------- talents
  // A Minecraft-style advancement map: drag to pan, +/- to zoom, chips jump to a branch.
  setZoom(z) {
    const view = $('talent-scroll'), old = this.zoom;
    this.zoom = Math.min(1.4, Math.max(0.6, Math.round(z * 10) / 10));
    const cx = (view.scrollLeft + view.clientWidth / 2) / old, cy = (view.scrollTop + view.clientHeight / 2) / old;
    this.renderTalents();
    view.scrollLeft = cx * this.zoom - view.clientWidth / 2; view.scrollTop = cy * this.zoom - view.clientHeight / 2;
  }

  scrollToNode(node, smooth = true) {
    const view = $('talent-scroll');
    if (!node || !view) return;
    const z = this.zoom, x = (PAD + node.x * CW) * z, y = (PAD + node.y * CH) * z;
    view.scrollTo({ left: x - view.clientWidth * 0.35, top: y - view.clientHeight / 2, behavior: smooth ? 'smooth' : 'auto' });
  }

  _initPan(view) {
    let start = null;
    view.addEventListener('pointerdown', e => { if (e.button !== 0) return; start = { x: e.clientX, y: e.clientY, l: view.scrollLeft, t: view.scrollTop, id: e.pointerId }; this._dragged = false; });
    view.addEventListener('pointermove', e => {
      if (!start || e.pointerId !== start.id) return;
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!this._dragged && Math.hypot(dx, dy) > 6) { this._dragged = true; view.setPointerCapture(e.pointerId); view.classList.add('dragging'); }
      if (this._dragged) { view.scrollLeft = start.l - dx; view.scrollTop = start.t - dy; }
    });
    const end = () => { start = null; view.classList.remove('dragging'); setTimeout(() => { this._dragged = false; }, 0); };
    view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
  }

  renderTalents() {
    const c = this.campaign, node = c.getTalent(this.selectedTalent) || TALENTS[0], status = c.talentStatus(node.id);
    const cls = this.game.selectedLoadout || c.selectedClass, z = this.zoom;
    const px = item => (PAD + item.x * CW) * z, py = item => (PAD + item.y * CH) * z, half = 27 * z;
    const W = (PAD * 2 + (TALENT_GRID.cols - 1) * CW + 40) * z, H = (PAD * 2 + (TALENT_GRID.rows - 1) * CH) * z;
    // Elbow connectors like the advancement screen: out of the parent, along, then into the child.
    const lines = TALENTS.flatMap(item => item.requires.map(id => {
      const parent = c.getTalent(id), x1 = px(parent) + half, y1 = py(parent), x2 = px(item) - half, y2 = py(item);
      const mid = parent.tier < 0 ? x1 + 18 * z : Math.max(x1 + 10 * z, x2 - 16 * z);
      const color = BRANCHES.get(item.branch)?.color || '#ffd23f', on = c.rank(item.id) > 0 && c.rank(id) > 0;
      const d = x2 >= x1 ? `M${x1} ${y1}H${mid}V${y2}H${x2}` : `M${px(parent)} ${y1 + half}V${y2}H${x2}`;
      return `<path d="${d}" class="${on ? 'on' : ''}" style="--c:${color}"/>`;
    })).join('');
    const labels = TALENT_BRANCHES.map(branch => {
      const mine = !branch.cls || branch.cls === cls, first = TALENTS.find(t => t.branch === branch.id && t.tier === 0);
      const stars = TALENTS.filter(t => t.branch === branch.id).reduce((n, t) => n + c.rank(t.id), 0), all = TALENTS.filter(t => t.branch === branch.id).reduce((n, t) => n + t.maxRank, 0);
      return `<span class="adv-label ${mine ? '' : 'other'}" style="left:${px(first) - half}px;top:${py(first) - half - 22 * z}px;--c:${branch.color}">${branch.name} <small>${stars}/${all}</small></span>`;
    }).join('');
    const map = $('talent-map');
    map.style.width = `${W}px`; map.style.height = `${H}px`; map.style.setProperty('--z', z);
    map.innerHTML = `<svg width="${W}" height="${H}" aria-hidden="true">${lines}</svg>${labels}` + TALENTS.map(item => {
      const rank = c.rank(item.id), st = c.talentStatus(item.id), branch = BRANCHES.get(item.branch);
      const other = branch?.cls && branch.cls !== cls;
      const cl = ['adv-node', item.frame, rank && 'owned', rank >= item.maxRank && 'max', st.reason === 'locked' && 'locked', st.ok && 'can', item.id === node.id && 'selected', other && 'other'].filter(Boolean).join(' ');
      return `<button class="${cl}" style="left:${px(item)}px;top:${py(item)}px;--c:${branch?.color || '#ff5fa2'}" data-talent="${item.id}" title="${esc(item.name)}" aria-label="${esc(item.name)}, ${rank} из ${item.maxRank}"><span>${item.glyph}</span>${item.maxRank > 1 ? `<em>${rank}/${item.maxRank}</em>` : rank ? '<em>✔</em>' : ''}</button>`;
    }).join('');
    $('branch-chips').innerHTML = TALENT_BRANCHES.map(b => `<button data-branch="${b.id}" style="--c:${b.color}" class="${b.cls && b.cls !== cls ? 'other' : ''}">${b.name}</button>`).join('');

    const branch = BRANCHES.get(node.branch);
    $('talent-glyph').textContent = node.glyph;
    $('talent-glyph').className = `talent-glyph ${node.frame}`;
    $('talent-glyph').style.setProperty('--c', branch?.color || '#ff5fa2');
    $('talent-name').textContent = node.name;
    $('talent-branch').textContent = (node.frame === 'challenge' ? '🏆 Испытание · ' : '') + (branch ? `${branch.name} · ${branch.subtitle}` : 'Сердце дерева · для всех героев');
    $('talent-rank').innerHTML = pips(status.rank, node.maxRank);
    $('talent-description').textContent = node.description;
    const missing = node.requires.filter(id => !c.rank(id)).map(id => c.getTalent(id).name);
    $('talent-requirement').textContent = status.reason === 'locked' && missing.length ? `Сначала открой: ${missing.join(' и ')}` : branch?.cls && branch.cls !== cls ? `Работает, когда играешь за: ${LOADOUTS[branch.cls].name}` : '';
    const buy = $('buy-talent');
    buy.innerHTML = status.reason === 'max-rank' ? 'Прокачано полностью ✔' : `${node.maxRank === 1 ? 'Открыть' : 'Улучшить'} · ${fmt(status.cost)} <span class="coin-ico"></span>`;
    buy.disabled = !status.ok;
    $('talent-wallet-note').textContent = status.reason === 'insufficient-coins' ? `Не хватает ${fmt(status.cost - c.coins)} монет` : '';
    const total = Campaign.treeCost(), spent = c.spentOnTalents();
    $('tree-progress').style.width = `${Math.min(100, spent / total * 100).toFixed(1)}%`;
    $('tree-progress-text').textContent = `${Math.floor(spent / total * 100)}% · ${TALENTS.reduce((s, t) => s + c.rank(t.id), 0)} из ${TALENTS.reduce((s, t) => s + t.maxRank, 0)} звёзд`;
  }

  // ----------------------------------------------------------------- forge
  previewWeapon(id, quiet = false) {
    const look = this.campaign.getWeapon(id);
    if (!look) return;
    this.selectedWeapon = id;
    if (this.game.selectedLoadout !== look.cls) this.game.selectLoadout(look.cls);
    this.game.player.setWeaponLook?.(look);
    if (!quiet) { this.game.audio?.pick?.(); this.game.player.play?.(this.game.player.hero?.spec.awaken || 'Cheer'); }
    this.game._renderDirty = true;
    this.renderForge();
  }

  renderForge() {
    const c = this.campaign, look = c.getWeapon(this.selectedWeapon) || WEAPON_SKINS[0], w = c.weapon(look.cls);
    $('weapon-list').innerHTML = CLASSES.map(cls => {
      const own = c.weapon(cls);
      return `<div class="weapon-group"><h3>${LOADOUTS[cls].emoji} ${CLASS_NAMES[cls]} <small>ур. ${own.level}/${WEAPON_MAX_LEVEL}</small></h3><div class="weapon-row">` + WEAPON_SKINS.filter(x => x.cls === cls).map(x => {
        const have = c.state.ownedWeapons.includes(x.id), on = own.skin === x.id;
        const label = on ? 'В руках' : have ? 'Твоё' : x.product ? (esc(platform.price(x.product)) || 'Магазин') : `${fmt(x.cost)} <span class="coin-ico"></span>`;
        return `<button class="weapon ${x.id === look.id ? 'selected' : ''} ${have ? 'have' : 'locked'} ${x.premium ? 'premium' : ''}" data-weapon="${x.id}" style="--fx:${x.fx || '#c9b98f'}">${x.premium && !have ? '<i class="tag legend">ЛЕГЕНДА</i>' : ''}<span class="portrait">${abilityArt('weapon-' + x.id, '⚔')}</span><b>${x.name}</b><small>${label}</small></button>`;
      }).join('') + '</div></div>';
    }).join('');
    const have = c.state.ownedWeapons.includes(look.id), on = w.skin === look.id;
    $('weapon-art').innerHTML = abilityArt('weapon-' + look.id, '⚔');
    $('weapon-art').style.setProperty('--fx', look.fx || '#c9b98f');
    $('weapon-art').classList.toggle('premium', !!look.premium);
    $('weapon-name').textContent = look.name;
    $('weapon-class').textContent = `${LOADOUTS[look.cls].emoji} Оружие класса «${CLASS_NAMES[look.cls]}»${look.premium ? ' · легендарное' : ''}`;
    $('weapon-perk').textContent = look.perk ? `✨ ${look.perkText}` : look.perkText;
    const bonus = weaponLevelBonus(w.level), next = weaponLevelBonus(w.level + 1);
    $('weapon-level-text').textContent = `${w.level} / ${WEAPON_MAX_LEVEL}`;
    $('weapon-pips').innerHTML = Array.from({ length: WEAPON_MAX_LEVEL }, (_, i) => `<i class="${i < w.level ? 'on' : ''} ${i === 4 || i === 9 ? 'mile' : ''}"></i>`).join('');
    $('weapon-level-bonus').textContent = `Сейчас: +${Math.round(bonus.damage * 100)}% урона${bonus.crit ? ', +5% крита' : ''}${bonus.cooldown ? ', −10% перезарядки' : ''}. ` + (w.level < WEAPON_MAX_LEVEL ? `Дальше: +${Math.round(next.damage * 100)}%${!bonus.crit && next.crit ? ' и +5% крита' : ''}${!bonus.cooldown && next.cooldown ? ' и −10% перезарядки' : ''}` : 'Оружие прокачано до предела!');
    const cost = weaponUpgradeCost(w.level), up = $('weapon-upgrade');
    up.innerHTML = w.level >= WEAPON_MAX_LEVEL ? 'Максимальный уровень ✔' : `⚒ Прокачать · ${fmt(cost)} <span class="coin-ico"></span>`;
    up.disabled = w.level >= WEAPON_MAX_LEVEL || c.coins < cost;
    const action = $('weapon-action');
    action.innerHTML = on ? 'В руках ✔' : have ? 'Взять в руки' : look.product ? `⭐ Купить · ${esc(platform.price(look.product)) || 'в магазине'}` : `Купить · ${fmt(look.cost)} <span class="coin-ico"></span>`;
    action.disabled = on || (!have && !look.product && c.coins < look.cost) || (!have && look.product && !platform.available);
    $('weapon-note').textContent = !have && look.product && !platform.available ? 'Легендарное оружие продаётся в Яндекс Играх.' : !have && !look.product && c.coins < look.cost ? `Не хватает ${fmt(look.cost - c.coins)} монет` : 'Уровень оружия общий для всех его обликов.';
  }

  upgradeWeapon() {
    const look = this.campaign.getWeapon(this.selectedWeapon), result = this.campaign.upgradeWeapon(look.cls);
    if (result.ok) { this.game.audio?.levelUp?.(); this.message(`⚒ ${CLASS_NAMES[look.cls]}: оружие ${result.level} уровня!`); this.game.player.play?.('Cheer'); }
    else this.message(reasons[result.reason] || 'Сейчас прокачка недоступна.');
    this.render();
  }

  async weaponAction() {
    const c = this.campaign, look = c.getWeapon(this.selectedWeapon);
    if (!look) return;
    if (c.state.ownedWeapons.includes(look.id)) { c.equipWeapon(look.id); this.game.audio?.pick?.(); this.message(`${look.name} в руках!`); this.render(); return; }
    if (look.product) return this.buyProduct(look.product);
    const yes = await this.confirm({ art: abilityArt('weapon-' + look.id, '⚔'), title: look.name, text: look.perkText, price: `${fmt(look.cost)} <span class="coin-ico"></span>`, ok: 'Купить за монеты', note: `На счёте: ${fmt(c.coins)} монет` });
    if (!yes) return;
    const result = c.buyWeapon(look.id);
    if (result.ok) await this.receipt(abilityArt('weapon-' + look.id, '⚔'), `${look.name} твой!`, 'Оружие уже в руках героя.');
    else this.message(reasons[result.reason] || 'Сейчас покупка недоступна.');
    this.render();
  }

  // --------------------------------------------------------------- ranking
  async renderRanking(fetch = false) {
    document.querySelectorAll('[data-board]').forEach(b => b.classList.toggle('active', b.dataset.board === this.board));
    const list = $('ranking-list'), note = $('ranking-note'), board = this.board, unit = board === 'time' ? time : fmt;
    $('ranking-auth').classList.toggle('hidden', !platform.available || platform.authorized);
    if (!platform.available) {
      const mine = [...this.campaign.state.records].sort((a, b) => board === 'time' ? b.time - a.time : b.kills - a.kills).slice(0, 10);
      list.innerHTML = mine.length ? mine.map((r, i) => this.row(i + 1, 'Ты', unit(board === 'time' ? r.time : r.kills), r.cls, true)).join('') : '<li class="empty">Сыграй в бесконечный режим, чтобы появиться здесь!</li>';
      note.textContent = 'Общий рейтинг игроков работает в Яндекс Играх. Здесь — твои лучшие забеги.';
      return;
    }
    if (fetch || !this.boardCache[board]) {
      list.innerHTML = '<li class="empty">Загружаем таблицу…</li>';
      this.boardCache[board] = await platform.topScores(BOARDS[board], 10);
      if (this.board !== board) return;
    }
    const data = this.boardCache[board];
    if (!data?.entries?.length) { list.innerHTML = '<li class="empty">Пока никого нет. Стань первым!</li>'; note.textContent = ''; return; }
    list.innerHTML = data.entries.map(e => this.row(e.rank, e.name || 'Игрок', unit(e.score), e.extra, e.me, e.avatar)).join('');
    note.textContent = data.userRank ? `Твоё место: ${data.userRank}` : platform.authorized ? 'Сыграй в бесконечный режим, чтобы попасть в таблицу.' : 'Войди в аккаунт Яндекса, чтобы твои рекорды попали в таблицу.';
  }

  row(rank, name, score, cls, me, avatar) {
    const medal = ['🥇', '🥈', '🥉'][rank - 1] || rank;
    const hero = LOADOUTS[cls]?.emoji || '';
    const ava = avatar ? `<img src="${esc(avatar)}" alt="" loading="lazy">` : `<span>${esc(String(name).slice(0, 1).toUpperCase())}</span>`;
    return `<li class="${me ? 'me' : ''} ${rank <= 3 ? 'top' : ''}"><b class="place">${medal}</b><i class="ava">${ava}</i><span class="who">${esc(name)} ${hero}</span><b class="score">${score}</b></li>`;
  }

  renderMyRecords() {
    const s = this.campaign.state.endless;
    $('my-best').innerHTML = `<div><small>Дольше всех</small><b>⏱ ${time(s.bestTime)}</b></div><div><small>Больше всех</small><b>☠ ${fmt(s.bestKills)}</b></div><div><small>Забегов</small><b>🎮 ${fmt(s.runs)}</b></div>`;
    $('my-records').innerHTML = this.campaign.state.records.slice(0, 5).map((r, i) => `<li><b>${i + 1}</b><span>${LOADOUTS[r.cls]?.emoji || ''} ${time(r.time)}</span><span>☠ ${fmt(r.kills)}</span><small>${esc(r.date.split('-').reverse().slice(0, 2).join('.'))}</small></li>`).join('');
  }

  // ------------------------------------------------------------------ shop
  renderShop() {
    const c = this.campaign, left = c.adCoinsLeft(), live = platform.available;
    const priceOf = p => esc(platform.price(p.id)) || 'Купить';
    const pass = PRODUCTS.find(p => p.permanent), owned = c.state.pass;
    const passCard = `<button class="product pass ${owned ? 'owned' : ''}" data-product="${pass.id}" ${!live || owned ? 'disabled' : ''}><span class="glyph">${pass.glyph}</span><span class="head"><b>${pass.name}</b><small>Покупается один раз, работает всегда</small></span>
      <ul><li>+25% монет за каждый забег</li><li>Персонаж «Золотой самурай»</li><li>Восстанавливается на любом устройстве</li></ul>
      <span class="price ${owned ? 'owned-price' : ''}">${owned ? 'Уже твой ✔' : priceOf(pass)}</span></button>`;
    const ad = `<button class="product ad" data-product="ad" ${!live || !left ? 'disabled' : ''}><span class="glyph">🎬</span><b class="amount">+${AD_COINS} <span class="coin-ico"></span></b><small>Короткая реклама · осталось ${left} из 5 сегодня</small><span class="price">Смотреть</span></button>`;
    const packs = PRODUCTS.filter(p => p.coins).map(p => `<button class="product" data-product="${p.id}" ${!live ? 'disabled' : ''}>${p.badge ? `<i class="badge-tag">${p.badge}</i>` : ''}<span class="glyph">${p.glyph}</span><b>${p.name}</b><small class="amount">${fmt(p.coins)} <span class="coin-ico"></span></small><span class="price">${priceOf(p)}</span></button>`).join('');
    const tokens = PRODUCTS.filter(p => p.tokens).map(p => `<button class="product boost-pack" data-product="${p.id}" ${!live ? 'disabled' : ''}><i class="badge-tag">${p.badge}</i><span class="glyph">${p.glyph}</span><b>${p.name}</b><small class="amount">${esc(p.description)}${c.state.boostTokens ? ` · у тебя ${c.state.boostTokens}` : ''}</small><span class="price">${priceOf(p)}</span></button>`).join('');
    const weapons = PRODUCTS.filter(p => p.weapon).map(p => {
      const look = c.getWeapon(p.weapon), have = c.state.ownedWeapons.includes(p.weapon);
      return `<button class="product legend ${have ? 'owned' : ''}" data-product="${p.id}" ${!live || have ? 'disabled' : ''} style="--fx:${look.fx}"><span class="portrait">${abilityArt('weapon-' + look.id, p.glyph)}</span><b>${p.name}</b><small class="amount">${esc(look.perkText)}</small><span class="price ${have ? 'owned-price' : ''}">${have ? 'Уже твоё ✔' : priceOf(p)}</span></button>`;
    }).join('');
    $('product-list').innerHTML = passCard + ad + packs + `<h3 class="store-sub">Легендарное оружие</h3>` + weapons + tokens;
    $('restore-purchases').classList.toggle('hidden', !live);
    $('shop-note').textContent = live ? 'Оплата проходит в окне Яндекса. Монеты тратятся на таланты и персонажей, всё это можно заработать и в игре.' : 'Покупки и награды за рекламу работают в Яндекс Играх.';
  }

  /** Purchase dialog. Resolves true when the player confirms; `ok: null`-less receipts only close. */
  confirm({ art = '', title, text = '', price = '', ok = 'Купить', cancel = 'Отмена', note = '', done = false }) {
    $('confirm-art').innerHTML = art; $('confirm-title').textContent = title; $('confirm-text').textContent = text;
    $('confirm-price').innerHTML = price; $('confirm-ok').textContent = ok; $('confirm-note').textContent = note;
    $('confirm-cancel').classList.toggle('hidden', !cancel); if (cancel) $('confirm-cancel').textContent = cancel;
    $('confirm').querySelector('.confirm-panel').classList.toggle('done', done);
    $('confirm').classList.remove('hidden'); $('confirm-ok').focus();
    return new Promise(resolve => { this._confirmResolve = resolve; });
  }

  _closeConfirm(value) {
    $('confirm').classList.add('hidden');
    const resolve = this._confirmResolve; this._confirmResolve = null; resolve?.(value);
  }

  receipt(art, title, text) { this.game.audio?.pick?.(); return this.confirm({ art, title, text, ok: 'Отлично!', cancel: null, done: true }); }

  async buyProduct(id) {
    if (this._buying) return;
    this._buying = true;
    try {
      if (id === 'ad') {
        if (await platform.showRewarded()) { const r = this.campaign.grantAdCoins(); if (r.ok) await this.receipt('🎁', `+${r.amount} монет`, 'Спасибо за просмотр!'); }
        return;
      }
      const product = this.campaign.getProduct(id);
      if (!product) return;
      const price = esc(platform.price(id));
      const look = product.weapon && this.campaign.getWeapon(product.weapon);
      const yes = await this.confirm({ art: look ? abilityArt('weapon-' + look.id, product.glyph) : `<span>${product.glyph}</span>`, title: product.name,
        text: look ? `Навсегда: ${look.perkText}. Огненный след и свечение в бою.` : product.tokens ? product.description : product.permanent ? '+25% монет навсегда и персонаж «Золотой самурай».' : `${fmt(product.coins)} монет сразу на счёт.`,
        price: price ? `${price}` : '', ok: price ? `Оплатить ${price}` : 'Перейти к оплате', note: 'Оплата откроется в окне Яндекса. Деньги списываются только после подтверждения там.' });
      if (!yes) return;
      const purchase = await platform.purchase(id);
      if (!purchase) { this.message('Покупка отменена. Деньги не списаны.'); return; }
      const result = this.campaign.creditPurchase(purchase.productID || id, purchase.purchaseToken);
      if (result.ok || result.reason === 'already-credited') {
        if (!product.permanent) await platform.consume(purchase.purchaseToken);
        if (result.ok) await this.receipt(look ? abilityArt('weapon-' + look.id, product.glyph) : product.glyph, 'Покупка прошла!', look ? `${look.name} уже в руках героя. Загляни в кузницу!` : product.tokens ? `+${product.tokens} жетонов бустов.` : product.permanent ? 'Золотой пропуск активирован. Золотой самурай уже ждёт в магазине.' : `+${fmt(product.coins)} монет на счёте.`);
        if (result.ok && look) for (const cls of CLASSES) this.game.player.setWeaponLook?.(this.campaign.weapon(cls).look);
      }
    } finally { this._buying = false; this.render(); }
  }

  /** Credits paid but unprocessed purchases and restores the permanent pass. Returns how many were applied. */
  async restorePurchases(silent = false) {
    let applied = 0;
    for (const purchase of await platform.pendingPurchases()) {
      const product = this.campaign.getProduct(purchase.productID);
      if (!product) continue;
      if (product.permanent) { if (this.campaign.restorePermanent(product.id)) applied++; continue; }
      const res = this.campaign.creditPurchase(purchase.productID, purchase.purchaseToken);
      if (res.ok) applied++;
      if (res.ok || res.reason === 'already-credited') await platform.consume(purchase.purchaseToken);
    }
    this.render();
    if (!silent) this.message(applied ? `Восстановлено покупок: ${applied}` : 'Все покупки уже на месте.');
    return applied;
  }

  async skinAction() {
    const c = this.campaign, skin = c.getSkin(this.previewSkin);
    if (!skin) return;
    const owned = c.state.ownedSkins.includes(skin.id);
    if (!owned && skin.pass && !c.state.pass && c.coins < skin.cost) return this.buyProduct('golden_pass');
    if (!owned) {
      const yes = await this.confirm({ art: abilityArt('skin-' + skin.id, '🥷'), title: skin.name, text: 'Купить персонажа? Его сможет надеть любой класс.', price: `${fmt(skin.cost)} <span class="coin-ico"></span>`, ok: 'Купить за монеты', note: `На счёте: ${fmt(c.coins)} монет` });
      if (!yes) return;
    }
    const result = owned ? c.equipSkin(skin.id) : c.buySkin(skin.id);
    if (result.ok) {
      if (!owned) { c.equipSkin(skin.id); this.render(); await this.receipt(abilityArt('skin-' + skin.id, '🥷'), `${skin.name} твой!`, 'Персонаж уже надет. Выбери класс и в бой.'); }
      else { this.game.audio?.pick?.(); this.message('Персонаж выбран!'); }
    } else this.message(reasons[result.reason] || 'Этот персонаж пока недоступен.');
    this.render();
  }

  renderSkins() {
    const c = this.campaign, selected = c.getSkin(this.previewSkin) || SKINS[0], owned = c.state.ownedSkins.includes(selected.id), equipped = c.selectedSkin === selected.id;
    $('skin-list').innerHTML = SKINS.map(skin => {
      const have = c.state.ownedSkins.includes(skin.id), art = skin.id === 'classic' ? abilityArt('class-' + (this.game.selectedLoadout || c.selectedClass)) : abilityArt('skin-' + skin.id, '🥷');
      const label = c.selectedSkin === skin.id ? 'Выбран' : have ? 'Твой' : `${fmt(skin.cost)} <span class="coin-ico"></span>`;
      return `<button class="skin ${skin.id === selected.id ? 'selected' : ''} ${have ? 'have' : 'locked'}" data-skin="${skin.id}" aria-pressed="${skin.id === selected.id}" style="--a:${skin.swatches[0]}55">${skin.pass && !have ? '<i class="tag pass">⭐ ПРОПУСК</i>' : ''}<span class="portrait">${art}</span><b>${skin.name}</b><small>${label}</small></button>`;
    }).join('');
    $('skin-name').textContent = selected.name;
    $('skin-description').textContent = selected.description;
    const action = $('skin-action'), short = !owned && c.coins < selected.cost;
    const viaPass = !owned && selected.pass && !c.state.pass && short && platform.available;
    action.innerHTML = equipped ? 'Выбран ✔' : owned ? 'Выбрать' : viaPass ? '⭐ Получить с пропуском' : `Купить · ${fmt(selected.cost)} <span class="coin-ico"></span>`;
    action.disabled = equipped || (short && !viaPass);
    $('skin-note').textContent = viaPass ? `Или накопи ${fmt(selected.cost)} монет` : short ? `Не хватает ${fmt(selected.cost - c.coins)} монет` : 'Персонаж меняет только внешний вид, сила остаётся прежней.';
  }
}
