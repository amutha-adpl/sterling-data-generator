/**
 * Options for the createOrder generator.
 *
 * The Zod schema is the single source of truth: it validates the request body,
 * applies defaults and normalises ranges. The web UI renders itself from
 * `FIELDS` and `DEFAULTS`, so the form and the validation can never disagree.
 */

import { z } from 'zod';
import type { FieldSpec } from '../types.js';

export const DOCUMENT_TYPES = [
  { value: '0001', label: '0001 - Sales order' },
  { value: '0003', label: '0003 - Return order' },
  { value: '0005', label: '0005 - Purchase order' },
  { value: '0006', label: '0006 - Transfer order' },
] as const;

export const ENTRY_TYPES = [
  { value: 'WEB', label: 'WEB' },
  { value: 'PHONE', label: 'PHONE' },
  { value: 'CATALOG', label: 'CATALOG' },
  { value: 'IN_STORE', label: 'IN_STORE' },
  { value: 'EMAIL', label: 'EMAIL' },
  { value: 'FAX', label: 'FAX' },
] as const;

export const CURRENCIES = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - Pound Sterling' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
] as const;

export const PAYMENT_STATUSES = [
  { value: 'NOT_AUTHORIZED', label: 'NOT_AUTHORIZED' },
  { value: 'AUTHORIZED', label: 'AUTHORIZED' },
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
    documentType: z.enum(valuesOf(DOCUMENT_TYPES)).default('0001'),
    entryType: z.enum(valuesOf(ENTRY_TYPES)).default('WEB'),
    orderType: z.string().trim().min(1).max(24).default('WEB'),
    orderNoPrefix: z.string().trim().min(1).max(12).default('ORD'),
    orderDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use ISO format: YYYY-MM-DD')
      .default(() => new Date().toISOString().slice(0, 10)),
    currency: z.enum(valuesOf(CURRENCIES)).default('USD'),
    paymentStatus: z.enum(valuesOf(PAYMENT_STATUSES)).default('NOT_AUTHORIZED'),

    minLines: z.coerce.number().int().min(1).max(50).default(1),
    maxLines: z.coerce.number().int().min(1).max(50).default(3),
    minQty: z.coerce.number().int().min(1).max(999).default(1),
    maxQty: z.coerce.number().int().min(1).max(999).default(2),
    minUnitPrice: z.coerce.number().min(0).max(1_000_000).default(25),
    maxUnitPrice: z.coerce.number().min(0).max(1_000_000).default(250),
    taxRatePct: z.coerce.number().min(0).max(100).default(8.25),
    shippingCharge: z.coerce.number().min(0).max(100_000).default(9.99),
    shipNodes: z.string().trim().max(400).default('DC001,STORE-1001'),

    includeTaxes: booleanField(true),
    includePaymentMethod: booleanField(true),
    includeLineShipTo: booleanField(false),
    includeExtn: booleanField(false),
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
    placeholder: 'DEFAULT',
  },
  {
    name: 'sellerOrganizationCode',
    label: 'SellerOrganizationCode',
    kind: 'text',
    group: 'Order header',
    placeholder: 'DEFAULT',
  },
  {
    name: 'documentType',
    label: 'DocumentType',
    kind: 'select',
    options: DOCUMENT_TYPES,
    group: 'Order header',
    help: 'IBM default document types. Adjust to match your configuration.',
  },
  { name: 'entryType', label: 'EntryType', kind: 'select', options: ENTRY_TYPES, group: 'Order header' },
  { name: 'orderType', label: 'OrderType', kind: 'text', group: 'Order header', placeholder: 'WEB' },
  {
    name: 'orderNoPrefix',
    label: 'Order number prefix',
    kind: 'text',
    group: 'Order header',
    placeholder: 'ORD',
    help: 'Order numbers become ORD0000001, ORD0000002, ... Sterling ignores this if it generates its own numbers.',
  },
  {
    name: 'orderDate',
    label: 'Order date',
    kind: 'text',
    inputType: 'date',
    group: 'Order header',
    placeholder: '2026-09-04',
    help: 'Base date for OrderDate, ReqShipDate (+2d) and ReqDeliveryDate (+5d).',
  },
  { name: 'currency', label: 'Currency', kind: 'select', options: CURRENCIES, group: 'Order header' },
  {
    name: 'paymentStatus',
    label: 'PaymentStatus',
    kind: 'select',
    options: PAYMENT_STATUSES,
    group: 'Order header',
    help: 'NOT_AUTHORIZED is the safe default: it creates the order without a real authorisation.',
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
    help: 'Applied per line and to the shipping charge. Totals always add up.',
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
    help: 'Comma separated. One node is picked per order line.',
  },

  { name: 'includeTaxes', label: 'Include <LineTaxes> and <HeaderTaxes>', kind: 'boolean', group: 'Optional blocks' },
  { name: 'includePaymentMethod', label: 'Include <PaymentMethods>', kind: 'boolean', group: 'Optional blocks' },
  {
    name: 'includeLineShipTo',
    label: 'Repeat ship-to address on every line',
    kind: 'boolean',
    group: 'Optional blocks',
    help: 'Off by default; the header level <PersonInfoShipTo> is always present.',
  },
  {
    name: 'includeExtn',
    label: 'Include <Extn> sample attributes',
    kind: 'boolean',
    group: 'Optional blocks',
    help: 'ExtnHostOrderReference / ExtnChannel / ExtnLoyaltyId - replace with your own extension attributes.',
  },
];

/** Group order as displayed in the UI. */
export const FIELD_GROUPS: readonly string[] = ['Batch', 'Order header', 'Lines & pricing', 'Optional blocks'];
