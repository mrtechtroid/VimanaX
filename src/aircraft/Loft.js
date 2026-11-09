import * as THREE from 'three';
/**
 * Geometry toolkit for the procedural airframes: lofted fuselage/nacelle bodies and airfoil wing pieces.
 * Everything is plain BufferGeometry, so a hand-modelled glTF can replace any of it (see AirframeBuilder `def.model`).
 */

/** Superellipse ring station: {z, rx, ry, cy, n?, cx?}. Returns smooth geometry (+ optional door sub-geometries). */
export function loftBody(stations, o = {}) {
  const M = o.M ?? 28, S = stations.length, pos = new Float32Array(S * M * 3), col = new Float32Array(S * M * 3), ang = new Float32Array(M);
  for (let j = 0; j < M; j++) ang[j] = j / M * Math.PI * 2;
  for (let i = 0; i < S; i++) {
    const s = stations[i], n = s.n ?? 2.2;
    for (let j = 0; j < M; j++) {
      const c = Math.cos(ang[j]), si = Math.sin(ang[j]), x = (s.cx ?? 0) + s.rx * Math.sign(c) * Math.abs(c) ** (2 / n), y = s.cy + s.ry * Math.sign(si) * Math.abs(si) ** (2 / n), k = (i * M + j) * 3;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = s.z;
      const cc = o.color ? o.color(x, y, s.z, ang[j] * 180 / Math.PI, s) : [1, 1, 1]; col[k] = cc[0]; col[k + 1] = cc[1]; col[k + 2] = cc[2];
    }
  }
  const quads = []; // [a,b,c,d, mat, door]
  for (let i = 0; i < S - 1; i++) for (let j = 0; j < M; j++) {
    const j2 = (j + 1) % M, a = i * M + j, b = i * M + j2, c = (i + 1) * M + j2, d = (i + 1) * M + j, zm = (stations[i].z + stations[i + 1].z) / 2, am = ((ang[j] + (j2 ? ang[j2] : Math.PI * 2)) / 2) * 180 / Math.PI;
    const door = o.door ? o.door(zm, am, i, j) : -1, mat = door >= 0 ? (o.doorMaterial?.(zm, am) ?? 0) : (o.material ? o.material(zm, am, i, j) : 0);
    quads.push([a, b, c, d, mat, door]); // winding chosen so normals face outward (verified in tests/preview)
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const idx = []; for (const q of quads) idx.push(q[0], q[1], q[2], q[0], q[2], q[3]); g.setIndex(idx); g.computeVertexNormals();
  const split = (filter) => { const mats = new Map(); for (const q of quads) if (filter(q)) { if (!mats.has(q[4])) mats.set(q[4], []); mats.get(q[4]).push(q[0], q[1], q[2], q[0], q[2], q[3]); } const out = new THREE.BufferGeometry(); out.setAttribute('position', g.attributes.position); out.setAttribute('normal', g.attributes.normal); out.setAttribute('color', g.attributes.color);
    const all = []; let start = 0; for (const [m, arr] of [...mats.entries()].sort((a, b) => a[0] - b[0])) { out.addGroup(start, arr.length, m); start += arr.length; for (let k = 0; k < arr.length; k++) all.push(arr[k]); } out.setIndex(all); return out; }; // loop, not push(...arr): large fuselages exceed the argument limit
  const res = { geo: split(q => q[5] < 0), doors: new Map() };
  if (o.door) { const ids = new Set(quads.map(q => q[5]).filter(d => d >= 0)); for (const id of ids) res.doors.set(id, split(q => q[5] === id)); }
  return res;
}

/** NACA-like closed section polyline between chord fractions u0..u1 (0 = leading edge). Returns [[u, v], ...] (v is thickness-direction in chord units). */
export function airfoilLoop(u0, u1, t = 0.12, m = 0.02, P = 14) {
  const yt = u => 5 * t * (0.2969 * Math.sqrt(u) - 0.126 * u - 0.3516 * u * u + 0.2843 * u ** 3 - 0.1015 * u ** 4), yc = u => m * (2 * 0.4 * u - u * u) / 0.16, up = [], lo = [];
  for (let k = 0; k <= P; k++) { const u = u0 + (u1 - u0) * (k / P) ** 1.0, v = yc(u), h = yt(u) + 0.002; up.push([u, v + h]); lo.push([u, v - h]); }
  return [...up, ...lo.reverse()];
}

/** Build a closed-ring loft from an array of rings (arrays of Vector3). Adds end caps. flip reverses winding (mirrored parts). */
export function ringsGeometry(rings, flip = false, color = null) {
  const R = rings.length, N = rings[0].length, pos = [], idx = [], col = [];
  for (const r of rings) for (const p of r) { pos.push(p.x, p.y, p.z); const c = color ? color(p) : [1, 1, 1]; col.push(...c); }
  for (let i = 0; i < R - 1; i++) for (let j = 0; j < N; j++) { const j2 = (j + 1) % N, a = i * N + j, b = i * N + j2, c = (i + 1) * N + j2, d = (i + 1) * N + j; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); }
  for (const [ri, rev] of [[0, true], [R - 1, false]]) for (let j = 1; j < N - 1; j++) { const a = ri * N, b = ri * N + j, c = ri * N + j + 1; (rev !== flip) ? idx.push(a, c, b) : idx.push(a, b, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

/**
 * Tapered, swept, twisted airfoil piece of a wing-like surface. Spanwise param eta 0..1 runs root -> tip.
 *  w: {span, rootChord, tipChord, sweep (rad, of the leading edge), dihedral (rad), twist (rad at tip), tRoot, tTip, camber}
 *  piece: {u0, u1 chord fractions, e0, e1 span fractions}
 * Coordinates: x outward (sign = side), z rearward, leading edge of the root at z = 0, y up. Returns BufferGeometry.
 */
export function wingPiece(w, piece = {}, side = 1, steps = 6, color = null) {
  const { u0 = 0, u1 = 1, e0 = 0, e1 = 1 } = piece, rings = [];
  for (let s = 0; s <= steps; s++) {
    const eta = e0 + (e1 - e0) * s / steps, c = w.rootChord + (w.tipChord - w.rootChord) * eta, t = (w.tRoot ?? 0.12) + ((w.tTip ?? 0.09) - (w.tRoot ?? 0.12)) * eta;
    const x = side * eta * w.span, zle = eta * w.span * Math.tan(w.sweep ?? 0), yo = eta * w.span * Math.tan(w.dihedral ?? 0), tw = (w.twist ?? 0) * eta, loop = airfoilLoop(u0, u1, t, w.camber ?? 0.02);
    rings.push(loop.map(([u, v]) => { const du = (u - 0.25) * c, dv = v * c, cz = du * Math.cos(tw) + dv * Math.sin(tw), cy = -du * Math.sin(tw) + dv * Math.cos(tw); return new THREE.Vector3(x, yo + cy, zle + 0.25 * c + cz); }));
  }
  return ringsGeometry(rings, side < 0, color);
}
/** Same surface rotated to stand up as a fin (span along +y). side is ignored; fin sits on the centreline. */
export function finPiece(w, piece = {}, steps = 6, color = null) {
  const g = wingPiece({ ...w, dihedral: 0 }, piece, 1, steps, color); g.rotateZ(Math.PI / 2); // x(span) -> y; thickness (y) -> -x
  g.computeVertexNormals(); return g;
}
/** Point on the hinge line (chord fraction u of the local chord) at span fraction eta, in the same frame as wingPiece. */
export function wingPoint(w, eta, u, side = 1) {
  const c = w.rootChord + (w.tipChord - w.rootChord) * eta, zle = eta * w.span * Math.tan(w.sweep ?? 0), yo = eta * w.span * Math.tan(w.dihedral ?? 0);
  return new THREE.Vector3(side * eta * w.span, yo, zle + u * c);
}
