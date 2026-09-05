import type { GeneratorDefinition } from '../types.js';
import { buildGetOrderList } from './build.js';
import {
  getOrderListOptionsSchema,
  DEFAULTS,
  FIELDS,
  type GetOrderListOptions,
} from './options.js';

/**
 * getOrderList - read-only order search.
 *
 * Chosen as the second API because it needs no master data at all: it is the
 * one Sterling call that cannot fail on bad sample values. It is also how the
 * UI can obtain real OrderNos for return / purchase / transfer orders.
 */
export const getOrderListGenerator: GeneratorDefinition<GetOrderListOptions> = {
  id: 'getOrderList',
  label: 'getOrderList',
  apiName: 'getOrderList',
  description:
    'Read-only order search. Builds an <Order> query from your filters - EnterpriseCode, OrderNo, DocumentType, Status, customer, seller and a date range. Nothing is invented.',
  formats: ['xml', 'json'],
  fields: FIELDS,
  defaults: DEFAULTS,
  schema: getOrderListOptionsSchema,

  generate(options) {
    // A query is a single document: there is nothing to batch.
    return [buildGetOrderList(options)];
  },
};