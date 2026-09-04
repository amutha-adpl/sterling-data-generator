/**
 * Money helpers.
 *
 * All internal arithmetic uses integer cents so generated totals always add up.
 * Amounts are only converted to strings (2 decimals, no currency symbol) at the
 * point they are written into a payload.
 */

export type Cents = number;

export function dollarsToCents(amount: number): Cents {
  return Math.round(amount * 100);
}

export function centsToAmount(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/** Amount of `ratePct` percent of `cents`, rounded half-up to the nearest cent. */
export function percentageOf(cents: Cents, ratePct: number): Cents {
  return Math.round((cents * ratePct) / 100);
}
