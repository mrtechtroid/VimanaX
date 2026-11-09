import * as THREE from 'three';
import { WEATHER } from './Environment.js';
const SPAN = 28000, HALF = SPAN / 2, TAU = Math.PI * 2;
const VS = `attribute vec3 aOff; attribute float aScale; attribute float aShade; uniform vec3 uCam, uDrift; varying vec2 vUv; varying float vShade, vFade, vDist;
void main(){ vec3 p = aOff + uDrift; p.xz = mod(p.xz - uCam.xz + ${HALF.toFixed(1)}, ${SPAN.toFixed(1)}) - ${HALF.toFixed(1)} + uCam.xz;
  vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = length(mv.xyz); mv.xy += position.xy * aScale; gl_Position = projectionMatrix * mv; vUv = uv; vShade = aShade; vDist = d;
  vFade = smoothstep(110.0, 420.0, d) * (1.0 - smoothstep(9000.0, 13500.0, d)); }`;
const FS = `uniform sampler2D uMap; uniform vec3 uLit, uShadow, uFog; uniform float uOpacity; varying vec2 vUv; varying float vShade, vFade, vDist;
void main(){ float a = texture2D(uMap, vUv).a; vec3 c = mix(uShadow, uLit, vShade); c = mix(c, uFog, smoothstep(3000.0, 13000.0, vDist) * 0.7); gl_FragColor = vec4(c, a * uOpacity * vFade); if (gl_FragColor.a < 0.003) discard; }`;
const rnd = (() => { let s = 1337; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
const gauss = () => (rnd() + rnd() + rnd() - 1.5) / 0.75;

function puffTexture() {
  if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { const x = 64 + gauss() * 22, y = 64 + gauss() * 16, r = 20 + rnd() * 26, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.2)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function stratusTexture() {
  if (typeof document === 'undefined') return null; const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) { const x = rnd() * 256, y = rnd() * 256, r = 10 + rnd() * 34, gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(120,125,135,0.22)'); gr.addColorStop(1, 'rgba(120,125,135,0)'); for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) { g.save(); g.translate(ox, oy); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); g.restore(); } }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const _lit = new THREE.Color(), _shadow = new THREE.Color(), _white = new THREE.Color(1, 1, 1), _cool = new THREE.Color(0.7, 0.74, 0.8), _fogTint = new THREE.Color(0.75, 0.78, 0.82);
const wrap = (v, c) => ((v - c + HALF) % SPAN + SPAN) % SPAN - HALF + c;

/** Cumulus clusters (instanced soft billboards, wrapped around the camera, drifting with the wind) + stratus deck. Flying through cloud cuts visibility (env.visibility). */
export class Clouds {
  constructor() { this.clusters = []; this.puffs = []; this.drift = new THREE.Vector3(); this.sortT = 0; this.weather = null; this.inside = 0; }
  init(e) {
    this.e = e; this.tex = puffTexture();
    this.mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: false, uniforms: { uMap: { value: this.tex }, uLit: { value: new THREE.Color(1, 1, 1) }, uShadow: { value: new THREE.Color(.6, .65, .72) }, uFog: { value: new THREE.Color() }, uOpacity: { value: 0.9 }, uCam: { value: new THREE.Vector3() }, uDrift: { value: this.drift } } });
    this.strat = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: stratusTexture(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, fog: false })); this.strat.renderOrder = -50; this.strat.visible = false; e.scene.add(this.strat);
    this.build(e.env.weather);
  }
  build(weather) {
    const e = this.e, W = WEATHER[weather]; this.weather = weather; this.clusters = []; this.puffs = [];
    const count = { clear: 22, cloudy: 70, overcast: 80, fog: 26 }[weather] ?? 30, lo = { clear: 1500, cloudy: 1400, overcast: 1250, fog: 380 }[weather], hi = { clear: 2400, cloudy: 2300, overcast: 1700, fog: 700 }[weather];
    for (let i = 0; i < count; i++) {
      const s = (weather === 'overcast' ? 500 : 260) + rnd() * 520, c = { x: (rnd() - 0.5) * SPAN, y: lo + rnd() * (hi - lo), z: (rnd() - 0.5) * SPAN, s, r: s * 0.62, puffs: [] }; this.clusters.push(c);
      const n = 11 + Math.floor(rnd() * 8);
      for (let k = 0; k < n; k++) { const gx = gauss(), gz = gauss(), rr = Math.hypot(gx, gz) / 1.6, py = Math.abs(gauss()) * s * 0.16 + s * 0.26 * Math.max(0, 1 - rr * rr) - s * 0.05; this.puffs.push({ x: c.x + gx * s * 0.42, y: c.y + py, z: c.z + gz * s * 0.42, sc: s * (0.42 + rnd() * 0.4) * (1 - rr * 0.35), c, h: py / (s * 0.4) }); }
    }
    this.relight(); this.upload(true); this.strat.visible = W.cover > 0.28 && weather !== 'fog'; this.strat.material.opacity = weather === 'overcast' ? 0.88 : 0.28; this.stratAlt = weather === 'overcast' ? 2100 : 2900; this.strat.position.y = this.stratAlt;
  }
  relight() { const s = this.e.env.sunDir; for (const p of this.puffs) { const c = p.c, dx = p.x - c.x, dy = p.y - c.y + c.s * 0.1, dz = p.z - c.z, l = Math.hypot(dx, dy, dz) || 1; p.shade = THREE.MathUtils.clamp(0.42 + 0.35 * ((dx * s.x + dy * s.y + dz * s.z) / l) + 0.35 * p.h + 0.15 * s.y, 0.15, 1); } }
  upload(rebuild = false) {
    const n = this.puffs.length; if (!n) return;
    if (rebuild || !this.mesh) {
      if (this.mesh) { this.e.scene.remove(this.mesh); this.mesh.geometry.dispose(); }
      const g = new THREE.InstancedBufferGeometry(); const q = new THREE.PlaneGeometry(1, 1); g.index = q.index; g.setAttribute('position', q.attributes.position); g.setAttribute('uv', q.attributes.uv);
      this.aOff = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3); this.aSc = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); this.aSh = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
      g.setAttribute('aOff', this.aOff); g.setAttribute('aScale', this.aSc); g.setAttribute('aShade', this.aSh); g.instanceCount = n;
      this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = -40; this.e.scene.add(this.mesh);
    }
    const cam = this.e.camera.position, P = this.puffs;
    if (!this.order || this.order.length !== n) { this.order = new Uint32Array(n); this.dist = new Float32Array(n); }
    const dist = this.dist, order = this.order;
    for (let i = 0; i < n; i++) { const p = P[i], dx = wrap(p.x + this.drift.x, cam.x) - cam.x, dz = wrap(p.z + this.drift.z, cam.z) - cam.z, dy = p.y - cam.y; dist[i] = dx * dx + dy * dy + dz * dz; order[i] = i; }
    order.sort((a, b) => dist[b] - dist[a]); // far to near, so near puffs blend last
    for (let i = 0; i < n; i++) { const p = P[order[i]]; this.aOff.setXYZ(i, p.x, p.y, p.z); this.aSc.setX(i, p.sc); this.aSh.setX(i, p.shade); } this.aOff.needsUpdate = this.aSc.needsUpdate = this.aSh.needsUpdate = true;
  }
  update(dt, e) {
    const env = e.env; if (env.weather !== this.weather) this.build(env.weather);
    if (e.paused) return;
    const cam = e.camera.position; this.drift.x += -Math.sin(env.wind.from * Math.PI / 180) * env.wind.speed * 0.6 * dt; this.drift.z += Math.cos(env.wind.from * Math.PI / 180) * env.wind.speed * 0.6 * dt;
    const u = this.mat.uniforms; u.uCam.value.copy(cam); const night = 1 - 0.92 * env.night; u.uLit.value.copy(env.sunColor).lerp(_white, 0.55).multiplyScalar(night * (0.55 + 0.5 * env.sunDir.y)); u.uShadow.value.copy(env.sky).lerp(_cool, 0.5).multiplyScalar(0.7 * night + 0.03); u.uFog.value.copy(env.sky); u.uOpacity.value = this.weather === 'overcast' ? 0.95 : 0.88;
    this.strat.position.x = cam.x; this.strat.position.z = cam.z; this.strat.material.color.copy(env.sky).lerp(_white, 0.6).multiplyScalar(Math.max(0.05, night * (0.5 + 0.5 * env.sunDir.y)));
    if ((this.sortT -= dt) <= 0) { this.sortT = 0.45; this.relightT = (this.relightT || 0) + 1; if (this.relightT % 8 === 0) this.relight(); this.upload(); }
    // inside-cloud density at the camera (what you see) -> visibility
    let dmax = 0; const p = e.camera.position;
    for (const c of this.clusters) { const dx = wrap(c.x + this.drift.x, p.x) - p.x, dz = wrap(c.z + this.drift.z, p.z) - p.z, dy = p.y - (c.y + c.s * 0.12); if (Math.abs(dy) > c.s * 0.34) continue; const d = Math.hypot(dx, dz); if (d < c.r) dmax = Math.max(dmax, (1 - d / c.r) * (1 - Math.abs(dy) / (c.s * 0.34))); }
    if (this.strat.visible && Math.abs(p.y - this.stratAlt) < 90) dmax = Math.max(dmax, this.strat.material.opacity * (1 - Math.abs(p.y - this.stratAlt) / 90));
    this.inside += (Math.min(1, dmax * 2.2) - this.inside) * Math.min(1, dt * 1.5); env.visibility = 1 - 0.92 * this.inside; env.e.scene.fog.color.copy(env.sky).lerp(_fogTint.set(0.75, 0.78, 0.82).multiplyScalar(Math.max(0.1, night)), this.inside * 0.85);
  }
}
