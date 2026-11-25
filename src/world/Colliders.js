/**
 * Static solid objects (buildings, hangars, the tower, fuel tanks, trees) in a uniform spatial hash.
 * Pure data, no THREE: point tests are cheap enough to run for a dozen airframe probes every frame.
 *
 * Shapes (all y-up, y0 = bottom, y1 = top):
 *   box  : oriented rectangle. (c, s) is the unit direction of its width axis in the x-z plane, hw / hl are the half width / half length.
 *   cyl  : vertical cylinder of radius r.
 * `kind` ('building' | 'tower' | 'tank' | 'tree') tells the damage model how unforgiving the object is.
 */
const CELL = 32, OFF = 4096, STRIDE = 8192;
const cellKey = (ix, iz) => (ix + OFF) * STRIDE + (iz + OFF);
const _probeHit = { nx: 0, ny: 0, nz: 0, pen: 0, item: null };

export class Colliders {
  constructor() { this.cells = new Map(); this.count = 0; }

  /** Insert a prepared item into every cell its footprint touches. */
  _insert(it, x0, x1, z0, z1) {
    it._keys = [];
    for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
      const k = cellKey(ix, iz); let a = this.cells.get(k); if (!a) this.cells.set(k, a = []); a.push(it); it._keys.push(k);
    }
    this.count++; return it;
  }
  addBox({ x, z, c = 1, s = 0, hw, hl, y0, y1, kind = 'building' }) {
    const ex = Math.abs(c) * hw + Math.abs(s) * hl, ez = Math.abs(s) * hw + Math.abs(c) * hl;
    return this._insert({ t: 0, x, z, c, s, hw, hl, y0, y1, kind }, x - ex, x + ex, z - ez, z + ez);
  }
  addCyl({ x, z, r, y0, y1, kind = 'tower', mesh = null, idx = -1 }) {
    return this._insert({ t: 1, x, z, r, y0, y1, kind, mesh, idx, dead: false }, x - r, x + r, z - r, z + r);
  }
  /** Box given in an airport-local frame: origin (ox, oz), frame rotated by rotY (three.js Object3D.rotation.y), local centre (lx, lz), size w (local x) by l (local z). */
  addLocalBox(ox, oz, rotY, lx, lz, w, l, y0, y1, kind = 'building') {
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    return this.addBox({ x: ox + lx * cs + lz * sn, z: oz - lx * sn + lz * cs, c: cs, s: -sn, hw: w / 2, hl: l / 2, y0, y1, kind });
  }
  addLocalCyl(ox, oz, rotY, lx, lz, r, y0, y1, kind = 'tower') {
    const cs = Math.cos(rotY), sn = Math.sin(rotY);
    return this.addCyl({ x: ox + lx * cs + lz * sn, z: oz - lx * sn + lz * cs, r, y0, y1, kind });
  }
  remove(it) {
    if (!it?._keys) return; for (const k of it._keys) { const a = this.cells.get(k); if (!a) continue; const i = a.indexOf(it); if (i >= 0) a.splice(i, 1); if (!a.length) this.cells.delete(k); }
    it._keys = null; this.count--;
  }
  removeAll(list) { for (const it of list) this.remove(it); }

  /**
   * Is the point inside a solid? Fills `out` with the outward unit normal (nx, ny, nz), the penetration depth (pen) and the item.
   * (vx, vy, vz) is the point's velocity: among the faces it could have come through, the one it is moving into is preferred,
   * so a fast probe that ends up deep inside a wall is still pushed out of the face it actually hit.
   */
  test(x, y, z, vx, vy, vz, out) {
    const a = this.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return false;
    for (let i = 0; i < a.length; i++) {
      const it = a[i]; if (it.dead || y < it.y0 || y > it.y1) continue; const dx = x - it.x, dz = z - it.z;
      if (it.t === 1) {
        const d2 = dx * dx + dz * dz; if (d2 >= it.r * it.r) continue;
        const d = Math.sqrt(d2), top = it.y1 - y, rad = it.r - d;
        if (top < rad && vy < 0) { out.nx = 0; out.ny = 1; out.nz = 0; out.pen = top; } // came down onto the top
        else if (d > 1e-4) { out.nx = dx / d; out.ny = 0; out.nz = dz / d; out.pen = rad; }
        else { const sp = Math.hypot(vx, vz) || 1; out.nx = -vx / sp; out.ny = 0; out.nz = -vz / sp; out.pen = it.r; }
        out.item = it; return true;
      }
      const u = dx * it.c + dz * it.s, v = -dx * it.s + dz * it.c, pu = it.hw - Math.abs(u), pv = it.hl - Math.abs(v); if (pu <= 0 || pv <= 0) continue;
      const pt = it.y1 - y, su = u < 0 ? -1 : 1, sv = v < 0 ? -1 : 1;
      // candidate faces: [penetration, normal]. A face is "entered" when the point moves against its normal.
      const nu = [su * it.c, 0, su * it.s], nv = [-sv * it.s, 0, sv * it.c], nt = [0, 1, 0];
      const into = n => -(n[0] * vx + n[1] * vy + n[2] * vz);
      let best = null, bp = Infinity;
      for (const [p, n] of [[pu, nu], [pv, nv], [pt, nt]]) { const w = into(n) > 0 ? p : p + 1000; if (w < bp) { bp = w; best = [p, n]; } }
      out.nx = best[1][0]; out.ny = best[1][1]; out.nz = best[1][2]; out.pen = best[0]; out.item = it; return true;
    }
    return false;
  }

  /** Point test with a radius: centre first, then a 4-point ring. Returns the deepest contact; `out` keeps the same shape as test(). */
  testRadius(x, y, z, r, vx, vy, vz, out) {
    let hit = this.test(x, y, z, vx, vy, vz, out);
    if (r < 0.01) return hit;
    let best = hit ? out.pen : -Infinity;
    const ring = [r, 0, -r, 0, 0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const dx = ring[i * 2], dz = ring[i * 2 + 1];
      if (!this.test(x + dx, y, z + dz, vx, vy, vz, _probeHit)) continue;
      if (_probeHit.pen > best) { best = _probeHit.pen; out.nx = _probeHit.nx; out.ny = _probeHit.ny; out.nz = _probeHit.nz; out.pen = _probeHit.pen; out.item = _probeHit.item; }
      hit = true;
    }
    return hit;
  }

  /** Swept, radius-aware segment test against statics. Samples at least every 0.5 m, at most 32 samples. */
  sweep(x0, y0, z0, x1, y1, z1, r, vx, vy, vz, out) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz);
    const n = Math.min(32, Math.max(1, Math.ceil(len / Math.max(0.5, r))));
    for (let i = 1; i <= n; i++) { const t = i / n; if (this.testRadius(x0 + dx * t, y0 + dy * t, z0 + dz * t, r, vx, vy, vz, out)) return true; }
    return false;
  }

  /** Collect all statics whose footprint/height overlaps the box (deduped across hash cells). */
  queryAABB(x0, x1, z0, z1, y0, y1, out = []) {
    out.length = 0; const seen = new Set();
    for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++) {
      const a = this.cells.get(cellKey(ix, iz)); if (!a) continue;
      for (const it of a) { if (seen.has(it) || it.dead || it.y1 < y0 || it.y0 > y1) continue; seen.add(it); out.push(it); }
    }
    return out;
  }
}
