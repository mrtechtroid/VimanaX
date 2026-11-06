// node tests/pfd-render.mjs  -> /tmp/pfd-*.png  (needs `npm i canvas`)
import { createCanvas } from 'canvas';
import fs from 'node:fs';
import { PFD } from '../src/ui/PFD.js';
const mk = (o) => ({ pitch: 0.09, roll: 0.35, hdg: 187, spd: 34, spdUnit: 'kt', spdK: 1.943844, gs: 33, alt: 420, altUnit: 'ft', altK: 3.28084, agl: 180, vs: 2.4, vsText: '+472 fpm', aoaFrac: 0.55,
  bands: { vs0: 22, vs1: 25.1, vfeLast: 36.3, vfeCur: 43.2 }, flapIdx: 2, brg: 205, stall: false, onGround: false, time: 0, ...o });
const out = [['cruise', mk({ spd: 45, pitch: 0.02, roll: -0.1, aoaFrac: .3 })], ['approach', mk({ spd: 31, pitch: -0.05, roll: 0.05, vs: -2.2, vsText: '-433 fpm', agl: 55, aoaFrac: .7 })], ['stall', mk({ spd: 21, pitch: 0.3, roll: 0.6, aoaFrac: 1.1, stall: true, vs: -6, vsText: '-1181 fpm' })]];
for (const [n, s] of out) { const cv = createCanvas(920, 600); cv.getBoundingClientRect = () => ({ width: 460 }); const p = new PFD(cv); p.draw(s); fs.writeFileSync(`/tmp/pfd-${n}.png`, cv.toBuffer('image/png')); }
console.log('rendered');
