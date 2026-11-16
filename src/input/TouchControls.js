const el = (t, c, p, h = '') => { const e = document.createElement(t); e.className = c; if (h) e.innerHTML = h; p.appendChild(e); return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Response curve for the stick: gentle near the centre (fine corrections), full authority at the rim. */
const expo = v => Math.sign(v) * (0.4 * Math.abs(v) + 0.6 * v * v);
const spec = (label, act, on, sub = '', tone = '') => ({ label, act, on, sub, tone });

/** Mobile controls + IInputSource.
 *  Left cluster: floating stick (pitch/roll, or walk / steer) + rudder buttons. Right cluster: power slider, a context-aware action grid, brake (jump on foot).
 *  The grid changes with what you are doing: flight page, flight "More" page (spoilers, reverse, strobes, autopilot, map, cargo...), on foot, driving.
 *  Settings: touchLeft (swap sides), touchScale, touchOpacity, touchFloat (stick appears under the thumb), haptics.
 *  Touches that start on empty view are handled by CameraManager (drag = look around, pinch = zoom). */
export class TouchControls {
  constructor() { this.ax = { pitch: 0, roll: 0 }; this.yl = 0; this.yr = 0; this.brk = 0; this.thr = null; this.page = 'main'; this.sig = ''; this.btns = []; this.sprint = false; }
  init(e) {
    this.e = e; const root = document.getElementById('hud'), S = e.settings;
    this.coarse = matchMedia('(pointer: coarse)').matches || location.search.includes('touch');
    if (this.coarse) document.body.classList.add('coarse');
    e.bus.on('action', a => { if (a === 'fullscreen') document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.(); });
    e.input.sources.push(this);
    if (!this.coarse) return;
    root.addEventListener('contextmenu', ev => ev.preventDefault()); // long-press must never open the browser menu over the sticks

    // ---- left cluster: stick + rudder
    const L = el('div', 'tc tc-l', root), zone = el('div', 'ctl stickzone', L), stick = el('div', 'stick', L, '<i class="lbl up"></i><i class="lbl dn"></i>'), knob = el('div', 'knob', stick);
    const yaw = el('div', 'yaw', L);
    let sid = null, cx = 0, cy = 0, R = 1;
    const home = () => { const t = L.getBoundingClientRect(), r = stick.offsetWidth / 2; return { x: t.left + stick.offsetLeft + r, y: t.top + stick.offsetTop + r, r }; }; // layout position, ignores the floating transform
    const upd = ev => {
      let x = (ev.clientX - cx) / R, y = (ev.clientY - cy) / R; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
      this.ax.roll = Math.abs(x) < 0.08 ? 0 : expo(x); this.ax.pitch = Math.abs(y) < 0.08 ? 0 : expo(y);
      const k = R * 0.58; knob.style.transform = `translate(${x * k}px,${y * k}px)`;
    };
    const end = ev => { if (ev && ev.pointerId !== sid) return; sid = null; this.ax.roll = this.ax.pitch = 0; knob.style.transform = ''; stick.style.transform = ''; stick.classList.remove('on'); };
    zone.onpointerdown = ev => {
      if (sid != null) return; sid = ev.pointerId; zone.setPointerCapture(sid); const h = home(); R = h.r; cx = h.x; cy = h.y;
      if (S.get('touchFloat')) { const z = zone.getBoundingClientRect(), nx = clamp(ev.clientX, z.left + R, z.right - R), ny = clamp(ev.clientY, z.top + R, z.bottom - R); stick.style.transform = `translate(${nx - cx}px,${ny - cy}px)`; cx = nx; cy = ny; }
      stick.classList.add('on'); upd(ev); this.buzz(6);
    };
    zone.onpointermove = ev => { if (ev.pointerId === sid) upd(ev); };
    zone.onpointerup = zone.onpointercancel = zone.onlostpointercapture = end;
    this.lblUp = stick.querySelector('.up'); this.lblDn = stick.querySelector('.dn');
    for (const [id, txt, key, lab] of [['yawL', '\u25c0', 'yl', 'Rudder left'], ['yawR', '\u25b6', 'yr', 'Rudder right']]) {
      const b = el('button', 'ctl tbtn', yaw, txt); b.id = id; b.setAttribute('aria-label', lab); b.type = 'button';
      b.onpointerdown = ev => { b.setPointerCapture(ev.pointerId); this[key] = 1; b.classList.add('down'); this.buzz(5); };
      b.onpointerup = b.onpointercancel = () => { this[key] = 0; b.classList.remove('down'); };
    }

    // ---- right cluster: power slider + action grid + brake / jump
    const Rr = el('div', 'tc tc-r', root), thr = el('div', 'ctl tthr', Rr, '<span>Power</span><output>0%</output><div class="ticks"></div>');
    this.fill = el('div', 'fill', thr); this.thrOut = thr.querySelector('output');
    let tid = null, lastQ = -1;
    const ut = ev => {
      const r = thr.getBoundingClientRect(); let v = clamp(1 - (ev.clientY - r.top) / r.height, 0, 1); const q = Math.round(v * 4) / 4;
      if (Math.abs(v - q) < 0.03) v = q; // magnetic detents at idle, 25, 50, 75 and full
      if (q !== lastQ) { if (lastQ !== -1) this.buzz(5); lastQ = q; } this.thr = v;
    };
    thr.onpointerdown = ev => { tid = ev.pointerId; thr.setPointerCapture(tid); lastQ = -1; ut(ev); };
    thr.onpointermove = ev => { if (ev.pointerId === tid) ut(ev); };
    thr.onpointerup = thr.onpointercancel = () => { tid = null; this.thr = null; };
    const rc = el('div', 'tc-rc', Rr); this.quick = el('div', 'quick', rc);
    const big = this.big = el('button', 'ctl tbtn big', rc, 'Brake'); big.type = 'button'; big.id = 'brk';
    big.onpointerdown = ev => { big.setPointerCapture(ev.pointerId); big.classList.add('down'); if (e.walk?.mode === 'foot') { e.bus.emit('action', 'jump'); this.buzz(10); } else { this.brk = 1; this.buzz(8); } };
    big.onpointerup = big.onpointercancel = () => { this.brk = 0; big.classList.remove('down'); };

    const apply = () => {
      const st = document.documentElement.style, auto = clamp(innerHeight / 400, 0.85, 1.3); // bigger controls on tablets, never huge
      document.body.classList.toggle('lefty', !!S.get('touchLeft')); st.setProperty('--tcs', (auto * S.get('touchScale')).toFixed(3)); st.setProperty('--tco', S.get('touchOpacity'));
    };
    apply(); addEventListener('resize', apply);
    e.bus.on('settings', ({ key }) => { if (key === 'touchLeft' || key === 'touchScale' || key === 'touchOpacity') apply(); });
    e.bus.on('aircraft:impact', ({ speed }) => this.buzz(speed > 8 ? [70, 40, 110] : 45));
    e.bus.on('aircraft:spawn', () => { this.page = 'main'; });
  }
  /** Short vibration (Android; iOS ignores it). */
  buzz(p) { if (this.e.settings.get('haptics')) try { navigator.vibrate?.(p); } catch { /* blocked */ } }
  setPage(p) { this.page = p; this.buzz(6); }
  /** Buttons for the current context. `on` marks a latched system; `tone: warn` turns it amber instead of green. */
  specs() {
    const e = this.e, p = e.aircraft.player, c = p?.controls, mode = e.walk?.mode || 'aircraft', S = e.settings;
    if (mode === 'foot') return [spec('Use', 'interact'), spec('Door', 'door'), spec('Run', () => { this.sprint = !this.sprint; if (e.walk) e.walk.touchSprint = this.sprint; }, () => this.sprint), spec('View', 'camera')];
    if (mode === 'vehicle') return [spec('Exit', 'interact'), spec('View', 'camera')];
    if (!p) return [];
    if (this.page === 'more') {
      const L = [spec('Spoilers', 'spoiler', () => c.spoiler), spec('Reverse', 'reverse', () => c.reverse, '', 'warn'), spec('Strobes', 'lights', () => c.lights), spec('Autopilot', 'autopilot', () => e.autopilot?.on), spec('Map', 'map')];
      if (p.def.cargo) L.push(spec('Ramp', 'ramp', () => c.rampOpen), spec('Cargo', 'cargo'));
      if (p.def.flight.jato) L.push(spec('JATO', 'jato', () => p.jatoLeft > 0, '', 'warn'));
      L.push(spec('Back', () => this.setPage('main'))); return L;
    }
    return [spec('Gear', 'gear', () => c.gearDown, 'down'), spec('Flaps', 'flapsAuto', () => S.get('autoFlaps'), 'auto'), spec('Flap \u2212', 'flapsUp'), spec('Flap +', 'flapsDown'), spec('View', 'camera'), spec('More', () => this.setPage('more'))];
  }
  render(list) {
    this.quick.replaceChildren();
    this.btns = list.map(sp => {
      const b = el('button', '', this.quick, `<b>${sp.label}</b>${sp.sub ? `<small>${sp.sub}</small>` : ''}`); b.type = 'button'; if (sp.tone) b.dataset.tone = sp.tone;
      b.onclick = () => { if (typeof sp.act === 'function') sp.act(); else { this.buzz(8); this.e.bus.emit('action', sp.act); } }; return [b, sp];
    });
  }
  poll() { return { pitch: this.ax.pitch, roll: this.ax.roll, yaw: this.yr - this.yl, brake: this.brk, throttleSet: this.thr ?? undefined }; }
  update() {
    if (!this.fill) return; const e = this.e, mode = e.walk?.mode || 'aircraft', p = e.aircraft.player;
    const sig = `${mode}|${this.page}|${p?.def.id}`;
    if (sig !== this.sig) { this.sig = sig; this.render(this.specs()); this.big.textContent = mode === 'foot' ? 'Jump' : 'Brake'; // pull the stick down = nose up, like a real yoke
      this.lblUp.textContent = mode === 'aircraft' ? 'dive' : 'forward'; this.lblDn.textContent = mode === 'aircraft' ? 'climb' : 'back'; }
    for (const [b, sp] of this.btns) { const on = !!sp.on?.(); if (b._on !== on) { b._on = on; b.classList.toggle('on', on); } }
    const t = e.input.state.throttle, rev = !!p?.controls.reverse; this.fill.style.height = t * 100 + '%'; this.fill.classList.toggle('rev', rev);
    const txt = `${rev ? 'R ' : ''}${Math.round(t * 100)}%`; if (txt !== this.thrTxt) { this.thrTxt = txt; this.thrOut.textContent = txt; }
  }
}
