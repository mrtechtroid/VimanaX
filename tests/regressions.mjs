// node --import ./tests/register.mjs tests/regressions.mjs : regression checks for bugs fixed in the v0.5 refinement pass.
import assert from 'node:assert/strict';
import { boot } from './harness.mjs';
const { e, frame, key, errors } = await boot();

// 1) Two rebind rows clicked in a row: only the latest one takes the key. The stale capture used to run too and unbind gear.
e.settings.set('bindings', {}, true); e.menu.toggle(true); e.menu.show('help'); frame(2);
const rows = [...document.querySelectorAll('[data-rebind]')];
const a = rows.find(b => b.dataset.rebind === 'gear'), b2 = rows.find(b => b.dataset.rebind === 'lights');
assert(a && b2, 'rebind rows present');
a.click(); b2.click();          // start rebinding gear, then lights, without pressing a key in between
key('KeyJ'); frame(1); key('KeyJ', 'keyup');
const bind = e.settings.get('bindings'), owners = Object.keys(bind).filter(k => bind[k] === 'KeyJ');
console.log('bindings after one key press:', JSON.stringify(bind));
assert.equal(owners.length, 1, 'one key binds exactly one action');
assert.equal(owners[0], 'lights', 'the most recent rebind row is the one that receives the key');
assert.notEqual(bind.gear, null, 'the abandoned rebind (gear) must keep its binding, not be silently unbound');
e.menu.toggle(false); frame(1);

// 2) Respawning replaces the aircraft cleanly: the old one is marked dead and removed from the scene.
const old = e.aircraft.player; e.aircraft.respawn('light-prop', 1); frame(2);
assert(old.dead === true, 'old aircraft marked dead');
assert(!e.scene.children.includes(old.mesh), 'old aircraft mesh removed from the scene');
assert(e.aircraft.player !== old && e.aircraft.player.def.id === 'light-prop', 'new aircraft is the player');

assert.equal(errors.length, 0, 'no page errors');
console.log('ALL REGRESSION CHECKS PASSED');
