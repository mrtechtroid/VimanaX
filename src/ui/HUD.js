import * as THREE from 'three';
import { fmt } from '../config/units.js';
const _v = new THREE.Vector3();
const HELP = `W/S pitch  A/D roll  Q/E yaw
Z/X throttle  Space brake
G gear  F/V flaps  O spoilers
R reverse  L strobes
C camera  Tab aircraft  N livery
T time  M weather  [ ] wind  Y dir
U units  Backspace reset  H help
I ramp  K cargo/airdrop  Enter drive
J JATO  B autobrake  P map  0 sound
1 tilt  2 clear route  3 fullscreen`;

/** DOM HUD: telemetry, toast messages (bus 'hud:message'), help panel. */
export class HUD {
  init(e) {
    this.e = e; const r = document.getElementById('hud');
    r.innerHTML = '<pre id="tele"></pre><pre id="help"></pre><div id="msg"></div>';
    this.tele = r.querySelector('#tele'); this.msg = r.querySelector('#msg'); this.help = r.querySelector('#help'); this.help.textContent = HELP;
    e.bus.on('hud:message', m => { this.msg.textContent = m; this.msg.classList.add('on'); clearTimeout(this.t); this.t = setTimeout(() => this.msg.classList.remove('on'), 2500); });
    e.bus.on('aircraft:impact', ({ speed }) => e.bus.emit('hud:message', `Touchdown: ${speed.toFixed(1)} m/s sink`));
    e.bus.on('action', a => { if (a === 'help') this.help.hidden = !this.help.hidden; });
  }
  update() {
    const a = this.e.aircraft.player; if (!a) return;
    const u = this.e.settings.get('units'), t = a.telemetry, c = a.controls, f = a.def.flight;
    _v.set(0, 0, -1).applyQuaternion(a.quat);
    const hdg = (Math.atan2(_v.x, -_v.z) * 180 / Math.PI + 360) % 360;
    const gear = a.gearPos > 0.99 ? 'DOWN' : a.gearPos < 0.01 ? 'UP' : 'MOVING';
    this.tele.textContent = `${a.def.name}\nSPD ${fmt(u, 'speed', t.airspeed)}   ALT ${fmt(u, 'alt', a.pos.y - f.gearHeight)}\nV/S ${fmt(u, 'vs', a.vel.y)}   HDG ${String(Math.round(hdg)).padStart(3, '0')}°\nTHR ${Math.round(c.throttle * 100)}%${c.reverse ? ' REV' : ''}   FLAPS ${Math.round(a.flapPos * 100)}%   GEAR ${gear}${c.spoiler ? '   SPOILERS' : ''}\n${a.onGround ? 'ON GROUND' : ''}${Math.abs(t.aoa) > f.aoaStall ? '  *** STALL ***' : ''}\n${this.e.env.describe(v => fmt(u, 'speed', v))}`;
    const x = [this.e.map.info(a, u), a.def.cargo ? `CARGO ${a.bay.length} (${Math.round(a.mass - f.mass)} kg)  RAMP ${Math.round(a.rampPos * 100)}%` : '', c.autobrake ? 'AUTOBRAKE' : '', a.jatoLeft > 0 ? `JATO ${a.jatoLeft.toFixed(0)}s` : '', a.destroyed ? '*** DESTROYED - Backspace ***' : '', this.e.cargo.driven ? 'DRIVING - Enter to exit' : ''].filter(Boolean).join('\n');
    if (x) this.tele.textContent += '\n' + x;
  }
}
