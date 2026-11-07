export const DEFAULT_MAP = { KeyG: 'gear', KeyF: 'flapsDown', KeyV: 'flapsUp', KeyO: 'spoiler', KeyR: 'reverse', KeyL: 'lights',
  KeyC: 'camera', KeyT: 'time', KeyU: 'units', KeyH: 'help', Tab: 'nextAircraft', KeyN: 'nextLivery',
  BracketRight: 'windUp', BracketLeft: 'windDown', KeyY: 'windTurn', KeyM: 'weather', Backspace: 'reset',
  KeyI: 'ramp', KeyK: 'cargo', Enter: 'interact', Digit6: 'door', Digit7: 'turbulence', KeyJ: 'jato', KeyB: 'autobrake', KeyP: 'map', Digit0: 'mute', Digit1: 'tilt', Digit2: 'clearRoute', Digit3: 'fullscreen',
  Digit4: 'flapsAuto', Digit5: 'cameraReset', Digit9: 'hud', Digit8: 'autopilot', Escape: 'menu' };
/** Actions the player may rebind, with menu labels. Movement axes and Esc stay fixed. */
export const REBINDABLE = { gear: 'Landing gear', flapsDown: 'Flaps down', flapsUp: 'Flaps up', flapsAuto: 'Auto flaps', spoiler: 'Spoilers', reverse: 'Reverse thrust', lights: 'Lights', autobrake: 'Autobrake', autopilot: 'Autopilot', jato: 'JATO', camera: 'Cycle camera', cameraReset: 'Reset camera', map: 'Map', interact: 'Enter / exit seat', door: 'Doors', ramp: 'Cargo ramp', cargo: 'Cargo', nextAircraft: 'Next aircraft', nextLivery: 'Next livery', time: 'Time of day', weather: 'Weather', reset: 'Reset flight', mute: 'Mute' };
/** Default map with player overrides ({action: code}) applied. */
export function effectiveMap(bindings = {}) {
  const m = { ...DEFAULT_MAP };
  for (const a in bindings) { for (const c in m) if (m[c] === a) delete m[c]; }
  for (const a in bindings) if (bindings[a]) { for (const c in m) if (c === bindings[a]) delete m[c]; m[bindings[a]] = a; }
  return m;
}

/** IInputSource: W/S pitch, A/D roll, Q/E yaw, Z/X throttle, Space brake. */
export class KeyboardInput {
  constructor() { this.k = new Set(); this.a = { pitch: 0, roll: 0, yaw: 0 }; this.map = { ...DEFAULT_MAP }; }
  setBindings(b) { this.map = effectiveMap(b); }
  init(bus) {
    addEventListener('keydown', e => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.code)) e.preventDefault();
      if (document.body.classList.contains('menu-open') && e.code !== 'Escape') return; // menu has focus
      if (e.repeat) return; this.k.add(e.code); if (this.map[e.code]) bus.emit('action', this.map[e.code]);
    });
    addEventListener('keyup', e => this.k.delete(e.code)); addEventListener('blur', () => this.k.clear());
  }
  poll(dt) {
    const d = (...c) => c.some(x => this.k.has(x)) ? 1 : 0;
    const t = { pitch: d('KeyS', 'ArrowDown') - d('KeyW', 'ArrowUp'), roll: d('KeyD', 'ArrowRight') - d('KeyA', 'ArrowLeft'), yaw: d('KeyE') - d('KeyQ') };
    for (const n in t) this.a[n] += (t[n] - this.a[n]) * Math.min(1, dt * 6);
    return { ...this.a, throttleDelta: (d('KeyZ') - d('KeyX')) * dt * 0.4, brake: d('Space') };
  }
}
