/**
 * Options for the getOrderList generator.
 *
 * This is a QUERY, not a create: the payload is a filter. There is nothing to
 * invent here - every attribute is either supplied by the user or omitted.
 * Blank text options are left out of the payload entirely, so the default
 * output is the smallest query Sterling will accept.
 *
 * Document types and statuses differ between instances, so they are `combo`
 * fields: the suggestions are prompts, whatever you type is passed through.
 */

import { z } from 'zod';
import type { FieldSpec } from '../types.js';

export const DOCUMENT_TYPES = [
  { value: '0001', label: '0001 - Sales order' },
  { value: '0003', label: '0003 - Return order' },
  { value: '0005', label: '0005 - Purchase order' },
  { value: '0006', label: '0006 - Transfer order' },
] as const;

export const ORDER_STATUSES = [
  { value: 'Created', label: 'Created' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'Released', label: 'Released' },
  { value: 'Backordered', label: 'Backordered' },
  { value: 'Shipped', label: 'Shipped' },
  { value: 'Delivered', label: 'Delivered' },
  { value: 'Cancelled', label: 'Cancelled' },
] as const;

export const getOrderListOptionsSchema = z.object({
  enterpriseCode: z.string().trim().min(1).max(24).default('DEFAULT'),
  maximumRecords: z.coerce.number().int().min(1).max(200).default(10),

  orderNo: z.string().trim().max(24).default(''),
  documentType: z.string().trim().max(24).default(''),
  status: z.string().trim().max(40).default(''),
  customerId: z.string().trim().max(40).default(''),
  sellerOrganizationCode: z.string().trim().max(24).default(''),
  fromOrderDate: z.string().trim().max(24).default(''),
  toOrderDate: z.string().trim().max(24).default(''),
});

export type GetOrderListOptions = z.infer<typeof getOrderListOptionsSchema>;

export const DEFAULTS: GetOrderListOptions = getOrderListOptionsSchema.parse({});

export const FIELDS: readonly FieldSpec[] = [
  {
    name: 'enterpriseCode',
    label: 'EnterpriseCode',
    kind: 'text',
    maxLength: 24,
    group: 'Query',
    help: 'Required by Sterling.',
  },
  {
    name: 'maximumRecords',
    label: 'MaximumRecords',
    kind: 'number',
    min: 1,
    max: 200,
    step: 1,
    group: 'Query',
    help: 'Caps the number of orders returned. Keep it small.',
  },
  {
    name: 'orderNo',
    label: 'OrderNo',
    kind: 'text',
    maxLength: 24,
    placeholder: 'exact order number',
    group: 'Filters',
    help: 'Blank returns every order. Fill this in to fetch one.',
  },
  {
    name: 'documentType',
    label: 'DocumentType',
    kind: 'combo',
    options: DOCUMENT_TYPES,
    placeholder: 'e.g. 0001',
    group: 'Filters',
    help: 'Optional. Blank means all document types.',
  },
  {
    name: 'status',
    label: 'Status',
    kind: 'combo',
    options: ORDER_STATUSES,
    placeholder: 'e.g. Shipped',
    group: 'Filters',
    help: 'Optional. Status names differ between instances - type your own.',
  },
  {
    name: 'customerId',
    label: 'CustomerID',
    kind: 'text',
    maxLength: 40,
    placeholder: 'customer id',
    group: 'Filters',
    help: 'Optional.',
  },
  {
    name: 'sellerOrganizationCode',
    label: 'SellerOrganizationCode',
    kind: 'text',
    maxLength: 24,
    placeholder: 'e.g. POTHYS',
    group: 'Filters',
    help: 'Optional.',
  },
  {
    name: 'fromOrderDate',
    label: 'FromOrderDate',
    kind: 'text',
    inputType: 'date',
    maxLength: 24,
    group: 'Filters',
    help: 'Optional date range start.',
  },
  {
    name: 'toOrderDate',
    label: 'ToOrderDate',
    kind: 'text',
    inputType: 'date',
    maxLength: 24,
    group: 'Filters',
    help: 'Optional date range end.',
  },
];