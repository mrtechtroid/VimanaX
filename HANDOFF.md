# HANDOFF - Open Flight Engine (v0.2)

Browser 3D flight simulator / generalised engine. three.js r160 (CDN import map), plain ES modules, **no build step**.
Run: `python3 -m http.server 8000` in this folder, open http://localhost:8000 (`?touch` forces the mobile UI).

> **Status:** v0.2 was exercised headlessly (Node): real FlightModel runs, auto-flap schedule, and the *whole app booting in jsdom* with a stubbed WebGL renderer (`npm install && npm test`). **It has still never been opened in a real browser**, so WebGL rendering, CSS layout on real screens and tilt signs are unverified. First job: open it, fly it, screenshot the HUD at desktop + phone sizes, fix layout nits.

## 1. What changed in v0.2
- **Bug fixes found by actually running the code**
  - `HUD.init` used `innerHTML =` on `#hud` and (registered last) wiped the minimap and touch controls. HUD now inserts its own nodes.
  - Lift acted along body-up, leaking backwards at high AoA as phantom drag: the Skylark could not take off. Lift is now perpendicular to the relative wind (`FlightModel`). Takeoff now at ~28.7 m/s (Skylark) / ~58 m/s (Atlas).
  - Main runway pointed at the 450 m mountain; now heading 180 (towards the sea).
- **Camera** (`camera/CameraManager.js`): modes chase, orbit, cockpit, wing, fly-by, tower. Drag to look/orbit, wheel/pinch zoom, double-click/`5` reset, keys `, . ; / - =` and numpad, gamepad D-pad + R3, auto re-centre (setting). Chase no longer rolls with the aircraft. Runs while paused (slow showcase drift behind the menu). `def.camera.wing` = optional wing mount.
- **Auto flaps** (`aircraft/FlapLogic.js`): schedule derived from stall speed / flap speeds (`flapSpeeds(def, mass)`): takeoff on the roll and climb-out under 60 m AGL, clean in cruise, slow-flight protection, approach flaps with gear down, go-around, retract on rollout, one notch per 1.5 s, never commands a notch the airspeed cannot take. Overspeed relief works in manual too. Manual input (F/V, menu) drops to manual; key `4` / badge / menu toggles auto. Per-aircraft overrides: `def.autoFlaps`, `def.flight.vFe`.
- **UI rewrite**: PFD canvas (`ui/PFD.js`: attitude, speed/alt tapes with stall/flap/Vfe bands, compass with route bug, AoA, V/S), systems panel (throttle, flap ladder + Auto badge, gear lamps, active-system chips), alert strip (stall, sink rate, gear, flap overspeed), toasts, restyled heading-up minimap + big map, tabbed **menu** (`ui/Menu.js`: Aircraft cards with liveries, Flight, World, Camera, Controls, Keys) replacing the 27-button drawer. Colour grammar: cyan selected, green engaged, magenta route, amber caution, red warning. Fonts: B612 / B612 Mono (Google Fonts, system fallback). `Esc` menu (pauses), `9` cycles HUD full/min/off.
- Engine `paused` flag (modules with `alwaysUpdate` still run), new Settings keys, gamepad buttons (A brake, B auto flaps, X gear, Y camera, LB/RB flaps, Back map, Start menu), sound setting.

## 2. Architecture in 60 seconds
- `src/main.js` composition root. `engine.use('name', module)` -> `engine.name`; `init(engine)` once, `update(dt, engine)` per frame in registration order (skipped while `engine.paused` unless `module.alwaysUpdate`).
- Modules talk via `engine.bus`. Discrete inputs: `bus.emit('action', 'gear')`. Contracts in `src/core/interfaces.js`.
- Conventions: SI units; +X right, +Y up, forward = -Z; north = -Z, east = +X; heading deg clockwise from north. Control axes: pitch +1 nose up, roll +1 bank right, yaw +1 nose right. `ac.angVel`: x pitch(+up), y yaw(+left), z roll(+right wing up).
- Update order: settings, input, env, world, cargo, player, aircraft, damage, cameras, map, touch, audio, hud, menu.
- Events: `action`, `hud:message`, `aircraft:impact`, `settings`, `flaps:set`, `camera:mode`.
- Actions: gear, flapsDown, flapsUp, **flapsAuto**, spoiler, reverse, lights, autobrake, jato, ramp, cargo, drive, camera, **cameraReset**, map, clearRoute, nextAircraft, nextLivery, reset, time, weather, windUp/Down/Turn, units, mute, tilt, tiltInvert, fullscreen, help, **menu**, **hud**.

## 3. File map (new/changed in bold)
| File | Purpose |
|---|---|
| `index.html`, **`css/style.css`** | Fonts, import map; full HUD/menu/touch theme (tokens at top; `body.compact` = phone layout) |
| `src/core/Engine.js` | Loop, `paused` |
| `src/config/Settings.js` | units, controlSensitivity, autoFlaps, cameraSensitivity, fov, camRecenter, pauseOnMenu, sound (not persisted) |
| `src/input/*` | Keyboard (menu-aware), Gamepad (buttons), Tilt, Touch (stick/slider/buttons only) |
| `src/physics/FlightModel.js` | Aero (lift now wind-perpendicular), thrust, ground contact |
| **`src/aircraft/FlapLogic.js`** | Reference speeds + auto flaps + overspeed relief |
| `src/aircraft/PlayerController.js` | Actions, runs flap logic each frame |
| **`src/camera/CameraManager.js`** | Camera modes + look layer |
| **`src/ui/HUD.js`, `PFD.js`, `Menu.js`, `MapUI.js`** | UI |
| `tests/` | `flaps.mjs`, `boot.mjs` (jsdom), `sim.mjs`, `pfd-render.mjs`; `stub-three.mjs` + hooks replace WebGLRenderer |

## 4. Verify first (browser)
1. Load, check console. Fly takeoff on both aircraft (rotate ~28 / ~55 m/s).
2. HUD at 1280x720, 1920x1080 and a phone in landscape (`?touch`): PFD vs touch buttons overlap (compact layout hides PFD under 520px wide), systems panel position, menu scroll.
3. Camera feel: drag sign (drag right = scene follows finger), chase swing speed (`angDamp` k=3.2), tower telephoto (min FOV 4), fly-by cuts.
4. Auto flaps feel on approach (thresholds in `FlapLogic.updateFlaps`), `Vfe` marker on the PFD.
5. Cockpit view has no interior; HUD covers it - consider a clean-HUD option.
6. Items still open from v0.1: impact thresholds (`crashSink`), cargo positions, tilt signs, terrain build time (220x220 on main thread).

## 5. Known limitations / tech debt
- Cargo in the bay is lost on respawn/aircraft switch; vehicles drive over water; sea is hard ground at y=0.
- Spoilers have no mesh; gear "retracts" by scaling. Islands are circles.
- Settings not persisted. No key-rebinding UI. Menu aircraft cards use a generic top-down icon, not the real model.
- Auto flaps assume a stall speed from `CL0 + CLa*aoaStall + flapCL`; aircraft with unusual aero need `vFe` / `autoFlaps` overrides.
- Wing camera is only defined for the two current aircraft (others fall back to chase).

## 6. Recommended next steps
1. Open in a browser and fix whatever the headless tests could not see (layout, fonts, WebGL).
2. Water landing + seaplane (`World.isWater()`, buoyancy in FlightModel, floats variant).
3. More aircraft via definitions (airliner, SAR, coastguard, AEW, tilt-wing VTOL needs thrust vectoring).
4. Game-mode/mission framework (`Registry('modes')` + `MissionSystem`), AI aircraft, persisted settings + rebinding.
5. Cockpit interiors/instruments, doors, copilot camera; sample-based audio; clouds, turbulence, surface types.

## 7. Cheat sheet
- New aircraft: copy `definitions/lightProp.js`, set spec/flight/liveries/camera (+ `camera.wing`, optional `autoFlaps`), register in `definitions/index.js`.
- New system: class with `init/update`, `engine.use` in `main.js`, talk via bus. Set `alwaysUpdate = true` if it must run while paused.
- New menu tab: add to `TABS`, implement `r_<id>()` (HTML) and optional `w_<id>()` (wiring) in `Menu.js`.
- New camera mode: add to `CAMERA_MODES` and a branch in `CameraManager.update`.
