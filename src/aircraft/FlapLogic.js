/**
 * Flap scheduling + protection, derived from the aircraft's own physics numbers (no per-aircraft tuning needed).
 * - stallSpeed / flapSpeeds: reference speeds, also used by the PFD speed tape and the hangar cards.
 * - updateFlaps: auto mode (takeoff / clean / approach / go-around), plus flap-overspeed relief in BOTH modes.
 * An aircraft definition may override with  `autoFlaps: {takeoff, approach, landing}` (flap indices)  and  `flight.vFe: [..]` (m/s per index).
 */
const G = 9.81, RHO0 = 1.225;

export const stallSpeed = (def, flap = 0, mass = def.flight.mass) => {
  const f = def.flight;
  return Math.sqrt(2 * mass * G / (RHO0 * f.wingArea * (f.CL0 + f.CLa * f.aoaStall + f.flapCL * flap)));
};

/** vs1 = clean stall, vs0 = full-flap stall, vfe[i] = max speed with flap notch i (Infinity for notch 0). All m/s. */
export function flapSpeeds(def, mass = def.flight.mass) {
  const fl = def.flaps, n = fl.length, vs1 = stallSpeed(def, 0, mass), vs0 = stallSpeed(def, fl[n - 1], mass);
  const vfe = fl.map((_, i) => i === 0 ? Infinity : def.flight.vFe?.[i] ?? vs1 * (n > 2 ? 2.0 - 0.55 * (i - 1) / (n - 2) : 1.7));
  return { vs1, vs0, vfe };
}

export function flapPlan(def) {
  const n = def.flaps.length, a = def.autoFlaps || {};
  return { takeoff: Math.min(a.takeoff ?? 1, n - 1), approach: Math.min(a.approach ?? 2, n - 1), landing: Math.min(a.landing ?? n - 1, n - 1) };
}

/** Call every frame for an aircraft. Mutates controls.flapIndex (one notch per ~1.5 s, like a real lever). Sets ac.flapReason for the UI. */
export function updateFlaps(ac, dt, world, say = () => {}) {
  const c = ac.controls, n = ac.def.flaps.length;
  if (n < 2 || ac.destroyed) { ac.flapReason = ''; return; }
  ac.flapTimer = Math.max(0, (ac.flapTimer || 0) - dt);
  const { vs1, vfe } = flapSpeeds(ac.def, ac.mass), V = ac.telemetry.airspeed, cur = c.flapIndex, plan = flapPlan(ac.def), thr = c.throttle;
  const agl = ac.pos.y - ac.def.flight.gearHeight - world.groundHeight(ac.pos.x, ac.pos.z);

  if (cur > 0 && V > vfe[cur] * 1.08 && ac.flapTimer === 0) { // load relief, always on
    c.flapIndex = cur - 1; ac.flapTimer = 1.2; ac.flapReason = 'overspeed'; say('Flap overspeed - flaps retracting'); return;
  }
  if (!c.flapAuto) { ac.flapReason = 'manual'; return; }

  let want = 0, why = 'clean';
  if (ac.onGround) {
    if (thr > 0.55 && V < vs1 * 1.6) { want = plan.takeoff; why = 'takeoff'; }
    else why = 'taxi';
  } else if (thr > 0.7 && agl < 60) { want = plan.takeoff; why = 'climb-out'; }
  else if (c.gearDown) {
    want = plan.landing; why = 'approach';
    if (thr > 0.85 && ac.vel.y > 0.5) { want = plan.takeoff; why = 'go-around'; }
  } else { // clean configuration: only add flap to protect against slow flight
    if (V < vs1 * (cur >= 1 ? 1.36 : 1.3)) { want = plan.takeoff; why = 'slow'; }
    if (V < vs1 * (cur >= 2 ? 1.21 : 1.15)) { want = plan.approach; why = 'slow'; }
  }
  while (want > 0 && V > vfe[want] * (want <= cur ? 1.04 : 0.97)) want--; // never command a notch the airspeed can't take
  ac.flapReason = want === cur ? why : `${why} \u2192 ${want}`;
  if (want !== cur && ac.flapTimer === 0) { c.flapIndex = cur + Math.sign(want - cur); ac.flapTimer = 1.5; }
}
