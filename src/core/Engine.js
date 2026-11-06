import * as THREE from 'three';
import { EventBus } from './EventBus.js';

/** Owns renderer, scene, camera, loop and the ordered module list. Modules become engine[name]. */
export class Engine {
  constructor(canvas) {
    this.bus = new EventBus();
    this.modules = [];
    this.time = 0; this.paused = false; // paused: only modules with `alwaysUpdate` run (camera, UI)
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 40000);
    addEventListener('resize', () => this.resize());
    this.resize();
  }
  use(name, mod) { this[name] = mod; this.modules.push(mod); mod.init?.(this); return this; }
  resize() {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
  }
  start() {
    let last = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!this.paused) this.time += dt;
      for (const m of this.modules) if (!this.paused || m.alwaysUpdate) m.update?.(dt, this);
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
