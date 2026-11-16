/** Synthesised audio (no assets): engine tone by throttle, wind noise by airspeed, muffled in cockpit view, impact thud. Replace with sample playback later. */
export class AudioSystem {
  init(e) {
    this.e = e; this.on = e.settings.get('sound'); this.alwaysUpdate = true;
    const start = () => {
      if (this.ctx) return this.ctx.resume(); const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const x = this.ctx = new C();
      this.osc = x.createOscillator(); this.osc.type = 'sawtooth'; this.lp = x.createBiquadFilter(); this.eg = x.createGain(); this.osc.connect(this.lp); this.lp.connect(this.eg); this.eg.connect(x.destination); this.osc.start();
      const buf = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = x.createBufferSource(); n.buffer = buf; n.loop = true; this.ng = x.createGain(); const hp = x.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400; n.connect(hp); hp.connect(this.ng); this.ng.connect(x.destination); n.start();
    };
    addEventListener('pointerdown', start); addEventListener('keydown', start); addEventListener('touchend', start, { passive: true });
    // A hidden tab or an app switch must go silent (requestAnimationFrame stops, so update() can no longer fade the engine out).
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; document.hidden ? this.ctx.suspend?.() : this.ctx.resume?.(); });
    // Browsers may auto-suspend the context (iOS after a call or lock); any later gesture brings it back.
    e.bus.on('audio:unlock', () => start());
    e.bus.on('action', a => { if (a === 'mute') { e.settings.set('sound', !this.on, true); e.bus.emit('hud:message', !this.on ? 'Sound on' : 'Sound off'); } });
    e.bus.on('settings', ({ key, value }) => { if (key === 'sound') this.on = value; });
    e.bus.on('aircraft:impact', ({ speed = 5, kind = 'ground' }) => this.crash(speed, kind));
  }
  /** Impact sound scaled by how hard it was: a low thump plus a burst of filtered noise whose colour depends on what was hit. */
  crash(speed, kind) {
    if (!this.ctx || !this.on) return; const x = this.ctx, t = x.currentTime, vol = (this.e.settings.get('volume') ?? 0.8) * Math.min(0.8, 0.12 + speed / 30);
    const o = x.createOscillator(), g = x.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(35, t + 0.5); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55); o.connect(g); g.connect(x.destination); o.start(t); o.stop(t + 0.6);
    const len = Math.floor(x.sampleRate * (kind === 'tree' ? 0.35 : 0.6)), buf = x.createBuffer(1, len, x.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const n = x.createBufferSource(), f = x.createBiquadFilter(), ng = x.createGain(); n.buffer = buf; f.type = ['water', 'terrain', 'ground'].includes(kind) ? 'lowpass' : 'bandpass';
    f.frequency.value = { building: 1100, tower: 900, tank: 700, tree: 1800, water: 800, terrain: 500, ground: 600 }[kind] || 700; ng.gain.value = vol * 1.2; n.connect(f); f.connect(ng); ng.connect(x.destination); n.start(t);
  }
  update() {
    const a = this.e.aircraft.player; if (!this.ctx || !a) return; const t = this.ctx.currentTime, thr = a.destroyed ? 0 : a.controls.throttle, big = a.def.flight.mass > 5000, inside = this.e.cameras.modes[this.e.cameras.i] === 'cockpit';
    this.osc.frequency.setTargetAtTime((big ? 55 : 40) * (1 + thr * 1.8), t, 0.1); this.lp.frequency.setTargetAtTime(inside ? 500 : 1800, t, 0.1);
    const live = this.on && !this.e.paused; this.eg.gain.setTargetAtTime(live && !a.destroyed ? 0.05 + 0.1 * thr : 0, t, 0.1); this.ng.gain.setTargetAtTime(live ? Math.min(0.25, a.telemetry.airspeed / 600) * (inside ? 0.5 : 1) : 0, t, 0.1);
  }
}
