// node tests/collision.mjs : pure unit tests (no browser, no jsdom) for the static collider registry and the per-zone damage model.
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { Colliders } from '../src/world/Colliders.js';
import { DamageSystem } from '../src/systems/DamageSystem.js';
import { EventBus } from '../src/core/EventBus.js';

const out = { nx: 0, ny: 0, nz: 0, pen: 0, item: null };

// ---- boxes: the face a point is moving into is the one it is pushed out of
{
  const c = new Colliders(); c.addBox({ x: 100, z: 50, c: 1, s: 0, hw: 10, hl: 5, y0: 0, y1: 8, kind: 'building' });
  assert.ok(c.test(100, 3, 50, 0, 0, 0, out), 'centre is inside'); assert.ok(!c.test(100, 9, 50, 0, 0, 0, out), 'above the roof is outside'); assert.ok(!c.test(111, 3, 50, 0, 0, 0, out), 'outside in x');
  assert.ok(c.test(109, 3, 50, -30, 0, 0, out), 'near the +x face'); assert.equal(out.nx, 1, 'pushed out through +x'); assert.ok(Math.abs(out.pen - 1) < 1e-9);
  assert.ok(c.test(100, 3, 54, 0, 0, -30, out), 'near the +z face'); assert.equal(out.nz, 1);
  assert.ok(c.test(100, 7.5, 50, 0, -10, 0, out)); assert.equal(out.ny, 1, 'coming down onto the roof lands on it'); assert.equal(out.item.kind, 'building');
  // a fast probe that ends up deeper in x than z, but is moving along -z, is pushed out of the z face it came through
  assert.ok(c.test(100, 3, 53.5, 0, 0, -60, out)); assert.equal(out.nz, 1);
}

// ---- cylinders and trees
{
  const c = new Colliders(), t = c.addCyl({ x: 0, z: 0, r: 2, y0: 0, y1: 20, kind: 'tower' });
  assert.ok(c.test(1, 5, 0, -5, 0, 0, out)); assert.ok(Math.abs(out.nx - 1) < 1e-9 && Math.abs(out.pen - 1) < 1e-9); assert.ok(!c.test(2.1, 5, 0, 0, 0, 0, out));
  t.dead = true; assert.ok(!c.test(1, 5, 0, 0, 0, 0, out), 'a knocked-down tree is no longer solid');
  assert.equal(c.count, 1); c.remove(t); assert.equal(c.count, 0); assert.equal(c.cells.size, 0, 'removal frees the cells');
}

// ---- frames: colliders must sit exactly where the meshes are drawn
{ // airport frame: a Group at the airport, rotated by -heading, mesh at local (lx, lz)
  const ox = 1200, oz = -800, heading = 37 * Math.PI / 180, rotY = -heading, lx = 40, lz = -105, w = 8, l = 20, c = new Colliders();
  c.addLocalBox(ox, oz, rotY, lx, lz, w, l, 0, 12);
  const g = new THREE.Group(); g.position.set(ox, 0, oz); g.rotation.y = rotY; g.updateMatrixWorld(true);
  const at = (dx, dz) => g.localToWorld(new THREE.Vector3(lx + dx, 3, lz + dz));
  for (const [dx, dz, inside] of [[0, 0, true], [w / 2 - 0.2, 0, true], [w / 2 + 0.2, 0, false], [0, l / 2 - 0.2, true], [0, l / 2 + 0.2, false], [-w / 2 + 0.2, -l / 2 + 0.2, true], [w / 2 + 0.2, l / 2 + 0.2, false]]) {
    const p = at(dx, dz); assert.equal(c.test(p.x, p.y, p.z, 0, 0, 0, out), inside, `airport-local point (${dx}, ${dz})`);
  }
  const k = new Colliders(); k.addLocalCyl(ox, oz, rotY, lx, lz, 3, 0, 30); const p = at(2.5, 0); assert.ok(k.test(p.x, 5, p.z, 0, 0, 0, out), 'local cylinder'); const q = at(3.5, 0); assert.ok(!k.test(q.x, 5, q.z, 0, 0, 0, out));
}
{ // town buildings: instance matrix = rotation about Y by -a, scale (w, h, l): width axis is (cos a, sin a)
  const a = 0.6, w = 14, l = 9, x = 300, z = 400, c = new Colliders(); c.addBox({ x, z, c: Math.cos(a), s: Math.sin(a), hw: w / 2, hl: l / 2, y0: 0, y1: 10 });
  const m = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(1, 1, 1));
  for (const [lx, lz, inside] of [[w / 2 - 0.2, 0, true], [w / 2 + 0.2, 0, false], [0, l / 2 - 0.2, true], [0, l / 2 + 0.2, false]]) {
    const p = new THREE.Vector3(lx, 3, lz).applyMatrix4(m); assert.equal(c.test(p.x, p.y, p.z, 0, 0, 0, out), inside, `town box local (${lx}, ${lz})`);
  }
}

// ---- damage model
const bus = new EventBus(), msgs = []; bus.on('hud:message', m => msgs.push(m));
const e = { bus, scene: new THREE.Scene(), world: { groundHeight: () => 0 }, aircraft: { list: [] } }, dmg = new DamageSystem(); dmg.init(e);
const mk = () => ({ dmg: { engine: 1, wingL: 1, wingR: 1, tail: 1, gear: 1, body: 1 }, eff: { pitch: 1, roll: 1, yaw: 1 }, controls: { gearDown: true }, mesh: { visible: true, userData: { parts: { wings: [], aileronL: null, aileronR: null, tail: null } } },
  def: { flight: { crashSink: 4, gearHeight: 1 }, liveries: [{ body: 0xffffff }] }, livery: 0, vel: new THREE.Vector3(30, 0, 0), pos: new THREE.Vector3(), liftScale: 1, rollBias: 0, thrustScale: 1, dragExtra: 0, lostAileron: 0, kick: 0, destroyed: false, gearDamaged: false });

{ const ac = mk(); dmg.hit(ac, { speed: 8, part: 'wingL', kind: 'tree' });
  assert.ok(ac.dmg.wingL < 1 && ac.dmg.wingL > 0.75, 'a tree at 8 m/s dents the wing: ' + ac.dmg.wingL); assert.ok(!ac.destroyed); assert.ok(ac.liftScale < 1 && ac.liftScale > 0.9); assert.ok(ac.rollBias > 0, 'left wing weaker rolls left (+z = right wing up)'); }
{ const ac = mk(); dmg.hit(ac, { speed: 1.2, part: 'nose', kind: 'building' }); assert.deepEqual(ac.dmg, mk().dmg, 'bumps below 1.5 m/s do nothing'); }
{ const ac = mk(); dmg.apply(ac, 'wingL', 3); assert.equal(ac.dmg.wingL, 0); assert.ok(Math.abs(ac.liftScale - 0.5) < 1e-9); assert.ok(Math.abs(ac.rollBias - 1.5) < 1e-9, 'same sign as the old model'); assert.ok(Math.abs(ac.eff.roll - 0.3) < 1e-9); assert.ok(msgs.includes('Left wing separated!')); }
{ const ac = mk(); dmg.apply(ac, 'nose', 3); assert.equal(ac.dmg.engine, 0); assert.equal(ac.thrustScale, 0, 'dead engine, no thrust'); assert.ok(ac.dragExtra > 0); }
{ const ac = mk(); dmg.apply(ac, 'tail', 3); assert.equal(ac.eff.pitch, 0); assert.equal(ac.eff.yaw, 0); }
{ const ac = mk(); dmg.hit(ac, { speed: 6, part: 'gear', kind: 'ground' }); assert.ok(ac.gearDamaged, 'a hard landing damages the gear'); assert.ok(ac.dmg.gear < 0.7 && ac.dmg.gear > 0.2); assert.ok(!ac.destroyed); }
{ const ac = mk(); dmg.apply(ac, 'gear', 3); assert.equal(ac.controls.gearDown, false, 'collapsed gear folds'); }
{ const ac = mk(); dmg.hit(ac, { speed: 16, part: 'gear', kind: 'ground' }); assert.ok(ac.destroyed, '3.6x the sink tolerance destroys it'); }
{ const ac = mk(); dmg.hit(ac, { speed: 22, part: 'nose', kind: 'building' }); assert.ok(ac.destroyed, 'head-on into a building at 22 m/s'); assert.equal(ac.mesh.visible, false); }
{ const ac = mk(); dmg.hit(ac, { speed: 30, part: 'nose', kind: 'tree' }); assert.ok(!ac.destroyed, 'a single tree does not total the aircraft'); assert.ok(ac.dmg.engine < 0.6); }
{ const ac = mk(); for (let i = 0; i < 600 && !ac.destroyed; i++) dmg.scrape(ac, 'wingR', 30, 1 / 60); assert.ok(ac.dmg.wingR < 1, 'grinding along the ground wears the wing'); }
console.log('collision + damage unit tests passed');
