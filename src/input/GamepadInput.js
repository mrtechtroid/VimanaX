const BUTTONS = { 1: 'flapsAuto', 2: 'gear', 3: 'camera', 4: 'flapsUp', 5: 'flapsDown', 8: 'map', 9: 'menu' }; // standard mapping: A=0 brake, B, X, Y, LB, RB, Back, Start
const BUTTON_LIST = Object.entries(BUTTONS); // built once, not every frame
/** IInputSource: first connected gamepad/joystick. Sticks fly; face/shoulder buttons emit actions on press. D-pad / R3 are read by CameraManager. */
export class GamepadInput {
  constructor() { this.prev = {}; }
  init(bus) { this.bus = bus; }
  poll(dt) {
    const g = (navigator.getGamepads?.() || [])[0]; if (!g) return {};
    for (const [i, a] of BUTTON_LIST) { const on = !!g.buttons[i]?.pressed; if (on && !this.prev[i]) this.bus.emit('action', a); this.prev[i] = on; }
    const dz = v => Math.abs(v) < 0.12 ? 0 : v;
    return { roll: dz(g.axes[0]), pitch: dz(g.axes[1]), yaw: dz(g.axes[2] || 0), throttleDelta: -dz(g.axes[3] || 0) * dt * 0.5, brake: g.buttons[0]?.pressed ? 1 : 0 };
  }
}
