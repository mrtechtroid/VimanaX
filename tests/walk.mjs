// node --import ./tests/register.mjs tests/walk.mjs : on-foot play, doors, boarding, vehicles, drive-in/out, surfaces, turbulence, clouds.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { boot } from './harness.mjs';
const { e, frame, key, press, hold, $, errors } = await boot(); const say = (...a) => console.log(...a);
const ac = () => e.aircraft.player, walk = e.walk, near = (a, b, d) => Math.hypot(a.x - b.x, a.z - b.z) < d;
const settle = n => { e.input.state.throttle = 0; frame(n); };

// ---------- Skylark: stand up through the pilot door --------------------------------------------------------------
settle(60); const d = ac().door('doorL'); assert(d && ac().def.cockpit, 'doors + cockpit exist');
frame(1); ac().vel.set(0, 0, 0); e.input.state.throttle = 0; e.bus.emit('action', 'interact'); frame(2);
assert.equal(walk.mode, 'foot', 'Enter stands the pilot up'); assert.equal(d.target, 1, 'pilot door opens when standing up'); frame(90); assert(d.pos > 0.95, 'door animates open');
say('stood up: pos', walk.pos.toArray().map(v => v.toFixed(1)).join(','), '| door pos', d.pos.toFixed(2), '| camera first person');
const door = new THREE.Vector3(-1.6, 0, -0.1).applyQuaternion(ac().quat).add(ac().pos); assert(near(walk.pos, door, 1), 'walker placed at the open door');
assert(walk.prompt && /climb in/i.test(walk.prompt.text), 'prompt offers to climb in: ' + walk.prompt?.text);
// walk into the fuselage: must be blocked by the hull
walk.yaw = -Math.PI / 2 * -1; /* face +x? compute toward aircraft */ const toAc = Math.atan2(-(ac().pos.x - walk.pos.x), -(ac().pos.z - walk.pos.z)); walk.yaw = toAc; key('KeyW'); frame(120); key('KeyW', 'keyup'); key('KeyS', 'keyup'); frame(20);
const lp = walk.pos.clone().sub(ac().pos).applyQuaternion(ac().quat.clone().invert()); say('after walking into the plane, local x =', lp.x.toFixed(2)); assert(Math.abs(lp.x) > 0.75, 'hull blocks walking through the fuselage');
// walking speed / sprint, third person, camera
const p0 = walk.pos.clone(); walk.yaw = toAc + Math.PI; key('KeyW'); frame(60); const dWalk = walk.pos.distanceTo(p0); key('KeyW', 'keyup'); key('KeyS', 'keyup'); frame(30);
const p1 = walk.pos.clone(); key('ShiftLeft'); key('KeyW'); frame(60); const dRun = walk.pos.distanceTo(p1); key('ShiftLeft', 'keyup'); key('KeyW', 'keyup'); key('KeyS', 'keyup'); frame(30);
say('1 s of walking', dWalk.toFixed(2), 'm, running', dRun.toFixed(2), 'm'); assert(dRun > dWalk * 1.8 && dWalk > 1 && dWalk < 2.6, 'walk ~1.9 m/s, sprint ~5 m/s');
e.bus.emit('action', 'camera'); frame(3); assert(walk.third, 'camera key toggles third person on foot'); assert(walk.avatar.visible, 'avatar visible in third person'); e.bus.emit('action', 'camera'); frame(2);
const eyeY = e.camera.position.y - walk.pos.y; say('eye height', eyeY.toFixed(2)); assert(eyeY > 1.4 && eyeY < 1.9);
// jump
frame(5); key('Space'); frame(10); const jy = walk.pos.y; key('Space', 'keyup'); frame(60); say('jump apex y +', (jy - walk.pos.y).toFixed(2)); 
// walk back to the door, climb in, door auto-closes
walk.pos.copy(door); walk.pos.y = e.world.groundHeight(door.x, door.z); frame(3); assert(walk.prompt, 'prompt at door'); e.bus.emit('action', 'interact'); frame(2); assert.equal(walk.mode, 'aircraft', 'E at open door sits the pilot'); assert.equal(e.cameras.mode, 'cockpit');
frame(300); assert(d.target === 0 && d.pos < 0.05, 'door closes itself after boarding (auto doors)');
// cockpit instruments render when inside
assert(e.cameras.inside, 'camera inside'); const cp = ac().mesh.userData.cockpit; assert(cp.parts.screens[0].g, 'instrument canvas created lazily'); say('cockpit panels:', cp.parts.screens.map(s => s.kind).join(','));
// toggle door from the seat
e.bus.emit('action', 'door'); frame(100); assert(d.pos > 0.9, 'door action from seat'); e.bus.emit('action', 'door'); frame(100); assert(d.pos < 0.05);
// copilot view
e.cameras.set('copilot'); frame(60); const eyeC = e.camera.position.clone().sub(ac().pos).applyQuaternion(ac().quat.clone().invert()); say('copilot eye local x', eyeC.x.toFixed(2)); assert(eyeC.x > 0.2, 'copilot camera is on the right');

// ---------- Atlas: interior, ramp, drive-in / drive-out ---------------------------------------------------------------------
e.bus.emit('action', 'nextAircraft'); frame(5); assert.equal(ac().def.id, 'transport'); settle(60);
e.bus.emit('action', 'interact'); frame(3); assert.equal(walk.mode, 'foot'); assert.equal(walk.inside, ac(), 'standing up in the Atlas keeps you inside'); say('Atlas: stood up inside at local z', walk.pos.clone().sub(ac().pos).applyQuaternion(ac().quat.clone().invert()).z.toFixed(1));
// walk aft down the cabin to the ramp area and open the ramp via the prompt
const toLocal = () => walk.pos.clone().sub(ac().pos).applyQuaternion(ac().quat.clone().invert());
walk.yaw = walk.aircraftYaw(ac()) + Math.PI; key('KeyW'); frame(60 * 10); key('KeyW', 'keyup'); key('KeyS', 'keyup'); frame(10); say('walked aft to local z', toLocal().z.toFixed(1)); assert(toLocal().z > 3, 'walked down the cabin');
walk.pos.copy(ac().pos).add(new THREE.Vector3(0, ac().def.interior.floorY, 9.8).applyQuaternion(ac().quat)); frame(3); say('prompt near ramp:', walk.prompt?.text); assert(/ramp/i.test(walk.prompt?.text), 'ramp control prompt inside'); e.bus.emit('action', 'interact'); frame(200); assert(ac().rampPos > 0.99, 'ramp opens');
// walk down the ramp and out
walk.yaw = walk.aircraftYaw(ac()) + Math.PI; key('KeyW'); frame(60 * 4); key('KeyW', 'keyup'); key('KeyS', 'keyup'); frame(5); say('after the ramp: inside =', !!walk.inside, 'y above ground', (walk.pos.y - e.world.groundHeight(walk.pos.x, walk.pos.z)).toFixed(2)); assert(!walk.inside, 'walked off the ramp end'); 
// walk back in (auto-enter via ramp)
walk.yaw = walk.aircraftYaw(ac()); key('KeyW'); frame(60 * 3); key('KeyW', 'keyup'); key('KeyS', 'keyup'); frame(3); assert(walk.inside === ac(), 'walking up the ramp enters the cabin');
// doors: crew door from inside
walk.pos.copy(ac().pos).add(new THREE.Vector3(-1.0, ac().def.interior.floorY, -8.65).applyQuaternion(ac().quat)); frame(3); say('crew door prompt:', walk.prompt?.text); assert(/crew door/i.test(walk.prompt.text)); e.bus.emit('action', 'interact'); frame(90); e.bus.emit('action', 'interact'); frame(3); assert(!walk.inside, 'exited via the crew door'); say('exited crew door at', walk.pos.toArray().map(v => v.toFixed(1)).join(','));
// vehicles: scout, drive, steer, exit
const scout = e.cargo.items.find(i => i.kind === 'scout'), sport = e.cargo.items.find(i => i.kind === 'sport'), truck = e.cargo.items.find(i => i.kind === 'truck');
walk.pos.set(scout.pos.x + 3, scout.pos.y, scout.pos.z); frame(3); assert(/drive scout/i.test(walk.prompt?.text), 'prompt to drive: ' + walk.prompt?.text); e.bus.emit('action', 'interact'); frame(3); assert.equal(walk.mode, 'vehicle'); assert.equal(e.cargo.driven, scout);
const s0 = scout.pos.clone(), y0 = scout.yaw; key('KeyW'); frame(120); key('KeyD'); frame(90); key('KeyD', 'keyup'); key('KeyW', 'keyup'); key('KeyS', 'keyup'); say('scout drove', scout.pos.distanceTo(s0).toFixed(1), 'm, speed', scout.speed.toFixed(1), 'm/s, yaw', scout.yaw.toFixed(2)); assert(scout.pos.distanceTo(s0) > 20 && Math.abs(scout.yaw - y0) > 0.2 && Math.abs(scout.yaw - y0) < 1.5, 'vehicle accelerates and steers (grip-limited)');
key('Space'); frame(300); key('Space', 'keyup'); assert(Math.abs(scout.speed) < 0.5, 'brakes stop it'); e.bus.emit('action', 'interact'); frame(3); assert.equal(walk.mode, 'foot', 'exit vehicle'); assert(e.cargo.driven == null);
// top speed differs per vehicle and per surface
const topOf = (it) => { walk.mode = 'vehicle'; e.cargo.driven = it; it.speed = 0; key('KeyW'); frame(60 * 20); const v = it.speed; key('KeyW', 'keyup'); key('KeyS', 'keyup'); key('Space'); frame(60 * 8); key('Space', 'keyup'); e.cargo.driven = null; walk.mode = 'foot'; return v; };

// ---------- drive the Ferrari up the ramp into the Atlas, then back out ---------------------------------------------------------------
e.bus.emit('action', 'reset'); frame(5); settle(30); const A = ac(); assert.equal(A.def.id, 'transport'); assert.equal(walk.mode, 'aircraft', 'reset puts the pilot back in the seat');
// park the aircraft stationary, ramp open
e.bus.emit('action', 'ramp'); frame(200); assert(A.rampPos > 0.99);
const back = new THREE.Vector3(0, 0, 1).applyQuaternion(A.quat), hz = A.mesh.userData.parts.rampAngles.hingeZ;
sport.pos.copy(A.pos).addScaledVector(back, 28); sport.pos.y = e.world.groundHeight(sport.pos.x, sport.pos.z); sport.yaw = Math.atan2(back.x, back.z) + Math.PI * 0 ; sport.yaw = Math.atan2(-(-back.x), -(-back.z)) ; // face the aircraft: forward = -back
{ const f = back.clone().negate(); sport.yaw = Math.atan2(-f.x, -f.z); } sport.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sport.yaw);
walk.mode = 'vehicle'; e.cargo.driven = sport; walk.avatar.visible = false; key('KeyW'); let stowed = false, maxY = -1e9;
for (let i = 0; i < 60 * 14; i++) { frame(1); const l = sport.pos.clone().sub(A.pos).applyQuaternion(A.quat.clone().invert()); if (l.z < hz && l.z > hz - 4) maxY = Math.max(maxY, sport.pos.y - A.pos.y); if (sport.state === 'bay') { stowed = true; break; } }
key('KeyW', 'keyup'); key('KeyS', 'keyup'); say('drove in: stowed =', stowed, '| bay =', A.bay.length, '| deck height rel. aircraft', maxY.toFixed(2), '| driver now', walk.mode, 'inside', walk.inside === A); assert(stowed, 'Ferrari drove up the ramp and was secured'); assert.equal(e.cargo.driven, null); assert(walk.mode === 'foot' && walk.inside === A, 'driver steps out inside the bay'); assert(A.mass > A.def.flight.mass + 1000, 'bay cargo adds weight');
frame(3); const lb = sport.pos.clone().sub(A.pos).applyQuaternion(A.quat.clone().invert()); say('Ferrari parked at local', lb.x.toFixed(2), lb.y.toFixed(2), lb.z.toFixed(2)); assert(Math.abs(lb.x) < 0.1 && lb.z < hz - 4 && lb.z > -8.6, 'parked inside the bay');
// drive out again
walk.pos.copy(sport.pos).add(new THREE.Vector3(-2.2, 0.0, 0).applyQuaternion(A.quat)); frame(3); say('prompt:', walk.prompt?.text); assert(/drive ferrari/i.test(walk.prompt?.text)); e.bus.emit('action', 'interact'); frame(3); assert.equal(e.cargo.driven, sport); assert.equal(sport.state, 'ground'); assert.equal(A.bay.length, 0);
key('KeyS'); frame(10); /* reverse is slow: drive out backwards */ key('KeyW', 'keyup'); key('KeyS', 'keyup');
// turn the car around 180 in the bay is impossible; instead reverse out the ramp
key('KeyS'); let out = false; for (let i = 0; i < 60 * 40; i++) { frame(1); const l = sport.pos.clone().sub(A.pos).applyQuaternion(A.quat.clone().invert()); if (l.z > 17.5) { out = true; break; } } key('KeyW', 'keyup'); key('KeyS', 'keyup'); say('reversed out of the aircraft:', out, 'height above ground', (sport.pos.y - e.world.groundHeight(sport.pos.x, sport.pos.z)).toFixed(2)); assert(out, 'drove back out down the ramp'); assert(Math.abs(sport.pos.y - e.world.groundHeight(sport.pos.x, sport.pos.z)) < 0.4, 'back on the ground at the ramp end');
e.bus.emit('action', 'interact'); frame(60 * 3);

// ---------- surfaces: same aircraft, asphalt vs grass vs sand ----------------------------------------------------------------------
import { FlightModel } from '../src/physics/FlightModel.js'; import { Aircraft } from '../src/aircraft/Aircraft.js'; import light from '../src/aircraft/definitions/lightProp.js';
const model = new FlightModel(), env0 = { windVector: () => new THREE.Vector3() };
function roll(x, z, hdg, secs) { const a = new Aircraft(light, 0); a.bus = { emit() {} }; a.place(x, e.world.groundHeight(x, z) + 1, z, hdg); a.controls.throttle = 1; for (let t = 0; t < secs; t += 1 / 120) model.step(a, 1 / 120, env0, e.world); return { v: a.telemetry.airspeed, s: a.surface }; }
const mainRw = e.world.cfg.airports[0], meadow = e.world.cfg.airports.find(a => a.id === 'meadow'), dune = e.world.cfg.airports.find(a => a.id === 'dune');
const R1 = roll(mainRw.x, mainRw.z + 600, Math.PI, 8), R2 = roll(meadow.x + 300, meadow.z, Math.PI * 1.5, 8), R3 = roll(dune.x, dune.z + 240, 0, 8);
say('speed after 8 s full throttle  asphalt', R1.v.toFixed(1), R1.s, '| grass', R2.v.toFixed(1), R2.s, '| dirt', R3.v.toFixed(1), R3.s); assert(R1.v > R2.v && R1.v > R3.v, 'asphalt accelerates faster than grass/dirt');

// ---------- turbulence ------------------------------------------------------------------------------------------------------------
const env = e.env, P = new THREE.Vector3(500, 400, 500); env.turbulence = 'severe'; env.weather = 'overcast'; env.apply(); const samples = []; for (let i = 0; i < 400; i++) { env.t += 0.05; samples.push(env.windAt(P).clone()); }
const mean = samples.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / samples.length), sd = Math.sqrt(samples.reduce((s, v) => s + v.distanceToSquared(mean), 0) / samples.length);
env.turbulence = 'off'; const calm = []; for (let i = 0; i < 50; i++) { env.t += 0.05; calm.push(env.windAt(P).clone()); } const sdOff = Math.max(...calm.map(v => v.distanceTo(calm[0])));
say('gust spread severe', sd.toFixed(2), 'm/s | off', sdOff.toFixed(3), '| label', env.turbLabel()); assert(sd > 1.5 && sdOff < 1e-6, 'turbulence adds gusts; off is steady');
env.turbulence = 'auto'; env.weather = 'clear'; env.apply();

// ---------- clouds ----------------------------------------------------------------------------------------------------------------------
for (const wx of ['clear', 'cloudy', 'overcast', 'fog']) { env.weather = wx; env.apply(); frame(3); say('clouds', wx.padEnd(9), e.clouds.clusters.length, 'clusters', e.clouds.puffs.length, 'puffs | stratus', e.clouds.strat.visible); }
walk.reset(); frame(2); env.weather = 'cloudy'; env.apply(); frame(3); const c0 = e.clouds.clusters[0]; ac().pos.set(c0.x + e.clouds.drift.x, c0.y + c0.s * 0.12, c0.z + e.clouds.drift.z); e.camera.position.copy(ac().pos); for (let i = 0; i < 120; i++) { ac().pos.set(c0.x + e.clouds.drift.x, c0.y + c0.s * 0.12, c0.z + e.clouds.drift.z); ac().vel.set(0, 0, 0); frame(1); }
say('visibility inside a cloud:', env.visibility.toFixed(2), '| fog far', e.scene.fog.far.toFixed(0)); assert(env.visibility < 0.5, 'flying through cloud reduces visibility');
say('errors:', errors.length); assert.equal(errors.length, 0); say('ALL WALK/WORLD CHECKS PASSED'); process.exit(0);
