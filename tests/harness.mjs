// Boots the real app in jsdom with a stubbed WebGL renderer. `const { e, w, frame, key, $ } = await boot()`
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
export async function boot(search = '?touch') {
  const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script type="importmap">.*?<\/script>/s, '').replace(/<script type="module".*?<\/script>/s, ''), { pretendToBeVisual: true, url: 'http://localhost:8000/' + search });
  const w = dom.window, g = globalThis;
  for (const k of ['document', 'HTMLElement', 'Element', 'Node', 'KeyboardEvent', 'PointerEvent', 'MouseEvent', 'WheelEvent', 'Event']) if (w[k]) Object.defineProperty(g, k, { value: w[k], configurable: true, writable: true });
  Object.defineProperty(g, 'window', { value: w, configurable: true }); Object.defineProperty(g, 'navigator', { value: Object.assign(w.navigator, { getGamepads: () => [] }), configurable: true });
  for (const k of ['addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight', 'location', 'screen', 'getComputedStyle']) Object.defineProperty(g, k, { get: () => w[k]?.bind ? w[k].bind(w) : w[k], configurable: true });
  w.innerWidth = 1280; w.innerHeight = 720; g.devicePixelRatio = 1; w.matchMedia = g.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.PointerEvent ??= w.MouseEvent; g.PointerEvent = w.PointerEvent; w.HTMLElement.prototype.setPointerCapture = () => {}; w.HTMLElement.prototype.releasePointerCapture = () => {};
  let raf = null; g.requestAnimationFrame = cb => { raf = cb; return 1; }; g.ResizeObserver = class { observe() {} };
  const errors = []; w.addEventListener('error', e => errors.push(e.error || e.message)); let T = performance.now();
  await import('../src/main.js'); const e = w.engine;
  const frame = (n = 1, dt = 16.7) => { for (let i = 0; i < n; i++) { T += dt; const cb = raf; raf = null; cb(T); } };
  const key = (code, type = 'keydown') => w.dispatchEvent(new w.KeyboardEvent(type, { code, bubbles: true })), $ = s => document.querySelector(s);
  const press = (code, frames = 2) => { key(code); frame(frames); key(code, 'keyup'); };
  const hold = (code, frames) => { key(code); frame(frames); key(code, 'keyup'); frame(1); };
  frame(5); return { e, w, frame, key, $, press, hold, errors };
}
