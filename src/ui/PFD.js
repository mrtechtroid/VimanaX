/**
 * Primary flight display (canvas 2D). Pure renderer: draw(state) takes plain numbers, so it can be tested without the engine.
 * Colour grammar follows glass cockpits: cyan = selected/target, green = normal/engaged, magenta = route, amber = caution, red = warning.
 *
 * state: { pitch, roll, hdg (deg, rad for pitch/roll), spd, spdUnit, spdK, gs, alt, altUnit, altK, agl, vs, vsText, aoaFrac,
 *          bands:{vs0,vs1,vfeLast,vfeCur}, flapIdx, brg|null, stall, time }
 */
export const PAL = { sky1: '#1e6aa8', sky2: '#8ccdf0', gnd1: '#7c5b34', gnd2: '#35261a', panel: 'rgba(7,20,28,.86)', line: 'rgba(200,230,240,.24)', txt: '#e8f2f0', dim: '#8da9ad', cyan: '#58d6ff', green: '#62e38f', mag: '#ff62d2', amber: '#ffbd45', red: '#ff5d5a' };
const W = 460, H = 300, AX = 78, AY = 34, AW = 304, AH = 232, CX = AX + AW / 2, CY = AY + AH / 2, PPD = 4.6;
const FONT = (px, w = 400) => `${w} ${px}px "B612 Mono", ui-monospace, Menlo, Consolas, monospace`;
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
const D = 180 / Math.PI;

export class PFD {
  constructor(canvas) { this.cv = canvas; this.g = canvas.getContext('2d'); this.k = 1; this.fit(); }
  fit() {
    const r = this.cv.getBoundingClientRect?.() || { width: W }, dpr = Math.min(globalThis.devicePixelRatio || 1, 2), w = Math.max(160, Math.round((r.width || W) * dpr));
    if (this.cv.width !== w) { this.cv.width = w; this.cv.height = Math.round(w * H / W); } this.k = this.cv.width / W;
  }
  draw(s) {
    const g = this.g; g.setTransform(this.k, 0, 0, this.k, 0, 0); g.clearRect(0, 0, W, H);
    rr(g, 0.5, 0.5, W - 1, H - 1, 16); g.fillStyle = PAL.panel; g.fill(); g.strokeStyle = s.stall && (s.time * 4) % 1 < 0.5 ? PAL.red : PAL.line; g.lineWidth = s.stall ? 2 : 1; g.stroke();
    this.attitude(g, s); this.compass(g, s); this.speedTape(g, s); this.altTape(g, s); this.footer(g, s);
  }
  attitude(g, s) {
    g.save(); rr(g, AX, AY, AW, AH, 10); g.clip();
    g.translate(CX, CY); g.rotate(-s.roll); g.translate(0, s.pitch * D * PPD);
    let f = g.createLinearGradient(0, -420, 0, 0); f.addColorStop(0, PAL.sky1); f.addColorStop(1, PAL.sky2); g.fillStyle = f; g.fillRect(-500, -500, 1000, 500);
    f = g.createLinearGradient(0, 0, 0, 420); f.addColorStop(0, PAL.gnd1); f.addColorStop(1, PAL.gnd2); g.fillStyle = f; g.fillRect(-500, 0, 1000, 500);
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-500, 0); g.lineTo(500, 0); g.stroke();
    g.fillStyle = '#fff'; g.font = FONT(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 1.2;
    for (let d = -40; d <= 40; d += 5) {
      if (!d) continue; const y = -d * PPD, big = d % 10 === 0, hw = big ? 30 : 14; g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke();
      if (big) { g.fillText(String(Math.abs(d)), -hw - 12, y); g.fillText(String(Math.abs(d)), hw + 12, y); }
    }
    g.restore();
    // roll scale (rotates with the horizon) + fixed index
    g.save(); g.beginPath(); g.rect(AX, AY, AW, AH); g.clip(); g.translate(CX, CY); g.rotate(-s.roll); g.strokeStyle = '#fff'; g.lineWidth = 1.4;
    for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) { const r = a * Math.PI / 180, big = [0, 30, 60, -30, -60].includes(a), R = 106, l = big ? 11 : 6; g.beginPath(); g.moveTo(Math.sin(r) * R, -Math.cos(r) * R); g.lineTo(Math.sin(r) * (R - l), -Math.cos(r) * (R - l)); g.stroke(); }
    g.restore();
    g.fillStyle = PAL.amber; g.beginPath(); g.moveTo(CX, AY + AH / 2 - 106 + 1); g.lineTo(CX - 6, AY + AH / 2 - 118); g.lineTo(CX + 6, AY + AH / 2 - 118); g.fill();
    // aircraft symbol
    g.strokeStyle = PAL.amber; g.lineWidth = 3; g.lineJoin = 'round'; g.beginPath(); g.moveTo(CX - 62, CY); g.lineTo(CX - 24, CY); g.lineTo(CX - 24, CY + 9); g.moveTo(CX + 62, CY); g.lineTo(CX + 24, CY); g.lineTo(CX + 24, CY + 9); g.stroke();
    g.fillStyle = PAL.amber; g.fillRect(CX - 2.5, CY - 2.5, 5, 5);
    // angle-of-attack gauge (left edge of window): fills toward the stall
    const gx = AX + 8, gy = AY + 52, gh = 128, fr = Math.max(0, Math.min(1.2, s.aoaFrac));
    g.strokeStyle = PAL.line; g.lineWidth = 1; g.strokeRect(gx, gy, 6, gh); g.fillStyle = fr > 1 ? PAL.red : fr > 0.8 ? PAL.amber : PAL.green; const hh = gh * Math.min(1, fr); g.fillRect(gx, gy + gh - hh, 6, hh);
    g.fillStyle = PAL.dim; g.font = FONT(8); g.textAlign = 'left'; g.fillText('AoA', gx - 1, gy - 7);
    // vertical speed scale (right edge)
    const vx = AX + AW - 14, vy = CY, vk = Math.max(-1, Math.min(1, Math.sign(s.vs) * Math.sqrt(Math.abs(s.vs) / 10)));
    g.strokeStyle = PAL.line; g.beginPath(); g.moveTo(vx + 4, vy - 80); g.lineTo(vx + 4, vy + 80); g.stroke();
    for (const t of [-5, -2, 0, 2, 5]) { const y = vy - Math.sign(t) * Math.sqrt(Math.abs(t) / 10) * 80; g.beginPath(); g.moveTo(vx + 1, y); g.lineTo(vx + 7, y); g.stroke(); }
    g.fillStyle = PAL.green; g.beginPath(); g.moveTo(vx - 5, vy - vk * 80); g.lineTo(vx + 4, vy - vk * 80 - 4); g.lineTo(vx + 4, vy - vk * 80 + 4); g.fill();
    g.strokeStyle = PAL.line; g.lineWidth = 1; rr(g, AX, AY, AW, AH, 10); g.stroke();
  }
  compass(g, s) {
    const x0 = AX, w = AW, y0 = 5, h = 24, ppd = 3.4; g.save(); rr(g, x0, y0, w, h, 8); g.clip(); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0, y0, w, h);
    g.font = FONT(9); g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 1;
    const card = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
    for (let d = Math.floor((s.hdg - 50) / 5) * 5; d <= s.hdg + 50; d += 5) {
      const x = x0 + w / 2 + (d - s.hdg) * ppd, n = ((d % 360) + 360) % 360, big = n % 10 === 0;
      g.strokeStyle = PAL.line; g.beginPath(); g.moveTo(x, y0 + h); g.lineTo(x, y0 + h - (big ? 7 : 4)); g.stroke();
      if (big && n % 30 === 0) { g.fillStyle = card[n] ? PAL.txt : PAL.dim; g.fillText(card[n] || String(n / 10), x, y0 + 8); }
    }
    if (s.brg != null) { let d = ((s.brg - s.hdg + 540) % 360) - 180; const edge = Math.abs(d) > 48; d = Math.max(-48, Math.min(48, d)); const x = x0 + w / 2 + d * ppd; g.fillStyle = PAL.mag; g.beginPath(); if (edge) { const sg = Math.sign(d); g.moveTo(x, y0 + 12); g.lineTo(x - sg * 8, y0 + 7); g.lineTo(x - sg * 8, y0 + 17); } else { g.moveTo(x, y0 + h - 2); g.lineTo(x - 5, y0 + h - 10); g.lineTo(x, y0 + h - 18); g.lineTo(x + 5, y0 + h - 10); } g.fill(); }
    g.restore();
    g.fillStyle = PAL.panel; rr(g, x0 + w / 2 - 22, y0 - 1, 44, 17, 5); g.fill(); g.strokeStyle = PAL.cyan; g.lineWidth = 1; g.stroke();
    g.fillStyle = PAL.txt; g.font = FONT(12, 700); g.textAlign = 'center'; g.fillText(String(Math.round(s.hdg + 360) % 360).padStart(3, '0') + '\u00b0', x0 + w / 2, y0 + 8);
  }
  speedTape(g, s) {
    const x0 = 3, w = 70, ppm = 5.8, ppu = ppm / s.spdK, step = s.spdUnit === 'km/h' ? 20 : 10, v = s.spd * s.spdK;
    g.save(); rr(g, x0, AY, w, AH, 10); g.clip(); g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x0, AY, w, AH);
    const yy = m => CY - (m - s.spd) * ppm, b = s.bands;
    // bands: red = below flaps-down stall, white = flap range, green = normal range
    const band = (m0, m1, x, bw, col) => { const a = yy(m1), z = yy(m0); g.fillStyle = col; g.fillRect(x, a, bw, z - a); };
    band(0, b.vs0, x0 + w - 5, 5, PAL.red); band(b.vs0, b.vfeLast, x0 + w - 9, 4, '#f4f7f7'); band(b.vs1, b.vs1 * 2.6, x0 + w - 5, 5, PAL.green);
    g.font = FONT(10); g.textAlign = 'right'; g.textBaseline = 'middle'; g.lineWidth = 1;
    const span = (AH / 2 + 12) / ppu;
    for (let u = Math.max(0, Math.floor((v - span) / step) * step); u <= v + span; u += step) { const y = CY - (u - v) * ppu; g.strokeStyle = PAL.line; g.beginPath(); g.moveTo(x0 + w - 11, y); g.lineTo(x0 + w - 17, y); g.stroke(); g.fillStyle = PAL.txt; g.fillText(String(u), x0 + w - 21, y); }
    if (s.bands.vfeCur && isFinite(s.bands.vfeCur)) { const y = yy(s.bands.vfeCur); g.fillStyle = PAL.cyan; g.beginPath(); g.moveTo(x0 + w - 10, y); g.lineTo(x0 + w - 18, y - 4); g.lineTo(x0 + w - 18, y + 4); g.fill(); g.font = FONT(8); g.textAlign = 'left'; g.fillText('Vfe', x0 + 3, y); }
    g.restore();
    g.strokeStyle = PAL.line; rr(g, x0, AY, w, AH, 10); g.stroke();
    const low = s.spd < s.bands.vs1 * 1.1 && !s.onGround; g.fillStyle = '#000'; rr(g, x0 + 6, CY - 12, 50, 24, 5); g.fill(); g.strokeStyle = low ? PAL.amber : PAL.green; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = low ? PAL.amber : PAL.txt; g.font = FONT(16, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.round(v)), x0 + 31, CY + 1);
    g.fillStyle = PAL.dim; g.font = FONT(9); g.fillText(s.spdUnit, x0 + 31, AY + AH - 9);
  }
  altTape(g, s) {
    const x0 = W - 73, w = 70, step = s.altUnit === 'ft' ? 100 : 25, ppu = 30 / step, alt = s.alt * s.altK, gnd = (s.alt - s.agl) * s.altK;
    g.save(); rr(g, x0, AY, w, AH, 10); g.clip(); g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(x0, AY, w, AH);
    const yg = CY - (gnd - alt) * ppu; if (yg < AY + AH) { g.fillStyle = 'rgba(124,91,52,.75)'; g.fillRect(x0, Math.max(yg, AY), w, AY + AH - Math.max(yg, AY)); g.strokeStyle = PAL.amber; g.beginPath(); g.moveTo(x0, yg); g.lineTo(x0 + w, yg); g.stroke(); }
    g.font = FONT(10); g.textAlign = 'left'; g.textBaseline = 'middle'; g.lineWidth = 1;
    const span = (AH / 2 + 12) / ppu, m = step / 5;
    for (let u = Math.floor((alt - span) / m) * m; u <= alt + span; u += m) { const y = CY - (u - alt) * ppu, major = Math.abs(u % step) < 1e-6; g.strokeStyle = PAL.line; g.beginPath(); g.moveTo(x0 + 3, y); g.lineTo(x0 + (major ? 12 : 7), y); g.stroke(); if (major) { g.fillStyle = PAL.txt; g.fillText(String(Math.round(u)), x0 + 16, y); } }
    g.restore(); g.strokeStyle = PAL.line; rr(g, x0, AY, w, AH, 10); g.stroke();
    g.fillStyle = '#000'; rr(g, x0 + 8, CY - 12, 58, 24, 5); g.fill(); g.strokeStyle = PAL.green; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = PAL.txt; g.font = FONT(16, 700); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(Math.round(alt)), x0 + 37, CY + 1);
    g.fillStyle = PAL.dim; g.font = FONT(9); g.fillText(s.altUnit, x0 + 37, AY + AH - 9);
  }
  footer(g, s) {
    g.textBaseline = 'middle'; g.font = FONT(11); const y = AY + AH + 17;
    g.textAlign = 'left'; g.fillStyle = PAL.dim; g.fillText('GS', 12, y); g.fillStyle = PAL.txt; g.fillText(`${Math.round(s.gs * s.spdK)} ${s.spdUnit}`, 30, y);
    g.textAlign = 'center'; g.fillStyle = PAL.dim; g.fillText('AGL', CX - 36, y); const low = s.agl < 60 && !s.onGround; g.fillStyle = low ? PAL.amber : PAL.txt; g.fillText(s.onGround ? 'ground' : `${Math.round(s.agl * s.altK)} ${s.altUnit}`, CX + 8, y);
    g.textAlign = 'right'; g.fillStyle = PAL.dim; g.fillText('V/S', W - 96, y); g.fillStyle = s.vs < -7 && !s.onGround && s.agl < 150 ? PAL.amber : PAL.txt; g.fillText(s.vsText, W - 12, y);
  }
}
