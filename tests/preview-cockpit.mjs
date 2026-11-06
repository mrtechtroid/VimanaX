import { render } from './preview.mjs'; import * as THREE from 'three';
import light from '../src/aircraft/definitions/lightProp.js'; import t from '../src/aircraft/definitions/transport.js';
for (const [d, n] of [[light, 'light'], [t, 'atlas']]) { const g = d.buildMesh(d.liveries[0]); const c = g.userData.cockpit.group; const eye = d.camera.eye;
  render(c, [{ name: 'interior side', dir: [1, 0, 0] }, { name: 'interior top', dir: [0, 1, 0], up: [0, 0, -1] }, { name: 'from behind', dir: [0.1, 0.35, 1] }], `/tmp/shots/cockpit-${n}.png`, { size: 520, bg: '#556' }); }
console.log('ok');
