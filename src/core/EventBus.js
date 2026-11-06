/** Tiny pub/sub. Modules talk through events ('action', 'hud:message', 'aircraft:impact', ...). */
export class EventBus {
  constructor() { this.h = new Map(); }
  on(e, f) { if (!this.h.has(e)) this.h.set(e, []); this.h.get(e).push(f); return () => this.off(e, f); }
  off(e, f) { this.h.set(e, (this.h.get(e) || []).filter(x => x !== f)); }
  emit(e, d) { (this.h.get(e) || []).forEach(f => f(d)); }
}
