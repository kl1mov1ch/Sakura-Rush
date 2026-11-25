// One movement pointer and a separate dash pointer support real multitouch.
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const DASH_KEYS = new Set(['Space', 'ShiftLeft', 'ShiftRight']);

export class Input {
  constructor() {
    this.keys = new Set();
    this.enabled = false;
    this.dashQueued = false;
    this.touch = null;
    this.vector = [0, 0];
    this.resetVersion = 0;
    this.hadTouch = matchMedia('(pointer: coarse)').matches;
    this.dashButton = document.getElementById('dashbtn');
    this.joystick = document.createElement('div');
    this.joystick.id = 'joystick';
    this.joystick.className = 'hidden';
    this.joystick.setAttribute('aria-hidden', 'true');
    this.joystick.innerHTML = '<div id="joystick-knob"></div>';
    document.body.appendChild(this.joystick);
    this.knob = this.joystick.firstElementChild;

    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
      if (this.enabled && (MOVE_KEYS.has(e.code) || DASH_KEYS.has(e.code))) e.preventDefault();
      if (e.repeat) return;
      if (this.enabled) {
        if (MOVE_KEYS.has(e.code)) this.keys.add(e.code);
        if (DASH_KEYS.has(e.code)) this.dashQueued = true;
      }
      this.onKey?.(e.code);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });

    addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      if (e.target.closest?.('#dashbtn')) {
        e.preventDefault();
        this.dashQueued = true;
        return;
      }
      if (e.pointerType === 'mouse' || this.touch || e.target.closest?.('.screen, .card, .btn, button, a, input, select')) return;
      e.preventDefault();
      this.hadTouch = true;
      this.dashButton?.classList.remove('hidden');
      this.touch = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, target: e.target };
      try { e.target.setPointerCapture?.(e.pointerId); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      this.joystick.style.left = `${e.clientX}px`;
      this.joystick.style.top = `${e.clientY}px`;
      this.knob.style.transform = 'translate(-50%, -50%)';
      this.joystick.classList.remove('hidden');
    }, { passive: false });
    addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.touch?.id) return;
      this.touch.x = e.clientX; this.touch.y = e.clientY;
      const dx = e.clientX - this.touch.x0, dy = e.clientY - this.touch.y0;
      const distance = Math.hypot(dx, dy), scale = distance > 52 ? 52 / distance : 1;
      this.knob.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
    });
    const end = (e) => { if (e.pointerId === this.touch?.id) this._releasePointer(); };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    addEventListener('lostpointercapture', end);
  }

  _releasePointer() {
    const touch = this.touch;
    this.touch = null;
    this.joystick.classList.add('hidden');
    if (touch?.target.hasPointerCapture?.(touch.id)) touch.target.releasePointerCapture(touch.id);
  }

  reset() {
    this.resetVersion++;
    this.keys.clear();
    this.dashQueued = false;
    this._releasePointer();
    this.vector[0] = this.vector[1] = 0;
  }

  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    this.reset();
    this.dashButton?.classList.toggle('hidden', !enabled || !this.hadTouch);
  }

  move() {
    const k = this.keys, out = this.vector;
    if (!this.enabled) { out[0] = out[1] = 0; return out; }
    let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
    let z = (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0);
    if (this.touch) {
      const dx = this.touch.x - this.touch.x0, dy = this.touch.y - this.touch.y0, distance = Math.hypot(dx, dy);
      const strength = Math.min(1, Math.max(0, (distance - 7) / 45));
      if (distance > 7) { x = dx / distance * strength; z = dy / distance * strength; }
    }
    const length = Math.max(1, Math.hypot(x, z));
    out[0] = x / length; out[1] = z / length;
    return out;
  }

  consumeDash() { const dash = this.enabled && this.dashQueued; this.dashQueued = false; return dash; }

  updateDash(cooldown) {
    if (!this.dashButton) return;
    const ready = Math.round(Math.max(0, 1 - cooldown / 1.1) * 100);
    if (ready === this._dashReady) return;
    this._dashReady = ready;
    this.dashButton.style.setProperty('--dash-ready', `${ready}%`);
    this.dashButton.classList.toggle('ready', ready === 100);
    this.dashButton.setAttribute('aria-label', ready === 100 ? 'Рывок готов' : 'Рывок перезаряжается');
  }
}
