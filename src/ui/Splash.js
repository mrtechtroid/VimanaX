import { effectiveMap } from '../input/KeyboardInput.js';
import { pretty } from './Rebind.js';

const $ = id => document.getElementById(id);
const STEPS = ['engine', 'world', 'sky', 'aircraft', 'ui'];

/** Boot progress. Plain DOM so it works before the engine exists: main.js calls bootStep() between the heavy construction steps. */
export function bootStep(id) {
  const root = $('splash'), i = STEPS.indexOf(id); if (!root || i < 0) return;
  root.querySelectorAll('[data-step]').forEach(li => { const j = STEPS.indexOf(li.dataset.step); li.dataset.state = j < i ? 'done' : j === i ? 'active' : 'todo'; });
  const bar = $('spBar'); if (bar) bar.style.width = Math.round(6 + i / STEPS.length * 94) + '%';
}
/** Fine-grained progress while the terrain heightfield is generated (0..1 within the current step). */
export function bootProgress(step, f) {
  const bar = $('spBar'); if (!bar) return;
  const i = STEPS.indexOf(step); if (i < 0) return;
  bar.style.width = Math.round(6 + (i + f) / STEPS.length * 94) + '%';
}
export function bootDone() {
  const root = $('splash'); if (!root) return; root.querySelectorAll('[data-step]').forEach(li => { li.dataset.state = 'done'; });
  const bar = $('spBar'); if (bar) bar.style.width = '100%';
}
/** Let the browser paint the splash between boot steps. Falls back to a timer so it can never hang (headless, background tab). */
export const bootYield = () => new Promise(r => { let done = false; const f = () => { if (!done) { done = true; r(); } }; try { requestAnimationFrame(() => setTimeout(f, 0)); } catch { /* no rAF */ } setTimeout(f, 60); });

const rwy = h => String(Math.round(h / 10) % 36 || 36).padStart(2, '0');

/** Start screen: loading checklist, then "where you are + how to fly" and one big Fly button.
 *  The button is the user gesture that unlocks audio, goes fullscreen on phones and keeps the screen awake.
 *  Also owns the pause holds for a hidden tab and a phone held in portrait. Skipped with ?autostart (and under jsdom). */
export class Splash {
  init(e) {
    this.e = e; this.open = false; this.lifecycle();
    const el = this.el = $('splash'); if (!el) return;
    if (/[?&]autostart\b/.test(location.search) || /jsdom/i.test(navigator.userAgent)) { el.remove(); return; }
    this.open = true; document.body.classList.add('splash-open', 'menu-open'); e.hold('start');
    this.render(); bootDone(); el.classList.add('ready'); $('spReady').hidden = false;
    const refocus = () => setTimeout(() => { if (this.open && !e.menu?.isOpen) $('spGo')?.focus({ preventScroll: true }); }, 0); // Enter / Space then starts the flight
    e.bus.on('aircraft:spawn', () => { if (this.open) { this.render(); refocus(); } }); e.bus.on('action', a => { if (a === 'menu') refocus(); });
    queueMicrotask(() => $('spGo')?.focus({ preventScroll: true }));
  }
  render() {
    const e = this.e, S = e.settings, p = e.aircraft.player, B = document.body.classList, coarse = B.contains('coarse');
    const ap = e.world.cfg.airports.find(a => a.id === p.airport) || e.world.cfg.airports[0], map = effectiveMap(S.get('bindings')), key = a => { const c = Object.keys(map).find(k => map[k] === a); return c ? pretty(c) : '-'; };
    const rows = coarse ? [['Left pad', 'Pitch and roll. Pull down to climb.'], ['Right slider', 'Engine power'], ['\u25c0 \u25b6', 'Rudder and nose wheel'], ['Drag view', 'Look around, pinch to zoom']]
      : [['W S', 'Pitch'], ['A D', 'Roll'], ['Q E', 'Rudder'], ['Z X', 'Throttle'], ['Space', 'Brake'], [key('gear'), 'Landing gear'], [key('camera'), 'Camera'], ['Esc', 'Menu']];
    const [name] = p.def.name.split(' (');
    $('spReady').innerHTML = `<div class="sp-where"><b>${name}</b><span>${ap.name}, runway ${rwy(ap.heading)} (${ap.length} m)</span></div>
      <ul class="sp-keys">${rows.map(([k, d]) => `<li><kbd>${k}</kbd><span>${d}</span></li>`).join('')}</ul>
      <div class="sp-act"><button class="sp-go" id="spGo" type="button">Fly</button><button class="sp-alt" id="spAc" type="button">Choose aircraft</button></div>
      <p class="sp-note">${coarse ? 'Hold the phone sideways. Tilt steering and control layout are in the menu.' : `Take off with full power, then pull back gently. Press ${key('help')} any time for every key.`}</p>`;
    $('spGo').onclick = () => this.go(); $('spAc').onclick = () => { e.menu.show('aircraft'); e.menu.toggle(true); };
  }
  go() {
    if (!this.open) return; this.open = false; const e = this.e, S = e.settings, B = document.body.classList, coarse = B.contains('coarse');
    B.remove('splash-open'); if (!e.menu?.isOpen) B.remove('menu-open'); e.hold('start', false); e.bus.emit('audio:unlock');
    this.el.classList.add('leaving'); setTimeout(() => this.el.remove(), 600); S.set('introSeen', true, true);
    if (coarse && S.get('fullscreenOnStart')) this.fullscreen();
    if (S.get('keepAwake')) this.keepAwake();
    if (coarse) setTimeout(() => e.bus.emit('hud:message', 'Drag the view to look around. Pinch to zoom.'), 700);
  }
  async fullscreen() {
    try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* iOS Safari has no element fullscreen */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* only allowed in fullscreen, Android */ }
  }
  async keepAwake() {
    if (!('wakeLock' in navigator)) return; const take = async () => { try { this.lock = await navigator.wakeLock.request('screen'); } catch { /* low battery / denied */ } };
    await take(); document.addEventListener('visibilitychange', () => { if (!document.hidden && (!this.lock || this.lock.released)) take(); });
  }
  /** Pause reasons that are not the menu: a hidden tab, and a phone held upright (the touch layout needs landscape). */
  lifecycle() {
    const e = this.e, B = document.body.classList;
    document.getElementById('hud').insertAdjacentHTML('beforeend', '<div id="rotate" role="alert"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18.5h2"/></svg><b>Turn your phone sideways</b><span>VimanaX plays in landscape. The flight is paused until you do.</span></div>');
    const apply = () => { const on = B.contains('coarse') && Math.min(innerWidth, innerHeight) < 600 && innerHeight > innerWidth; B.toggle('portrait-block', on); e.hold('portrait', on); };
    addEventListener('resize', apply); addEventListener('orientationchange', apply); apply();
    document.addEventListener('visibilitychange', () => e.hold('hidden', document.hidden));
  }
}
