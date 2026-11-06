import { createCanvas } from 'canvas'; import fs from 'node:fs'; import { steamPanel } from '../src/instruments/Gauges.js';
const cv = createCanvas(1024, 384), g = cv.getContext('2d');
steamPanel(g, 1024, 384, { kt: 78, pitch: 0.06, roll: 0.25, ft: 2450, hdg: 112, turn: 0.03, slip: 0.2, fpm: 520, rpm: 2300, throttle: 0.7, flapIdx: 1, gearPos: 1, bands: { vs0: 22, vs1: 25.1, vfeLast: 36.3 } });
fs.writeFileSync('/tmp/shots/steam.png', cv.toBuffer('image/png')); console.log('ok');
