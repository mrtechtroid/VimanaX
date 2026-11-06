// node tests/flaps.mjs  - auto-flap schedule: synthetic states, then a dynamic takeoff/approach run through the real FlightModel
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { FlightModel } from '../src/physics/FlightModel.js';
import { Aircraft } from '../src/aircraft/Aircraft.js';
import { updateFlaps, flapSpeeds } from '../src/aircraft/FlapLogic.js';
import lightProp from '../src/aircraft/definitions/lightProp.js';
import transport from '../src/aircraft/definitions/transport.js';
import { World } from '../src/world/World.js';
import worldConfig from '../src/config/worldConfig.js';
const world = new World(worldConfig), env = { windVector: () => new THREE.Vector3() };

for (const d of [lightProp, transport]) { const s = flapSpeeds(d); console.log(d.id, 'Vs1', s.vs1.toFixed(1), 'Vs0', s.vs0.toFixed(1), 'Vfe', s.vfe.map(v => isFinite(v) ? v.toFixed(1) : '-').join('/'), 'm/s'); }

// ---- synthetic states -------------------------------------------------------
function settle(def, o, secs = 10) {
  const ac = new Aircraft(def, 0); ac.pos.set(0, 0, 3000); // sea at y=0..; place on an arbitrary spot, agl from o.agl
  const gy = world.groundHeight(ac.pos.x, ac.pos.z); ac.pos.y = gy + def.flight.gearHeight + (o.agl ?? 0);
  Object.assign(ac.controls, { throttle: o.thr ?? 0, gearDown: o.gear ?? true, flapIndex: o.flap ?? 0, flapAuto: o.auto ?? true });
  ac.onGround = !!o.ground; ac.telemetry.airspeed = o.V; ac.vel.set(0, o.vy ?? 0, 0); const log = [];
  for (let t = 0; t < secs; t += 1 / 60) updateFlaps(ac, 1 / 60, world, m => log.push(m));
  return { idx: ac.controls.flapIndex, why: ac.flapReason, log };
}
const L = lightProp;
const cases = [
  ['parked, idle',               { ground: 1, thr: 0, V: 0 },                       0],
  ['takeoff roll',               { ground: 1, thr: 1, V: 15 },                      1],
  ['landing rollout retracts',   { ground: 1, thr: 0, V: 20, flap: 3 },             0],
  ['cruise, gear up, fast',      { agl: 500, gear: false, V: 45 },                  0],
  ['cruise, slow (1.2 Vs1)',     { agl: 500, gear: false, V: 30, thr: 0.4 },        1],
  ['very slow (1.1 Vs1)',        { agl: 500, gear: false, V: 27, thr: 0.4 },        2],
  ['approach slow, gear down',   { agl: 300, gear: true, V: 33, thr: 0.2 },         3],
  ['approach too fast for full', { agl: 300, gear: true, V: 40, thr: 0.2 },         2],
  ['approach way too fast',      { agl: 300, gear: true, V: 55, thr: 0.2 },         0],
  ['go-around (power + climb)',  { agl: 150, gear: true, V: 33, thr: 1, vy: 2, flap: 3 }, 1],
  ['climb-out under 60 m AGL',   { agl: 30, gear: true, V: 35, thr: 1 },            1],
  ['manual mode keeps notch',    { agl: 300, gear: true, V: 33, auto: false, flap: 2 }, 2],
  ['manual overspeed relief',    { agl: 300, gear: false, V: 55, auto: false, flap: 3 }, 0],
];
let bad = 0;
for (const [name, o, want] of cases) { const r = settle(L, o); const ok = r.idx === want; if (!ok) bad++; console.log(ok ? 'ok  ' : 'FAIL', name.padEnd(30), 'flap', r.idx, '(want', want + ')', r.why, r.log[0] ? '| ' + r.log[0] : ''); }

// ---- dynamic: takeoff, climb, descent to landing with auto flaps ---------------------
function fly(def, vRot, vApp) {
  const model = new FlightModel(), ac = new Aircraft(def, 0), sp = world.spawnPoint('main');
  ac.bus = { emit: (n, d) => console.log('   EVENT', n, d.speed?.toFixed(2)) };
  ac.place(sp.pos.x, world.groundHeight(sp.pos.x, sp.pos.z) + def.flight.gearHeight, sp.pos.z, sp.heading);
  const dt = 1 / 120, c = ac.controls, fwd = new THREE.Vector3(); let last = '', phase = 'roll', tp = 0, gearUp = false;
  const pitchDeg = () => Math.asin(fwd.set(0, 0, -1).applyQuaternion(ac.quat).y) * 57.3;
  for (let t = 0; t < 400; t += dt) {
    const agl = ac.pos.y - def.flight.gearHeight - world.groundHeight(ac.pos.x, ac.pos.z), V = ac.telemetry.airspeed, p = pitchDeg();
    const hold = (deg) => Math.max(-1, Math.min(1, (deg - p) * 0.12 - ac.angVel.x * 0.5));
    if (phase === 'roll') { c.throttle = 1; c.pitch = V > vRot ? hold(10) : 0; if (!ac.onGround) phase = 'climb'; }
    else if (phase === 'climb') { c.throttle = 1; c.pitch = hold(agl < 60 ? 9 : 6); if (agl > 40 && !gearUp) { c.gearDown = false; gearUp = true; } if (agl > 400) { phase = 'cruise'; tp = t; } }
    else if (phase === 'cruise') { c.throttle = 0.45; c.pitch = hold(2 - (ac.vel.y) * 0.8); if (t - tp > 25) phase = 'descend'; }
    else if (phase === 'descend') { c.throttle = 0.15; c.gearDown = true; c.pitch = hold(V > vApp ? 2 : -1); if (agl < 14) phase = 'flare'; }
    else if (phase === 'flare') { c.throttle = 0; c.pitch = hold(ac.vel.y < -1.2 ? 6 : 3); if (ac.onGround) { phase = 'rollout'; } }
    else if (phase === 'rollout') { c.throttle = 0; c.pitch = 0; c.brake = 0.6; if (V < 3) break; }
    ac.telemetry.airspeed; model.step(ac, dt, env, world); updateFlaps(ac, dt, world, m => console.log('   say:', m));
    ac.flapPos += (def.flaps[c.flapIndex] - ac.flapPos) * Math.min(1, dt / 1.5); ac.gearPos += ((c.gearDown ? 1 : 0) - ac.gearPos) * Math.min(1, dt / 1.5);
    const s = `${phase.padEnd(7)} flap ${c.flapIndex} (${ac.flapReason})`;
    if (s !== last) { console.log(`t=${t.toFixed(1).padStart(6)} V=${V.toFixed(1).padStart(5)} agl=${agl.toFixed(0).padStart(4)} gear=${c.gearDown ? 'dn' : 'up'}  ${s}`); last = s; }
  }
  console.log('end: V', ac.telemetry.airspeed.toFixed(1), 'onGround', ac.onGround, 'destroyed', ac.destroyed, 'gearDamaged', ac.gearDamaged);
}
console.log('\n--- dynamic Skylark'); fly(lightProp, 26, 34);
console.log('\n--- dynamic Atlas'); fly(transport, 52, 56);
if (bad) { console.error(bad, 'synthetic case(s) failed'); process.exit(1); }
