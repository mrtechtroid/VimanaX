import * as THREE from 'three';
import { disposeTree } from '../aircraft/Aircraft.js';
const R = () => Math.random() - 0.5;

/** Reacts to 'aircraft:impact' {ac,speed}: gear damage -> aileron loss -> wing/tail separation -> total destruction. Debris is simulated here. */
export class DamageSystem {
  constructor() { this.debris = []; }
  init(e) {
    this.e = e; e.bus.on('aircraft:impact', ({ ac, speed }) => this.hit(ac, speed));
    e.bus.on('action', a => { if (['reset', 'nextAircraft', 'nextLivery'].includes(a)) this.clear(); });
  }
  /** Drop all debris and free its GPU memory (every debris object is single-use). */
  clear() { for (const d of this.debris) { this.e.scene.remove(d.o); disposeTree(d.o); } this.debris = []; }
  add(o, v, w) { this.debris.push({ o, v, w }); }
  shed(ac, obj) {
    if (!obj?.parent) return; this.e.scene.attach(obj);
    this.add(obj, ac.vel.clone().multiplyScalar(0.6).add(new THREE.Vector3(R() * 6, 2 + Math.random() * 5, R() * 6)), new THREE.Vector3(R(), R(), R()).multiplyScalar(5));
  }
  hit(ac, speed) {
    if (ac.destroyed) return; const r = speed / ac.def.flight.crashSink, P = ac.mesh.userData.parts, say = m => this.e.bus.emit('hud:message', m);
    if (r < 1.6) { ac.gearDamaged = true; ac.controls.gearDown = false; say('Hard landing - landing gear damaged'); }
    else if (r < 2.4) { this.shed(ac, Math.random() < 0.5 ? P.aileronL : P.aileronR); ac.eff.roll = 0.5; say('Wingtip damage - aileron lost'); }
    else if (r < 3.6) {
      if (Math.random() < 0.5) { const i = Math.random() < 0.5 ? 0 : 1; this.shed(ac, P.wings[i]); ac.liftScale = 0.5; ac.rollBias = (i ? -1 : 1) * 1.5; ac.eff.roll = 0.3; say('Wing separated!'); }
      else { this.shed(ac, P.tail); ac.eff.pitch = 0; ac.eff.yaw = 0; say('Tail separated!'); }
    } else this.destroy(ac);
  }
  destroy(ac) {
    ac.destroyed = true; ac.mesh.visible = false; ac.vel.set(0, 0, 0); const s = ac.def.flight.gearHeight;
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * (0.3 + Math.random()), s * (0.2 + Math.random() * 0.5), s * (0.3 + Math.random())), new THREE.MeshLambertMaterial({ color: i % 3 ? 0x333333 : ac.def.liveries[ac.livery].body }));
      m.position.copy(ac.pos).add(new THREE.Vector3(R() * s * 4, R() * s, R() * s * 4)); this.e.scene.add(m);
      this.add(m, new THREE.Vector3(R() * 14, 3 + Math.random() * 8, R() * 14), new THREE.Vector3(R(), R(), R()).multiplyScalar(8));
    }
    this.e.bus.emit('hud:message', 'AIRCRAFT DESTROYED - press Backspace to reset');
  }
  update(dt) {
    for (const d of this.debris) {
      if (d.rest) continue; d.v.y -= 9.81 * dt; d.o.position.addScaledVector(d.v, dt);
      d.o.rotation.x += d.w.x * dt; d.o.rotation.y += d.w.y * dt; d.o.rotation.z += d.w.z * dt;
      const gy = this.e.world.groundHeight(d.o.position.x, d.o.position.z);
      if (d.o.position.y < gy) { d.o.position.y = gy; d.v.set(d.v.x * 0.6, 0, d.v.z * 0.6); d.w.multiplyScalar(0.5); if (d.v.lengthSq() < 1) d.rest = true; }
    }
  }
}
