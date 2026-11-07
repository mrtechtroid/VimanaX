// No native canvas in CI: give every <canvas> a permissive no-op 2D context so UI/texture code can run headless.
export function installCanvasStub(w) {
  const noop2d = () => { const fns = { measureText: () => ({ width: 0 }), getImageData: (x, y, ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)), width: ww, height: hh }), createImageData: (ww, hh) => ({ data: new Uint8ClampedArray(Math.max(1, ww * hh * 4)), width: ww, height: hh }) }; let ctx; const grad = { addColorStop() {} }; ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : k in fns ? fns[k] : (k === 'createRadialGradient' || k === 'createLinearGradient' || k === 'createPattern') ? () => grad : typeof k === 'symbol' ? undefined : (...a) => undefined), set: (t, k, v) => { t[k] = v; return true; } }); return ctx; };
  w.HTMLCanvasElement.prototype.getContext = function () { return this._ctx ??= noop2d(); };
  if (!w.ImageData) w.ImageData = class { constructor(d, ww, hh) { this.data = d; this.width = ww; this.height = hh; } };
}
