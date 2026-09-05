import type { GeneratorDefinition } from '../types.js';
import { buildGetOrderDetails } from './build.js';
import {
  getOrderDetailsOptionsSchema,
  DEFAULTS,
  FIELDS,
  type GetOrderDetailsOptions,
} from './options.js';

/**
 * getOrderDetails - fetch one existing order.
 *
 * Pairs with getOrderList: search first, then open a result. Useful for
 * checking what createOrder actually produced.
 */
export const getOrderDetailsGenerator: GeneratorDefinition<GetOrderDetailsOptions> = {
  id: 'getOrderDetails',
  label: 'getOrderDetails',
  apiName: 'getOrderDetails',
  description:
    'Read-only lookup of a single order by OrderNo or OrderHeaderKey. Supply a key that exists - nothing is generated.',
  formats: ['xml', 'json'],
  fields: FIELDS,
  defaults: DEFAULTS,
  schema: getOrderDetailsOptionsSchema,

  generate(options) {
    return [buildGetOrderDetails(options)];
  },
};