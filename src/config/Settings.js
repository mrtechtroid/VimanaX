import { UNITS } from './units.js';
/** Global user settings. Emits 'settings' {key,value} on change. Pass quiet=true to suppress the HUD toast (UI widgets do). */
export class Settings {
  constructor() {
    this.v = { units: 'aviation', controlSensitivity: 1, autoFlaps: true, cameraSensitivity: 1, fov: 60, camRecenter: true, pauseOnMenu: true, sound: true };
  }
  init(e) {
    this.bus = e.bus;
    e.bus.on('action', a => { if (a === 'units') { const k = Object.keys(UNITS); this.set('units', k[(k.indexOf(this.v.units) + 1) % k.length]); } });
  }
  get(k) { return this.v[k]; }
  set(k, val, quiet = false) { this.v[k] = val; this.bus.emit('settings', { key: k, value: val }); if (!quiet) this.bus.emit('hud:message', `${k}: ${val}`); }
}
