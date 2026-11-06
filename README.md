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

## Controls (desktop)
W/S pitch, A/D roll, Q/E yaw, Z/X throttle, Space brake, G gear, F/V flaps, O spoilers, R reverse, L strobes, B autobrake, J JATO,
I ramp, K load/unload/airdrop, Enter drive nearest vehicle, P map, C camera, Tab aircraft, N livery, T time, M weather, [ ] Y wind, U units,
0 sound, 1 tilt, 2 clear route, 3 fullscreen, Backspace reset, H help.

## Mobile
Open on a phone (landscape): virtual stick = pitch/roll, slider = throttle, buttons = yaw/brake/gear/flaps/camera, hamburger menu = every action.
Tilt steering: menu > Tilt (use Tilt invert if pitch feels backwards). Add `?touch` to the URL to force touch UI on desktop.
Phones need the page served over http(s) from your computer's LAN IP (tilt on iOS requires https).

## Status
Done: aircraft + liveries, flight physics, control surfaces, gear, flaps, spoilers, reverse, brakes, autobrake, JATO, cameras, strobes,
time/weather/wind, multiple airports, units, keyboard/gamepad/touch/tilt input, damage (gear, aileron, wing/tail separation, destruction),
cargo ramp, load/unload, parachute airdrops, drivable vehicles, map + route waypoints, synthesised audio, responsive HUD.
Not yet: seaplanes/water landings, tilt-wing VTOL, SAR/coastguard/AEW/special-ops aircraft, AI aircraft, missions/game modes,
interactive doors and detailed cockpits, key rebinding UI, sample-based audio, custom (non-circle) coastlines.
Untested: everything has only been syntax-checked, not flown; tilt axis signs are unverified on real devices.
