/** Maps input state + discrete actions onto the player's aircraft controls (autobrake, JATO, gear, flaps...). Zeroed while driving a vehicle. */
export class PlayerController {
  init(e) {
    this.e = e;
    e.bus.on('action', a => {
      const p = e.aircraft.player; if (!p) return; const c = p.controls, say = m => e.bus.emit('hud:message', m);
      if (a === 'gear') { if (p.gearDamaged) return say('Gear damaged'); if (p.onGround && c.gearDown) return say('Cannot retract gear on the ground'); c.gearDown = !c.gearDown; say(c.gearDown ? 'Gear down' : 'Gear up'); }
      else if (a === 'flapsDown') { c.flapIndex = Math.min(p.def.flaps.length - 1, c.flapIndex + 1); say(`Flaps ${c.flapIndex}`); }
      else if (a === 'flapsUp') { c.flapIndex = Math.max(0, c.flapIndex - 1); say(`Flaps ${c.flapIndex}`); }
      else if (a === 'spoiler') { c.spoiler = c.spoiler ? 0 : 1; say(c.spoiler ? 'Spoilers out' : 'Spoilers in'); }
      else if (a === 'reverse') { c.reverse = !c.reverse; say(c.reverse ? 'Thrust reverse armed' : 'Thrust reverse off'); }
      else if (a === 'lights') { c.lights = !c.lights; say(c.lights ? 'Strobes on' : 'Strobes off'); }
      else if (a === 'autobrake') { c.autobrake = !c.autobrake; say(c.autobrake ? 'Autobrake armed' : 'Autobrake off'); }
      else if (a === 'jato') { const j = p.def.flight.jato; if (!j) return say('No JATO fitted'); if (p.jatoLeft > 0) return; p.jatoLeft = j.time; say('JATO fired'); }
    });
  }
  update() {
    const p = this.e.aircraft.player, s = this.e.input.state; if (!p) return;
    if (this.e.cargo.driven) return void Object.assign(p.controls, { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 1 });
    Object.assign(p.controls, { pitch: s.pitch, roll: s.roll, yaw: s.yaw, throttle: s.throttle, brake: s.brake });
    if (p.controls.autobrake && p.onGround && p.vel.length() > 2 && s.throttle < 0.05) p.controls.brake = Math.max(p.controls.brake, 0.8);
  }
}
