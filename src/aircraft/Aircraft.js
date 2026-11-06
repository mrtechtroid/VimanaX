import * as THREE from 'three';
const approach = (v, t, s) => v < t ? Math.min(t, v + s) : Math.max(t, v - s);

/** One aircraft instance: physical state + control state + mesh. Physics lives in the FlightModel. */
export class Aircraft {
  constructor(def, livery = 0) {
    this.def = def; this.livery = livery; this.bus = null;
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.vel = new THREE.Vector3(); this.angVel = new THREE.Vector3();
    this.controls = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0, flapIndex: 0, flapAuto: true, gearDown: true, spoiler: 0, reverse: false, lights: false, rampOpen: false, autobrake: false };
    this.mass = def.flight.mass; this.eff = { pitch: 1, roll: 1, yaw: 1 }; this.rollBias = 0; this.liftScale = 1; this.jatoLeft = 0; this.rampPos = 0;
    this.destroyed = false; this.gearDamaged = false; this.bay = []; this.flapPos = 0; this.flapTimer = 0; this.flapReason = ''; this.gearPos = 1; this.onGround = true; this.bump = 0; this.surface = null; this.telemetry = { airspeed: 0, aoa: 0, cl: 0 };
    this.mesh = def.buildMesh(def.liveries[livery]);
  }
  place(x, y, z, heading) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.angVel.set(0, 0, 0);
    this.quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -heading); this.syncMesh();
  }
  syncMesh() { this.mesh.position.copy(this.pos); this.mesh.position.y += this.bump; this.mesh.quaternion.copy(this.quat); }
  /** Visual/animated state: gear, flaps, surfaces, doors, props, strobes, cockpit. `e` (engine) is optional (headless tests). */
  animate(dt, time, e = null, viewing = false) {
    const P = this.mesh.userData.parts, c = this.controls;
    this.gearPos = approach(this.gearPos, c.gearDown ? 1 : 0, dt / 4);
    this.flapPos = approach(this.flapPos, this.def.flaps[c.flapIndex], dt / 3);
    P.aileronL.rotation.x = c.roll * 0.5; P.aileronR.rotation.x = -c.roll * 0.5;
    (P.elevators.length ? P.elevators : [P.elevator]).forEach(m => m.rotation.x = -c.pitch * 0.5); P.rudder.rotation.y = c.yaw * 0.5;
    P.flaps.forEach(m => m.rotation.x = this.flapPos * 0.7);
    P.gear.forEach(g => { const r = g.userData.retract; if (r) { g.rotation[r.axis] = r.angle * (1 - this.gearPos); g.visible = this.gearPos > 0.03 || true; } else g.scale.y = Math.max(0.001, this.gearPos); });
    const spin = (8 + c.throttle * 60) * dt; P.props.forEach(p => p.rotation.z += spin);
    P.propBlur.forEach(b => { b.material.opacity = Math.min(0.28, Math.max(0, c.throttle - 0.12) * 0.55 + 0.02 * (c.throttle > 0.02)); });
    if (P.ramp) { this.rampPos = approach(this.rampPos, c.rampOpen ? 1 : 0, dt / 3); const A = P.rampAngles; P.ramp.rotation.x = A.closed + (A.open - A.closed) * this.rampPos; }
    for (const d of P.doors) d.pos = approach(d.pos, d.target ?? 0, dt / 1.1), d.pivot.rotation.y = d.openAngle * d.pos;
    P.strobes.forEach(s => s.visible = c.lights && (time * 1.5) % 1 < 0.12);
    this.syncMesh();
    this.mesh.userData.cockpit?.update(this, e, dt, viewing);
  }
  door(id) { return this.mesh.userData.parts.doors.find(d => d.id === id); }
}
