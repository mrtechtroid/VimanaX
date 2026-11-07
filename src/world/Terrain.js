import { makeNoise, smooth, mix, mulberry32, hash2 } from './noise.js';

const D2R = Math.PI / 180;

/**
 * Finite, procedurally generated archipelago stored as a regular height grid (metres, sea level = 0).
 * Pure data (no THREE): heightAt/slopeAt/forestAt/... are cheap bilinear lookups, safe to call from physics every substep.
 * Pipeline: warped island masks -> ridged mountains + hills -> lakes -> downhill rivers (carved) -> airport plateaus.
 */
export class Terrain {
  constructor(cfg) {
    this.cfg = cfg; this.size = cfg.size; this.half = cfg.size / 2; this.N = cfg.grid || 1024; this.S = this.N + 1; this.cell = this.size / this.N;
    this.noise = makeNoise(cfg.seed ?? 1); this.H = new Float32Array(this.S * this.S); this.wet = new Uint8Array(this.S * this.S);
    this.lakes = []; this.rivers = []; this.towns = []; this.build();
  }

  /** Continuous base height before lakes/rivers/airports. */
  raw(x, z) {
    const { fbm, ridged } = this.noise, cfg = this.cfg;
    // Domain warp: bends straight island circles into bays, peninsulas and headlands.
    const wx = x + 1300 * fbm(x * 0.00028 + 3.1, z * 0.00028 - 1.7, 3) + 260 * fbm(x * 0.0013 + 5, z * 0.0013, 3), wz = z + 1300 * fbm(x * 0.00028 - 8.2, z * 0.00028 + 5.3, 3) + 260 * fbm(x * 0.0013 - 9, z * 0.0013 + 2, 3);
    let t = -1, hAmp = 0, peak = 0;
    for (const i of cfg.islands) {
      const d = Math.hypot(wx - i.x, wz - i.z) / i.r, ti = 1 - d;
      if (ti > t) { t = ti; hAmp = i.h; }
      peak = Math.max(peak, ti);
    }
    // Scattered islets/reefs from low-frequency noise.
    const nIsl = fbm(x * 0.0009 + 40, z * 0.0009 - 12, 3) * 0.6 + 0.4 * fbm(x * 0.0035, z * 0.0035, 2), isl = smooth(0.4, 0.58, nIsl) * 0.4 * smooth(0.25, 0.55, peak + 0.9);
    if (isl > t) { t = isl; hAmp = 55; }
    const edge = Math.max(Math.abs(x), Math.abs(z)); t -= smooth(this.half * 0.8, this.half * 0.97, edge) * 1.2; // ocean all around the map border
    const tc = t - 0.03; // coastline contour
    if (tc <= 0) {
      const k = -tc;
      let h = -(14 * (1 - Math.exp(-k * 14)) + 62 * smooth(0.1, 0.5, k));
      if (k < 0.25) h += 2.4 * fbm(x * 0.006, z * 0.006, 2) * (1 - k * 4); // sandbars / reefs
      return h;
    }
    const lowland = smooth(0.0, 0.12, tc), inland = smooth(0.1, 0.9, tc);
    let h = 0.1 + 3 * smooth(0, 0.035, tc) + lowland * (8 + 22 * (0.5 + 0.5 * fbm(x * 0.0011 + 9, z * 0.0011 + 4, 3)));
    const rg = ridged(x * 0.00055 + 17, z * 0.00055 - 23, 5);
    h += hAmp * 1.3 * Math.pow(inland, 1.35) * (0.05 + 0.95 * Math.pow(rg, 1.9)) * (0.55 + 0.45 * (0.5 + 0.5 * fbm(x * 0.0004, z * 0.0004, 2)));
    h += lowland * (0.5 + 0.5 * inland) * 9 * fbm(x * 0.0042 + 2, z * 0.0042 + 8, 3); // rolling relief
    h += lowland * 1.8 * fbm(x * 0.018, z * 0.018, 2); // micro detail
    for (const a of cfg.airports) { if (a.water) continue; const e = typeof a.elev === 'number' ? a.elev : 20, dd = Math.hypot(x - a.x, z - a.z) / (a.length * 0.3 + 150), w = smooth(1.2, 3.6, dd); if (w < 1) h = mix(e + 0.25 * (h - e) * smooth(0.4, 4, dd), h, w); }
    return Math.max(h, 0.15);
  }

  bilinear(arr, x, z) {
    const fx = (x + this.half) / this.cell, fz = (z + this.half) / this.cell;
    if (fx < 0 || fz < 0 || fx >= this.N || fz >= this.N) return null;
    const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, S = this.S, i = iz * S + ix;
    return (arr[i] * (1 - tx) + arr[i + 1] * tx) * (1 - tz) + (arr[i + S] * (1 - tx) + arr[i + S + 1] * tx) * tz;
  }
  heightAt(x, z) { const v = this.bilinear(this.H, x, z); return v === null ? -70 : v; }
  slopeAt(x, z) { const d = this.cell; const gx = (this.heightAt(x + d, z) - this.heightAt(x - d, z)) / (2 * d), gz = (this.heightAt(x, z + d) - this.heightAt(x, z - d)) / (2 * d); return Math.hypot(gx, gz); }
  /** Water surface height at a point: lake level inside lakes, else sea level 0. */
  waterLevelAt(x, z) { for (const l of this.lakes) if (Math.hypot(x - l.x, z - l.z) < l.r * 1.3 && this.heightAt(x, z) < l.level) return l.level; return 0; }
  isWater(x, z) { return this.heightAt(x, z) < this.waterLevelAt(x, z) - 0.02; }
  nearRiver(x, z) { return (this.bilinear(this.wet, x, z) || 0) > 100; }

  /** 0..1 woodland density from noise, suppressed on steep, high, wet or sandy ground. */
  forestAt(x, z, h = this.heightAt(x, z), slope = this.slopeAt(x, z)) {
    if (h < 6 || this.nearRiver(x, z)) return 0;
    const n = this.noise.fbm(x * 0.0016 + 11, z * 0.0016 - 7, 4) * 0.5 + 0.5;
    return smooth(0.42, 0.6, n) * (1 - smooth(0.45, 0.8, slope)) * (1 - smooth(520, 760, h)) * smooth(6, 20, h);
  }
  /** Farmland patchwork 0..1 on flat, low ground (fields are rotated 20deg cells). */
  fieldAt(x, z, h = this.heightAt(x, z), slope = this.slopeAt(x, z)) {
    if (h < 5 || h > 90 || slope > 0.12) return 0;
    return smooth(0.5, 0.62, this.noise.fbm(x * 0.0009 - 30, z * 0.0009 + 31, 3) * 0.5 + 0.5) * (1 - smooth(0.06, 0.12, slope));
  }

  build() {
    const { S, N, cell, half, H } = this;
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) H[j * S + i] = this.raw(-half + i * cell, -half + j * cell);
    this.snapAirportElev(); this.carveLakes(); this.carveRivers(); this.flattenAirports(); this.placeTowns();
  }

  snapAirportElev() { for (const a of this.cfg.airports) if (!a.water && (a.elev === undefined || a.elev === 'auto')) { let m = 0, n = 0; for (let k = 0; k < 16; k++) { const c = k / 16 * 6.283; m += this.heightAt(a.x + Math.cos(c) * a.length * 0.45, a.z + Math.sin(c) * a.length * 0.45); n++; } a.elev = Math.max(4, Math.round(m / n)); } }

  carveLakes() {
    const { S, cell, half, H } = this;
    for (const l0 of this.cfg.lakes || []) {
      let ring = 1e9; for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; ring = Math.min(ring, this.heightAt(l0.x + Math.cos(a) * l0.r * 1.35, l0.z + Math.sin(a) * l0.r * 1.35)); }
      const level = Math.max(ring - 0.6, 2), lake = { ...l0, level }; this.lakes.push(lake);
      const R = l0.r * 1.6, i0 = Math.max(0, Math.floor((l0.x - R + half) / cell)), i1 = Math.min(S - 1, Math.ceil((l0.x + R + half) / cell)), j0 = Math.max(0, Math.floor((l0.z - R + half) / cell)), j1 = Math.min(S - 1, Math.ceil((l0.z + R + half) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const x = -half + i * cell, z = -half + j * cell, wob = 1 + 0.28 * this.noise.fbm(x * 0.004 + l0.x, z * 0.004, 2), d = Math.hypot(x - l0.x, z - l0.z) / (l0.r * wob);
        if (d > 1.45) continue; const k = j * S + i, bowl = level - 1 - 7 * (1 - Math.min(d, 1) ** 2);
        H[k] = mix(Math.min(H[k], bowl), H[k], smooth(0.95, 1.45, d));
      }
    }
  }

  carveRivers() {
    const { S, N, cell, half, H } = this, rnd = mulberry32((this.cfg.seed ?? 1) * 7 + 3), want = this.cfg.rivers ?? 10;
    const HS = new Float32Array(H); // smoothed copy so streams ignore micro-noise
    const tmp = new Float32Array(H.length);
    for (let pass = 0; pass < 3; pass++) { for (let j = 1; j < S - 1; j++) for (let i = 1; i < S - 1; i++) { const k = j * S + i; tmp[k] = (HS[k] * 4 + HS[k - 1] + HS[k + 1] + HS[k - S] + HS[k + S]) / 8; } HS.set(tmp); }
    const hs = (x, z) => { const fx = (x + half) / cell, fz = (z + half) / cell; if (fx < 1 || fz < 1 || fx >= N - 1 || fz >= N - 1) return -70; const ix = fx | 0, iz = fz | 0, tx = fx - ix, tz = fz - iz, i = iz * S + ix; return (HS[i] * (1 - tx) + HS[i + 1] * tx) * (1 - tz) + (HS[i + S] * (1 - tx) + HS[i + S + 1] * tx) * tz; };
    const sources = []; let tries = 0;
    while (sources.length < want && tries++ < 6000) {
      const x = (rnd() - 0.5) * this.size * 0.8, z = (rnd() - 0.5) * this.size * 0.8, h = hs(x, z);
      if (h < 60 || h > 520 || sources.some(s => Math.hypot(s.x - x, s.z - z) < 1500)) continue; sources.push({ x, z });
    }
    for (const s of sources) {
      let { x, z } = s, dx = 0, dz = 0, y = hs(x, z), run = y, pts = [], stuck = 0; const step = cell * 0.9;
      for (let n = 0; n < 1500; n++) {
        const e = cell, gx = (hs(x + e, z) - hs(x - e, z)) / (2 * e), gz = (hs(x, z + e) - hs(x, z - e)) / (2 * e), gl = Math.hypot(gx, gz) || 1e-6;
        let nx = -gx / gl, nz = -gz / gl; const wig = Math.sin(n * 0.045 + s.x) * 0.35; const px = -nz, pz = nx; nx += px * wig; nz += pz * wig;
        dx = dx * 0.72 + nx * 0.28; dz = dz * 0.72 + nz * 0.28; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        x += dx * step; z += dz * step; y = hs(x, z); run = Math.min(run, y);
        pts.push({ x, z, y: run }); if (y < 0.4) break; if (gl < 0.003 && y > 3) { if (++stuck > 160) break; } else stuck = 0;
        if (Math.abs(x) > half - 300 || Math.abs(z) > half - 300) break;
      }
      if (pts.length < 50 || hs(pts[pts.length - 1].x, pts[pts.length - 1].z) > 10) continue; // only rivers that reach the sea
      for (let pass = 0; pass < 6; pass++) for (let i = 1; i < pts.length - 1; i++) { pts[i].x = (pts[i - 1].x + pts[i].x * 2 + pts[i + 1].x) / 4; pts[i].z = (pts[i - 1].z + pts[i].z * 2 + pts[i + 1].z) / 4; }
      let prev = 1e9; pts.forEach((p, i) => { p.y = Math.max(Math.min(prev, p.y - 1.2), 0.25); prev = p.y; p.w = 10 + 34 * Math.pow(i / pts.length, 0.75); });
      this.rivers.push(pts);
      for (const p of pts) {
        const R = p.w * 2.2, i0 = Math.max(0, Math.floor((p.x - R + half) / cell)), i1 = Math.min(S - 1, Math.ceil((p.x + R + half) / cell)), j0 = Math.max(0, Math.floor((p.z - R + half) / cell)), j1 = Math.min(S - 1, Math.ceil((p.z + R + half) / cell)), bed = p.y - 1.8;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const d = Math.hypot(-half + i * cell - p.x, -half + j * cell - p.z); if (d > R) continue; const k = j * S + i;
          const tgt = bed + (H[k] - bed) * smooth(p.w * 0.5, p.w * 2.0, d); if (tgt < H[k]) H[k] = tgt;
          if (d < p.w * 1.3 && H[k] > -2) this.wet[k] = Math.max(this.wet[k], 255 * (1 - smooth(p.w * 0.9, p.w * 1.3, d)));
        }
      }
    }
  }

  flattenAirports() {
    const { S, cell, half, H } = this;
    for (const a of this.cfg.airports) {
      if (a.water) continue; const r = a.heading * D2R, sn = Math.sin(r), cs = Math.cos(r), R = Math.max(a.length, 800) / 2 + 500;
      const i0 = Math.max(0, Math.floor((a.x - R + half) / cell)), i1 = Math.min(S - 1, Math.ceil((a.x + R + half) / cell)), j0 = Math.max(0, Math.floor((a.z - R + half) / cell)), j1 = Math.min(S - 1, Math.ceil((a.z + R + half) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = -half + i * cell - a.x, dz = -half + j * cell - a.z, along = dx * sn - dz * cs, across = dx * cs + dz * sn, k = j * S + i;
        const paved = (a.surface || 'asphalt') === 'asphalt', d = Math.hypot(Math.max(Math.abs(across) - a.width / 2 - (paved ? (a.length >= 1000 ? 210 : 110) : 70), 0), Math.max(Math.abs(along) - a.length / 2 - (a.length >= 1000 ? 270 : 110), 0)), tcell = smooth(0, 1, 1 - d / 320);
        if (tcell > 0) { H[k] = mix(H[k], a.elev, tcell); if (tcell > 0.5) this.wet[k] = 0; }
      }
    }
  }

  /** Snap configured towns to nearby flat dry land so they never end up in the sea. */
  placeTowns() {
    for (const t of this.cfg.towns || []) {
      let best = null, bs = 1e9;
      for (let ring = 0; ring <= 12 && bs > 0.02; ring++) for (let k = 0; k < (ring ? 16 : 1); k++) {
        const a = k / 16 * 6.283, x = t.x + Math.cos(a) * ring * 160, z = t.z + Math.sin(a) * ring * 160, h = this.heightAt(x, z);
        let sc = this.slopeAt(x, z) + (h < 4 ? 1 : 0) + (h > 120 ? 0.5 : 0) + (this.nearRiver(x, z) ? 0.6 : 0) + (this.cfg.airports.some(ap => Math.hypot(ap.x - x, ap.z - z) < ap.length * 0.5 + 350) ? 1 : 0);
        for (let q = 0; q < 8 && sc < 0.9; q++) { const xx = x + Math.cos(q * 0.785) * t.r * 0.8, zz = z + Math.sin(q * 0.785) * t.r * 0.8; sc += (this.heightAt(xx, zz) < 3 ? 0.35 : 0) + this.slopeAt(xx, zz) * 0.5; }
        if (sc < bs) { bs = sc; best = { x, z }; }
      }
      this.towns.push({ ...t, x: best.x, z: best.z, y: this.heightAt(best.x, best.z) });
    }
  }

  /** Surface id for gameplay (friction etc). Water is handled by the caller (needs waterLevelAt). */
  surfaceId(x, z, h = this.heightAt(x, z), slope = this.slopeAt(x, z)) {
    if (h > 900 - 120 * slope && slope < 0.7) return 'snow';
    if (slope > 0.6 || h > 650) return 'rock';
    if (h < 3.2 || this.nearRiver(x, z)) return 'sand';
    if (this.fieldAt(x, z, h, slope) > 0.55 && hash2(Math.floor(x / 120), Math.floor(z / 120), 9) > 0.7) return 'dirt';
    return 'grass';
  }

  /** RGBA minimap raster (res x res) covering the whole map: bathymetry, hillshade, rivers. */
  mapRaster(res = 768) {
    const px = new Uint8ClampedArray(res * res * 4), step = this.size / res;
    for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
      const x = -this.half + (i + 0.5) * step, z = -this.half + (j + 0.5) * step, h = this.heightAt(x, z), o = (j * res + i) * 4;
      let r, g, b;
      if (h < 0 || this.waterLevelAt(x, z) > h) { const d = smooth(0, 45, -h); r = mix(70, 10, d); g = mix(150, 45, d); b = mix(175, 80, d); }
      else {
        const sh = (this.heightAt(x - step, z - step) - this.heightAt(x + step, z + step)) * 0.012, hh = smooth(0, 800, h);
        if (h < 3) { r = 214; g = 200; b = 150; } else if (h > 760) { r = 240; g = 242; b = 244; } else if (h > 420) { const q = smooth(420, 760, h); r = mix(128, 205, q); g = mix(112, 200, q); b = mix(92, 196, q); } else { const q = smooth(0, 420, h); r = mix(104, 138, q); g = mix(150, 126, q); b = mix(78, 88, q); }
        if (this.forestAt(x, z) > 0.5) { r *= 0.68; g *= 0.82; b *= 0.68; } if (this.nearRiver(x, z)) { r = 70; g = 140; b = 190; }
        const k = 1 + Math.max(-0.35, Math.min(0.35, sh)); r *= k; g *= k; b *= k;
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = 255;
    }
    return { data: px, width: res, height: res };
  }
}
