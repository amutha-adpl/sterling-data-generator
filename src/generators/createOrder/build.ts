/**
 * Builds a Sterling `createOrder` input document.
 *
 * Structure follows the classic Sterling/YFS createOrder input XML:
 *
 *   <Order EnterpriseCode=... DocumentType=... OrderNo=... >
 *     <PriceInfo Currency=... />
 *     <OrderLines>
 *       <OrderLine PrimeLineNo="1" SubLineNo="1" OrderedQty="2.00" DeliveryMethod="SHP">
 *         <Item ItemID=... ProductClass=... UnitOfMeasure=... />
 *         <LinePriceInfo UnitPrice=... />
 *         <LineTaxes><LineTax ... /></LineTaxes>
 *         <OrderLineTranQuantity OrderedQty=... TransactionalUOM=... />
 *         <LineOverallTotals ExtendedPrice=... LineTotal=... OrderedQty=... />
 *       </OrderLine>
 *     </OrderLines>
 *     <PersonInfoBillTo ... />
 *     <PersonInfoShipTo ... />
 *     <HeaderCharges><HeaderCharge ... /></HeaderCharges>
 *     <HeaderTaxes><HeaderTax ... /></HeaderTaxes>
 *     <OverallTotals ... />
 *     <PaymentMethods>...</PaymentMethods>
 *     <Extn ... />
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
import type { CreateOrderOptions } from './options.js';

/** How quantities are written into the payload (Sterling quantities are decimals). */
const QTY_DECIMALS = 2;

const CARD_BRANDS = [
  { code: 'VISA', brand: 'Visa' },
  { code: 'MASTERCARD', brand: 'Mastercard' },
  { code: 'AMEX', brand: 'American Express' },
  { code: 'DISCOVER', brand: 'Discover' },
] as const;

interface Party {
  firstName: string;
  lastName: string;
  email: string;
  dayPhone: string;
  mobilePhone: string;
  addressLine1: string;
  addressLine2: string;
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
  const orderNo = `${options.orderNoPrefix}${String(sequence).padStart(7, '0')}`;
  const shipNodes = parseShipNodes(options.shipNodes);
  const party = buildParty(faker);

  const orderDate = withRandomTime(parseIsoDate(options.orderDate), faker);
  const reqShipDate = addDays(orderDate, 2);
  const reqDeliveryDate = addDays(orderDate, 5);

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
    const lineTotalCents = extendedCents + lineTaxCents;

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
        lineTotalCents,
        shipNode: shipNodes.length > 0 ? pickOne(faker, shipNodes) : undefined,
        reqShipDate,
        reqDeliveryDate,
        party,
      }),
    );
  }

  const headerChargeCents = dollarsToCents(options.shippingCharge);
  const headerTaxCents =
    options.includeTaxes && headerChargeCents > 0 ? percentageOf(headerChargeCents, options.taxRatePct) : 0;
  const taxTotalCents = lineTaxTotalCents + headerTaxCents;
  const subTotalCents = lineSubTotalCents + headerChargeCents;
  const grandTotalCents = subTotalCents + taxTotalCents;

  const children: XmlNode[] = [
    { name: 'PriceInfo', attrs: { Currency: options.currency } },
    { name: 'OrderLines', children: lines },
    personInfoNode('PersonInfoBillTo', party, 'Billing'),
    personInfoNode('PersonInfoShipTo', party, 'Shipping'),
  ];

  if (headerChargeCents > 0) {
    children.push({
      name: 'HeaderCharges',
      children: [
        {
          name: 'HeaderCharge',
          attrs: {
            ChargeCategory: 'Freight',
            ChargeName: 'Shipping Charge',
            ChargeAmount: centsToAmount(headerChargeCents),
            IsManual: 'Y',
            Reference: 'SHIPPING',
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

  children.push({
    name: 'OverallTotals',
    attrs: {
      GrandCharges: centsToAmount(headerChargeCents),
      GrandDiscount: centsToAmount(0),
      GrandLineSubTotal: centsToAmount(lineSubTotalCents),
      GrandShippingCharges: centsToAmount(headerChargeCents),
      GrandShippingTotal: centsToAmount(headerChargeCents),
      GrandTax: centsToAmount(taxTotalCents),
      GrandTotal: centsToAmount(grandTotalCents),
      LineSubTotal: centsToAmount(lineSubTotalCents),
      SubTotal: centsToAmount(subTotalCents),
    },
  });

  if (options.includePaymentMethod) {
    children.push(buildPaymentMethods(options, faker, party, grandTotalCents));
  }

  if (options.includeExtn) {
    children.push({
      name: 'Extn',
      attrs: {
        ExtnChannel: options.entryType,
        ExtnHostOrderReference: `${options.entryType}-${orderNo}`,
        ExtnLoyaltyId: faker.string.alphanumeric({ length: 10, casing: 'upper' }),
      },
    });
  }

  const tree: XmlNode = {
    name: 'Order',
    attrs: {
      EnterpriseCode: options.enterpriseCode,
      SellerOrganizationCode: options.sellerOrganizationCode,
      DocumentType: options.documentType,
      OrderNo: orderNo,
      OrderType: options.orderType,
      EntryType: options.entryType,
      OrderDate: formatIsoDateTime(orderDate),
      ReqShipDate: formatIsoDate(reqShipDate),
      ReqDeliveryDate: formatIsoDate(reqDeliveryDate),
      OrderName: `${party.firstName} ${party.lastName}`,
      CustomerEMailID: party.email,
      CustomerFirstName: party.firstName,
      CustomerLastName: party.lastName,
      CustomerPhoneNo: party.dayPhone,
      CustomerPONo: `PO-${orderNo}`,
      CustomerZipCode: party.zipCode,
      SearchCriteria1: party.email,
      DraftOrderFlag: 'N',
      HoldFlag: 'N',
      IsShipComplete: 'N',
      NotifyAfterShipmentFlag: 'Y',
      PaymentStatus: options.paymentStatus,
    },
    children,
  };

  return {
    key: orderNo,
    label: `${orderNo} - ${lineCount} line${lineCount === 1 ? '' : 's'}`,
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
  lineTotalCents: Cents;
  shipNode: string | undefined;
  reqShipDate: Date;
  reqDeliveryDate: Date;
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
    lineTotalCents,
    shipNode,
    reqShipDate,
    reqDeliveryDate,
    party,
  } = input;

  const quantityText = quantity.toFixed(QTY_DECIMALS);
  const children: XmlNode[] = [
    {
      name: 'Item',
      attrs: {
        ItemID: item.itemId,
        ItemDesc: item.itemDesc,
        ProductClass: item.productClass,
        UnitOfMeasure: item.unitOfMeasure,
      },
    },
    {
      name: 'LinePriceInfo',
      attrs: {
        IsPriceLocked: 'N',
        ListPrice: centsToAmount(unitPriceCents),
        RetailPrice: centsToAmount(unitPriceCents),
        UnitPrice: centsToAmount(unitPriceCents),
        PricingUOM: item.unitOfMeasure,
      },
    },
  ];

  if (options.includeLineShipTo) {
    children.push(personInfoNode('PersonInfoShipTo', party));
  }

  if (options.includeTaxes) {
    children.push({
      name: 'LineTaxes',
      children: [buildTax('LineTax', lineTaxCents, options.taxRatePct)],
    });
  }

  children.push(
    {
      name: 'OrderLineTranQuantity',
      attrs: { OrderedQty: quantityText, TransactionalUOM: item.unitOfMeasure },
    },
    {
      name: 'LineOverallTotals',
      attrs: {
        ExtendedPrice: centsToAmount(extendedCents),
        LineTotal: centsToAmount(lineTotalCents),
        OrderedQty: quantityText,
        PricingQty: quantityText,
        StatusQuantity: quantityText,
      },
    },
  );

  return {
    name: 'OrderLine',
    attrs: {
      PrimeLineNo: String(index + 1),
      SubLineNo: '1',
      OrderedQty: quantityText,
      DeliveryMethod: 'SHP',
      ShipNode: shipNode,
      GiftFlag: 'N',
      ReqShipDate: formatIsoDate(reqShipDate),
      ReqDeliveryDate: formatIsoDate(reqDeliveryDate),
    },
    children,
  };
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
  const card = pickOne(faker, CARD_BRANDS);
  // Digits only - that is how Sterling stores the number on the payment method.
  const cardNumber = faker.finance.creditCardNumber(card.brand).replace(/\D/g, '');
  const expiry = formatCardExpiry(faker.date.future({ years: 3 }));

  return {
    name: 'PaymentMethods',
    children: [
      {
        name: 'PaymentMethod',
        attrs: {
          PaymentType: 'CREDIT_CARD',
          CreditCardType: card.code,
          CreditCardNo: cardNumber,
          CreditCardExpDate: expiry,
          CreditCardName: `${party.firstName} ${party.lastName}`,
          DisplayCreditCardNo: maskCardNumber(cardNumber),
          FirstName: party.firstName,
          LastName: party.lastName,
          ChargeSequence: '1',
          MaxChargeLimit: centsToAmount(grandTotalCents),
          UnlimitedCharges: 'N',
        },
        children: [
          {
            name: 'PaymentDetailsList',
            children: [
              {
                name: 'PaymentDetails',
                attrs: {
                  ChargeType: 'CHARGE',
                  AuthCode: `${faker.string.alpha({ length: 2, casing: 'upper' })}${faker.string.numeric(4)}`,
                  CreditCardType: card.code,
                  CreditCardNo: cardNumber,
                  CreditCardExpDate: expiry,
                  ProcessedAmount: centsToAmount(grandTotalCents),
                  RequestAmount: centsToAmount(grandTotalCents),
                  PaymentReference1: options.orderType,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function personInfoNode(name: string, party: Party, addressId = 'Home'): XmlNode {
  return {
    name,
    attrs: {
      AddressID: addressId,
      AddressLine1: party.addressLine1,
      AddressLine2: party.addressLine2,
      City: party.city,
      State: party.state,
      Country: party.country,
      ZipCode: party.zipCode,
      FirstName: party.firstName,
      LastName: party.lastName,
      DayPhone: party.dayPhone,
      MobilePhone: party.mobilePhone,
      EMailID: party.email,
    },
  };
}

function buildParty(faker: Faker): Party {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    firstName,
    lastName,
    // example.com is reserved for documentation (RFC 2606): generated mail never reaches a real mailbox.
    email: `${localPart(firstName, lastName)}@example.com`,
    dayPhone: cleanPhone(faker.phone.number()),
    mobilePhone: cleanPhone(faker.phone.number()),
    addressLine1: faker.location.streetAddress(),
    addressLine2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zipCode: faker.location.zipCode(),
    country: 'US',
  };
}

export function parseShipNodes(value: string): string[] {
  return value
    .split(',')
    .map((node) => node.trim())
    .filter((node) => node.length > 0);
}

/** "Mary-Jane O'Connor" -> "mary-jane.oconnor" (kept stable and address-safe). */
function localPart(firstName: string, lastName: string): string {
  return `${firstName}.${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '')
    .replace(/\.+/g, '.');
}

/** Strip phone extensions such as " x2612" - Sterling expects a plain number. */
function cleanPhone(value: string): string {
  return value.replace(/\s*x\d+$/, '').trim();
}

function maskCardNumber(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return `${'*'.repeat(Math.max(digits.length - 4, 0))}${last4}`;
}

function formatCardExpiry(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
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

/** `YYYY-MM-DDTHH:mm:ss` - the datetime format Sterling accepts in date attributes. */
export function formatIsoDateTime(date: Date): string {
  return date.toISOString().slice(0, 19);
}
