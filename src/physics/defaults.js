/** Default flight parameters (SI). Aircraft definitions override only what differs. */
export const DEFAULT_FLIGHT = {
  mass: 1000, wingArea: 15, CL0: 0.3, CLa: 5, aoaStall: 0.28, CD0: 0.03, k: 0.05,
  flapCL: 0.5, flapCD: 0.04, gearCD: 0.02, spoilerCD: 0.06,
  maxThrust: 3000, thrustFalloff: 90, reverseFactor: 0.4,
  vRef: 35, pitchPower: 2, rollPower: 3, yawPower: 1.5, pitchStab: 2.5, yawStab: 2, trimAoa: 0.04,
  damp: { x: 2.5, y: 2, z: 3 },
  gearHeight: 1, rollMu: 0.03, brakeDecel: 4, steerRate: 0.6, maxGroundPitch: 0.2, crashSink: 4,
};
export const withDefaults = o => ({ ...DEFAULT_FLIGHT, ...o, damp: { ...DEFAULT_FLIGHT.damp, ...(o.damp || {}) } });
