import * as THREE from 'three';
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
  groundHeight(x, z) { return Math.max(0, this.heightAt(x, z)); } // sea level = 0 (water landings: extend here)
  spawnPoint(id) {
    const a = this.cfg.airports.find(p => p.id === id) || this.cfg.airports[0], r = a.heading * Math.PI / 180, s = a.length / 2 - 80;
    return { pos: new THREE.Vector3(a.x - Math.sin(r) * s, a.elev, a.z + Math.cos(r) * s), heading: r };
  }
  init(e) {
    const { size, segments } = this.cfg, g = new THREE.PlaneGeometry(size, size, segments, segments); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, col = new Float32Array(p.count * 3), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const h = this.heightAt(p.getX(i), p.getZ(i)); p.setY(i, h);
      c.set(h < 2 ? 0xd8c98f : h < 150 ? 0x4f7f3a : h < 300 ? 0x7a6f5f : 0xe6e6e6).offsetHSL(0, 0, (this.noise(p.getX(i) * 3, p.getZ(i) * 3) - 0.5) * 0.08);
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
    e.scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1d5f8a }));
    e.scene.add(sea);
    const asphalt = new THREE.MeshLambertMaterial({ color: 0x35373a }), paint = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const a of this.cfg.airports) {
      const grp = new THREE.Group(); grp.position.set(a.x, a.elev + 0.06, a.z); grp.rotation.y = -a.heading * Math.PI / 180;
      grp.add(new THREE.Mesh(new THREE.BoxGeometry(a.width, 0.1, a.length), asphalt));
      for (let z = -a.length / 2 + 40; z < a.length / 2 - 20; z += 50) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 25), paint); m.position.set(0, 0.08, z); grp.add(m); }
      e.scene.add(grp);
    }
  }
}
