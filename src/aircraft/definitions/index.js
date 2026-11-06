import { Registry } from '../../core/Registry.js';
import lightProp from './lightProp.js';
import transport from './transport.js';

/** To add an aircraft: create a definition file, import it here, add it to the list. */
export const aircraftRegistry = new Registry('aircraft');
[lightProp, transport].forEach(d => aircraftRegistry.register(d.id, d));
