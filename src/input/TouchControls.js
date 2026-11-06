const ACTIONS = [['Gear', 'gear'], ['Flaps -', 'flapsUp'], ['Flaps +', 'flapsDown'], ['Spoilers', 'spoiler'], ['Reverse', 'reverse'], ['Autobrake', 'autobrake'],
  ['Strobes', 'lights'], ['Ramp', 'ramp'], ['Cargo/Drop', 'cargo'], ['Drive', 'drive'], ['JATO', 'jato'], ['Camera', 'camera'], ['Map', 'map'], ['Tilt', 'tilt'],
  ['Tilt invert', 'tiltInvert'], ['Aircraft', 'nextAircraft'], ['Livery', 'nextLivery'], ['Time', 'time'], ['Weather', 'weather'], ['Wind +', 'windUp'],
  ['Wind -', 'windDown'], ['Wind dir', 'windTurn'], ['Units', 'units'], ['Sound', 'mute'], ['Clear route', 'clearRoute'], ['Fullscreen', 'fullscreen'], ['Reset', 'reset']];
const el = (t, c, p, h = '') => { const e = document.createElement(t); e.className = c; e.innerHTML = h; p.appendChild(e); return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Mobile UI + IInputSource: virtual stick (pitch/roll), throttle slider, yaw/brake buttons, quick buttons, and a menu drawer with every action. */
export class TouchControls {
  constructor() { this.ax = { pitch: 0, roll: 0 }; this.yl = 0; this.yr = 0; this.brk = 0; this.thr = null; }
  init(e) {
    this.e = e; const root = document.getElementById('hud');
    const coarse = matchMedia('(pointer: coarse)').matches || location.search.includes('touch');
    if (coarse) document.body.classList.add('coarse');
    const mb = el('button', '', root, '☰'); mb.id = 'menuBtn'; const dr = el('div', '', root); dr.id = 'drawer'; mb.onclick = () => dr.classList.toggle('open');
    for (const [l, a] of ACTIONS) el('button', '', dr, l).onclick = () => e.bus.emit('action', a);
    e.bus.on('action', a => { if (a === 'fullscreen') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); });
    e.input.sources.push(this);
    if (!coarse) return;
    const stick = el('div', 'ctl stick', root), knob = el('div', 'knob', stick); let sid = null;
    const upd = ev => { const r = stick.getBoundingClientRect(), h = r.width / 2; let x = (ev.clientX - r.left - h) / h, y = (ev.clientY - r.top - h) / h; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      this.ax.roll = Math.abs(x) < 0.08 ? 0 : x; this.ax.pitch = Math.abs(y) < 0.08 ? 0 : y; knob.style.transform = `translate(${x * (h - 30)}px,${y * (h - 30)}px)`; };
    stick.onpointerdown = ev => { sid = ev.pointerId; stick.setPointerCapture(sid); upd(ev); };
    stick.onpointermove = ev => { if (ev.pointerId === sid) upd(ev); };
    stick.onpointerup = stick.onpointercancel = () => { sid = null; this.ax.roll = this.ax.pitch = 0; knob.style.transform = ''; };
    const thr = el('div', 'ctl thr', root, '<span>THR</span>'); this.fill = el('div', 'fill', thr); let tid = null;
    const ut = ev => { const r = thr.getBoundingClientRect(); this.thr = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1); };
    thr.onpointerdown = ev => { tid = ev.pointerId; thr.setPointerCapture(tid); ut(ev); };
    thr.onpointermove = ev => { if (ev.pointerId === tid) ut(ev); };
    thr.onpointerup = thr.onpointercancel = () => { tid = null; this.thr = null; };
    const hold = (id, txt, key) => { const b = el('button', 'ctl tbtn', root, txt); b.id = id; b.onpointerdown = ev => { b.setPointerCapture(ev.pointerId); this[key] = 1; }; b.onpointerup = b.onpointercancel = () => { this[key] = 0; }; };
    hold('yawL', '◀', 'yl'); hold('yawR', '▶', 'yr'); hold('brk', 'BRK', 'brk');
    const q = el('div', 'quick', root); for (const [l, a] of [['GEAR', 'gear'], ['FLAP-', 'flapsUp'], ['FLAP+', 'flapsDown'], ['CAM', 'camera']]) el('button', '', q, l).onclick = () => e.bus.emit('action', a);
  }
  poll() { return { pitch: this.ax.pitch, roll: this.ax.roll, yaw: this.yr - this.yl, brake: this.brk, throttleSet: this.thr ?? undefined }; }
  update() { if (this.fill) this.fill.style.height = this.e.input.state.throttle * 100 + '%'; }
}
