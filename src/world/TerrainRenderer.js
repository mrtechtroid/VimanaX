import * as THREE from 'three';
import { smooth, mix, hash2, mulberry32 } from './noise.js';

const CH = 64;                       // grid cells per chunk side (LOD0)
const LOD_DIST = [1900, 4300, 9500]; // chunk-distance thresholds for LOD1..3
const SKIRT = 40;                    // metres; hides cracks between LODs
const col = (h) => new THREE.Color(h);
const P = {
  sandShallow: col(0xe2d3a0), turq: col(0x3bb0b0), mid: col(0x1d78a6), deep: col(0x0a3558), foam: col(0xf4fbff),
  beach: col(0xe3d7a9), wet: col(0xb9aa7c), grassA: col(0x6f9a43), grassB: col(0x8aa851), dry: col(0xa7a85a),
  forestA: col(0x2c5a2b), forestB: col(0x3b6a2f), pine: col(0x1f4a30), rock: col(0x7b7468), scree: col(0x948d82), snow: col(0xf3f6f8), mud: col(0x7c6a4c),
  wheat: col(0xcfb862), green: col(0x80ab48), plow: col(0x8a6a47), pale: col(0xb9c46f),
};
const FIELD = [P.wheat, P.green, P.plow, P.pale, P.green, P.wheat];
const _c = new THREE.Color();

/** Tileable greyscale detail texture (no canvas needed, so it also works headless). */
function detailTexture(size = 256) {
  const d = new Uint8Array(size * size * 4), v = (x, y, s) => hash2(((x % size) + size) % size, ((y % size) + size) % size, s);
  const val = (x, y, f, s) => { const g = size / f, gx = x / g, gy = y / g, x0 = Math.floor(gx), y0 = Math.floor(gy), tx = gx - x0, ty = gy - y0, w = (a, b) => v(a * 1, b * 1, s); const a = w(x0 % f, y0 % f), b = w((x0 + 1) % f, y0 % f), c = w(x0 % f, (y0 + 1) % f), e = w((x0 + 1) % f, (y0 + 1) % f); const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty); return mix(mix(a, b, sx), mix(c, e, sx), sy); };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = val(x, y, 4, 1) * 0.35 + val(x, y, 16, 2) * 0.3 + val(x, y, 64, 3) * 0.2 + hash2(x, y, 4) * 0.15, g = Math.round(255 * (0.72 + 0.28 * n)), o = (y * size + x) * 4;
    d[o] = d[o + 1] = d[o + 2] = g; d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; return t;
}
/** Tileable wave normal map. */
function waveNormals(size = 128) {
  const h = new Float32Array(size * size), d = new Uint8Array(size * size * 4), W = (i) => (i + size) % size;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) h[y * size + x] = Math.sin(x / size * 6.283 * 3 + Math.sin(y / size * 6.283 * 2) * 1.3) * 0.5 + Math.sin(y / size * 6.283 * 5 + x / size * 6.283 * 2) * 0.35 + Math.sin((x + y) / size * 6.283 * 9) * 0.15;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = h[y * size + W(x + 1)] - h[y * size + W(x - 1)], dy = h[W(y + 1) * size + x] - h[W(y - 1) * size + x], l = Math.hypot(dx * 2.2, dy * 2.2, 1), o = (y * size + x) * 4;
    d[o] = 128 + 127 * (-dx * 2.2 / l); d[o + 1] = 128 + 127 * (-dy * 2.2 / l); d[o + 2] = 128 + 127 / l; d[o + 3] = 255;
  }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; return t;
}
function merge(parts) {
  const pos = [], nor = [], idx = []; let base = 0;
  for (const g0 of parts) { const g = g0, p = g.attributes.position, n = g.attributes.normal; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); } if (g.index) for (const i of g.index.array) idx.push(base + i); else for (let i = 0; i < p.count; i++) idx.push(base + i); base += p.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setIndex(idx); return m;
}

/** Streams terrain chunks around the camera with 4 LODs, plus sea, lakes, rivers and instanced forests near the viewer. */
export class TerrainRenderer {
  constructor(T, scene, opts = {}) {
    this.T = T; this.scene = scene; this.group = new THREE.Group(); scene.add(this.group); this.n = Math.round(T.N / CH); this.chunks = new Map(); this.treeQueue = []; this.tick = 0; this.trees = opts.trees !== false;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, map: detailTexture() });
    this.buildWater(); this.buildTreeGeoms();
  }

  /* ---------- colour ---------- */
  colorAt(x, z, h, slope, out) {
    const T = this.T, nz = T.noise;
    if (h < 0.1) { // seabed seen through the translucent sea surface
      const d = -h;
      if (d < 5) out.copy(P.sandShallow).lerp(P.turq, smooth(0.3, 5, d)); else if (d < 22) out.copy(P.turq).lerp(P.mid, smooth(5, 22, d)); else out.copy(P.mid).lerp(P.deep, smooth(22, 70, d));
      out.lerp(P.foam, (1 - smooth(0.2, 1.4, d)) * 0.8 * (0.6 + 0.4 * nz.n2(x * 0.05, z * 0.05)));
      return out;
    }
    const n = nz.fbm(x * 0.004, z * 0.004, 2) * 0.5 + 0.5, n2 = nz.n2(x * 0.03, z * 0.03) * 0.5 + 0.5, forest = T.forestAt(x, z, h, slope), field = T.fieldAt(x, z, h, slope);
    out.copy(P.grassA).lerp(P.grassB, n); out.lerp(P.dry, smooth(0.55, 0.9, n2) * 0.4 + smooth(120, 420, h) * 0.3);
    if (field > 0.05) { const a = 0.35, ca = Math.cos(a), sa = Math.sin(a), u = Math.floor((x * ca - z * sa) / 85), v = Math.floor((x * sa + z * ca) / 110); _c.copy(FIELD[Math.floor(hash2(u, v, 5) * FIELD.length)]); out.lerp(_c, Math.min(1, field * 1.6) * 0.92); }
    if (forest > 0.02) { _c.copy(h > 260 ? P.pine : P.forestA).lerp(P.forestB, n2); out.lerp(_c, Math.min(1, forest * 1.25) * 0.93); }
    if (T.nearRiver(x, z)) out.lerp(P.mud, 0.6);
    out.lerp(P.rock, smooth(0.38, 0.78, slope)); out.lerp(P.scree, smooth(560, 900, h + 60 * (n - 0.5)) * 0.8);
    out.lerp(P.snow, smooth(820, 980, h + 90 * (n2 - 0.5)) * (1 - smooth(0.7, 1.15, slope)));
    if (h < 3.4) out.lerp(P.beach, 1 - smooth(1.2, 3.4, h)); if (h < 1) out.lerp(P.wet, 1 - smooth(0.1, 1, h));
    return out;
  }

  /* ---------- chunk meshes ---------- */
  buildChunk(cx, cz, lod) {
    const T = this.T, S = T.S, H = T.H, step = 1 << lod, n = CH / step, V = n + 1, i0 = cx * CH, j0 = cz * CH, cell = T.cell, half = T.half;
    const total = V * V + 4 * V, pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), colr = new Float32Array(total * 3), uv = new Float32Array(total * 2), idx = [];
    for (let b = 0; b < V; b++) for (let a = 0; a < V; a++) {
      const gi = i0 + a * step, gj = j0 + b * step, k = gj * S + gi, x = -half + gi * cell, z = -half + gj * cell, h = H[k], v = b * V + a;
      const hl = H[gj * S + Math.max(gi - 1, 0)], hr = H[gj * S + Math.min(gi + 1, S - 1)], hu = H[Math.max(gj - 1, 0) * S + gi], hd = H[Math.min(gj + 1, S - 1) * S + gi];
      const nx = (hl - hr) / (2 * cell), nz2 = (hu - hd) / (2 * cell), nl = Math.hypot(nx, 1, nz2), slope = Math.hypot(nx, nz2);
      pos.set([x, h, z], v * 3); nor.set([nx / nl, 1 / nl, nz2 / nl], v * 3); this.colorAt(x, z, h, slope, _c); colr.set([_c.r, _c.g, _c.b], v * 3); uv.set([x / 70, z / 70], v * 2);
    }
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const p = b * V + a, q = p + V; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    // skirts: duplicate border vertices dropped by SKIRT metres, double-sided so winding never matters
    let s = V * V; const edges = [(t) => t, (t) => (V - 1) * V + t, (t) => t * V, (t) => t * V + V - 1];
    for (const e of edges) {
      const first = s; for (let t = 0; t < V; t++, s++) { const src = e(t); pos.set([pos[src * 3], pos[src * 3 + 1] - SKIRT, pos[src * 3 + 2]], s * 3); nor.set([nor[src * 3], nor[src * 3 + 1], nor[src * 3 + 2]], s * 3); colr.set([colr[src * 3], colr[src * 3 + 1], colr[src * 3 + 2]], s * 3); uv.set([uv[src * 2], uv[src * 2 + 1]], s * 2); }
      for (let t = 0; t < V - 1; t++) { const a = e(t), b = e(t + 1), c = first + t, d = first + t + 1; idx.push(a, b, c, b, d, c, a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeBoundingSphere(); g.boundingSphere.radius += 5;
    const m = new THREE.Mesh(g, this.mat); m.receiveShadow = true; this.group.add(m); return m;
  }
  setChunk(cx, cz, lod) {
    const key = cz * this.n + cx; let c = this.chunks.get(key);
    if (c && c.lod === lod) return;
    if (c) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); this.dropTrees(c); }
    c = { cx, cz, lod, mesh: this.buildChunk(cx, cz, lod), trees: [] }; this.chunks.set(key, c);
    if (lod === 0 && this.trees) this.treeQueue.push(c); // forests are generated one chunk per frame to avoid hitches
  }
  /** Call every frame with the camera position. Rebuilds at most `budget` chunks per call (unlimited when force). */
  update(cam, force = false, budget = 2) {
    const size = CH * this.T.cell, half = this.T.half, want = [];
    for (let cz = 0; cz < this.n; cz++) for (let cx = 0; cx < this.n; cx++) {
      const mx = -half + (cx + 0.5) * size, mz = -half + (cz + 0.5) * size, d = Math.max(0, Math.hypot(cam.x - mx, cam.z - mz) - size * 0.55), cur = this.chunks.get(cz * this.n + cx)?.lod;
      let lod = 3; for (let l = 0; l < 3; l++) { const th = LOD_DIST[l] * (cur !== undefined && cur <= l ? 1.12 : 0.95); if (d < th) { lod = l; break; } }
      if (cur !== lod) want.push({ cx, cz, lod, d, new: cur === undefined });
    }
    want.sort((a, b) => (b.new - a.new) || (a.d - b.d));
    let built = 0; for (const w of want) { if (!force && built >= budget && !w.new) break; this.setChunk(w.cx, w.cz, w.lod); built++; if (!force && built >= budget + 40) break; }
    // forests: one chunk per frame normally, the whole queue when forced (start-up)
    for (let k = force ? Infinity : 1; k > 0 && this.treeQueue.length; k--) { const c = this.treeQueue.shift(); if (this.chunks.get(c.cz * this.n + c.cx) === c && c.lod === 0) this.addTrees(c); }
  }

  /* ---------- trees ---------- */
  buildTreeGeoms() {
    const cone = (r, h, y, seg = 7) => { const g = new THREE.ConeGeometry(r, h, seg, 1, false); g.translate(0, y + h / 2, 0); return g; };
    this.conifer = merge([new THREE.CylinderGeometry(0.35, 0.5, 3, 5).translate(0, 1.5, 0), cone(3.3, 7, 2.2), cone(2.5, 6, 6.2), cone(1.6, 5, 10)]);
    this.broad = merge([new THREE.CylinderGeometry(0.4, 0.6, 4, 5).translate(0, 2, 0), new THREE.IcosahedronGeometry(3.6, 0).scale(1, 0.95, 1).translate(0, 7, 0), new THREE.IcosahedronGeometry(2.4, 0).translate(1.8, 5.4, 0.8)]);
    // two-tone: trunk is brown by baking per-vertex colours (y < 3 or 4 = trunk)
    for (const [g, ty] of [[this.conifer, 3], [this.broad, 4]]) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const trunk = p.getY(i) < ty && Math.hypot(p.getX(i), p.getZ(i)) < 0.7; c.set(trunk ? [0.30, 0.2, 0.12] : [1, 1, 1], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
    this.treeMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true, vertexColors: true });
  }
  addTrees(c) {
    const T = this.T, size = CH * T.cell, x0 = -T.half + c.cx * size, z0 = -T.half + c.cz * size, sp = 17, rnd = mulberry32(c.cx * 7919 + c.cz * 104729), con = [], brd = [], aps = T.cfg.airports;
    for (let zz = 0; zz < size; zz += sp) for (let xx = 0; xx < size; xx += sp) {
      const x = x0 + xx + (rnd() - 0.5) * sp, z = z0 + zz + (rnd() - 0.5) * sp, h = T.heightAt(x, z); if (h < 5) { rnd(); continue; }
      const sl = T.slopeAt(x, z), f = T.forestAt(x, z, h, sl); let p = f > 0.05 ? Math.min(1, f * 1.15) : (T.fieldAt(x, z, h, sl) > 0.1 ? 0.0 : 0.035 * (1 - smooth(300, 600, h)) * (h > 6 ? 1 : 0));
      const r = rnd(); if (r > p) continue;
      if (aps.some(a => Math.hypot(a.x - x, a.z - z) < a.length * 0.5 + 220) || T.towns.some(t => Math.hypot(t.x - x, t.z - z) < t.r * (0.55 + 0.4 * t.size))) continue;
      const s = 0.75 + rnd() * 0.75; (h > 200 || hash2(Math.floor(x / 90), Math.floor(z / 90), 3) > 0.6 ? con : brd).push([x, h - 0.4, z, s, rnd() * 6.28, rnd()]);
    }
    for (const [list, geo] of [[con, this.conifer], [brd, this.broad]]) {
      if (!list.length) continue; const m = new THREE.InstancedMesh(geo, this.treeMat, list.length), M = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), cc = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
      list.forEach(([x, y, z, k, a, t], i) => { q.setFromAxisAngle(up, a); s.set(k, k * (0.9 + t * 0.4), k); p.set(x, y, z); M.compose(p, q, s); m.setMatrixAt(i, M); const g = geo === this.conifer ? 0.7 + t * 0.35 : 0.8 + t * 0.4; cc.setRGB(0.55 * g, (geo === this.conifer ? 0.85 : 1.0) * g, 0.5 * g); if (geo === this.broad && t > 0.85) cc.setRGB(1.0, 0.8, 0.35); m.setColorAt(i, cc); });
      m.instanceMatrix.needsUpdate = true; m.castShadow = false; m.receiveShadow = false; this.group.add(m); c.trees.push(m);
    }
  }
  dropTrees(c) { for (const m of c.trees) { this.group.remove(m); m.dispose(); } c.trees = []; }

  /* ---------- water ---------- */
  buildWater() {
    const T = this.T; this.waveTex = waveNormals(); this.waveTex.repeat.set(T.size * 3 / 90, T.size * 3 / 90);
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x2f9bbd, roughness: 0.12, metalness: 0.05, transparent: true, opacity: 0.8, normalMap: this.waveTex, normalScale: new THREE.Vector2(0.55, 0.55), depthWrite: false });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(T.size * 3, T.size * 3).rotateX(-Math.PI / 2), this.waterMat); sea.renderOrder = 1; this.group.add(sea); this.sea = sea;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(T.size * 6, T.size * 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a3050 })); floor.position.y = -75; this.group.add(floor);
    // lakes: flat discs at their own water level (only visible where the basin dips below it)
    this.lakeTex = this.waveTex.clone(); this.lakeTex.needsUpdate = true; this.lakeTex.repeat.set(24, 24); this.riverTex = this.waveTex.clone(); this.riverTex.needsUpdate = true; this.riverTex.repeat.set(1, 1);
    this.lakeMat = this.waterMat.clone(); this.lakeMat.color.set(0x2f8fa8); this.lakeMat.opacity = 0.86; this.lakeMat.normalMap = this.lakeTex; this.lakeMat.side = THREE.DoubleSide;
    this.riverMat = this.lakeMat.clone(); this.riverMat.normalMap = this.riverTex; this.riverMat.opacity = 0.9;
    for (const l of T.lakes) { const m = new THREE.Mesh(new THREE.CircleGeometry(l.r * 1.3, 40).rotateX(-Math.PI / 2), this.lakeMat); m.position.set(l.x, l.level, l.z); m.renderOrder = 1; this.group.add(m); }
    // rivers: ribbons following each carved path
    for (const pts of T.rivers) {
      const pos = [], uvs = [], idx = []; let dist = 0;
      pts.forEach((p, i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, px = -tz / l, pz = tx / l, w = p.w * 0.95; if (i) dist += Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z); pos.push(p.x + px * w, p.y + 0.05, p.z + pz * w, p.x - px * w, p.y + 0.05, p.z - pz * w); uvs.push(0, dist / 40, p.w * 2 / 40, dist / 40); if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
      const m = new THREE.Mesh(g, this.riverMat); m.renderOrder = 1; m.frustumCulled = false; this.group.add(m);
    }
  }
  animate(dt) { for (const [t, k] of [[this.waveTex, 1], [this.lakeTex, 1], [this.riverTex, 1]]) { t.offset.x += dt * 0.004 * k; t.offset.y += dt * 0.0027 * k; } }
}
