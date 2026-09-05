/**
 * Options for the createOrder generator.
 *
 * The Zod schema is the single source of truth: it validates the request body,
 * applies defaults and normalises ranges. The web UI renders itself from
 * `FIELDS` and `DEFAULTS`, so the form and the validation can never disagree.
 *
 * Blank text options are omitted from the payload. That keeps the default
 * output identical to the storefront order payload, which is what Sterling's
 * `createOrder_input.xml` API template exposes.
 */

import { z } from 'zod';
import type { FieldSpec } from '../types.js';

/**
 * Order kinds. Each kind emits the same `createOrder` API with a different
 * DocumentType plus the type-specific attributes and cross-reference elements.
 * See `ORDER_KIND_DOCUMENT_TYPES` in `profile.ts` for the DocumentType mapping.
 */
export const ORDER_KIND_VALUES = ['SALES', 'RETURN', 'PURCHASE', 'TRANSFER'] as const;

export const ORDER_KINDS = [
  { value: 'SALES', label: 'Sales order (0001)' },
  { value: 'RETURN', label: 'Return order (0003)' },
  { value: 'PURCHASE', label: 'Purchase order (0005)' },
  { value: 'TRANSFER', label: 'Transfer order (0006)' },
] as const;

export const ENTRY_TYPES = [
  { value: '', label: '(omit)' },
  { value: 'WEB', label: 'WEB' },
  { value: 'PHONE', label: 'PHONE' },
  { value: 'CATALOG', label: 'CATALOG' },
  { value: 'IN_STORE', label: 'IN_STORE' },
  { value: 'EMAIL', label: 'EMAIL' },
  { value: 'FAX', label: 'FAX' },
] as const;

export const CURRENCIES = [
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Pound Sterling' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
] as const;

export const PAYMENT_TYPES = [
  { value: '', label: '(profile default)' },
  { value: 'CREDIT_CARD', label: 'CREDIT_CARD' },
  { value: 'CASH', label: 'CASH' },
  { value: 'CHECK', label: 'CHECK' },
  { value: 'GIFT_CARD', label: 'GIFT_CARD' },
  { value: 'INVOICE', label: 'INVOICE' },
] as const;

export const PAYMENT_STATUSES = [
  { value: 'AUTHORIZED', label: 'AUTHORIZED' },
  { value: 'NOT_AUTHORIZED', label: 'NOT_AUTHORIZED' },
  { value: 'READY_FOR_COLLECTION', label: 'READY_FOR_COLLECTION' },
] as const;

const valuesOf = <T extends ReadonlyArray<{ value: string }>>(options: T) =>
  options.map((option) => option.value) as [string, ...string[]];

/** Accepts real booleans as well as the string values an HTML form produces. */
const booleanField = (fallback: boolean) =>
  z
    .preprocess((value) => {
      if (typeof value === 'string') return ['true', '1', 'on', 'yes'].includes(value.toLowerCase());
      return Boolean(value);
    }, z.boolean())
    .default(fallback);

export const createOrderOptionsSchema = z
  .object({
    count: z.coerce.number().int().min(1).max(500).default(5),
    seed: z.coerce.number().int().min(0).max(2_147_483_647).default(42),

    enterpriseCode: z.string().trim().min(1).max(24).default('DEFAULT'),
    sellerOrganizationCode: z.string().trim().min(1).max(24).default('DEFAULT'),
    orderKind: z.enum(ORDER_KIND_VALUES).default('SALES'),
    // Only used by the return / purchase / transfer presets.
    receivingNode: z.string().trim().max(24).default(''),
    sourceOrderNo: z.string().trim().max(24).default(''),
    returnReason: z.string().trim().max(40).default('DAMAGED'),
    // Free text: every instance configures its own codes.
    entryType: z.string().trim().max(24).default(''),
    orderType: z.string().trim().max(24).default(''),
    /** Left blank so Sterling assigns the number (see build.ts). */
    orderNo: z.string().trim().max(24).default(''),
    orderDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO format: YYYY-MM-DD')
      .default(() => new Date().toISOString().slice(0, 10)),
    currency: z.enum(valuesOf(CURRENCIES)).default('INR'),
    // Free text: every instance configures its own statuses.
    paymentStatus: z.string().trim().max(32).default('AUTHORIZED'),

    minLines: z.coerce.number().int().min(1).max(50).default(1),
    maxLines: z.coerce.number().int().min(1).max(50).default(3),
    minQty: z.coerce.number().int().min(1).max(999).default(1),
    maxQty: z.coerce.number().int().min(1).max(999).default(2),
    minUnitPrice: z.coerce.number().min(0).max(1_000_000).default(199),
    maxUnitPrice: z.coerce.number().min(0).max(1_000_000).default(4999),
    taxRatePct: z.coerce.number().min(0).max(100).default(18),
    shippingCharge: z.coerce.number().min(0).max(100_000).default(149),
    shipNodes: z.string().trim().max(400).default(''),

    includeTaxes: booleanField(false),
    includePaymentMethod: booleanField(false),
    paymentType: z.string().trim().max(24).default(''),
    includeLineShipTo: booleanField(false),
  })
  .transform((options) => {
    // Ranges are swapped rather than rejected so a slightly wrong form still
    // produces usable data.
    const [minLines, maxLines] = sortRange(options.minLines, options.maxLines);
    const [minQty, maxQty] = sortRange(options.minQty, options.maxQty);
    const [minUnitPrice, maxUnitPrice] = sortRange(options.minUnitPrice, options.maxUnitPrice);
    return { ...options, minLines, maxLines, minQty, maxQty, minUnitPrice, maxUnitPrice };
  });

function sortRange(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export type CreateOrderOptions = z.infer<typeof createOrderOptionsSchema>;

/** Sales / return / purchase / transfer. */
export type OrderKind = (typeof ORDER_KINDS)[number]['value'];

export const DEFAULTS: CreateOrderOptions = createOrderOptionsSchema.parse({});

export const FIELDS: readonly FieldSpec[] = [
  {
    name: 'count',
    label: 'Orders to generate',
    kind: 'number',
    min: 1,
    max: 500,
    group: 'Batch',
    help: 'How many <Order> documents to create.',
  },
  {
    name: 'seed',
    label: 'Random seed',
    kind: 'number',
    min: 0,
    max: 2_147_483_647,
    group: 'Batch',
    help: 'Same seed + same options = identical output, every time.',
  },

  {
    name: 'enterpriseCode',
    label: 'EnterpriseCode',
    kind: 'text',
    group: 'Order header',
    placeholder: 'POTHYS',
    help: 'Also used as the Item OrganizationCode.',
  },
  {
    name: 'sellerOrganizationCode',
    label: 'SellerOrganizationCode',
    kind: 'text',
    group: 'Order header',
    placeholder: 'POTHYS',
    help: 'Also used as BuyerOrganizationCode (single-enterprise storefront setup).',
  },
  {
    name: 'orderKind',
    label: 'Order type',
    kind: 'select',
    options: ORDER_KINDS,
    group: 'Order header',
    help: 'Sets DocumentType and the type-specific structure. DocumentType comes from ORDER_KIND_DOCUMENT_TYPES in profile.ts.',
  },
  {
    name: 'receivingNode',
    label: 'Receiving node',
    kind: 'text',
    group: 'Order header',
    placeholder: 'DC001',
    help: 'Return / purchase / transfer only. Blank = omit. The node that receives the goods.',
    visibleWhen: { field: 'orderKind', in: ['RETURN', 'PURCHASE', 'TRANSFER'] },
  },
  {
    name: 'sourceOrderNo',
    label: 'Source OrderNo',
    kind: 'text',
    group: 'Order header',
    placeholder: 'e.g. Y100000123',
    help: 'Return / purchase / transfer only. The OrderNo of an order that ALREADY exists - this becomes <DerivedFrom OrderNo="..."> or <ChainedFrom>. It is not generated; look it up in your OMS.',
    visibleWhen: { field: 'orderKind', in: ['RETURN', 'PURCHASE', 'TRANSFER'] },
  },
  {
    name: 'returnReason',
    label: 'Return reason <ReturnReason>',
    kind: 'text',
    group: 'Order header',
    placeholder: 'DAMAGED',
    help: 'Return only. Must be a return reason configured in your instance.',
    visibleWhen: { field: 'orderKind', in: ['RETURN'] },
  },
  {
    name: 'entryType',
    label: 'EntryType',
    kind: 'combo',
    options: ENTRY_TYPES,
    placeholder: 'e.g. WEB',
    group: 'Order header',
    help: 'Suggested values only - type your own if your instance uses different codes. Blank = omit from the payload.',
  },
  {
    name: 'orderType',
    label: 'OrderType',
    kind: 'text',
    group: 'Order header',
    placeholder: 'WEB',
    help: 'Blank = omit from the payload.',
  },
  {
    name: 'orderNo',
    label: 'OrderNo',
    kind: 'text',
    group: 'Order header',
    placeholder: 'e.g. ORD0000001',
    help: 'Leave blank and Sterling assigns the order number itself. If you set one, it is sent as-is; in a batch of several orders a sequence suffix is added so they stay unique.',
  },
  {
    name: 'orderDate',
    label: 'Base date',
    kind: 'text',
    inputType: 'date',
    group: 'Order header',
    placeholder: '2026-09-04',
    help: 'ReqDeliveryDate = base date + 5 days.',
  },
  { name: 'currency', label: 'Currency', kind: 'select', options: CURRENCIES, group: 'Order header' },
  {
    name: 'paymentStatus',
    label: 'PaymentStatus',
    kind: 'combo',
    options: PAYMENT_STATUSES,
    placeholder: 'e.g. AUTHORIZED',
    group: 'Order header',
    help: 'Suggested values only - type your own. AUTHORIZED matches a storefront order; the authorisation itself is synthetic.',
  },

  { name: 'minLines', label: 'Min lines per order', kind: 'number', min: 1, max: 50, group: 'Lines & pricing' },
  { name: 'maxLines', label: 'Max lines per order', kind: 'number', min: 1, max: 50, group: 'Lines & pricing' },
  { name: 'minQty', label: 'Min line quantity', kind: 'number', min: 1, max: 999, group: 'Lines & pricing' },
  { name: 'maxQty', label: 'Max line quantity', kind: 'number', min: 1, max: 999, group: 'Lines & pricing' },
  { name: 'minUnitPrice', label: 'Min unit price', kind: 'number', min: 0, max: 1_000_000, step: 0.01, group: 'Lines & pricing' },
  { name: 'maxUnitPrice', label: 'Max unit price', kind: 'number', min: 0, max: 1_000_000, step: 0.01, group: 'Lines & pricing' },
  {
    name: 'taxRatePct',
    label: 'Tax rate (%)',
    kind: 'number',
    min: 0,
    max: 100,
    step: 0.01,
    group: 'Lines & pricing',
    help: 'Applied per line and to the shipping charge when taxes are enabled.',
    visibleWhen: { field: 'includeTaxes', in: [true] },
  },
  {
    name: 'shippingCharge',
    label: 'Shipping charge',
    kind: 'number',
    min: 0,
    max: 100_000,
    step: 0.01,
    group: 'Lines & pricing',
    help: 'Header freight charge. Use 0 to omit <HeaderCharges> entirely.',
  },
  {
    name: 'shipNodes',
    label: 'Ship nodes',
    kind: 'text',
    group: 'Lines & pricing',
    placeholder: 'DC001,STORE-1001',
    help: 'Comma separated; one node is picked per order line. Blank = omit ShipNode and let sourcing decide.',
  },

  {
    name: 'includeTaxes',
    label: 'Include <LineTaxes> and <HeaderTaxes>',
    kind: 'boolean',
    group: 'Optional blocks',
    help: 'Off by default - the storefront payload carries no taxes. Only enable if your API template exposes them.',
  },
  {
    name: 'includePaymentMethod',
    label: 'Include <PaymentMethods>',
    kind: 'boolean',
    group: 'Optional blocks',
    help: 'Off by default: the PaymentType must be configured for your seller in Sterling, or the order is rejected with YFS10491.',
  },
  {
    name: 'paymentType',
    label: 'PaymentType',
    kind: 'combo',
    options: PAYMENT_TYPES,
    placeholder: 'e.g. CREDIT_CARD',
    group: 'Optional blocks',
    help: 'Only used when <PaymentMethods> is on. Blank falls back to the profile default. Must be a payment type set up for your seller.',
    visibleWhen: { field: 'includePaymentMethod', in: [true] },
  },
  {
    name: 'includeLineShipTo',
    label: 'Repeat ship-to address on every line',
    kind: 'boolean',
    group: 'Optional blocks',
    help: 'Off by default; the header level <PersonInfoShipTo> is always present.',
  },
];

/** Group order as displayed in the UI. */
export const FIELD_GROUPS: readonly string[] = ['Batch', 'Order header', 'Lines & pricing', 'Optional blocks'];