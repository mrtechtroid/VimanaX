import * as THREE from 'three';
import { CollisionWorld } from '../world/CollisionWorld.js';

const G = 9.81;
const _p = new THREE.Vector3(), _s = new THREE.Vector3(), _ps = new THREE.Vector3(), _nB = new THREE.Vector3(), _t = new THREE.Vector3();
const _qs = new THREE.Quaternion(), _iq = new THREE.Quaternion();
const _hit = { nx: 0, ny: 0, nz: 0, pen: 0, item: null };
const _dynHit = { nx: 0, ny: 0, nz: 0, pen: 0, body: null };
const _hit2 = { nx: 0, ny: 0, nz: 0, pen: 0, item: null };
const _resolved = { x: 0, z: 0 };
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0); // hides a knocked-down tree instance

/**
 * Probe points on the airframe, in the body frame (x right, y up, z back), derived from the mesh bounds measured at spawn.
 * `part` says which zone of the damage model a hit lands on. Gear probes sit half way up the legs: wheel-versus-ground
 * is the flight model's job, these only catch wheels hitting walls, trees and tanks.
 */
export function makeProbes(ac) {
  const b = ac.bounds, P = ac.mesh.userData.parts || {}, gh = ac.def.flight.gearHeight, V = (x, y, z) => new THREE.Vector3(x, y, z);
  const hx = Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), zN = b.min.z, zT = b.max.z, yT = b.max.y, w0 = P.wings?.[0], wy = w0 ? w0.position.y : 0, wz = w0 ? w0.position.z : 0;
  const L = [
    { part: 'nose', p: V(0, 0, zN) },
    { part: 'wingL', p: V(-hx, wy, wz) }, { part: 'wingL', p: V(-hx * 0.5, wy, wz) },
    { part: 'wingR', p: V(hx, wy, wz) }, { part: 'wingR', p: V(hx * 0.5, wy, wz) },
    { part: 'tail', p: V(0, yT * 0.55, zT * 0.95) }, { part: 'tail', p: V(0, yT * 0.95, zT * 0.8) },
    { part: 'body', p: V(0, yT * 0.6, 0) },
  ];
  for (const g of P.gear || []) L.push({ part: 'gear', p: V(g.position.x, -gh * 0.55, g.position.z) });
  return L;
}

/**
 * Airframe collisions with terrain, water and every solid in `world.colliders` (buildings, hangars, the tower, tanks, trees).
 * Each frame every probe is swept from where it was to where it is (so a fast probe cannot tunnel through a thin object),
 * the aircraft is pushed out, its velocity gets a bounce / friction response and a spin from the hit point, and an
 * `aircraft:impact` event ({ ac, speed, part, kind, point }) tells DamageSystem, audio and haptics what was hit and how hard.
 * Wheels against the ground stay in FlightModel; this system never runs for a parked aircraft.
 */
export class CollisionSystem {
  init(e) { this.e = e; this.dyn = new CollisionWorld(e.world?.colliders ?? null); }
  update(dt, e) {
    this.dyn.rebuild(e); // one authoritative dynamic-body list per frame (aircraft, vehicles, crates, walker)
    for (const ac of e.aircraft.list) if (!ac.destroyed) this.check(ac, dt, e);
  }

  check(ac, dt, e) {
    const cs = ac.cs ??= { probes: makeProbes(ac), prev: [], cool: {}, spark: 0, prevQ: ac.quat.clone(), prevPos: ac.pos.clone() };
    ac.kick *= Math.exp(-4 * dt);
    if (ac.onGround && ac.vel.lengthSq() < 0.05) { cs.prev.length = 0; cs.prevQ.copy(ac.quat); cs.prevPos.copy(ac.pos); return; } // parked
    for (const k in cs.cool) cs.cool[k] -= dt; cs.spark -= dt;
    for (let i = 0; i < cs.probes.length && !ac.destroyed; i++) {
      const pb = cs.probes[i];
      _p.copy(pb.p).applyQuaternion(ac.quat).add(ac.pos);
      const prev = cs.prev[i] ??= _p.clone(), dist = prev.distanceTo(_p);
      const n = Math.min(24, Math.max(1, Math.ceil(dist / 0.6))); // denser sweep: thin poles no longer tunnel at speed
      for (let k = 1; k <= n; k++) {
        const t = k / n;
        _qs.slerpQuaternions(cs.prevQ, ac.quat, t); _ps.lerpVectors(cs.prevPos, ac.pos, t);
        _s.copy(pb.p).applyQuaternion(_qs).add(_ps); // sweep the rotating airframe, not just a straight chord
        if (this.probe(ac, cs, pb, _s, dt, e)) break;
      }
      prev.copy(_p);
    }
    cs.prevQ.copy(ac.quat); cs.prevPos.copy(ac.pos);
  }

  /** Test one sample point of one probe. Returns true if it hit something (and the aircraft was moved). */
  probe(ac, cs, pb, s, dt, e) {
    const w = e.world, v = ac.vel, gh = w.groundHeight(s.x, s.z), agl = s.y - gh;
    if (pb.part !== 'gear' && agl < -0.1) { // terrain or water (wheels are FlightModel's)
      const water = w.heightAt(s.x, s.z) < w.waterLevelAt(s.x, s.z); let nx = 0, ny = 1, nz = 0;
      if (!water) { const d = 2; nx = w.groundHeight(s.x - d, s.z) - w.groundHeight(s.x + d, s.z); nz = w.groundHeight(s.x, s.z - d) - w.groundHeight(s.x, s.z + d); const il = 1 / Math.hypot(nx, 2 * d, nz); nx *= il; ny = 2 * d * il; nz *= il; }
      this.resolve(ac, cs, pb, s, nx, ny, nz, -agl, water ? 'water' : 'terrain', null, dt, e); return true;
    }
    const col = w.colliders; // buildings, hangars, tower, tanks, trees, windsocks, PAPI, docks
    if (col && col.count && col.testRadius(s.x, s.y, s.z, 0.35, v.x, v.y, v.z, _hit)) { this.resolve(ac, cs, pb, s, _hit.nx, _hit.ny, _hit.nz, _hit.pen, _hit.item.kind, _hit.item, dt, e); return true; }
    // Dynamic world: other aircraft, vehicles, crates and the walking pilot.
    if (this.dyn.test(s.x, s.y, s.z, 0.35, ac, _dynHit)) {
      const b = _dynHit.body, kind = b.type === 'walker' ? 'walker' : b.type;
      this.resolve(ac, cs, pb, s, _dynHit.nx, _dynHit.ny, _dynHit.nz, _dynHit.pen, kind, null, dt, e, b); return true;
    }
    return false;
  }

  resolve(ac, cs, pb, s, nx, ny, nz, pen, kind, item, dt, e, body = null) {
    const v = ac.vel, soft = kind === 'tree' || kind === 'crate' || kind === 'walker'; pen = Math.min(pen, 6) + 0.02;
    ac.pos.x += nx * pen; ac.pos.y += ny * pen; ac.pos.z += nz * pen;
    const vn = -(v.x * nx + v.y * ny + v.z * nz); // approach speed along the surface normal
    if (vn > 0) { const k = soft ? 0.5 : 1.12; v.x += nx * vn * k; v.y += ny * vn * k; v.z += nz * vn * k; } // trees yield (half the approach speed is lost); solids stop you with a small bounce
    if (body && vn > 0 && !soft) { // shove the other dynamic body the other way, scaled by relative mass
      const other = body.owner; if (other?.vel) { const share = Math.min(0.8, ac.mass / (ac.mass + (body.mass || 1000))) * vn; other.vel.x -= nx * share; other.vel.y -= ny * share; other.vel.z -= nz * share; }
    }
    const dn = v.x * nx + v.y * ny + v.z * nz; _t.set(v.x - nx * dn, v.y - ny * dn, v.z - nz * dn); const vt = _t.length(); // sliding speed
    if (vt > 0.01) { const mu = soft ? 0.2 : kind === 'water' ? 0.5 : 0.6, f = Math.max(0, vt - mu * G * dt * (1 + Math.max(0, vn) * 0.1)) / vt; v.set(nx * dn + _t.x * f, ny * dn + _t.y * f, nz * dn + _t.z * f); }

    if (soft && item && !item.dead) { item.dead = true; if (item.mesh) { item.mesh.setMatrixAt(item.idx, ZERO); item.mesh.instanceMatrix.needsUpdate = true; } e.fx?.burst('leaf', s, 9, 5, v); }
    if (vn > 1.5) {
      ac.kick = Math.max(ac.kick, Math.min(1, vn / 20));
      const key = pb.part + kind; // one event per part and kind every quarter second, so sliding does not re-trigger the full damage each frame
      if (!(cs.cool[key] > 0)) {
        cs.cool[key] = 0.25; e.bus.emit('aircraft:impact', { ac, speed: vn, part: pb.part, kind, point: s.clone() });
        if (kind === 'water') e.fx?.burst('spray', s, 10, 6, ac.vel); else if (!soft) { e.fx?.burst('spark', s, Math.min(14, 4 + vn), 6); e.fx?.burst('dust', s, 4, 3); }
      }
      if (!soft) { // spin from the hit point: impulse at the probe, r x n, scaled by an approximate moment of inertia
        _iq.copy(ac.quat).invert(); _nB.set(nx, ny, nz).applyQuaternion(_iq); _t.copy(pb.p).cross(_nB);
        const len = Math.max(4, ac.bounds.max.z - ac.bounds.min.z); _t.multiplyScalar(0.4 * vn / (0.3 * len) ** 2); const m = _t.length(); if (m > 2) _t.multiplyScalar(2 / m); ac.angVel.add(_t);
      }
    } else if (vt > 4 && !soft && kind !== 'water') { // scraping along a wall or the ground: sparks and slow wear
      if (cs.spark <= 0) { cs.spark = 0.05; e.fx?.burst('spark', s, 2, 3, v); }
      e.damage?.scrape(ac, pb.part, vt, dt);
    }
  }

  /** Resolve a walker capsule against every static solid and dynamic body. Returns a shared {x,z} (copy it if keeping). */
  resolveWalker(w, x, z, r, y0, y1) {
    const out = _resolved; out.x = x; out.z = z;
    const y = (y0 + y1) / 2, col = this.e.world?.colliders, v = w.vel;
    if (col?.count && col.testRadius(x, y, z, r, v.x, v.y, v.z, _hit2)) { out.x += _hit2.nx * (_hit2.pen + 0.02); out.z += _hit2.nz * (_hit2.pen + 0.02); }
    if (this.dyn.test(out.x, y, out.z, r, w, _dynHit, this.e.aircraft?.player)) { out.x += _dynHit.nx * (_dynHit.pen + 0.02); out.z += _dynHit.nz * (_dynHit.pen + 0.02); }
    return out;
  }

  /** Same for a driven vehicle (larger radius); ground/water/ramp handling stays in CargoSystem. */
  resolveVehicle(it, x, z, r, y0, y1) {
    const out = _resolved; out.x = x; out.z = z;
    const y = (y0 + y1) / 2, col = this.e.world?.colliders, v = it.vel;
    if (col?.count && col.testRadius(x, y, z, r, v.x, v.y, v.z, _hit2)) { out.x += _hit2.nx * (_hit2.pen + 0.02); out.z += _hit2.nz * (_hit2.pen + 0.02); }
    if (this.dyn.test(out.x, y, out.z, r, it, _dynHit, this.e.aircraft?.player)) { out.x += _dynHit.nx * (_dynHit.pen + 0.02); out.z += _dynHit.nz * (_dynHit.pen + 0.02); }
    return out;
  }

  /** Swept test for falling cargo: lands on (or is destroyed by) roofs, vehicles and terrain objects. */
  cargoHit(it, x0, y0, z0, x1, y1, z1) {
    const col = this.e.world?.colliders, v = it.vel;
    if (col?.count && col.sweep(x0, y0, z0, x1, y1, z1, 0.8, v.x, v.y, v.z, _hit2)) return _hit2;
    if (this.dyn.sweep(x0, y0, z0, x1, y1, z1, 0.8, it, _dynHit)) { _hit2.nx = _dynHit.nx; _hit2.ny = 0.5; _hit2.nz = _dynHit.nz; _hit2.pen = _dynHit.pen; _hit2.item = null; return _hit2; }
    return null;
  }
}
