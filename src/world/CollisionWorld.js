import * as THREE from 'three';

const _x = new THREE.Vector3();
/**
 * Dynamic collision bodies. Handles are rebuilt from the authoritative owners once per frame, so there is no stale
 * state after respawns, chunk unloads or cargo removal. Statics stay in the existing spatial hash (world.colliders).
 */
export class CollisionWorld {
  constructor(statics) { this.statics = statics; this.bodies = []; }

  rebuild(e) {
    const b = this.bodies; b.length = 0;
    for (const ac of e.aircraft?.list || []) {
      if (ac.destroyed) continue;
      const box = ac.bounds;
      b.push({ owner: ac, type: 'aircraft', pos: ac.pos, quat: ac.quat, vel: ac.vel,
        hw: Math.max(1, Math.abs(box.min.x), Math.abs(box.max.x)), hl: Math.max(2, Math.abs(box.min.z), Math.abs(box.max.z)),
        y0: ac.pos.y + box.min.y, y1: ac.pos.y + box.max.y, mass: ac.mass });
    }
    for (const it of e.cargo?.items || []) {
      if (it.state !== 'ground') continue; // bay cargo is inside the aircraft; airborne cargo is handled by its own sweep
      const veh = it.type === 'vehicle';
      b.push({ owner: it, type: it.type, pos: it.pos, quat: it.quat, vel: it.vel,
        hw: veh ? it.def.halfWidth : 0.8, hl: veh ? it.def.length * 0.5 : 0.8, r: 0.8,
        y0: it.pos.y, y1: it.pos.y + (veh ? 2 : 1.4), mass: it.mass });
    }
    const w = e.walk;
    if (w && w.mode === 'foot') b.push({ owner: w, type: 'walker', pos: w.pos, quat: null, vel: w.vel, r: 0.32, y0: w.pos.y, y1: w.pos.y + 1.8, mass: 80 });
  }

  /** Test a point with radius against dynamic bodies. `skip` owner is ignored. out = {nx,ny,nz,pen,body}. */
  test(x, y, z, r, skip, out, extraSkip = null) {
    let found = false, best = -Infinity;
    for (const b of this.bodies) {
      if (b.owner === skip || b.owner === extraSkip || y < b.y0 - r || y > b.y1 + r) continue;
      const dx = x - b.pos.x, dz = z - b.pos.z;
      let nx = 0, nz = 0, pen = 0;
      if (b.type === 'crate' || b.type === 'walker') {
        const rr = (b.r || 0.8) + r, d2 = dx * dx + dz * dz;
        if (d2 >= rr * rr) continue;
        const d = Math.sqrt(d2);
        nx = d > 1e-4 ? dx / d : 1; nz = d > 1e-4 ? dz / d : 0; pen = rr - d;
      } else {
        _x.set(1, 0, 0).applyQuaternion(b.quat); // oriented box: width axis in world space
        const c = _x.x, s = _x.z, u = dx * c + dz * s, v = -dx * s + dz * c;
        const pu = b.hw + r - Math.abs(u), pv = b.hl + r - Math.abs(v);
        if (pu <= 0 || pv <= 0) continue;
        if (pu < pv) { const sg = u < 0 ? -1 : 1; nx = sg * c; nz = sg * s; pen = pu; }
        else { const sg = v < 0 ? -1 : 1; nx = -sg * s; nz = sg * c; pen = pv; }
      }
      if (pen > best) { best = pen; out.nx = nx; out.ny = 0; out.nz = nz; out.pen = pen; out.body = b; found = true; }
    }
    return found;
  }

  sweep(x0, y0, z0, x1, y1, z1, r, skip, out) {
    const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, len = Math.hypot(dx, dy, dz);
    const n = Math.min(24, Math.max(1, Math.ceil(len / Math.max(0.5, r))));
    for (let i = 1; i <= n; i++) { const t = i / n; if (this.test(x0 + dx * t, y0 + dy * t, z0 + dz * t, r, skip, out)) return true; }
    return false;
  }
}
