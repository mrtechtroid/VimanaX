# VimanaX (browser, three.js, ES modules, no build step)

Run: `python3 -m http.server 8000` then open http://localhost:8000 (needs internet for the three.js CDN).
Controls: press Esc for the menu (Keys tab lists everything).

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
W/S pitch, A/D roll, Q/E yaw, Z/X throttle, Space brake, G gear, 4 auto flaps, F/V manual flaps, O spoilers, R reverse, L strobes, B autobrake, J JATO,
I ramp, K load/unload/airdrop, Enter drive nearest vehicle, P map, C camera, Tab aircraft, N livery, T time, M weather, [ ] Y wind, U units,
0 sound, 1 tilt, 2 clear route, 3 fullscreen, 9 cycle HUD, Esc menu, Backspace reset, H keys.

## Camera
C cycles chase / orbit / cockpit / wing / fly-by / tower. **Drag** anywhere on the view to look around or orbit, **wheel / pinch** to zoom, **double-click or 5** to reset.
Keys: `, .` look left/right, `; /` up/down, `- =` zoom (numpad 4 6 8 2 + - 5 also work). Gamepad: D-pad looks, R3 resets.

## Flaps
Auto flaps (default, key 4) picks takeoff / clean / approach / go-around flaps from airspeed, gear and power, one notch per 1.5 s, and never commands a notch the airspeed cannot take.
Pressing F/V or choosing a flap setting in the menu switches to manual. Flap overspeed retracts flaps in both modes. Speeds derive from each aircraft's stall speed (`src/aircraft/FlapLogic.js`).

## Tests (headless, optional)
`npm install` then `npm test` (flap schedule + full app boot in jsdom), `npm run sim` (takeoff physics), `npm run pfd` (renders the PFD to /tmp).

## Mobile
Open on a phone (landscape): virtual stick = pitch/roll, slider = throttle, buttons = yaw/brake/gear/flaps/camera; drag the empty view to look around, pinch to zoom; the menu button (top right) has everything else.
Tilt steering: menu > Tilt (use Tilt invert if pitch feels backwards). Add `?touch` to the URL to force touch UI on desktop.
Phones need the page served over http(s) from your computer's LAN IP (tilt on iOS requires https).

## Status
Done: aircraft + liveries, flight physics, control surfaces, gear, flaps, spoilers, reverse, brakes, autobrake, JATO, cameras, strobes,
time/weather/wind, multiple airports, units, keyboard/gamepad/touch/tilt input, damage (gear, aileron, wing/tail separation, destruction),
cargo ramp, load/unload, parachute airdrops, drivable vehicles, map + route waypoints, synthesised audio, responsive HUD.
Not yet: seaplanes/water landings, tilt-wing VTOL, SAR/coastguard/AEW/special-ops aircraft, AI aircraft, missions/game modes,
interactive doors and detailed cockpits, key rebinding UI, sample-based audio, custom (non-circle) coastlines.
Tested headlessly (v0.2): physics takeoff/landing, auto-flap schedule, full app boot, camera input, menu. NOT yet seen in a real browser (visual layout, WebGL rendering) and tilt signs are unverified on real devices.
