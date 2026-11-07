// node --import ./tests/register.mjs tests/features.mjs : autopilot, key rebinding and settings persistence.
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';
import { effectiveMap } from '../src/input/KeyboardInput.js';
const { e, frame, key, errors } = await boot();

// --- rebinding: pure map logic
const m = effectiveMap({ gear: 'KeyX', lights: null });
assert.equal(m.KeyX, 'gear'); assert(!Object.values(m).includes('lights'), 'unbound action disappears'); assert.notEqual(m.KeyG, 'gear', 'old default key released');
e.settings.set('bindings', { gear: 'KeyH' }, true); frame(1);
const seen = []; e.bus.on('action', a => seen.push(a)); key('KeyH'); key('KeyH', 'keyup'); assert(seen.includes('gear'), 'rebound key fires the action'); e.settings.set('bindings', {}, true);

// --- persistence through a fake localStorage
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
e.settings.set('volume', 0.33, true); assert(JSON.parse(store['vimanax.settings']).volume === 0.33, 'saved');
const S = e.settings.constructor; const s2 = new S(); assert.equal(s2.get('volume'), 0.33, 'restored by a new Settings instance');
delete globalThis.localStorage;

// --- autopilot holds altitude and heading
const ac = e.aircraft.player; e.aircraft.respawn('light-prop', 0); frame(5); const p = e.aircraft.player;
p.pos.set(0, 800, 3000); p.quat.identity(); p.vel.set(0, 0, -45); p.onGround = false; p.controls.gearDown = false; e.input.state.throttle = 0.7; frame(60);
e.bus.emit('action', 'autopilot'); assert(e.autopilot.on, 'engaged in the air'); const alt0 = p.pos.y;
e.autopilot.hdg += 0.5; // ask for a ~29 degree right turn
for (let i = 0; i < 40 * 60; i++) frame(1);
const k = e.autopilot.read(p), err = Math.abs(Math.atan2(Math.sin(e.autopilot.hdg - k.hdg), Math.cos(e.autopilot.hdg - k.hdg)));
console.log('AP: alt drift', (p.pos.y - alt0).toFixed(1), 'm | heading error', (err * 57.3).toFixed(1), 'deg | speed', p.vel.length().toFixed(1), '| destroyed', p.destroyed);
assert(!p.destroyed && Math.abs(p.pos.y - alt0) < 60, 'altitude held'); assert(err < 0.12, 'heading captured');
e.bus.emit('action', 'autopilot'); assert(!e.autopilot.on, 'disengages');
assert.equal(errors.length, 0); console.log('ALL FEATURE CHECKS PASSED');
