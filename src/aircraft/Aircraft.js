import * as THREE from 'three';
const approach = (v, t, s) => v < t ? Math.min(t, v + s) : Math.max(t, v - s);
/** Free every GPU resource under `obj` (geometries, materials, their textures). Safe for shared objects: three.js re-uploads anything still in use. */
export function disposeTree(obj) {
  obj.traverse(o => {
    o.geometry?.dispose?.();
    for (const m of [].concat(o.material || [])) { if (!m) continue; for (const v of Object.values(m)) if (v?.isTexture) v.dispose(); m.dispose?.(); }
    o.dispose?.(); // InstancedMesh buffers
  });
}

/** One aircraft instance: physical state + control state + mesh. Physics lives in the FlightModel. */
export class Aircraft {
  constructor(def, livery = 0) {
    this.def = def; this.livery = livery; this.bus = null;
    this.pos = new THREE.Vector3(); this.quat = new THREE.Quaternion(); this.vel = new THREE.Vector3(); this.angVel = new THREE.Vector3();
    this.controls = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0, flapIndex: 0, flapAuto: true, gearDown: true, spoiler: 0, reverse: false, lights: false, rampOpen: false, autobrake: false };
    this.mass = def.flight.mass; this.eff = { pitch: 1, roll: 1, yaw: 1 }; this.rollBias = 0; this.liftScale = 1; this.jatoLeft = 0; this.rampPos = 0;
    this.destroyed = false; this.gearDamaged = false;
    // damage model (see DamageSystem): 1 = intact, 0 = gone. thrustScale / dragExtra / liftScale / rollBias / eff.* are derived from these.
    this.dmg = { engine: 1, wingL: 1, wingR: 1, tail: 1, gear: 1, body: 1 }; this.thrustScale = 1; this.dragExtra = 0; this.kick = 0; this.airTime = 0; this.lostAileron = 0; this.bay = []; this.flapPos = 0; this.flapTimer = 0; this.flapReason = ''; this.gearPos = 1; this.onGround = true; this.bump = 0; this.surface = null; this.telemetry = { airspeed: 0, aoa: 0, cl: 0 };
    this.mesh = def.buildMesh(def.liveries[livery]);
    this.bounds = new THREE.Box3().setFromObject(this.mesh); // body frame, measured before the mesh is moved: CollisionSystem derives its probes from it
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
    P.gear.forEach(g => { const r = g.userData.retract; if (r) { g.rotation[r.axis] = r.angle * (1 - this.gearPos); g.visible = true; } else g.scale.y = Math.max(0.001, this.gearPos); });
    const spin = (8 + c.throttle * 60) * dt; P.props.forEach(p => p.rotation.z += spin);
    P.propBlur.forEach(b => { b.material.opacity = Math.min(0.28, Math.max(0, c.throttle - 0.12) * 0.55 + 0.02 * (c.throttle > 0.02)); });
    if (P.ramp) { this.rampPos = approach(this.rampPos, c.rampOpen ? 1 : 0, dt / 3); const A = P.rampAngles; P.ramp.rotation.x = A.closed + (A.open - A.closed) * this.rampPos; }
    for (const d of P.doors) d.pos = approach(d.pos, d.target ?? 0, dt / 1.1), d.pivot.rotation.y = d.openAngle * d.pos;
    P.strobes.forEach(s => s.visible = c.lights && (time * 1.5) % 1 < 0.12);
    if (P.shell && this._shellIn !== !!viewing) { this._shellIn = !!viewing; for (const m of P.shell) { const u = m.userData; u.orig ??= { env: m.envMapIntensity, rough: m.roughness, emi: m.emissive?.clone(), ei: m.emissiveIntensity }; // seen from inside, glossy paint just mirrors the sky back (the cabin looked like open air): go matte and warm
      m.side = viewing ? THREE.DoubleSide : THREE.FrontSide; m.envMapIntensity = viewing ? 0.05 : u.orig.env; m.roughness = viewing ? 0.95 : u.orig.rough; if (m.emissive) { if (viewing) { m.emissive.set(0x4a463e); m.emissiveIntensity = 0.55; } else { m.emissive.copy(u.orig.emi); m.emissiveIntensity = u.orig.ei; } } m.needsUpdate = true; } }
    this.windshieldCut(P, viewing, e);
    if (P.glass?.length) { const g = viewing ? 0.07 : (this.def.model?.glassOpacity ?? 0.32); for (const m of P.glass) m.opacity = viewing ? g : m.opacity + (g - m.opacity) * Math.min(1, dt * 6); } // glass nearly vanishes from the inside, returns when seen from outside
    this.syncMesh();
    this.mesh.userData.cockpit?.update(this, e, dt, viewing);
  }
  /** glTF hulls have no real windscreen opening (windows are decals on a solid skin). While the pilot is seated looking out, clip a box out of the hull ahead of the eye so the view is open but the roof, nose and side frames stay. */
  windshieldCut(P, viewing, e) {
    const V = this.def.cockpit?.view; const want = !!(V && P.shell?.length && viewing && e?.walk?.mode === 'aircraft');
    if (want !== !!this._cut) {
      this._cut = want; if (want) { e.renderer.localClippingEnabled = true; this._planes = Array.from({ length: 6 }, () => new THREE.Plane()); }
      for (const m of P.shell) { m.clippingPlanes = want ? this._planes : null; m.clipIntersection = true; m.needsUpdate = true; }
    }
    if (!want) return;
    const ey = this.def.cockpit.eyes.pilot, B = { x0: -V.ww, x1: V.ww, y0: ey.y - V.drop + 0.05, y1: ey.y + V.top, z0: this.def.cockpit.panel.z - 3, z1: ey.z - V.back };
    const n = [[1, 0, 0, -B.x1], [-1, 0, 0, B.x0], [0, 1, 0, -B.y1], [0, -1, 0, B.y0], [0, 0, 1, -B.z1], [0, 0, -1, B.z0]]; this.mesh.updateMatrixWorld(true);
    n.forEach((v, i) => { this._planes[i].set(new THREE.Vector3(v[0], v[1], v[2]), v[3]).applyMatrix4(this.mesh.matrixWorld); });
  }
  door(id) { return this.mesh.userData.parts.doors.find(d => d.id === id); }
  /** Remove from the scene and free GPU memory. Also cancels a pending glTF skin for this aircraft. */
  dispose() { this.dead = true; this.mesh.removeFromParent(); disposeTree(this.mesh); }
}
