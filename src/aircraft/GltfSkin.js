import * as THREE from 'three';

/**
 * glTF skin for an aircraft. A definition may declare
 *   model: { id, pos:[x,y,z], scale, parts: { aileronL, aileronR, flaps[], elevators[], rudder, gear[][], props[], blur }, lights[] }
 * where every part lists glTF node names (first one found wins per entry). Each part is re-parented under a hinge pivot
 * (front edge for control surfaces, hub for props, strut top for gear) so Aircraft.animate() drives it like the procedural parts.
 * Everything stays optional: if the model is missing the procedural airframe keeps flying.
 */
const _b = new THREE.Box3(), _c = new THREE.Vector3();
// Name -> node lookup is built once per model rig instead of traversing the whole 737 for every requested part.
let _nodes = new Map();
const findNode = (root, names) => { for (const n of [].concat(names || [])) { const f = _nodes.get(n); if (f) return f; } return null; };

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
  _nodes = new Map(); scene.traverse(o => { if (o.name && !_nodes.has(o.name)) _nodes.set(o.name, o); });
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
  // Doors: real door nodes become hinged panels driven by Aircraft.animate() (same record shape as AirframeBuilder's doors). `mirror: cx` clones the nodes across x = cx (the model only has one side).
  if (spec.doors) {
    out.doors = [];
    for (const d of spec.doors) {
      let objs = nodesOf(root, d.nodes); if (!objs.length) continue;
      if (d.mirror != null) { const w = new THREE.Group(); root.updateMatrixWorld(true); for (const n of objs) { const c = n.clone(true); n.matrixWorld.clone().decompose(c.position, c.quaternion, c.scale); w.add(c); } w.scale.x = -1; w.position.x = 2 * d.mirror; root.add(w); w.updateMatrixWorld(true); objs = [w]; }
      root.updateMatrixWorld(true); _b.makeEmpty(); objs.forEach(o => _b.expandByObject(o)); const pv = new THREE.Group();
      pv.position.set(d.side < 0 ? _b.min.x : _b.max.x, (_b.min.y + _b.max.y) / 2, d.hingeRear ? _b.max.z : _b.min.z); root.add(pv); pv.updateMatrixWorld(true); objs.forEach(o => pv.attach(o));
      out.doors.push({ id: d.id, label: d.label, pivot: pv, openAngle: d.open, at: d.at, in: d.in ?? null, enter: d.enter ?? null, pos: 0, target: 0, side: d.side });
    }
  }
  // Glass: the glTF 1.0 -> 2.0 conversion kept `transparent` but lost the alpha, so every window rendered as an opaque grey slab (the pilot saw nothing but glass).
  // Make it real glass, and register it so Aircraft.animate() can thin it further while the camera is inside (see `glassOpacity`).
  out.glass = []; const skip = new Set([P.blurNode, ...(P.hide || [])].filter(Boolean)), glassRe = spec.glassRe || /transp|glass|vitre|window|windshield|canopy|verre/i;
  root.traverse(o => { if (!o.isMesh || skip.has(o.name)) return; const ms = [].concat(o.material); ms.forEach((m, i) => { if (!m || !(glassRe.test(m.name || '') || glassRe.test(o.name))) return; if (/prop|blur|disc|lampe|light/i.test(o.name)) return;
    if (!m.userData.isGlass) { m = m.clone(); m.userData.isGlass = true; m.color = new THREE.Color(spec.glassColor ?? 0x9fb8c8); m.transparent = true; m.opacity = spec.glassOpacity ?? 0.32; m.depthWrite = false; m.side = THREE.DoubleSide; m.roughness = 0.08; m.metalness = 0.1; m.envMapIntensity = 1.2; out.glass.push(m); }
    if (Array.isArray(o.material)) o.material[i] = m; else o.material = m; o.renderOrder = 2; o.castShadow = false; }); });
  out.shell = []; root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) if (m && !m.transparent && !out.shell.includes(m) && !out.glass.includes(m)) out.shell.push(m); }); // hull skin: drawn double-sided while the camera is inside so the cabin has walls
  // finish: placement, scale, shadows, slightly glossier paint
  root.position.set(...(spec.pos || [0, 0, 0])); root.scale.setScalar(spec.scale || 1); root.rotation.y = spec.rotY || 0;
  root.traverse(o => { if (!o.isMesh) return; const glassy = [].concat(o.material).some(m => m?.transparent || m?.userData?.isGlass);
    o.castShadow = !glassy; o.receiveShadow = true; // glazing must not cast an opaque shadow (the pass above deliberately disabled it)
    for (const m of [].concat(o.material)) if (m && !m.transparent && m.roughness !== undefined) { m.roughness = Math.min(m.roughness, 0.6); m.metalness = Math.max(m.metalness, 0.05); } });
  return { root, parts: out };
}

/** Swap the procedural exterior of `ac` for the glTF model once it is available. Safe to call repeatedly. */
export function skinAircraft(ac, e) {
  const spec = ac.def.model; if (!spec || ac._skinned || !e.assets) return;
  const apply = () => {
    if (ac._skinned) return true; if (ac.dead) return true; // aircraft was replaced: nothing to attach to (returning true also unsubscribes)
    const inst = e.assets.instance(spec.id); if (!inst) return false;
    const { root, parts } = rigModel(inst.scene, spec), m = ac.mesh, keep = m.userData.cockpit?.group;
    for (const ch of m.children) if (ch !== keep && !ch.userData.keepSkinned) ch.visible = false;
    m.add(root); Object.assign(m.userData.parts, parts); ac._skinned = true; ac.skin = root; e.bus.emit('aircraft:skinned', ac); return true;
  };
  if (apply()) return;
  e.assets.load(spec.id);
  let offL, offF;
  const done = () => { offL?.(); offF?.(); }; // always unsubscribe: a failed (or superseded) load must not leak a listener on every respawn
  offL = e.bus.on?.('assets:loaded', id => { if (id === spec.id && apply()) done(); });
  offF = e.bus.on?.('assets:failed', id => { if (id === spec.id) { apply(); done(); } });
}
