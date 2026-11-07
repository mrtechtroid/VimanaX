import * as THREE from 'three';
import { UNITS } from '../config/units.js';
const _v = new THREE.Vector3(), D2R = Math.PI / 180;
const C = { sea1: '#1b5d80', sea2: '#0d3a56', sand: '#cdbf8c', land: '#4a7a3e', hill: '#355a31', txt: '#e8f2f0', mag: '#ff62d2', cyan: '#58d6ff', line: 'rgba(200,230,240,.16)' };
const FONT = (px, w = 400) => `${w} ${px}px "B612", system-ui, sans-serif`;

/** Heading-up circular minimap (tap to expand) + north-up full map: tap to add route waypoints (snaps to airports). Corner X closes. Route advances automatically. */
export class MapUI {
  constructor() { this.route = []; this.idx = 0; this.big = false; }
  init(e) {
    this.e = e; const c = this.c = document.createElement('canvas'); c.id = 'map'; document.getElementById('hud').appendChild(c); this.g = c.getContext('2d'); this.layout();
    addEventListener('resize', () => this.layout());
    e.bus.on('action', a => { if (a === 'map') { this.big = !this.big; this.layout(); } else if (a === 'clearRoute') { this.route = []; this.idx = 0; e.bus.emit('hud:message', 'Route cleared'); } });
    c.addEventListener('pointerdown', ev => {
      if (!this.big) { this.big = true; return this.layout(); }
      const r = c.getBoundingClientRect(), ox = (ev.clientX - r.left) * c.width / r.width, oy = (ev.clientY - r.top) * c.height / r.height, s = c.width, k = s / e.world.cfg.size;
      if (ox < 44 && oy < 44) { this.big = false; return this.layout(); }
      let w = { x: (ox - s / 2) / k, z: (oy - s / 2) / k }; const ap = e.world.cfg.airports.find(p => Math.hypot(p.x - w.x, p.z - w.z) < 500); if (ap) w = { x: ap.x, z: ap.z };
      this.route.push(w); e.bus.emit('hud:message', `Waypoint ${this.route.length}${ap ? ' - ' + ap.name : ''}`);
    });
  }
  layout() { const compact = document.body.classList.contains('compact') || innerWidth < 900, s = this.big ? Math.floor(Math.min(innerWidth, innerHeight) * 0.88) : compact ? 96 : 156; this.c.width = this.c.height = s; this.c.style.width = this.c.style.height = s + 'px'; this.c.className = this.big ? 'big' : ''; }
  /** Active waypoint guidance for the HUD / PFD, or null without a route. */
  guidance(a) {
    if (!this.route.length) return null; const w = this.route[this.idx], dx = w.x - a.pos.x, dz = w.z - a.pos.z;
    return { idx: this.idx + 1, n: this.route.length, dist: Math.hypot(dx, dz), brg: (Math.atan2(dx, -dz) / D2R + 360) % 360 };
  }
  info(a, units) { const g = this.guidance(a); if (!g) return ''; const [u, f] = UNITS[units].dist; return `WPT ${g.idx}/${g.n}  ${(g.dist * f).toFixed(1)} ${u}  BRG ${String(Math.round(g.brg)).padStart(3, '0')}\u00b0`; }
  /** One-off canvas of the world raster (bathymetry, relief, rivers) so the map matches the real terrain. */
  terrainImage(w) {
    if (this._img !== undefined) return this._img; this._img = null;
    try { const r = w.mapRaster(768), cv = document.createElement('canvas'); cv.width = r.width; cv.height = r.height; const x = cv.getContext('2d'); if (x && typeof ImageData !== 'undefined') { x.putImageData(new ImageData(r.data, r.width, r.height), 0, 0); this._img = cv; } } catch { /* headless */ }
    return this._img;
  }
  update() {
    const e = this.e, a = e.walk.focus, g = this.g, s = this.c.width, big = this.big; if (!a) return;
    if (!this.layoutOk && document.body.classList.contains('compact')) { this.layoutOk = true; this.layout(); }
    if (this.route.length) { const w = this.route[this.idx]; if (Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < 250 && this.idx < this.route.length - 1) this.idx++; }
    _v.set(0, 0, -1).applyQuaternion(a.quat); const h = Math.atan2(_v.x, -_v.z), k = big ? s / e.world.cfg.size : s / 5000, cx = big ? 0 : a.pos.x, cz = big ? 0 : a.pos.z;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s, s); g.save();
    if (!big) { g.beginPath(); g.arc(s / 2, s / 2, s / 2, 0, 7); g.clip(); }
    const sea = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s * 0.75); sea.addColorStop(0, C.sea1); sea.addColorStop(1, C.sea2); g.fillStyle = sea; g.fillRect(0, 0, s, s);
    g.translate(s / 2, s / 2); if (!big) g.rotate(-h); g.translate(-cx * k, -cz * k); // world metres -> canvas: x = X*k, y = Z*k
    if (big) { g.strokeStyle = C.line; g.lineWidth = 1; const half = e.world.cfg.size / 2; for (let m = -half; m <= half; m += 1000) { g.beginPath(); g.moveTo(m * k, -half * k); g.lineTo(m * k, half * k); g.moveTo(-half * k, m * k); g.lineTo(half * k, m * k); g.stroke(); } }
    const img = this.terrainImage(e.world); if (img) { g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; const sz = e.world.cfg.size * k; g.drawImage(img, -sz / 2, -sz / 2, sz, sz); }
    if (big) { g.font = FONT(10); g.textAlign = 'center'; for (const t of e.world.terrain.towns) { g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.arc(t.x * k, t.z * k, 3, 0, 7); g.fill(); g.fillStyle = C.txt; g.fillText(t.name, t.x * k, t.z * k + 13); } }
    g.font = FONT(big ? 12 : 9); g.textBaseline = 'middle';
    for (const p of e.world.cfg.airports) {
      const r = p.heading * D2R, dx = Math.sin(r) * p.length / 2 * k, dz = -Math.cos(r) * p.length / 2 * k;
      g.strokeStyle = C.txt; g.lineCap = 'round'; g.lineWidth = Math.max(2, p.width * k * 3); g.beginPath(); g.moveTo(p.x * k - dx, p.z * k - dz); g.lineTo(p.x * k + dx, p.z * k + dz); g.stroke();
      if (big) { g.save(); g.translate(p.x * k, p.z * k); g.fillStyle = C.txt; g.textAlign = 'left'; g.fillText(p.name, 10, -14); g.restore(); }
    }
    if (this.route.length) {
      g.strokeStyle = C.mag; g.fillStyle = C.mag; g.lineWidth = 2; g.setLineDash([7, 5]); g.beginPath(); g.moveTo(a.pos.x * k, a.pos.z * k); this.route.slice(this.idx).forEach(w => g.lineTo(w.x * k, w.z * k)); g.stroke(); g.setLineDash([]);
      this.route.forEach((w, i) => { g.beginPath(); g.arc(w.x * k, w.z * k, i === this.idx ? 5 : 3.5, 0, 7); g.fill(); if (big) { g.fillStyle = C.txt; g.textAlign = 'left'; g.fillText(i + 1, w.x * k + 8, w.z * k - 8); g.fillStyle = C.mag; } });
    }
    g.restore(); g.save();
    // own aircraft (always at the centre of the minimap)
    g.translate(s / 2 + (big ? a.pos.x * k : 0), s / 2 + (big ? a.pos.z * k : 0)); g.rotate(big ? h : 0); g.fillStyle = C.cyan; g.strokeStyle = '#04141c'; g.lineWidth = 1.5; const u = big ? 9 : 7;
    g.beginPath(); g.moveTo(0, -u); g.lineTo(u * 0.7, u * 0.8); g.lineTo(0, u * 0.4); g.lineTo(-u * 0.7, u * 0.8); g.closePath(); g.stroke(); g.fill(); g.restore();
    if (!big) { // range rings + north marker
      g.strokeStyle = C.line; g.lineWidth = 1; for (const f of [0.33, 0.66]) { g.beginPath(); g.arc(s / 2, s / 2, s / 2 * f, 0, 7); g.stroke(); }
      g.fillStyle = C.txt; g.font = FONT(10, 700); g.textAlign = 'center'; g.fillText('N', s / 2 - Math.sin(h) * (s / 2 - 9), s / 2 - Math.cos(h) * (s / 2 - 9));
    } else {
      g.fillStyle = 'rgba(9,24,33,.8)'; g.beginPath(); g.roundRect(10, 10, 30, 30, 9); g.fill(); g.strokeStyle = C.txt; g.lineWidth = 2; g.beginPath(); g.moveTo(19, 19); g.lineTo(31, 31); g.moveTo(31, 19); g.lineTo(19, 31); g.stroke();
      g.fillStyle = C.txt; g.font = FONT(12); g.textAlign = 'center'; g.fillText('Tap to add a waypoint. Airports snap. Clear the route with 2.', s / 2, s - 16);
      g.font = FONT(12, 700); g.fillText('N', s - 22, 24); g.beginPath(); g.moveTo(s - 22, 36); g.lineTo(s - 22, 52); g.strokeStyle = C.txt; g.stroke();
      const km = 1000 * k; g.strokeStyle = C.txt; g.lineWidth = 2; g.beginPath(); g.moveTo(16, s - 40); g.lineTo(16 + km, s - 40); g.stroke(); g.textAlign = 'left'; g.fillText('1 km', 22 + km, s - 40);
    }
  }
}
