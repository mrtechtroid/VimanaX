// Software preview of a THREE.Object3D (painter's algorithm, flat shading) -> PNG. Used to check procedural models without a GPU.
import * as THREE from 'three';
import { createCanvas } from 'canvas';
import fs from 'node:fs';
export function render(root, views, file, { size = 520, bg = '#9db8c8', hideGlass = false } = {}) {
  root.updateMatrixWorld(true); const tris = [];
  root.traverse(o => {
    if (!o.isMesh || !o.visible) return; const g = o.geometry, p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, mats = Array.isArray(o.material) ? o.material : [o.material];
    const groups = g.groups.length ? g.groups : [{ start: 0, count: g.index ? g.index.count : p.count, materialIndex: 0 }];
    for (const gr of groups) { const m = mats[gr.materialIndex] || mats[0]; if (m.visible === false || (hideGlass && m.transparent)) continue;
      for (let i = gr.start; i < gr.start + gr.count; i += 3) { const ix = [0, 1, 2].map(k => g.index ? g.index.getX(i + k) : i + k), v = ix.map(a => new THREE.Vector3().fromBufferAttribute(p, a).applyMatrix4(o.matrixWorld)), nn = ix.map(a => n ? new THREE.Vector3().fromBufferAttribute(n, a).transformDirection(o.matrixWorld) : null);
        const base = new THREE.Color(m.color || 0xffffff); if (c && m.vertexColors) { const vc = ix.map(a => new THREE.Color(c.getX(a), c.getY(a), c.getZ(a))); base.multiply(vc[0]); }
        base.convertLinearToSRGB(); tris.push({ v, n: nn, col: base, alpha: m.transparent ? Math.min(0.6, m.opacity ?? 0.4) : 1, side: m.side }); } }
  });
  const cv = createCanvas(size * views.length, size), g = cv.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height);
  const box = new THREE.Box3().setFromObject(root), ctr = box.getCenter(new THREE.Vector3()), ext = Math.max(...box.getSize(new THREE.Vector3()).toArray());
  views.forEach((vw, vi) => {
    const dir = new THREE.Vector3(...vw.dir).normalize(), up = new THREE.Vector3(...(vw.up || [0, 1, 0])), right = new THREE.Vector3().crossVectors(up, dir).normalize(), up2 = new THREE.Vector3().crossVectors(dir, right), sc = size / (ext * 1.15), L = new THREE.Vector3(0.4, 0.8, 0.5).normalize();
    const proj = p => { const d = p.clone().sub(ctr); return [size * vi + size / 2 + d.dot(right) * sc, size / 2 - d.dot(up2) * sc, d.dot(dir)]; };
    const list = tris.map(t => { const P = t.v.map(proj), nn = new THREE.Vector3().crossVectors(t.v[1].clone().sub(t.v[0]), t.v[2].clone().sub(t.v[0])).normalize(); return { P, nn, z: (P[0][2] + P[1][2] + P[2][2]) / 3, t }; });
    list.sort((a, b) => a.z - b.z);
    for (const o of list) { const facing = o.nn.dot(dir); if (o.t.side !== THREE.DoubleSide && o.t.side !== THREE.BackSide && facing < 0) continue; if (o.t.side === THREE.BackSide && facing > 0) continue;
      const l = 0.35 + 0.65 * Math.max(0, Math.abs(o.nn.dot(L))), col = o.t.col; g.fillStyle = `rgba(${Math.min(255, col.r * 255 * l) | 0},${Math.min(255, col.g * 255 * l) | 0},${Math.min(255, col.b * 255 * l) | 0},${o.t.alpha})`; g.beginPath(); g.moveTo(o.P[0][0], o.P[0][1]); g.lineTo(o.P[1][0], o.P[1][1]); g.lineTo(o.P[2][0], o.P[2][1]); g.closePath(); g.fill(); if (o.t.alpha === 1) { g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke(); } }
    g.fillStyle = '#000'; g.font = '12px sans-serif'; g.fillText(vw.name, size * vi + 8, 16);
  });
  fs.mkdirSync(file.replace(/\/[^/]*$/, ''), { recursive: true }); fs.writeFileSync(file, cv.toBuffer('image/png'));
}
export const VIEWS3 = [{ name: 'side', dir: [1, 0, 0] }, { name: 'top', dir: [0, 1, 0], up: [0, 0, -1] }, { name: 'front 3/4', dir: [0.7, 0.35, -0.8] }, { name: 'rear 3/4 low', dir: [-0.8, -0.1, 0.6] }];
