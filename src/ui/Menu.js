import { rebindHTML, wireRebind } from './Rebind.js';
import { UNITS } from '../config/units.js';
import { flapSpeeds } from '../aircraft/FlapLogic.js';
import { CAMERA_MODES } from '../camera/CameraManager.js';
import { TURB_LEVELS } from '../world/Environment.js';

const TABS = [['aircraft', 'Aircraft'], ['flight', 'Flight'], ['world', 'World'], ['camera', 'Camera'], ['controls', 'Controls'], ['help', 'Keys']];
const ROLE = { 'civil-light': 'Light civil', 'military-transport': 'Military transport' };
const WEATHER = ['clear', 'cloudy', 'overcast', 'fog'];
const hex = n => '#' + n.toString(16).padStart(6, '0');
const KEYS = [
  ['Flying', [['W S', 'Pitch'], ['A D', 'Roll'], ['Q E', 'Yaw / nose wheel'], ['Z X', 'Throttle up / down'], ['Space', 'Brake'], ['R', 'Thrust reverse'], ['O', 'Spoilers'], ['8', 'Autopilot (W/S altitude, A/D heading, Z/X speed)']]],
  ['Configuration', [['G', 'Landing gear'], ['4', 'Auto flaps on / off'], ['F V', 'Flaps down / up (manual)'], ['B', 'Autobrake'], ['L', 'Strobes'], ['J', 'JATO'], ['6', 'Open / close nearest door']]],
  ['On foot and vehicles', [['Enter', 'Stand up from seat / leave vehicle'], ['E', 'Interact (doors, seats, vehicles, ramp) on foot'], ['W A S D', 'Walk / drive'], ['Shift', 'Sprint'], ['Space', 'Jump (brake in a vehicle)'], ['Mouse', 'Look (click view to capture)'], ['C', 'First / third person']]],
  ['Cargo', [['I', 'Cargo ramp'], ['K', 'Load / unload / airdrop'], ['Drive up the ramp', 'Secures a vehicle in the bay']]],
  ['Camera', [['C', 'Next camera'], ['Drag', 'Look around / orbit'], ['Wheel', 'Zoom'], ['Double-click or 5', 'Reset view'], [', .', 'Look left / right'], ['; /', 'Look up / down'], ['- =', 'Zoom out / in']]],
  ['World and interface', [['T', 'Time'], ['M', 'Weather'], ['7', 'Turbulence level'], ['[ ]  Y', 'Wind strength / direction'], ['U', 'Units'], ['P', 'Map'], ['2', 'Clear route'], ['9', 'Cycle HUD'], ['0', 'Sound'], ['1', 'Tilt steering'], ['3', 'Fullscreen'], ['Esc', 'Menu'], ['Backspace', 'Reset aircraft'], ['Tab  N', 'Next aircraft / livery']]],
];

/** Tabbed menu overlay. Pauses the simulation (setting `pauseOnMenu`). Esc or the menu button toggles it; 'help' opens the Keys tab. */
export class Menu {
  constructor() { this.alwaysUpdate = true; this.tab = 'aircraft'; this.isOpen = false; }
  init(e) {
    this.e = e; const el = this.el = document.createElement('div'); el.id = 'menu'; el.hidden = true;
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-label="Menu"><nav class="rail"><h1>Open Flight Engine<small>Free flight</small></h1>${TABS.map(([id, l]) => `<button class="tab" role="tab" data-tab="${id}">${l}</button>`).join('')}<div class="grow"></div><button class="tab go" data-close>Resume</button></nav><div class="mbody" id="mbody"></div></div>`;
    document.getElementById('hud').appendChild(el); this.body = el.querySelector('#mbody');
    el.addEventListener('click', ev => {
      if (ev.target === el || ev.target.closest('[data-close]')) return this.toggle(false);
      const t = ev.target.closest('[data-tab]'); if (t) this.show(t.dataset.tab);
    });
    e.bus.on('action', a => { if (a === 'menu') this.toggle(); else if (a === 'help') { this.show('help'); this.toggle(true); } else this.refresh(); });
    e.bus.on('settings', ({ key }) => { if (key === 'autoFlaps' || key === 'units') this.refresh(); }); e.bus.on('flaps:set', () => this.refresh());
    e.bus.on('settings', ({ key }) => { if (key === 'pauseOnMenu' && this.isOpen) e.paused = e.settings.get('pauseOnMenu'); });
  }
  toggle(on = !this.isOpen) {
    this.isOpen = on; this.el.hidden = !on; document.body.classList.toggle('menu-open', on); this.e.paused = on && this.e.settings.get('pauseOnMenu');
    if (on) this.show(this.tab); else document.activeElement?.blur?.();
  }
  show(tab) { this.tab = tab; this.el.querySelectorAll('.tab[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab)); this.render(); }
  refresh() { if (this.isOpen && (this.tab === 'flight' || this.tab === 'aircraft')) this.render(); } // state-driven tabs only: re-rendering a slider tab mid-drag would break the drag
  render() {
    const st = this.body.scrollTop; this.body.innerHTML = this['r_' + this.tab](); this.body.scrollTop = st; this['w_' + this.tab]?.();
  }
  // ---- helpers
  seg(items, cur, attr, cls = '') { return `<div class="seg">${items.map(([v, l]) => `<button class="${String(v) === String(cur) ? 'sel ' + cls : ''}" data-${attr}="${v}">${l}</button>`).join('')}</div>`; }
  field(id, label, min, max, step, val, out) { return `<div class="field"><label for="${id}">${label}</label><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}-o">${out}</output></div>`; }
  sw(key, label, hint = '') { return `<div class="switch"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><button role="switch" data-sw="${key}" aria-checked="${this.e.settings.get(key)}" aria-label="${label}"></button></div>`; }
  slider(id, key, map, fmt) { const i = this.body.querySelector('#' + id), o = this.body.querySelector('#' + id + '-o'); i.oninput = () => { const v = map(+i.value); this.e.settings.set(key, v, true); o.textContent = fmt(v); }; }
  wireSwitches() { this.body.querySelectorAll('[data-sw]').forEach(b => b.onclick = () => { const k = b.dataset.sw; this.e.settings.set(k, !this.e.settings.get(k), true); b.setAttribute('aria-checked', this.e.settings.get(k)); }); }

  // ---- Aircraft
  r_aircraft() {
    const e = this.e, reg = e.aircraft.registry, p = e.aircraft.player, [sl, sk] = UNITS[e.settings.get('units')].speed;
    const plane = (d, l) => { const w = 0.35 + 0.6 * Math.min(1, Math.sqrt(d.flight.wingArea) / 12.6), b = hex(l.body), a = hex(l.accent);
      return `<svg viewBox="0 0 160 80" aria-hidden="true"><ellipse cx="80" cy="40" rx="${8 + w * 4}" ry="34" fill="${b}"/><rect x="${80 - 70 * w}" y="30" width="${140 * w}" height="12" rx="3" fill="${b}"/><rect x="${80 - 70 * w}" y="40" width="${140 * w}" height="3" fill="${a}"/><rect x="66" y="64" width="28" height="6" rx="2" fill="${b}"/><rect x="77" y="52" width="6" height="22" rx="2" fill="${a}"/></svg>`; };
    return `<h2>Choose an aircraft</h2><p class="lead">Switching aircraft puts you back on the main runway.</p><div class="cards">${reg.ids().map(id => {
      const d = reg.get(id), sel = p.def.id === id, l = d.liveries[sel ? p.livery : 0], s = flapSpeeds(d);
      return `<div class="card ${sel ? 'sel' : ''}" data-ac="${id}" tabindex="0" role="button">${plane(d, l)}<h4>${d.name.split(' (')[0]}</h4><p>${ROLE[d.role] || d.role}</p>
        <dl><div><dt>Stall speed</dt><dd>${Math.round(s.vs0 * sk)} ${sl}</dd></div><div><dt>Weight</dt><dd>${(d.flight.mass / 1000).toFixed(1)} t</dd></div><div><dt>Payload</dt><dd>${d.cargo ? (d.cargo.maxMass / 1000).toFixed(0) + ' t' : 'none'}</dd></div></dl>
        <div class="liv">${d.liveries.map((v, i) => `<button data-ac="${id}" data-liv="${i}" class="${sel && p.livery === i ? 'sel' : ''}"><i style="background:${hex(v.body)};border-color:${hex(v.accent)}"></i>${v.name}</button>`).join('')}</div></div>`; }).join('')}</div>`;
  }
  w_aircraft() {
    const go = (id, liv) => { const p = this.e.aircraft.player; this.e.aircraft.respawn(id, liv ?? (id === p.def.id ? p.livery : 0)); this.render(); };
    this.body.querySelectorAll('[data-liv]').forEach(b => b.onclick = ev => { ev.stopPropagation(); go(b.dataset.ac, +b.dataset.liv); });
    this.body.querySelectorAll('.card').forEach(c => { c.onclick = () => go(c.dataset.ac); c.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(c.dataset.ac); } }; });
  }

  // ---- Flight
  r_flight() {
    const e = this.e, p = e.aircraft.player, c = p.controls, auto = e.settings.get('autoFlaps'), n = p.def.flaps.length;
    const T = [['gear', 'Landing gear', c.gearDown ? 'Down' : 'Up', c.gearDown, p.gearDamaged], ['spoiler', 'Spoilers', c.spoiler ? 'Out' : 'In', c.spoiler], ['reverse', 'Thrust reverse', c.reverse ? 'Armed' : 'Off', c.reverse],
      ['autobrake', 'Autobrake', c.autobrake ? 'Armed' : 'Off', c.autobrake], ['lights', 'Strobes', c.lights ? 'On' : 'Off', c.lights]];
    if (p.def.flight.jato) T.push(['jato', 'JATO', p.jatoLeft > 0 ? 'Firing' : 'Ready', p.jatoLeft > 0]);
    if (p.def.cargo) T.push(['ramp', 'Cargo ramp', c.rampOpen ? 'Open' : 'Closed', c.rampOpen], ['cargo', 'Load / airdrop', `${p.bay.length} in bay`, false]);
    const doors = p.mesh.userData.parts.doors; T.push(['door', 'Doors', doors.some(d => d.target) ? 'Open' : 'Closed', doors.some(d => d.target), doors.some(d => d.target) && (p.controls.throttle > 0.4 || !p.onGround)]);
    T.push(['interact', e.walk.mode === 'aircraft' ? 'Leave seat' : 'Get back in', e.walk.mode === 'aircraft' ? 'Needs a stopped aircraft' : 'Walk to a door and press E', false]);
    return `<h2>Flight</h2><p class="lead">Auto flaps picks a setting from your airspeed, gear and power, and retracts them if you go too fast. Choosing a flap setting yourself switches to manual.</p>
      <h3>Flaps</h3>${this.seg([['auto', 'Auto'], ...p.def.flaps.map((_, i) => [i, i])], auto ? 'auto' : c.flapIndex, 'flap', auto ? 'auto' : '')}
      <h3>Systems</h3><div class="tiles">${T.map(([a, l, s, on, w]) => `<button class="tile ${w ? 'warn' : on ? 'on' : ''}" data-act="${a}"><b>${l}</b><span>${w ? 'Damaged' : s}</span></button>`).join('')}</div>`;
  }
  w_flight() {
    this.body.querySelectorAll('[data-flap]').forEach(b => b.onclick = () => { const v = b.dataset.flap; if (v === 'auto') this.e.settings.set('autoFlaps', true, true), this.e.bus.emit('hud:message', 'Auto flaps on'); else this.e.bus.emit('flaps:set', +v); this.render(); });
    this.body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => { this.e.bus.emit('action', b.dataset.act); });
  }

  // ---- World
  r_world() {
    const env = this.e.env, [sl, sk] = UNITS[this.e.settings.get('units')].speed;
    return `<h2>World</h2><p class="lead">Time, weather and wind apply instantly.</p>
      ${this.field('f-hour', 'Time of day', 0, 23, 1, env.hour, `${String(env.hour).padStart(2, '0')}:00`)}
      <div class="seg">${[['Dawn', 6], ['Noon', 12], ['Sunset', 18], ['Night', 22]].map(([l, h]) => `<button data-hour="${h}">${l}</button>`).join('')}</div>
      <h3>Weather</h3>${this.seg(WEATHER.map(w => [w, w[0].toUpperCase() + w.slice(1)]), env.weather, 'wx')}
      <h3>Wind</h3>${this.field('f-ws', 'Strength', 0, 25, 1, env.wind.speed, `${Math.round(env.wind.speed * sk)} ${sl}`)}${this.field('f-wd', 'Blowing from', 0, 345, 15, env.wind.from, `${String(env.wind.from).padStart(3, '0')}\u00b0`)}
      <h3>Turbulence</h3>${this.seg(Object.keys(TURB_LEVELS).map(k => [k, k[0].toUpperCase() + k.slice(1)]), env.turbulence, 'turb')}<p class="note">Auto follows the weather, wind, low-level terrain effects and daytime thermals over land.</p>
      <h3>Units</h3>${this.seg(Object.keys(UNITS).map(u => [u, u[0].toUpperCase() + u.slice(1)]), this.e.settings.get('units'), 'unit')}`;
  }
  w_world() {
    const env = this.e.env, b = this.body, [sl, sk] = UNITS[this.e.settings.get('units')].speed, $ = s => b.querySelector(s);
    const bind = (id, fn, fmt) => { const i = $('#' + id), o = $('#' + id + '-o'); i.oninput = () => { fn(+i.value); env.apply(); o.textContent = fmt(+i.value); }; };
    bind('f-hour', v => env.hour = v, v => `${String(v).padStart(2, '0')}:00`); bind('f-ws', v => env.wind.speed = v, v => `${Math.round(v * sk)} ${sl}`); bind('f-wd', v => env.wind.from = v, v => `${String(v).padStart(3, '0')}\u00b0`);
    b.querySelectorAll('[data-hour]').forEach(x => x.onclick = () => { env.hour = +x.dataset.hour; env.apply(); this.render(); });
    b.querySelectorAll('[data-wx]').forEach(x => x.onclick = () => { env.weather = x.dataset.wx; env.apply(); this.render(); });
    b.querySelectorAll('[data-turb]').forEach(x => x.onclick = () => { env.turbulence = x.dataset.turb; this.render(); });
    b.querySelectorAll('[data-unit]').forEach(x => x.onclick = () => { this.e.settings.set('units', x.dataset.unit, true); this.render(); });
  }

  // ---- Camera
  r_camera() {
    const cm = this.e.cameras, s = this.e.settings;
    return `<h2>Camera</h2><p class="lead">${CAMERA_MODES[cm.i].hint}</p>${this.seg(CAMERA_MODES.map(m => [m.id, m.label]), cm.mode, 'cam')}
      <h3>Look around</h3>${this.field('f-sens', 'Look sensitivity', 0.3, 2.5, 0.1, s.get('cameraSensitivity'), s.get('cameraSensitivity').toFixed(1) + 'x')}${this.field('f-fov', 'Field of view', 40, 95, 1, s.get('fov'), s.get('fov') + '\u00b0')}
      ${this.sw('camRecenter', 'Return to centre', 'Chase, cockpit and wing views ease back after you let go')}
      <p class="note">Drag anywhere on the view to look around or orbit, scroll or pinch to zoom, double-click to reset. Keys: , . look left/right, ; / look up/down, - = zoom, 5 reset. Gamepad: D-pad to look, right stick click to reset.</p>`;
  }
  w_camera() {
    this.body.querySelectorAll('[data-cam]').forEach(b => b.onclick = () => { this.e.cameras.set(b.dataset.cam); this.render(); });
    this.slider('f-sens', 'cameraSensitivity', v => v, v => v.toFixed(1) + 'x'); this.slider('f-fov', 'fov', v => v, v => v + '\u00b0'); this.wireSwitches();
  }

  // ---- Controls
  r_controls() {
    const s = this.e.settings;
    return `<h2>Controls</h2><p class="lead">Keyboard, gamepad and touch work together.</p>${this.field('f-cs', 'Control sensitivity', 0.4, 1.6, 0.1, s.get('controlSensitivity'), s.get('controlSensitivity').toFixed(1) + 'x')}
      ${this.field('f-shake', 'Camera shake', 0, 2, 0.1, s.get('cameraShake'), s.get('cameraShake').toFixed(1) + 'x')}
      ${this.sw('sound', 'Sound')}${this.sw('autoDoors', 'Close doors automatically', 'After you climb into the seat')}${this.sw('cockpitHud', 'Show flight display in cockpit view', 'Off: use the instruments in the panel')}${this.sw('pauseOnMenu', 'Pause while menu is open')}
      <h3>Devices</h3><div class="tiles"><button class="tile" data-act="tilt"><b>Tilt steering</b><span>Phones and tablets</span></button><button class="tile" data-act="tiltInvert"><b>Invert tilt pitch</b><span>If it feels backwards</span></button><button class="tile" data-act="fullscreen"><b>Fullscreen</b><span>Toggle</span></button></div>
      <p class="note">Gamepad: left stick pitch and roll, right stick yaw and throttle, A brake, X gear, LB / RB flaps, B auto flaps, Y camera, Back map, Start menu.</p>`;
  }
  w_controls() { this.slider('f-cs', 'controlSensitivity', v => v, v => v.toFixed(1) + 'x'); this.slider('f-shake', 'cameraShake', v => v, v => v.toFixed(1) + 'x'); this.wireSwitches(); this.body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => this.e.bus.emit('action', b.dataset.act)); }

  // ---- Keys
  w_help() { wireRebind(this.body, this.e, () => this.render()); }
  r_help() { return `<h2>Keys</h2><p class="lead">Everything here is also in the Flight, Camera and World tabs.</p>${KEYS.map(([g, rows]) => `<h3>${g}</h3><div class="keys">${rows.map(([k, d]) => `<div><span>${d}</span><kbd>${k}</kbd></div>`).join('')}</div>`).join('')}${rebindHTML(this.e.settings)}`; }
}
