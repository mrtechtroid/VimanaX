// node --import ./tests/register.mjs tests/fleet.mjs : every registered aircraft can start up and accelerate on the runway without blowing up on the new terrain.
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';
const { e, frame, errors } = await boot();
for (const id of e.aircraft.registry.ids()) {
  e.aircraft.player.airport = e.aircraft.registry.get(id).flight.floats ? 'bay' : 'main'; // floatplanes start on the water
  e.aircraft.respawn(id, 0); frame(30); const ac = e.aircraft.player, f = ac.def.flight; let rot = false, maxV = 0, y0 = ac.pos.y;
  ac.controls.flapAuto = true; e.input.state.throttle = 1;
  for (let i = 0; i < 50 * 60 && !ac.destroyed; i++) { frame(1, 16.7); const V = ac.vel.length(); maxV = Math.max(maxV, V); e.input.state.pitch = V > f.vRef * 0.9 ? 0.45 : 0; if (V > f.vRef * 0.9) rot = true; if (ac.pos.y - y0 > 80) break; }
  const gain = ac.pos.y - y0; console.log(id.padEnd(11), 'maxV', maxV.toFixed(0), 'alt gain', gain.toFixed(0), 'destroyed', ac.destroyed, 'x,z', ac.pos.x.toFixed(0), ac.pos.z.toFixed(0));
  assert(!ac.destroyed, id + ' survives the take-off run'); assert(maxV > 22, id + ' accelerates down the runway');
  e.input.state.throttle = 0; e.input.state.pitch = 0;
}
assert.equal(errors.length, 0, 'no page errors'); console.log('ALL FLEET CHECKS PASSED');
