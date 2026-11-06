import * as THREE from 'three';
const mat = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };
/** Control surface hinged at its leading edge; rotating the returned pivot deflects it. */
function hinged(parent, x, y, z, w, h, d, m) { const p = new THREE.Group(); p.position.set(x, y, z); p.add(at(box(w, h, d, m), 0, 0, d / 2)); parent.add(p); return p; }

/**
 * Procedural airframe from a spec (fuselage, wing, tail, engines, gear). Reuse for any conventional aircraft;
 * write a different builder (or load a glTF) for exotic ones (tilt-wing, seaplane floats) - only `userData.parts` matters.
 */
export function buildAirframe(s, l) {
  const g = new THREE.Group(), P = { aileronL: null, aileronR: null, elevator: null, rudder: null, flaps: [], gear: [], props: [], strobes: [] };
  const body = mat(l.body), acc = mat(l.accent), dark = mat(0x2a2a2a), white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const { fuselage: F, wing: W, tail: T } = s, wy = F.radius * 0.8, half = W.span / 2;
  const fus = new THREE.Mesh(new THREE.CapsuleGeometry(F.radius, F.length, 6, 12), body); fus.rotation.x = Math.PI / 2; g.add(fus);
  g.add(at(box(W.span, 0.15, W.chord, body), 0, wy, W.z));
  const hz = W.z + W.chord * 0.25, sd = W.chord * 0.25;
  for (const sg of [-1, 1]) {
    P.flaps.push(hinged(g, sg * half * 0.35, wy, hz, half * 0.4, 0.17, sd, acc));
    const a = hinged(g, sg * half * 0.78, wy, hz, half * 0.35, 0.17, sd, acc); if (sg < 0) P.aileronL = a; else P.aileronR = a;
    P.strobes.push(at(new THREE.Mesh(new THREE.SphereGeometry(0.18), white), sg * half, wy, W.z + W.chord / 2));
  }
  g.add(at(box(T.hSpan, 0.1, T.hChord, body), 0, T.y, T.z));
  P.elevator = hinged(g, 0, T.y, T.z + T.hChord * 0.15, T.hSpan * 0.9, 0.12, T.hChord * 0.35, acc);
  const vb = T.vBase ?? T.y;
  g.add(at(box(0.12, T.vHeight, T.vChord, body), 0, vb + T.vHeight / 2, T.z));
  P.rudder = hinged(g, 0, vb + T.vHeight / 2, T.z + T.vChord * 0.15, 0.14, T.vHeight * 0.9, T.vChord * 0.35, acc);
  P.strobes.push(at(new THREE.Mesh(new THREE.SphereGeometry(0.18), white), 0, vb + T.vHeight, T.z + T.vChord / 2));
  P.strobes.forEach(m => { m.visible = false; g.add(m); });
  for (const e of s.engines) {
    const n = new THREE.Mesh(new THREE.CapsuleGeometry(e.radius, e.length, 4, 8), dark); n.rotation.x = Math.PI / 2; g.add(at(n, e.x, e.y, e.z));
    const pr = new THREE.Group(); pr.position.set(e.x, e.y, e.z - e.length / 2 - e.radius - 0.05);
    for (let i = 0; i < e.blades; i++) { const b = new THREE.Group(); b.rotation.z = i * 2 * Math.PI / e.blades; b.add(at(box(0.14, e.propR, 0.03, dark), 0, e.propR / 2, 0)); pr.add(b); }
    g.add(pr); P.props.push(pr);
  }
  const wr = s.wheelRadius, y0 = -F.radius * 0.6, drop = s.gearHeight + y0;
  for (const p of s.gear) {
    const gr = new THREE.Group(); gr.position.set(p.x, y0, p.z);
    gr.add(at(box(0.1, drop - wr, 0.1, dark), 0, -(drop - wr) / 2, 0));
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, wr * 0.7, 14), dark); wh.rotation.z = Math.PI / 2; gr.add(at(wh, 0, -(drop - wr), 0));
    g.add(gr); P.gear.push(gr);
  }
  g.userData.parts = P; return g;
}
