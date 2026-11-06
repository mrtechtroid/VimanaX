import * as THREE from 'three';
import { render, VIEWS3 } from './preview.mjs';
import light from '../src/aircraft/definitions/lightProp.js';
const m = light.buildMesh(light.liveries[0]);
render(m, VIEWS3, '/tmp/shots/skylark.png', { size: 640 }); console.log('parts', Object.keys(m.userData.parts).join(','), 'doors', m.userData.parts.doors.length);
