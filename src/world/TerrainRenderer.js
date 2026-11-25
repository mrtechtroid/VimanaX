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
// Scratch used while filling tree instance buffers (reused across chunks).
const _M = new THREE.Matrix4(), _qT = new THREE.Quaternion(), _sT = new THREE.Vector3(), _pT = new THREE.Vector3(), _cc = new THREE.Color(), _UP = new THREE.Vector3(0, 1, 0);

/* Water: world-space shader shared by sea, lakes and rivers. The depth/foam mask is baked from the real heightfield so shorelines match the terrain. */
const WATER_VS = `attribute float aLevel; uniform float uLevel; varying vec3 vWorld; varying float vWaterY;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz; vWaterY = uLevel + aLevel; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const WATER_FS = `uniform sampler2D uWave, uMask;
uniform vec3 uCam, uSunDir, uSunCol, uSky, uFog, uShallow, uDeep, uFoam;
uniform vec2 uWind; uniform float uTime, uFogFar, uOpacity, uHalf, uSize;
varying vec3 vWorld; varying float vWaterY;
void main(){
  vec2 p = vWorld.xz;
  vec4 mask = texture2D(uMask, clamp((p + uHalf) / uSize, 0.002, 0.998));
  float bed = mask.b * 200.0 - 100.0;                            // depth measured from THIS water surface (sea, lake or river)
  float below = vWaterY - bed;
  float depth = clamp(below / 45.0, 0.0, 1.0);
  float shore = clamp(1.0 - abs(below) / 5.0, 0.0, 1.0) * mask.r;
  vec3 viewDir = normalize(uCam - vWorld);
  // two wave layers scroll in opposite, wind-aligned directions so the surface never looks like a static texture
  vec3 n1 = texture2D(uWave, p / 62.0 + uWind * uTime * 0.0045).xyz * 2.0 - 1.0;
  vec3 n2 = texture2D(uWave, p / 27.0 - uWind.yx * uTime * 0.0031).xyz * 2.0 - 1.0;
  vec3 N = normalize(vec3(n1.x + n2.x * 0.7, 2.2, n1.z + n2.z * 0.7));
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, viewDir), 0.0), 5.0);
  vec3 col = mix(uShallow, uDeep, depth);
  col = mix(col, uSky, fres * 0.82);                                   // sky reflection grows at grazing angles
  vec3 H = normalize(uSunDir + viewDir);
  float gl = pow(max(dot(N, H), 0.0), 180.0) * 1.7 + pow(max(dot(N, H), 0.0), 18.0) * 0.12;
  col += uSunCol * gl;                                                 // sun glitter / specular path
  float wob = sin(p.x * 0.08 + uTime * 1.4) * sin(p.y * 0.061 - uTime * 1.1);
  float foam = smoothstep(0.38, 0.86, shore + wob * 0.16) * 0.6;
  col = mix(col, uFoam, foam);                                         // animated foam along the real coastline
  col = mix(col, uFog, clamp(length(uCam - vWorld) / uFogFar, 0.0, 1.0) * 0.8);
  gl_FragColor = vec4(col, clamp(uOpacity * (0.62 + 0.35 * fres) + foam * 0.25, 0.0, 1.0));
}`;

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
    this.T = T; this.scene = scene; this.col = opts.colliders ?? null; this.group = new THREE.Group(); scene.add(this.group); this.n = Math.round(T.N / CH); this.chunks = new Map(); this.treeQueue = []; this.tick = 0; this.trees = opts.trees !== false;
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
    if (field > 0.05) { const a = 0.35, ca = Math.cos(a), sa = Math.sin(a), u = Math.floor((x * ca - z * sa) / 85), v = Math.floor((x * sa + z * ca) / 110); _c.copy(FIELD[Math.floor(hash2(u, v, 5) * FIELD.length)]);
      const rows = 0.94 + 0.07 * (0.5 + 0.5 * Math.sin((x * sa + z * ca) * 0.36)); _c.multiplyScalar(rows); // faint crop rows break up the flat colour patches
      out.lerp(_c, Math.min(1, field * 1.6) * 0.92); }
    if (forest > 0.02) { _c.copy(h > 260 ? P.pine : P.forestA).lerp(P.forestB, n2); out.lerp(_c, Math.min(1, forest * 1.25) * 0.93); }
    if (T.nearRiver(x, z)) out.lerp(P.mud, 0.6);
    out.lerp(P.rock, smooth(0.38, 0.78, slope)); out.lerp(P.scree, smooth(560, 900, h + 60 * (n - 0.5)) * 0.8);
    if (slope > 0.35) out.multiplyScalar(1 + 0.035 * Math.sin(h * 0.11 + n * 5)); // rock strata banding on steep faces
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
      // Direct typed-array writes: a LOD0 chunk has 4k vertices, so array literals here meant ~17k short-lived arrays per chunk.
      this.colorAt(x, z, h, slope, _c);
      let o3 = v * 3, o2 = v * 2;
      pos[o3] = x; pos[o3 + 1] = h; pos[o3 + 2] = z;
      nor[o3] = nx / nl; nor[o3 + 1] = 1 / nl; nor[o3 + 2] = nz2 / nl;
      colr[o3] = _c.r; colr[o3 + 1] = _c.g; colr[o3 + 2] = _c.b;
      uv[o2] = x / 70; uv[o2 + 1] = z / 70;
    }
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) { const p = b * V + a, q = p + V; idx.push(p, q, p + 1, p + 1, q, q + 1); }
    // skirts: duplicate border vertices dropped by SKIRT metres, double-sided so winding never matters
    let s = V * V; const edges = [(t) => t, (t) => (V - 1) * V + t, (t) => t * V, (t) => t * V + V - 1];
    for (const e of edges) {
      const first = s; for (let t = 0; t < V; t++, s++) { const src = e(t), a3 = src * 3, b3 = s * 3, a2 = src * 2, b2 = s * 2;
        pos[b3] = pos[a3]; pos[b3 + 1] = pos[a3 + 1] - SKIRT; pos[b3 + 2] = pos[a3 + 2];
        nor[b3] = nor[a3]; nor[b3 + 1] = nor[a3 + 1]; nor[b3 + 2] = nor[a3 + 2];
        colr[b3] = colr[a3]; colr[b3 + 1] = colr[a3 + 1]; colr[b3 + 2] = colr[a3 + 2];
        uv[b2] = uv[a2]; uv[b2 + 1] = uv[a2 + 1]; }
      for (let t = 0; t < V - 1; t++) { const a = e(t), b = e(t + 1), c = first + t, d = first + t + 1; idx.push(a, b, c, b, d, c, a, c, b, b, c, d); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeBoundingSphere(); g.boundingSphere.radius += 5;
    const m = new THREE.Mesh(g, this.mat); m.receiveShadow = lod <= 1; // distant chunks are far outside the shadow frustum: skip the shadow lookup there
    this.group.add(m); return m;
  }
  setChunk(cx, cz, lod) {
    const key = cz * this.n + cx; let c = this.chunks.get(key);
    if (c && c.lod === lod) return;
    if (c) { this.group.remove(c.mesh); c.mesh.geometry.dispose(); this.dropTrees(c); }
    c = { cx, cz, lod, mesh: this.buildChunk(cx, cz, lod), trees: [], solids: [] }; this.chunks.set(key, c);
    if (lod === 0 && this.trees) this.treeQueue.push(c); // forests are generated one chunk per frame to avoid hitches
  }
  /**
   * Stream chunks around the viewer. `radius` (in chunk widths) limits the initial prime so start-up does not build the whole map;
   * `vel` biases LOD selection toward where the player is heading, so chunks are ready before they come into view.
   * Rebuilds at most `budget` chunks per call (radius/ignore budget only when forcing the initial prime).
   */
  update(cam, force = false, budget = 2, radius = Infinity, vel = null) {
    if (!force && (this.tick = (this.tick || 0) - 1) > 0) return; // throttle the 256-chunk scan, but keep streaming even while parked
    if (!force) this.tick = 2;
    const size = CH * this.T.cell, half = this.T.half, want = this.want ??= [];
    want.length = 0;
    const speed = vel ? Math.hypot(vel.x, vel.z) : 0;
    for (let cz = 0; cz < this.n; cz++) for (let cx = 0; cx < this.n; cx++) {
      const mx = -half + (cx + 0.5) * size, mz = -half + (cz + 0.5) * size, d = Math.max(0, Math.hypot(cam.x - mx, cam.z - mz) - size * 0.55), cur = this.chunks.get(cz * this.n + cx)?.lod;
      if (d > radius * size) continue;
      let dd = d;
      if (speed > 1) dd = Math.max(0, d - Math.max(0, ((mx - cam.x) * vel.x + (mz - cam.z) * vel.z) / speed) * 0.75); // look ahead along the velocity vector
      let lod = 3; for (let l = 0; l < 3; l++) { const th = LOD_DIST[l] * (cur !== undefined && cur <= l ? 1.12 : 0.95); if (dd < th) { lod = l; break; } }
      if (cur !== lod) want.push({ cx, cz, lod, d: dd, new: cur === undefined });
    }
    want.sort((a, b) => (b.new - a.new) || (a.d - b.d));
    let built = 0; for (const w of want) { if (!force && built >= budget) break; this.setChunk(w.cx, w.cz, w.lod); built++; }
    // forests: at most two chunks per frame normally, the whole queue when forced (start-up prime)
    for (let k = force ? Infinity : 2; k > 0 && this.treeQueue.length; k--) { const c = this.treeQueue.shift(); if (this.chunks.get(c.cz * this.n + c.cx) === c && c.lod === 0) this.addTrees(c); }
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
      if (!list.length) continue; const m = new THREE.InstancedMesh(geo, this.treeMat, list.length);
      list.forEach(([x, y, z, k, a, t], i) => { _qT.setFromAxisAngle(_UP, a); _sT.set(k, k * (0.9 + t * 0.4), k); _pT.set(x, y, z); _M.compose(_pT, _qT, _sT); m.setMatrixAt(i, _M); const g = geo === this.conifer ? 0.7 + t * 0.35 : 0.8 + t * 0.4; _cc.setRGB(0.55 * g, (geo === this.conifer ? 0.85 : 1.0) * g, 0.5 * g); if (geo === this.broad && t > 0.85) _cc.setRGB(1.0, 0.8, 0.35); m.setColorAt(i, _cc); });
      m.instanceMatrix.needsUpdate = true; m.castShadow = false; m.receiveShadow = false; this.group.add(m); c.trees.push(m);
      // trees are solid while their chunk exists: trunk plus inner canopy as one cylinder (a little forgiving on purpose)
      if (this.col) list.forEach(([x, y, z, k, a, t], i) => c.solids.push(this.col.addCyl({ x, z, r: 1.6 * k, y0: y, y1: y + 11 * k * (0.9 + t * 0.4), kind: 'tree', mesh: m, idx: i })));
    }
  }
  dropTrees(c) { for (const m of c.trees) { this.group.remove(m); m.dispose(); } c.trees = []; if (this.col && c.solids.length) this.col.removeAll(c.solids); c.solids = []; }

  /* ---------- water ---------- */
  /** Bake the bed height from the grid: R = shoreline noise, B = height encoded from -100..100 m. Depth/foam are derived per water surface in the shader. */
  buildDepthMask(res = 512) {
    const T = this.T, d = new Uint8Array(res * res * 4);
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = -T.half + i / (res - 1) * T.size, z = -T.half + j / (res - 1) * T.size, h = T.heightAt(x, z);
      const rough = 0.65 + 0.35 * hash2(i * 0.37, j * 0.37, 11);
      const o = (j * res + i) * 4; d[o] = rough * 255; d[o + 1] = 0; d[o + 2] = (Math.min(100, Math.max(-100, h)) + 100) / 200 * 255; d[o + 3] = 255;
    }
    const t = new THREE.DataTexture(d, res, res, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
    return t;
  }
  buildWater() {
    const T = this.T; this.waveTex = waveNormals(); this.depthMask = this.buildDepthMask(); this.waterMats = [];
    const make = (opacity, shallow, deep, level = 0) => {
      const m = new THREE.ShaderMaterial({ vertexShader: WATER_VS, fragmentShader: WATER_FS, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uWave: { value: this.waveTex }, uMask: { value: this.depthMask }, uLevel: { value: level }, uCam: { value: new THREE.Vector3() },
          uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) }, uSky: { value: new THREE.Color(0x8cbcf0) }, uFog: { value: new THREE.Color(0x8cbcf0) },
          uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) }, uFoam: { value: new THREE.Color(0xf2fbff) },
          uWind: { value: new THREE.Vector2(1, 0) }, uTime: { value: 0 }, uFogFar: { value: 30000 }, uOpacity: { value: opacity }, uHalf: { value: T.half }, uSize: { value: T.size } } });
      this.waterMats.push(m); return m;
    };
    this.waterMat = make(0.82, 0x39b6c4, 0x0a3b62);
    const seaGeo = new THREE.PlaneGeometry(T.size * 3, T.size * 3).rotateX(-Math.PI / 2);
    seaGeo.setAttribute('level', new THREE.Float32BufferAttribute(new Float32Array(seaGeo.attributes.position.count), 1)); // sea level = 0
    const sea = new THREE.Mesh(seaGeo, this.waterMat); sea.renderOrder = 1; this.group.add(sea); this.sea = sea;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(T.size * 6, T.size * 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0a3050 })); floor.position.y = -75; this.group.add(floor);
    // lakes: flat discs at their own water level (the depth mask makes their edges blend into the shore)
    this.lakeMat = make(0.88, 0x2fa8b4, 0x0b4c70);
    for (const l of T.lakes) {
      const geo = new THREE.CircleGeometry(l.r * 1.3, 40).rotateX(-Math.PI / 2);
      geo.setAttribute('level', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count).fill(l.level), 1));
      const m = new THREE.Mesh(geo, this.lakeMat); m.position.set(l.x, l.level, l.z); m.renderOrder = 1; this.group.add(m);
    }
    // rivers: ribbons following each carved path, carrying their own surface height so the shader measures depth correctly upstream
    this.riverMat = make(0.9, 0x4fb2b8, 0x105776);
    for (const pts of T.rivers) {
      const pos = [], levels = [], idx = [];
      pts.forEach((p, i) => { const a = pts[Math.max(i - 1, 0)], b = pts[Math.min(i + 1, pts.length - 1)], tx = b.x - a.x, tz = b.z - a.z, l = Math.hypot(tx, tz) || 1, px = -tz / l, pz = tx / l, w = p.w * 0.95;
        pos.push(p.x + px * w, p.y + 0.05, p.z + pz * w, p.x - px * w, p.y + 0.05, p.z - pz * w);
        levels.push(p.y + 0.05, p.y + 0.05);
        if (i) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); } });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('level', new THREE.Float32BufferAttribute(levels, 1)); g.setIndex(idx); g.computeVertexNormals(); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.riverMat); m.renderOrder = 1; this.group.add(m);
    }
  }
  /** Feed sun, sky, fog, camera and wind to the water shaders every frame. */
  animate(dt, e) {
    const env = e?.env;
    if (env) { // wet weather darkens and cools the whole landscape, not just the sky
      const wet = { clear: 0, cloudy: 0.35, overcast: 0.7, fog: 0.55 }[env.weather] ?? 0;
      this.mat.color.setRGB(1 - 0.17 * wet, 1 - 0.12 * wet, 1 - 0.07 * wet);
    }
    for (const m of this.waterMats) {
      const u = m.uniforms; u.uTime.value += dt;
      if (e?.camera) u.uCam.value.copy(e.camera.position);
      if (env) {
        u.uSunDir.value.copy(env.sunDir); u.uSunCol.value.copy(env.sunColor);
        u.uSky.value.copy(env.sky); if (e.scene?.fog) { u.uFog.value.copy(e.scene.fog.color); u.uFogFar.value = e.scene.fog.far; }
        const r = env.wind.from * Math.PI / 180; u.uWind.value.set(Math.sin(r), -Math.cos(r)); // direction the wind blows toward
      }
    }
  }
}
