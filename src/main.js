import { Engine } from './core/Engine.js';
import { Settings } from './config/Settings.js';
import worldConfig from './config/worldConfig.js';
import { InputManager } from './input/InputManager.js';
import { Environment } from './world/Environment.js';
import { World } from './world/World.js';
import { FlightModel } from './physics/FlightModel.js';
import { AircraftManager } from './aircraft/AircraftManager.js';
import { PlayerController } from './aircraft/PlayerController.js';
import { aircraftRegistry } from './aircraft/definitions/index.js';
import { CameraManager } from './camera/CameraManager.js';
import { HUD } from './ui/HUD.js';

// Composition root: swap/add modules here. Update order = registration order.
const engine = new Engine(document.getElementById('view'));
engine
  .use('settings', new Settings())
  .use('input', new InputManager())
  .use('env', new Environment({ hour: 9, windSpeed: 4, windFrom: 270 }))
  .use('world', new World(worldConfig))
  .use('player', new PlayerController())
  .use('aircraft', new AircraftManager(new FlightModel(), aircraftRegistry))
  .use('cameras', new CameraManager())
  .use('hud', new HUD());

engine.aircraft.player = engine.aircraft.spawn('light-prop', 0, 'main');
engine.start();
