/** Seeded, dependency-free 2D gradient noise + fractal helpers (pure maths, runs in Node and the browser). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Integer hash -> [0,1). Cheap, stateless: used for per-cell jitter (trees, fields, buildings). */
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
}
const G = new Float32Array(512 * 2);
export function makeNoise(seed) {
  const rnd = mulberry32(seed), perm = new Uint16Array(512), p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 512; i++) { const a = rnd() * Math.PI * 2; G[i * 2] = Math.cos(a); G[i * 2 + 1] = Math.sin(a); }
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  /** Perlin gradient noise, range ~[-1,1]. */
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
    const a = perm[perm[X] + Y], b = perm[perm[X + 1] + Y], c = perm[perm[X] + Y + 1], d = perm[perm[X + 1] + Y + 1];
    const u = fade(xf), v = fade(yf);
    const g = (h, dx, dy) => G[h * 2] * dx + G[h * 2 + 1] * dy;
    const l1 = g(a, xf, yf) + u * (g(b, xf - 1, yf) - g(a, xf, yf)), l2 = g(c, xf, yf - 1) + u * (g(d, xf - 1, yf - 1) - g(c, xf, yf - 1));
    return (l1 + v * (l2 - l1)) * 1.41;
  };
  /** Fractal Brownian motion, normalised to ~[-1,1]. */
  const fbm = (x, y, oct = 5, lac = 2.0, gain = 0.5) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); n += a; a *= gain; f *= lac; } return s / n; };
  /** Ridged multifractal, [0,1]: sharp crests, good for mountain ranges. */
  const ridged = (x, y, oct = 5, lac = 2.0, gain = 0.5) => { let s = 0, a = 1, f = 1, n = 0, w = 1; for (let i = 0; i < oct; i++) { let r = 1 - Math.abs(n2(x * f, y * f)); r *= r; r *= w; w = Math.min(1, Math.max(0, r * 1.6)); s += r * a; n += a; a *= gain; f *= lac; } return s / n; };
  return { n2, fbm, ridged };
}
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const mix = (a, b, t) => a + (b - a) * t;
