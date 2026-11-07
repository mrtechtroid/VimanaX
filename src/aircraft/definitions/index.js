import { Registry } from '../../core/Registry.js';
import lightProp, { floatplane } from './lightProp.js';
import transport from './transport.js';
import { citation, atr42, b738 } from './fr24.js';

/** To add an aircraft: create a definition file, import it here, add it to the list. */
export const aircraftRegistry = new Registry('aircraft');
[lightProp, transport, citation, atr42, b738, floatplane].forEach(d => aircraftRegistry.register(d.id, d));
