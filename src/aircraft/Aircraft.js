import * as THREE from 'three';
const approach = (v, t, s) => v < t ? Math.min(t, v + s) : Math.max(t, v - s);

/** One aircraft instance: physical state + control state + mesh. Physics lives in the FlightModel. */
export class Aircraft {
  constructor(def, livery = 0) {
    this.def = def; this.livery = livery; this.bus = null;
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.vel = new THREE.Vector3(); this.angVel = new THREE.Vector3();
    this.controls = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0, flapIndex: 0, gearDown: true, spoiler: 0, reverse: false, lights: false };
    this.flapPos = 0; this.gearPos = 1; this.onGround = true; this.telemetry = { airspeed: 0, aoa: 0, cl: 0 };
    this.mesh = def.buildMesh(def.liveries[livery]);
  }
  place(x, y, z, heading) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading); this.syncMesh();
  }
  syncMesh() { this.mesh.position.copy(this.pos); this.mesh.quaternion.copy(this.quat); }
  /** Visual/animated state: gear, flaps, surfaces, props, strobes. */
  animate(dt, time) {
    const P = this.mesh.userData.parts, c = this.controls;
    this.gearPos = approach(this.gearPos, c.gearDown ? 1 : 0, dt / 4);
    this.flapPos = approach(this.flapPos, this.def.flaps[c.flapIndex], dt / 3);
    P.aileronL.rotation.x = c.roll * 0.5; P.aileronR.rotation.x = -c.roll * 0.5;
    P.elevator.rotation.x = -c.pitch * 0.5; P.rudder.rotation.y = -c.yaw * 0.5;
    P.flaps.forEach(m => m.rotation.x = this.flapPos * 0.7);
    P.gear.forEach(g => g.scale.y = Math.max(0.001, this.gearPos));
    P.props.forEach(p => p.rotation.z += (8 + c.throttle * 60) * dt);
    P.strobes.forEach(s => s.visible = c.lights && (time * 1.5) % 1 < 0.12);
    this.syncMesh();
  }
}
