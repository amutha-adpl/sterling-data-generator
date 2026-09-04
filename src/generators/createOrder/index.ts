import { createFaker } from '../../core/rng.js';
import type { GeneratorDefinition } from '../types.js';
import { buildCreateOrder } from './build.js';
import {
  createOrderOptionsSchema,
  DEFAULTS,
  FIELDS,
  type CreateOrderOptions,
} from './options.js';

export const createOrderGenerator: GeneratorDefinition<CreateOrderOptions> = {
  id: 'createOrder',
  label: 'createOrder',
  apiName: 'createOrder',
  description:
    'Generates Sterling createOrder input documents: header, order lines, bill-to/ship-to, charges, taxes, totals and payment method.',
  formats: ['xml', 'json'],
  fields: FIELDS,
  defaults: DEFAULTS,
  schema: createOrderOptionsSchema,

  generate(options) {
    // One seeded faker for the whole batch: the run is reproducible as a unit.
    const faker = createFaker(options.seed);
    const documents = [];
    for (let sequence = 1; sequence <= options.count; sequence += 1) {
      documents.push(buildCreateOrder(options, faker, sequence));
    }
    return documents;
  },
};
