/** Analog "six-pack" gauge painters (aviation units: knots, feet, fpm). All draw onto a 2D context at (cx, cy) with radius r. */
const TAU = Math.PI * 2, A = (deg) => (deg - 90) * Math.PI / 180; // 0 deg = 12 o'clock, clockwise
const FONT = (px, w = 400) => `${w} ${px}px "B612", system-ui, sans-serif`, W = '#f2f2ee', Y = '#f4d03f', G = '#4cc16b', R = '#e5473e';

function face(g, cx, cy, r) {
  g.save(); g.fillStyle = '#0a0b0c'; g.beginPath(); g.arc(cx, cy, r + 6, 0, TAU); g.fill(); g.strokeStyle = '#6d7378'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#121416'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); g.restore();
}
function arc(g, cx, cy, r, v0, v1, map, col, w = 5) { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.arc(cx, cy, r, A(map(v0)), A(map(v1))); g.stroke(); }
function needle(g, cx, cy, r, deg, col = W, w = 3, tail = 0.15) { g.save(); g.translate(cx, cy); g.rotate(A(deg) + Math.PI / 2); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, r * tail); g.lineTo(0, -r); g.stroke(); g.beginPath(); g.arc(0, 0, w + 2, 0, TAU); g.fill(); g.restore(); }
function ticks(g, cx, cy, r, v0, v1, map, major, minor, label) {
  g.fillStyle = W; g.strokeStyle = W; g.textAlign = 'center'; g.textBaseline = 'middle';
  const N = Math.round((v1 - v0) / minor);
  for (let i = 0; i <= N; i++) { const v = Math.round((v0 + i * minor) * 1e6) / 1e6, a = A(map(v)), big = Math.abs(v / major - Math.round(v / major)) < 1e-6, r1 = r * (big ? 0.82 : 0.9); g.lineWidth = big ? 2.5 : 1.3; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.97, cy + Math.sin(a) * r * 0.97); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke(); if (big && label) { g.font = FONT(r * 0.17, 700); g.fillText(label(v), cx + Math.cos(a) * r * 0.66, cy + Math.sin(a) * r * 0.66); } }
}
const lin = (v0, v1, a0, a1) => v => a0 + (a1 - a0) * (Math.max(v0, Math.min(v1, v)) - v0) / (v1 - v0);

export function asi(g, cx, cy, r, s) {
  face(g, cx, cy, r); const m = lin(30, 180, 30, 340), b = s.bands, K = 1.943844;
  arc(g, cx, cy, r * 0.93, b.vs0 * K, b.vfeLast * K, m, W, 6); arc(g, cx, cy, r * 0.86, b.vs1 * K, b.vs1 * K * 2.1, m, G, 6); arc(g, cx, cy, r * 0.86, b.vs1 * K * 2.1, b.vs1 * K * 2.6, m, Y, 6);
  ticks(g, cx, cy, r, 40, 180, m, 20, 10, v => v); g.fillStyle = W; g.font = FONT(r * 0.15); g.textAlign = 'center'; g.fillText('KNOTS', cx, cy + r * 0.38);
  needle(g, cx, cy, r * 0.88, m(s.kt), W);
}
export function attitude(g, cx, cy, r, s) {
  face(g, cx, cy, r); g.save(); g.beginPath(); g.arc(cx, cy, r * 0.93, 0, TAU); g.clip(); g.translate(cx, cy); g.rotate(-s.roll); g.translate(0, s.pitch * 180 / Math.PI * r * 0.028);
  g.fillStyle = '#3b8fd4'; g.fillRect(-r * 2, -r * 2, r * 4, r * 2); g.fillStyle = '#7a5a34'; g.fillRect(-r * 2, 0, r * 4, r * 2); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 2, 0); g.lineTo(r * 2, 0); g.stroke();
  g.font = FONT(r * 0.12); g.fillStyle = '#fff'; g.textAlign = 'center'; for (let d = -20; d <= 20; d += 10) { if (!d) continue; const y = -d * r * 0.028, hw = r * 0.22; g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke(); }
  g.restore(); g.strokeStyle = Y; g.lineWidth = 4; g.beginPath(); g.moveTo(cx - r * 0.6, cy); g.lineTo(cx - r * 0.18, cy); g.lineTo(cx - r * 0.18, cy + r * 0.08); g.moveTo(cx + r * 0.6, cy); g.lineTo(cx + r * 0.18, cy); g.lineTo(cx + r * 0.18, cy + r * 0.08); g.stroke(); g.fillStyle = Y; g.fillRect(cx - 3, cy - 3, 6, 6);
  g.save(); g.translate(cx, cy); g.rotate(-s.roll); g.strokeStyle = '#fff'; g.lineWidth = 2; for (const a of [-60, -30, 0, 30, 60]) { g.beginPath(); g.moveTo(Math.sin(a * Math.PI / 180) * r * 0.93, -Math.cos(a * Math.PI / 180) * r * 0.93); g.lineTo(Math.sin(a * Math.PI / 180) * r * 0.8, -Math.cos(a * Math.PI / 180) * r * 0.8); g.stroke(); } g.restore();
}
export function altimeter(g, cx, cy, r, s) {
  face(g, cx, cy, r); const m = lin(0, 10, 0, 360); ticks(g, cx, cy, r, 0, 10, m, 1, 0.2, v => v % 10); const ft = Math.max(0, s.ft);
  g.fillStyle = W; g.font = FONT(r * 0.14); g.textAlign = 'center'; g.fillText('ALT', cx, cy - r * 0.32); needle(g, cx, cy, r * 0.88, (ft % 1000) / 1000 * 360, W, 3); needle(g, cx, cy, r * 0.58, (ft % 10000) / 10000 * 360, W, 5, 0.1); needle(g, cx, cy, r * 0.4, ft / 100000 * 360, '#9aa', 4, 0.1);
}
export function turn(g, cx, cy, r, s) {
  face(g, cx, cy, r); const k = Math.max(-1, Math.min(1, s.turn / 0.0524)); // standard rate = 3 deg/s
  g.strokeStyle = W; g.lineWidth = 3; for (const sgn of [-1, 1]) { g.beginPath(); g.moveTo(cx + sgn * r * 0.9, cy); g.lineTo(cx + sgn * r * 0.7, cy); g.stroke(); }
  g.save(); g.translate(cx, cy); g.rotate(k * 0.35); g.fillStyle = W; g.fillRect(-r * 0.6, -3, r * 1.2, 6); g.beginPath(); g.moveTo(0, -r * 0.3); g.lineTo(-6, 0); g.lineTo(6, 0); g.fill(); g.restore();
  g.strokeStyle = '#333'; g.fillStyle = '#d8d8d0'; g.lineWidth = 8; g.beginPath(); g.arc(cx, cy - r * 0.65, r * 0.95, Math.PI * 0.42, Math.PI * 0.58); g.stroke(); g.beginPath(); g.arc(cx + s.slip * r * 0.35, cy + r * 0.62, r * 0.09, 0, TAU); g.fill();
  g.fillStyle = W; g.font = FONT(r * 0.13); g.textAlign = 'center'; g.fillText('TURN COORD', cx, cy + r * 0.3);
}
export function heading(g, cx, cy, r, s) {
  face(g, cx, cy, r); g.save(); g.translate(cx, cy); g.rotate(-s.hdg * Math.PI / 180); g.fillStyle = W; g.strokeStyle = W; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let d = 0; d < 360; d += 5) { const a = (d - 90) * Math.PI / 180, big = d % 30 === 0; g.lineWidth = big ? 2.5 : 1.2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.94, Math.sin(a) * r * 0.94); g.lineTo(Math.cos(a) * r * (big ? 0.8 : 0.87), Math.sin(a) * r * (big ? 0.8 : 0.87)); g.stroke(); if (big) { const L = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] || String(d / 10); g.font = FONT(r * 0.17, 700); g.save(); g.translate(Math.cos(a) * r * 0.64, Math.sin(a) * r * 0.64); g.rotate(a + Math.PI / 2); g.fillText(L, 0, 0); g.restore(); } }
  g.restore(); g.fillStyle = Y; g.beginPath(); g.moveTo(cx, cy - r * 0.42); g.lineTo(cx - 9, cy + r * 0.2); g.lineTo(cx, cy + r * 0.1); g.lineTo(cx + 9, cy + r * 0.2); g.fill();
  g.fillStyle = W; g.beginPath(); g.moveTo(cx, cy - r * 0.97); g.lineTo(cx - 6, cy - r * 0.84); g.lineTo(cx + 6, cy - r * 0.84); g.fill();
}
export function vsi(g, cx, cy, r, s) {
  face(g, cx, cy, r); const dir = v => 270 + (Math.max(-2000, Math.min(2000, v)) / 2000) * 150; // 0 fpm at 9 o'clock, +-2000 fpm sweeps +-150 deg
  g.fillStyle = W; g.strokeStyle = W; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = FONT(r * 0.15, 700);
  for (let v = -2000; v <= 2000; v += 500) { const a = A(dir(v)), big = v % 1000 === 0; g.lineWidth = big ? 2.5 : 1.3; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.96, cy + Math.sin(a) * r * 0.96); g.lineTo(cx + Math.cos(a) * r * (big ? 0.8 : 0.87), cy + Math.sin(a) * r * (big ? 0.8 : 0.87)); g.stroke(); if (big && v) g.fillText(Math.abs(v / 1000), cx + Math.cos(a) * r * 0.63, cy + Math.sin(a) * r * 0.63); }
  g.font = FONT(r * 0.13); g.fillText('VERT SPEED', cx, cy + r * 0.45); g.fillText('x1000 FPM', cx, cy + r * 0.6); needle(g, cx, cy, r * 0.86, dir(Math.max(-2200, Math.min(2200, s.fpm))), W, 3);
}
export function tach(g, cx, cy, r, s) {
  face(g, cx, cy, r); const m = lin(0, 3000, 40, 320); arc(g, cx, cy, r * 0.9, 2100, 2550, m, G, 6); arc(g, cx, cy, r * 0.9, 2550, 2700, m, Y, 6); arc(g, cx, cy, r * 0.9, 2700, 3000, m, R, 6);
  ticks(g, cx, cy, r, 0, 3000, m, 500, 100, v => v / 100); g.fillStyle = W; g.font = FONT(r * 0.14); g.textAlign = 'center'; g.fillText('RPM x100', cx, cy + r * 0.42); needle(g, cx, cy, r * 0.88, m(s.rpm), W);
}
/** 1024x384 steam-gauge panel: ASI, attitude, altimeter / turn, heading, VSI / tach + status lights. */
export function steamPanel(g, w, h, s) {
  g.fillStyle = '#1b1d1f'; g.fillRect(0, 0, w, h); const r = 84;
  asi(g, 150, 100, r, s); attitude(g, 360, 100, r, s); altimeter(g, 570, 100, r, s); turn(g, 150, 285, r, s); heading(g, 360, 285, r, s); vsi(g, 570, 285, r, s); tach(g, 800, 100, r, s);
  g.fillStyle = '#d7d7d0'; g.font = FONT(15); g.textAlign = 'left'; g.fillText('FLAPS', 720, 245); g.font = FONT(26, 700); g.fillText(['UP', '10', '20', 'FULL'][s.flapIdx] ?? String(s.flapIdx), 720, 280);
  g.font = FONT(15); g.fillText('GEAR', 870, 245); for (let i = 0; i < 3; i++) { g.fillStyle = s.gearPos > 0.99 ? G : s.gearPos < 0.01 ? '#333' : R; g.beginPath(); g.arc(880 + i * 36, 275, 11, 0, TAU); g.fill(); }
  g.fillStyle = '#d7d7d0'; g.font = FONT(15); g.fillText('THROTTLE', 720, 330); g.fillStyle = '#333'; g.fillRect(720, 340, 270, 12); g.fillStyle = Y; g.fillRect(720, 340, 270 * s.throttle, 12);
}
