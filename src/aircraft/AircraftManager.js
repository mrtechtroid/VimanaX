import { skinAircraft } from './GltfSkin.js';
import { Aircraft } from './Aircraft.js';

/** Spawns/updates aircraft using an injected IFlightModel and aircraft Registry. engine.aircraft.player = controlled one. */
export class AircraftManager {
  constructor(model, registry) { this.model = model; this.registry = registry; this.list = []; this.player = null; }
  init(e) {
    this.e = e;
    e.bus.on('action', a => {
      if (!this.player) return;
      if (a === 'nextAircraft') { const ids = this.registry.ids(); this.respawn(ids[(ids.indexOf(this.player.def.id) + 1) % ids.length], 0); }
      else if (a === 'nextLivery') this.respawn(null, (this.player.livery + 1) % this.player.def.liveries.length);
      else if (a === 'reset') this.respawn();
    });
  }
  spawn(id, livery = 0, airport) {
    const def = this.registry.get(id), ac = new Aircraft(def, livery), w = this.e.world, sp = w.spawnPoint(airport);
    ac.bus = this.e.bus; ac.airport = airport; ac.place(sp.pos.x, w.groundHeight(sp.pos.x, sp.pos.z) + def.flight.gearHeight, sp.pos.z, sp.heading);
    this.e.scene.add(ac.mesh); skinAircraft(ac, this.e); this.list.push(ac); this.player = this.player ?? ac; this.e.bus.emit('aircraft:spawn', ac); return ac;
  }
  respawn(id, livery) {
    const old = this.player; id ??= old.def.id; livery ??= old.livery;
    this.e.scene.remove(old.mesh); this.list = this.list.filter(a => a !== old);
    this.e.input.state.throttle = 0; this.player = this.spawn(id, livery, old.airport);
    this.e.bus.emit('hud:message', `${this.player.def.name} - ${this.player.def.liveries[livery].name}`);
  }
  update(dt, e) {
    const n = Math.ceil(dt * 120), h = dt / n;
    for (const a of this.list) { for (let i = 0; i < n; i++) this.model.step(a, h, e.env, e.world); a.animate(dt, e.time, e, a === this.player && e.cameras?.inside); }
  }
}
