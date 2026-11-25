import * as THREE from 'three';
import { SURFACES } from './Surfaces.js';
import { Terrain } from './Terrain.js';
import { TerrainRenderer } from './TerrainRenderer.js';
import { Scenery } from './Scenery.js';
import { layoutAirport, pavedAt, buildAirport } from './Airports.js';
import { Colliders } from './Colliders.js';

/**
 * Finite procedural archipelago: heightfield (Terrain) + chunked LOD renderer + airports + towns/roads.
 * Public API used by physics/systems: heightAt, groundHeight (incl. water surface), surfaceAt, isWater, spawnPoint, cfg, colliders.
 */
export class World {
  constructor(cfg, opts = {}) {
    this.cfg = cfg; this.terrain = new Terrain(cfg, opts); this.bounds = cfg.size / 2; this.colliders = new Colliders(); // solid statics (buildings, hangars, tower, tanks, trees)
    this.ready = this.terrain.ready || Promise.resolve();
    for (const a of cfg.airports) a._lay = layoutAirport(a);
  }
  heightAt(x, z) { return this.terrain.heightAt(x, z); }
  isWater(x, z) { return this.terrain.isWater(x, z); }
  waterLevelAt(x, z) { return this.terrain.waterLevelAt(x, z); }
  /** Solid-or-water surface height: what the wheels / floats / camera collide with. */
  groundHeight(x, z) { const h = this.terrain.heightAt(x, z), w = this.terrain.waterLevelAt(x, z, h); return h > w ? h : w; }
  /** Surface under a world point: airport paved areas / shoulder first, else by terrain (water, sand, grass, dirt, rock, snow). */
  surfaceAt(x, z) {
    for (const a of this.cfg.airports) {
      if (a.water) continue; const dx = x - a.x, dz = z - a.z; if (dx * dx + dz * dz > (a.length / 2 + 400) ** 2) continue;
      const r = a.heading * Math.PI / 180, along = dx * Math.sin(r) - dz * Math.cos(r), across = dx * Math.cos(r) + dz * Math.sin(r), k = pavedAt(a._lay, across, -along);
      if (k) return SURFACES[k === 'asphalt' || k === 'taxi' || k === 'apron' ? 'asphalt' : k] || SURFACES.asphalt;
      if (Math.abs(along) <= a.length / 2 + 12 && Math.abs(across) <= a.width / 2 + 10) return SURFACES.grass;
    }
    // sample terrain once for this point; surfaceId and the water test reuse h/slope
    const T = this.terrain, h = T.heightAt(x, z), slope = T.slopeAt(x, z);
    if (h < T.waterLevelAt(x, z) - 0.02) return SURFACES.water;
    return SURFACES[T.surfaceId(x, z, h, slope)] || SURFACES.grass;
  }
  spawnPoint(id) {
    const a = this.cfg.airports.find(p => p.id === id) || this.cfg.airports[0], r = a.heading * Math.PI / 180, s = a.length / 2 - 80;
    return { pos: new THREE.Vector3(a.x - Math.sin(r) * s, a.elev, a.z + Math.cos(r) * s), heading: r };
  }
  init(e) {
    this.e = e; this.renderer = new TerrainRenderer(this.terrain, e.scene, { colliders: this.colliders }); this.scenery = new Scenery(this.terrain, e.scene, this.colliders);
    this.airportGroups = this.cfg.airports.map(a => buildAirport(a, a._lay, e.scene, this.colliders));
    const sp = this.spawnPoint(); this.renderer.update(sp.pos, true, 2, 2); // prime only the neighbourhood; the rest streams in behind the player
  }
  update(dt, e) {
    const cam = e.camera.position;
    const moving = e.walk?.mode === 'foot' ? e.walk : (e.cargo?.driven || e.aircraft?.player);
    this.renderer.update(cam, false, 2, Infinity, moving?.vel || null); // autoload the area we are flying toward
    this.renderer.animate(dt, e);
    const w = e.env?.windVector?.(); // the returned vector is shared: sample once instead of once per airport
    const dark = e.env?.dark ?? 0;
    if (w) for (const g of this.airportGroups) {
      if (g.userData.sock) g.userData.sock.rotation.y = Math.atan2(-w.z, w.x) - g.rotation.y;
      if (g.userData.lightMat) g.userData.lightMat.color.setScalar(0.35 + 0.65 * dark); // runway and taxi lights brighten after dusk
    }
  }
  /** RGBA raster of the whole map for the map UI. */
  mapRaster(res = 768) { return this.terrain.mapRaster(res); }
}
