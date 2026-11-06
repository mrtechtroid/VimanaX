/** Synthesised audio (no assets): engine tone by throttle, wind noise by airspeed, muffled in cockpit view, impact thud. Replace with sample playback later. */
export class AudioSystem {
  init(e) {
    this.e = e; this.on = true;
    const start = () => {
      if (this.ctx) return this.ctx.resume(); const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const x = this.ctx = new C();
      this.osc = x.createOscillator(); this.osc.type = 'sawtooth'; this.lp = x.createBiquadFilter(); this.eg = x.createGain(); this.osc.connect(this.lp); this.lp.connect(this.eg); this.eg.connect(x.destination); this.osc.start();
      const buf = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const n = x.createBufferSource(); n.buffer = buf; n.loop = true; this.ng = x.createGain(); const hp = x.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400; n.connect(hp); hp.connect(this.ng); this.ng.connect(x.destination); n.start();
    };
    addEventListener('pointerdown', start); addEventListener('keydown', start);
    e.bus.on('action', a => { if (a === 'mute') { this.on = !this.on; e.bus.emit('hud:message', this.on ? 'Sound on' : 'Sound off'); } });
    e.bus.on('aircraft:impact', () => { if (!this.ctx || !this.on) return; const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime; o.frequency.value = 60; g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6); o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(t + 0.6); });
  }
  update() {
    const a = this.e.aircraft.player; if (!this.ctx || !a) return; const t = this.ctx.currentTime, thr = a.destroyed ? 0 : a.controls.throttle, big = a.def.flight.mass > 5000, inside = this.e.cameras.modes[this.e.cameras.i] === 'cockpit';
    this.osc.frequency.setTargetAtTime((big ? 55 : 40) * (1 + thr * 1.8), t, 0.1); this.lp.frequency.setTargetAtTime(inside ? 500 : 1800, t, 0.1);
    this.eg.gain.setTargetAtTime(this.on && !a.destroyed ? 0.05 + 0.1 * thr : 0, t, 0.1); this.ng.gain.setTargetAtTime(this.on ? Math.min(0.25, a.telemetry.airspeed / 600) * (inside ? 0.5 : 1) : 0, t, 0.1);
  }
}
