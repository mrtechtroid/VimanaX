// Headless physics smoke test: node tests/sim.mjs   (needs `npm i three@0.160.0` for the bare 'three' import)
import * as THREE from 'three';
import { FlightModel } from '../src/physics/FlightModel.js';
import { Aircraft } from '../src/aircraft/Aircraft.js';
import lightProp from '../src/aircraft/definitions/lightProp.js';
import transport from '../src/aircraft/definitions/transport.js';
import { World } from '../src/world/World.js';
import worldConfig from '../src/config/worldConfig.js';

const world = new World(worldConfig), model = new FlightModel();
const env = { windVector: () => new THREE.Vector3() };
const hdg = q => { const v = new THREE.Vector3(0,0,-1).applyQuaternion(q); return (Math.atan2(v.x,-v.z)*180/Math.PI+360)%360; };
const pitchDeg = q => { const v = new THREE.Vector3(0,0,-1).applyQuaternion(q); return Math.asin(v.y)*180/Math.PI; };

function fly(def, script, T = 90) {
  const ac = new Aircraft(def, 0), sp = world.spawnPoint('main');
  ac.bus = { emit: (n, d) => console.log('   EVENT', n, d.speed?.toFixed(2)) };
  ac.place(sp.pos.x, world.groundHeight(sp.pos.x, sp.pos.z) + def.flight.gearHeight, sp.pos.z, sp.heading);
  const dt = 1/120; let lift = null, log = [];
  for (let t = 0; t < T; t += dt) {
    script(ac, t); model.step(ac, dt, env, world); ac.flapPos += (def.flaps[ac.controls.flapIndex] - ac.flapPos) * 0.01; ac.gearPos += ((ac.controls.gearDown?1:0) - ac.gearPos) * 0.02;
    if (lift == null && !ac.onGround) lift = { t, V: ac.telemetry.airspeed };
    if (Math.abs(t % 5) < dt) log.push(`t=${t.toFixed(0).padStart(3)} V=${ac.telemetry.airspeed.toFixed(1)} alt=${(ac.pos.y-def.flight.gearHeight).toFixed(0)} vs=${ac.vel.y.toFixed(1)} pitch=${pitchDeg(ac.quat).toFixed(1)} aoa=${(ac.telemetry.aoa*57.3).toFixed(1)} hdg=${hdg(ac.quat).toFixed(0)} gnd=${ac.onGround} z=${ac.pos.z.toFixed(0)}`);
  }
  console.log(log.join('\n')); console.log('LIFTOFF', lift, 'destroyed', ac.destroyed); return ac;
}
console.log('--- Skylark 172: full throttle, rotate at 26 m/s, hold gentle back pressure');
fly(lightProp, (ac, t) => { const c = ac.controls; c.throttle = 1; c.pitch = ac.onGround ? (ac.telemetry.airspeed > 24 ? 0.6 : 0) : (ac.vel.y > 2.5 ? 0.05 : 0.0); c.gearDown = true; }, 60);
console.log('--- Atlas T4');
fly(transport, (ac, t) => { const c = ac.controls; c.throttle = 1; c.pitch = ac.telemetry.airspeed > 55 ? 0.35 : 0; }, 90);
