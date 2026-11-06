import * as THREE from 'three';
const _w = new THREE.Vector3(), _g = new THREE.Vector3(), _r = new THREE.Vector3(), { clamp } = THREE.MathUtils;
export const WEATHER = { clear: { fog: 0, over: 0, turb: 0.25, cover: 0.12 }, cloudy: { fog: 0.12, over: 0.3, turb: 0.6, cover: 0.45 }, overcast: { fog: 0.3, over: 0.75, turb: 0.9, cover: 0.85 }, fog: { fog: 0.9, over: 0.5, turb: 0.2, cover: 0.3 } };
export const TURB_LEVELS = { off: 0, light: 0.6, auto: 1, moderate: 1.7, severe: 3.2 };
const DAY = new THREE.Color(0x8cbcf0), DUSK = new THREE.Color(0xf08a50), NIGHT = new THREE.Color(0x050a14), GREY = new THREE.Color(0x8d949b);
const ns = (x, y, z, t, k) => Math.sin(x * 0.011 + t * 0.9 + k) * Math.cos(z * 0.013 - t * 0.7 + k * 2) + 0.6 * Math.sin(y * 0.021 + x * 0.017 + t * 1.7 + k * 3) + 0.4 * Math.sin(z * 0.043 + t * 2.9 + k * 5) * Math.cos(x * 0.037 - t * 2.3);

const SKY_VS = 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * mat4(mat3(modelViewMatrix)) * vec4(position, 1.0); gl_Position = p.xyww; }';
const SKY_FS = `varying vec3 vDir; uniform vec3 uTop, uHorizon, uSun, uSunCol; uniform float uNight, uSunVis;
float hash(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
void main(){ vec3 d = normalize(vDir); float h = clamp(d.y, 0.0, 1.0); vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  float s = max(dot(d, uSun), 0.0); col += uSunCol * (pow(s, 900.0) * 3.0 + pow(s, 16.0) * 0.22 + pow(s, 3.0) * 0.06) * uSunVis;
  vec3 c = floor(d * 260.0); float st = step(0.9965, hash(c)) * smoothstep(0.02, 0.3, d.y) * uNight; col += vec3(st) * (0.6 + 0.4 * hash(c + 7.0));
  if (d.y < 0.0) col = mix(col, uHorizon * 0.6, clamp(-d.y * 6.0, 0.0, 1.0)); gl_FragColor = vec4(col, 1.0); }`;

/** Time of day, weather, steady wind + turbulence, sky dome, sun with shadows, image-based lighting. Wind blows FROM `wind.from` degrees at `wind.speed` m/s. */
export class Environment {
  constructor(o = {}) { this.hour = o.hour ?? 9; this.wind = { speed: o.windSpeed ?? 4, from: o.windFrom ?? 270 }; this.weather = 'clear'; this.turbulence = 'auto'; this.t = 0; this.intensity = 0; this.rot = new THREE.Vector3(); this.gust = new THREE.Vector3(); this.sunDir = new THREE.Vector3(0, 1, 0); this.sunColor = new THREE.Color(); this.sky = new THREE.Color(); this.night = 0; this.fogBase = 30000; this.visibility = 1; }
  init(e) {
    this.e = e; this.sun = new THREE.DirectionalLight(0xffffff, 1); this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x556644, 0.5);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); const sc = this.sun.shadow.camera; sc.left = sc.bottom = -90; sc.right = sc.top = 90; sc.near = 10; sc.far = 1400; this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.25;
    e.scene.add(this.sun, this.sun.target, this.hemi); e.scene.fog = new THREE.Fog(0x8cbcf0, 500, 30000); e.scene.background = null;
    if (e.renderer.shadowMap) { e.renderer.shadowMap.enabled = true; e.renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false, uniforms: { uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uSun: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color() }, uNight: { value: 0 }, uSunVis: { value: 1 } } });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.skyMat); this.dome.renderOrder = -100; this.dome.frustumCulled = false; e.scene.add(this.dome);
    const say = m => e.bus.emit('hud:message', m);
    e.bus.on('action', a => {
      if (a === 'time') this.hour = (this.hour + 1) % 24;
      else if (a === 'windUp') this.wind.speed = Math.min(25, this.wind.speed + 2);
      else if (a === 'windDown') this.wind.speed = Math.max(0, this.wind.speed - 2);
      else if (a === 'windTurn') this.wind.from = (this.wind.from + 45) % 360;
      else if (a === 'weather') { const k = Object.keys(WEATHER); this.weather = k[(k.indexOf(this.weather) + 1) % k.length]; }
      else if (a === 'turbulence') { const k = Object.keys(TURB_LEVELS); this.turbulence = k[(k.indexOf(this.turbulence) + 1) % k.length]; return say(`Turbulence: ${this.turbulence}`); }
      else return;
      this.apply(); say(this.describe());
    });
    this.apply();
  }
  windVector() { const r = this.wind.from * Math.PI / 180; return _w.set(-Math.sin(r), 0, Math.cos(r)).multiplyScalar(this.wind.speed); }
  /** Local turbulence strength (m/s rms-ish) at a position; also fills this.gust / this.rot. */
  turbAt(p) {
    const W = WEATHER[this.weather], lvl = TURB_LEVELS[this.turbulence] ?? 1; if (!lvl) return 0;
    const world = this.e?.world, agl = world ? p.y - world.groundHeight(p.x, p.z) : 500, over = world && world.heightAt(p.x, p.z) > 2;
    let I = (W.turb + this.wind.speed * 0.07) * (1 + (this.wind.speed > 2 && over ? 1.3 * Math.exp(-Math.max(agl, 0) / 150) : 0));
    const day = Math.max(0, Math.sin((this.hour - 7) / 10 * Math.PI)); const thermal = over && W.over < 0.8 ? day * Math.max(0, Math.sin(p.x * 0.0021) * Math.sin(p.z * 0.0023 + 1.3)) * (agl < 1800 ? 1 : 0) : 0;
    return { I: Math.min(3.2, I * lvl), thermal: thermal * lvl };
  }
  /** Steady wind + gust at a position (called every physics substep). */
  windAt(p) {
    const base = this.windVector(), T = this.turbAt(p); if (!T) { this.rot.set(0, 0, 0); this.intensity = 0; return base; }
    const t = this.t, I = T.I; _g.set(I * 1.3 * ns(p.x, p.y, p.z, t, 0), I * 0.9 * ns(p.x, p.y, p.z, t, 1) + T.thermal * 2.6 * 1.0, I * 1.3 * ns(p.x, p.y, p.z, t, 2));
    this.rot.set(I * 0.11 * ns(p.x, p.y, p.z, t, 3), I * 0.05 * ns(p.x, p.y, p.z, t, 4), I * 0.18 * ns(p.x, p.y, p.z, t, 5));
    this.intensity += (Math.min(3, I + T.thermal * 0.5) - this.intensity) * 0.02; this.gust.copy(_g); return _r.copy(base).add(_g);
  }
  turbLabel() { const i = this.intensity; return i < 0.25 ? 'Calm' : i < 0.8 ? 'Light' : i < 1.6 ? 'Moderate' : 'Severe'; }
  describe(fmtSpeed = v => `${Math.round(v)} m/s`) { return `${String(this.hour).padStart(2, '0')}:00  ${this.weather}  wind ${String(this.wind.from).padStart(3, '0')}\u00b0 ${fmtSpeed(this.wind.speed)}`; }
  apply() {
    const W = WEATHER[this.weather], a = (this.hour - 6) / 12 * Math.PI, el = Math.sin(a), e = this.e;
    const hor = el > 0.25 ? DAY.clone() : el > 0 ? DUSK.clone().lerp(DAY, el / 0.25) : DUSK.clone().lerp(NIGHT, clamp(-el / 0.2, 0, 1)); hor.lerp(GREY.clone().multiplyScalar(clamp(el + 0.3, 0.05, 1)), W.over);
    const top = hor.clone().multiplyScalar(0.62).lerp(new THREE.Color(0x2358b0), 0.5 * clamp(el * 2, 0, 1) * (1 - W.over)); if (el < 0) top.lerp(NIGHT, clamp(-el / 0.15, 0, 1));
    this.sky.copy(hor); this.night = clamp(-el * 6, 0, 1) * (1 - W.over * 0.7); this.fogBase = THREE.MathUtils.lerp(30000, 900, W.fog);
    e.scene.fog.color.copy(hor); e.scene.fog.far = this.fogBase;
    this.sunDir.set(Math.cos(a), Math.max(el, 0.02), 0.3).normalize(); this.sunColor.setHSL(0.1, 0.9 - clamp(el * 3, 0, 0.8), clamp(0.5 + el * 0.4, 0.4, 0.95)); if (el < 0.02) this.sunColor.multiplyScalar(0.3);
    const u = this.skyMat.uniforms; u.uTop.value.copy(top); u.uHorizon.value.copy(hor); u.uSun.value.copy(this.sunDir); u.uSunCol.value.copy(this.sunColor); u.uNight.value = this.night; u.uSunVis.value = (1 - W.over * 0.85) * (el > -0.05 ? 1 : 0);
    this.sun.color.copy(this.sunColor); this.sun.intensity = Math.max(0, el) * 2.1 * (1 - 0.55 * W.over) + 0.04; this.hemi.intensity = 0.12 + 0.55 * Math.max(0, el) * (1 - 0.3 * W.over);
    this.hemi.color.copy(hor).lerp(new THREE.Color(0xffffff), 0.3); this.sun.castShadow = el > 0.04 && W.over < 0.8; this.iblDirty = 0.25;
  }
  /** Rebuild the PBR environment map from the sky dome (throttled; needs a real WebGL renderer). */
  rebuildIBL() {
    const r = this.e.renderer; if (!r.capabilities || !r.getContext) return;
    try {
      this.pmrem ??= new THREE.PMREMGenerator(r); const sc = new THREE.Scene(); sc.add(new THREE.Mesh(this.dome.geometry, this.skyMat));
      const rt = this.pmrem.fromScene(sc, 0, 0.1, 100); this.iblRT?.dispose(); this.iblRT = rt; this.e.scene.environment = rt.texture;
    } catch (err) { this.iblDirty = 0; }
  }
  update(dt, e) {
    this.t += dt; const cam = e.camera; this.dome.position.copy(cam.position); this.dome.scale.setScalar(1);
    const f = e.walk?.mode === 'foot' ? e.walk.pos : (e.cargo.driven || e.aircraft.player)?.pos; if (f) { const d = this.sunDir, h = e.walk?.mode === 'foot' ? 25 : (e.aircraft.player?.def.camera.chaseDist ?? 14) * 1.3; const sc = this.sun.shadow.camera; if (sc.right !== h) { sc.left = sc.bottom = -h; sc.right = sc.top = h; sc.updateProjectionMatrix(); }
      this.sun.target.position.copy(f); this.sun.position.copy(f).addScaledVector(d, 500); }
    if (this.iblDirty > 0) { this.iblDirty -= dt; if (this.iblDirty <= 0) this.rebuildIBL(); }
    // clouds / ground haze can thicken the fog every frame (Clouds sets env.visibility 0..1)
    e.scene.fog.far = this.fogBase * (0.02 + 0.98 * this.visibility);
  }
}
