import { KeyboardInput } from './KeyboardInput.js';
import { GamepadInput } from './GamepadInput.js';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Merges all IInputSource axes into one state: {pitch,roll,yaw,throttle,brake}. */
export class InputManager {
  constructor() { this.sources = []; this.state = { pitch: 0, roll: 0, yaw: 0, throttle: 0, brake: 0 }; }
  addSource(s) { this.sources.push(s); s.init?.(this.bus); return this; }
  init(e) { this.bus = e.bus; this.settings = e.settings; this.addSource(new KeyboardInput()).addSource(new GamepadInput()); }
  update(dt) {
    const s = this.state, k = this.settings.get('controlSensitivity'); let p = 0, r = 0, y = 0, b = 0, td = 0;
    for (const src of this.sources) { const o = src.poll(dt); p += o.pitch || 0; r += o.roll || 0; y += o.yaw || 0; b += o.brake || 0; td += o.throttleDelta || 0; }
    s.pitch = clamp(p * k, -1, 1); s.roll = clamp(r * k, -1, 1); s.yaw = clamp(y * k, -1, 1); s.brake = clamp(b, 0, 1);
    s.throttle = clamp(s.throttle + td, 0, 1);
  }
}
