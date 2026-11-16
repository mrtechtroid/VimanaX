import { flapSpeeds } from '../aircraft/FlapLogic.js';
import { effectiveMap } from '../input/KeyboardInput.js';
import { pretty } from './Rebind.js';

/** Flight coach: one short, contextual hint above the PFD that follows the flight (power, rotate, gear up, explore, gear down, flare, brake).
 *  Stateless apart from "have we been airborne yet" and a minimum display time, so it never nags after the step is done.
 *  Key names follow the player's bindings; touch players get the touch wording. Dismiss with the x (setting `coach`, also in Menu > Controls). */
export class Coach {
  constructor() { this.cur = null; this.t = 0; this.reset(); }
  reset() { this.flew = false; this.cruiseT = 0; this.cruiseDone = false; }
  init(e) {
    this.e = e; const dock = document.getElementById('dock'), el = this.el = document.createElement('div');
    el.id = 'coach'; el.className = 'glass'; el.hidden = true; el.setAttribute('role', 'status'); el.innerHTML = '<span></span><button class="x" type="button" aria-label="Hide flight tips">\u00d7</button>';
    dock.insertBefore(el, document.getElementById('pfd')); this.txt = el.firstChild;
    el.querySelector('.x').onclick = () => { e.settings.set('coach', false, true); e.bus.emit('hud:message', 'Flight tips off. Turn them back on in Menu, Controls'); };
    e.bus.on('aircraft:spawn', () => { this.reset(); this.show(null); });
  }
  /** Which hint applies right now (an id, or null). */
  pick(a, e, dt) {
    const c = a.controls, V = a.telemetry.airspeed, vr = flapSpeeds(a.def).vs1 * 1.2, agl = a.pos.y - e.world.groundHeight(a.pos.x, a.pos.z) - a.def.flight.gearHeight, vy = a.vel.y;
    if (agl > 30) this.flew = true;
    if (e.autopilot?.on) return null;
    if (a.onGround) {
      if (!this.flew) { if (V < 3 && c.throttle < 0.05) return 'power'; if (V < vr * 0.95) return c.throttle < 0.8 ? 'fullpower' : null; return 'rotate'; }
      return V > 8 ? 'rollout' : null;
    }
    if (c.gearDown && agl > 12 && vy > 1) return 'gearUp';
    if (!c.gearDown && agl < 300 && vy < -1.5) return 'gearDown';
    if (c.gearDown && agl < 25 && vy < -1) return 'flare';
    if (!this.cruiseDone && agl > 120) { this.cruiseT += dt; if (this.cruiseT > 12) this.cruiseDone = true; return 'explore'; }
    return null;
  }
  text(id) {
    const m = effectiveMap(this.e.settings.get('bindings')), k = a => { const c = Object.keys(m).find(x => m[x] === a); return `<kbd>${c ? pretty(c) : '?'}</kbd>`; };
    const touch = document.body.classList.contains('coarse');
    const T = {
      power: touch ? 'Drag the <b>Power</b> slider up to start rolling' : 'Hold <kbd>Z</kbd> to add power and start rolling',
      fullpower: touch ? 'Full power for takeoff. Steer with the rudder buttons' : 'Full power for takeoff. Steer with <kbd>Q</kbd> <kbd>E</kbd>',
      rotate: touch ? 'Pull the pad down gently to take off' : 'Pull back gently with <kbd>S</kbd> to take off',
      gearUp: touch ? 'Climbing. Tap <b>Gear</b> to raise it' : `Climbing. Raise the gear with ${k('gear')}`,
      explore: touch ? 'Tap <b>More</b> for autopilot and map, <b>View</b> for cameras' : `${k('autopilot')} autopilot, ${k('camera')} camera, ${k('map')} map`,
      gearDown: touch ? 'Landing? Tap <b>Gear</b> to lower it' : `Landing? Lower the gear with ${k('gear')}`,
      flare: 'Ease the nose up and bring the power down to touch down softly',
      rollout: touch ? 'Hold <b>Brake</b> to slow down' : 'Hold <kbd>Space</kbd> to brake',
    };
    return T[id];
  }
  show(id) { if (id === this.cur) return; this.cur = id; this.t = 0; this.el.hidden = !id; if (id) this.txt.innerHTML = this.text(id); }
  update(dt) {
    const e = this.e, a = e.aircraft.player, B = document.body.classList;
    if (!a || a.destroyed || !e.settings.get('coach') || e.walk.mode !== 'aircraft' || e.paused || B.contains('splash-open')) return this.show(null);
    this.t += dt; const id = this.pick(a, e, dt);
    if (id !== this.cur && (!this.cur || this.t > 2.2)) this.show(id); // each hint stays at least 2 s so it can be read
  }
}
