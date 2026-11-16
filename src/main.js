import { Engine } from './core/Engine.js';
import { Settings } from './config/Settings.js';
import worldConfig from './config/worldConfig.js';
import { InputManager } from './input/InputManager.js';
import { TouchControls } from './input/TouchControls.js';
import { Environment } from './world/Environment.js';
import { World } from './world/World.js';
import { FlightModel } from './physics/FlightModel.js';
import { AircraftManager } from './aircraft/AircraftManager.js';
import { PlayerController } from './aircraft/PlayerController.js';
import { aircraftRegistry } from './aircraft/definitions/index.js';
import { Assets } from './core/Assets.js';
import { Clouds } from './world/Clouds.js';
import { WalkSystem } from './systems/WalkSystem.js';
import { CargoSystem } from './systems/CargoSystem.js';
import { DamageSystem } from './systems/DamageSystem.js';
import { CollisionSystem } from './systems/CollisionSystem.js';
import { Effects } from './systems/Effects.js';
import { AudioSystem } from './systems/AudioSystem.js';
import { CameraManager } from './camera/CameraManager.js';
import { MapUI } from './ui/MapUI.js';
import { HUD } from './ui/HUD.js';
import { Menu } from './ui/Menu.js';
import { Autopilot } from './systems/Autopilot.js';
import { Splash, bootStep, bootYield } from './ui/Splash.js';
import { Coach } from './ui/Coach.js';

// Composition root: swap/add modules here. Update order = registration order.
// Boot is staged: the start screen (static markup in index.html) is painted and ticked off between the heavy steps, so the page never sits on black.
const engine = new Engine(document.getElementById('view'));
bootStep('engine'); await bootYield();
engine
  .use('settings', new Settings())
  .use('input', new InputManager())
  .use('assets', new Assets())
  .use('env', new Environment({ hour: 9, windSpeed: 4, windFrom: 270 }));
bootStep('world'); await bootYield();
engine.use('world', new World(worldConfig)); // generates the heightfield (~1.3 s)
bootStep('sky'); await bootYield();
engine.use('clouds', new Clouds());
bootStep('aircraft'); await bootYield();
engine
  .use('cargo', new CargoSystem())
  .use('walk', new WalkSystem())
  .use('autopilot', new Autopilot())
  .use('player', new PlayerController())
  .use('aircraft', new AircraftManager(new FlightModel(), aircraftRegistry))
  .use('collision', new CollisionSystem()) // airframe vs terrain, water and every solid (after the physics step)
  .use('fx', new Effects())
  .use('damage', new DamageSystem());
bootStep('ui'); await bootYield();
engine
  .use('cameras', new CameraManager())
  .use('map', new MapUI())
  .use('touch', new TouchControls())
  .use('audio', new AudioSystem())
  .use('hud', new HUD())
  .use('coach', new Coach())
  .use('menu', new Menu());

engine.aircraft.player = engine.aircraft.spawn('light-prop', 0, 'main');
engine.use('splash', new Splash()); // last: reads the spawned aircraft, then holds the sim until the player presses Fly
engine.start();
window.engine = engine; // handy in the console: engine.aircraft.player, engine.cameras.set('flyby') ...
window.__booted = true; // index.html shows a failure message on the start screen only until this is set
