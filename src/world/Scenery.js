import * as THREE from 'three';
import { hash2, smooth } from './noise.js';

const WALLS = [0xf1ece0, 0xe6d9c0, 0xd9c7a8, 0xf4f1ea, 0xcfd8dc, 0xe8c9a0, 0xb8c4cc, 0xeadfce], ROOFS = [0xa5503a, 0x8f4631, 0x5e6269, 0x7a3f2e, 0x3f4a55, 0xb8603e];
const prismGeo = (w, h, l) => { const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), g = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false }); g.translate(0, 0, -l / 2); return g; };

export class Scenery {
  constructor(T, scene) { this.T = T; this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.roads = []; this.buildTowns(); this.buildRoads(); }

  /** Is (x,z) buildable? */
  ok(x, z) { const T = this.T, h = T.heightAt(x, z); return h > 3 && h < 140 && T.slopeAt(x, z) < 0.16 && !T.nearRiver(x, z) && !T.isWater(x, z) && !T.cfg.airports.some(a => Math.hypot(a.x - x, a.z - z) < a.length * 0.5 + 280); }

  buildTowns() {
    const T = this.T, houses = [], blocks = [];
    for (const t of T.towns) {
      const ang = hash2(Math.round(t.x), Math.round(t.z), 1) * 1.2 - 0.6, ca = Math.cos(ang), sa = Math.sin(ang), pitch = 34, R = t.r * (0.6 + 0.6 * t.size);
      for (let u = -R; u <= R; u += pitch) for (let v = -R; v <= R; v += pitch) {
        const d = Math.hypot(u, v) / R; if (d > 1) continue; const cu = Math.floor(u / pitch), cv = Math.floor(v / pitch), r0 = hash2(cu, cv, Math.round(t.x));
        if (r0 > 0.82 - d * 0.45) continue; // thinner toward the edge
        const x = t.x + u * ca - v * sa, z = t.z + u * sa + v * ca; if (!this.ok(x, z)) continue;
        const core = d < 0.28 && t.size > 0.55, w = core ? 14 + hash2(cu, cv, 3) * 12 : 8 + hash2(cu, cv, 4) * 6, l = core ? 14 + hash2(cu, cv, 5) * 12 : 8 + hash2(cu, cv, 6) * 7, y = T.heightAt(x, z);
        if (core && hash2(cu, cv, 8) > 0.4) blocks.push({ x, y, z, w, l, h: 14 + hash2(cu, cv, 7) * 28, a: ang });
        else houses.push({ x, y, z, w, l, h: 3.6 + hash2(cu, cv, 2) * 3, a: ang + (hash2(cu, cv, 10) > 0.5 ? Math.PI / 2 : 0), ci: Math.floor(hash2(cu, cv, 11) * WALLS.length), ri: Math.floor(hash2(cu, cv, 12) * ROOFS.length) });
      }
      // main street cross
      for (const horiz of [0, 1]) { const pts = []; for (let s = -R * 1.05; s <= R * 1.05; s += 22) { const x = t.x + (horiz ? s * ca : -s * sa), z = t.z + (horiz ? s * sa : s * ca); pts.push({ x, z }); } this.roads.push({ pts, w: 8, town: true }); }
    }
    const wallM = new THREE.MeshStandardMaterial({ roughness: 0.9 }), roofM = new THREE.MeshStandardMaterial({ roughness: 0.8 }), glassM = new THREE.MeshStandardMaterial({ color: 0x9fb4c4, roughness: 0.25, metalness: 0.5 });
    const mk = (geo, mat, n) => new THREE.InstancedMesh(geo, mat, Math.max(n, 1)), unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    if (houses.length) {
      const wm = mk(unit, wallM, houses.length), rm = mk(prismGeo(1, 1, 1), roofM, houses.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
      houses.forEach((b, i) => { q.setFromAxisAngle(up, -b.a); p.set(b.x, b.y - 0.3, b.z); s.set(b.w, b.h, b.l); M.compose(p, q, s); wm.setMatrixAt(i, M); wm.setColorAt(i, c.set(WALLS[b.ci])); p.y = b.y - 0.3 + b.h; s.set(b.w + 1, 2 + b.w * 0.18, b.l + 0.8); M.compose(p, q, s); rm.setMatrixAt(i, M); rm.setColorAt(i, c.set(ROOFS[b.ri])); });
      wm.castShadow = rm.castShadow = true; wm.receiveShadow = rm.receiveShadow = true; this.group.add(wm, rm);
    }
    if (blocks.length) {
      const bm = mk(unit, glassM, blocks.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
      blocks.forEach((b, i) => { q.setFromAxisAngle(up, -b.a); p.set(b.x, b.y - 0.3, b.z); s.set(b.w, b.h, b.l); M.compose(p, q, s); bm.setMatrixAt(i, M); bm.setColorAt(i, c.setHSL(0.55 + hash2(i, 1, 2) * 0.1, 0.12, 0.62 + hash2(i, 2, 2) * 0.2)); });
      bm.castShadow = bm.receiveShadow = true; this.group.add(bm);
    }
  }

  /** Greedy route-finder that hugs low-slope dry land; returns polyline or null. */
  route(a, b) {
    const T = this.T, pts = [{ x: a.x, z: a.z }]; let x = a.x, z = a.z, hd = Math.atan2(b.z - a.z, b.x - a.x);
    for (let n = 0; n < 900; n++) {
      const tx = b.x - x, tz = b.z - z; if (Math.hypot(tx, tz) < 45) { pts.push({ x: b.x, z: b.z }); return pts; }
      const want = Math.atan2(tz, tx); let best = null, bs = 1e9;
      for (let k = -6; k <= 6; k++) {
        const ang = want + k * 0.2, nx = x + Math.cos(ang) * 30, nz = z + Math.sin(ang) * 30, h = T.heightAt(nx, nz);
        if (h < 1.8 || T.isWater(nx, nz) || T.nearRiver(nx, nz)) continue;
        const dh = Math.abs(h - T.heightAt(x, z)) / 30, turn = Math.abs(((ang - hd + Math.PI * 3) % (Math.PI * 2)) - Math.PI), sc = dh * 14 + Math.abs(k) * 0.12 + Math.min(turn, 1) * 0.5 + (dh > 0.14 ? 4 : 0);
        if (sc < bs) { bs = sc; best = { nx, nz, ang }; }
      }
      if (!best) return null; x = best.nx; z = best.nz; hd = best.ang; pts.push({ x, z });
    }
    return null;
  }
  buildRoads() {
    const T = this.T, nodes = [...T.towns.map(t => ({ x: t.x, z: t.z, id: t.id })), ...T.cfg.airports.filter(a => (a.surface || 'asphalt') === 'asphalt').map(a => { const r = a.heading * Math.PI / 180, s = (a.side || 1); return { x: a.x + Math.cos(r) * s * (a.width / 2 + (a.length >= 1000 ? 110 : 60)), z: a.z + Math.sin(r) * s * (a.width / 2 + (a.length >= 1000 ? 110 : 60)), id: a.id }; })], done = new Set();
    for (const n of nodes) {
      const near = nodes.filter(m => m !== n).sort((p, q) => Math.hypot(p.x - n.x, p.z - n.z) - Math.hypot(q.x - n.x, q.z - n.z)).slice(0, 2);
      for (const m of near) { const key = [n.id, m.id].sort().join('|'); if (done.has(key) || Math.hypot(m.x - n.x, m.z - n.z) > 6500) continue; done.add(key); const r = this.route(n, m); if (r) this.roads.push({ pts: r, w: 7, town: false }); }
    }
    const pos = [], idx = [], col = [], asph = new THREE.Color(0x44464a); let base = 0;
    for (const rd of this.roads) {
      // chaikin-smooth the polyline, then drape on terrain
      let pts = rd.pts; for (let it = 0; it < 2; it++) { const o = [pts[0]]; for (let i = 0; i < pts.length - 1; i++) { const a = pts[i], b = pts[i + 1]; o.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 }, { x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 }); } o.push(pts[pts.length - 1]); pts = o; }
      let run = 0, started = false;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i], a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, px = -tz / l * rd.w / 2, pz = tx / l * rd.w / 2, h = T.heightAt(p.x, p.z);
        const bad = h < 1.5 || T.isWater(p.x, p.z) || T.cfg.airports.some(ap => Math.hypot(ap.x - p.x, ap.z - p.z) < ap.length * 0.5 + 120 && Math.abs(h - ap.elev) > 2);
        if (bad) { started = false; continue; }
        const y = h + 0.35; pos.push(p.x + px, y, p.z + pz, p.x - px, y, p.z - pz); col.push(asph.r, asph.g, asph.b, asph.r, asph.g, asph.b);
        if (started) idx.push(base - 2, base, base - 1, base - 1, base, base + 1); started = true; base += 2; run++;
      }
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3)); g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); m.receiveShadow = true; m.frustumCulled = false; this.group.add(m);
    }
  }
}
