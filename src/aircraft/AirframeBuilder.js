import * as THREE from 'three';
import { loftBody, wingPiece, finPiece, wingPoint } from './Loft.js';

/** Catmull-Rom through control stations -> dense stations (smooth profile from a handful of numbers). */
export function denseStations(ctrl0, dz = 0.35) {
  const ctrl = ctrl0.map(c => ({ n: 2.4, cx: 0, ...c })), out = [], keys = ['rx', 'ry', 'cy', 'n', 'cx'], cr = (p0, p1, p2, p3, t) => 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3);
  for (let i = 0; i < ctrl.length - 1; i++) {
    const a = ctrl[i], b = ctrl[i + 1], p0 = ctrl[Math.max(0, i - 1)], p3 = ctrl[Math.min(ctrl.length - 1, i + 2)], steps = Math.max(1, Math.round((b.z - a.z) / dz));
    for (let s = 0; s < steps; s++) { const t = s / steps, st = { z: a.z + (b.z - a.z) * t }; for (const k of keys) st[k] = Math.max(k === 'rx' || k === 'ry' ? 0.01 : -99, cr(p0[k] ?? 0, a[k] ?? 0, b[k] ?? 0, p3[k] ?? 0, t)); st.n = Math.max(1.6, st.n); out.push(st); }
  }
  out.push({ ...ctrl[ctrl.length - 1] }); return out;
}
const rgb = c => { const k = new THREE.Color(c); return [k.r, k.g, k.b]; };
const cyl = (a, b, r, m, seg = 8) => { const d = new THREE.Vector3().subVectors(b, a), mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), seg), m); mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return mesh; };

/** A hinged control surface piece: returns {holder, pivot}. axis 'x' (elevator/flap/aileron, along the hinge) or 'y' (rudder). */
function hingedPiece(geo, A, B, axis) {
  const d = new THREE.Vector3().subVectors(B, A); if (axis === 'x' && d.x < 0) d.negate();
  const holder = new THREE.Group(), pivot = new THREE.Group(); holder.position.copy(A); holder.add(pivot);
  if (axis === 'x') { const phi = Math.atan2(-d.z, d.x); holder.rotation.y = phi; geo.translate(-A.x, -A.y, -A.z); geo.rotateY(-phi); }
  else { const psi = Math.atan2(d.z, d.y); holder.rotation.x = psi; geo.translate(-A.x, -A.y, -A.z); geo.rotateX(-psi); }
  return { holder, pivot, geo };
}

/**
 * Procedural airframe from a spec (see definitions). Public contract: group.userData.parts =
 *  { aileronL, aileronR, elevator, elevators[], rudder, wings[2], tail, ramp, flaps[], gear[], props[], propBlur[], strobes[], nav[], doors[] , rampAngles, interior }
 * Wings / tail / ramp are separate groups (the damage system detaches them). Any builder (or a glTF loader) that fills `parts` works.
 */
export function buildAirframe(s, l) {
  const g = new THREE.Group(), P = { aileronL: null, aileronR: null, elevator: null, elevators: [], rudder: null, wings: [], tail: null, ramp: null, flaps: [], gear: [], props: [], propBlur: [], strobes: [], nav: [], doors: [], rampAngles: null, interior: null };
  const body = new THREE.Color(l.body), acc = new THREE.Color(l.accent);
  const paint = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, metalness: 0.35, roughness: 0.38 }), accent = new THREE.MeshStandardMaterial({ color: l.accent, metalness: 0.3, roughness: 0.4 }), skin = new THREE.MeshStandardMaterial({ color: l.body, metalness: 0.35, roughness: 0.38 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1d2a33, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.32, side: THREE.FrontSide, depthWrite: false });
  const dark = new THREE.MeshStandardMaterial({ color: 0x23262a, metalness: 0.5, roughness: 0.55 }), tire = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 }), metal = new THREE.MeshStandardMaterial({ color: 0xaeb4ba, metalness: 0.9, roughness: 0.3 });
  const lining = new THREE.MeshStandardMaterial({ color: s.interiorColor ?? 0x8b8577, roughness: 0.9, side: THREE.BackSide }), none = new THREE.MeshBasicMaterial({ visible: false });
  const emis = c => new THREE.MeshBasicMaterial({ color: c });
  const F = s.fuselage, colorFn = F.color ? (x, y, z, a, st) => rgb(F.color(x, y, z, a, st, body, acc)) : () => [body.r, body.g, body.b];

  // ---- fuselage skin + lining (same cut-outs so windows and doors are real holes) --------------------------------------
  const st = denseStations(F.stations, F.dz ?? 0.35), opts = { M: F.M ?? 36, color: colorFn, material: F.windows, door: F.doors?.length ? (zm, am) => F.doors.findIndex(d => d.test(zm, am)) : null, doorMaterial: F.windows };
  const outer = loftBody(st, opts), shrink = F.lining ?? 0.94, inSt = st.map(q => ({ ...q, rx: q.rx * shrink, ry: q.ry * shrink, cy: q.cy * shrink })), inner = loftBody(inSt, { ...opts, color: null });
  g.add(new THREE.Mesh(outer.geo, [paint, glass])); g.add(new THREE.Mesh(inner.geo, [lining, none]));
  for (let i = 0; i < (F.doors?.length ?? 0); i++) {
    const d = F.doors[i], holder = new THREE.Group(), pivot = new THREE.Group(); holder.position.set(d.hinge.x, 0, d.hinge.z); holder.add(pivot); g.add(holder);
    const og = outer.doors.get(i), ig = inner.doors.get(i); if (!og) continue; og.translate(-d.hinge.x, 0, -d.hinge.z); ig.translate(-d.hinge.x, 0, -d.hinge.z);
    pivot.add(new THREE.Mesh(og, [paint, glass]), new THREE.Mesh(ig, [lining, none]));
    P.doors.push({ id: d.id, label: d.label, pivot, openAngle: d.open, at: d.at, in: d.in ?? null, enter: d.enter ?? null, pos: 0, target: 0, side: d.side });
  }

  // ---- wings ------------------------------------------------------------------------------------------------------
  const W = s.wing, w = W.w, hz = W.hinge ?? 0.72, surfs = [...(W.flap ? [{ ...W.flap, kind: 'flap' }] : []), ...(W.aileron ? [{ ...W.aileron, kind: 'ail' }] : [])].sort((a, b) => a.e0 - b.e0);
  const wcol = () => rgb(l.body), acol = () => rgb(l.accent);
  for (const sg of [-1, 1]) {
    const wg = new THREE.Group(); wg.position.set(sg * (W.rootX ?? 0), W.y, W.z); g.add(wg); P.wings.push(wg);
    wg.add(new THREE.Mesh(wingPiece(w, { u0: 0, u1: hz }, sg, 8), skin));
    let e = 0; for (const f of [...surfs, { e0: 1, e1: 1 }]) { if (f.e0 > e + 1e-3) wg.add(new THREE.Mesh(wingPiece(w, { u0: hz, u1: 1, e0: e, e1: f.e0 }, sg, 3), skin)); e = Math.max(e, f.e1); }
    for (const f of surfs) {
      const gp = wingPiece(w, { u0: hz, u1: 1, e0: f.e0, e1: f.e1 }, sg, 3), A = wingPoint(w, f.e0, hz, sg), B = wingPoint(w, f.e1, hz, sg), h = hingedPiece(gp, A, B, 'x');
      h.pivot.add(new THREE.Mesh(h.geo, f.kind === 'ail' || l.flapsAccent ? accent : skin)); wg.add(h.holder);
      if (f.kind === 'flap') P.flaps.push(h.pivot); else if (sg < 0) P.aileronL = h.pivot; else P.aileronR = h.pivot;
    }
    const tip = wingPoint(w, 1, 0.5, sg); const nav = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), emis(sg < 0 ? 0xff2a2a : 0x2aff5a)); nav.position.copy(tip); wg.add(nav); P.nav.push(nav);
    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emis(0xffffff)); strobe.visible = false; strobe.position.copy(tip).add(new THREE.Vector3(0, 0.12, 0.35)); wg.add(strobe); P.strobes.push(strobe);
    for (const stt of W.struts ?? []) { const a = new THREE.Vector3(sg * stt.from.x, stt.from.y - W.y, stt.from.z - W.z), b = wingPoint(w, stt.eta, 0.3, sg).add(new THREE.Vector3(0, -0.05, 0)); wg.add(cyl(a, b, stt.r ?? 0.03, metal)); }
    if (W.pitot && sg < 0) { const p = cyl(new THREE.Vector3(sg * w.span * 0.45, -0.3, 0.1), new THREE.Vector3(sg * w.span * 0.45, -0.3, -0.45), 0.012, metal, 5); wg.add(p); }
  }
  // ---- tail -------------------------------------------------------------------------------------------------------
  const T = s.tail, tl = new THREE.Group(); g.add(tl); P.tail = tl;
  for (const sg of [-1, 1]) {
    const hw = T.h.w, hzz = T.h.hinge ?? 0.62, grp = new THREE.Group(); grp.position.set(0, T.h.y, T.h.z); tl.add(grp);
    grp.add(new THREE.Mesh(wingPiece(hw, { u0: 0, u1: hzz }, sg, 4), skin));
    const gp = wingPiece(hw, { u0: hzz, u1: 1 }, sg, 4), h = hingedPiece(gp, wingPoint(hw, 0, hzz, sg), wingPoint(hw, 1, hzz, sg), 'x'); h.pivot.add(new THREE.Mesh(h.geo, skin)); grp.add(h.holder); P.elevators.push(h.pivot);
  }
  P.elevator = P.elevators[0];
  { const vw = T.v.w, hzz = T.v.hinge ?? 0.62, grp = new THREE.Group(); grp.position.set(0, T.v.y, T.v.z); tl.add(grp);
    grp.add(new THREE.Mesh(finPiece(vw, { u0: 0, u1: hzz }, 6), T.v.accent ? accent : skin));
    const gp = finPiece(vw, { u0: hzz, u1: 1 }, 6), A = wingPoint(vw, 0, hzz, 1), B = wingPoint(vw, 1, hzz, 1); [A, B].forEach(p => { const x = p.x; p.set(0, x, p.z); });
    const h = hingedPiece(gp, A, B, 'y'); h.pivot.add(new THREE.Mesh(h.geo, accent)); grp.add(h.holder); P.rudder = h.pivot;
    const tipP = new THREE.Vector3(0, vw.span, wingPoint(vw, 1, 1, 1).z); const sb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), emis(0xffffff)); sb.visible = false; sb.position.copy(tipP).add(new THREE.Vector3(0, 0.1, 0)); grp.add(sb); P.strobes.push(sb);
    const wl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), emis(0xffffff)); wl.position.set(0, vw.span * 0.35, wingPoint(vw, 0.35, 1, 1).z + 0.05); grp.add(wl); P.nav.push(wl); }

  // ---- engines + propellers ---------------------------------------------------------------------------------------
  for (const e of s.engines) {
    if (e.nacelle) { const nac = loftBody(denseStations(e.nacelle, 0.3), { M: 20, color: () => rgb(e.dark ? 0x3b3f44 : l.body) }); const nm = new THREE.Mesh(nac.geo, paint); nm.position.set(e.x, e.y, e.z); g.add(nm); }
    const sp = loftBody(denseStations(e.spinner, 0.08), { M: 20, color: () => rgb(e.spinnerColor ?? l.accent) });
    const pr = new THREE.Group(); pr.position.set(e.x, e.y, e.pz); pr.add(new THREE.Mesh(sp.geo, paint));
    const bl = wingPiece({ span: e.R, rootChord: e.chord ?? 0.16, tipChord: (e.chord ?? 0.16) * 0.65, sweep: 0, twist: -0.5, tRoot: 0.16, tTip: 0.08, camber: 0.05 }, {}, 1, 4), bm = new THREE.MeshStandardMaterial({ color: 0x15171a, metalness: 0.5, roughness: 0.5 });
    bl.rotateZ(Math.PI / 2); bl.translate(0, e.hub ?? 0.12, 0.05); // span -> +y
    const TIP_GEO = new THREE.BoxGeometry(0.05, 0.16, 0.02), tipM = new THREE.MeshStandardMaterial({ color: 0xe8c820, roughness: 0.6 }); // shared by all blade tips of this engine
    for (let i = 0; i < e.blades; i++) { const b = new THREE.Mesh(bl, bm); b.rotation.z = i * 2 * Math.PI / e.blades; pr.add(b); const tip = new THREE.Mesh(TIP_GEO, tipM); tip.position.set(0, e.R * 0.97, 0.05); b.add(tip); }
    g.add(pr); P.props.push(pr);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(e.R, 28), new THREE.MeshBasicMaterial({ color: 0x20262c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); disc.position.set(e.x, e.y, e.pz + 0.06); g.add(disc); P.propBlur.push(disc);
  }
  for (const extra of s.bodies ?? []) { const bg = loftBody(denseStations(extra.stations, 0.3), { M: 20, color: () => rgb(extra.accent ? l.accent : l.body) }); const m = new THREE.Mesh(bg.geo, paint); m.position.set(extra.x, extra.y, extra.z); g.add(m); }

  // ---- ramp --------------------------------------------------------------------------------------------------------
  if (s.ramp) { const R = s.ramp, r = new THREE.Group(); r.position.set(0, R.hingeY, R.hingeZ); g.add(r); P.ramp = r;
    r.add(new THREE.Mesh(wingPiece({ span: R.w / 2, rootChord: R.len, tipChord: R.len, sweep: 0, tRoot: 0.025, tTip: 0.025, camber: 0 }, {}, 1, 1), skin), new THREE.Mesh(wingPiece({ span: R.w / 2, rootChord: R.len, tipChord: R.len, sweep: 0, tRoot: 0.025, tTip: 0.025, camber: 0 }, {}, -1, 1), skin));
    P.rampAngles = { closed: R.closed, open: R.open, len: R.len, hingeY: R.hingeY, hingeZ: R.hingeZ }; r.rotation.x = R.closed; }

  // ---- landing gear (rotates up into the airframe) ----------------------------------------------------------------------
  const wr = s.wheelRadius;
  for (const p of s.gear) {
    const gr = new THREE.Group(); gr.position.set(p.x, p.y0, p.z); const wc = new THREE.Vector3(p.dx ?? 0, -(s.gearHeight + p.y0) + wr, p.dz ?? 0), top = new THREE.Vector3(0, 0, 0);
    gr.add(cyl(top, wc, p.leg ?? 0.04, metal)); if (p.oleo) gr.add(cyl(top, top.clone().lerp(wc, 0.45), (p.leg ?? 0.04) * 1.5, dark));
    for (const off of p.twin ? [-1, 1] : [0]) {
      const wh = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, p.tireW ?? wr * 0.75, 20), tire); wh.rotation.z = Math.PI / 2; wh.position.copy(wc).add(new THREE.Vector3(off * (p.tireW ?? wr * 0.75) * 0.6, 0, 0)); gr.add(wh);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.55, wr * 0.55, (p.tireW ?? wr * 0.75) * 1.03, 14), metal); hub.rotation.z = Math.PI / 2; hub.position.copy(wh.position); gr.add(hub);
    }
    if (p.fairing) { const fm = new THREE.Mesh(new THREE.SphereGeometry(wr * 1.1, 14, 10), skin); fm.scale.set(0.3, 0.85, 1.25); fm.position.copy(wc).add(new THREE.Vector3(0, 0.02, 0)); gr.add(fm); }
    gr.userData.retract = p.retract ?? { axis: 'z', angle: p.x < 0 ? 1.5 : -1.5 }; g.add(gr); P.gear.push(gr);
  }
  for (const d of s.details ?? []) d(g, { paint, accent, dark, metal, glass, emis, P });
  g.traverse(o => { if (o.isMesh) { const m = Array.isArray(o.material) ? o.material[0] : o.material; o.castShadow = !m.transparent; o.receiveShadow = !m.transparent; } });
  g.userData.parts = P; return g;
}
