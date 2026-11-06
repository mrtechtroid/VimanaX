import * as THREE from 'three';
const _w = new THREE.Vector3(), { clamp } = THREE.MathUtils;
const WEATHER = { clear: { fog: 0, over: 0 }, cloudy: { fog: 0.15, over: 0.35 }, overcast: { fog: 0.35, over: 0.75 }, fog: { fog: 0.9, over: 0.5 } };
const DAY = new THREE.Color(0x87b8f0), DUSK = new THREE.Color(0xf08a50), NIGHT = new THREE.Color(0x040812), GREY = new THREE.Color(0x8d949b);

/** Time of day, weather presets, wind. Wind blows FROM `wind.from` degrees at `wind.speed` m/s. */
export class Environment {
  constructor(o = {}) { this.hour = o.hour ?? 9; this.wind = { speed: o.windSpeed ?? 4, from: o.windFrom ?? 270 }; this.weather = 'clear'; }
  init(e) {
    this.e = e; this.sun = new THREE.DirectionalLight(0xffffff, 1); this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x556644, 0.6);
    e.scene.add(this.sun, this.hemi); e.scene.fog = new THREE.Fog(0x87b8f0, 500, 30000); e.scene.background = new THREE.Color();
    const say = m => e.bus.emit('hud:message', m);
    e.bus.on('action', a => {
      if (a === 'time') this.hour = (this.hour + 1) % 24;
      else if (a === 'windUp') this.wind.speed = Math.min(25, this.wind.speed + 2);
      else if (a === 'windDown') this.wind.speed = Math.max(0, this.wind.speed - 2);
      else if (a === 'windTurn') this.wind.from = (this.wind.from + 45) % 360;
      else if (a === 'weather') { const k = Object.keys(WEATHER); this.weather = k[(k.indexOf(this.weather) + 1) % k.length]; }
      else return;
      this.apply(); say(this.describe());
    });
    this.apply();
  }
  windVector() { const r = this.wind.from * Math.PI / 180; return _w.set(-Math.sin(r), 0, Math.cos(r)).multiplyScalar(this.wind.speed); }
  describe(fmtSpeed = v => `${Math.round(v)} m/s`) {
    return `${String(this.hour).padStart(2, '0')}:00  ${this.weather}  wind ${String(this.wind.from).padStart(3, '0')}° ${fmtSpeed(this.wind.speed)}`;
  }
  apply() {
    const W = WEATHER[this.weather], a = (this.hour - 6) / 12 * Math.PI, el = Math.sin(a);
    const sky = el > 0.25 ? DAY.clone() : el > 0 ? DUSK.clone().lerp(DAY, el / 0.25) : DUSK.clone().lerp(NIGHT, clamp(-el / 0.2, 0, 1));
    sky.lerp(GREY.clone().multiplyScalar(clamp(el + 0.3, 0.05, 1)), W.over);
    this.e.scene.background.copy(sky); this.e.scene.fog.color.copy(sky); this.e.scene.fog.far = THREE.MathUtils.lerp(30000, 900, W.fog);
    this.sun.position.set(Math.cos(a), Math.max(el, 0.02), 0.3).multiplyScalar(1000);
    this.sun.intensity = Math.max(0, el) * 1.6 * (1 - 0.5 * W.over) + 0.05; this.hemi.intensity = 0.15 + 0.6 * Math.max(0, el);
  }
}
