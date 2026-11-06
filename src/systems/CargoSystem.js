import * as THREE from 'three';
const G = 9.81, UP = new THREE.Vector3(0, 1, 0), _b = new THREE.Vector3();
const M = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); return o; };

function build(type) {
  const g = new THREE.Group(), v = type === 'vehicle';
  if (v) {
    const m = M(0x6b7a3a), k = M(0x222222); g.add(box(2.2, 0.9, 4.4, m, 0, 0.9, 0), box(2, 0.8, 1.6, m, 0, 1.75, -0.9));
    for (const x of [-1.1, 1.1]) for (const z of [-1.4, 1.4]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12), k); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, z); g.add(w); }
  } else g.add(box(1.4, 1.2, 1.4, M(0xb98a3e), 0, 0.6, 0));
  const chute = new THREE.Mesh(new THREE.SphereGeometry(v ? 5 : 3, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  chute.position.y = v ? 9 : 6; chute.visible = false; g.add(chute); return { g, chute };
}

/** Cargo (supply crates + drivable vehicles): ramp, load/unload, airdrop with parachutes, driving. engine.cargo.driven = vehicle being driven (camera follows it). */
export class CargoSystem {
  constructor() { this.items = []; this.driven = null; }
  init(e) {
    this.e = e; const sp = e.world.spawnPoint(), r = sp.heading, fx = Math.sin(r), fz = -Math.cos(r), rx = Math.cos(r), rz = Math.sin(r);
    ['supply', 'supply', 'supply', 'vehicle'].forEach((t, i) => this.add(t, sp.pos.x + rx * 26 + fx * (12 + i * 9), sp.pos.z + rz * 26 + fz * (12 + i * 9), r));
    e.bus.on('action', a => this.act(a));
  }
  add(type, x, z, heading = 0) {
    const { g, chute } = build(type);
    const it = { type, mesh: g, chute, mass: type === 'vehicle' ? 3000 : 500, state: 'ground', vel: new THREE.Vector3(), t: 0, speed: 0, yaw: -heading, pos: g.position, quat: g.quaternion,
      def: { camera: { chaseDist: 11, chaseHeight: 4.5, eye: { x: 0, y: 1.9, z: -0.5 } } } };
    g.position.set(x, this.e.world.groundHeight(x, z), z); g.quaternion.setFromAxisAngle(UP, it.yaw); this.e.scene.add(g); this.items.push(it); return it;
  }
  near(o, r, type) {
    let best = null, bd = r;
    for (const it of this.items) { if (it.state !== 'ground' || (type && it.type !== type)) continue; const d = Math.hypot(it.mesh.position.x - o.x, it.mesh.position.z - o.z); if (d < bd) { bd = d; best = it; } }
    return best;
  }
  weigh(p) { p.mass = p.def.flight.mass + p.bay.reduce((s, i) => s + i.mass, 0); }
  remove(it) { this.e.scene.remove(it.mesh); this.items = this.items.filter(i => i !== it); if (this.driven === it) this.driven = null; this.e.bus.emit('hud:message', 'Cargo destroyed on impact'); }
  act(a) {
    const e = this.e, p = e.aircraft.player, say = m => e.bus.emit('hud:message', m);
    if (a === 'drive') {
      if (this.driven) { this.driven = null; return say('Left vehicle'); }
      const v = this.near(p.pos, 40, 'vehicle'); if (!v) return say('No vehicle within 40 m'); this.driven = v; return say('Driving: W/S speed, A/D steer, Enter to exit');
    }
    if (a !== 'ramp' && a !== 'cargo') return;
    const c = p.def.cargo; if (!c) return say('This aircraft has no cargo bay');
    if (a === 'ramp') { p.controls.rampOpen = !p.controls.rampOpen; return say(p.controls.rampOpen ? 'Ramp opening' : 'Ramp closing'); }
    if (p.destroyed) return; if (p.rampPos < 0.9) return say('Open the ramp first (I)');
    _b.set(0, 0, 1).applyQuaternion(p.quat); _b.y = 0; _b.normalize().multiplyScalar(c.rampDist);
    const ex = p.pos.x + _b.x, ez = p.pos.z + _b.z;
    if (p.onGround) {
      if (p.vel.length() > 3) return say('Stop the aircraft first');
      const it = this.near({ x: ex, z: ez }, 30);
      if (it) {
        if (p.mass - p.def.flight.mass + it.mass > c.maxMass) return say('Over cargo weight limit');
        if (it === this.driven) this.driven = null; it.state = 'bay'; it.mesh.visible = false; p.bay.push(it); this.weigh(p); return say(`Loaded ${it.type} (${p.bay.length} in bay)`);
      }
      const out = p.bay.pop(); if (!out) return say('Nothing in reach; bay empty');
      out.state = 'ground'; out.mesh.visible = true; out.mesh.position.set(ex, e.world.groundHeight(ex, ez), ez); out.yaw = Math.atan2(-_b.x, -_b.z); out.mesh.quaternion.setFromAxisAngle(UP, out.yaw); this.weigh(p); say(`Unloaded ${out.type}`);
    } else {
      const out = p.bay.pop(); if (!out) return say('Bay empty');
      out.state = 'air'; out.t = 0; out.mesh.visible = true; out.mesh.position.copy(p.pos).add(_b); out.vel.copy(p.vel).addScaledVector(_b.normalize(), 2); this.weigh(p); say('Airdrop!');
    }
  }
  update(dt) {
    const w = this.e.env.windVector(), world = this.e.world, s = this.e.input.state;
    for (const it of this.items) {
      const m = it.mesh;
      if (it.state === 'air') {
        it.t += dt; const chuted = it.t > 1.5, term = it.type === 'vehicle' ? 9 : 7, k = Math.min(1, dt * 0.6); it.chute.visible = chuted;
        if (chuted) { it.vel.y += (-term - it.vel.y) * Math.min(1, dt * 2); it.vel.x += (w.x - it.vel.x) * k; it.vel.z += (w.z - it.vel.z) * k; } else it.vel.y -= G * dt;
        m.position.addScaledVector(it.vel, dt);
        const gy = world.groundHeight(m.position.x, m.position.z);
        if (m.position.y <= gy) { m.position.y = gy; it.chute.visible = false; if (it.vel.y < -14) { this.remove(it); continue; } it.state = 'ground'; it.vel.set(0, 0, 0); this.e.bus.emit('hud:message', 'Cargo landed'); }
      } else if (it === this.driven && it.state === 'ground') {
        it.speed += (-s.pitch * 18 - it.speed) * Math.min(1, dt * 1.5);
        it.yaw += -s.roll * THREE.MathUtils.clamp(it.speed / 6, -1, 1) * 0.9 * dt; m.quaternion.setFromAxisAngle(UP, it.yaw);
        m.position.x += -Math.sin(it.yaw) * it.speed * dt; m.position.z += -Math.cos(it.yaw) * it.speed * dt; m.position.y = world.groundHeight(m.position.x, m.position.z);
      }
    }
  }
}
