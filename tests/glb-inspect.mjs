import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import fs from 'node:fs';
import { render } from './preview.mjs';
globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close() {} }); globalThis.self = globalThis;
const load = (f) => new Promise((res, rej) => { const b = fs.readFileSync(f); new GLTFLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', res, rej); });
for (const [n, f] of [['truck', 'assets/models/CesiumMilkTruck.glb'], ['soldier', 'assets/models/Soldier.glb']]) {
  try {
    const gltf = await load(f), box = new THREE.Box3().setFromObject(gltf.scene), sz = box.getSize(new THREE.Vector3());
    console.log(n, 'size', sz.toArray().map(v => v.toFixed(2)), 'min', box.min.toArray().map(v => v.toFixed(2)), 'anims', gltf.animations.map(a => `${a.name}(${a.duration.toFixed(2)}s)`).join(','));
    gltf.scene.traverse(o => { if (o.isMesh && o.material) { o.material = o.material.clone?.() ?? o.material; } });
    render(gltf.scene, [{ name: n + ' side +X', dir: [1, 0, 0] }, { name: 'from +Z', dir: [0, 0.3, 1] }, { name: 'top', dir: [0, 1, 0], up: [0, 0, -1] }], `/tmp/shots/glb-${n}.png`, { size: 400 });
  } catch (e) { console.log(n, 'FAILED', e.message); }
}
