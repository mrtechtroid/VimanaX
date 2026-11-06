# VimanaX (browser, three.js, ES modules, no build step)

Run: `python3 -m http.server 8000` then open http://localhost:8000 (needs internet for the three.js CDN).
Controls are listed in the in-game help panel (H).

## Layout
- `src/core/` Engine loop, EventBus, Registry, `interfaces.js` (read this first when extending)
- `src/config/` Settings, unit systems, `worldConfig.js` (islands + airports as data)
- `src/input/` InputManager + pluggable IInputSource (keyboard, gamepad/joystick)
- `src/physics/` IFlightModel implementation + `defaults.js`
- `src/aircraft/` Aircraft, AircraftManager, PlayerController, AirframeBuilder, `definitions/` (one file per aircraft)
- `src/world/` World (terrain, sea, runways), Environment (time, weather, wind)
- `src/camera/`, `src/ui/` camera modes, HUD. `src/main.js` is the composition root.

## Extending
- New aircraft: add `definitions/<id>.js`, register in `definitions/index.js`.
- New input device: implement `poll(dt)`, `engine.input.addSource(...)`.
- New system (damage, cargo, audio, missions): a class with `init(engine)`/`update(dt)`, `engine.use('name', ...)`; talk via `engine.bus`.
- New physics: implement `step(ac, dt, env, world)` and pass it to AircraftManager.

## Checklist status
Done (v0.1): multiple aircraft + liveries, flight physics, pitch/roll/yaw, ailerons/elevator/rudder/flaps/spoilers, retractable gear,
reverse thrust, braking, throttle/altitude/speed, cockpit + chase + tower cameras, strobes, time of day, fog/overcast, wind speed/direction
(crosswinds), multiple airports/islands, units (aviation/metric/imperial), keyboard + gamepad, ground taxi/takeoff/landing.
Next: damage/destruction, cargo & ramps & airdrops, ground vehicles, seaplane/water, VTOL tilt-wing, JATO, map & route UI, audio,
tilt controls, rebinding UI, autobrake, interactive doors, detailed cockpits, AI aircraft, missions/game modes.
