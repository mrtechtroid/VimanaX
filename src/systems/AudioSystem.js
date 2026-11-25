/** Synthesised audio (no assets): engine tone by throttle, wind noise by airspeed, muffled in cockpit view, impact thud. Replace with sample playback later. */
export class AudioSystem {
  init(e) {
    this.e = e; this.on = e.settings.get('sound'); this.alwaysUpdate = true;
    const start = () => {
      if (this.ctx) return this.ctx.resume(); const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const x = this.ctx = new C();
      this.osc = x.createOscillator(); this.osc.type = 'sawtooth'; this.lp = x.createBiquadFilter(); this.eg = x.createGain(); this.osc.connect(this.lp); this.lp.connect(this.eg); this.eg.connect(x.destination); this.osc.start();
      const buf = x.createBuffer(1, x.sampleRate * 2, x.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf; // also reused by the short one-shot effects, so they do not build a new buffer every time
      const n = x.createBufferSource(); n.buffer = buf; n.loop = true; this.ng = x.createGain(); const hp = x.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400; n.connect(hp); hp.connect(this.ng); this.ng.connect(x.destination); n.start();
    };
    addEventListener('pointerdown', start); addEventListener('keydown', start); addEventListener('touchend', start, { passive: true });
    // A hidden tab or an app switch must go silent (requestAnimationFrame stops, so update() can no longer fade the engine out).
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; document.hidden ? this.ctx.suspend?.() : this.ctx.resume?.(); });
    // Browsers may auto-suspend the context (iOS after a call or lock); any later gesture brings it back.
    e.bus.on('audio:unlock', () => start());
    e.bus.on('action', a => { if (a === 'mute') { const on = !this.on; e.settings.set('sound', on, true); e.bus.emit('hud:message', on ? 'Sound on' : 'Sound off'); } });
    e.bus.on('settings', ({ key, value }) => { if (key === 'sound') this.on = value; });
    e.bus.on('aircraft:impact', ({ speed = 5, kind = 'ground' }) => this.crash(speed, kind));
    e.bus.on('sfx', name => this.sfx(name)); // footsteps (per surface), doors and the cargo ramp now make themselves heard
  }
  /** Short synthesised cue for the sfx events emitted by walking, doors and the cargo ramp. */
  sfx(name) {
    if (!this.ctx || !this.on || !this.noiseBuf) return;
    const x = this.ctx, t = x.currentTime, step = name.startsWith('step_'), kind = step ? name.slice(5) : name;
    const vol = (this.e.settings.get('volume') ?? 0.8) * (step ? 0.1 : 0.2);
    const freq = { door_open: 210, door_close: 120, ramp: 85, hard: 250, grass: 170, dirt: 140, water: 500 }[kind] ?? 200;
    const o = x.createOscillator(), g = x.createGain(); o.type = kind === 'water' ? 'sine' : 'triangle';
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * 0.55), t + 0.13);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(x.destination); o.start(t); o.stop(t + 0.16);
    const n = x.createBufferSource(), f = x.createBiquadFilter(), ng = x.createGain(); n.buffer = this.noiseBuf;
    f.type = kind === 'water' ? 'lowpass' : 'bandpass'; f.frequency.value = kind === 'water' ? 1600 : kind === 'hard' ? 900 : 500;
    ng.gain.setValueAtTime(vol * 0.7, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    n.connect(f); f.connect(ng); ng.connect(x.destination); n.start(t); n.stop(t + 0.12);
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
    const a = this.e.aircraft.player; if (!this.ctx || !a) return; const t = this.ctx.currentTime, rpm = a.destroyed ? 0 : (a.rpm ?? a.controls.throttle), big = a.def.flight.mass > 5000;
    const inside = this.e.cameras.inside; // covers the co-pilot seat and interiors, not just the pilot's cockpit
    this.osc.frequency.setTargetAtTime((big ? 55 : 40) * (1 + rpm * 1.8), t, 0.1); this.lp.frequency.setTargetAtTime(inside ? 500 : 1800, t, 0.1);
    const walk = this.e.walk, away = walk && walk.mode !== 'aircraft';
    const listener = away ? (this.e.cargo.driven?.pos || walk.pos || this.e.camera.position) : null;
    const atten = away ? Math.max(0.04, 1 - (a.pos.distanceTo(listener) - 6) / 120) : 1; // engine fades as you walk away from the parked aircraft
    const live = this.on && !this.e.paused; this.eg.gain.setTargetAtTime(live && !a.destroyed ? (0.05 + 0.1 * rpm) * atten : 0, t, 0.1); this.ng.gain.setTargetAtTime(live ? Math.min(0.25, a.telemetry.airspeed / 600) * (inside ? 0.5 : 1) : 0, t, 0.1);
  }
}
