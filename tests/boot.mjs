// node --import ./tests/register.mjs tests/boot.mjs   : boots the real app in jsdom and exercises camera, flaps, menu, HUD.
import { JSDOM } from 'jsdom';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const dom = new JSDOM(fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8').replace(/<script type="importmap">.*?<\/script>/s, '').replace(/<script type="module".*?<\/script>/s, ''), { pretendToBeVisual: true, url: 'http://localhost:8000/?touch'});
const w = dom.window; const g = globalThis;
for (const k of ['document', 'HTMLElement', 'Element', 'Node', 'KeyboardEvent', 'PointerEvent', 'MouseEvent', 'WheelEvent', 'Event', 'DeviceOrientationEvent']) if (w[k]) Object.defineProperty(g, k, { value: w[k], configurable: true, writable: true });
Object.defineProperty(g, 'window', { value: w, configurable: true }); Object.defineProperty(g, 'navigator', { value: Object.assign(w.navigator, { getGamepads: () => [] }), configurable: true });
for (const k of ['addEventListener', 'removeEventListener', 'innerWidth', 'innerHeight', 'location', 'screen', 'getComputedStyle']) Object.defineProperty(g, k, { get: () => w[k]?.bind ? w[k].bind(w) : w[k], configurable: true });
w.innerWidth = 1280; w.innerHeight = 720; g.devicePixelRatio = 1; w.matchMedia = g.matchMedia = q => ({ matches: /pointer: coarse/.test(q) ? false : /max-width:900/.test(q) ? false : false, addEventListener() {} });
w.PointerEvent ??= w.MouseEvent; g.PointerEvent = w.PointerEvent;
for (const el of [w.HTMLElement.prototype]) { el.setPointerCapture = () => {}; el.releasePointerCapture = () => {}; }
let raf = null; g.requestAnimationFrame = cb => { raf = cb; return 1; }; g.ResizeObserver = class { observe() {} };
const errors = []; w.addEventListener('error', e => errors.push(e.error || e.message));
let T = 0; const frame = (n = 1, dt = 16.7) => { for (let i = 0; i < n; i++) { T += dt; const cb = raf; raf = null; cb(T); } };

await import('../src/main.js'); const e = w.engine; assert(e, 'engine exposed');
const $ = s => document.querySelector(s), key = (code, type = 'keydown') => w.dispatchEvent(new w.KeyboardEvent(type, { code, bubbles: true }));
// ---- boot
raf = raf || (() => {}); T = performance.now(); frame(5);
console.log('boot ok. HUD children:', $('#hud').children.length, '| map canvas present:', !!$('#map'), '| touch stick present:', !!$('.stick'), '| pfd:', !!$('#pfd'));
assert($('#map') && $('.stick') && $('#pfd') && $('#systems'), 'HUD must not wipe other modules\' elements');
console.log('plate:', $('#acName').textContent, '|', $('#acLivery').textContent, '|', $('#acWhere').textContent, '| env:', $('#clock').textContent, $('#wx').textContent, $('#windTxt').textContent);
console.log('ladder cells:', document.querySelectorAll('#ladder span').length, '| flap badge:', $('#flapMode').textContent, '| note:', $('#flapNote').textContent);

// ---- takeoff with auto flaps through the real engine loop
const ac = () => e.aircraft.player; e.input.state.throttle = 1; let log = [], lastIdx = -1;
for (let i = 0; i < 60 * 40; i++) { const a = ac(); e.input.state.pitch = 0; if (a.telemetry.airspeed > 25) { /* rotate */ } frame(1); if (a.controls.flapIndex !== lastIdx) { lastIdx = a.controls.flapIndex; log.push(`t=${(i / 60).toFixed(1)} flap=${lastIdx} (${a.flapReason}) V=${a.telemetry.airspeed.toFixed(1)}`); } }
console.log('flap log (hands off, full throttle):', log.join(' | '));
assert(ac().controls.flapIndex === 1, 'auto flaps should select takeoff flaps on the roll');
for (const c of ['Z']) ; // keep lints quiet

// ---- cameras: every mode, with drag / wheel / reset, must produce finite positions
e.input.state.throttle = 0.3; e.input.state.pitch = 0;
const cv = e.renderer.domElement; const ptr = (type, id, x, y) => cv.dispatchEvent(Object.assign(new w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true }), { pointerId: id }));
for (const m of e.cameras.modes) {
  e.cameras.set(m); frame(30); const p0 = e.camera.position.clone(), fov0 = e.camera.fov;
  ptr('pointerdown', 1, 500, 300); ptr('pointermove', 1, 620, 340); ptr('pointerup', 1, 620, 340); cv.dispatchEvent(new w.WheelEvent('wheel', { deltaY: -200, bubbles: true, cancelable: true })); frame(20);
  const v = e.cameras.view, p = e.camera.position; assert([p.x, p.y, p.z, e.camera.fov].every(Number.isFinite), `${m}: non-finite camera`);
  console.log(m.padEnd(8), 'view yaw', v.yaw.toFixed(2), 'pitch', v.pitch.toFixed(2), 'zoom', v.zoom.toFixed(2), '| moved', p.distanceTo(p0).toFixed(1), 'm | fov', e.camera.fov.toFixed(1));
  if (m !== 'flyby' && m !== 'tower') assert(Math.abs(v.yaw) > 0.1 && v.zoom < 1, `${m}: drag/wheel should change the view`);
  cv.dispatchEvent(new w.MouseEvent('dblclick', { bubbles: true })); assert(e.cameras.view.yaw === 0 && e.cameras.view.zoom === 1, `${m}: double-click resets`);
}
// held keys + two-finger pinch
e.cameras.set('chase'); key('Comma'); frame(30); key('Comma', 'keyup'); assert(e.cameras.view.yaw > 0.5, 'comma orbits left'); e.cameras.reset();
ptr('pointerdown', 1, 400, 300); ptr('pointerdown', 2, 500, 300); ptr('pointermove', 2, 600, 300); ptr('pointermove', 2, 700, 300); assert(e.cameras.view.zoom < 1, 'pinching fingers apart zooms in'); ptr('pointerup', 1, 400, 300); ptr('pointerup', 2, 700, 300);
console.log('pinch-out zoom ->', e.cameras.view.zoom.toFixed(2)); e.cameras.reset();
// chase must not roll with the aircraft
e.cameras.set('chase'); ac().quat.setFromEuler(new e.camera.rotation.constructor(0, 0, 1.0)); frame(5); const up = e.camera.up; console.log('chase camera.up while aircraft rolled 57deg:', up.x.toFixed(2), up.y.toFixed(2), up.z.toFixed(2)); assert(up.y === 1);

// ---- manual flap input switches auto off; menu pauses; world edits; aircraft switch
e.respawn?.(); e.aircraft.respawn(); frame(2);
assert(e.settings.get('autoFlaps') === true); key('KeyF'); frame(1); assert(e.settings.get('autoFlaps') === false && ac().controls.flapIndex === 1, 'F -> manual, one notch down'); key('KeyF', 'keyup');
key('Digit4'); frame(1); assert(e.settings.get('autoFlaps') === true, 'key 4 toggles auto flaps back on'); key('Digit4', 'keyup');
key('Escape'); frame(2); assert(e.paused && !$('#menu').hidden && document.body.classList.contains('menu-open'), 'Esc opens menu + pauses');
const t0 = e.time; frame(10); assert(e.time === t0, 'sim time frozen while paused');
for (const t of ['aircraft', 'flight', 'world', 'camera', 'controls', 'help']) { $(`[data-tab="${t}"]`).click(); assert($('#mbody').innerHTML.length > 200, `tab ${t} renders`); }
$('[data-tab="aircraft"]').click(); const card = [...document.querySelectorAll('.card')].find(c => c.dataset.ac === 'transport'); card.click(); frame(2); assert(ac().def.id === 'transport', 'card click switches aircraft'); console.log('switched to', ac().def.name, '| ladder cells now', document.querySelectorAll('#ladder span').length);
$('[data-tab="flight"]').click(); document.querySelector('[data-flap="2"]').click(); assert(ac().controls.flapIndex === 2 && !e.settings.get('autoFlaps'), 'menu flap button sets manual flap'); document.querySelector('[data-flap="auto"]').click(); assert(e.settings.get('autoFlaps'));
$('[data-tab="world"]').click(); const hr = $('#f-hour'); hr.value = 19; hr.dispatchEvent(new w.Event('input')); assert(e.env.hour === 19, 'time slider'); document.querySelector('[data-wx="fog"]').click(); assert(e.env.weather === 'fog');
$('[data-tab="camera"]').click(); document.querySelector('[data-cam="wing"]').click(); assert(e.cameras.mode === 'wing'); frame(3);
key('Escape'); frame(1); assert(!e.paused && $('#menu').hidden);
// ---- alerts and toasts
e.bus.emit('hud:message', 'Gear damaged'); frame(1); console.log('toast:', $('.toast')?.textContent, $('.toast')?.className);
ac().onGround = false; ac().pos.y += 40; ac().telemetry.aoa = 0.3; frame(1); console.log('alerts:', [...document.querySelectorAll('.alert')].map(a => a.textContent + (a.classList.contains('flash') ? ' (flashing)' : '')).join(', '));
// ---- map
e.bus.emit('action', 'map'); frame(2); const mp = $('#map'); mp.dispatchEvent(Object.assign(new w.MouseEvent('pointerdown', { clientX: 640, clientY: 300 }), {})); console.log('map big:', e.map.big, 'route pts:', e.map.route.length);
frame(3); fs.mkdirSync('/tmp/shots', { recursive: true });
const save = (el, n) => fs.writeFileSync(`/tmp/shots/${n}.png`, Buffer.from(el.toDataURL('image/png').split(',')[1], 'base64'));
save($('#map'), 'bigmap'); e.bus.emit('action', 'map'); frame(2); save($('#map'), 'minimap'); save($('#pfd'), 'pfd-live');
console.log('renderer frames drawn:', e.renderer.calls, '| page errors:', errors.length); if (errors.length) console.log(errors); 
console.log('ALL BOOT CHECKS PASSED'); process.exit(0);
