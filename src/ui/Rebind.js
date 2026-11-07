import { REBINDABLE, effectiveMap } from '../input/KeyboardInput.js';

const pretty = c => c.replace(/^Key|^Digit/, '').replace('BracketLeft', '[').replace('BracketRight', ']').replace('Backspace', 'Bksp').replace('Arrow', 'Arrow ');
/** Key-rebinding panel for the Keys tab. Click a row, press a key (Esc cancels). Persisted through Settings.bindings. */
export function rebindHTML(settings) {
  const map = effectiveMap(settings.get('bindings')), key = a => Object.keys(map).find(c => map[c] === a);
  return `<h3>Rebind keys</h3><p class="lead">Click an action, then press the new key. Esc cancels.</p><div class="keys rebind">${Object.entries(REBINDABLE).map(([a, l]) => `<div><span>${l}</span><button class="kbtn" data-rebind="${a}"><kbd>${key(a) ? pretty(key(a)) : '-'}</kbd></button></div>`).join('')}</div><p><button class="kbtn" data-rebind-reset>Reset all keys</button></p>`;
}
export function wireRebind(root, e, refresh) {
  const s = e.settings;
  root.querySelectorAll('[data-rebind]').forEach(b => b.onclick = () => {
    const action = b.dataset.rebind; b.firstElementChild.textContent = 'press a key...';
    const h = ev => {
      ev.preventDefault(); ev.stopPropagation(); removeEventListener('keydown', h, true);
      if (ev.code !== 'Escape') { const cur = { ...s.get('bindings') }; const map = effectiveMap(cur); const clash = map[ev.code]; if (clash && clash !== action) cur[clash] = null; cur[action] = ev.code; s.set('bindings', cur, true); }
      refresh();
    };
    addEventListener('keydown', h, true);
  });
  root.querySelector('[data-rebind-reset]')?.addEventListener('click', () => { s.set('bindings', {}, true); refresh(); });
}
