import { buildAirframe } from '../AirframeBuilder.js';
import { buildCockpit } from '../Cockpit.js';
import { withDefaults } from '../../physics/defaults.js';

const flight = withDefaults({
  mass: 40000, wingArea: 160, CL0: 0.4, CLa: 5.2, k: 0.045, CD0: 0.035, flapCL: 0.8, maxThrust: 160000, thrustFalloff: 200,
  reverseFactor: 0.5, vRef: 60, pitchPower: 1.2, rollPower: 1.8, yawPower: 0.8, damp: { x: 3, y: 2.5, z: 3 },
  gearHeight: 3.0, brakeDecel: 3.5, steerRate: 0.35, maxGroundPitch: 0.15, crashSink: 3.5, jato: { thrust: 90000, time: 8 },
});
const nac = (len, r) => [{ z: 0, rx: 0.02, ry: 0.02, cy: 0 }, { z: 0.01, rx: r * 0.8, ry: r * 0.8, cy: 0, n: 2.2 }, { z: 0.7, rx: r, ry: r, cy: 0 }, { z: len * 0.35, rx: r * 1.1, ry: r * 1.12, cy: 0 }, { z: len * 0.7, rx: r * 0.95, ry: r * 0.9, cy: -0.05 }, { z: len, rx: r * 0.3, ry: r * 0.3, cy: -0.05 }, { z: len + 0.01, rx: 0.02, ry: 0.02, cy: -0.05 }];
const spinner = [{ z: -0.95, rx: 0.01, ry: 0.01, cy: 0 }, { z: -0.8, rx: 0.17, ry: 0.17, cy: 0 }, { z: -0.45, rx: 0.34, ry: 0.34, cy: 0 }, { z: 0, rx: 0.4, ry: 0.4, cy: 0 }, { z: 0.001, rx: 0.01, ry: 0.01, cy: 0 }];
const engine = (x, y) => ({ x, y, z: -4.9, pz: -4.95, R: 2.0, blades: 4, chord: 0.34, hub: 0.3, nacelle: nac(5.6, 0.62), spinner, spinnerColor: 0x2a2d30 });
const win = (zm, am) => {
  if (zm > -14.6 && zm < -12.7) return am > 30 && am < 150 ? 1 : 0;
  if (zm >= -12.7 && zm < -11.0) return (am > 20 && am < 75) || (am > 105 && am < 160) ? 1 : 0;
  if (zm > -9.3 && zm < -8.4 && am > 150 && am < 200) return 1;
  return 0;
};
const spec = {
  gearHeight: flight.gearHeight, wheelRadius: 0.7, interiorColor: 0x7d8268,
  fuselage: {
    stations: [
      { z: -15.6, rx: 0.02, ry: 0.02, cy: -0.4 }, { z: -15.4, rx: 0.5, ry: 0.5, cy: -0.45, n: 2.2 }, { z: -14.6, rx: 1.1, ry: 1.2, cy: -0.4, n: 2.3 }, { z: -13.2, rx: 1.5, ry: 1.7, cy: -0.2, n: 2.4 }, { z: -11.5, rx: 1.68, ry: 1.9, cy: -0.05, n: 2.6 },
      { z: -8, rx: 1.74, ry: 2.0, cy: 0, n: 2.7 }, { z: 6, rx: 1.74, ry: 2.0, cy: 0, n: 2.7 }, { z: 9, rx: 1.62, ry: 1.82, cy: 0.12, n: 2.6 }, { z: 11.4, rx: 1.42, ry: 1.52, cy: 0.42, n: 2.5 }, { z: 13.6, rx: 1.0, ry: 1.05, cy: 0.88, n: 2.4 }, { z: 15.4, rx: 0.6, ry: 0.6, cy: 1.12, n: 2.3 }, { z: 16, rx: 0.3, ry: 0.3, cy: 1.2, n: 2.2 }, { z: 16.01, rx: 0.02, ry: 0.02, cy: 1.2 },
    ],
    dz: 0.9, M: 40, windows: win,
    color: (x, y, z, a, st, body, acc) => { if (z < -14.5) return new (body.constructor)(0x34383b); if (y < st.cy - st.ry * 0.7) return body.clone().multiplyScalar(0.72); if (z > 10 && y > st.cy + st.ry * 0.5) return acc; return body; },
    doors: [
      { id: 'crew', label: 'Crew door', side: -1, test: (zm, am) => zm > -9.6 && zm < -7.7 && am > 140 && am < 215, hinge: { x: -1.74, z: -9.6 }, open: -1.5, at: { x: -3.4, z: -8.6 }, in: { x: -1.0, z: -8.65 }, enter: 'cabin' },
      { id: 'paraL', label: 'Paratroop door (left)', side: -1, test: (zm, am) => zm > 5.8 && zm < 8.1 && am > 145 && am < 215, hinge: { x: -1.74, z: 5.8 }, open: -1.5, at: { x: -3.4, z: 7 }, in: { x: -1.0, z: 6.95 }, enter: 'cabin' },
      { id: 'paraR', label: 'Paratroop door (right)', side: 1, test: (zm, am) => zm > 5.8 && zm < 8.1 && (am > 325 || am < 35), hinge: { x: 1.74, z: 5.8 }, open: 1.5, at: { x: 3.4, z: 7 }, in: { x: 1.0, z: 6.95 }, enter: 'cabin' },
    ],
  },
  wing: { w: { span: 20, rootChord: 4.8, tipChord: 3.2, sweep: 0.02, dihedral: 0.03, twist: -0.03, tRoot: 0.16, tTip: 0.12, camber: 0.02 }, y: 1.55, z: -3.2, hinge: 0.72, flap: { e0: 0.1, e1: 0.58 }, aileron: { e0: 0.62, e1: 0.97 } },
  tail: { h: { w: { span: 7.2, rootChord: 3.3, tipChord: 2.0, sweep: 0.18, dihedral: 0, tRoot: 0.12, tTip: 0.09, camber: 0 }, y: 1.55, z: 12.0, hinge: 0.66 },
          v: { w: { span: 6.6, rootChord: 5.2, tipChord: 2.6, sweep: 0.6, tRoot: 0.13, tTip: 0.1, camber: 0 }, y: 1.6, z: 9.8, hinge: 0.62, accent: true } },
  engines: [engine(-14, 1.42), engine(-6, 1.18), engine(6, 1.18), engine(14, 1.42)],
  bodies: [-2.0, 2.0].map(x => ({ x, y: -1.35, z: -1.0, stations: [{ z: 0, rx: 0.02, ry: 0.02, cy: 0 }, { z: 0.6, rx: 0.5, ry: 0.62, cy: 0, n: 2.4 }, { z: 3, rx: 0.62, ry: 0.78, cy: 0 }, { z: 8, rx: 0.5, ry: 0.64, cy: 0 }, { z: 9.4, rx: 0.02, ry: 0.02, cy: 0 }] })),
  ramp: { w: 3.4, len: 4.4, hingeY: -1.05, hingeZ: 11.5, closed: -0.33, open: Math.asin((flight.gearHeight - 1.05) / 4.4) },
  gear: [
    { x: 0, z: -10, y0: -1.7, twin: true, tireW: 0.32, leg: 0.1, oleo: true, retract: { axis: 'x', angle: -1.5 } },
    { x: -2.3, z: 3, y0: -1.9, dx: -0.15, twin: true, tireW: 0.34, leg: 0.12, oleo: true, retract: { axis: 'z', angle: 1.4 } },
    { x: 2.3, z: 3, y0: -1.9, dx: 0.15, twin: true, tireW: 0.34, leg: 0.12, oleo: true, retract: { axis: 'z', angle: -1.4 } },
  ],
};
const cockpit = {
  kind: 'glass', eyes: { pilot: { x: -0.58, y: 0.42, z: -12.3 }, copilot: { x: 0.58, y: 0.42, z: -12.3 } }, panel: { y: 0.45, z: -13.4, w: 1.9, h: 0.62 },
  seats: [{ x: -0.58, z: -12.0, y: -0.55 }, { x: 0.58, z: -12.0, y: -0.55 }], floorY: -0.95, bounds: { x: 1.45, z0: -13.2, z1: 10.8 }, bay: { z0: -8.6, z1: 11.4, halfW: 1.55 },
};
export default {
  id: 'transport', name: 'Atlas T4 (military transport)', role: 'military-transport', flight, flaps: [0, 0.4, 0.7, 1],
  liveries: [{ name: 'Grey', body: 0x8a9096, accent: 0x5c6268 }, { name: 'Olive', body: 0x5f6b3a, accent: 0x3e4726 }],
  cargo: { maxMass: 12000, rampDist: 20 },
  camera: { chaseDist: 55, chaseHeight: 16, eye: cockpit.eyes.pilot, copilot: cockpit.eyes.copilot, wing: { x: -17, y: 3.4, z: 1.5, look: { x: 0, y: 1.5, z: 5 } } },
  cockpit, walk: { hull: { hx: 1.9, z0: -15.6, z1: 16 }, seatExit: { x: -3.4, z: -8.6 } },
  interior: { floorY: -0.95, halfW: 1.55, z0: -13.2, z1: 11.4 },
  buildMesh: l => { const g = buildAirframe(spec, l); const c = buildCockpit(cockpit, l); g.add(c.group); g.userData.cockpit = c; return g; },
};
