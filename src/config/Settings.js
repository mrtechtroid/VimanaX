import { UNITS } from './units.js';
/** Global user settings. Emits 'settings' on change. */
export class Settings {
  constructor() { this.v = { units: 'aviation', controlSensitivity: 1 }; }
  init(e) {
    this.bus = e.bus;
    e.bus.on('action', a => { if (a === 'units') { const k = Object.keys(UNITS); this.set('units', k[(k.indexOf(this.v.units) + 1) % k.length]); } });
  }
  get(k) { return this.v[k]; }
  set(k, val) { this.v[k] = val; this.bus.emit('settings', { key: k, value: val }); this.bus.emit('hud:message', `${k}: ${val}`); }
}
