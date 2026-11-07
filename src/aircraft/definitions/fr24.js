import * as THREE from 'three';
import { buildCockpit } from '../Cockpit.js';
import { withDefaults } from '../../physics/defaults.js';

/**
 * Aircraft whose exterior is an FR24 glTF model (assets/models/aircraft, GPL: see assets/CREDITS.md). Until the model has streamed in the
 * aircraft is just its cockpit; physics never depends on the model. Positions below: `model.pos` shifts the glTF so its wheels touch
 * ground at -gearHeight; cockpit numbers are in aircraft space (origin = CG, nose = -Z). Eye heights/alignments want a check in a real browser.
 */
const emptyMesh = cockpit => l => {
  const g = new THREE.Group(), c = buildCockpit(cockpit, l);
  g.userData.parts = { aileronL: new THREE.Group(), aileronR: new THREE.Group(), elevator: new THREE.Group(), elevators: [], rudder: new THREE.Group(), wings: [], tail: null, ramp: null, flaps: [], gear: [], props: [], propBlur: [], strobes: [], nav: [], doors: [], rampAngles: null, interior: null };
  g.add(c.group); g.userData.cockpit = c; return g;
};
const glass = (ex, ey, ez, pz, floorY, zb) => ({ kind: 'glass', eyes: { pilot: { x: -ex, y: ey, z: ez }, copilot: { x: ex, y: ey, z: ez } }, panel: { y: ey - 0.05, z: pz, w: 1.7, h: 0.55 }, seats: [{ x: -ex, z: ez + 0.3, y: ey - 0.95 }, { x: ex, z: ez + 0.3, y: ey - 0.95 }], floorY, bounds: { x: 1.1, z0: pz + 0.2, z1: zb }, bay: { z0: ez + 1.5, z1: zb, halfW: 1.0 } });
const define = (o) => { const cockpit = o.cockpit; return { role: 'civil', flaps: o.flaps, cargo: null, ...o, buildMesh: emptyMesh(cockpit), camera: { chaseDist: o.chase[0], chaseHeight: o.chase[1], eye: cockpit.eyes.pilot, copilot: cockpit.eyes.copilot, wing: o.wing } }; };
const tipLights = (x, y, z, ty, tz) => [{ x: -x, y, z }, { x, y, z }, { x: 0, y: ty, z: tz }];

const citCockpit = glass(0.42, -0.1, -3.8, -4.7, -1.0, 2.5);
export const citation = define({
  id: 'citation', name: 'Citation II (light business jet)', flaps: [0, 0.33, 0.66, 1], liveries: [{ name: 'Factory', body: 0xf2f2f2, accent: 0x1c4fa0 }],
  flight: withDefaults({ mass: 5800, wingArea: 30, CL0: 0.35, CLa: 5.0, CD0: 0.024, k: 0.045, flapCL: 0.7, maxThrust: 24000, thrustFalloff: 220, vRef: 65, pitchPower: 1.6, rollPower: 2.4, yawPower: 1.0, damp: { x: 2.8, y: 2.2, z: 3 }, gearHeight: 1.55, brakeDecel: 5, steerRate: 0.5, maxGroundPitch: 0.18, crashSink: 3.5 }),
  cockpit: citCockpit, chase: [30, 9], wing: { x: -8.6, y: 0.6, z: 0.8, look: { x: 0, y: 0.1, z: 2 } }, walk: { hull: { hx: 1.0, z0: -6.6, z1: 7.8 }, seatExit: { x: -2.4, z: -3.4 } },
  model: { id: 'citation', pos: [0, -1.61, -0.4], parts: { aileronL: 'LHaileron', aileronR: 'RHaileron', flaps: [['LHflap'], ['RHflap']], elevators: [['LHelevator'], ['RHelevator']], rudder: ['Rudder', 'rudder'] }, lights: tipLights(7.7, 0.9, 1.2, 4.0, 7.3) },
});

const atrCockpit = glass(0.55, 0.44, -8.2, -9.2, -0.9, 3);
export const atr42 = define({
  id: 'atr42', name: 'ATR 42 (turboprop commuter)', flaps: [0, 0.3, 0.6, 1], liveries: [{ name: 'Factory', body: 0xf2f2f2, accent: 0x1c6fa0 }],
  flight: withDefaults({ mass: 16000, wingArea: 54.5, CL0: 0.4, CLa: 5.2, CD0: 0.03, k: 0.045, flapCL: 0.8, maxThrust: 46000, thrustFalloff: 150, reverseFactor: 0.5, vRef: 55, pitchPower: 1.4, rollPower: 2.0, yawPower: 0.9, damp: { x: 3, y: 2.4, z: 3 }, gearHeight: 2.5, brakeDecel: 4, steerRate: 0.45, maxGroundPitch: 0.16, crashSink: 3.5 }),
  cockpit: atrCockpit, chase: [42, 12], wing: { x: -15, y: 1.6, z: 0, look: { x: 0, y: 0.6, z: 1 } }, walk: { hull: { hx: 1.5, z0: -10.5, z1: 12 }, seatExit: { x: -3, z: -7 } },
  model: { id: 'atr42', pos: [0, -2.56, 0], parts: { aileronL: 'Aileron1', aileronR: 'Aileron2', flaps: [['Flap1', 'Flap2'], ['Flap3', 'Flap4']], elevators: [['Elevator']], rudder: 'Rudder', props: [{ nodes: ['Prop1'], r: 2.0 }, { nodes: ['Prop2'], r: 2.0 }] }, lights: tipLights(13.6, 3.3, -0.3, 6.1, 9.5) },
});

const b738Cockpit = glass(0.55, 1.3, -15.7, -16.9, -0.1, 12);
export const b738 = define({
  id: 'b738', name: 'Boeing 737-800 (airliner)', role: 'airliner', flaps: [0, 0.25, 0.5, 0.75, 1], liveries: [{ name: 'Factory', body: 0xf2f2f2, accent: 0x1c4fa0 }],
  flight: withDefaults({ mass: 62000, wingArea: 125, CL0: 0.4, CLa: 5.4, CD0: 0.022, k: 0.04, flapCL: 0.9, maxThrust: 230000, thrustFalloff: 290, reverseFactor: 0.45, vRef: 70, pitchPower: 1.1, rollPower: 1.5, yawPower: 0.7, damp: { x: 3.2, y: 2.6, z: 3.2 }, gearHeight: 2.7, brakeDecel: 3.2, steerRate: 0.3, maxGroundPitch: 0.14, crashSink: 3.2 }),
  cockpit: b738Cockpit, chase: [75, 22], wing: { x: -19.5, y: 1.4, z: 4, look: { x: 0, y: 0.2, z: 3 } }, walk: { hull: { hx: 1.9, z0: -19.8, z1: 19.5 }, seatExit: { x: -3.6, z: -14 } },
  model: { id: 'b738', pos: [0, -0.5, 0], parts: { aileronL: 'lhaileron', aileronR: 'rhaileron', flaps: [['flapI_B', 'flapO_B', 'aftflapI_B', 'aftflapO_B'], ['rhflapI_B', 'rhflapO_B', 'rhaftflapI_B', 'rhaftflapO_B']], elevators: [['lhelevator'], ['rhelevator']], rudder: 'rudder' }, lights: tipLights(17.6, 1.1, 3.2, 9.8, 17) },
});
