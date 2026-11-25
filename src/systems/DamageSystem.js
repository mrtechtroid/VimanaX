import * as THREE from 'three';
import { disposeTree } from '../aircraft/Aircraft.js';
const R = () => Math.random() - 0.5;
const _v = new THREE.Vector3(), _vv = new THREE.Vector3();

export const ZONES = ['engine', 'wingL', 'wingR', 'tail', 'gear', 'body'];
/** How an impact on one part is shared between zones (fraction of the severity each zone absorbs). */
const SPREAD = {
  gear: { gear: 1, body: 0.3, wingL: 0.12, wingR: 0.12 },
  nose: { engine: 1, body: 0.45, gear: 0.15 },
  wingL: { wingL: 1, body: 0.25 }, wingR: { wingR: 1, body: 0.25 },
  tail: { tail: 1, body: 0.3 },
  body: { body: 1, engine: 0.2, wingL: 0.1, wingR: 0.1 },
};
/** How unforgiving each kind of obstacle is (multiplies severity). Trees give way, towers do not. */
const KIND = { ground: 1, terrain: 1.15, water: 0.7, building: 1.5, tower: 1.7, tank: 1.3, tree: 0.45,
  aircraft: 1.4, vehicle: 1.25, crate: 0.5, walker: 0.3, windsock: 0.5, papi: 0.7, dock: 1.1, buoy: 0.6 };
/** Announcements by zone and level: 0 damaged (< 70 %), 1 badly damaged (< 30 %), 2 gone. */
const MSG = {
  engine: ['Engine damaged', 'Engine badly damaged', 'Engine failure!'],
  wingL: ['Left wing damaged', 'Left wing badly damaged', 'Left wing separated!'], wingR: ['Right wing damaged', 'Right wing badly damaged', 'Right wing separated!'],
  tail: ['Tail damaged', 'Tail badly damaged', 'Tail separated!'], gear: ['Landing gear damaged', 'Landing gear badly damaged', 'Landing gear collapsed!'], body: ['Airframe damaged', 'Airframe badly damaged', ''],
};
const level = x => x <= 0 ? 3 : x < 0.3 ? 2 : x < 0.7 ? 1 : 0;

/**
 * Per-zone damage model. Every aircraft carries `dmg` = { engine, wingL, wingR, tail, gear, body } (1 intact .. 0 gone).
 * Anything that hits something emits 'aircraft:impact' { ac, speed, part, kind } (FlightModel for wheels, CollisionSystem for the rest);
 * the severity comes from the approach speed, the obstacle (KIND) and the aircraft's crash tolerance, is shared between zones (SPREAD),
 * and the zones then drive the flight model: lift and roll bias from the wings, control authority from tail and wings, thrust from the engine,
 * extra drag, gear collapse. Parts separate when their zone reaches 0; a damaged engine smokes and then burns; a destroyed aircraft leaves a burning wreck.
 */
export class DamageSystem {
  constructor() { this.debris = []; this.wrecks = []; }
  init(e) {
    this.e = e; e.bus.on('aircraft:impact', ev => this.hit(ev.ac, ev));
    e.bus.on('action', a => { if (['reset', 'nextAircraft', 'nextLivery'].includes(a)) this.clear(); });
  }
  /** Drop all debris and wrecks and free GPU memory (every debris object is single-use). */
  clear() { for (const d of this.debris) { this.e.scene.remove(d.o); disposeTree(d.o); } this.debris = []; this.wrecks = []; this.e.fx?.clear(); }
  add(o, v, w) { this.debris.push({ o, v, w }); }
  shed(ac, obj) {
    if (!obj?.parent) return; this.e.scene.attach(obj);
    this.add(obj, ac.vel.clone().multiplyScalar(0.6).add(new THREE.Vector3(R() * 6, 2 + Math.random() * 5, R() * 6)), new THREE.Vector3(R(), R(), R()).multiplyScalar(5));
  }

  /** An impact. `part` is the airframe part that struck (nose, wingL, wingR, tail, body, gear), `kind` what it struck. */
  hit(ac, { speed, part = 'gear', kind = 'ground' }) {
    if (ac.destroyed) return; const f = ac.def.flight; let sev;
    if (part === 'gear' && kind === 'ground') { // a hard landing, measured against the aircraft's sink tolerance
      const r = speed / f.crashSink; if (r >= 3.6) return this.destroy(ac); sev = Math.max(0, (r - 0.7) * 0.7);
    } else sev = Math.max(0, speed - 1.5) / (f.crashSink * 4.5) * (KIND[kind] ?? 1);
    if (sev <= 0) return;
    this.apply(ac, part, sev); if (ac.destroyed) return;
    if (sev >= 1.5 || ac.dmg.body <= 0) this.destroy(ac); // a hit this hard, or an airframe with nothing left, is the end
  }
  /** Slow wear from grinding along a wall or the ground. */
  scrape(ac, part, vt, dt) { if (!ac.destroyed) this.apply(ac, part, 0.12 * (vt / 10) * dt, true); if (!ac.destroyed && ac.dmg.body <= 0) this.destroy(ac); }

  apply(ac, part, sev, quiet = false) {
    const h = ac.dmg, before = { ...h }, sp = SPREAD[part] || SPREAD.body;
    for (const z in sp) h[z] = Math.max(0, h[z] - sev * sp[z] * (0.85 + Math.random() * 0.3));
    this.effects(ac, before, quiet);
  }

  /** Turn zone health into flight-model effects, shed parts that are gone, and announce what just got worse. */
  effects(ac, before, quiet = false) {
    const h = ac.dmg, P = ac.mesh.userData.parts, wing = x => x <= 0 ? 0 : 0.55 + 0.45 * x, wl = wing(h.wingL), wr = wing(h.wingR), tf = h.tail <= 0 ? 0 : 0.4 + 0.6 * h.tail;
    // ailerons go before the wing does
    for (const [z, key] of [['wingL', 'aileronL'], ['wingR', 'aileronR']]) if (h[z] < 0.6 && h[z] > 0 && P[key]?.parent && !P[key]._lost) { P[key]._lost = true; ac.lostAileron++; this.shed(ac, P[key]); }
    ac.liftScale = (wl + wr) / 2; ac.rollBias = (wr - wl) * 1.5;
    ac.eff.roll = (0.3 + 0.7 * Math.min(wl, wr)) * (1 - 0.35 * ac.lostAileron); ac.eff.pitch = ac.eff.yaw = tf;
    ac.thrustScale = h.engine <= 0 ? 0 : 0.3 + 0.7 * h.engine;
    ac.dragExtra = 0.025 * ((1 - wl) + (1 - wr)) + 0.03 * (1 - h.body) + (h.engine <= 0 ? 0.02 : 0);
    ac.gearDamaged = h.gear < 0.7; if (h.gear <= 0 && before.gear > 0) ac.controls.gearDown = false; // collapsed: it folds and the belly takes over
    if (h.wingL <= 0 && before.wingL > 0) this.shed(ac, P.wings?.[0]);
    if (h.wingR <= 0 && before.wingR > 0) this.shed(ac, P.wings?.[1]);
    if (h.tail <= 0 && before.tail > 0) this.shed(ac, P.tail);
    let worst = 0, text = ''; // announce the single most serious thing that changed
    for (const z of ZONES) { const a = level(before[z]), b = level(h[z]); if (b > a && b > worst && MSG[z][b - 1]) { worst = b; text = MSG[z][b - 1]; } }
    if (text && !(quiet && worst < 2)) this.e.bus.emit('hud:message', text);
  }

  destroy(ac) {
    if (ac.destroyed) return; ac.destroyed = true; ac.dmg.body = 0; ac.mesh.visible = false; ac.vel.set(0, 0, 0); const s = ac.def.flight.gearHeight;
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * (0.3 + Math.random()), s * (0.2 + Math.random() * 0.5), s * (0.3 + Math.random())), new THREE.MeshLambertMaterial({ color: i % 3 ? 0x333333 : ac.def.liveries[ac.livery].body }));
      m.position.copy(ac.pos).add(new THREE.Vector3(R() * s * 4, R() * s, R() * s * 4)); this.e.scene.add(m);
      this.add(m, new THREE.Vector3(R() * 14, 3 + Math.random() * 8, R() * 14), new THREE.Vector3(R(), R(), R()).multiplyScalar(8));
    }
    this.wrecks.push({ pos: ac.pos.clone(), t: 0 }); this.e.fx?.burst('fire', ac.pos, 14, 9); this.e.fx?.burst('ash', ac.pos, 10, 6);
    ac.kick = 1; this.e.bus.emit('aircraft:destroyed', { ac }); this.e.bus.emit('hud:message', 'Aircraft destroyed');
  }

  update(dt) {
    for (const d of this.debris) {
      if (d.rest) continue; d.v.y -= 9.81 * dt; d.o.position.addScaledVector(d.v, dt);
      d.o.rotation.x += d.w.x * dt; d.o.rotation.y += d.w.y * dt; d.o.rotation.z += d.w.z * dt;
      const gy = this.e.world.groundHeight(d.o.position.x, d.o.position.z);
      if (d.o.position.y < gy) { d.o.position.y = gy; d.v.set(d.v.x * 0.6, 0, d.v.z * 0.6); d.w.multiplyScalar(0.5); if (d.v.lengthSq() < 1) d.rest = true; }
    }
    const fx = this.e.fx; if (!fx) return;
    for (const ac of this.e.aircraft.list) { // a damaged engine smokes below 55 %, burns below 25 %
      const h = ac.dmg.engine; if (ac.destroyed || h >= 0.55) continue; const burn = h < 0.25;
      ac._smk = (ac._smk || 0) + (burn ? 28 : 10) * dt;
      while (ac._smk >= 1) {
        ac._smk -= 1; _v.set(R() * 0.4, 0.1, ac.bounds.min.z * 0.7).applyQuaternion(ac.quat).add(ac.pos);
        _vv.copy(ac.vel).multiplyScalar(0.85); fx.emit(burn ? 'ash' : 'smoke', _v, _vv); if (burn && Math.random() < 0.6) fx.emit('fire', _v, _vv.multiplyScalar(1.06));
      }
    }
    for (let i = this.wrecks.length - 1; i >= 0; i--) { // the wreck keeps burning for 40 s, fading out
      const w = this.wrecks[i]; w.t += dt; if (w.t > 40) { this.wrecks.splice(i, 1); continue; }
      w.acc = (w.acc || 0) + (1 - w.t / 40) * 14 * dt;
      while (w.acc >= 1) { w.acc -= 1; _v.set(w.pos.x + R() * 5, w.pos.y + Math.random() * 1.2, w.pos.z + R() * 5); fx.emit(Math.random() < 0.6 ? 'ash' : 'smoke', _v); if (Math.random() < 0.5 && w.t < 30) fx.emit('fire', _v); }
    }
  }
}
