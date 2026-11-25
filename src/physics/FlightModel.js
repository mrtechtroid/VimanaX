import * as THREE from 'three';
import { SURFACES } from '../world/Surfaces.js';
const G = 9.81, { clamp } = THREE.MathUtils;
const _n = new THREE.Vector3(), _v = new THREE.Vector3(), _f = new THREE.Vector3(), _fw = new THREE.Vector3(), _rt = new THREE.Vector3(), _l = new THREE.Vector3(), _vh = new THREE.Vector3();
const _q = new THREE.Quaternion(), _dq = new THREE.Quaternion(), _e = new THREE.Euler(0, 0, 0, 'YXZ'), _axis = new THREE.Vector3();

/** IFlightModel: point-mass + body-rate model with aero (lift/drag/stall), control surfaces, gear/ground contact. */
export class FlightModel {
  step(ac, dt, env, world) {
    if (ac.destroyed) return;
    const f = ac.def.flight, c = ac.controls, q = ac.quat, w = ac.angVel;
    // ISA density (troposphere + lower stratosphere): sea level is identical to the old model, but high-altitude TAS/lift are honest.
    const alt = Math.max(ac.pos.y, -100), T = alt < 11000 ? 288.15 - 0.0065 * alt : 216.65;
    const rho = 1.225 * Math.pow(T / 288.15, 4.256) * (alt < 11000 ? 1 : Math.exp(-(alt - 11000) / 6341));
    // Engine spool-up: thrust follows rpm, not the lever instantly. Turbines take seconds to spool, pistons a fraction of one.
    const target = c.throttle * (ac.dmg.engine <= 0 ? 0 : 1), tau = target > ac.rpm ? f.spoolUp : f.spoolDown;
    ac.rpm += (target - ac.rpm) * (1 - Math.exp(-dt / Math.max(0.05, tau || 0.8)));
    _q.copy(q).invert();
    // Wind is sampled once per rendered frame by AircraftManager (ac.wind / ac.windRot); fall back for headless callers.
    const wind = ac.wind ?? (env.windAt ? env.windAt(ac.pos, ac) : env.windVector());
    const vb = _v.copy(ac.vel).sub(wind).applyQuaternion(_q); // air-relative velocity, body frame
    const V = vb.length(), moving = V > 2;
    const aoa = moving ? Math.atan2(-vb.y, -vb.z) : 0;
    const beta = moving ? Math.asin(clamp(vb.x / V, -1, 1)) : 0;
    const dyn = 0.5 * rho * V * V, S = f.wingArea, eff = clamp((V / f.vRef) ** 2, 0, 1.5), effS = Math.min(eff, 1);
    // Ground effect: within about a wingspan of the surface the wing is more efficient and induced drag drops. This is what makes an aircraft "float" during the flare.
    const agl = ac.pos.y - world.groundHeight(ac.pos.x, ac.pos.z) - f.gearHeight;
    const ge = Math.exp(-Math.max(0, agl) / (f.groundSpan || 1.7 * Math.sqrt(S)));
    // Stall: CL peaks at the critical angle then falls away sharply, with separation drag, a nose-down break and a wing drop.
    const st = f.aoaStall, over = Math.max(0, Math.abs(aoa) - st), post = 1 - clamp(over / 0.18, 0, 1) * 0.55;
    ac.stalled = over > 0.02;
    const cl = (f.CL0 + f.CLa * clamp(aoa, -st, st) + f.flapCL * ac.flapPos) * post * (1 - 0.4 * c.spoiler) * ac.liftScale * (1 + (f.groundEffect ?? 0.14) * ge);
    const cd = f.CD0 + f.k * cl * cl * (1 - 0.35 * ge) + ac.gearPos * f.gearCD + ac.flapPos * f.flapCD + c.spoiler * f.spoilerCD + beta * beta * (f.sideDrag ?? 1.1) + (1 - post) * 1.2 + ac.dragExtra;
    let thrust = ac.rpm * f.maxThrust * ac.thrustScale * Math.max(0.15, 1 - V / f.thrustFalloff);
    let booster = 0; if (ac.jatoLeft > 0) { booster = f.jato.thrust; ac.jatoLeft -= dt; }
    if (c.reverse && ac.onGround) thrust *= -f.reverseFactor; // reverse acts on the engines, never on the JATO booster
    thrust += booster;

    // Lift acts perpendicular to the relative wind (not along body-up), otherwise it leaks backwards as phantom drag at high AoA.
    _l.set(0, 1, 0);
    if (moving) { _vh.copy(vb).divideScalar(V); _l.addScaledVector(_vh, -_vh.y); if (_l.lengthSq() > 1e-6) _l.normalize(); else _l.set(0, 1, 0); }
    _f.set(-beta * dyn * S * 0.8, 0, -thrust).addScaledVector(_l, dyn * S * cl);
    if (moving) _f.addScaledVector(vb, -dyn * S * cd / V);
    _f.applyQuaternion(q); _f.y -= ac.mass * G;

    const d = f.damp; // body rates: x pitch(+nose up), y yaw(+nose left), z roll(+right wing up)
    w.x += (f.pitchPower * ac.eff.pitch * c.pitch * eff - f.pitchStab * (aoa - f.trimAoa) * effS - d.x * w.x) * dt;
    w.y += (-f.yawPower * ac.eff.yaw * c.yaw * eff - f.yawStab * beta * effS - d.y * w.y) * dt;
    w.z += (-f.rollPower * ac.eff.roll * c.roll * eff + ac.rollBias + (f.dihedral ?? 0.45) * beta * effS - d.z * w.z) * dt; // dihedral couples sideslip into roll (Dutch roll)
    // A propeller at high power / low speed pulls the nose left (P-factor) and rolls opposite its torque.
    const prop = f.propTorque ? c.throttle * (1 - Math.min(1, V / Math.max(10, f.vRef))) : 0;
    if (prop && !ac.onGround) { w.y += (f.pFactor ?? 0) * prop * (0.5 + 0.5 * Math.max(0, aoa) / st) * dt; w.z += f.propTorque * prop * dt; }
    if (ac.stalled && !ac.onGround) { // break: nose drops, the weaker wing drops first, and the airframe shudders (buffet telemetry)
      w.x -= (f.stallPitch ?? 1.8) * (1 - post) * Math.sign(aoa || 1) * effS * dt;
      w.z += (f.stallRoll ?? 0.9) * (1 - post) * ((ac.dmg.wingR - ac.dmg.wingL) * 0.8 + Math.sin(ac.airTime * 2.3) * 0.25) * effS * dt;
    }
    const rot = ac.windRot ?? env.rot; // per-aircraft turbulence kicks (shared env.rot is only a fallback)
    if (rot && !ac.onGround) { const k = effS * dt; w.x += rot.x * k; w.y += rot.y * k; w.z += rot.z * k; }
    ac.vel.addScaledVector(_f, dt / ac.mass);
    const wl = w.length();
    if (wl > 1e-6) { _dq.setFromAxisAngle(_axis.copy(w).divideScalar(wl), wl * dt); q.multiply(_dq); } // own scratch: _v may still hold vb
    q.normalize(); ac.pos.addScaledVector(ac.vel, dt);

    const was = ac.onGround; ac.onGround = false;
    const gy = world.groundHeight(ac.pos.x, ac.pos.z) + f.gearHeight;
    if (ac.pos.y <= gy + 0.05) {
      ac.onGround = true;
      if (ac.pos.y < gy) {
        if (!was) { // first contact: impact speed along the terrain normal (covers hillsides). Wing / nose / tail strikes are CollisionSystem's job (airframe probes)
          const d = 20, x = ac.pos.x, z = ac.pos.z;
          _n.set((world.groundHeight(x - d, z) - world.groundHeight(x + d, z)) / (2 * d), 1, (world.groundHeight(x, z - d) - world.groundHeight(x, z + d)) / (2 * d)).normalize();
          const hit = -ac.vel.dot(_n);
          if (ac.airTime > 2.5) ac.bus?.emit('aircraft:touchdown', { ac, sink: Math.max(0, hit), speed: V }); // a real landing, not a bounce or a hop
          ac.airTime = 0;
          if (hit > f.crashSink) ac.bus?.emit('aircraft:impact', { ac, speed: hit, part: 'gear', kind: 'ground' });
        }
        ac.pos.y = gy; if (ac.vel.y < 0) ac.vel.y = 0;
      }
      _fw.set(0, 0, -1).applyQuaternion(q); _fw.y = 0; _fw.normalize(); _rt.set(-_fw.z, 0, _fw.x);
      const vF = ac.vel.dot(_fw), vL = ac.vel.dot(_rt);
      // Surface lookup is the priciest per-substep world call: reuse it for 0.25 s or until the aircraft has moved 3 m.
      let sf0 = ac._sfRaw; ac._sfT = (ac._sfT || 0) - dt;
      if (!sf0 || ac._sfT <= 0 || !ac._sfPos || (ac.pos.x - ac._sfPos.x) ** 2 + (ac.pos.z - ac._sfPos.z) ** 2 > 9) {
        sf0 = world.surfaceAt ? world.surfaceAt(ac.pos.x, ac.pos.z) : SURFACES.asphalt;
        ac._sfRaw = sf0; ac._sfT = 0.25; (ac._sfPos ??= new THREE.Vector3()).copy(ac.pos);
      }
      const sf = f.floats && sf0.id === 'water' ? SURFACES.floatWater : sf0, wheels = f.floats ? sf0.id === 'water' : ac.gearPos > 0.9; // floatplanes: pontoons plane on water, slide (belly) on land
      ac.surface = sf.id; ac.bump = sf.bump * Math.min(1, Math.abs(vF) / 20) * Math.sin(ac.pos.x * 3.1 + ac.pos.z * 2.3) * Math.sin(ac.pos.z * 5.7 - ac.pos.x * 1.9) * 0.05;
      ac.vel.addScaledVector(_rt, -vL * Math.min(1, dt * 10 * sf.grip));
      const dec = wheels ? f.rollMu * sf.roll * G + c.brake * f.brakeDecel * sf.brake : 0.5 * G * (sf.id === 'asphalt' ? 1 : 1.3); // belly slide if gear up
      ac.vel.addScaledVector(_fw, -Math.sign(vF) * Math.min(Math.abs(vF), dec * dt));
      // Nosewheel steering authority falls off with speed, like a real nosewheel; a crosswind weathervanes the nose into the wind.
      w.y = (-c.yaw * f.steerRate * clamp(vF / 6, -1, 1) * (0.5 + 0.5 * sf.grip) / (1 + 0.006 * vF * vF) - f.yawStab * beta * 0.25 * sf.grip) * dt * 8;
      _e.setFromQuaternion(q);
      _e.z *= 1 - Math.min(1, dt * 6);
      _e.x = clamp(_e.x, 0, f.maxGroundPitch);
      if (eff < 0.5) _e.x *= 1 - Math.min(1, dt * 2) * (1 - eff * 2);
      q.setFromEuler(_e);
      if (_e.x <= 0 && w.x < 0) w.x = 0; w.z = 0;
    }
    if (!ac.onGround) { ac.bump = 0; ac.surface = null; ac.airTime += dt; }
    ac.telemetry.airspeed = V; ac.telemetry.aoa = aoa; ac.telemetry.cl = cl; ac.telemetry.ge = ge;
    ac.telemetry.beta = beta; ac.telemetry.rpm = ac.rpm;
    ac.telemetry.buffet = moving && !ac.onGround ? clamp((Math.abs(aoa) - st * 0.85) / 0.22, 0, 1) : 0; // airframe shake approaching the stall, fed to the camera
  }
}
