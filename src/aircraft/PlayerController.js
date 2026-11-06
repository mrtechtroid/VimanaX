import { updateFlaps } from './FlapLogic.js';

/** Maps input state + discrete actions onto the player's aircraft controls (autobrake, JATO, gear, flaps...). Zeroed while driving a vehicle. */
export class PlayerController {
  init(e) {
    this.e = e;
    e.bus.on('action', a => {
      const p = e.aircraft.player; if (!p) return; const c = p.controls, say = m => e.bus.emit('hud:message', m);
      if (a === 'gear') { if (p.gearDamaged) return say('Gear damaged'); if (p.onGround && c.gearDown) return say('Cannot retract gear on the ground'); c.gearDown = !c.gearDown; say(c.gearDown ? 'Gear down' : 'Gear up'); }
      else if (a === 'flapsDown' || a === 'flapsUp') { this.stepFlaps(p, a === 'flapsDown' ? 1 : -1); }
      else if (a === 'flapsAuto') { const on = !e.settings.get('autoFlaps'); e.settings.set('autoFlaps', on, true); say(on ? 'Auto flaps on' : 'Auto flaps off - manual'); }
      else if (a === 'spoiler') { c.spoiler = c.spoiler ? 0 : 1; say(c.spoiler ? 'Spoilers out' : 'Spoilers in'); }
      else if (a === 'reverse') { c.reverse = !c.reverse; say(c.reverse ? 'Thrust reverse armed' : 'Thrust reverse off'); }
      else if (a === 'lights') { c.lights = !c.lights; say(c.lights ? 'Strobes on' : 'Strobes off'); }
      else if (a === 'autobrake') { c.autobrake = !c.autobrake; say(c.autobrake ? 'Autobrake armed' : 'Autobrake off'); }
      else if (a === 'jato') { const j = p.def.flight.jato; if (!j) return say('No JATO fitted'); if (p.jatoLeft > 0) return; p.jatoLeft = j.time; say('JATO fired'); }
    });
    e.bus.on('flaps:set', i => { const p = e.aircraft.player; if (!p) return; this.manual(); p.controls.flapIndex = Math.max(0, Math.min(p.def.flaps.length - 1, i)); });
  }
  /** Any manual flap input drops out of auto mode (and says so once). */
  manual() { if (this.e.settings.get('autoFlaps')) { this.e.settings.set('autoFlaps', false, true); this.e.bus.emit('hud:message', 'Auto flaps off - manual'); } }
  stepFlaps(p, d) { this.manual(); const c = p.controls; c.flapIndex = Math.max(0, Math.min(p.def.flaps.length - 1, c.flapIndex + d)); this.e.bus.emit('hud:message', `Flaps ${c.flapIndex}`); }
  update(dt) {
    const p = this.e.aircraft.player, s = this.e.input.state; if (!p) return;
    p.controls.flapAuto = this.e.settings.get('autoFlaps'); updateFlaps(p, dt, this.e.world, m => this.e.bus.emit('hud:message', m));
    if (this.e.cargo.driven) return void Object.assign(p.controls, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1 });
    Object.assign(p.controls, { pitch: s.pitch, roll: s.roll, yaw: s.yaw, throttle: s.throttle, brake: s.brake });
    if (p.controls.autobrake && p.onGround && p.vel.length() > 2 && s.throttle < 0.05) p.controls.brake = Math.max(p.controls.brake, 0.8);
  }
}
