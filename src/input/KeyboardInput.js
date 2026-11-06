const MAP = { KeyG: 'gear', KeyF: 'flapsDown', KeyV: 'flapsUp', KeyO: 'spoiler', KeyR: 'reverse', KeyL: 'lights',
  KeyC: 'camera', KeyT: 'time', KeyU: 'units', KeyH: 'help', Tab: 'nextAircraft', KeyN: 'nextLivery',
  BracketRight: 'windUp', BracketLeft: 'windDown', KeyY: 'windTurn', KeyM: 'weather', Backspace: 'reset' };

/** IInputSource: W/S pitch, A/D roll, Q/E yaw, Z/X throttle, Space brake. */
export class KeyboardInput {
  constructor() { this.k = new Set(); this.a = { pitch: 0, roll: 0, yaw: 0 }; }
  init(bus) {
    addEventListener('keydown', e => {
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'Backspace'].includes(e.code)) e.preventDefault();
      if (e.repeat) return; this.k.add(e.code); if (MAP[e.code]) bus.emit('action', MAP[e.code]);
    });
    addEventListener('keyup', e => this.k.delete(e.code));
  }
  poll(dt) {
    const d = (...c) => c.some(x => this.k.has(x)) ? 1 : 0;
    const t = { pitch: d('KeyS', 'ArrowDown') - d('KeyW', 'ArrowUp'), roll: d('KeyD', 'ArrowRight') - d('KeyA', 'ArrowLeft'), yaw: d('KeyE') - d('KeyQ') };
    for (const n in t) this.a[n] += (t[n] - this.a[n]) * Math.min(1, dt * 6);
    return { ...this.a, throttleDelta: (d('KeyZ') - d('KeyX')) * dt * 0.4, brake: d('Space') };
  }
}
