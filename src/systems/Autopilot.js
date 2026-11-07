import * as THREE from 'three';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), _f = new THREE.Vector3(), _r = new THREE.Vector3();

/**
 * Simple autopilot: altitude hold, heading hold (bank-to-turn) and speed hold. Toggle with 8.
 * While engaged the normal controls nudge the targets instead of flying the aircraft: W/S = altitude, A/D = heading, Z/X (throttle) = speed.
 */
export class Autopilot {
  constructor() { this.on = false; this.alt = 0; this.hdg = 0; this.spd = 0; this.thr = 0; this.last = null; this.st = null; }
  init(e) {
    this.e = e;
    e.bus.on('action', a => { if (a === 'autopilot') this.toggle(); else if (a === 'reset' || a === 'nextAircraft' || a === 'nextLivery') this.off(true); });
    e.bus.on('aircraft:spawn', () => this.off(true)); e.bus.on('aircraft:impact', () => this.off());
  }
  say(m) { this.e.bus.emit('hud:message', m); }
  off(quiet) { if (this.on && !quiet) this.say('Autopilot off'); this.on = false; this.st = null; }
  toggle() {
    const p = this.e.aircraft.player; if (!p) return;
    if (this.on) return this.off();
    if (p.onGround || p.destroyed) return this.say('Autopilot: get airborne first');
    if (this.e.walk.mode !== 'aircraft') return this.say('Autopilot: sit in the pilot seat');
    const k = this.read(p); this.alt = Math.round(p.pos.y / 10) * 10; this.hdg = k.hdg; this.spd = Math.max(k.V, p.def.flight.vRef * 0.8); this.thr = this.e.input.state.throttle; this.last = this.thr; this.on = true; this.st = null;
    this.say(`Autopilot on: ALT ${this.alt} m, HDG ${Math.round((k.hdg * 180 / Math.PI + 360) % 360)}\u00b0`);
  }
  read(p) {
    _f.set(0, 0, -1).applyQuaternion(p.quat); _r.set(1, 0, 0).applyQuaternion(p.quat);
    const V = p.vel.length(); return { hdg: Math.atan2(_f.x, -_f.z), pitch: Math.asin(clamp(_f.y, -1, 1)), bank: -Math.asin(clamp(_r.y, -1, 1)), gamma: V > 1 ? Math.asin(clamp(p.vel.y / V, -1, 1)) : 0, V };
  }
  label(units) { return `AP ${Math.round(this.alt)} m \u00b7 ${Math.round((this.hdg * 180 / Math.PI + 360) % 360)}\u00b0 \u00b7 ${Math.round(this.spd * 1.944)} kt`; }
  /** Called by PlayerController after it copied the pilot's inputs into controls. */
  apply(p, s, dt) {
    if (!this.on) return;
    if (p.onGround || p.destroyed || this.e.walk.mode !== 'aircraft') return this.off();
    const f = p.def.flight, k = this.read(p), c = p.controls, prev = this.st; dt = Math.max(dt, 1e-3);
    // pilot inputs move the targets
    if (Math.abs(s.pitch) > 0.08) this.alt -= s.pitch * (f.mass > 20000 ? 12 : 8) * dt * 2;
    if (Math.abs(s.roll) > 0.08) this.hdg = wrap(this.hdg + s.roll * 0.3 * dt);
    if (this.last != null && Math.abs(s.throttle - this.last) > 1e-4) this.spd = clamp(this.spd + (s.throttle - this.last) * 90, f.vRef * 0.75, f.vRef * 2.6);
    this.last = s.throttle;
    const rate = prev ? { b: (k.bank - prev.bank) / dt, p: (k.pitch - prev.pitch) / dt } : { b: 0, p: 0 };
    // heading -> bank -> aileron
    const bankT = clamp(wrap(this.hdg - k.hdg) * 1.3, -0.4, 0.4); c.roll = clamp((bankT - k.bank) * 1.8 - rate.b * 0.7, -1, 1);
    // altitude -> climb angle -> elevator (positive = nose up)
    const vmax = Math.min(f.mass > 20000 ? 9 : 6, k.V * 0.12), vsT = clamp((this.alt - p.pos.y) * 0.12, -vmax, vmax), gT = Math.asin(clamp(vsT / Math.max(k.V, 20), -0.3, 0.3));
    c.pitch = clamp((gT - k.gamma) * 5 - rate.p * 0.8, -0.5, 0.5);
    c.yaw = clamp(-k.bank * 0.25, -0.3, 0.3) * 0; // coordination left to the airframe's yaw stability
    // speed -> throttle (PI-ish)
    this.thr = clamp(this.thr + (this.spd - k.V) * 0.01 * dt * 4, 0, 1); c.throttle = clamp(this.thr + (this.spd - k.V) * 0.02, 0, 1);
    this.st = k;
  }
}
