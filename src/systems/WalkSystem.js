import * as THREE from 'three';
import { deckY, rampEnd } from '../aircraft/Deck.js';
const UP = new THREE.Vector3(0, 1, 0), EYE = 1.65, R = 0.32, _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _iq = new THREE.Quaternion();
const clamp = THREE.MathUtils.clamp;

function fallbackAvatar() {
  const g = new THREE.Group(), skin = new THREE.MeshStandardMaterial({ color: 0xd9a77e, roughness: 0.8 }), cloth = new THREE.MeshStandardMaterial({ color: 0x3f5a7a, roughness: 0.9 }), dark = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.9 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.6, 0.26), cloth); torso.position.y = 1.2; const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), skin); head.position.y = 1.65;
  const leg = x => { const p = new THREE.Group(); p.position.set(x, 0.9, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.9, 0.2), dark); m.position.y = -0.45; p.add(m); return p; }, arm = x => { const p = new THREE.Group(); p.position.set(x, 1.48, 0); const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), cloth); m.position.y = -0.28; p.add(m); return p; };
  const L = leg(-0.11), Rg = leg(0.11), AL = arm(-0.3), AR = arm(0.3); g.add(torso, head, L, Rg, AL, AR); g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  g.userData.swing = (t, s) => { const a = Math.sin(t * (4 + s * 2)) * Math.min(0.9, s * 0.35); L.rotation.x = a; Rg.rotation.x = -a; AL.rotation.x = -a * 0.8; AR.rotation.x = a * 0.8; };
  return g;
}

/**
 * The pilot as a person. mode: 'aircraft' (seated; `seat` pilot|copilot) | 'foot' (walking, outside or `inside` an aircraft) | 'vehicle' (driving).
 * E / Enter = interact (stand up, open doors, board, drive, sit). Door action toggles the nearest door. Controls are only fed to the aircraft while seated.
 */
export class WalkSystem {
  constructor() {
    this.mode = 'aircraft'; this.seat = 'pilot'; this.pos = new THREE.Vector3(); this.yaw = 0; this.pitch = 0; this.vy = 0; this.speed = 0; this.inside = null; this.third = false; this.prompt = null; this.keys = new Set(); this.vel = new THREE.Vector3();
    this.quat = new THREE.Quaternion(); this.surface = 'hard'; this.stepT = 0; this.alwaysUpdate = true; this.t = 0; this.closeTimer = null;
  }
  get focus() { const e = this.e; if (this.mode === 'vehicle' && e.cargo.driven) return e.cargo.driven; if (this.mode === 'foot') return this; return e.aircraft.player; }
  init(e) {
    this.e = e; this.avatar = new THREE.Group(); this.fb = fallbackAvatar(); this.avatar.add(this.fb); this.avatar.visible = false; e.scene.add(this.avatar);
    const say = m => e.bus.emit('hud:message', m);
    addEventListener('keydown', ev => { if (document.body.classList.contains('menu-open')) return; this.keys.add(ev.code); if (this.mode === 'foot' && ev.code === 'KeyE' && !ev.repeat) this.interact(); if (this.mode === 'foot' && ev.code === 'Space' && !ev.repeat && this.grounded) this.vy = 4.2; });
    addEventListener('keyup', ev => this.keys.delete(ev.code)); addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', ev => { if (document.pointerLockElement === e.renderer.domElement && this.mode === 'foot') this.look(-ev.movementX * 0.0022, -ev.movementY * 0.0022); });
    e.renderer.domElement.addEventListener('click', () => { if (this.mode === 'foot' && !this.third && !document.body.classList.contains('coarse') && !document.pointerLockElement) e.renderer.domElement.requestPointerLock?.(); });
    e.bus.on('action', a => { if (a === 'interact' || a === 'drive') this.interact(); else if (a === 'door') this.toggleDoor(); else if (a === 'camera' && this.mode === 'foot') { this.third = !this.third; say(this.third ? 'Third person' : 'First person'); } });
    e.bus.on('aircraft:spawn', () => this.reset());
    e.bus.on('assets:loaded', id => { if (id === 'soldier') this.upgradeAvatar(); }); this.upgradeAvatar();
  }
  upgradeAvatar() {
    const inst = this.e.assets?.instance('soldier'); if (!inst || this.mixer) return; const m = inst.scene; m.rotation.y = Math.PI; this.avatar.remove(this.fb); this.avatar.add(m); m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    this.mixer = new THREE.AnimationMixer(m); this.acts = {}; for (const c of inst.animations) if (['Idle', 'Walk', 'Run'].includes(c.name)) { const a = this.mixer.clipAction(c); a.play(); a.setEffectiveWeight(c.name === 'Idle' ? 1 : 0); this.acts[c.name] = a; }
  }
  reset() { this.mode = 'aircraft'; this.seat = 'pilot'; this.inside = null; this.avatar.visible = false; this.prompt = null; if (this.e.cargo) this.e.cargo.driven = null; }
  look(dy, dp) { this.yaw += dy; this.pitch = clamp(this.pitch + dp, -1.3, 1.3); }
  get grounded() { return this.onGround; }
  say(m) { this.e.bus.emit('hud:message', m); }

  // ------------------------------------------------------------------ transitions
  /** Place the walker at a world position, facing `yaw`. */
  standAt(x, z, y, yaw, inside = null) { this.mode = 'foot'; this.inside = inside; this.pos.set(x, y, z); this.yaw = yaw; this.pitch = 0; this.vy = 0; this.speed = 0; this.avatar.visible = true; this.onGround = true; }
  doorWorld(ac, p, out = _a) { return out.set(p.x, 0, p.z).applyQuaternion(ac.quat).add(ac.pos); }
  aircraftYaw(ac) { _a.set(0, 0, -1).applyQuaternion(ac.quat); return Math.atan2(-_a.x, -_a.z); }
  standUp() {
    const e = this.e, ac = e.aircraft.player; if (!ac || ac.destroyed) return;
    if (!ac.onGround || ac.vel.length() > 4) return this.say('Stop the aircraft on the ground first');
    const doors = ac.mesh.userData.parts.doors, seatDoor = doors.find(d => d.enter === this.seat) || doors[0], yaw = this.aircraftYaw(ac);
    ac.controls.throttle = 0; e.input.state.throttle = 0;
    if (ac.def.interior) { const s = ac.def.cockpit.seats[this.seat === 'pilot' ? 0 : 1]; _a.set(s.x, 0, s.z + 0.75).applyQuaternion(ac.quat).add(ac.pos); this.standAt(_a.x, _a.z, ac.pos.y + ac.def.interior.floorY, yaw, ac); this.say('Left the seat - E near a door to get out'); }
    else { if (seatDoor) { seatDoor.target = 1; this.doorWorld(ac, seatDoor.at); this.standAt(_a.x, _a.z, e.world.groundHeight(_a.x, _a.z), yaw + (seatDoor.side > 0 ? -Math.PI / 2 : Math.PI / 2)); } this.say('Door open. E near the door to climb back in, 6 to close it'); }
  }
  sit(seat) { const ac = this.e.aircraft.player; this.mode = 'aircraft'; this.seat = seat; this.inside = null; this.avatar.visible = false; this.e.cameras?.set(seat === 'copilot' ? 'copilot' : 'cockpit'); this.say(seat === 'copilot' ? 'Co-pilot seat' : 'Pilot seat'); if (this.e.settings.get('autoDoors')) this.closeTimer = 1.8; }
  enterVehicle(v) {
    const ac = this.e.aircraft.player;
    if (v.state === 'bay' && ac) { ac.bay = ac.bay.filter(i => i !== v); v.state = 'ground'; v.onDeck = ac; v.yaw = this.aircraftYaw(ac); v.speed = 0; v.warned = false; this.e.cargo.slot(ac); this.e.cargo.weigh(ac); } // drive it out of the bay
    this.mode = 'vehicle'; this.e.cargo.driven = v; this.avatar.visible = false; this.inside = null; this.e.cameras?.set('cockpit'); this.say(`Driving ${v.name}: W/S throttle, A/D steer, Space brake, E to get out`); }
  exitVehicle() {
    const v = this.e.cargo.driven; if (!v) return; if (Math.abs(v.speed) > 5) return this.say('Slow down first'); const side = v.def.driverSide ?? -1, off = (v.def.halfWidth ?? 1.2) + 0.9;
    _a.set(side * off, 0, 0).applyQuaternion(v.quat).add(v.pos); this.e.cargo.driven = null; v.speed = 0;
    const ac = v.onDeck, gy = ac ? v.pos.y : this.e.world.groundHeight(_a.x, _a.z);
    this.standAt(_a.x, _a.z, gy, v.yaw, ac || null); this.say('Out of the vehicle');
  }
  toggleDoor() {
    const ac = this.e.aircraft.player; if (!ac) return; let d = null;
    if (this.mode === 'aircraft') d = ac.mesh.userData.parts.doors.find(x => x.enter === this.seat) || ac.mesh.userData.parts.doors[0];
    else if (this.mode === 'foot') d = this.nearestDoor(ac, 3.2);
    if (!d) return this.say('No door within reach'); d.target = d.target ? 0 : 1; this.say(`${d.label} ${d.target ? 'opened' : 'closed'}`); this.e.bus.emit('sfx', d.target ? 'door_open' : 'door_close');
  }
  nearestDoor(ac, r) {
    let best = null, bd = r; for (const d of ac.mesh.userData.parts.doors) { const dd = this.mode === 'foot' && this.inside === ac ? this.localDist(ac, d.in ?? d.at) : this.worldDist(ac, d.at); if (dd < bd) { bd = dd; best = d; } } return best;
  }
  worldDist(ac, p) { this.doorWorld(ac, p); return Math.hypot(_a.x - this.pos.x, _a.z - this.pos.z); }
  localDist(ac, p) { _b.copy(this.pos).sub(ac.pos).applyQuaternion(_iq.copy(ac.quat).invert()); return Math.hypot(_b.x - p.x, _b.z - p.z); }

  /** Context action (E / Enter / tap the prompt). */
  interact() {
    const e = this.e, ac = e.aircraft.player; if (!ac) return;
    if (this.mode === 'aircraft') return this.standUp();
    if (this.mode === 'vehicle') return this.exitVehicle();
    const p = this.prompt; if (p) p.run();
  }

  // ------------------------------------------------------------------ prompts
  findPrompt() {
    const e = this.e, ac = e.aircraft.player, out = []; if (!ac || ac.destroyed) return null;
    const doors = ac.mesh.userData.parts.doors, P = ac.def.cockpit;
    if (this.inside === ac) {
      P.seats.forEach((s, i) => { if (this.localDist(ac, s) < 1.5) out.push({ d: this.localDist(ac, s), text: i === 0 ? 'Sit in pilot seat' : 'Sit in co-pilot seat', run: () => this.sit(i === 0 ? 'pilot' : 'copilot') }); });
      for (const d of doors) { const dd = this.localDist(ac, d.in ?? d.at); if (dd < 1.7) out.push({ d: dd, text: d.pos > 0.9 ? `Exit via ${d.label.toLowerCase()}` : `Open ${d.label.toLowerCase()}`, run: () => { if (d.pos > 0.9) { this.doorWorld(ac, d.at); this.standAt(_a.x, _a.z, e.world.groundHeight(_a.x, _a.z), this.aircraftYaw(ac) + (d.side > 0 ? -Math.PI / 2 : Math.PI / 2)); } else { d.target = 1; e.bus.emit('sfx', 'door_open'); } } }); }
      if (this.localDist(ac, { x: 0, z: ac.mesh.userData.parts.rampAngles?.hingeZ - 1.5 }) < 2.2 && ac.def.cargo) out.push({ d: 2, text: ac.controls.rampOpen ? 'Close cargo ramp' : 'Open cargo ramp', run: () => e.bus.emit('action', 'ramp') });
      const v = e.cargo.nearVehicle(this.pos, 3.2, ac); if (v) out.push({ d: 1, text: `Drive ${v.name}`, run: () => this.enterVehicle(v) });
    } else {
      for (const d of doors) { const dd = this.worldDist(ac, d.at); if (dd < 2) out.push({ d: dd, text: d.pos < 0.9 ? `Open ${d.label.toLowerCase()}` : d.enter ? `Climb in (${d.enter === 'pilot' ? 'pilot' : 'co-pilot'} seat)` : `Board ${ac.def.name.split(' (')[0]}`, run: () => this.useDoor(ac, d) }); }
      const v = e.cargo.nearVehicle(this.pos, 3.4); if (v) out.push({ d: 1.5, text: `Drive ${v.name}`, run: () => this.enterVehicle(v) });
    }
    out.sort((a, b) => a.d - b.d); return out[0] || null;
  }
  useDoor(ac, d) {
    if (d.pos < 0.9) { d.target = 1; this.e.bus.emit('sfx', 'door_open'); return; }
    if (d.enter === 'pilot' || d.enter === 'copilot') return this.sit(d.enter);
    const ins = d.in ?? { x: d.side * 0.9, z: d.at.z }; _a.set(ins.x, ac.def.interior.floorY, ins.z).applyQuaternion(ac.quat).add(ac.pos); this.standAt(_a.x, _a.z, _a.y, this.yaw, ac); this.say('Aboard');
  }

  // ------------------------------------------------------------------ per-frame
  update(dt, e) {
    this.t += dt; const ac = e.aircraft.player;
    if (this.closeTimer != null && (this.closeTimer -= dt) <= 0) { this.closeTimer = null; ac?.mesh.userData.parts.doors.forEach(d => { if (d.enter === this.seat || d.enter === 'pilot') d.target = 0; }); }
    if (this.mode !== 'foot') { this.prompt = null; this.updateAvatar(dt); if (this.mode === 'aircraft' && ac) this.quat.copy(ac.quat); return; }
    if (e.paused) return;
    const s = e.input.state, g = (navigator.getGamepads?.() || [])[0], sprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    if (g && Math.abs(g.axes[2]) > 0.15) this.look(-g.axes[2] * dt * 2.2, 0);
    let fwd = -s.pitch, str = s.roll; const l = Math.hypot(fwd, str); if (l > 1) { fwd /= l; str /= l; }
    const top = sprint ? 5.2 : 1.9, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw); // forward = (-sin, -cos), right = (cos, -sin)
    _b.set((-sy * fwd + cy * str) * top, 0, (-cy * fwd - sy * str) * top); this.vel.lerp(_b, Math.min(1, dt * 9)); this.speed = this.vel.length();
    this.move(dt, ac); this.quat.setFromAxisAngle(UP, this.yaw); this.updateAvatar(dt);
    this.prompt = this.findPrompt();
    if (this.speed > 0.5 && this.onGround) { this.stepT -= dt; if (this.stepT <= 0) { this.stepT = sprint ? 0.3 : 0.5; e.bus.emit('sfx', `step_${this.surface}`); } }
  }
  move(dt, ac) {
    const e = this.e, w = e.world; let nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    const inside = this.inside; let floor;
    if (inside) { // aircraft-local walk: bounds + deck height; stepping off the ramp end / onto the ramp switches in and out of the cabin
      _b.set(nx, 0, nz).sub(inside.pos); _b.y = 0; _b.applyQuaternion(_iq.copy(inside.quat).invert()); const D = inside.def.interior, hz = inside.mesh.userData.parts.rampAngles.hingeZ, end = rampEnd(inside), open = inside.rampPos > 0.9, W = D.halfW - 0.3;
      let lx = clamp(_b.x, -W, W), lz = clamp(_b.z, D.z0 + 0.3, open ? end + 1 : hz - 0.2); const dy = deckY(inside, lx, lz);
      if (open && lz > end - 0.15) { this.inside = null; _a.set(lx, 0, lz).applyQuaternion(inside.quat).add(inside.pos); nx = _a.x; nz = _a.z; floor = w.groundHeight(nx, nz); }
      else { floor = inside.pos.y + (dy ?? D.floorY); _a.set(lx, 0, lz).applyQuaternion(inside.quat).add(inside.pos); nx = _a.x; nz = _a.z; }
    } else {
      for (const a of e.aircraft.list) { const hull = a.def.walk?.hull; if (!hull) continue; _b.set(nx, 0, nz).sub(a.pos); _b.y = 0; _b.applyQuaternion(_iq.copy(a.quat).invert()); const hz = a.mesh.userData.parts.rampAngles?.hingeZ, rampOk = a.rampPos > 0.9 && hz != null && Math.abs(_b.x) < a.def.interior.halfW && _b.z > hz - 1;
        if (rampOk && _b.z < rampEnd(a) - 0.2 && _b.z > hz - 0.2) { this.inside = a; this.say('Entering cargo bay'); break; }
        const px = hull.hx + R - Math.abs(_b.x), pz1 = _b.z - (hull.z0 - R), pz2 = hull.z1 + R - _b.z;
        if (!rampOk && px > 0 && pz1 > 0 && pz2 > 0 && Math.abs(_b.y) < 99) { if (px < Math.min(pz1, pz2)) _b.x = Math.sign(_b.x || 1) * (hull.hx + R); else _b.z = pz1 < pz2 ? hull.z0 - R : hull.z1 + R; _a.copy(_b).applyQuaternion(a.quat).add(a.pos); nx = _a.x; nz = _a.z; } }
      for (const v of e.cargo.items) { if (v.state !== 'ground' || v === e.cargo.driven) continue; const r = (v.type === 'vehicle' ? Math.max(v.def.length ?? 4, 3) * 0.5 : 1) + R, dx = nx - v.pos.x, dz = nz - v.pos.z, d = Math.hypot(dx, dz); if (d < r && v.type === 'vehicle') { nx = v.pos.x + dx / d * r; nz = v.pos.z + dz / d * r; } }
      if (w.isWater(nx, nz) && !w.isWater(this.pos.x, this.pos.z)) { nx = this.pos.x; nz = this.pos.z; this.vel.set(0, 0, 0); }
      floor = w.groundHeight(nx, nz);
      if (floor - this.pos.y > 0.9 && this.onGround) { nx = this.pos.x; nz = this.pos.z; floor = w.groundHeight(nx, nz); }
      this.surface = w.surfaceAt(nx, nz).foot;
    }
    this.pos.x = nx; this.pos.z = nz; this.vy -= 9.81 * dt; this.pos.y += this.vy * dt; this.onGround = false;
    if (this.pos.y <= floor + 0.02 || (this.vy <= 0 && this.pos.y - floor < 0.25)) { this.pos.y = floor; this.vy = Math.max(0, this.vy); this.onGround = true; }
  }
  updateAvatar(dt) {
    const av = this.avatar; if (this.mode !== 'foot') { av.visible = false; return; }
    av.visible = this.third; av.position.copy(this.pos); av.rotation.y = this.yaw;
    if (this.mixer) { const s = this.speed, w = { Idle: clamp(1 - s / 0.6, 0, 1), Walk: s > 0.1 && s < 3.4 ? clamp(Math.min(s / 0.6, (3.8 - s) / 1.2), 0, 1) : 0, Run: clamp((s - 3) / 1.4, 0, 1) }; for (const k in this.acts) this.acts[k].setEffectiveWeight(w[k]); this.acts.Walk?.setEffectiveTimeScale(clamp(s / 1.9, 0.5, 1.4)); this.mixer.update(dt); }
    else this.fb.userData.swing(this.t, this.speed);
  }
  /** Camera pose for on-foot views (CameraManager). */
  eye(out) { return out.set(this.pos.x, this.pos.y + EYE, this.pos.z); }
}
