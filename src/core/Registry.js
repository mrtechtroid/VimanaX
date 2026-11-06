/** Generic id -> definition registry (aircraft, weather presets, game modes...). */
export class Registry {
  constructor(name) { this.name = name; this.m = new Map(); }
  register(id, v) { if (this.m.has(id)) throw new Error(`${this.name}: duplicate '${id}'`); this.m.set(id, v); return this; }
  get(id) { const v = this.m.get(id); if (!v) throw new Error(`${this.name}: unknown '${id}'`); return v; }
  ids() { return [...this.m.keys()]; }
}
