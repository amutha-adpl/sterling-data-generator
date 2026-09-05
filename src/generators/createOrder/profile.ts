/**
 * Storefront profile.
 *
 * These are implementation settings rather than test data, so they are not
 * exposed as form fields - edit this file once to match your Sterling
 * configuration, and every generated order uses the values.
 *
 * The default values mirror a storefront (web) order placement.
 */

/**
 * DocumentType emitted for each order kind.
 *
 * IBM default document types. If your implementation defines its own, change
 * the values here - the presets only control structure.
 */
export const ORDER_KIND_DOCUMENT_TYPES = {
  SALES: '0001',
  RETURN: '0003',
  PURCHASE: '0005',
  TRANSFER: '0006',
} as const;

/** DocumentType of the order a return / purchase / transfer order points back to. */
export const SOURCE_DOCUMENT_TYPE = '0001';

export const STOREFRONT_PROFILE = {
  /** DeliveryMethod on the order header and every order line. */
  deliveryMethod: 'SHP',
  /** LineType on every order line. */
  lineType: 'PRODUCT',
  /** ProductClass on the order line and on the item. */
  productClass: 'GOOD',
  /** Carrier SCAC. Must exist in your carrier setup. */
  scac: 'ups',
  /** Carrier service. Must exist for the SCAC above. */
  carrierServiceCode: 'express',
  /** Segment / SegmentType, sent blank by the storefront. */
  segment: '',
  segmentType: '',

  /** Payment method used by the storefront (card payments via Stripe). */
  paymentType: 'STRIPE_CARD',
  /** ChargeType on PaymentDetails. */
  paymentChargeType: 'AUTHORIZATION',
  /** Values the storefront stamps on an authorised payment. */
  authCode: 'AUTH_SUCCESS',
  paymentReference2: 'STRIPE',
  chargeSequence: '0',

  /**
   * First BillToID / CustomerID. Each generated order gets the next id in the
   * sequence (100000010, 100000011, ...). Point this at a customer that exists
   * in your instance - the ids are master-data references, not free text.
   */
  customerIdStart: 100000010,

  /** ReqDeliveryDate = base date + this many days. */
  deliveryLeadDays: 5,
} as const;

/** `<SCAC>_<CarrierServiceCode>`, e.g. `ups_express`. */
export function scacAndService(): string {
  return `${STOREFRONT_PROFILE.scac}_${STOREFRONT_PROFILE.carrierServiceCode}`;
}