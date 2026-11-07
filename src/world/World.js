import * as THREE from 'three';
import { SURFACES } from './Surfaces.js';
import { Terrain } from './Terrain.js';
import { TerrainRenderer } from './TerrainRenderer.js';
import { Scenery } from './Scenery.js';
import { layoutAirport, pavedAt, buildAirport } from './Airports.js';

/**
 * Finite procedural archipelago: heightfield (Terrain) + chunked LOD renderer + airports + towns/roads.
 * Public API used by physics/systems: heightAt, groundHeight (incl. water surface), surfaceAt, isWater, spawnPoint, cfg.
 */
export class World {
  constructor(cfg) {
    this.cfg = cfg; this.terrain = new Terrain(cfg); this.bounds = cfg.size / 2;
    for (const a of cfg.airports) a._lay = layoutAirport(a);
  }
  heightAt(x, z) { return this.terrain.heightAt(x, z); }
  isWater(x, z) { return this.terrain.isWater(x, z); }
  waterLevelAt(x, z) { return this.terrain.waterLevelAt(x, z); }
  /** Solid-or-water surface height: what the wheels / floats / camera collide with. */
  groundHeight(x, z) { const h = this.terrain.heightAt(x, z), w = this.terrain.waterLevelAt(x, z); return h > w ? h : w; }
  /** Surface under a world point: airport paved areas / shoulder first, else by terrain (water, sand, grass, dirt, rock, snow). */
  surfaceAt(x, z) {
    for (const a of this.cfg.airports) {
      if (a.water) continue; const dx = x - a.x, dz = z - a.z; if (dx * dx + dz * dz > (a.length / 2 + 400) ** 2) continue;
      const r = a.heading * Math.PI / 180, along = dx * Math.sin(r) - dz * Math.cos(r), across = dx * Math.cos(r) + dz * Math.sin(r), k = pavedAt(a._lay, across, -along);
      if (k) return SURFACES[k === 'asphalt' || k === 'taxi' || k === 'apron' ? 'asphalt' : k] || SURFACES.asphalt;
      if (Math.abs(along) <= a.length / 2 + 12 && Math.abs(across) <= a.width / 2 + 10) return SURFACES.grass;
    }
    if (this.terrain.isWater(x, z)) return SURFACES.water;
    return SURFACES[this.terrain.surfaceId(x, z)] || SURFACES.grass;
  }
  spawnPoint(id) {
    const a = this.cfg.airports.find(p => p.id === id) || this.cfg.airports[0], r = a.heading * Math.PI / 180, s = a.length / 2 - 80;
    return { pos: new THREE.Vector3(a.x - Math.sin(r) * s, a.elev, a.z + Math.cos(r) * s), heading: r };
  }
  init(e) {
    this.e = e; this.renderer = new TerrainRenderer(this.terrain, e.scene); this.scenery = new Scenery(this.terrain, e.scene);
    this.airportGroups = this.cfg.airports.map(a => buildAirport(a, a._lay, e.scene));
    const sp = this.spawnPoint(); this.renderer.update(sp.pos, true); this._lastBuild = 0;
  }
  update(dt, e) {
    const cam = e.camera.position; this.renderer.update(cam); this.renderer.animate(dt);
    for (const g of this.airportGroups) if (g.userData.sock) { const w = e.env?.windVector?.(); if (w) g.userData.sock.rotation.y = Math.atan2(-w.z, w.x) - g.rotation.y; }
  }
  /** RGBA raster of the whole map for the map UI. */
  mapRaster(res = 768) { return this.terrain.mapRaster(res); }
}
