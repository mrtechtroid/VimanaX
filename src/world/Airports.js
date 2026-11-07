import * as THREE from 'three';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, ...o });
const MATS = {
  asphalt: M(0x35373a), taxi: M(0x3d4044), apron: M(0x6c6e70, { roughness: 0.95 }), grass: M(0x5e9444, { roughness: 1 }), dirt: M(0x9a7b52, { roughness: 1 }),
  white: new THREE.MeshBasicMaterial({ color: 0xf2f2ee }), yellow: new THREE.MeshBasicMaterial({ color: 0xe8c630 }), wall: M(0xe9e6dc), glass: M(0x2b4a60, { roughness: 0.2, metalness: 0.6 }), roofRed: M(0x9a4a3a), roofGrey: M(0x7c8088, { metalness: 0.4, roughness: 0.6 }),
  steel: M(0xaab0b8, { metalness: 0.5, roughness: 0.5 }), tank: M(0xd8d8d0), orange: M(0xe85a1a), tw: M(0xd9d6cc),
};
let _prism; const prism = (w, h, l) => { const s = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, h)]), g = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: false }); g.translate(0, 0, -l / 2); return g; };
const box = (parent, w, h, l, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat); m.position.set(x, y + h / 2, z); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m; };
const pave = (parent, r, mat, y = 0) => box(parent, r.x1 - r.x0, 0.1, r.z1 - r.z0, mat, (r.x0 + r.x1) / 2, y - 0.05, (r.z0 + r.z1) / 2, false);

/** Layout in the airport-local frame: x = across (right of runway heading), z = behind the heading (runway spans z in [-L/2, L/2]). */
export function layoutAirport(a) {
  if (a.water) return { kind: 'water', paved: [], tier: 0, side: 1 };
  const L = a.length, W = a.width, kind = a.surface || 'asphalt', side = a.side || 1, paved = [{ x0: -W / 2, x1: W / 2, z0: -L / 2, z1: L / 2, kind }];
  const sx = (x0, x1) => side > 0 ? [x0, x1] : [-x1, -x0];
  if (kind !== 'asphalt') return { kind, paved, tier: 0, side };
  if (L >= 1000) {
    const tx = W / 2 + 62, [x0, x1] = sx(tx - 7.5, tx + 7.5);
    paved.push({ x0, x1, z0: -L / 2 + 70, z1: L / 2 - 70, kind: 'taxi' });
    for (const z of [-L / 2 + 75, 0, L / 2 - 75]) { const [a0, a1] = sx(W / 2, tx); paved.push({ x0: a0, x1: a1, z0: z - 7.5, z1: z + 7.5, kind: 'taxi' }); }
    const [p0, p1] = sx(tx + 8, tx + 82); paved.push({ x0: p0, x1: p1, z0: -110, z1: 110, kind: 'apron' });
    return { kind, paved, tier: 2, side, tx };
  }
  const [a0, a1] = sx(W / 2, W / 2 + 14), [p0, p1] = sx(W / 2 + 14, W / 2 + 64); paved.push({ x0: a0, x1: a1, z0: -6, z1: 6, kind: 'taxi' }, { x0: p0, x1: p1, z0: -34, z1: 34, kind: 'apron' });
  return { kind, paved, tier: 1, side };
}
/** Is local point (across, behind) on any paved rect? Returns the rect's kind or null. */
export function pavedAt(lay, lx, lz, margin = 0) { for (const r of lay.paved) if (lx >= r.x0 - margin && lx <= r.x1 + margin && lz >= r.z0 - margin && lz <= r.z1 + margin) return r.kind; return null; }

export function buildAirport(a, lay, scene) {
  if (a.water) return buildWaterBase(a, scene);
  const g = new THREE.Group(), L = a.length, W = a.width, kind = lay.kind, s = lay.side; g.position.set(a.x, a.elev + 0.06, a.z); g.rotation.y = -a.heading * Math.PI / 180;
  for (const r of lay.paved) pave(g, r, r.kind === 'asphalt' ? MATS.asphalt : r.kind === 'taxi' ? MATS.taxi : r.kind === 'apron' ? MATS.apron : MATS[r.kind] || MATS.asphalt, r.kind === 'apron' ? 0.01 : r.kind === 'taxi' ? 0.005 : 0.02);
  const lights = [];
  if (kind === 'asphalt') {
    for (const sd of [-1, 1]) box(g, 0.35, 0.04, L - 8, MATS.white, sd * (W / 2 - 0.9), 0.02, 0, false);
    for (let z = -L / 2 + 70; z < L / 2 - 50; z += 50) box(g, 0.9, 0.04, 28, MATS.white, 0, 0.03, z, false);
    for (const e of [-1, 1]) {
      const z0 = e * (L / 2 - 8); for (let i = 0; i < 8; i++) box(g, 1.5, 0.04, 28, MATS.white, (i - 3.5) * (W - 3) / 8, 0.03, z0 - e * 14, false);
      for (const d of L > 700 ? [150, 300, 450] : [150, 300]) for (const sd of [-1, 1]) for (let k = 0; k < (d === 150 ? 3 : d === 300 ? 2 : 1); k++) box(g, 1.2, 0.04, 22, MATS.white, sd * (W * 0.22 + k * 2.1), 0.03, e * (L / 2 - 8 - d), false);
      for (const sd of [-1, 1]) box(g, 3.2, 0.04, 40, MATS.white, sd * W * 0.3, 0.03, e * (L / 2 - 8 - 380), false);
      // approach lights + threshold lights
      for (let i = 1; i <= 12; i++) lights.push([0, e * (L / 2 + i * 30), 0xfff4d0, 1]); for (let k = -4; k <= 4; k++) lights.push([k * 3, e * (L / 2 + 1), e > 0 ? 0xff3030 : 0x30ff60, 1]);
      // PAPI: 4 lamp boxes left of the runway ~300 m in
      for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.4), new THREE.MeshBasicMaterial({ color: i < 2 ? 0xff3a2a : 0xfff4f0 })); m.position.set(-(W / 2 + 10 + i * 4), 0.6, e * (L / 2 - 300)); g.add(m); }
    }
    if (lay.tier === 2) for (const z of [-L / 2 + 70, L / 2 - 70]) for (let i = 0; i <= 10; i++) lights.push([s * (lay.tx - 7.5 + i * 1.5), z, 0x3070ff, 0.6]);
  }
  for (const sd of [-1, 1]) for (let z = -L / 2 + 10; z <= L / 2; z += 60) lights.push([sd * (W / 2 + 1), z, kind === 'asphalt' ? 0xfff2c0 : 0xffe9a0, 1]);
  if (lights.length) { const im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }), lights.length), mm = new THREE.Matrix4(), cc = new THREE.Color(); lights.forEach(([x, z, c], i) => { mm.makeTranslation(x, 0.3, z); im.setMatrixAt(i, mm); im.setColorAt(i, cc.set(c)); }); g.add(im); }
  // windsock
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), MATS.white); pole.position.set(-s * (W / 2 + 25), 3.5, -L * 0.2); g.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.8, 8, 1, true).rotateZ(-Math.PI / 2).translate(1.9, 0, 0), new THREE.MeshStandardMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })); sock.position.set(-s * (W / 2 + 25), 7, -L * 0.2); sock.rotation.y = 0.7; g.add(sock); g.userData.sock = sock;
  // buildings
  const hangar = (x, z, w = 26, l = 30, h = 9, roof = MATS.roofGrey) => { box(g, w, h, l, MATS.wall, x, 0, z); const r = new THREE.Mesh(prism(w + 1, 4, l + 1), roof); r.position.set(x, h, z); r.castShadow = true; g.add(r); box(g, w * 0.7, h * 0.75, 0.3, MATS.steel, x, 0, z + (s > 0 ? -1 : 1) * 0); };
  if (lay.tier === 2) {
    const tx = s * (lay.tx + 108);
    box(g, 26, 10, 70, MATS.wall, tx, 0, 0); box(g, 26.4, 3.2, 70.4, MATS.glass, tx, 4, 0, false); box(g, 28, 0.8, 72, MATS.roofGrey, tx, 10, 0);
    box(g, 10, 4, 24, MATS.glass, tx - s * 17, 0, 0, false); // jet-bridge-ish canopy
    box(g, 8, 12, 8, MATS.tw, tx, 0, -105); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 24, 10), MATS.tw); shaft.position.set(tx, 24, -105); shaft.castShadow = true; g.add(shaft);
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(5.4, 4, 4.5, 12), MATS.glass); cab.position.set(tx, 38.5, -105); g.add(cab); const cap = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.6, 12), MATS.white); cap.position.set(tx, 41.2, -105); g.add(cap);
    hangar(tx + s * 4, 170, 40, 36, 12); hangar(tx + s * 4, 215, 40, 36, 12, MATS.roofRed);
    for (let i = 0; i < 3; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 9, 14), MATS.tank); t.position.set(tx + s * 8, 4.5, -160 - i * 15); t.castShadow = true; g.add(t); }
  } else if (lay.tier === 1) { hangar(s * (W / 2 + 90), 0, 22, 26, 8); box(g, 10, 4, 14, MATS.wall, s * (W / 2 + 90), 0, 36); }
  else { hangar(s * (W / 2 + 28), L * 0.22, 14, 18, 5, MATS.roofRed); }
  scene.add(g); return g;
}

/** Water aerodrome: buoys marking the landing lane, a floating dock and a windsock. */
function buildWaterBase(a, scene) {
  const g = new THREE.Group(); g.position.set(a.x, 0, a.z); g.rotation.y = -a.heading * Math.PI / 180; const L = a.length, W = a.width;
  const red = new THREE.MeshStandardMaterial({ color: 0xd8321e, roughness: 0.6 }), wht = new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.6 });
  for (const sd of [-1, 1]) for (let z = -L / 2; z <= L / 2; z += 125) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 1.6, 8), sd < 0 ? red : wht); b.position.set(sd * W / 2, 0.2, z); g.add(b); const t = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: sd < 0 ? 0xff4030 : 0xffffff })); t.position.set(sd * W / 2, 1.2, z); g.add(t); }
  const dock = new THREE.Mesh(new THREE.BoxGeometry(22, 0.7, 5), new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 1 })); dock.position.set(W / 2 + 24, 0.1, 0); dock.receiveShadow = true; g.add(dock);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 7, 6), wht); pole.position.set(W / 2 + 33, 3.8, 0); g.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.8, 8, 1, true).rotateZ(-Math.PI / 2).translate(1.9, 0, 0), new THREE.MeshStandardMaterial({ color: 0xff6a1a, side: THREE.DoubleSide })); sock.position.set(W / 2 + 33, 7.4, 0); g.add(sock); g.userData.sock = sock;
  scene.add(g); return g;
}
