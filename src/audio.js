// Tiny WebAudio synth: every sound is generated, no audio files.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.volume = 0.7; this.last = {}; }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.applyVolume();
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, len);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  toggle() { this.muted = !this.muted; this.applyVolume(); }
  applyVolume() { if (this.master) this.master.gain.value = this.muted ? 0 : 0.5 * this.volume; }

  _limit(name, ms) {
    const now = performance.now();
    if (now - (this.last[name] || 0) < ms) return true;
    this.last[name] = now;
    return false;
  }

  _tone(freq, dur, { type = 'sine', vol = 0.3, slide = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.onended = () => { o.disconnect(); g.disconnect(); };
    o.start(t); o.stop(t + dur + 0.02);
  }

  _noise(dur, { vol = 0.3, freq = 2000, q = 1, type = 'bandpass', sweep = 1 } = {}) {
    if (!this.ctx || this.muted || this.volume <= 0) return;
    const t = this.ctx.currentTime;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    f.frequency.exponentialRampToValueAtTime(freq * sweep, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); };
    s.start(t, Math.random() * 0.5); s.stop(t + dur);
  }

  slash() { this._noise(0.18, { vol: 0.35, freq: 1200, q: 2, sweep: 4 }); }
  arrow() {
    if (this._limit('arrow', 65)) return;
    this._noise(0.11, { vol: 0.12, freq: 2400, q: 1.5, sweep: 0.45 });
    this._tone(190, 0.08, { type: 'triangle', vol: 0.07, slide: 0.65 });
  }
  magic() {
    if (this._limit('magic', 90)) return;
    this._tone(420, 0.15, { vol: 0.1, slide: 1.8 });
    this._tone(840, 0.18, { type: 'triangle', vol: 0.035, slide: 0.65, delay: 0.025 });
  }
  rune() {
    if (this._limit('rune', 140)) return;
    this._tone(164, 0.35, { type: 'triangle', vol: 0.11, slide: 0.5 });
    this._noise(0.22, { vol: 0.12, freq: 600, type: 'lowpass', sweep: 0.35 });
  }
  whoosh() { if (!this._limit('wh', 120)) this._noise(0.3, { vol: 0.2, freq: 400, q: 3, sweep: 3 }); }
  hit() { if (!this._limit('hit', 45)) { this._noise(0.07, { vol: 0.25, freq: 3000, q: 1 }); this._tone(180, 0.08, { type: 'square', vol: 0.06, slide: 0.5 }); } }
  kill() { if (!this._limit('kill', 50)) this._tone(520 + Math.random() * 200, 0.12, { type: 'triangle', vol: 0.12, slide: 0.4 }); }
  pickup(combo) { if (!this._limit('pk', 30)) this._tone(880 * Math.pow(2, (combo % 12) / 12), 0.09, { type: 'sine', vol: 0.12 }); }
  zap() { this._noise(0.25, { vol: 0.4, freq: 5000, q: 0.7, type: 'highpass', sweep: 0.3 }); this._tone(90, 0.3, { type: 'sawtooth', vol: 0.12, slide: 0.5 }); }
  hurt() { if (!this._limit('hurt', 150)) this._tone(220, 0.2, { type: 'sawtooth', vol: 0.2, slide: 0.4 }); }
  dash() { this._noise(0.22, { vol: 0.3, freq: 600, q: 1.5, sweep: 5 }); }
  levelUp() { [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.35, { type: 'triangle', vol: 0.18, delay: i * 0.07 })); }
  pick() { this._tone(1047, 0.15, { type: 'sine', vol: 0.2 }); this._tone(1568, 0.25, { type: 'sine', vol: 0.15, delay: 0.06 }); }
  boss() { [110, 104, 98].forEach((f, i) => this._tone(f, 0.6, { type: 'sawtooth', vol: 0.18, delay: i * 0.35 })); }
  boom() { this._noise(0.6, { vol: 0.5, freq: 300, q: 0.5, type: 'lowpass', sweep: 0.2 }); this._tone(70, 0.5, { type: 'sine', vol: 0.4, slide: 0.4 }); }
}
