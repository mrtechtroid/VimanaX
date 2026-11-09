import * as THREE from 'three';
import { deckY } from '../aircraft/Deck.js';
import { disposeTree } from '../aircraft/Aircraft.js';
const G = 9.81, UP = new THREE.Vector3(0, 1, 0), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _iq = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
const std = (c, r = 0.8, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = true; return o; };

/** Drivable vehicle catalogue. `glb` models fall back to the procedural body until the asset has loaded. Forward is -Z; driverSide -1 = left. */
export const VEHICLES = {
  scout: { name: 'Scout 4x4', length: 4.4, halfWidth: 1.1, mass: 2200, top: 24, accel: 5.5, wheelbase: 2.6, steer: 0.55, driverSide: -1, eye: { x: -0.4, y: 1.55, z: -0.1 }, camera: { chaseDist: 10, chaseHeight: 4 }, color: 0x6b7a3a },
  sport: { name: 'Ferrari 458', glb: 'ferrari', length: 4.53, halfWidth: 0.95, mass: 1500, top: 62, accel: 11, wheelbase: 2.65, steer: 0.42, driverSide: -1, eye: { x: -0.36, y: 1.02, z: 0.15 }, camera: { chaseDist: 9, chaseHeight: 3.2 }, latG: 11, color: 0xc0171d, wheels: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] },
  truck: { name: 'Milk truck', glb: 'truck', flip: true, length: 4.87, halfWidth: 1.4, mass: 3500, top: 24, accel: 3.4, wheelbase: 3.0, steer: 0.5, driverSide: -1, eye: { x: -0.55, y: 1.75, z: -1.25 }, camera: { chaseDist: 11, chaseHeight: 4.2 }, color: 0xeeeeee },
};
function procedural(kind) {
  const V = VEHICLES[kind], g = new THREE.Group(), body = std(V.color, 0.5, 0.3), tire = std(0x151515, 0.95, 0), rim = std(0xb0b4b8, 0.3, 0.9), glass = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.5 }), wheels = [];
  const L = V.length, h = kind === 'truck' ? 1.3 : kind === 'sport' ? 0.5 : 0.8;
  g.add(box(V.halfWidth * 2, h, L, body, 0, 0.55 + h / 2, 0)); g.add(box(V.halfWidth * 1.8, kind === 'scout' ? 0.75 : 0.5, L * 0.45, glass, 0, 0.55 + h + (kind === 'scout' ? 0.37 : 0.25), kind === 'truck' ? 1 : 0.2));
  for (const x of [-1, 1]) for (const z of [-1, 1]) { const w = new THREE.Group(); w.position.set(x * (V.halfWidth - 0.1), 0.42, z * L * 0.32); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), tire); t.rotation.z = Math.PI / 2; const r = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.32, 10), rim); r.rotation.z = Math.PI / 2; w.add(t, r); g.add(w); wheels.push(w); }
  g.userData.wheels = wheels; g.userData.fallback = true; return g;
}
function crate() { const g = new THREE.Group(), w = std(0xb98a3e, 0.85, 0), s = std(0x3a3a3a, 0.5, 0.6); g.add(box(1.4, 1.2, 1.4, w, 0, 0.6, 0)); for (const x of [-0.45, 0.45]) g.add(box(0.08, 1.24, 1.44, s, x, 0.6, 0)); return g; }
const chuteMesh = big => { const c = new THREE.Mesh(new THREE.SphereGeometry(big ? 5 : 3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide, roughness: 1 })); c.position.y = big ? 9 : 6; c.visible = false; return c; };

/**
 * Cargo and vehicles. Crates + three drivable vehicles; ramp, load/unload, parachute airdrop.
 * Vehicles can be DRIVEN up the open ramp into the bay (auto-secured) and out again; bay cargo rides inside the aircraft.
 * engine.cargo.driven = vehicle being driven (camera follows it). Entering/leaving vehicles is handled by WalkSystem.
 */
export class CargoSystem {
  constructor() { this.items = []; this.driven = null; }
  init(e) {
    this.e = e; const sp = e.world.spawnPoint(), r = sp.heading, fx = Math.sin(r), fz = -Math.cos(r), rx = Math.cos(r), rz = Math.sin(r);
    ['supply', 'supply', 'supply', 'scout', 'sport', 'truck'].forEach((t, i) => this.add(t, sp.pos.x + rx * 24 + fx * (14 + i * 9), sp.pos.z + rz * 24 + fz * (14 + i * 9), r));
    e.bus.on('action', a => this.act(a)); e.bus.on('assets:loaded', () => this.upgradeModels()); e.bus.on('aircraft:spawn', () => { for (const it of this.items) if (it.state === 'bay') { it.state = 'ground'; } });
    this.upgradeModels();
  }
  add(type, x, z, heading = 0) {
    const veh = type !== 'supply', V = veh ? VEHICLES[type] : null, g = new THREE.Group(), body = veh ? procedural(type) : crate(), chute = chuteMesh(veh);
    g.add(body, chute); const it = { type: veh ? 'vehicle' : 'supply', kind: type, name: V?.name ?? 'Supply crate', mesh: g, chute, body, mass: V?.mass ?? 500, state: 'ground', vel: new THREE.Vector3(), t: 0, speed: 0, yaw: -heading, pos: g.position, quat: g.quaternion, onDeck: null, slotZ: 0,
      def: V ? { camera: { ...V.camera, eye: V.eye }, length: V.length, halfWidth: V.halfWidth, driverSide: V.driverSide } : { camera: { chaseDist: 8, chaseHeight: 3, eye: { x: 0, y: 1, z: 0 } }, length: 1.5, halfWidth: 0.7 }, wheelsSpin: 0 };
    g.position.set(x, this.e.world.groundHeight(x, z), z); g.quaternion.setFromAxisAngle(UP, it.yaw); this.e.scene.add(g); this.items.push(it); return it;
  }
  upgradeModels() {
    for (const it of this.items) { const V = VEHICLES[it.kind]; if (!V?.glb || !it.body.userData.fallback) continue; const inst = this.e.assets?.instance(V.glb); if (!inst) continue;
      const m = inst.scene, wrap = new THREE.Group(); if (V.flip) m.rotation.y = Math.PI; wrap.add(m); const box3 = new THREE.Box3().setFromObject(wrap); m.position.y -= box3.min.y; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      it.mesh.remove(it.body); it.body = wrap; it.mesh.add(wrap); wrap.userData.wheels = (V.wheels || []).map(n => m.getObjectByName(n)).filter(Boolean); if (inst.animations.length) { wrap.userData.mixer = new THREE.AnimationMixer(m); const a = wrap.userData.mixer.clipAction(inst.animations[0]); a.play(); } }
  }
  /** Nearest vehicle to a world point: on the ground within r, or (with `ac`) parked in that aircraft's bay. */
  nearVehicle(o, r, ac = null) {
    let best = null, bd = r;
    for (const it of this.items) { if (it.type !== 'vehicle' || it === this.driven) continue; if (it.state === 'bay' && !ac) continue; if (it.state !== 'bay' && it.state !== 'ground') continue; const d = Math.hypot(it.pos.x - o.x, it.pos.z - o.z); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  near(o, r, type) { let best = null, bd = r; for (const it of this.items) { if (it.state !== 'ground' || (type && it.type !== type)) continue; const d = Math.hypot(it.pos.x - o.x, it.pos.z - o.z); if (d < bd) { bd = d; best = it; } } return best; }
  weigh(p) { p.mass = p.def.flight.mass + p.bay.reduce((s, i) => s + i.mass, 0); }
  remove(it) { this.e.scene.remove(it.mesh); disposeTree(it.mesh); this.items = this.items.filter(i => i !== it); if (this.driven === it) { this.driven = null; this.e.walk?.reset(); } this.e.bus.emit('hud:message', 'Cargo destroyed on impact'); }
  /** Park an item in the next free bay slot (drive-in or K). */
  stow(p, it) { it.state = 'bay'; it.onDeck = null; it.speed = 0; p.bay.push(it); this.slot(p); this.weigh(p); }
  slot(p) { const A = p.mesh.userData.parts.rampAngles; let z = A.hingeZ - 6.2; for (const it of p.bay) { it.slotZ = z; z -= it.type === 'vehicle' ? 5.4 : 1.8; } }
  act(a) {
    const e = this.e, p = e.aircraft.player, say = m => e.bus.emit('hud:message', m);
    if (a !== 'ramp' && a !== 'cargo') return;
    const c = p.def.cargo; if (!c) return say('This aircraft has no cargo bay');
    if (a === 'ramp') { p.controls.rampOpen = !p.controls.rampOpen; e.bus.emit('sfx', 'ramp'); return say(p.controls.rampOpen ? 'Ramp opening' : 'Ramp closing'); }
    if (p.destroyed) return; if (p.rampPos < 0.9) return say('Open the ramp first (I)');
    _b.set(0, 0, 1).applyQuaternion(p.quat); _b.y = 0; _b.normalize().multiplyScalar(c.rampDist);
    const ex = p.pos.x + _b.x, ez = p.pos.z + _b.z;
    if (p.onGround) {
      if (p.vel.length() > 3) return say('Stop the aircraft first');
      const it = this.near({ x: ex, z: ez }, 30);
      if (it) { if (p.mass - p.def.flight.mass + it.mass > c.maxMass) return say('Over cargo weight limit'); if (it === this.driven) return say('Get out first'); this.stow(p, it); return say(`Loaded ${it.name} (${p.bay.length} in bay)`); }
      const out = p.bay.pop(); if (!out) return say('Nothing in reach; bay empty');
      out.state = 'ground'; out.onDeck = null; out.pos.set(ex, e.world.groundHeight(ex, ez), ez); out.yaw = Math.atan2(-_b.x, -_b.z); out.quat.setFromAxisAngle(UP, out.yaw); this.slot(p); this.weigh(p); say(`Unloaded ${out.name}`);
    } else {
      const out = p.bay.pop(); if (!out) return say('Bay empty');
      out.state = 'air'; out.t = 0; out.pos.copy(p.pos).add(_b); out.vel.copy(p.vel).addScaledVector(_b.normalize(), 2); this.slot(p); this.weigh(p); say('Airdrop!');
    }
  }
  /** Drive-state update for one vehicle. */
  drive(it, dt, s) {
    const e = this.e, w = e.world, V = VEHICLES[it.kind], p = e.aircraft.player, sf = w.surfaceAt(it.pos.x, it.pos.z), top = V.top * Math.max(0.3, sf.veh), thr = this.driven === it ? -s.pitch : 0;
    let target = thr > 0 ? thr * top : thr * top * 0.35, a = V.accel * (0.6 + 0.4 * sf.grip); const braking = (this.driven === it && s.brake > 0.5) || (target * it.speed < 0 && Math.abs(it.speed) > 0.5); if (braking) { a = 12 * sf.brake; if (s.brake > 0.5) target = 0; } else if (!thr) a = 2.5;
    it.speed += Math.sign(target - it.speed) * Math.min(Math.abs(target - it.speed), a * dt); const sp = it.speed;
    const steer = this.driven === it ? -s.roll * V.steer * (1 - 0.6 * Math.min(1, Math.abs(sp) / top)) : 0; it.steer = steer; const wMax = (V.latG ?? 7) * sf.grip / Math.max(Math.abs(sp), 1), yr = THREE.MathUtils.clamp((sp / V.wheelbase) * Math.tan(steer), -wMax, wMax); it.yaw += yr * dt; // yaw rate limited by lateral grip (m/s^2 / speed)
    let nx = it.pos.x - Math.sin(it.yaw) * sp * dt, nz = it.pos.z - Math.cos(it.yaw) * sp * dt, onDeck = null, y;
    if (p && p.onGround && p.mesh) { _b.set(nx, 0, nz).sub(p.pos); _b.y = 0; _b.applyQuaternion(_iq.copy(p.quat).invert()); const hull = p.def.walk?.hull, A = p.mesh.userData.parts.rampAngles, hz = A?.hingeZ ?? 0, open = p.rampPos > 0.9;
      const corridor = A && open && Math.abs(_b.x) < 2.3 && _b.z > hz - 10;
      if (hull && !corridor) { const R2 = V.length * 0.5, px = hull.hx + V.halfWidth + 0.3 - Math.abs(_b.x), pz1 = _b.z - (hull.z0 - R2), pz2 = hull.z1 + R2 - _b.z; if (px > 0 && pz1 > 0 && pz2 > 0) { it.speed *= 0.2; nx = it.pos.x; nz = it.pos.z; } }
      else if (A) { const dy = deckY(p, _b.x, _b.z); if (dy != null) { onDeck = p; y = p.pos.y + dy; if (!open && _b.z > hz - V.length * 0.5 - 0.3) { it.speed *= 0.2; nx = it.pos.x; nz = it.pos.z; } } }
    }
    if (w.isWater(nx, nz)) { it.speed *= 0.3; nx = it.pos.x; nz = it.pos.z; }
    it.pos.x = nx; it.pos.z = nz; it.onDeck = onDeck; y ??= w.groundHeight(nx, nz); it.pos.y += (y - it.pos.y) * Math.min(1, onDeck ? 1 : dt * 20);
    // body follows the terrain slope (not on the deck: it is level there)
    const d = 2.2; _n.set((w.groundHeight(nx - d, nz) - w.groundHeight(nx + d, nz)) / (2 * d), 1, (w.groundHeight(nx, nz - d) - w.groundHeight(nx, nz + d)) / (2 * d)).normalize(); if (onDeck) _n.set(0, 1, 0);
    _q.setFromUnitVectors(UP, _n); _q2.setFromAxisAngle(UP, it.yaw); it.quat.slerp(_q.multiply(_q2), Math.min(1, dt * 8));
    if (onDeck && p && it.pos.z !== undefined) { _b.set(it.pos.x, 0, it.pos.z).sub(p.pos); _b.y = 0; _b.applyQuaternion(_iq.copy(p.quat).invert()); const A = p.mesh.userData.parts.rampAngles; if (_b.z < A.hingeZ - 6.4 && it.speed > 1 && this.autoStow(p, it)) return; }
  }
  autoStow(p, it) {
    const c = p.def.cargo; if (!c || p.vel.length() > 3) return false; if (p.mass - p.def.flight.mass + it.mass > c.maxMass) { if (!it.warned) { it.warned = true; this.e.bus.emit('hud:message', 'Over cargo weight limit - back out'); } return false; }
    this.stow(p, it); if (this.driven === it) { const walk = this.e.walk; this.driven = null; const sz = it.slotZ; _c.set(-1.2 * (it.def.driverSide === -1 ? 1 : -1), p.def.interior.floorY, sz); _c.applyQuaternion(p.quat).add(p.pos); walk.standAt(_c.x, _c.z, _c.y, walk.aircraftYaw(p), p); }
    this.e.bus.emit('hud:message', `${it.name} secured in bay`); return true;
  }
  update(dt) {
    const e = this.e, world = e.world, s = e.input.state, p = e.aircraft.player, wind = e.env.windVector(); if (e.paused) return;
    for (const it of this.items) {
      const m = it.mesh;
      if (it.state === 'bay' && p) { _c.set(0, p.def.interior.floorY, it.slotZ).applyQuaternion(p.quat).add(p.pos); m.position.copy(_c); m.quaternion.copy(p.quat); continue; }
      if (it.state === 'air') {
        it.t += dt; const chuted = it.t > 1.5, term = it.type === 'vehicle' ? 9 : 7, k = Math.min(1, dt * 0.6); it.chute.visible = chuted;
        if (chuted) { it.vel.y += (-term - it.vel.y) * Math.min(1, dt * 2); it.vel.x += (wind.x - it.vel.x) * k; it.vel.z += (wind.z - it.vel.z) * k; } else it.vel.y -= G * dt;
        m.position.addScaledVector(it.vel, dt); const gy = world.groundHeight(m.position.x, m.position.z);
        if (m.position.y <= gy) { m.position.y = gy; it.chute.visible = false; if (it.vel.y < -14) { this.remove(it); continue; } it.state = 'ground'; it.vel.set(0, 0, 0); e.bus.emit('hud:message', 'Cargo landed'); }
      } else if (it.type === 'vehicle' && it.state === 'ground') {
        if (it === this.driven || Math.abs(it.speed) > 0.05) this.drive(it, dt, s); else { /* parked: settle on the terrain */ if (!it.onDeck) m.position.y = world.groundHeight(m.position.x, m.position.z); }
        const sp = it.speed, ws = it.body.userData.wheels; if (ws) for (const w of ws) w.rotation.x -= sp * dt / 0.36;
        it.body.userData.mixer?.update(Math.abs(sp) * dt * 0.7);
      }
    }
  }
}
