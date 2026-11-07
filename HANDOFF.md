# HANDOFF - Open Flight Engine (v0.4, "new world + real aircraft")

Browser 3D flight simulator / generalised engine. three.js r160 (CDN import map incl. `three/addons/`), plain ES modules, **no build step**.
Run: `python3 -m http.server 8000` in this folder, open http://localhost:8000 (`?touch` forces the mobile UI).
Tests (optional, headless): `npm install && npm test` (flap logic, full-app boot in jsdom, on-foot/vehicle/world). `npm run preview` renders the procedural models and gauges to /tmp/shots as PNGs.

> **Status.** Everything below was exercised headlessly: real FlightModel runs, the whole app booting in jsdom with only `WebGLRenderer` stubbed, software-rendered previews of the models and instruments. **It has never been opened in a real browser.** WebGL shaders (sky dome, clouds), glTF/Draco loading, pointer lock, real CSS layout and audio are unverified. Section 4 lists what to check first.

## 0. What is new in v0.4 (read this first)
**World (`src/world/`)**: the circle-islands world is gone. `Terrain.js` builds a 1025x1025 height grid (23 m cells, 24 km square, seeded) in ~1.3 s: domain-warped island masks
(irregular coasts), ridged mountains, hills and micro relief, islets, lakes (own water level, carved bowls), **rivers** (steepest-descent paths from the highlands that reach the sea,
smoothed and carved with widening beds), airport lowlands + plateaus, and snapped towns. It is pure data (no THREE): `heightAt/slopeAt/forestAt/fieldAt/waterLevelAt/surfaceId/mapRaster`.
`TerrainRenderer.js` streams 16x16 chunks with 4 LODs (64/32/16/8 cells) plus skirts, bakes biome colours per vertex (bathymetry + foam, beach, grass, farmland patchwork, forest, rock, scree, snow),
adds a tiled detail texture, a translucent sea with scrolling wave normals over a dark floor, lake discs, river ribbons and instanced conifer/broadleaf forests (queued one chunk per frame).
`Scenery.js` places towns (instanced houses with roofs, tower blocks, street crosses) and routes roads between towns and airports. `Airports.js` builds runways with real markings, parallel taxiways,
aprons, terminal/tower/hangars/fuel tanks, windsocks, PAPI and approach lights; it also provides the paved-area layout that `World.surfaceAt` uses (taxiway/apron = asphalt). `World.js` keeps the old API
(`heightAt`, `groundHeight` incl. lake/sea level, `surfaceAt`, `isWater`, `spawnPoint`, `cfg`) and adds `terrain`, `mapRaster`, `bounds`. `MapUI` draws the raster and town names.
Airports: Main Intl runway is now 2300 m (the 737 needs it); new North Landing, Coral Bay, Cape Grass Strip and the Harmony Bay water aerodrome (`water: true`).

**Aircraft**: `src/aircraft/GltfSkin.js` is the long-missing glTF hook. A definition adds `model: { id, pos, parts, lights }`; node names are re-parented under hinge pivots so the existing
`Aircraft.animate()` drives them. The procedural cockpit/physics always remain; the procedural exterior is hidden once the glTF is in. New aircraft in `definitions/fr24.js`: Citation II, ATR 42, Boeing 737-800;
the Skylark wears the PA-28. `light-float` = Skylark on pontoons (`flight.floats`: pontoons plane on water with low drag, belly-slide on land). Models are glTF 1.0 originals converted by `tools/convert-fr24.sh`;
GPL notes in `assets/CREDITS.md`.

**Systems**: `systems/Autopilot.js` (key 8: altitude/heading/speed hold, controls nudge targets, chip in the HUD). `Settings` persists to localStorage; keys are rebindable (`ui/Rebind.js`, `KeyboardInput.effectiveMap`).
Tests: `tests/canvas-stub.mjs` gives jsdom a no-op 2D canvas (the `canvas` package does not build everywhere); new `tests/fleet.mjs`, `tests/features.mjs`, `tests/bench-world.mjs`.

## 1. What is in v0.3
**On foot (`systems/WalkSystem.js`)**
- `Enter` stands the pilot up (aircraft must be stopped on the ground). Skylark: pilot door opens and you stand outside it. Atlas: you stand up inside the flight deck.
- WASD walk (1.9 m/s), Shift sprint (5.2), Space jump, mouse look (click the view for pointer lock; drag / right stick on touch and gamepad), `C` first/third person. Soldier.glb with Idle/Walk/Run blending, procedural avatar as fallback.
- Collision: aircraft hull (`def.walk.hull`), vehicles, water, steep steps. Surface-specific footsteps events (`sfx` `step_hard|grass|dirt|water`) are emitted but nothing plays them yet.
- Context prompt (`walk.prompt`, shown as a button in the HUD; `E` or tap): open/enter doors, sit in pilot or co-pilot seat, open/close the cargo ramp, drive nearby vehicles. Key `6` toggles the nearest door (from the seat: your own door). Doors auto-close after you board (`autoDoors`).
- Atlas interior walking: cabin from flight deck to ramp (`def.interior`), crew and paratroop doors, ramp walks in/out, deck height follows the ramp (`aircraft/Deck.js`).

**Vehicles (`systems/CargoSystem.js`)**: Scout 4x4 (procedural), Ferrari 458 and milk truck (glTF, procedural stand-ins until loaded). Steering geometry with yaw rate limited by lateral grip, surface-dependent top speed, body aligned to terrain, no driving into water. **Drive up the open Atlas ramp** and the vehicle is secured in the bay (weight-limited); get in (E) and reverse out to unload. `K` still loads/unloads/airdrops (crates and vehicles, with parachutes).

**Aircraft models (`aircraft/AirframeBuilder.js`, `Loft.js`, definitions)**: data-driven procedural builder: lofted superellipse fuselage with real window and door cut-outs (the door is a piece of the skin hinged on a pivot, so opening it reveals the interior), NACA-style tapered/swept/twisted wings with hinged flaps/ailerons/elevators/rudder (pivots aligned to the hinge line), engines + nacelles, twisted prop blades with blur discs, retractable gear that rotates into the airframe, Atlas ramp with computed open angle. Previews: `npm run preview`.

**Cockpits (`aircraft/Cockpit.js`, `instruments/`)**: Skylark: seats, panel, yokes that move with the controls, throttle/flap/gear levers, live analog six-pack + tach (CanvasTexture, redrawn only while you are inside). Atlas: flight deck with two PFDs and an engine/config MFD (the HUD's `PFD` class renders onto them), bulkhead, cargo floor, rails, jump seats, ceiling lights. Co-pilot camera mode; the HUD flight display hides in cockpit view (setting `cockpitHud`).

**World**: surface types (`world/Surfaces.js`: asphalt, grass, dirt, sand, rock, water) change rolling drag, braking, grip and bump in `FlightModel`; new strips Meadow Field (grass, 650 m) and Dune Strip (dirt, 520 m); runway markings by type. `world/Clouds.js`: instanced billboard cumulus clusters that wrap around the camera and drift with the wind, stratus deck for cloudy/overcast, flying through cloud cuts visibility (`env.visibility`). `world/Environment.js`: shader sky dome with stars, sun-following shadow camera, PMREM environment map from the sky, turbulence (`env.windAt`): weather + wind + low-level mechanical + daytime thermals, levels off/light/auto/moderate/severe (key `7`), rotational kicks, camera shake.

**Also**: camera blends between viewpoints (seat changes, boarding, vehicles), shake from turbulence/rough ground, menu updated (Doors tile, Turbulence, camera shake, auto doors, cockpit HUD, Keys tab).

**Bug fixes found by running it (carried from v0.2 and new)**: lift perpendicular to the relative wind (v0.2); HUD no longer wipes sibling UI (v0.2); main runway no longer points at the mountain; loft winding verified with a software renderer (inverted normals would have hidden the whole fuselage); vehicle yaw rate was ungated by grip (4x4 spun 300 degrees at speed).

## 2. Architecture in 60 seconds
- `src/main.js` composition root; `engine.use('name', module)` -> `engine.name`; `init(engine)` once, `update(dt, engine)` per frame in registration order, skipped while `engine.paused` unless `module.alwaysUpdate`.
- Order: settings, input, assets, env, world, clouds, cargo, walk, player, aircraft, damage, cameras, map, touch, audio, hud, menu.
- Modules talk through `engine.bus`; contracts in `src/core/interfaces.js`.
- Conventions: SI; +X right, +Y up, forward = -Z; heading deg clockwise from north; yaw about +Y is positive to the LEFT; walker/vehicle forward = (-sin yaw, -cos yaw).
- **Who is controlled**: `walk.mode` = `aircraft` (seated, controls reach the aircraft) | `foot` | `vehicle`. `PlayerController` zeroes controls and applies brakes unless seated. `walk.focus` is what the camera/map follow.
- Bus events: `action`, `hud:message`, `aircraft:impact`, `aircraft:spawn`, `settings`, `flaps:set`, `camera:mode`, `assets:loaded|failed`, `sfx`.
- Actions: gear, flapsDown/Up/Auto, spoiler, reverse, lights, autobrake, jato, ramp, cargo, interact (Enter), door (6), turbulence (7), camera, cameraReset, map, clearRoute, nextAircraft, nextLivery, reset, time, weather, windUp/Down/Turn, units, mute, tilt, tiltInvert, fullscreen, help, menu, hud.

## 3. File map (new or heavily changed in v0.3)
| File | Purpose |
|---|---|
| `src/aircraft/Loft.js` | `loftBody` (rings, window/door/material classification), `wingPiece`, `finPiece`, `airfoilLoop` |
| `src/aircraft/AirframeBuilder.js` | `buildAirframe(spec, livery)`; public contract is `group.userData.parts` |
| `src/aircraft/definitions/lightProp.js`, `transport.js` | Full specs (stations, windows, doors, wing, tail, engines, gear, ramp, cockpit, walk hull, camera eyes) |
| `src/aircraft/Cockpit.js`, `src/instruments/{Gauges,state}.js` | Interiors + instrument painters + shared instrument state (HUD uses it too) |
| `src/aircraft/Aircraft.js` | `animate()` now drives doors, retracting gear, prop blur, ramp angles, cockpit |
| `src/aircraft/Deck.js` | Cargo-bay/ramp floor height for walkers and vehicles |
| `src/systems/WalkSystem.js`, `CargoSystem.js` | On foot, interactions; vehicles, bay, drive-in/out |
| `src/core/Assets.js` + `assets/models/*.glb` | glTF loader (Draco decoder from gstatic) and cache; credits in `assets/CREDITS.md` |
| `src/world/{Surfaces,Environment,Clouds,World}.js` | Surfaces, sky/shadows/IBL/turbulence, clouds, terrain by surface |
| `src/camera/CameraManager.js` | + co-pilot, foot cameras, shake, blending |
| `src/ui/{HUD,Menu,MapUI}.js`, `css/style.css` | On-foot/vehicle HUD states, prompt button, doors/turbulence UI |
| `tests/` | `flaps.mjs`, `boot.mjs`, `walk.mjs` (+ `harness.mjs`), `sim.mjs`, previews (`preview*.mjs`, `gauges-render.mjs`, `pfd-render.mjs`, `glb-inspect.mjs`) |

## 4. Verify first (real browser)
1. Console on load. Shaders: sky dome (`Environment` SKY_VS/FS) and clouds (`Clouds` VS/FS) are the likeliest compile problems. If the sky is black, check the dome first.
2. glTF: Soldier, Ferrari (Draco; needs internet for the decoder) and truck load; if not, procedural fallbacks are used (look for `[assets]` warnings). Check scale/orientation and that the Ferrari's wheels spin.
3. Pointer lock on desktop (click the view while on foot); Esc behaviour with the menu.
4. Lighting: PBR looks flat without the PMREM environment (`rebuildIBL`, needs a real renderer). Shadow softness/bias on the airframes; shadow frustum follows the player (`Environment.update`).
5. Cockpit view: eye heights vs panel/windscreen (`def.cockpit.eyes`, panel y/z), windshield/door cut-out alignment (stations are quantised to 40 ring segments), doors clipping when opened, seats too low/high.
6. Walk feel: speeds, jump, step limit, hull sizes, prompts overlapping the HUD on phones.
7. Cloud look and cost (about 1000 instanced puffs, resorted every 0.45 s), fog colour vs sky horizon at dusk, visibility inside cloud.
8. Turbulence strength per level (`Environment.turbAt` scale; severe is deliberately violent), bump amplitude on grass/dirt.
9. Menu on a phone; touch walking (stick = walk, drag = look).
10. Old open items: impact thresholds, tilt axis signs, terrain build time (v0.4: ~1.3 s heightfield + ~0.4 s first chunks; check on a phone).

## 5. Not done / known gaps (honest list)
- **Nothing in v0.4 has been seen in a real browser** (no browser in the build sandbox). Terrain colours/lighting, water look, tree density/performance, model scale/orientation, eye heights and cockpit alignment on the FR24 models are unverified. Headless tests cover logic only.
- **Sample-based audio is still NOT done.** `AudioSystem` is the v0.2 synth; `sfx` events exist for it. Plan unchanged (loops by RPM, interior low-pass, footsteps per surface).
- **FR24 model limits:** the Citation, ATR 42 and 737 meshes have the landing gear merged into the fuselage, so gear cannot retract on them (the PA-28 has separate gear nodes and does retract). Engine fans and the 737's spoilers/slats are not animated. The PA-28 stabilator hinge and all `model.pos`/cockpit numbers in `definitions/fr24.js` and `lightProp.js` are estimates from bounding boxes. Doors on glTF skins are invisible (the walk system still uses the procedural door positions, so the pilot steps out through the fuselage). The new jets reuse the glass-cockpit panel with no detailed interior and no cabin.
- Flight models for the Citation/ATR/737/floatplane are plausible numbers, not tuned against real data (headless takeoff only). Floatplane on water has no wave/spray/porpoising; wheeled aircraft landing on water just meet a very draggy surface.
- Autopilot: no nav/ILS/approach modes, no coordinated rudder, disengages on touchdown; you still cannot leave the seat in flight.
- The seated pilot has no body (empty seats); no copilot NPC. Interior walking only in the Atlas.
- No missions/game modes, no AI aircraft, no SAR/AEW/tilt-wing aircraft. Roads are a greedy router (a few may stop at water or steep ground); towns have no night lights; rivers are visual only (the bed is solid, no water physics).
- Surfaces are decided by terrain rules, not painted per tile. Clouds are billboards, no precipitation. Vehicles do not collide with each other.
- GPL: FR24 models are GPLv2-only, the repo is GPLv3. See `assets/CREDITS.md`.

## 6. Recommended next steps
1. Open it in a browser and fix section 4 (new in v0.4: terrain look + frame time on a phone, sea colour vs fog, trees too dense/sparse, model orientation/scale, cockpit eyes on all five airframes, water landing feel).
2. Sample audio (section 5), wired to the existing `sfx` events and engine RPM/airspeed/surface.
3. Seated pilot avatar, leave-seat-in-flight (needs the autopilot approach modes first), animate the FR24 doors.
4. Missions + AI traffic (the airports, roads and towns now give them somewhere to go), SAR/coastguard, tilt-wing.
5. If you want proper gear on the jets: model or split the gear in Blender, then list the node names in `definitions/fr24.js` (the hook already retracts anything in `parts.gear`).

## 7. Cheat sheet
- New aircraft: copy `definitions/lightProp.js`; fill `spec` (stations, windows, doors, wing, tail, engines, gear, optional ramp/bodies/details) and `cockpit`/`walk`/`camera`; register in `definitions/index.js`. Use `npm run preview` to look at it (edit `tests/preview-*.mjs`).
- New door: add to `fuselage.doors` with `test(zMid, angleDeg)` (0 = right, 90 = up, 180 = left), `hinge`, `open` angle, `at` (stand point outside), optional `in` (inside point) and `enter` ('pilot'|'copilot'|'cabin').
- New vehicle: add to `VEHICLES` in `CargoSystem.js` (and a `glb` entry in `core/Assets.js`), add to the spawn list in `init`.
- New surface: `world/Surfaces.js`; set `surface` on an airport in `config/worldConfig.js`.
- New menu tab / camera mode: see v0.2 notes in `Menu.js` (`r_<id>`, `w_<id>`) and `CAMERA_MODES`.
