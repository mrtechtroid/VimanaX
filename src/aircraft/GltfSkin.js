import * as THREE from 'three';

/**
 * glTF skin for an aircraft. A definition may declare
 *   model: { id, pos:[x,y,z], scale, parts: { aileronL, aileronR, flaps[], elevators[], rudder, gear[][], props[], blur }, lights[] }
 * where every part lists glTF node names (first one found wins per entry). Each part is re-parented under a hinge pivot
 * (front edge for control surfaces, hub for props, strut top for gear) so Aircraft.animate() drives it like the procedural parts.
 * Everything stays optional: if the model is missing the procedural airframe keeps flying.
 */
const _b = new THREE.Box3(), _c = new THREE.Vector3();
const findNode = (root, names) => { for (const n of [].concat(names || [])) { let f = null; root.traverse(o => { if (!f && o.name === n) f = o; }); if (f) return f; } return null; };

/** Wrap `objs` in a pivot Group at a hinge point of their combined box. how: 'front' | 'center' | 'top' | fraction of chord from the front. */
function pivot(root, objs, how = 'front') {
  objs = objs.filter(Boolean); if (!objs.length) return new THREE.Group();
  root.updateMatrixWorld(true); _b.makeEmpty(); objs.forEach(o => _b.expandByObject(o)); _b.getCenter(_c);
  const p = _c.clone(); if (how === 'front') p.z = _b.min.z; else if (how === 'top') p.y = _b.max.y; else if (typeof how === 'number') p.z = _b.min.z + how * (_b.max.z - _b.min.z);
  const pv = new THREE.Group(); pv.position.copy(p); pv.userData.box = _b.clone(); root.add(pv); pv.updateMatrixWorld(true); objs.forEach(o => pv.attach(o)); return pv;
}
const nodesOf = (root, entry) => [].concat(entry || []).map(n => findNode(root, n)).filter(Boolean);

export function rigModel(scene, spec) {
  const root = new THREE.Group(), P = spec.parts || {}; root.add(scene); root.updateMatrixWorld(true);
  const out = { aileronL: pivot(root, nodesOf(root, P.aileronL)), aileronR: pivot(root, nodesOf(root, P.aileronR)), rudder: pivot(root, nodesOf(root, P.rudder), 'front'), flaps: [], elevators: [], gear: [], props: [], propBlur: [], strobes: [] };
  for (const f of P.flaps || []) out.flaps.push(pivot(root, nodesOf(root, f)));
  for (const e of P.elevators || []) out.elevators.push(pivot(root, nodesOf(root, e), P.elevatorHinge ?? 'front'));
  for (const g of P.gear || []) { const n = nodesOf(root, g); if (!n.length) continue; if (spec.floats) n.forEach(o => { o.visible = false; }); else out.gear.push(pivot(root, n, 'top')); } // floatplanes: wheels are replaced by pontoons
  for (const pr of P.props || []) {
    const n = nodesOf(root, pr.nodes), pv = pivot(root, n, 'center'); out.props.push(pv);
    if (P.blurNode) continue; const r = pr.r ?? 1, disc = new THREE.Mesh(new THREE.CircleGeometry(r, 28), new THREE.MeshBasicMaterial({ color: 0x20242a, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); disc.position.copy(pv.position); root.add(disc); out.propBlur.push(disc);
  }
  for (const id of P.hide || []) for (const n of nodesOf(root, id)) n.visible = false;
  if (P.blurNode) { const n = findNode(root, P.blurNode); if (n) { n.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0; o.material.depthWrite = false; out.propBlur.push(o); } }); } }
  for (const l of spec.lights || []) { const m = new THREE.Mesh(new THREE.SphereGeometry(l.r || 0.07, 8, 6), new THREE.MeshBasicMaterial({ color: l.color ?? 0xffffff })); m.position.set(l.x, l.y, l.z); root.add(m); m.visible = false; out.strobes.push(m); }
  // finish: placement, scale, shadows, slightly glossier paint
  root.position.set(...(spec.pos || [0, 0, 0])); root.scale.setScalar(spec.scale || 1); root.rotation.y = spec.rotY || 0;
  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; for (const m of [].concat(o.material)) if (m && !m.transparent && m.roughness !== undefined) { m.roughness = Math.min(m.roughness, 0.6); m.metalness = Math.max(m.metalness, 0.05); } } });
  return { root, parts: out };
}

/** Swap the procedural exterior of `ac` for the glTF model once it is available. Safe to call repeatedly. */
export function skinAircraft(ac, e) {
  const spec = ac.def.model; if (!spec || ac._skinned || !e.assets) return;
  const apply = () => {
    if (ac._skinned) return true; const inst = e.assets.instance(spec.id); if (!inst) return false;
    const { root, parts } = rigModel(inst.scene, spec), m = ac.mesh, keep = m.userData.cockpit?.group;
    for (const ch of m.children) if (ch !== keep && !ch.userData.keepSkinned) ch.visible = false;
    m.add(root); Object.assign(m.userData.parts, parts); ac._skinned = true; ac.skin = root; e.bus.emit('aircraft:skinned', ac); return true;
  };
  if (apply()) return;
  e.assets.load(spec.id); const off = e.bus.on?.('assets:loaded', id => { if (id === spec.id && apply()) off?.(); });
}
