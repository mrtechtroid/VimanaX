import * as THREE from 'three';

/** Particle recipes: colour, blending, size growth (m), life (s), opacity at birth, gravity (m/s^2, negative = falls) and buoyancy (m/s^2 up). */
const KINDS = {
  smoke: { color: 0x3b3b3b, add: false, s0: 1.1, s1: 6.5, life: 2.8, op: 0.55, g: 0, up: 1.6 },
  ash:   { color: 0x17171a, add: false, s0: 1.6, s1: 9, life: 3.6, op: 0.7, g: 0, up: 2.4 },
  fire:  { color: 0xff8a2a, add: true, s0: 1.8, s1: 0.7, life: 0.5, op: 1, g: 0, up: 3 },
  spark: { color: 0xffd27a, add: true, s0: 0.3, s1: 0.1, life: 0.35, op: 1, g: -9, up: 0 },
  leaf:  { color: 0x5a9a3c, add: false, s0: 0.55, s1: 0.35, life: 1.3, op: 1, g: -6, up: 0 },
  dust:  { color: 0x9c8d74, add: false, s0: 1.5, s1: 7, life: 1.8, op: 0.5, g: 0, up: 0.8 },
  spray: { color: 0xdff2fb, add: false, s0: 1.2, s1: 5, life: 1.4, op: 0.6, g: -2, up: 0 },
};
const POOL = 110;

/** Pooled sprite particles. engine.fx.emit(kind, pos, vel) for one, engine.fx.burst(kind, pos, n, speed, vel) for a puff. Oldest particle is recycled when the pool is full. */
export class Effects {
  constructor() { this.live = []; this.free = []; this.tex = null; }
  init(e) {
    this.e = e; this.tex = this.makeTexture();
    for (let i = 0; i < POOL; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false, fog: true }), sp = new THREE.Sprite(mat); sp.visible = false; sp.renderOrder = 5; e.scene.add(sp); this.free.push({ sp, mat, v: new THREE.Vector3(), t: 0, k: null });
    }
    e.bus.on('aircraft:spawn', () => this.clear());
  }
  makeTexture() { // soft round puff; harmless fallback to a plain square if there is no 2D canvas (headless tests)
    try {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 2, 32, 32, 31);
      r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.45, 'rgba(255,255,255,0.55)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    } catch { return null; }
  }
  emit(kind, pos, vel = null) {
    const k = KINDS[kind]; if (!k) return; const p = this.free.pop() || this.live.shift(); if (!p) return;
    p.k = k; p.t = 0; p.sp.position.copy(pos); p.v.set(0, 0, 0); if (vel) p.v.copy(vel);
    p.mat.color.setHex(k.color); p.mat.blending = k.add ? THREE.AdditiveBlending : THREE.NormalBlending; p.mat.opacity = k.op; p.mat.needsUpdate = true; p.sp.scale.setScalar(k.s0); p.sp.visible = true; this.live.push(p);
  }
  burst(kind, pos, n, speed = 4, vel = null) {
    const v = new THREE.Vector3(), k = KINDS[kind]; if (!k) return;
    for (let i = 0; i < n; i++) { v.set((Math.random() - 0.5) * speed, Math.random() * speed * 0.7, (Math.random() - 0.5) * speed); if (vel) v.add(vel); this.emit(kind, pos, v); }
  }
  clear() { for (const p of this.live) { p.sp.visible = false; this.free.push(p); } this.live.length = 0; }
  update(dt) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const p = this.live[i], k = p.k; p.t += dt; const u = p.t / k.life;
      if (u >= 1) { p.sp.visible = false; this.free.push(p); this.live.splice(i, 1); continue; }
      p.v.y += (k.g + k.up) * dt; p.v.multiplyScalar(1 - Math.min(1, 0.6 * dt)); p.sp.position.addScaledVector(p.v, dt);
      p.sp.scale.setScalar(k.s0 + (k.s1 - k.s0) * u); p.mat.opacity = k.op * (1 - u) * (k.add ? 1 : Math.min(1, u * 8 + 0.3));
    }
  }
}
