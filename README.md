# VimanaX (browser, three.js, ES modules, no build step)

Run: `python3 -m http.server 8000` then open http://localhost:8000 (needs internet for the three.js CDN).
Controls: press Esc for the menu (Keys tab lists everything).

## Layout
- `src/core/` Engine loop, EventBus, Registry, `interfaces.js` (read this first when extending)
- `src/config/` Settings, unit systems, `worldConfig.js` (islands, lakes, towns, airports as data)
- `src/input/` InputManager + pluggable IInputSource (keyboard, gamepad/joystick)
- `src/physics/` IFlightModel implementation + `defaults.js`
- `src/aircraft/` Aircraft, AircraftManager, PlayerController, AirframeBuilder, `definitions/` (one file per aircraft)
- `src/world/` World facade, `Terrain.js` (heightfield: islands, lakes, rivers), `TerrainRenderer.js` (chunked LOD, sea, forests), `Scenery.js` (towns, roads), `Airports.js`, Environment (time, weather, wind)
- `src/camera/`, `src/ui/` camera modes, HUD. `src/main.js` is the composition root.

## Extending
- New aircraft: add `definitions/<id>.js`, register in `definitions/index.js`.
- New input device: implement `poll(dt)`, `engine.input.addSource(...)`.
- New system (damage, cargo, audio, missions): a class with `init(engine)`/`update(dt)`, `engine.use('name', ...)`; talk via `engine.bus`.
- New physics: implement `step(ac, dt, env, world)` and pass it to AircraftManager.

## Controls (desktop)
8 autopilot, W/S pitch, A/D roll, Q/E yaw, Z/X throttle, Space brake, G gear, 4 auto flaps, F/V manual flaps, O spoilers, R reverse, L strobes, B autobrake, J JATO,
I ramp, K load/unload/airdrop, Enter drive nearest vehicle, P map, C camera, Tab aircraft, N livery, T time, M weather, [ ] Y wind, U units,
0 sound, 1 tilt, 2 clear route, 3 fullscreen, 9 cycle HUD, Esc menu, Backspace reset, H keys.

## Camera
C cycles chase / orbit / cockpit / wing / fly-by / tower. **Drag** anywhere on the view to look around or orbit, **wheel / pinch** to zoom, **double-click or 5** to reset.
Keys: `, .` look left/right, `; /` up/down, `- =` zoom (numpad 4 6 8 2 + - 5 also work). Gamepad: D-pad looks, R3 resets.

## Flaps
Auto flaps (default, key 4) picks takeoff / clean / approach / go-around flaps from airspeed, gear and power, one notch per 1.5 s, and never commands a notch the airspeed cannot take.
Pressing F/V or choosing a flap setting in the menu switches to manual. Flap overspeed retracts flaps in both modes. Speeds derive from each aircraft's stall speed (`src/aircraft/FlapLogic.js`).

## Tests (headless, optional)
`npm install` then `npm test` (flap schedule, full app boot, walking/world, fleet take-off, autopilot/rebinding/persistence in jsdom), `npm run sim` (takeoff physics), `npm run pfd` (renders the PFD to /tmp).

## Mobile
Open on a phone (landscape): virtual stick = pitch/roll, slider = throttle, buttons = yaw/brake/gear/flaps/camera; drag the empty view to look around, pinch to zoom; the menu button (top right) has everything else.
Tilt steering: menu > Tilt (use Tilt invert if pitch feels backwards). Add `?touch` to the URL to force touch UI on desktop.
Phones need the page served over http(s) from your computer's LAN IP (tilt on iOS requires https).

## Status
Done: aircraft + liveries, flight physics, control surfaces, gear, flaps, spoilers, reverse, brakes, autobrake, JATO, cameras, strobes,
time/weather/wind, multiple airports, units, keyboard/gamepad/touch/tilt input, damage (gear, aileron, wing/tail separation, destruction),
cargo ramp, load/unload, parachute airdrops, drivable vehicles, map + route waypoints, synthesised audio, responsive HUD.
Not yet: tilt-wing VTOL, SAR/coastguard/AEW/special-ops aircraft, AI aircraft, missions/game modes, sample-based audio, seated pilot avatar,
leaving the seat in flight, retractable gear on the merged-gear FR24 jets (see HANDOFF.md).
Tested headlessly (v0.2): physics takeoff/landing, auto-flap schedule, full app boot, camera input, menu. NOT yet seen in a real browser (visual layout, WebGL rendering) and tilt signs are unverified on real devices.


## v0.3: realism pass
- **People:** press Enter to stand up (stopped on the ground). Walk (WASD, Shift sprint, Space jump, mouse look, C for third person), open doors (6), board (E), sit in the pilot or co-pilot seat, walk inside the Atlas cargo bay and down its ramp.
- **Vehicles:** walk to the Scout 4x4, Ferrari 458 or milk truck and press E. Drive a vehicle up the open Atlas ramp to secure it in the bay; get in and reverse out to unload.
- **Aircraft:** rebuilt as lofted fuselages and airfoil wings with real window and door cut-outs, hinged control surfaces, retractable gear and detailed cockpits (live analog gauges on the Skylark, glass PFD/MFD on the Atlas).
- **World:** surface types (asphalt, grass, dirt, sand, rock) that change rolling drag, braking, grip and bumpiness; two new strips (Meadow Field grass, Dune Strip dirt); cumulus and stratus clouds you can fly through; turbulence levels (key 7); sky dome with stars and sun shadows.
- Co-pilot camera, camera shake in turbulence, smooth blends between viewpoints.
- See `HANDOFF.md` for what is verified, what is not, and what is still missing (sample-based audio, aircraft glTF hook).
- Third-party model credits: `assets/CREDITS.md`.

## v0.4: new world, real aircraft, autopilot
- **World:** a finite 24 x 24 km archipelago generated from `worldConfig.js` (seeded, ~1.3 s at start-up). Warped, irregular coastlines, ridged snow-capped mountains,
  lakes at their own water level, rivers that flow downhill into the sea and carve valleys, forests (instanced trees), farmland patchwork, beaches, shallow-water
  gradients with foam, towns with roads, and airports with taxiways, aprons, terminals, towers, hangars, PAPI and approach lights. The map shows the real terrain. Chunked 4-level LOD with skirts.
- **Aircraft:** the Skylark now wears the FR24 PA-28 model; new Citation II, ATR 42 and Boeing 737-800 (FR24 glTF, converted to glTF 2.0 + Draco in `assets/models/aircraft`), plus a
  Skylark floatplane (use the Harmony Bay seaplane base or any lake). Models load on demand; if they fail the procedural airframe keeps flying. The glTF hook is `src/aircraft/GltfSkin.js`
  (node names to hinge pivots, configured per definition via `model`).
- **Autopilot (key 8):** altitude, heading and speed hold; W/S nudge altitude, A/D heading, Z/X speed.
- **Settings** persist in localStorage; **keys can be rebound** (Menu > Keys).
- Licensing: the FR24 models are GPLv2 (see `assets/CREDITS.md`). Read `HANDOFF.md` for the verify-first list and the remaining gaps.


## v0.5 highlights
Start screen with a Fly button, rewritten touch controls (left-handed layout, floating stick, context buttons), flight coach, solid buildings / hangars / tower / trees, per-part damage (engine, wings, tail, gear, airframe) with smoke and fire, tone mapping, moon, night lighting and a running clock. See HANDOFF.md ("v0.5 changes") for details and what still needs verification.

## v0.6: flight realism + performance (code pass, not yet verified)
- **Engines spool up.** Thrust follows a per-aircraft RPM state (`src/physics/FlightModel.js`, `src/aircraft/Aircraft.js`) instead of jumping with the lever: pistons respond in ~0.8 s, the Citation ~2 s, the 737 ~3 s. RPM drives the gauges, prop speed/blur and engine audio, and a failed engine winds down. JATO is no longer reversed with the engines.
- **Aerodynamics:** ISA air density, ground effect (lift increase + induced-drag relief in the flare), sideslip drag, dihedral sideslip-to-roll coupling, propeller torque/P-factor on the Skylark, a sharper stall with nose-down break, wing drop and buffet shake, and speed-dependent nosewheel steering with crosswind weathervaning.
- **Autopilot:** holds *airspeed* rather than ground speed, pitch nudges climb in the expected direction, altitude/speed chips follow the selected unit system.
- **Sound:** the existing `sfx` events now play synthesised footsteps (per surface), door and ramp cues; cockpit muffling covers the co-pilot seat and the engine fades with distance when you leave the aircraft. The mute toast is no longer backwards.
- **Performance:** chunk streaming is throttled and respects its rebuild budget, terrain vertices are written directly into typed arrays, distant chunks skip shadow lookups, trees use shared scratch objects, rivers are frustum-culled, wind is sampled once per frame instead of per physics substep, the expensive surface lookup is cached on the ground, map/HUD DOM writes are minimised, terrain-map redraw is throttled, cloud drift is wrapped, glTF node lookup is cached, and adaptive render resolution (Menu > World > Picture) keeps frame time in check.
- **Fixes:** on-foot compass heading, GltfSkin glass shadows and listener leaks, stranded bay cargo after a respawn, walker reset state, gamepad slot detection, held keys after blur, cargo division-by-zero, PFD canvas height, PAPI/touchdown markings on short strips, and several material/allocation leaks.
- **Environment/shaders:** the sea, lakes and rivers now share a world-space water shader — Fresnel sky reflection, two wind-driven wave layers, sun glitter, distance haze and animated coastline foam sampled from a heightfield-derived bed mask (each water body measures depth from its own surface). The sky adds a Mie halo and crisp sun disc, a twilight ozone band and sun-warmed horizon haze; fog thickens near the ground and warms toward the sun; clouds are visible when you fly into them, self-shadow within a cluster and keep a softer silver lining; overcast weather darkens the terrain; runway lights brighten at dusk; and the shadow frustum expands with altitude so shadows do not vanish on climb-out.
- **Faster startup:** the heightfield is generated in batches with real splash progress instead of one ~1.3 s blocking pass; only the chunks around the spawn airport are built up front and the rest stream in automatically, biased toward the direction of travel; the soldier and vehicle GLBs are fetched on proximity (aircraft skins still load on spawn). Headless tests keep the synchronous construction path.
- **Full-world collision:** statics (buildings, hangars, tower, tanks, trees, plus newly solid windsock masts, PAPI lamps, dock and buoys) now have radius-aware and swept queries; a rebuilt-per-frame dynamic body list makes aircraft, vehicles, crates and the walking pilot solid to each other. Walkers and driven vehicles resolve against both statics and dynamics, airdrops sweep against roofs, and fast/rotating airframe probes are sampled densely enough not to tunnel. Existing `aircraft:impact` events and damage zones are unchanged.
- **Nothing here was run or seen in a browser.** Physics feel, spool constants, adaptive-resolution thresholds, streaming budgets, all shader compilation and UI changes still need a play-test.
