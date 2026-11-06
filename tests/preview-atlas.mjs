import { render, VIEWS3 } from './preview.mjs';
import t from '../src/aircraft/definitions/transport.js';
const m = t.buildMesh(t.liveries[0]); render(m, VIEWS3, '/tmp/shots/atlas.png', { size: 640 }); console.log('doors', m.userData.parts.doors.map(d => d.id));
