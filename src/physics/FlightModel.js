import * as THREE from 'three';
const G = 9.81, { clamp } = THREE.MathUtils;
const _n = new THREE.Vector3(), _v = new THREE.Vector3(), _f = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _l = new THREE.Vector3(), _vh = new THREE.Vector3();
const _q = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ');

/** IFlightModel: point-mass + body-rate model with aero (lift/drag/stall), control surfaces, gear/ground contact. */
export class FlightModel {
  step(ac, dt, env, world) {
    if (ac.destroyed) return;
    const f = ac.def.flight, c = ac.controls, q = ac.quat, w = ac.angVel;
    const rho = 1.225 * Math.exp(-Math.max(ac.pos.y, 0) / 8500);
    _q.copy(q).invert();
    const vb = _v.copy(ac.vel).sub(env.windVector()).applyQuaternion(_q); // air-relative velocity, body frame
    const V = vb.length(), moving = V > 2;
    const aoa = moving ? Math.atan2(-vb.y, -vb.z) : 0;
    const beta = moving ? Math.asin(clamp(vb.x / V, -1, 1)) : 0;
    const dyn = 0.5 * rho * V * V, S = f.wingArea, eff = clamp((V / f.vRef) ** 2, 0, 1.5), effS = Math.min(eff, 1);
    const st = f.aoaStall, post = 1 - clamp((Math.abs(aoa) - st) / 0.2, 0, 1) * 0.6;
    const cl = (f.CL0 + f.CLa * clamp(aoa, -st, st) + f.flapCL * ac.flapPos) * post * (1 - 0.4 * c.spoiler) * ac.liftScale;
    const cd = f.CD0 + f.k * cl * cl + ac.gearPos * f.gearCD + ac.flapPos * f.flapCD + c.spoiler * f.spoilerCD + (1 - post) * 0.8;
    let thrust = c.throttle * f.maxThrust * Math.max(0.15, 1 - V / f.thrustFalloff);
    if (ac.jatoLeft > 0) { thrust += f.jato.thrust; ac.jatoLeft -= dt; }
    if (c.reverse && ac.onGround) thrust *= -f.reverseFactor;

    // Lift acts perpendicular to the relative wind (not along body-up), otherwise it leaks backwards as phantom drag at high AoA.
    _l.set(0, 1, 0);
    if (moving) { _vh.copy(vb).divideScalar(V); _l.addScaledVector(_vh, -_vh.y); if (_l.lengthSq() > 1e-6) _l.normalize(); else _l.set(0, 1, 0); }
    _f.set(-beta * dyn * S * 0.8, 0, -thrust).addScaledVector(_l, dyn * S * cl);
    if (moving) _f.addScaledVector(vb, -dyn * S * cd / V);
    _f.applyQuaternion(q); _f.y -= ac.mass * G;

    const d = f.damp; // body rates: x pitch(+nose up), y yaw(+nose left), z roll(+right wing up)
    w.x += (f.pitchPower * ac.eff.pitch * c.pitch * eff - f.pitchStab * (aoa - f.trimAoa) * effS - d.x * w.x) * dt;
    w.y += (-f.yawPower * ac.eff.yaw * c.yaw * eff - f.yawStab * beta * effS - d.y * w.y) * dt;
    w.z += (-f.rollPower * ac.eff.roll * c.roll * eff + ac.rollBias - d.z * w.z) * dt;
    ac.vel.addScaledVector(_f, dt / ac.mass);
    const wl = w.length();
    if (wl > 1e-6) { _dq.setFromAxisAngle(_v.copy(w).divideScalar(wl), wl * dt); q.multiply(_dq); }
    q.normalize(); ac.pos.addScaledVector(ac.vel, dt);

    const was = ac.onGround; ac.onGround = false;
    const gy = world.groundHeight(ac.pos.x, ac.pos.z) + f.gearHeight;
    if (ac.pos.y <= gy + 0.05) {
      ac.onGround = true;
      _e.setFromQuaternion(q);
      if (ac.pos.y < gy) {
        if (!was) { // first contact: impact speed along terrain normal (covers hillsides), wing-strike if banked
          const d = 20, x = ac.pos.x, z = ac.pos.z;
          _n.set((world.groundHeight(x - d, z) - world.groundHeight(x + d, z)) / (2 * d), 1, (world.groundHeight(x, z - d) - world.groundHeight(x, z + d)) / (2 * d)).normalize();
          let hit = -ac.vel.dot(_n); if (Math.abs(_e.z) > 0.4 && V > 15) hit = Math.max(hit, f.crashSink * 2);
          if (hit > f.crashSink) ac.bus?.emit('aircraft:impact', { ac, speed: hit });
        }
        ac.pos.y = gy; if (ac.vel.y < 0) ac.vel.y = 0;
      }
      _fw.set(0, 0, -1).applyQuaternion(q); _fw.y = 0; _fw.normalize(); _rt.set(-_fw.z, 0, _fw.x);
      const vF = ac.vel.dot(_fw), vL = ac.vel.dot(_rt), wheels = ac.gearPos > 0.9;
      ac.vel.addScaledVector(_rt, -vL * Math.min(1, dt * 10));
      const dec = wheels ? f.rollMu * G + c.brake * f.brakeDecel : 0.5 * G; // belly slide if gear up
      ac.vel.addScaledVector(_fw, -Math.sign(vF) * Math.min(Math.abs(vF), dec * dt));
      w.y = -c.yaw * f.steerRate * clamp(vF / 6, -1, 1); // nosewheel steering
      _e.setFromQuaternion(q);
      _e.z *= 1 - Math.min(1, dt * 6);
      _e.x = clamp(_e.x, 0, f.maxGroundPitch);
      if (eff < 0.5) _e.x *= 1 - Math.min(1, dt * 2) * (1 - eff * 2);
      q.setFromEuler(_e);
      if (_e.x <= 0 && w.x < 0) w.x = 0; w.z = 0;
    }
    ac.telemetry.airspeed = V; ac.telemetry.aoa = aoa; ac.telemetry.cl = cl;
  }
}
