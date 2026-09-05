/**
 * Builds a Sterling `createOrder` input document in the **storefront shape**.
 *
 * The element and attribute set matches a real storefront order placement, which
 * is the structure Sterling's API input template (`createOrder_input.xml`)
 * exposes. Emitting elements the template does not expose makes Sterling reject
 * the whole request in STRICT mode with:
 *
 *   YCP0428 - API Security Violation ("Use of <element> element")
 *
 * So this builder deliberately stays lean - no `<PriceInfo>`, `<OverallTotals>`,
 * `<LineOverallTotals>`, `<OrderLineTranQuantity>` and no `<PaymentDetailsList>`
 * wrapper. If your implementation exposes a richer structure, switch the
 * optional blocks on in the UI or extend the builder.
 *
 *   <Order EnterpriseCode="..." BuyerOrganizationCode="..." SellerOrganizationCode="..."
 *         BillToID="..." CustomerID="..." Currency="INR" DocumentType="0001"
 *         DeliveryMethod="SHP" CarrierServiceCode="express" SCAC="ups"
 *         ScacAndService="ups_express" PaymentStatus="AUTHORIZED">
 *     <OrderLines>
 *       <OrderLine PrimeLineNo="1" SubLineNo="1" LineType="PRODUCT" ProductClass="GOOD"
 *                  OrderedQty="1" DeliveryMethod="SHP" CarrierServiceCode="express"
 *                  SCAC="ups" ScacAndService="ups_express"
 *                  ReqDeliveryDate="2026-09-09T14:23:11.000Z">
 *         <Item ItemID="POT001" UnitOfMeasure="EACH" OrganizationCode="..." ProductClass="GOOD" />
 *         <LinePriceInfo IsPriceLocked="Y" UnitPrice="909.21" RetailPrice="909.21"
 *                        ExtendedPrice="909.21" />
 *       </OrderLine>
 *     </OrderLines>
 *     <HeaderCharges>
 *       <HeaderCharge ChargeCategory="Shipping" ChargeName="" ChargeAmount="149.00" IsManual="Y" />
 *     </HeaderCharges>
 *     <PaymentMethods>
 *       <PaymentMethod PaymentType="STRIPE_CARD" ChargeSequence="0" UnlimitedCharges="N"
 *                      MaxChargeLimit="1058.21" FirstName="..." LastName="...">
 *         <PaymentDetails ChargeType="AUTHORIZATION" RequestAmount="1058.21"
 *                         ProcessedAmount="1058.21" AuthCode="AUTH_SUCCESS"
 *                         AuthorizationExpirationDate="2026-12-31T23:59:59.000Z"
 *                         AuthorizationID="pi_..." PaymentReference1="pm_..."
 *                         PaymentReference2="STRIPE" PaymentReference3="AUTHORIZED" />
 *       </PaymentMethod>
 *     </PaymentMethods>
 *     <PersonInfoBillTo FirstName="..." LastName="..." EMailID="..." DayPhone="..."
 *                       AddressLine1="..." City="Mumbai" State="Maharashtra"
 *                       Country="IN" ZipCode="400001" />
 *     <PersonInfoShipTo ... />
 *   </Order>
 *
 * Money is computed in integer cents so every total in the payload is
 * internally consistent (see tests/createOrder.test.ts).
 */

import type { Faker } from '@faker-js/faker';
import { centsToAmount, dollarsToCents, percentageOf, type Cents } from '../../core/money.js';
import { pickOne, randomInt } from '../../core/rng.js';
import type { XmlNode } from '../../core/xml.js';
import type { GeneratedDocument } from '../types.js';
import { DEFAULT_CATALOG, type CatalogItem } from './catalog.js';
import {
  INDIA_FIRST_NAMES,
  INDIA_LAST_NAMES,
  INDIA_LOCATIONS,
  INDIA_STREETS,
} from './india.js';
import { ORDER_KIND_DOCUMENT_TYPES, SOURCE_DOCUMENT_TYPE, STOREFRONT_PROFILE, scacAndService } from './profile.js';
import type { CreateOrderOptions, OrderKind } from './options.js';

interface Party {
  firstName: string;
  lastName: string;
  email: string;
  dayPhone: string;
  addressLine1: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export function buildCreateOrder(
  options: CreateOrderOptions,
  faker: Faker,
  sequence: number,
): GeneratedDocument {
  const padded = String(sequence).padStart(7, '0');
  // With the default (blank) prefix Sterling assigns the order number itself,
  // exactly like the storefront payload.
  // Blank by default: Sterling assigns the order number itself. When a number
  // is supplied it is used verbatim, but a batch needs unique numbers, so the
  // padded sequence is appended when more than one order is generated.
  const orderNo = options.orderNo
    ? options.count > 1
      ? `${options.orderNo}-${padded}`
      : options.orderNo
    : undefined;
  // The sales order this return / purchase / transfer order points back to.
  // The order being referenced must already exist, so this is used verbatim.
  const sourceOrderNo = options.sourceOrderNo || undefined;
  const customerId = String(STOREFRONT_PROFILE.customerIdStart + sequence - 1);
  const shipNodes = parseShipNodes(options.shipNodes);
  const party = buildParty(faker);

  const reqDeliveryDate = withRandomTime(
    addDays(parseIsoDate(options.orderDate), STOREFRONT_PROFILE.deliveryLeadDays),
    faker,
  );

  const lineCount = randomInt(faker, options.minLines, options.maxLines);
  const lines: XmlNode[] = [];

  let lineSubTotalCents: Cents = 0;
  let lineTaxTotalCents: Cents = 0;

  for (let index = 0; index < lineCount; index += 1) {
    const item = pickOne(faker, DEFAULT_CATALOG);
    const quantity = randomInt(faker, options.minQty, options.maxQty);
    const unitPriceCents = randomInt(
      faker,
      dollarsToCents(options.minUnitPrice),
      dollarsToCents(options.maxUnitPrice),
    );
    const extendedCents = unitPriceCents * quantity;
    const lineTaxCents = options.includeTaxes ? percentageOf(extendedCents, options.taxRatePct) : 0;

    lineSubTotalCents += extendedCents;
    lineTaxTotalCents += lineTaxCents;

    lines.push(
      buildOrderLine({
        options,
        item,
        index,
        quantity,
        unitPriceCents,
        extendedCents,
        lineTaxCents,
        reqDeliveryDate,
        shipNode: shipNodes.length > 0 ? pickOne(faker, shipNodes) : undefined,
        sourceOrderNo,
        party,
      }),
    );
  }

  const headerChargeCents = dollarsToCents(options.shippingCharge);
  const headerTaxCents =
    options.includeTaxes && headerChargeCents > 0 ? percentageOf(headerChargeCents, options.taxRatePct) : 0;
  const taxTotalCents = lineTaxTotalCents + headerTaxCents;
  const grandTotalCents = lineSubTotalCents + headerChargeCents + taxTotalCents;

  const children: XmlNode[] = [{ name: 'OrderLines', children: lines }];

  if (headerChargeCents > 0) {
    children.push({
      name: 'HeaderCharges',
      children: [
        {
          name: 'HeaderCharge',
          attrs: {
            ChargeCategory: 'Shipping',
            ChargeName: '',
            ChargeAmount: centsToAmount(headerChargeCents),
            IsManual: 'Y',
          },
        },
      ],
    });
  }

  if (options.includeTaxes && headerTaxCents > 0) {
    children.push({
      name: 'HeaderTaxes',
      children: [buildTax('HeaderTax', headerTaxCents, options.taxRatePct)],
    });
  }

  if (options.includePaymentMethod) {
    children.push(buildPaymentMethods(options, faker, party, grandTotalCents));
  }

  children.push(
    personInfoNode('PersonInfoBillTo', party, true),
    personInfoNode('PersonInfoShipTo', party, false),
  );

  // <Extn> is deliberately NOT emitted. The instance template
  // (repository/xapi/template/merged/apisecurity/createOrder_input.xml) does not
  // list it, so sending it is a guaranteed YCP0428. To bring it back, extend the
  // template with <Extn/> and re-enable the option here.

  const tree: XmlNode = {
    name: 'Order',
    attrs: {
      EnterpriseCode: options.enterpriseCode,
      // On a purchase order the buying organisation is the enterprise and the
      // seller is the vendor; for the other kinds buyer and seller are the same.
      BuyerOrganizationCode:
        options.orderKind === 'PURCHASE' ? options.enterpriseCode : options.sellerOrganizationCode,
      SellerOrganizationCode: options.sellerOrganizationCode,
      BillToID: customerId,
      CustomerID: customerId,
      Currency: options.currency,
      DocumentType: ORDER_KIND_DOCUMENT_TYPES[options.orderKind],
      ReceivingNode: usesReceivingNode(options.orderKind) ? options.receivingNode || undefined : undefined,
      ProcessPaymentOnReturnOrder: options.orderKind === 'RETURN' ? 'Y' : undefined,
      // Left out unless supplied: Sterling defaults them, and the storefront does not send them.
      OrderNo: orderNo,
      OrderType: options.orderType || undefined,
      EntryType: options.entryType || undefined,
      DeliveryMethod: STOREFRONT_PROFILE.deliveryMethod,
      CarrierServiceCode: STOREFRONT_PROFILE.carrierServiceCode,
      SCAC: STOREFRONT_PROFILE.scac,
      ScacAndService: scacAndService(),
      Segment: STOREFRONT_PROFILE.segment,
      SegmentType: STOREFRONT_PROFILE.segmentType,
      PaymentStatus: options.paymentStatus,
    },
    children,
  };

  return {
    key: orderNo ?? `ORDER-${padded}`,
    label: `${orderNo ?? `Order ${sequence}`} - ${lineCount} line${lineCount === 1 ? '' : 's'}`,
    tree,
  };
}

interface OrderLineInput {
  options: CreateOrderOptions;
  item: CatalogItem;
  index: number;
  quantity: number;
  unitPriceCents: Cents;
  extendedCents: Cents;
  lineTaxCents: Cents;
  reqDeliveryDate: Date;
  shipNode: string | undefined;
  sourceOrderNo: string | undefined;
  party: Party;
}

function buildOrderLine(input: OrderLineInput): XmlNode {
  const {
    options,
    item,
    index,
    quantity,
    unitPriceCents,
    extendedCents,
    lineTaxCents,
    reqDeliveryDate,
    shipNode,
    sourceOrderNo,
    party,
  } = input;

  const children: XmlNode[] = [];

  // Returns point back with <DerivedFrom>; purchase and transfer orders use
  // <ChainedFrom>. Both reference the same line number on the source order.
  if (options.orderKind !== 'SALES' && sourceOrderNo) {
    children.push({
      name: options.orderKind === 'RETURN' ? 'DerivedFrom' : 'ChainedFrom',
      attrs: {
        DocumentType: SOURCE_DOCUMENT_TYPE,
        EnterpriseCode: options.enterpriseCode,
        OrderNo: sourceOrderNo,
        PrimeLineNo: String(index + 1),
        SubLineNo: '1',
      },
    });
  }

  children.push(
    {
      name: 'Item',
      attrs: {
        ItemID: item.itemId,
        UnitOfMeasure: item.unitOfMeasure,
        OrganizationCode: options.enterpriseCode,
        ProductClass: STOREFRONT_PROFILE.productClass,
      },
    },
    {
      name: 'LinePriceInfo',
      attrs: {
        IsPriceLocked: 'Y',
        UnitPrice: centsToAmount(unitPriceCents),
        RetailPrice: centsToAmount(unitPriceCents),
        ExtendedPrice: centsToAmount(extendedCents),
      },
    },
  );

  if (options.includeLineShipTo) {
    children.push(personInfoNode('PersonInfoShipTo', party, false));
  }

  if (options.includeTaxes) {
    children.push({
      name: 'LineTaxes',
      children: [buildTax('LineTax', lineTaxCents, options.taxRatePct)],
    });
  }

  return {
    name: 'OrderLine',
    attrs: {
      PrimeLineNo: String(index + 1),
      SubLineNo: '1',
      LineType: STOREFRONT_PROFILE.lineType,
      ProductClass: STOREFRONT_PROFILE.productClass,
      OrderedQty: String(quantity),
      DeliveryMethod: STOREFRONT_PROFILE.deliveryMethod,
      CarrierServiceCode: STOREFRONT_PROFILE.carrierServiceCode,
      SCAC: STOREFRONT_PROFILE.scac,
      ScacAndService: scacAndService(),
      Segment: STOREFRONT_PROFILE.segment,
      SegmentType: STOREFRONT_PROFILE.segmentType,
      ReqDeliveryDate: formatIsoDateTime(reqDeliveryDate),
      ShipNode: shipNode,
      ReceivingNode: usesReceivingNode(options.orderKind)
        ? options.receivingNode || undefined
        : undefined,
      ReturnReason: options.orderKind === 'RETURN' ? options.returnReason || undefined : undefined,
    },
    children,
  };
}

/** ReceivingNode applies to returns, purchase orders and transfer orders - not to sales orders. */
function usesReceivingNode(kind: OrderKind): boolean {
  return kind !== 'SALES';
}

function buildTax(name: string, taxCents: Cents, ratePct: number): XmlNode {
  return {
    name,
    attrs: {
      ChargeCategory: 'SalesTax',
      ChargeName: 'State',
      Tax: centsToAmount(taxCents),
      TaxName: 'State Tax',
      TaxPercentage: ratePct.toFixed(2),
      TaxableFlag: 'Y',
      Reference: 'TAX',
    },
  };
}

function buildPaymentMethods(
  options: CreateOrderOptions,
  faker: Faker,
  party: Party,
  grandTotalCents: Cents,
): XmlNode {
  const profile = STOREFRONT_PROFILE;
  const orderYear = parseIsoDate(options.orderDate).getUTCFullYear();

  return {
    name: 'PaymentMethods',
    children: [
      {
        name: 'PaymentMethod',
        attrs: {
          PaymentType: options.paymentType || profile.paymentType,
          ChargeSequence: profile.chargeSequence,
          UnlimitedCharges: 'N',
          MaxChargeLimit: centsToAmount(grandTotalCents),
          FirstName: party.firstName,
          LastName: party.lastName,
        },
        // Note: PaymentDetails sits directly under PaymentMethod - there is no
        // <PaymentDetailsList> wrapper in the storefront payload.
        children: [
          {
            name: 'PaymentDetails',
            attrs: {
              ChargeType: profile.paymentChargeType,
              RequestAmount: centsToAmount(grandTotalCents),
              ProcessedAmount: centsToAmount(grandTotalCents),
              AuthCode: profile.authCode,
              AuthorizationExpirationDate: new Date(
                Date.UTC(orderYear, 11, 31, 23, 59, 59),
              ).toISOString(),
              // Synthetic Stripe-style ids: random, never real payment intents.
              AuthorizationID: `pi_${faker.string.alphanumeric(24)}`,
              PaymentReference1: `pm_${faker.string.alphanumeric(24)}`,
              PaymentReference2: profile.paymentReference2,
              PaymentReference3: options.paymentStatus,
            },
          },
        ],
      },
    ],
  };
}

function personInfoNode(name: string, party: Party, isBillTo: boolean): XmlNode {
  return {
    name,
    attrs: {
      FirstName: party.firstName,
      LastName: party.lastName,
      EMailID: party.email,
      // The storefront sends the phone on the bill-to address only.
      DayPhone: isBillTo ? party.dayPhone : undefined,
      AddressLine1: party.addressLine1,
      City: party.city,
      State: party.state,
      Country: party.country,
      ZipCode: party.zipCode,
    },
  };
}

function buildParty(faker: Faker): Party {
  const firstName = pickOne(faker, INDIA_FIRST_NAMES);
  const lastName = pickOne(faker, INDIA_LAST_NAMES);
  const location = pickOne(faker, INDIA_LOCATIONS);

  return {
    firstName,
    lastName,
    // example.com is reserved for documentation (RFC 2606): generated mail never reaches a real mailbox.
    email: `${localPart(firstName, lastName)}@example.com`,
    dayPhone: indianMobile(faker),
    addressLine1: `${randomInt(faker, 1, 999)}, ${pickOne(faker, INDIA_STREETS)}`,
    city: location.city,
    state: location.state,
    zipCode: location.pinCode,
    country: 'IN',
  };
}

export function parseShipNodes(value: string): string[] {
  return value
    .split(',')
    .map((node) => node.trim())
    .filter((node) => node.length > 0);
}

/** 10-digit Indian mobile number, starting 6-9. */
function indianMobile(faker: Faker): string {
  return String(randomInt(faker, 6_000_000_000, 9_999_999_999));
}

/** "Mary-Jane O'Connor" -> "mary-jane.oconnor" (kept stable and address-safe). */
function localPart(firstName: string, lastName: string): string {
  return `${firstName}.${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.+/g, '.');
}

/** `YYYY-MM-DD` (UTC) -> Date. Throws on malformed input; the schema already validates format. */
export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`Invalid ISO date: ${value}`);
  }
  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** Attach a deterministic time of day to a date. */
export function withRandomTime(date: Date, faker: Faker): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      randomInt(faker, 8, 19),
      randomInt(faker, 0, 59),
      randomInt(faker, 0, 59),
    ),
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** `YYYY-MM-DD` */
export function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `YYYY-MM-DDTHH:mm:ss.000Z` - the datetime format the storefront sends to Sterling. */
export function formatIsoDateTime(date: Date): string {
  return date.toISOString();
}