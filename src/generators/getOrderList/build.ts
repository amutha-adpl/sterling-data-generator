/**
 * Builds the getOrderList input document.
 *
 * The whole payload is one `<Order>` element used as a query template: Sterling
 * matches on whatever attributes are present and ignores the rest. Nothing is
 * generated or invented, so there is nothing here that can be "wrong data" -
 * the only risk is filtering on a value your environment does not have, which
 * simply returns an empty list rather than an error.
 */

import type { XmlNode } from '../../core/xml.js';
import type { GeneratedDocument } from '../types.js';
import type { GetOrderListOptions } from './options.js';

export function buildGetOrderList(options: GetOrderListOptions): GeneratedDocument {
  const tree: XmlNode = {
    name: 'Order',
    attrs: {
      EnterpriseCode: options.enterpriseCode,
      MaximumRecords: String(options.maximumRecords),
      OrderNo: options.orderNo || undefined,
      DocumentType: options.documentType || undefined,
      Status: options.status || undefined,
      CustomerID: options.customerId || undefined,
      SellerOrganizationCode: options.sellerOrganizationCode || undefined,
      FromOrderDate: options.fromOrderDate || undefined,
      ToOrderDate: options.toOrderDate || undefined,
    },
  };

  return { key: 'getOrderList', label: describe(options), tree };
}

/** Short human summary of the query, shown in the document list. */
function describe(options: GetOrderListOptions): string {
  const filters = [
    options.orderNo && `OrderNo ${options.orderNo}`,
    options.documentType && `type ${options.documentType}`,
    options.status && `status ${options.status}`,
    options.customerId && `customer ${options.customerId}`,
    options.sellerOrganizationCode && `seller ${options.sellerOrganizationCode}`,
    options.fromOrderDate && `from ${options.fromOrderDate}`,
    options.toOrderDate && `to ${options.toOrderDate}`,
  ].filter((part): part is string => Boolean(part));

  const suffix = filters.length > 0 ? ` - ${filters.join(', ')}` : ' - no filters';
  return `getOrderList (max ${options.maximumRecords})${suffix}`;
}