import * as THREE from 'three';
import { Terrain } from '../src/world/Terrain.js';
import { TerrainRenderer } from '../src/world/TerrainRenderer.js';
import { Scenery } from '../src/world/Scenery.js';
import cfg from '../src/config/worldConfig.js';
let t = performance.now(); const lap = n => { const x = performance.now(); console.log(n.padEnd(28), Math.round(x - t), 'ms'); t = x; };
const T = new Terrain(cfg); lap('terrain build'); const scene = new THREE.Scene(); const R = new TerrainRenderer(T, scene); lap('renderer ctor (water,textures)');
R.update(new THREE.Vector3(0, 300, 1000), true); lap('initial chunks + trees (force)');
let n = 0; scene.traverse(o => { if (o.isInstancedMesh) n += o.count; }); console.log('tree instances', n, 'chunks', R.chunks.size);
const S = new Scenery(T, scene); lap('towns + roads'); console.log('roads', S.roads.length);
t = performance.now(); R.update(new THREE.Vector3(1800, 300, 1000)); lap('stream 1 step (budget)'); for (let i = 0; i < 8; i++) { const x = performance.now(); R.update(new THREE.Vector3(1800, 300, 1000)); const d = performance.now() - x; if (d > 2) console.log(' frame', i, d.toFixed(1), 'ms'); }
let tris = 0; scene.traverse(o => { if (o.isMesh && o.geometry.index) tris += o.geometry.index.count / 3 * (o.isInstancedMesh ? o.count : 1); }); console.log('triangles ~', (tris / 1e6).toFixed(2), 'M');
