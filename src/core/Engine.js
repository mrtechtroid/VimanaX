import * as THREE from 'three';
import { EventBus } from './EventBus.js';

/** Owns renderer, scene, camera, loop and the ordered module list. Modules become engine[name]. */
export class Engine {
  constructor(canvas) {
    this.bus = new EventBus();
    this.modules = [];
    this.time = 0; this._paused = false; this.holds = new Set(); // paused: only modules with `alwaysUpdate` run (camera, UI)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 40000);
    // Adaptive resolution trade-off: drop internal pixels when frames run long, recover when there is headroom.
    this.baseRatio = 1; this.renderScale = 1; this.frameAvg = 16.7; this.scaleT = 0;
    addEventListener('resize', () => this.resize());
    this.resize();
  }
  /** `paused` is true while the menu pauses the sim OR any named hold (start screen, portrait phone, hidden tab) is active. Assigning still sets the menu's flag. */
  get paused() { return this._paused || this.holds.size > 0; }
  set paused(v) { this._paused = !!v; }
  /** Add or release a named pause reason. Independent of `paused = ...`, so the menu closing never un-pauses the start screen. */
  hold(reason, on = true) { const had = this.holds.size > 0; on ? this.holds.add(reason) : this.holds.delete(reason); if ((this.holds.size > 0) !== had) this.bus.emit('engine:hold', { reason, on, paused: this.paused }); }
  use(name, mod) { this[name] = mod; this.modules.push(mod); mod.init?.(this); return this; }
  applyRatio() { if (this.renderer.setPixelRatio) this.renderer.setPixelRatio(this.baseRatio * this.renderScale); }
  resize() {
    // On phones a 3x devicePixelRatio is far too many pixels for software-lit terrain: cap at 2, and at 1.5 on very large canvases (4K).
    const big = innerWidth * innerHeight > 2200000;
    this.baseRatio = Math.min(devicePixelRatio || 1, big ? 1.5 : 2); this.applyRatio();
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }
  /** Adjust internal resolution from a rolling frame time (no effect when disabled or in headless stubs). */
  adapt(dt) {
    if (!(dt > 0) || this.settings?.get?.('adaptiveRes') === false || !this.renderer.setPixelRatio) return;
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    if ((this.scaleT += dt) < 1.5) return;
    this.scaleT = 0; let s = this.renderScale;
    if (this.frameAvg > 26 && s > 0.7) s = Math.max(0.7, s - 0.1);
    else if (this.frameAvg < 16 && s < 1) s = Math.min(1, s + 0.05);
    if (s !== this.renderScale) { this.renderScale = s; this.applyRatio(); }
  }
  start() {
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; if (!this.paused) this.time += dt;
      this.adapt(dt);
      for (const m of this.modules) if (!this.paused || m.alwaysUpdate) m.update?.(dt, this);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
