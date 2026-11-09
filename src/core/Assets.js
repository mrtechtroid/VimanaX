import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

/** glTF assets bundled in assets/models (see assets/CREDITS.md). Every consumer has a procedural fallback, so a failed/slow load is never fatal. */
export const MODELS = { soldier: 'assets/models/Soldier.glb', ferrari: 'assets/models/ferrari.glb', truck: 'assets/models/CesiumMilkTruck.glb',
  pa28: 'assets/models/aircraft/pa28.glb', citation: 'assets/models/aircraft/citation.glb', atr42: 'assets/models/aircraft/atr42.glb', b738: 'assets/models/aircraft/b738.glb' };
/** Aircraft skins load on demand (when that aircraft is spawned), everything else at start-up. */
const LAZY = new Set(['pa28', 'citation', 'atr42', 'b738']);
export class Assets {
  constructor(models = MODELS) { this.models = models; this.cache = {}; this.pending = {}; }
  init(e) {
    this.e = e; if (typeof document === 'undefined' || typeof Worker === 'undefined') return; // headless: stay on fallbacks
    const draco = new DRACOLoader(); draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    this.loader = new GLTFLoader(); this.loader.setDRACOLoader(draco);
    for (const id of Object.keys(this.models)) if (!LAZY.has(id)) this.load(id);
  }
  load(id) {
    if (this.cache[id]) return Promise.resolve(this.cache[id]); if (this.pending[id]) return this.pending[id]; if (!this.loader) return Promise.resolve(null);
    return this.pending[id] = this.loader.loadAsync(this.models[id]).then(g => { this.cache[id] = g; delete this.pending[id]; this.e.bus.emit('assets:loaded', id); return g; }).catch(err => { delete this.pending[id]; console.warn(`[assets] ${id} failed, using procedural fallback`, err?.message || err); this.e.bus.emit('assets:failed', id); return null; }); // failures are not cached: a later load() retries
  }
  get(id) { return this.cache[id] || null; }
  /** Independent copy (skeleton-safe) of a loaded model, or null. */
  instance(id) { const g = this.cache[id]; return g ? { scene: SkeletonUtils.clone(g.scene), animations: g.animations } : null; }
}
