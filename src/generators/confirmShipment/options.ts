/**
 * Options for the confirmShipment generator.
 *
 * API security in Sterling filters ELEMENTS, not attributes. The instance
 * input template (repository/xapi/template/merged/apisecurity/
 * confirmShipment_input.xml) lists the elements you may send; it says nothing
 * about attributes, and an element with no attributes listed does not mean
 * "no attributes allowed" - createOrder proves that, since its template root
 * is a bare <Order> yet every order attribute is accepted.
 *
 * So the attribute set here is driven by what the API understands, not by the
 * template. The first four are the keys the shipped output template shows:
 *
 *   <Shipment ShipmentKey=" " ShipmentNo=" " ShipNode=" " SellerOrganizationCode=" "/>
 *
 * The remaining three (EnterpriseCode, OrderNo, TrackingNo) are the usual
 * ways to identify or stamp a shipment. All are blank by default and omitted
 * when blank, so nothing is guessed into the payload.
 *
 * This API CHANGES DATA. Generating and previewing is safe; sending confirms
 * a real shipment.
 */

import { z } from 'zod';
import type { FieldSpec } from '../types.js';

export const confirmShipmentOptionsSchema = z.object({
  shipmentKey: z.string().trim().max(40).default(''),
  shipmentNo: z.string().trim().max(40).default(''),
  shipNode: z.string().trim().max(24).default(''),
  sellerOrganizationCode: z.string().trim().max(24).default(''),
  enterpriseCode: z.string().trim().max(24).default(''),
  orderNo: z.string().trim().max(24).default(''),
  trackingNo: z.string().trim().max(40).default(''),
});

export type ConfirmShipmentOptions = z.infer<typeof confirmShipmentOptionsSchema>;

export const DEFAULTS: ConfirmShipmentOptions = confirmShipmentOptionsSchema.parse({});

export const FIELDS: readonly FieldSpec[] = [
  {
    name: 'shipmentKey',
    label: 'ShipmentKey',
    kind: 'text',
    maxLength: 40,
    group: 'Keys',
    help: 'Primary key of the shipment. Get it from getShipmentList - the most reliable way to identify one shipment.',
  },
  {
    name: 'shipmentNo',
    label: 'ShipmentNo',
    kind: 'text',
    maxLength: 40,
    placeholder: 'e.g. SHP0000001',
    group: 'Keys',
    help: 'Alternative to ShipmentKey. Pair it with ShipNode.',
  },
  {
    name: 'shipNode',
    label: 'ShipNode',
    kind: 'text',
    maxLength: 24,
    placeholder: 'node the shipment left',
    group: 'Keys',
    help: 'Used with ShipmentNo when you do not have the ShipmentKey.',
  },
  {
    name: 'sellerOrganizationCode',
    label: 'SellerOrganizationCode',
    kind: 'text',
    maxLength: 24,
    placeholder: 'e.g. POTHYS',
    group: 'Keys',
    help: 'Optional. Scopes the lookup to one seller.',
  },
  {
    name: 'orderNo',
    label: 'OrderNo',
    kind: 'text',
    maxLength: 24,
    placeholder: 'confirm every shipment on this order',
    group: 'Optional',
    help: 'Optional. Lets you confirm without looking up a ShipmentKey first.',
  },
  {
    name: 'enterpriseCode',
    label: 'EnterpriseCode',
    kind: 'text',
    maxLength: 24,
    group: 'Optional',
    help: 'Optional.',
  },
  {
    name: 'trackingNo',
    label: 'TrackingNo',
    kind: 'text',
    maxLength: 40,
    placeholder: 'carrier tracking number',
    group: 'Optional',
    help: 'Optional. Stamps the carrier tracking number on the shipment.',
  },
];