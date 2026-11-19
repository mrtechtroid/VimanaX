// Prints world-space bounding boxes per node of a .glb using accessor min/max only (works on Draco files, no decoding, no canvas needed).
// usage: node tools/glb-nodes.mjs assets/models/aircraft/pa28.glb [filter]
import fs from 'node:fs';
import * as THREE from 'three';
const f = process.argv[2], flt = process.argv[3], b = fs.readFileSync(f);
const jl = b.readUInt32LE(12), json = JSON.parse(b.slice(20, 20 + jl).toString());
const nodes = json.nodes, boxes = new Map();
const M = n => { const m = new THREE.Matrix4(); if (n.matrix) m.fromArray(n.matrix); else m.compose(new THREE.Vector3(...(n.translation || [0, 0, 0])), new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(n.scale || [1, 1, 1]))); return m; };
const total = new THREE.Box3();
function walk(i, parent, path) {
  const n = nodes[i], w = parent.clone().multiply(M(n)), box = new THREE.Box3();
  if (n.mesh != null) for (const p of json.meshes[n.mesh].primitives) {
    let a = json.accessors[p.attributes.POSITION]; if (!a?.min) continue;
    const lo = new THREE.Vector3(...a.min), hi = new THREE.Vector3(...a.max);
    for (let k = 0; k < 8; k++) box.expandByPoint(new THREE.Vector3(k & 1 ? hi.x : lo.x, k & 2 ? hi.y : lo.y, k & 4 ? hi.z : lo.z).applyMatrix4(w));
  }
  for (const c of n.children || []) { const cb = walk(c, w, path + '/' + (n.name || i)); if (!cb.isEmpty()) box.union(cb); }
  n._box = box; n._path = path + '/' + (n.name || i);
  return box;
}
for (const r of json.scenes[json.scene ?? 0].nodes) { const bx = walk(r, new THREE.Matrix4(), ''); if (!bx.isEmpty()) total.union(bx); }
const fmt = v => v.toArray().map(x => x.toFixed(2)).join(',');
console.log('TOTAL min', fmt(total.min), 'max', fmt(total.max), 'size', fmt(total.getSize(new THREE.Vector3())));
nodes.forEach(n => { if (n._box && !n._box.isEmpty() && (!flt || n._path.toLowerCase().includes(flt.toLowerCase()))) console.log((n.name || '?').padEnd(22), 'min', fmt(n._box.min).padEnd(22), 'max', fmt(n._box.max).padEnd(22), n.mesh != null ? 'mesh' : ''); });
