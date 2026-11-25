/** Default flight parameters (SI). Aircraft definitions override only what differs. */
export const DEFAULT_FLIGHT = {
  mass: 1000, wingArea: 15, CL0: 0.3, CLa: 5, aoaStall: 0.28, CD0: 0.03, k: 0.05,
  flapCL: 0.5, flapCD: 0.04, gearCD: 0.02, spoilerCD: 0.06,
  // Engine spool: seconds to change thrust between idle and full. Turbines lag noticeably, pistons do not.
  maxThrust: 3000, thrustFalloff: 90, reverseFactor: 0.4, spoolUp: 0.8, spoolDown: 1.5,
  // Ground effect (lift bonus + induced-drag relief within roughly a wingspan of the ground) and sideslip drag.
  groundEffect: 0.14, groundSpan: 0, sideDrag: 1.1,
  // Dihedral (sideslip -> roll), propeller torque / P-factor, and the post-stall break. Props set their own torque; jets leave it at 0.
  dihedral: 0.45, propTorque: 0, pFactor: 0, stallPitch: 1.8, stallRoll: 0.9,
  vRef: 35, pitchPower: 2, rollPower: 3, yawPower: 1.5, pitchStab: 2.5, yawStab: 2, trimAoa: 0.04,
  damp: { x: 2.5, y: 2, z: 3 },
  gearHeight: 1, rollMu: 0.03, brakeDecel: 4, steerRate: 0.6, maxGroundPitch: 0.2, crashSink: 4,
};
export const withDefaults = o => ({ ...DEFAULT_FLIGHT, ...o, damp: { ...DEFAULT_FLIGHT.damp, ...(o.damp || {}) } });
