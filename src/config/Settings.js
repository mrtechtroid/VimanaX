import { UNITS } from './units.js';
/** Global user settings. Emits 'settings' {key,value} on change. Pass quiet=true to suppress the HUD toast (UI widgets do). */
export class Settings {
  constructor() {
    this.v = { units: 'aviation', controlSensitivity: 1, autoFlaps: true, cameraSensitivity: 1, fov: 60, camRecenter: true, pauseOnMenu: true, sound: true, volume: 0.8, autoDoors: true, cameraShake: 1, cockpitHud: false, bindings: {} };
    this.load();
  }
  /** Persistence (localStorage, silently skipped when unavailable). Only known keys with matching types are restored. */
  load() { try { const o = JSON.parse(globalThis.localStorage?.getItem('vimanax.settings') || '{}'); for (const k in this.v) if (k in o && typeof o[k] === typeof this.v[k]) this.v[k] = o[k]; } catch { /* corrupt or blocked storage: keep defaults */ } }
  save() { try { globalThis.localStorage?.setItem('vimanax.settings', JSON.stringify(this.v)); } catch { /* private mode / quota */ } }
  init(e) {
    this.bus = e.bus;
    e.bus.on('action', a => { if (a === 'units') { const k = Object.keys(UNITS); this.set('units', k[(k.indexOf(this.v.units) + 1) % k.length]); } });
  }
  get(k) { return this.v[k]; }
  set(k, val, quiet = false) { this.v[k] = val; this.save(); this.bus.emit('settings', { key: k, value: val }); if (!quiet) this.bus.emit('hud:message', `${k}: ${val}`); }
}
