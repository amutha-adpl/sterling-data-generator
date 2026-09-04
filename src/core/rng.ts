/**
 * Seeded random source.
 *
 * Every generation run is reproducible: the same seed always produces the same
 * payloads, which makes sample data safe to share in bug reports and tests.
 */

import { Faker, base, en, en_US } from '@faker-js/faker';

/** Address data is only complete in the `en_US` pool, so sample addresses are US-based. */
export const SUPPORTED_LOCALE = 'en_US';

export function createFaker(seed: number): Faker {
  const faker = new Faker({ locale: [en_US, en, base] });
  faker.seed(seed);
  return faker;
}

export function randomInt(faker: Faker, min: number, max: number): number {
  return faker.number.int({ min, max });
}

/** Pick one element from a non-empty list. */
export function pickOne<T>(faker: Faker, values: readonly T[]): T {
  const index = faker.number.int({ min: 0, max: values.length - 1 });
  const value = values[index] ?? values[0];
  if (value === undefined) {
    throw new Error('pickOne() requires a non-empty list');
  }
  return value;
}
