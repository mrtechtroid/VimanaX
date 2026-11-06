import * as THREE from 'three';
import { buildAirframe } from '../AirframeBuilder.js';
import { buildCockpit } from '../Cockpit.js';
import { withDefaults } from '../../physics/defaults.js';

const flight = withDefaults({ mass: 1100, wingArea: 16.5, maxThrust: 3000, gearHeight: 1.0 });
const win = (zm, am) => {
  const side = (am > 22 && am < 68) || (am > 112 && am < 158);
  if (zm > -1.55 && zm < -0.62) return am > 32 && am < 148 ? 1 : 0; // windscreen
  if (zm >= -0.45 && zm < 1.05) return side ? 1 : 0;                  // door windows
  if (zm >= 1.2 && zm < 1.9) return side || (am > 75 && am < 105) ? 1 : 0; // rear quarter / back window
  return 0;
};
const doorZ = zm => zm > -0.95 && zm < 0.5;
const spec = {
  gearHeight: flight.gearHeight, wheelRadius: 0.3, interiorColor: 0x9a9384,
  fuselage: {
    stations: [
      { z: -3.21, rx: 0.02, ry: 0.02, cy: -0.02 }, { z: -3.2, rx: 0.42, ry: 0.4, cy: -0.03, n: 2.3 }, { z: -2.7, rx: 0.5, ry: 0.5, cy: -0.01, n: 2.3 }, { z: -2.1, rx: 0.56, ry: 0.56, cy: 0.05, n: 2.4 },
      { z: -1.45, rx: 0.6, ry: 0.64, cy: 0.14, n: 2.6 }, { z: -0.75, rx: 0.66, ry: 0.8, cy: 0.27, n: 2.8 }, { z: 0.3, rx: 0.67, ry: 0.82, cy: 0.28, n: 2.8 }, { z: 1.3, rx: 0.62, ry: 0.74, cy: 0.3, n: 2.7 },
      { z: 2.3, rx: 0.48, ry: 0.58, cy: 0.36, n: 2.4 }, { z: 3.4, rx: 0.3, ry: 0.42, cy: 0.46, n: 2.3 }, { z: 4.4, rx: 0.14, ry: 0.22, cy: 0.56, n: 2.2 }, { z: 4.9, rx: 0.07, ry: 0.1, cy: 0.6, n: 2.2 }, { z: 4.91, rx: 0.01, ry: 0.01, cy: 0.6 },
    ],
    dz: 0.3, M: 40, windows: win,
    color: (x, y, z, a, st, body, acc) => { const side = Math.abs(x) > st.rx * 0.6; if (z < -2.35 && z > -3.25) return acc; if (z > 4.0) return acc; if (side && Math.abs(y - (st.cy - 0.08)) < 0.07 && z > -2.4 && z < 4.2) return acc; if (y < st.cy - st.ry * 0.78) return body.clone().multiplyScalar(0.72); return body; },
    doors: [
      { id: 'doorR', label: 'Right door', side: 1, test: (zm, am) => doorZ(zm) && (am < 64 || am > 335), hinge: { x: 0.64, z: -0.95 }, open: 1.35, at: { x: 1.6, z: -0.1 }, enter: 'copilot' },
      { id: 'doorL', label: 'Pilot door', side: -1, test: (zm, am) => doorZ(zm) && am > 116 && am < 205, hinge: { x: -0.64, z: -0.95 }, open: -1.35, at: { x: -1.6, z: -0.1 }, enter: 'pilot' },
    ],
  },
  wing: { w: { span: 5.5, rootChord: 1.65, tipChord: 1.15, sweep: 0.04, dihedral: 0.03, twist: -0.03, tRoot: 0.12, tTip: 0.09, camber: 0.025 }, y: 1.0, z: -1.15, hinge: 0.72, flap: { e0: 0.13, e1: 0.5 }, aileron: { e0: 0.55, e1: 0.96 }, pitot: true,
    struts: [{ from: { x: 0.62, y: -0.1, z: 0.1 }, eta: 0.5, r: 0.03 }] },
  tail: { h: { w: { span: 1.75, rootChord: 1.0, tipChord: 0.68, sweep: 0.12, dihedral: 0, tRoot: 0.09, tTip: 0.07, camber: 0 }, y: 0.6, z: 4.0, hinge: 0.65 },
          v: { w: { span: 1.45, rootChord: 1.25, tipChord: 0.7, sweep: 0.55, tRoot: 0.09, tTip: 0.07, camber: 0 }, y: 0.7, z: 3.65, hinge: 0.6, accent: true } },
  engines: [{ x: 0, y: -0.02, pz: -3.22, R: 0.95, blades: 2, chord: 0.15, hub: 0.12, spinner: [{ z: -0.34, rx: 0.01, ry: 0.01, cy: 0 }, { z: -0.28, rx: 0.08, ry: 0.08, cy: 0 }, { z: -0.14, rx: 0.17, ry: 0.17, cy: 0 }, { z: 0, rx: 0.21, ry: 0.21, cy: 0 }, { z: 0.001, rx: 0.01, ry: 0.01, cy: 0 }] }],
  gear: [
    { x: 0, z: -2.0, y0: -0.46, retract: { axis: 'x', angle: -1.5 }, leg: 0.035, tireW: 0.1, oleo: true },
    { x: -0.5, z: 0.25, y0: -0.45, dx: -0.55, retract: { axis: 'z', angle: 1.5 }, leg: 0.03, tireW: 0.12, fairing: true },
    { x: 0.5, z: 0.25, y0: -0.45, dx: 0.55, retract: { axis: 'z', angle: -1.5 }, leg: 0.03, tireW: 0.12, fairing: true },
  ],
  details: [(g, m) => { const a = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.28, 0.14), m.metal); a.position.set(0, 1.2, 0.9); g.add(a); const b = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), m.emis(0xff3030)); b.position.set(0, 0.26 - 0.55 + 0.04, 0.2); b.scale.y = 0.6; g.add(b); m.P.nav.push(b); }],
};
const cockpit = {
  kind: 'steam', eyes: { pilot: { x: -0.34, y: 0.62, z: -0.05 }, copilot: { x: 0.34, y: 0.62, z: -0.05 } }, panel: { y: 0.57, z: -1.05, w: 1.1, h: 0.41 },
  seats: [{ x: -0.34, z: 0.05, y: -0.12 }, { x: 0.34, z: 0.05, y: -0.12 }], rear: { z: 1.05, y: -0.12, w: 1.1 }, floorY: -0.5, bounds: { x: 0.55, z0: -1.2, z1: 1.9 },
};
export default {
  id: 'light-prop', name: 'Skylark 172 (light prop)', role: 'civil-light', flight, flaps: [0, 0.33, 0.66, 1],
  liveries: [{ name: 'White/Blue', body: 0xf2f2f2, accent: 0x1c4fa0 }, { name: 'Yellow/Black', body: 0xf5c518, accent: 0x222222 }, { name: 'Red', body: 0xc62828, accent: 0xeeeeee }],
  camera: { chaseDist: 14, chaseHeight: 4, eye: cockpit.eyes.pilot, copilot: cockpit.eyes.copilot, wing: { x: -4.6, y: 1.2, z: 0.4, look: { x: 0, y: 0.5, z: 1.2 } } },
  cockpit, walk: { hull: { hx: 0.8, z0: -3.3, z1: 4.9 }, seatExit: { x: -1.7, z: -0.1 } },
  buildMesh: l => { const g = buildAirframe(spec, l); const c = buildCockpit(cockpit, l); g.add(c.group); g.userData.cockpit = c; return g; },
};
