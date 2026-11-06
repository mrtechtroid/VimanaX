import * as THREE from 'three';
import { flapSpeeds } from '../aircraft/FlapLogic.js';
const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), M2KT = 1.943844, M2FT = 3.28084;
/** Everything the HUD PFD and the 3D cockpit instruments need, computed once per frame from the aircraft + world. SI plus ready-made aviation units. */
export function instrumentState(e, a, o = {}) {
  const f = a.def.flight, c = a.controls, t = a.telemetry;
  _f.set(0, 0, -1).applyQuaternion(a.quat); _r.set(1, 0, 0).applyQuaternion(a.quat); _u.set(0, 1, 0).applyQuaternion(a.quat);
  const hdg = (Math.atan2(_f.x, -_f.z) * 180 / Math.PI + 360) % 360, pitch = Math.asin(Math.max(-1, Math.min(1, _f.y))), roll = Math.atan2(-_r.y, _u.y);
  const alt = a.pos.y - f.gearHeight, agl = alt - e.world.groundHeight(a.pos.x, a.pos.z), sp = flapSpeeds(a.def, a.mass), n = a.def.flaps.length;
  o.pitch = pitch; o.roll = roll; o.hdg = hdg; o.spd = t.airspeed; o.gs = Math.hypot(a.vel.x, a.vel.z); o.alt = alt; o.agl = agl; o.vs = a.vel.y; o.aoa = t.aoa; o.aoaFrac = Math.max(0, t.aoa) / f.aoaStall;
  o.slip = Math.max(-1, Math.min(1, -(_r.dot(a.vel) / Math.max(10, a.vel.length())) * 3)); o.turn = -a.angVel.y; // +: turning right
  o.bands = { vs0: sp.vs0, vs1: sp.vs1, vfeLast: sp.vfe[n - 1] === Infinity ? sp.vs1 * 2 : sp.vfe[n - 1], vfeCur: sp.vfe[c.flapIndex], vfe: sp.vfe };
  o.rpm = 650 + c.throttle * 1950 * (a.destroyed ? 0 : 1); o.throttle = c.throttle; o.flapIdx = c.flapIndex; o.flapPos = a.flapPos; o.gearPos = a.gearPos; o.onGround = a.onGround; o.kt = t.airspeed * M2KT; o.ft = alt * M2FT; o.fpm = a.vel.y * 196.85;
  return o;
}
