import * as THREE from 'three';
import { PFD } from '../ui/PFD.js';
import { instrumentState } from '../instruments/state.js';
import { steamPanel } from '../instruments/Gauges.js';

const std = (c, r = 0.85, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const bx = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };

/** Transport "engine page": N1 bars, config, payload. */
function mfd(g, W, H, s, ac) {
  g.fillStyle = '#071017'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(200,230,240,.3)'; g.lineWidth = 2; g.strokeRect(2, 2, W - 4, H - 4);
  g.font = '700 16px "B612", sans-serif'; g.fillStyle = '#8da9ad'; g.textAlign = 'left'; g.fillText('ENGINES', 14, 26); g.fillText('CONFIG', 250, 26);
  for (let i = 0; i < 4; i++) { const x = 34 + i * 52, v = ac.destroyed ? 0 : Math.max(0.12, s.throttle) * 100; g.fillStyle = '#16262e'; g.fillRect(x, 44, 26, 150); g.fillStyle = v > 95 ? '#ffbd45' : '#62e38f'; g.fillRect(x, 194 - 1.5 * v, 26, 1.5 * v); g.fillStyle = '#e8f2f0'; g.textAlign = 'center'; g.font = '700 14px "B612 Mono", monospace'; g.fillText(Math.round(v), x + 13, 214); g.fillStyle = '#8da9ad'; g.fillText('N' + (i + 1), x + 13, 236); }
  g.textAlign = 'left'; g.font = '14px "B612", sans-serif'; g.fillStyle = '#8da9ad'; g.fillText('FLAPS', 250, 56); g.fillText('GEAR', 250, 110); g.fillText('RAMP', 250, 160); g.fillText('PAYLOAD', 250, 210);
  g.font = '700 22px "B612 Mono", monospace'; g.fillStyle = '#62e38f'; g.fillText(['0', '15', '30', '50'][s.flapIdx] ?? s.flapIdx, 250, 84); g.fillStyle = s.gearPos > 0.99 ? '#62e38f' : s.gearPos < 0.01 ? '#8da9ad' : '#ff5d5a'; g.fillText(s.gearPos > 0.99 ? 'DOWN' : s.gearPos < 0.01 ? 'UP' : 'TRANSIT', 250, 138);
  g.fillStyle = ac.rampPos > 0.02 ? '#58d6ff' : '#8da9ad'; g.fillText(ac.rampPos > 0.99 ? 'OPEN' : ac.rampPos > 0.02 ? 'MOVING' : 'CLOSED', 250, 188); g.fillStyle = '#e8f2f0'; g.font = '700 18px "B612 Mono", monospace'; g.fillText(`${Math.round(ac.mass - ac.def.flight.mass)} kg`, 250, 236);
  if (ac.jatoLeft > 0) { g.fillStyle = '#ffbd45'; g.fillText(`JATO ${Math.ceil(ac.jatoLeft)}s`, 340, 84); }
}

/**
 * Interior group (seats, panels, yokes, levers; transport also gets the cargo bay) + `update(ac, e, dt, viewing)`.
 * Instruments are CanvasTextures drawn only while someone is actually looking at them (cockpit / copilot / walking inside).
 */
export function buildCockpit(sp, l) {
  const group = new THREE.Group(), plastic = std(0x2a2c2f, 0.8), fabric = std(sp.kind === 'glass' ? 0x3d4a3a : 0x3a3f4a, 0.95, 0), metal = std(0x9aa0a6, 0.35, 0.9), black = std(0x111213, 0.6, 0.2);
  const parts = { yokes: [], levers: {}, screens: [], texs: [] }, L = sp.floorY, B = sp.bounds;
  group.add(bx(B.x * 2, 0.04, B.z1 - B.z0, std(0x3b3d3a, 1), 0, L - 0.02, (B.z0 + B.z1) / 2));
  for (const s of sp.seats) {
    const seat = new THREE.Group(); seat.position.set(s.x, s.y, s.z); seat.add(bx(0.46, 0.1, 0.46, fabric, 0, 0, 0)); const back = bx(0.44, 0.6, 0.09, fabric, 0, 0.32, 0.23); back.rotation.x = -0.12; seat.add(back, bx(0.2, 0.18, 0.08, fabric, 0, 0.68, 0.27), bx(0.1, s.y - L, 0.1, black, 0, -(s.y - L) / 2, 0)); group.add(seat);
  }
  if (sp.rear) { group.add(bx(sp.rear.w, 0.12, 0.5, fabric, 0, sp.rear.y, sp.rear.z)); const rb = bx(sp.rear.w, 0.55, 0.1, fabric, 0, sp.rear.y + 0.32, sp.rear.z + 0.28); rb.rotation.x = -0.1; group.add(rb); }

  const P = sp.panel, glass = sp.kind === 'glass', pz = P.z;
  const panelBoard = bx(P.w + 0.1, P.h + 0.16, 0.06, plastic, 0, P.y, pz - 0.04); panelBoard.rotation.x = -0.35; group.add(panelBoard);
  const shield = bx(P.w + 0.1, 0.07, 0.3, black, 0, P.y + P.h / 2 + 0.1, pz - 0.14); group.add(shield);
  const dark = new THREE.MeshBasicMaterial({ color: 0x0b0f12, toneMapped: false });
  if (!glass) { const m = new THREE.Mesh(new THREE.PlaneGeometry(P.w, P.h), dark.clone()); m.position.set(0, P.y, pz); m.rotation.x = -0.35; group.add(m); parts.screens.push({ mesh: m, kind: 'steam', w: 1024, h: Math.round(1024 * P.h / P.w) }); }
  else for (const [i, k] of ['pfd', 'mfd', 'pfd'].entries()) { const sw = 0.5, sh = sw * 300 / 460, m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), dark.clone()); m.position.set((i - 1) * 0.6, P.y, pz); m.rotation.x = -0.35; group.add(m); parts.screens.push({ mesh: m, kind: k, w: 460, h: 300, seat: i === 0 ? 0 : 1 }); }
  // yokes (move with roll / pitch)
  for (const s of sp.seats) {
    const y = new THREE.Group(), base = { x: s.x, y: P.y - 0.14, z: pz + 0.46 }; y.position.set(base.x, base.y, base.z); y.userData.base = base;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), metal); shaft.rotation.x = Math.PI / 2; shaft.position.z = -0.25; y.add(shaft);
    const R = glass ? 0.17 : 0.14, rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.016, 8, 24, Math.PI * 1.5), black); rim.rotation.z = Math.PI * 0.75; y.add(rim); y.add(bx(R * 2, 0.025, 0.025, black, 0, 0, 0));
    group.add(y); parts.yokes.push(y);
  }
  // centre pedestal with throttle / flap / gear levers
  const ped = bx(0.22, 0.18, 0.7, plastic, 0, L + 0.12, pz + 0.75); group.add(ped); const lever = (x, col, len = 0.16) => { const g = new THREE.Group(), k = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), std(col, 0.5)); k.position.y = len; g.add(bx(0.012, len, 0.012, metal, 0, len / 2, 0), k); g.position.set(x, L + 0.21, pz + 0.75); return g; };
  parts.levers.throttle = lever(0.0, 0x111111, 0.17); parts.levers.flaps = lever(0.06, 0x3a6ea8, 0.12); parts.levers.gear = lever(-0.06, 0x7a7a7a, 0.12); group.add(parts.levers.throttle, parts.levers.flaps, parts.levers.gear);

  if (glass) { // flight-deck bulkhead + cargo bay furniture
    const wall = std(0x6d725d, 0.95), strip = new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), z0 = sp.bay.z0, z1 = sp.bay.z1, hw = sp.bay.halfW;
    group.add(bx(0.5, 3.4, 0.08, wall, -1.28, 0.7, z0 - 0.4), bx(0.5, 3.4, 0.08, wall, 1.28, 0.7, z0 - 0.4), bx(1.4, 1.2, 0.08, wall, 0, 1.6, z0 - 0.4));
    group.add(bx(1.2, 0.02, z1 - z0, std(0x2f3331, 1), 0, L + 0.0, (z0 + z1) / 2)); for (const x of [-0.9, 0.9]) group.add(bx(0.07, 0.04, z1 - z0, metal, x, L + 0.03, (z0 + z1) / 2)); for (const x of [-0.4, 0.4]) group.add(bx(0.03, 0.03, z1 - z0, black, x, L + 0.03, (z0 + z1) / 2));
    for (let z = z0 + 0.8; z < z1 - 3.5; z += 1.15) for (const sg of [-1, 1]) { group.add(bx(0.45, 0.07, 0.8, std(0xa8421f, 0.9), sg * (hw - 0.22), L + 0.5, z), bx(0.06, 0.45, 0.8, std(0xa8421f, 0.9), sg * (hw - 0.03), L + 0.78, z)); }
    for (let z = z0 + 2; z < z1; z += 3.2) group.add(bx(0.5, 0.03, 0.9, strip, 0, 1.78, z));
  } else group.add(bx(0.22, 0.015, 0.1, new THREE.MeshBasicMaterial({ color: 0xfff6e0 }), 0, 0.97, 0.45));
  const light = new THREE.PointLight(0xffe9c8, 0, sp.kind === 'glass' ? 14 : 4, 1.5); light.position.set(0, glass ? 1.4 : 0.8, glass ? -10 : 0.2); group.add(light); parts.light = light;
  group.traverse(o => { if (o.isMesh) o.receiveShadow = true; });

  let timer = 0, ctx = null, pfds = [], tex = [];
  const ensure = () => {
    if (ctx || typeof document === 'undefined') return; ctx = [];
    for (const sc of parts.screens) { const cv = document.createElement('canvas'); cv.width = sc.w; cv.height = sc.h; const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; sc.mesh.material = new THREE.MeshBasicMaterial({ map: t, toneMapped: false }); sc.cv = cv; sc.g = cv.getContext('2d'); sc.t = t; if (sc.kind === 'pfd') sc.pfd = new PFD(cv); }
  };
  return { group, parts, update(ac, e, dt, viewing) {
    const c = ac.controls; parts.yokes.forEach(y => { y.rotation.z = -c.roll * 0.9; y.position.z = y.userData.base.z + c.pitch * 0.07; });
    parts.levers.throttle.rotation.x = -c.throttle * 0.9 + 0.35; parts.levers.flaps.rotation.x = -(ac.flapPos) * 0.9 + 0.3; parts.levers.gear.rotation.x = c.gearDown ? -0.3 : 0.5;
    const night = e?.env ? Math.max(0, 1 - Math.sin(Math.PI * (e.env.hour - 6) / 12 + 0.3) * 1.6) : 0; parts.light.intensity = viewing ? Math.min(1, night) * 0.9 : 0;
    if (!viewing) return; ensure(); timer -= dt; if (timer > 0 || !ctx) return; timer = 1 / 24;
    const s = instrumentState(e, ac); s.time = e.time; const K = 1.943844, FT = 3.28084, st = { ...s, spdUnit: 'kt', spdK: K, altUnit: 'ft', altK: FT, vsText: `${s.fpm >= 0 ? '+' : ''}${Math.round(s.fpm)} fpm`, brg: null, stall: false };
    for (const sc of parts.screens) {
      if (sc.kind === 'steam') steamPanel(sc.g, sc.w, sc.h, s); else if (sc.kind === 'pfd') sc.pfd.draw(st); else mfd(sc.g, sc.w, sc.h, s, ac); sc.t.needsUpdate = true;
    }
  } };
}
