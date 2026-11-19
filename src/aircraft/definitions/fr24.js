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
const glass = ({ ex, ey, ez, pz, floorY, zb, w = 1.4, drop = 0.2, halfW = 1.0, cabin, ww = 0.6, top = 0.5, back = 0.4 }) => ({ view: { ww, top, drop, back }, kind: 'glass', eyes: { pilot: { x: -ex, y: ey, z: ez }, copilot: { x: ex, y: ey, z: ez } }, panel: { y: 0, z: pz, w, h: 0.5, drop }, seats: [{ x: -ex, z: ez + 0.3, y: floorY + 0.45 }, { x: ex, z: ez + 0.3, y: floorY + 0.45 }], floorY, bounds: { x: halfW, z0: pz + 0.2, z1: zb }, cabin: cabin && { height: 1.9, ...cabin } });
const define = (o) => { const cockpit = o.cockpit; return { role: 'civil', flaps: o.flaps, cargo: null, interior: o.interior, ...o, buildMesh: emptyMesh(cockpit), camera: { chaseDist: o.chase[0], chaseHeight: o.chase[1], eye: cockpit.eyes.pilot, copilot: cockpit.eyes.copilot, wing: o.wing } }; };
const tipLights = (x, y, z, ty, tz) => [{ x: -x, y, z }, { x, y, z }, { x: 0, y: ty, z: tz }];

const citCockpit = glass({ ex: 0.38, ey: -0.1, ez: -3.15, pz: -4.4, floorY: -1.25, zb: 2.3, w: 1.2, drop: 0.22, halfW: 0.72, ww: 0.62, top: 0.4, cabin: { z0: -2.4, z1: 2.3, halfW: 0.72, pitch: 0.95, seatX: [-0.42, 0.42] } });
export const citation = define({
  id: 'citation', engines: 2, name: 'Citation II (light business jet)', flaps: [0, 0.33, 0.66, 1], liveries: [{ name: 'Factory', body: 0xf2f2f2, accent: 0x1c4fa0 }],
  flight: withDefaults({ mass: 5800, wingArea: 30, CL0: 0.35, CLa: 5.0, CD0: 0.024, k: 0.045, flapCL: 0.7, maxThrust: 24000, thrustFalloff: 220, vRef: 65, pitchPower: 1.6, rollPower: 2.4, yawPower: 1.0, damp: { x: 2.8, y: 2.2, z: 3 }, gearHeight: 1.55, brakeDecel: 5, steerRate: 0.5, maxGroundPitch: 0.18, crashSink: 3.5 }),
  cockpit: citCockpit, interior: { height: 1.4, floorY: -1.25, halfW: 0.66, z0: -3.6, z1: 2.5 }, chase: [30, 9], wing: { x: -8.6, y: 0.6, z: 0.8, look: { x: 0, y: 0.1, z: 2 } }, walk: { hull: { hx: 1.0, z0: -6.6, z1: 7.8 }, seatExit: { x: -2.4, z: -3.4 } },
  model: { id: 'citation', pos: [0, -1.61, -0.4], doors: [{ id: 'cabin', label: 'Cabin door', nodes: ['Cabin_door', 'Door_glass', 'Door_glass_inside', 'Door_handle'], side: -1, open: -1.35, at: { x: -1.9, z: -2.3 }, in: { x: -0.35, z: -2.3 }, enter: 'cabin' }, { id: 'baggage', label: 'Baggage door', nodes: ['Aft_BaggageDoor'], side: -1, open: -1.2, at: { x: -1.8, z: 3.4 } }], parts: { aileronL: 'LHaileron', aileronR: 'RHaileron', flaps: [['LHflap'], ['RHflap']], elevators: [['LHelevator'], ['RHelevator']], rudder: ['Rudder', 'rudder'] }, lights: tipLights(7.7, 0.9, 1.2, 4.0, 7.3) },
});

const atrCockpit = glass({ ex: 0.55, ey: 0.0, ez: -7.9, pz: -8.75, floorY: -1.36, zb: 4.6, w: 1.5, drop: 0.22, halfW: 1.2, ww: 0.85, top: 0.45, cabin: { z0: -5.6, z1: 3.6, halfW: 1.2, pitch: 0.8, seatX: [-0.95, -0.45, 0.45, 0.95] } });
export const atr42 = define({
  id: 'atr42', engines: 2, name: 'ATR 42 (turboprop commuter)', flaps: [0, 0.3, 0.6, 1], liveries: [{ name: 'Factory', body: 0xf2f2f2, accent: 0x1c6fa0 }],
  flight: withDefaults({ mass: 16000, wingArea: 54.5, CL0: 0.4, CLa: 5.2, CD0: 0.03, k: 0.045, flapCL: 0.8, maxThrust: 46000, thrustFalloff: 150, reverseFactor: 0.5, vRef: 55, pitchPower: 1.4, rollPower: 2.0, yawPower: 0.9, damp: { x: 3, y: 2.4, z: 3 }, gearHeight: 2.5, brakeDecel: 4, steerRate: 0.45, maxGroundPitch: 0.16, crashSink: 3.5 }),
  cockpit: atrCockpit, interior: { height: 1.95, floorY: -1.36, halfW: 1.25, z0: -8.5, z1: 4.9 }, chase: [42, 12], wing: { x: -15, y: 1.6, z: 0, look: { x: 0, y: 0.6, z: 1 } }, walk: { hull: { hx: 1.5, z0: -10.5, z1: 12 }, seatExit: { x: -3, z: -7 } },
  model: { id: 'atr42', pos: [0, -2.56, 0], doors: [{ id: 'pass', label: 'Passenger door', nodes: ['PassDr'], side: -1, open: -1.3, at: { x: -2.5, z: 4.4 }, in: { x: -0.7, z: 4.3 }, enter: 'cabin' }, { id: 'cargo', label: 'Cargo door', nodes: ['CargoDr'], side: -1, open: -1.3, at: { x: -2.5, z: -6.7 }, in: { x: -0.8, z: -6.7 }, enter: 'cabin' }], parts: { aileronL: 'Aileron1', aileronR: 'Aileron2', flaps: [['Flap1', 'Flap2'], ['Flap3', 'Flap4']], elevators: [['Elevator']], rudder: 'Rudder', props: [{ nodes: ['Prop1'], r: 2.0 }, { nodes: ['Prop2'], r: 2.0 }] }, lights: tipLights(13.6, 3.3, -0.3, 6.1, 9.5) },
});

const b738Cockpit = glass({ ex: 0.55, ey: 0.8, ez: -16.0, pz: -17.0, floorY: -0.35, zb: 11.8, w: 1.7, drop: 0.2, halfW: 1.65, ww: 0.95, top: 0.5, cabin: { z0: -13.6, z1: 11.0, halfW: 1.65, pitch: 0.76, seatX: [-1.45, -0.97, -0.5, 0.5, 0.97, 1.45] } });
export const b738 = define({
  id: 'b738', engines: 2, name: 'Boeing 737-800 (airliner)', role: 'airliner', flaps: [0, 0.25, 0.5, 0.75, 1], liveries: [{ name: 'Factory', body: 0xf2f2f2, accent: 0x1c4fa0 }],
  flight: withDefaults({ mass: 62000, wingArea: 125, CL0: 0.4, CLa: 5.4, CD0: 0.022, k: 0.04, flapCL: 0.9, maxThrust: 230000, thrustFalloff: 290, reverseFactor: 0.45, vRef: 70, pitchPower: 1.1, rollPower: 1.5, yawPower: 0.7, damp: { x: 3.2, y: 2.6, z: 3.2 }, gearHeight: 2.7, brakeDecel: 3.2, steerRate: 0.3, maxGroundPitch: 0.14, crashSink: 3.2 }),
  cockpit: b738Cockpit, interior: { height: 2.2, floorY: -0.35, halfW: 1.65, z0: -16.6, z1: 11.9 }, chase: [75, 22], wing: { x: -19.5, y: 1.4, z: 4, look: { x: 0, y: 0.2, z: 3 } }, walk: { hull: { hx: 1.9, z0: -19.8, z1: 19.5 }, seatExit: { x: -3.6, z: -14 } },
  model: { id: 'b738', pos: [0, -0.5, 0], doors: [{ id: 'lf', label: 'Forward left door', nodes: ['doorLF', 'doorLF_001'], side: -1, open: -1.2, at: { x: -3.2, z: -14.6 }, in: { x: -1.0, z: -14.6 }, enter: 'cabin' }, { id: 'rf', label: 'Forward right door', nodes: ['doorRF', 'dorrhfront_005'], side: 1, open: 1.2, at: { x: 3.2, z: -14.6 }, in: { x: 1.0, z: -14.6 }, enter: 'cabin' }, { id: 'lr', label: 'Rear left door', nodes: ['doorLR'], side: -1, open: -1.2, at: { x: -3.2, z: 12.0 }, in: { x: -1.0, z: 11.2 }, enter: 'cabin' }, { id: 'rr', label: 'Rear right door', nodes: ['doorRR', 'doorrhrear'], side: 1, open: 1.2, at: { x: 3.2, z: 12.0 }, in: { x: 1.0, z: 11.2 }, enter: 'cabin' }], parts: { aileronL: 'lhaileron', aileronR: 'rhaileron', flaps: [['flapI_B', 'flapO_B', 'aftflapI_B', 'aftflapO_B'], ['rhflapI_B', 'rhflapO_B', 'rhaftflapI_B', 'rhaftflapO_B']], elevators: [['lhelevator'], ['rhelevator']], rudder: 'rudder' }, lights: tipLights(17.6, 1.1, 3.2, 9.8, 17) },
});
