import { buildAirframe } from '../AirframeBuilder.js';
import { withDefaults } from '../../physics/defaults.js';

const flight = withDefaults({ mass: 1100, wingArea: 16.5, maxThrust: 3000, gearHeight: 1.0 });
const spec = {
  gearHeight: flight.gearHeight, wheelRadius: 0.3,
  fuselage: { radius: 0.7, length: 6 }, wing: { span: 11, chord: 1.5, z: -0.5 },
  tail: { hSpan: 3.4, hChord: 1.1, y: 0.4, z: 3.0, vHeight: 1.5, vChord: 1.4 },
  engines: [{ x: 0, y: 0, z: -3.5, radius: 0.35, length: 0.4, propR: 1.9, blades: 2 }],
  gear: [{ x: 0, z: -1.8 }, { x: -1.3, z: 0.3 }, { x: 1.3, z: 0.3 }],
};
export default {
  id: 'light-prop', name: 'Skylark 172 (light prop)', role: 'civil-light', flight, flaps: [0, 0.33, 0.66, 1],
  liveries: [{ name: 'White/Blue', body: 0xf2f2f2, accent: 0x1c4fa0 }, { name: 'Yellow/Black', body: 0xf5c518, accent: 0x222222 }, { name: 'Red', body: 0xc62828, accent: 0xeeeeee }],
  camera: { chaseDist: 14, chaseHeight: 4, eye: { x: 0, y: 0.3, z: -1.0 }, wing: { x: -4.6, y: 0.9, z: 0.4, look: { x: 0, y: 0.5, z: 1.2 } } },
  buildMesh: l => buildAirframe(spec, l),
};
