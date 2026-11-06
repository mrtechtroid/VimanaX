/** IInputSource: device tilt (phones). Toggle with action 'tilt'; calibrates to the pose at enable time. 'tiltInvert' flips pitch. */
export class TiltInput {
  constructor() { this.on = false; this.cal = null; this.o = null; this.inv = false; }
  init(bus) {
    addEventListener('deviceorientation', e => { this.o = e; });
    bus.on('action', async a => {
      if (a === 'tiltInvert') { this.inv = !this.inv; bus.emit('hud:message', `Tilt pitch ${this.inv ? 'inverted' : 'normal'}`); }
      if (a !== 'tilt') return;
      if (this.on) { this.on = false; return bus.emit('hud:message', 'Tilt controls off'); }
      try { if (typeof DeviceOrientationEvent?.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return bus.emit('hud:message', 'Tilt permission denied'); } catch { return; }
      this.on = true; this.cal = null; bus.emit('hud:message', 'Tilt on - hold device like a wheel (calibrated now)');
    });
  }
  poll() {
    if (!this.on || !this.o || this.o.beta == null) return {};
    const { beta: b, gamma: g } = this.o; if (!this.cal) this.cal = { b, g };
    const ang = (((screen.orientation?.angle ?? window.orientation ?? 0) % 360) + 360) % 360, db = b - this.cal.b, dg = g - this.cal.g;
    const [roll, pitch] = ang === 90 ? [db, -dg] : ang === 270 ? [-db, dg] : ang === 180 ? [-dg, -db] : [dg, db];
    const n = v => { v /= 25; return Math.abs(v) < 0.05 ? 0 : Math.max(-1, Math.min(1, v)); };
    return { roll: n(roll), pitch: n(this.inv ? -pitch : pitch) };
  }
}
