/**
 * Builds the confirmShipment input document.
 *
 * API security filters elements, not attributes, so this emits the attributes
 * the API understands. Blanks are omitted rather than sent as empty strings,
 * which means the default output is `<Shipment/>` - Sterling answers that with
 * a validation error naming what it needs, instead of a payload it thinks is
 * wrong.
 */

import type { XmlNode } from '../../core/xml.js';
import type { GeneratedDocument } from '../types.js';
import type { ConfirmShipmentOptions } from './options.js';

export function buildConfirmShipment(options: ConfirmShipmentOptions): GeneratedDocument {
  const tree: XmlNode = {
    name: 'Shipment',
    attrs: {
      ShipmentKey: options.shipmentKey || undefined,
      ShipmentNo: options.shipmentNo || undefined,
      ShipNode: options.shipNode || undefined,
      SellerOrganizationCode: options.sellerOrganizationCode || undefined,
      EnterpriseCode: options.enterpriseCode || undefined,
      OrderNo: options.orderNo || undefined,
      TrackingNo: options.trackingNo || undefined,
    },
  };

  const key =
    options.shipmentKey ||
    options.shipmentNo ||
    options.orderNo ||
    options.shipNode ||
    'no-shipment-key';
  return { key: 'confirmShipment', label: `confirmShipment - ${key}`, tree };
}