import { buildAirframe } from '../AirframeBuilder.js';
import { withDefaults } from '../../physics/defaults.js';

const flight = withDefaults({
  mass: 40000, wingArea: 160, CL0: 0.4, CLa: 5.2, k: 0.045, CD0: 0.035, flapCL: 0.8, maxThrust: 160000, thrustFalloff: 200,
  reverseFactor: 0.5, vRef: 60, pitchPower: 1.2, rollPower: 1.8, yawPower: 0.8, damp: { x: 3, y: 2.5, z: 3 },
  gearHeight: 3.0, brakeDecel: 3.5, steerRate: 0.35, maxGroundPitch: 0.15, crashSink: 3.5,
});
const spec = {
  gearHeight: flight.gearHeight, wheelRadius: 0.7,
  fuselage: { radius: 2.0, length: 28 }, wing: { span: 40, chord: 4, z: -1 },
  tail: { hSpan: 14, hChord: 3, y: 4.0, z: 12, vBase: 1.0, vHeight: 6.5, vChord: 4.5 },
  engines: [-14, -6, 6, 14].map(x => ({ x, y: 0.7, z: -3.4, radius: 0.55, length: 2.5, propR: 2.0, blades: 4 })),
  gear: [{ x: 0, z: -10 }, { x: -3, z: 2 }, { x: 3, z: 2 }],
};
export default {
  id: 'transport', name: 'Atlas T4 (military transport)', role: 'military-transport', flight, flaps: [0, 0.4, 0.7, 1],
  liveries: [{ name: 'Grey', body: 0x8a9096, accent: 0x5c6268 }, { name: 'Olive', body: 0x5f6b3a, accent: 0x3e4726 }],
  camera: { chaseDist: 55, chaseHeight: 16, eye: { x: 0, y: 1.0, z: -13 } },
  buildMesh: l => buildAirframe(spec, l),
};
