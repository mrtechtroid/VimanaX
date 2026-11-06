import * as THREE from 'three';
const { clamp, damp } = THREE.MathUtils;
const D2R = Math.PI / 180, UP = new THREE.Vector3(0, 1, 0);
const _m2 = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _l = new THREE.Quaternion(), _m = new THREE.Matrix4(), _e = new THREE.Euler(0, 0, 0, 'YXZ');
const wrap = x => ((x + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
const angDamp = (cur, target, k, dt) => cur + wrap(target - cur) * (1 - Math.exp(-k * dt));

export const CAMERA_MODES = [
  { id: 'chase', label: 'Chase', hint: 'Follows behind. Drag to look around; it swings back when you let go.' },
  { id: 'orbit', label: 'Orbit', hint: 'Free orbit that stays where you leave it.' },
  { id: 'cockpit', label: 'Cockpit', hint: 'Pilot\u2019s eye. Drag to look around, wheel to zoom.' },
  { id: 'copilot', label: 'Co-pilot', hint: 'Right-hand seat view.' },
  { id: 'wing', label: 'Wing', hint: 'Mounted on the left wing.' },
  { id: 'flyby', label: 'Fly-by', hint: 'Trackside camera that jumps ahead as you pass.' },
  { id: 'tower', label: 'Tower', hint: 'Telephoto from the nearest airport.' },
];

/**
 * Camera modes with a shared "look around" layer.
 *   view.yaw   + = camera moved to the plane's LEFT (cockpit: looking left)
 *   view.pitch + = camera moved UP (cockpit: looking up)
 *   view.zoom  scales distance (chase/orbit) or field of view (cockpit/wing/tower/fly-by)
 * Input: mouse/touch drag, wheel / pinch, double-click or Digit5 to reset, keys , . ; / - = (numpad 4 6 8 2 + - 5), gamepad D-pad / R3.
 * Chase follows heading + damped pitch only, so it does not roll with the aircraft.
 * Runs while the engine is paused (menu open) so the view can still be orbited.
 */
export class CameraManager {
  constructor() {
    this.modes = CAMERA_MODES.map(m => m.id); this.i = 0; this.views = {}; this.keys = new Set(); this.ptr = new Map();
    this.idle = 99; this.alwaysUpdate = true; this.blend = null; this.subjectKey = null; this.footDist = 3.2; this.follow = { yaw: 0, pitch: 0, init: false }; this.fb = null; this.fov = 60; this.last = null; this.orbitAz = 0;
  }
  get mode() { return this.modes[this.i]; }
  /** True when the viewpoint is inside an aircraft (cockpit instruments get redrawn). */
  get inside() { const w = this.e?.walk; return !!w && ((w.mode === 'aircraft' && (this.mode === 'cockpit' || this.mode === 'copilot')) || (w.mode === 'foot' && !!w.inside)); }
  available(id) { const a = this.e.cargo.driven; if (!a) return true; return id !== 'wing' && id !== 'copilot'; }
  poseNow() { const c = this.e.camera; return { pos: c.position.clone(), quat: c.quaternion.clone(), fov: c.fov }; }
  get view() { return this.views[this.mode] ??= this.fresh(this.mode); }
  fresh(mode) {
    const c = (this.e?.cargo?.driven || this.e?.aircraft?.player)?.def.camera;
    return { yaw: 0, pitch: mode === 'orbit' && c ? Math.atan2(c.chaseHeight, c.chaseDist) : 0, zoom: 1 };
  }
  set(mode) {
    const i = this.modes.indexOf(mode); if (i < 0) return;
    this.blend = { ...this.poseNow(), t: 0 }; this.i = i; this.fb = null; this.idle = 99; this.views[mode] = this.fresh(mode);
    const a = this.e.cargo.driven || this.e.aircraft.player; if (a) { _f.set(0, 0, -1).applyQuaternion(a.quat); this.orbitAz = Math.atan2(-_f.x, -_f.z); }
    this.e.bus.emit('camera:mode', mode);
  }
  init(e) {
    this.e = e; const cv = e.renderer.domElement; cv.style.cursor = 'grab';
    e.bus.on('action', a => {
      if (a === 'camera') { if (e.walk.mode === 'foot') return; let n = this.i; do n = (n + 1) % this.modes.length; while (!this.available(this.modes[n])); this.set(this.modes[n]); e.bus.emit('hud:message', `Camera: ${CAMERA_MODES[this.i].label}`); }
      else if (a === 'cameraReset') this.reset();
    });
    cv.addEventListener('contextmenu', ev => ev.preventDefault());
    cv.addEventListener('dblclick', () => this.reset());
    cv.addEventListener('wheel', ev => { ev.preventDefault(); this.zoomBy(Math.exp(ev.deltaY * 0.0012)); }, { passive: false });
    cv.addEventListener('pointerdown', ev => { cv.setPointerCapture(ev.pointerId); this.ptr.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); cv.style.cursor = 'grabbing'; this.pinch = null; });
    cv.addEventListener('pointermove', ev => {
      const p = this.ptr.get(ev.pointerId); if (!p) return; const dx = ev.clientX - p.x, dy = ev.clientY - p.y; p.x = ev.clientX; p.y = ev.clientY;
      if (this.ptr.size === 1) this.look(dx, dy);
      else if (this.ptr.size === 2) { const [A, B] = [...this.ptr.values()], d = Math.hypot(A.x - B.x, A.y - B.y); if (this.pinch) this.zoomBy(this.pinch / Math.max(d, 1)); this.pinch = d; }
    });
    const up = ev => { this.ptr.delete(ev.pointerId); this.pinch = null; if (!this.ptr.size) cv.style.cursor = 'grab'; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    addEventListener('keydown', ev => { if (!document.body.classList.contains('menu-open')) this.keys.add(ev.code); });
    addEventListener('keyup', ev => this.keys.delete(ev.code));
    addEventListener('blur', () => this.keys.clear());
  }
  look(dx, dy) { if (this.e.walk.mode === 'foot') { const k = 0.0045 * this.e.settings.get('cameraSensitivity'); this.e.walk.look(-dx * k, -dy * k); return; } const v = this.view, k = 0.006 * this.e.settings.get('cameraSensitivity'); v.yaw += dx * k; v.pitch += dy * k; this.idle = 0; }
  zoomBy(f) { if (this.e.walk.mode === 'foot') { this.footDist = clamp(this.footDist * f, 1.6, 9); return; } const v = this.view; v.zoom = clamp(v.zoom * f, 0.3, 4); this.idle = 0; }
  reset() { this.views[this.mode] = this.fresh(this.mode); this.idle = 99; this.e.bus.emit('hud:message', 'View reset'); }
  /** Held keys + gamepad D-pad. */
  poll(dt) {
    const k = this.keys, h = (...c) => c.some(x => k.has(x)) ? 1 : 0, v = this.view;
    const g = (navigator.getGamepads?.() || [])[0], b = i => g?.buttons[i]?.pressed ? 1 : 0;
    const yaw = h('Comma', 'Numpad4') - h('Period', 'Numpad6') + b(14) - b(15), pit = h('Semicolon', 'Numpad8') - h('Slash', 'Numpad2') + b(12) - b(13), z = h('Minus', 'NumpadSubtract') - h('Equal', 'NumpadAdd');
    if (yaw || pit) { const r = 1.8 * this.e.settings.get('cameraSensitivity') * dt; v.yaw += yaw * r; v.pitch += pit * r; this.idle = 0; }
    if (z) this.zoomBy(Math.exp(z * dt * 1.4));
    const n5 = k.has('Numpad5'); if (n5 && !this._n5) this.reset(); this._n5 = n5;
    const r3 = !!b(11); if (r3 && !this._r3) this.reset(); this._r3 = r3;
  }
  update(dt) {
    const e = this.e, walk = e.walk, foot = walk.mode === 'foot', a = foot ? walk : (e.cargo.driven || e.aircraft.player); if (!a) return;
    const key = foot ? 'foot' : a; if (this.subjectKey !== key) { if (this.subjectKey) this.blend = { ...this.poseNow(), t: 0 }; this.subjectKey = key; this.follow.init = false; this.fb = null; if (!foot && !this.available(this.mode)) this.i = 0; }
    this.last = foot ? null : a; dt = Math.min(dt, 0.05); this.poll(dt); this.idle += dt;
    if (foot) { this.footCamera(dt); this.finish(dt, 70); return; }
    const player = e.aircraft.player; if (player) player.mesh.visible = !player.destroyed;
    const cam = e.camera, mode = this.mode, c = a.def.camera, s = e.settings, baseFov = s.get('fov'), size = Math.max(c.chaseDist * 0.5, 2), world = e.world;
    const v = this.view;
    if (e.paused && (mode === 'chase' || mode === 'orbit')) { v.yaw += dt * 0.2; this.idle = 0; } // slow showcase drift behind the menu
    const recentre = (mode === 'chase' || mode === 'cockpit' || mode === 'wing') && s.get('camRecenter') && this.idle > (mode === 'cockpit' ? 0.6 : 2.2);
    if (recentre) { const k = 1 - Math.exp(-dt * 2.5); v.yaw -= v.yaw * k; v.pitch -= v.pitch * k; }
    v.pitch = clamp(v.pitch, mode === 'cockpit' ? -1.2 : -0.5, mode === 'cockpit' ? 1.3 : 1.45);
    if (mode !== 'orbit' && mode !== 'cockpit') v.yaw = wrap(v.yaw);
    if (a !== e.aircraft.player) a.mesh.visible = true;

    _f.set(0, 0, -1).applyQuaternion(a.quat); const hdg = Math.atan2(-_f.x, -_f.z), fp = Math.asin(clamp(_f.y, -1, 1)), F = this.follow;
    if (!F.init) { F.yaw = hdg; F.pitch = fp * 0.45; F.init = true; }
    F.yaw = angDamp(F.yaw, hdg, 3.2, dt); F.pitch = damp(F.pitch, fp * 0.45, 2.5, dt);

    let fov = baseFov;
    if (mode === 'cockpit' || mode === 'copilot') {
      const eye = mode === 'copilot' && c.copilot ? c.copilot : c.eye; cam.position.set(eye.x, eye.y, eye.z).applyQuaternion(a.quat).add(a.pos);
      _l.setFromEuler(_e.set(v.pitch, v.yaw, 0)); cam.quaternion.copy(a.quat).multiply(_l); fov = baseFov * v.zoom;
    } else if (mode === 'wing' && c.wing) {
      cam.position.set(c.wing.x, c.wing.y, c.wing.z).applyQuaternion(a.quat).add(a.pos);
      _a.set(c.wing.look.x, c.wing.look.y, c.wing.look.z).applyQuaternion(a.quat).add(a.pos); _b.set(0, 1, 0).applyQuaternion(a.quat);
      _m.lookAt(cam.position, _a, _b); cam.quaternion.setFromRotationMatrix(_m); _l.setFromEuler(_e.set(-v.pitch * 0.7, v.yaw * 0.7, 0)); cam.quaternion.multiply(_l); fov = baseFov * v.zoom;
    } else if (mode === 'flyby' || mode === 'tower') {
      if (mode === 'flyby') this.flyby(a, size); else this.tower(a);
      cam.position.y = Math.max(cam.position.y, world.groundHeight(cam.position.x, cam.position.z) + 2.5);
      cam.up.copy(UP); cam.lookAt(a.pos);
      fov = clamp(2 * Math.atan(size * (mode === 'tower' ? 3.5 : 3.2) / Math.max(cam.position.distanceTo(a.pos), 10)) / D2R * v.zoom, mode === 'tower' ? 4 : 14, baseFov);
    } else { // chase / orbit (also the fallback for 'wing' on vehicles)
      const dist = Math.hypot(c.chaseDist, c.chaseHeight) * v.zoom, el0 = Math.atan2(c.chaseHeight, c.chaseDist);
      const az = (mode === 'orbit' ? this.orbitAz : F.yaw) - v.yaw, el = clamp(mode === 'orbit' ? v.pitch : el0 - F.pitch + v.pitch, -0.3, 1.5);
      _a.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)).multiplyScalar(dist);
      cam.position.copy(a.pos).add(_a); cam.position.y = Math.max(cam.position.y, world.groundHeight(cam.position.x, cam.position.z) + 2.5);
      cam.up.copy(UP); cam.lookAt(_b.copy(a.pos).addScaledVector(UP, c.chaseHeight * 0.18));
    }
    this.shake(dt, a, mode === 'cockpit' || mode === 'copilot' ? 1 : 0.4); this.finish(dt, fov);
  }
  /** Turbulence / rough-ground shake, applied in camera space. */
  shake(dt, a, k) {
    const e = this.e, cam = e.camera, amp = e.settings.get('cameraShake') * k * (0.012 * (e.env.intensity || 0) + 0.5 * Math.abs(a.bump || 0)); if (amp < 1e-4) return; const t = e.time;
    _a.set(Math.sin(t * 37) * amp, Math.sin(t * 29 + 1) * amp, 0).applyQuaternion(cam.quaternion); cam.position.add(_a); _l.setFromEuler(_e.set(Math.sin(t * 17) * amp * 0.6, 0, Math.sin(t * 23 + 2) * amp * 0.9)); cam.quaternion.multiply(_l);
  }
  /** Blend from the previous viewpoint after a seat / mode / subject change, then apply FOV. */
  finish(dt, fov) {
    const cam = this.e.camera; this.fov = damp(this.fov, fov, 8, dt);
    if (this.blend) { const b = this.blend; b.t = Math.min(1, b.t + dt / 0.7); const k = b.t * b.t * (3 - 2 * b.t); cam.position.lerpVectors(b.pos, cam.position, k); cam.quaternion.slerpQuaternions(b.quat, cam.quaternion, k); this.fov = THREE.MathUtils.lerp(b.fov, this.fov, k); if (b.t >= 1) this.blend = null; }
    if (Math.abs(cam.fov - this.fov) > 0.01) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
  /** First / third person view of the walking pilot. */
  footCamera(dt) {
    const e = this.e, w = e.walk, cam = e.camera, eye = w.eye(_a);
    if (!w.third) { cam.position.copy(eye); cam.quaternion.setFromEuler(_e.set(w.pitch, w.yaw, 0)); }
    else { _f.set(-Math.sin(w.yaw) * Math.cos(w.pitch), Math.sin(w.pitch), -Math.cos(w.yaw) * Math.cos(w.pitch)); _b.copy(w.pos).setY(w.pos.y + 1.5); cam.position.copy(_b).addScaledVector(_f, -this.footDist).add(_m2.set(0, 0.35, 0)); cam.position.y = Math.max(cam.position.y, e.world.groundHeight(cam.position.x, cam.position.z) + 0.4); cam.up.copy(UP); cam.lookAt(_b); }
    this.shake(dt, { bump: 0 }, 0);
  }
  /** Fixed trackside camera; jumps ahead of the aircraft again once it has gone past. */
  flyby(a, size) {
    const sp = a.vel.length(); let place = !this.fb;
    if (this.fb) { _a.copy(this.fb).sub(a.pos); const d = _a.length(); if (d > 900 || (sp > 8 && _a.dot(_b.copy(a.vel).normalize()) < -60 && d > 150)) place = true; }
    if (place) {
      const dir = sp > 5 ? _b.copy(a.vel).setY(0).normalize() : _b.set(-Math.sin(this.follow.yaw), 0, -Math.cos(this.follow.yaw));
      const ahead = sp > 5 ? clamp(sp * 4.5, 140, 650) : size * 4, side = (Math.random() < 0.5 ? -1 : 1) * Math.max(size * 3, 45);
      const p = (this.fb ??= new THREE.Vector3()).copy(a.pos).addScaledVector(dir, ahead); p.x += -dir.z * side; p.z += dir.x * side;
      const g = this.e.world.groundHeight(p.x, p.z); p.y = a.pos.y > g + 80 ? a.pos.y - 8 : clamp(a.pos.y - 3, g + 4, g + 60);
    }
    this.e.camera.position.copy(this.fb);
  }
  /** Tower sits beside the runway of the nearest airport. */
  tower(a) {
    const aps = this.e.world.cfg.airports; let best = aps[0], bd = Infinity;
    for (const p of aps) { const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z); if (d < bd) { bd = d; best = p; } }
    const r = best.heading * D2R, off = best.width / 2 + 90;
    this.e.camera.position.set(best.x + Math.cos(r) * off, best.elev + 22, best.z + Math.sin(r) * off);
  }
}
