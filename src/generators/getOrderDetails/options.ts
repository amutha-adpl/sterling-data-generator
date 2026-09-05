/**
 * Options for the getOrderDetails generator.
 *
 * The smallest useful Sterling call: one order, by OrderNo (or OrderHeaderKey).
 * Both are supplied by the user - run getOrderList first to get real values.
 */

import { z } from 'zod';
import type { FieldSpec } from '../types.js';

export const getOrderDetailsOptionsSchema = z.object({
  enterpriseCode: z.string().trim().min(1).max(24).default('DEFAULT'),
  orderNo: z.string().trim().max(24).default(''),
  orderHeaderKey: z.string().trim().max(40).default(''),
  documentType: z.string().trim().max(24).default(''),
});

export type GetOrderDetailsOptions = z.infer<typeof getOrderDetailsOptionsSchema>;

export const DEFAULTS: GetOrderDetailsOptions = getOrderDetailsOptionsSchema.parse({});

export const FIELDS: readonly FieldSpec[] = [
  {
    name: 'enterpriseCode',
    label: 'EnterpriseCode',
    kind: 'text',
    maxLength: 24,
    group: 'Query',
  },
  {
    name: 'orderNo',
    label: 'OrderNo',
    kind: 'text',
    maxLength: 24,
    placeholder: 'e.g. Y100000001',
    group: 'Query',
    help: 'Required unless you supply OrderHeaderKey. Use an OrderNo that exists - getOrderList will show you real ones.',
  },
  {
    name: 'orderHeaderKey',
    label: 'OrderHeaderKey',
    kind: 'text',
    maxLength: 40,
    placeholder: 'alternative to OrderNo',
    group: 'Query',
    help: 'Optional. Sterling prefers this key when both are supplied.',
  },
  {
    name: 'documentType',
    label: 'DocumentType',
    kind: 'text',
    maxLength: 24,
    placeholder: 'e.g. 0001',
    group: 'Query',
    help: 'Optional.',
  },
];