/** Cargo-bay / ramp floor height (aircraft-local y) at local (x, z), or null when that spot is not deck. Ramp only counts once open. */
export function deckY(ac, lx, lz) {
  const D = ac.def.interior, A = ac.mesh.userData.parts.rampAngles; if (!D || !A) return null; if (Math.abs(lx) > D.halfW) return null;
  const hz = A.hingeZ; if (lz >= D.z0 && lz <= hz) return D.floorY;
  if (ac.rampPos > 0.9 && lz > hz && lz <= rampEnd(ac)) return A.hingeY - (lz - hz) * Math.tan(A.open) + 0.06;
  return null;
}
export const rampEnd = ac => { const A = ac.mesh.userData.parts.rampAngles; return A.hingeZ + A.len * Math.cos(A.open); };
