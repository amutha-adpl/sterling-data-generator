/**
 * Builds the getOrderDetails input document.
 *
 * One `<Order>` element carrying the key of an existing order. Every value
 * comes from the user, so nothing here can be rejected as bad sample data -
 * at worst the order does not exist and Sterling returns an empty result.
 */

import type { XmlNode } from '../../core/xml.js';
import type { GeneratedDocument } from '../types.js';
import type { GetOrderDetailsOptions } from './options.js';

export function buildGetOrderDetails(options: GetOrderDetailsOptions): GeneratedDocument {
  const tree: XmlNode = {
    name: 'Order',
    attrs: {
      EnterpriseCode: options.enterpriseCode,
      OrderNo: options.orderNo || undefined,
      OrderHeaderKey: options.orderHeaderKey || undefined,
      DocumentType: options.documentType || undefined,
    },
  };

  const key = options.orderNo || options.orderHeaderKey || 'no-order-key';
  return { key: 'getOrderDetails', label: `getOrderDetails - ${key}`, tree };
}