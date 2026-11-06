import * as THREE from 'three';
import { SURFACES } from './Surfaces.js';
const { clamp, lerp, smoothstep } = THREE.MathUtils;

/** Procedural islands + sea + airports from worldConfig. Exposes heightAt / groundHeight / spawnPoint. */
export class World {
  constructor(cfg) { this.cfg = cfg; }
  noise(x, z) { return 0.5 + 0.25 * Math.sin(x * 0.0013) * Math.cos(z * 0.0011) + 0.25 * Math.sin(x * 0.0041 + z * 0.0037); }
  heightAt(x, z) {
    let h = -30;
    for (const i of this.cfg.islands) {
      const d = Math.hypot(x - i.x, z - i.z) / i.r;
      h = Math.max(h, -3 + 12 * clamp((1 - d) * 6, 0, 1) + i.h * Math.max(0, 1 - d * 1.2) ** 2 * (0.5 + 0.5 * this.noise(x, z)) * (d < 1 ? 1 : 0));
    }
    for (const a of this.cfg.airports) {
      const r = a.heading * Math.PI / 180, dx = x - a.x, dz = z - a.z;
      const along = dx * Math.sin(r) - dz * Math.cos(r), across = dx * Math.cos(r) + dz * Math.sin(r);
      const d = Math.hypot(Math.max(Math.abs(across) - a.width / 2 - 60, 0), Math.max(Math.abs(along) - a.length / 2 - 100, 0));
      h = lerp(h, a.elev, smoothstep(1 - d / 300, 0, 1));
    }
    return h;
  }
  /** Surface under a world point: runway (airport.surface, default asphalt) + grass shoulder, else by terrain height / patchy noise. */
  surfaceAt(x, z) {
    for (const a of this.cfg.airports) {
      const r = a.heading * Math.PI / 180, dx = x - a.x, dz = z - a.z, along = Math.abs(dx * Math.sin(r) - dz * Math.cos(r)), across = Math.abs(dx * Math.cos(r) + dz * Math.sin(r));
      if (along <= a.length / 2 + 12 && across <= a.width / 2 + 10) return along <= a.length / 2 && across <= a.width / 2 ? SURFACES[a.surface || 'asphalt'] : SURFACES.grass;
    }
    const h = this.heightAt(x, z);
    if (h < 0.15) return SURFACES.water; if (h < 2.5) return SURFACES.sand; if (h < 150) return this.noise(x * 2.3, z * 2.3) > 0.82 ? SURFACES.dirt : SURFACES.grass; return SURFACES.rock;
  }
  isWater(x, z) { return this.heightAt(x, z) < 0.15; }
  groundHeight(x, z) { return Math.max(0, this.heightAt(x, z)); } // sea level = 0 (water landings: extend here)
  spawnPoint(id) {
    const a = this.cfg.airports.find(p => p.id === id) || this.cfg.airports[0], r = a.heading * Math.PI / 180, s = a.length / 2 - 80;
    return { pos: new THREE.Vector3(a.x - Math.sin(r) * s, a.elev, a.z + Math.cos(r) * s), heading: r };
  }
  init(e) {
    const { size, segments } = this.cfg, g = new THREE.PlaneGeometry(size, size, segments, segments); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), h = this.heightAt(x, z); p.setY(i, h);
      const sf = this.surfaceAt(x, z); c.set(sf.id === 'rock' && h > 300 ? 0xe6e6e6 : sf.id === 'water' ? 0xd8c98f : sf.color).offsetHSL(0, 0, (this.noise(x * 3, z * 3) - 0.5) * 0.1);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    const land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })); land.receiveShadow = true; e.scene.add(land);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d5f8a, roughness: 0.25, metalness: 0.1 }));
    e.scene.add(sea);
    const mats = { asphalt: new THREE.MeshStandardMaterial({ color: 0x35373a, roughness: 0.9 }), grass: new THREE.MeshStandardMaterial({ color: 0x6aa045, roughness: 1 }), dirt: new THREE.MeshStandardMaterial({ color: 0x9a7b52, roughness: 1 }) }, paint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const a of this.cfg.airports) {
      const kind = a.surface || 'asphalt', grp = new THREE.Group(); grp.position.set(a.x, a.elev + 0.06, a.z); grp.rotation.y = -a.heading * Math.PI / 180;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(a.width, 0.1, a.length), mats[kind]); slab.receiveShadow = true; grp.add(slab);
      if (kind === 'asphalt') for (let z = -a.length / 2 + 40; z < a.length / 2 - 20; z += 50) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 25), paint); m.position.set(0, 0.08, z); grp.add(m); }
      else for (let z = -a.length / 2 + 30; z < a.length / 2 - 10; z += 40) { const m = new THREE.Mesh(new THREE.BoxGeometry(a.width * 0.6, 0.04, 1.2), new THREE.MeshBasicMaterial({ color: kind === 'grass' ? 0xe8e8d0 : 0xd9c9a8 })); m.position.set(0, 0.08, z); grp.add(m); }
      for (const side of [-1, 1]) for (let z = -a.length / 2 + 10; z <= a.length / 2; z += 60) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ color: 0xfff2c0 })); l.position.set(side * (a.width / 2 + 1), 0.2, z); grp.add(l); }
      e.scene.add(grp);
    }
  }
}
