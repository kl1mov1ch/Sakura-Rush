// Yandex Games integration. The SDK script (/sdk.js) exists only when the game runs on
// Yandex Games; everywhere else (offline file, artifact, localhost) every call is a no-op
// and ads resolve immediately, so the game never waits on a missing platform.
const RECORD_KEY = 'sakura-rush-record';
const SAVE_KEY = 'sakura-rush-campaign';
// Leaderboard technical names; create boards with exactly these names in the console.
export const BOARDS = Object.freeze({ time: 'survival', kills: 'kills' });

export const platform = {
  ysdk: null,
  player: null,
  payments: null,
  catalog: [],
  adOpen: false,
  _gameplay: false,
  _handlers: { pause: [], resume: [] },

  get available() { return !!this.ysdk; },
  get authorized() { try { return this.player?.getMode?.() !== 'lite' && !!this.player; } catch { return false; } },
  get lang() { try { return this.ysdk?.environment?.i18n?.lang || 'ru'; } catch { return 'ru'; } },

  async init() {
    if (typeof window.YaGames === 'undefined') return;
    try {
      this.ysdk = await Promise.race([window.YaGames.init(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 5000))]);
    } catch (err) {
      console.warn('Yandex Games SDK unavailable:', err?.message || err);
      return;
    }
    // The platform pauses the game for its own overlays (purchase dialogs, auth, etc.).
    this.ysdk.on?.('game_api_pause', () => this._emit('pause'));
    this.ysdk.on?.('game_api_resume', () => this._emit('resume'));
    try { this.player = await this.ysdk.getPlayer({ scopes: false }); } catch { this.player = null; }
    try {
      this.payments = await this.ysdk.getPayments({ signed: false });
      this.catalog = await this.payments.getCatalog();
    } catch { this.payments = null; this.catalog = []; }
  },

  on(event, fn) { this._handlers[event].push(fn); },
  _emit(event) { for (const fn of this._handlers[event]) fn(); },

  /** Tell the platform the game finished loading and can be played. */
  loadingReady() { try { this.ysdk?.features?.LoadingAPI?.ready(); } catch { /* optional feature */ } },

  /** Gameplay markers: active play vs menus, pauses and level-up screens. */
  gameplay(active) {
    if (active === this._gameplay) return;
    this._gameplay = active;
    try { this.ysdk?.features?.GameplayAPI?.[active ? 'start' : 'stop'](); } catch { /* optional feature */ }
  },

  /** Interstitial between runs. Resolves when closed (or at once without the SDK). */
  showFullscreen() {
    if (!this.ysdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      const done = (shown) => { if (this.adOpen) { this.adOpen = false; this._emit('resume'); } resolve(shown); };
      try {
        this.ysdk.adv.showFullscreenAdv({ callbacks: {
          onOpen: () => { this.adOpen = true; this._emit('pause'); },
          onClose: (shown) => done(shown),
          onError: () => done(false),
          onOffline: () => done(false),
        } });
      } catch { done(false); }
    });
  },

  /** Rewarded video. Resolves true only when the player earned the reward. */
  showRewarded() {
    if (!this.ysdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      let rewarded = false;
      const done = () => { if (this.adOpen) { this.adOpen = false; this._emit('resume'); } resolve(rewarded); };
      try {
        this.ysdk.adv.showRewardedVideo({ callbacks: {
          onOpen: () => { this.adOpen = true; this._emit('pause'); },
          onRewarded: () => { rewarded = true; },
          onClose: done,
          onError: done,
        } });
      } catch { done(); }
    });
  },

  // ------------------------------------------------------------ purchases
  /** Price label for a product from the console catalog, e.g. "39 ян". */
  price(id) {
    const item = this.catalog.find(product => product.id === id);
    return item ? item.price || `${item.priceValue} ${item.priceCurrencyCode || ''}`.trim() : '';
  },

  /** Opens the Yandex payment dialog. Resolves with the purchase or null. */
  async purchase(id) {
    if (!this.payments) return null;
    try { return await this.payments.purchase({ id }); } catch { return null; }
  },

  /** Consumable products must be consumed after they were credited, or Yandex keeps them pending. */
  async consume(token) {
    try { await this.payments?.consumePurchase(token); return true; } catch { return false; }
  },

  /** Purchases that were paid but never processed (closed tab, lost network). */
  async pendingPurchases() {
    if (!this.payments) return [];
    try { return await this.payments.getPurchases(); } catch { return []; }
  },

  // ---------------------------------------------------------- leaderboards
  async openAuth() {
    if (!this.ysdk?.auth) return false;
    try { await this.ysdk.auth.openAuthDialog(); this.player = await this.ysdk.getPlayer({ scopes: false }); return this.authorized; } catch { return false; }
  },

  async _boards() {
    if (this.ysdk?.leaderboards?.setScore) return this.ysdk.leaderboards; // SDK v2 API
    if (!this.ysdk?.getLeaderboards) return null;
    this._lb ??= this.ysdk.getLeaderboards().catch(() => null);
    return this._lb;
  },

  async submitScore(board, score, extra = '') {
    if (!this.authorized || !(score > 0)) return false;
    try {
      const lb = await this._boards();
      if (!lb) return false;
      if (lb.setScore) await lb.setScore(board, Math.floor(score), extra);
      else await lb.setLeaderboardScore(board, Math.floor(score), extra);
      return true;
    } catch { return false; }
  },

  /** Top entries plus the player's own place, normalised for the menu. */
  async topScores(board, quantityTop = 10) {
    try {
      const lb = await this._boards();
      if (!lb) return null;
      const options = { quantityTop, includeUser: this.authorized, quantityAround: 2 };
      const res = lb.getEntries ? await lb.getEntries(board, options) : await lb.getLeaderboardEntries(board, options);
      return {
        userRank: res.userRank || 0,
        entries: (res.entries || []).map(e => ({ rank: e.rank, score: e.score, name: e.player?.publicName || 'Игрок', avatar: e.player?.getAvatarSrc?.('small') || '', extra: e.extraData || '', me: !!res.userRank && e.rank === res.userRank })),
      };
    } catch { return null; }
  },

  // ------------------------------------------------------------ cloud saves
  /** Best run: Yandex cloud save when available, browser storage otherwise. */
  async loadRecord() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(RECORD_KEY) || 'null'); } catch { local = null; }
    try {
      const data = await this.player?.getData([RECORD_KEY]);
      const cloud = data?.[RECORD_KEY];
      if (cloud && (!local || cloud.time > local.time)) return cloud;
    } catch { /* cloud saves are optional */ }
    return local;
  },

  async saveRecord(record) {
    try { localStorage.setItem(RECORD_KEY, JSON.stringify(record)); } catch { /* private mode */ }
    try { await this.player?.setData({ [RECORD_KEY]: record }, true); } catch { /* cloud saves are optional */ }
  },

  /** Campaign progress (coins, talents, skins) mirrored to the player's cloud data. */
  async loadProgress() {
    try { const data = await this.player?.getData([SAVE_KEY]); return data?.[SAVE_KEY] || null; } catch { return null; }
  },

  saveProgress(state) {
    if (!this.player) return;
    clearTimeout(this._saveT);
    // setData is rate limited; coalesce bursts of pickups into one write.
    this._saveT = setTimeout(() => { try { this.player.setData({ [SAVE_KEY]: state }, false); } catch { /* optional */ } }, 1500);
  },
};
