/** IInputSource: first connected gamepad/joystick. Tilt sensors would be another source like this. */
export class GamepadInput {
  poll(dt) {
    const g = (navigator.getGamepads?.() || [])[0]; if (!g) return {};
    const dz = v => Math.abs(v) < 0.12 ? 0 : v;
    return { roll: dz(g.axes[0]), pitch: dz(g.axes[1]), yaw: dz(g.axes[2] || 0), throttleDelta: -dz(g.axes[3] || 0) * dt * 0.5, brake: g.buttons[0]?.pressed ? 1 : 0 };
  }
}
