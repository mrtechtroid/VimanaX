import * as THREE from 'three';
const _v = new THREE.Vector3();
/** Camera modes: chase, cockpit (first person at def.camera.eye), tower. Add a mode by extending `modes`. */
export class CameraManager {
  constructor() { this.modes = ['chase', 'cockpit', 'tower']; this.i = 0; }
  init(e) {
    this.e = e;
    e.bus.on('action', a => { if (a === 'camera') { this.i = (this.i + 1) % this.modes.length; e.bus.emit('hud:message', `Camera: ${this.modes[this.i]}`); } });
  }
  update(dt) {
    const a = this.e.aircraft.player; if (!a) return;
    const cam = this.e.camera, m = this.modes[this.i], c = a.def.camera, k = 1 - Math.exp(-dt * 8);
    a.mesh.visible = m !== 'cockpit';
    if (m === 'cockpit') { cam.position.copy(_v.set(c.eye.x, c.eye.y, c.eye.z).applyQuaternion(a.quat).add(a.pos)); cam.quaternion.copy(a.quat); return; }
    if (m === 'chase') cam.position.lerp(_v.set(0, c.chaseHeight, c.chaseDist).applyQuaternion(a.quat).add(a.pos), k);
    else { const sp = this.e.world.spawnPoint(a.airport); cam.position.set(sp.pos.x + 80, sp.pos.y + 15, sp.pos.z - 300); }
    cam.position.y = Math.max(cam.position.y, this.e.world.groundHeight(cam.position.x, cam.position.z) + 3);
    cam.up.set(0, 1, 0); cam.lookAt(a.pos);
  }
}
