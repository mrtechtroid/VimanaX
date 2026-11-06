/**
 * Contracts of the engine (documentation only - JS is duck-typed).
 * Read this file instead of the implementations when extending.
 *
 * @typedef {Object} IModule  Registered via engine.use(name, module); updated in registration order.
 * @property {(engine:Engine)=>void} [init]
 * @property {(dt:number, engine:Engine)=>void} [update]
 *
 * @typedef {Object} IInputSource  Added via engine.input.addSource(src). Axes are summed across sources.
 * @property {(bus:EventBus)=>void} [init]
 * @property {(dt:number)=>{pitch?:number,roll?:number,yaw?:number,throttleDelta?:number,brake?:number}} poll
 *   pitch +1 = nose up, roll +1 = bank right, yaw +1 = nose right. Discrete actions: bus.emit('action', name).
 *
 * @typedef {Object} IFlightModel  Swappable physics: new AircraftManager(model, registry).
 * @property {(ac:Aircraft, dt:number, env:Environment, world:World)=>void} step
 *   Mutates ac.pos / ac.quat / ac.vel / ac.angVel (body frame) / ac.onGround / ac.telemetry.
 *
 * @typedef {Object} AircraftDefinition  Data only. See aircraft/definitions/*.js
 * @property {string} id @property {string} name @property {string} role
 * @property {Object} flight   numeric params, merged over physics/defaults.js
 * @property {number[]} flaps  flap deflection per notch (0..1)
 * @property {{name:string,body:number,accent:number}[]} liveries
 * @property {{chaseDist:number,chaseHeight:number,eye:{x,y,z},wing?:{x,y,z,look:{x,y,z}}}} camera  wing = optional wing-mounted camera (body frame)
 * @property {{takeoff?:number,approach?:number,landing?:number}} [autoFlaps]  flap indices used by auto flaps (defaults 1 / 2 / last). `flight.vFe` (m/s per index) overrides the derived flap speeds.
 * @property {(livery:Object)=>THREE.Group} buildMesh  Group.userData.parts = {aileronL,aileronR,elevator,rudder,flaps[],gear[],props[],strobes[]}
 *
 * Bus events added in v0.2: 'flaps:set' (index), 'camera:mode' (id). Actions added: flapsAuto, cameraReset, menu, hud.
 * Engine.paused: modules without `alwaysUpdate` are skipped (menu open). Settings: units, controlSensitivity, autoFlaps, cameraSensitivity, fov, camRecenter, pauseOnMenu, sound.
 *
 * Conventions: +X right, +Y up, forward = -Z (body & world). North = -Z, East = +X. SI units internally.
 */
export {};
