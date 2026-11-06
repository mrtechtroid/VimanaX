/** Maps input state + discrete actions onto the player's aircraft controls. */
export class PlayerController {
  init(e) {
    this.e = e;
    e.bus.on('action', a => {
      const p = e.aircraft.player; if (!p) return; const c = p.controls, say = m => e.bus.emit('hud:message', m);
      if (a === 'gear') { if (p.onGround && c.gearDown) return say('Cannot retract gear on the ground'); c.gearDown = !c.gearDown; say(c.gearDown ? 'Gear down' : 'Gear up'); }
      else if (a === 'flapsDown') { c.flapIndex = Math.min(p.def.flaps.length - 1, c.flapIndex + 1); say(`Flaps ${c.flapIndex}`); }
      else if (a === 'flapsUp') { c.flapIndex = Math.max(0, c.flapIndex - 1); say(`Flaps ${c.flapIndex}`); }
      else if (a === 'spoiler') { c.spoiler = c.spoiler ? 0 : 1; say(c.spoiler ? 'Spoilers out' : 'Spoilers in'); }
      else if (a === 'reverse') { c.reverse = !c.reverse; say(c.reverse ? 'Thrust reverse armed' : 'Thrust reverse off'); }
      else if (a === 'lights') { c.lights = !c.lights; say(c.lights ? 'Strobes on' : 'Strobes off'); }
    });
  }
  update() {
    const p = this.e.aircraft.player, s = this.e.input.state; if (!p) return;
    Object.assign(p.controls, { pitch: s.pitch, roll: s.roll, yaw: s.yaw, throttle: s.throttle, brake: s.brake });
  }
}
