import { UNITS } from '../config/units.js';
import { PFD } from './PFD.js';
import { flapSpeeds } from '../aircraft/FlapLogic.js';
import { CAMERA_MODES } from '../camera/CameraManager.js';
import { instrumentState } from '../instruments/state.js';

const ICON_MENU = '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>';
const TEMPLATE = `
<div id="topbar">
  <div id="idPlate" class="glass"><div class="ac"><b id="acName"></b><span id="acRole"></span></div><div class="sub"><span id="acLivery"></span><span id="acWhere"></span></div></div>
  <div class="grow"></div>
  <div id="envPlate" class="glass"><span id="clock" class="num"></span><span id="wx"></span>
    <span class="wind"><svg id="windArrow" viewBox="0 0 24 24"><path d="M12 3 L18 18 L12 14.5 L6 18 Z"/></svg><span id="windTxt" class="num"></span></span></div>
  <button id="camBtn" class="glass" type="button" title="Change camera (C)"><small>View</small><b id="camTxt"></b></button>
  <button id="menuBtn" class="glass" type="button" aria-label="Menu (Esc)">${ICON_MENU}</button>
</div>
<div id="toasts" aria-live="polite"></div>
<div id="systems" class="glass">
  <div class="row thr"><label>Throttle</label><div class="meter"><i id="thrFill"></i></div><b id="thrVal" class="num"></b></div>
  <div class="row"><label>Flaps</label><div id="ladder"></div><button id="flapMode" type="button" title="Auto flaps (4)"><i></i><span></span></button></div>
  <div id="flapNote"></div>
  <div class="row"><label>Gear</label><div class="lamps"><i></i><i></i><i></i></div><b id="gearTxt" class="num"></b></div>
  <div id="chips"></div>
</div>
<div id="dock"><div id="alerts"></div><button id="prompt" class="glass" type="button" hidden><kbd>E</kbd><span></span></button><div id="footInfo" class="glass" hidden></div><div id="guide" hidden></div><canvas id="pfd"></canvas></div>`;
const cap = s => s[0].toUpperCase() + s.slice(1);
const WARN = /destroy|damage|lost|separated|overspeed|cannot|over cargo|no vehicle|denied|stop the|first|empty|nothing/i;

/** DOM HUD: identity/env plates, systems panel (throttle, flap ladder with auto badge, gear lamps, active-system chips), alerts, toasts, PFD. */
export class HUD {
  constructor() { this.cache = {}; this.mode = 0; this.whereT = 0; this.where = ''; this.defId = null; }
  init(e) {
    this.e = e; const root = document.getElementById('hud');
    root.insertAdjacentHTML('afterbegin', TEMPLATE); // append, never overwrite: MapUI / TouchControls already added their elements
    const $ = s => root.querySelector(s); this.$ = $;
    this.pfd = new PFD($('#pfd')); this.ladder = $('#ladder'); this.flapMode = $('#flapMode');
    this.flapMode.onclick = () => e.bus.emit('action', 'flapsAuto'); $('#prompt').onclick = () => e.bus.emit('action', 'interact'); $('#camBtn').onclick = () => e.bus.emit('action', 'camera'); $('#menuBtn').onclick = () => e.bus.emit('action', 'menu');
    e.bus.on('hud:message', m => this.toast(m));
    e.bus.on('aircraft:impact', ({ speed }) => this.toast(`Touchdown: ${speed.toFixed(1)} m/s sink`));
    e.bus.on('action', a => { if (a === 'hud') { this.mode = (this.mode + 1) % 3; document.body.classList.toggle('hud-min', this.mode === 1); document.body.classList.toggle('hud-off', this.mode === 2); } });
    const compact = matchMedia('(max-width:900px),(max-height:520px)'), apply = () => { document.body.classList.toggle('compact', compact.matches || document.body.classList.contains('coarse')); this.pfd.fit(); };
    addEventListener('resize', apply); setTimeout(apply, 0); apply();
  }
  set(id, v, attr = 'textContent') { if (this.cache[id + attr] !== v) { this.cache[id + attr] = v; this.$('#' + id)[attr] = v; } }
  toast(m) {
    const t = this.$('#toasts'), el = document.createElement('div'); el.className = 'toast glass' + (WARN.test(m) ? ' warn' : ''); el.textContent = m; t.appendChild(el);
    while (t.children.length > 3) t.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2400); setTimeout(() => el.remove(), 2800);
  }
  buildLadder(def) {
    this.defId = def.id; this.ladder.innerHTML = def.flaps.map((_, i) => `<span>${i}</span>`).join('') + '<i class="needle"></i>'; this.cells = [...this.ladder.querySelectorAll('span')]; this.needle = this.ladder.querySelector('.needle');
  }
  update(dt) {
    const e = this.e, a = e.aircraft.player; if (!a) return;
    const un = e.settings.get('units'), U = UNITS[un], [sl, sk] = U.speed, [al, ak] = U.alt, [vl, vk] = U.vs, f = a.def.flight, c = a.controls, t = a.telemetry, w = e.world, env = e.env;
    if (this.defId !== a.def.id) this.buildLadder(a.def);
    const S = instrumentState(e, a, this.S ??= {}), hdg = S.hdg, pitch = S.pitch, roll = S.roll, gh = S.alt - S.agl, alt = S.alt, agl = S.agl, V = t.airspeed, sp = { vs0: S.bands.vs0, vs1: S.bands.vs1, vfe: S.bands.vfe }, cur = c.flapIndex, walk = e.walk;
    const mode = walk.mode, cam = e.cameras, seatedView = mode === 'aircraft', cockpitView = cam.inside && !e.settings.get('cockpitHud');
    const B = document.body.classList; B.toggle('on-foot', mode === 'foot'); B.toggle('in-vehicle', mode === 'vehicle'); B.toggle('cockpit-view', cockpitView);

    // identity + environment
    const [nm, role] = a.def.name.replace(')', '').split(' ('); this.set('acName', nm); this.set('acRole', role || ''); this.set('acLivery', a.def.liveries[a.livery].name);
    this.whereT -= dt; if (this.whereT <= 0) { this.whereT = 0.5; let b = null, bd = 1e9; for (const p of w.cfg.airports) { const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z); if (d < bd) { bd = d; b = p; } } this.where = b ? `${b.name}  ${(bd * U.dist[1]).toFixed(1)} ${U.dist[0]}` : ''; }
    this.set('acWhere', this.where);
    this.set('clock', `${String(env.hour).padStart(2, '0')}:00`); this.set('wx', cap(env.weather));
    this.set('windTxt', `${String(env.wind.from).padStart(3, '0')}\u00b0 ${Math.round(env.wind.speed * sk)} ${sl}`);
    this.$('#windArrow').style.transform = `rotate(${Math.round(env.wind.from + 180 - hdg)}deg)`;
    this.set('camTxt', CAMERA_MODES[e.cameras.i].label);

    // systems
    this.$('#thrFill').style.width = c.throttle * 100 + '%'; this.$('#thrFill').classList.toggle('rev', !!c.reverse); this.set('thrVal', `${Math.round(c.throttle * 100)}%`);
    const fl = a.def.flaps, n = fl.length; let idx = 0; for (let i = 0; i < n - 1; i++) if (a.flapPos >= fl[i]) idx = i + (fl[i + 1] > fl[i] ? Math.min(1, (a.flapPos - fl[i]) / (fl[i + 1] - fl[i])) : 0);
    this.needle.style.left = (idx + 0.5) / n * 100 + '%'; this.cells.forEach((el, i) => el.classList.toggle('cmd', i === cur)); this.ladder.classList.toggle('auto', !!c.flapAuto);
    this.flapMode.classList.toggle('on', !!c.flapAuto); this.flapMode.querySelector('span').textContent = c.flapAuto ? 'Auto' : 'Manual';
    const note = a.flapReason === 'overspeed' ? 'Overspeed - retracting' : c.flapAuto ? cap(a.flapReason || 'clean') : n > 1 ? `Max ${isFinite(sp.vfe[cur]) ? Math.round(sp.vfe[cur] * sk) + ' ' + sl : 'any speed'}` : '';
    this.set('flapNote', note); this.$('#flapNote').classList.toggle('warn', a.flapReason === 'overspeed');
    const g = a.gearPos > 0.99 ? 'down' : a.gearPos < 0.01 ? 'up' : 'moving', gl = this.$('.lamps'); gl.className = 'lamps ' + (g === 'up' ? '' : g); this.set('gearTxt', cap(g));
    const chips = []; if (c.spoiler) chips.push(['Spoilers', 'on']); if (c.reverse) chips.push(['Reverse', 'warn']); if (c.brake > 0.1) chips.push(['Brakes', 'warn']); if (c.autobrake) chips.push(['Autobrake', 'on']); if (c.lights) chips.push(['Strobes', 'on']);
    if (a.jatoLeft > 0) chips.push([`JATO ${Math.ceil(a.jatoLeft)}s`, 'warn']);
    if (a.def.cargo) { if (a.rampPos > 0.02) chips.push([`Ramp ${Math.round(a.rampPos * 100)}%`, 'cyan']); chips.push([`Cargo ${a.bay.length} \u00b7 ${Math.round(a.mass - f.mass)} kg`, '']); }
    if (a.onGround && a.surface && a.surface !== 'asphalt') chips.push([a.surface[0].toUpperCase() + a.surface.slice(1), 'warn']);
    if (a.mesh.userData.parts.doors.some(d => d.pos > 0.05)) chips.push(['Door open', 'warn']);
    if (env.turbulence !== 'off' && env.intensity > 0.8) chips.push([`Turbulence: ${env.turbLabel().toLowerCase()}`, 'warn']);
    if (e.cargo.driven) chips.push(['Driving - Enter to exit', 'cyan']);
    const sig = chips.map(x => x.join('|')).join(';'); if (sig !== this.chipSig) { this.chipSig = sig; this.$('#chips').innerHTML = chips.map(([l, k]) => `<span class="chip ${k}">${l}</span>`).join(''); }

    // alerts
    const al2 = [];
    if (a.destroyed) al2.push(['Destroyed - press Backspace to reset', '', 1]);
    else {
      if (!a.onGround && Math.abs(t.aoa) > f.aoaStall * 0.92) al2.push(['Stall', '', 1]);
      if (!a.onGround && agl < 150 && a.vel.y < -7) al2.push(['Sink rate', 'amber', 0]);
      if (!a.onGround && !c.gearDown && agl < 120 && V < sp.vs1 * 1.5 && c.throttle < 0.5) al2.push(['Gear not down', 'amber', 0]);
      if (cur > 0 && V > sp.vfe[cur]) al2.push(['Flap overspeed', 'amber', 0]);
      if (a.gearDamaged) al2.push(['Gear damaged', 'amber', 0]);
      if (seatedView && a.mesh.userData.parts.doors.some(d => d.pos > 0.05) && (c.throttle > 0.4 || !a.onGround)) al2.push(['Door open', 'amber', 0]);
      if (seatedView && env.intensity > 1.6 && !a.onGround) al2.push(['Severe turbulence', 'amber', 0]);
    }
    const asig = al2.map(x => x.join('|')).join(';'); if (asig !== this.alertSig) { this.alertSig = asig; this.$('#alerts').innerHTML = al2.map(([m, k, fl2]) => `<div class="alert ${k} ${fl2 ? 'flash' : ''}">${m}</div>`).join(''); }

    // route guidance
    const gd = e.map.guidance?.(a), gEl = this.$('#guide'); if (gd) { gEl.hidden = false; this.set('guide', `<b>Waypoint ${gd.idx}/${gd.n}</b><span>${(gd.dist * U.dist[1]).toFixed(1)} ${U.dist[0]}</span><span>${String(Math.round(gd.brg)).padStart(3, '0')}\u00b0</span>`, 'innerHTML'); } else gEl.hidden = true;

    // prompt / on-foot + vehicle readouts
    const pr = walk.prompt, pEl = this.$('#prompt'); pEl.hidden = !pr; if (pr) pEl.querySelector('span').textContent = pr.text;
    const fi = this.$('#footInfo'); fi.hidden = seatedView;
    if (mode === 'foot') { const fh = (Math.atan2(-Math.sin(walk.yaw), -Math.cos(walk.yaw)) * 180 / Math.PI + 360) % 360; this.set('footInfo', `On foot <b>${String(Math.round(fh)).padStart(3, '0')}\u00b0</b><span>${Math.round(walk.speed * 3.6)} km/h</span>${walk.inside ? '<span>Aboard</span>' : `<span>${walk.surface === 'hard' ? 'Hard ground' : walk.surface[0].toUpperCase() + walk.surface.slice(1)}</span>`}`, 'innerHTML'); }
    else if (mode === 'vehicle' && e.cargo.driven) { const v = e.cargo.driven, sf = e.world.surfaceAt(v.pos.x, v.pos.z); this.set('footInfo', `${v.name} <b>${Math.round(Math.abs(v.speed) * U.speed[1] * (U.speed[0] === 'kt' ? 1 : 1))} ${U.speed[0]}</b><span>${sf.label}</span>`, 'innerHTML'); }
    // PFD
    const vs = a.vel.y, vsv = vs * vk;
    this.pfd.draw({ pitch, roll, hdg, spd: V, spdUnit: sl, spdK: sk, gs: Math.hypot(a.vel.x, a.vel.z), alt, altUnit: al, altK: ak, agl, vs, vsText: `${vsv >= 0 ? '+' : '-'}${vl === 'm/s' ? Math.abs(vsv).toFixed(1) : Math.abs(Math.round(vsv))} ${vl}`,
      aoaFrac: Math.max(0, t.aoa) / f.aoaStall, bands: { vs0: sp.vs0, vs1: sp.vs1, vfeLast: sp.vfe[n - 1] === Infinity ? sp.vs1 * 2 : sp.vfe[n - 1], vfeCur: sp.vfe[cur] }, flapIdx: cur, brg: gd ? gd.brg : null, stall: al2.some(x => x[0] === 'Stall'), onGround: a.onGround, time: e.time });
  }
}
