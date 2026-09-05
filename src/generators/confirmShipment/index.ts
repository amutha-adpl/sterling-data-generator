import type { GeneratorDefinition } from '../types.js';
import { buildConfirmShipment } from './build.js';
import {
  confirmShipmentOptionsSchema,
  DEFAULTS,
  FIELDS,
  type ConfirmShipmentOptions,
} from './options.js';

/**
 * confirmShipment - confirm that a shipment left the node.
 *
 * The only mutating API in the set, so it is header-level and takes nothing
 * but keys. scheduleOrder / releaseOrder are handled by an async agent in this
 * environment and are intentionally not implemented here.
 */
export const confirmShipmentGenerator: GeneratorDefinition<ConfirmShipmentOptions> = {
  id: 'confirmShipment',
  label: 'confirmShipment',
  apiName: 'confirmShipment',
  description:
    'Confirms a shipment. CHANGES DATA - only send against a test order. Header-level only: order keys plus optional ShipNode, ShipmentNo and TrackingNo.',
  formats: ['xml', 'json'],
  fields: FIELDS,
  defaults: DEFAULTS,
  schema: confirmShipmentOptionsSchema,

  generate(options) {
    return [buildConfirmShipment(options)];
  },
};