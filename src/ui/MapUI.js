import * as THREE from 'three';
import { UNITS } from '../config/units.js';
const _v = new THREE.Vector3();

/** Minimap (tap to expand) + full map: tap to add route waypoints (snaps to airports). Corner X closes. Route advances automatically. */
export class MapUI {
  constructor() { this.route = []; this.idx = 0; this.big = false; }
  init(e) {
    this.e = e; const c = this.c = document.createElement('canvas'); c.id = 'map'; document.getElementById('hud').appendChild(c); this.g = c.getContext('2d'); this.layout();
    addEventListener('resize', () => this.layout());
    e.bus.on('action', a => { if (a === 'map') { this.big = !this.big; this.layout(); } else if (a === 'clearRoute') { this.route = []; this.idx = 0; e.bus.emit('hud:message', 'Route cleared'); } });
    c.addEventListener('pointerdown', ev => {
      if (!this.big) { this.big = true; return this.layout(); }
      const r = c.getBoundingClientRect(), ox = ev.clientX - r.left, oy = ev.clientY - r.top, s = c.width, k = s / e.world.cfg.size;
      if (ox < 36 && oy < 36) { this.big = false; return this.layout(); }
      let w = { x: (ox - s / 2) / k, z: (oy - s / 2) / k }; const ap = e.world.cfg.airports.find(p => Math.hypot(p.x - w.x, p.z - w.z) < 500); if (ap) w = { x: ap.x, z: ap.z };
      this.route.push(w); e.bus.emit('hud:message', `Waypoint ${this.route.length}${ap ? ' - ' + ap.name : ''}`);
    });
  }
  layout() { const s = this.big ? Math.floor(Math.min(innerWidth, innerHeight) * 0.88) : innerWidth < 760 ? 100 : 150; this.c.width = this.c.height = s; this.c.className = this.big ? 'big' : ''; }
  info(a, units) {
    if (!this.route.length) return ''; const w = this.route[this.idx], dx = w.x - a.pos.x, dz = w.z - a.pos.z, [u, f] = UNITS[units].dist;
    return `WPT ${this.idx + 1}/${this.route.length}  ${(Math.hypot(dx, dz) * f).toFixed(1)} ${u}  BRG ${String(Math.round((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360)).padStart(3, '0')}°`;
  }
  update() {
    const e = this.e, a = e.cargo.driven || e.aircraft.player, g = this.g, s = this.c.width; if (!a) return;
    if (this.route.length) { const w = this.route[this.idx]; if (Math.hypot(w.x - a.pos.x, w.z - a.pos.z) < 250 && this.idx < this.route.length - 1) this.idx++; }
    const big = this.big, k = big ? s / e.world.cfg.size : s / 5000, cx = big ? 0 : a.pos.x, cz = big ? 0 : a.pos.z, X = x => s / 2 + (x - cx) * k, Z = z => s / 2 + (z - cz) * k;
    g.fillStyle = '#1d5f8a'; g.fillRect(0, 0, s, s);
    for (const i of e.world.cfg.islands) { g.fillStyle = '#5f8f45'; g.beginPath(); g.arc(X(i.x), Z(i.z), i.r * k * 0.93, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; g.font = '11px monospace';
    for (const p of e.world.cfg.airports) { g.fillRect(X(p.x) - 2, Z(p.z) - 2, 4, 4); if (big) g.fillText(p.name, X(p.x) + 6, Z(p.z)); }
    if (this.route.length) { g.strokeStyle = '#ffb43c'; g.lineWidth = 2; g.beginPath(); g.moveTo(X(a.pos.x), Z(a.pos.z)); this.route.slice(this.idx).forEach(w => g.lineTo(X(w.x), Z(w.z))); g.stroke(); this.route.forEach((w, i) => g.fillText(i + 1, X(w.x) + 4, Z(w.z) - 4)); }
    _v.set(0, 0, -1).applyQuaternion(a.quat); g.save(); g.translate(X(a.pos.x), Z(a.pos.z)); g.rotate(Math.atan2(_v.x, -_v.z)); g.fillStyle = '#ffb43c'; g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 6); g.lineTo(-5, 6); g.fill(); g.restore();
    if (big) { g.fillStyle = '#fff'; g.font = '18px monospace'; g.fillText('✕', 10, 24); }
  }
}
