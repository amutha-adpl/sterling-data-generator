import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { createFaker } from '../src/core/rng.js';
import { buildCreateOrder } from '../src/generators/createOrder/build.js';
import { createOrderGenerator } from '../src/generators/createOrder/index.js';
import { createOrderOptionsSchema, DEFAULTS } from '../src/generators/createOrder/options.js';
import { INDIA_LOCATIONS } from '../src/generators/createOrder/india.js';
import { renderJson } from '../src/core/json.js';
import { renderXml } from '../src/core/xml.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function generateOne(overrides: Partial<typeof DEFAULTS> = {}) {
  const options = createOrderOptionsSchema.parse(overrides);
  const document = buildCreateOrder(options, createFaker(options.seed), 1);
  return { options, document, xml: renderXml(document.tree) };
}

function parseOne(overrides: Partial<typeof DEFAULTS> = {}) {
  return parser.parse(generateOne(overrides).xml).Order;
}

describe('createOrder options', () => {
  it('applies storefront-aligned defaults', () => {
    expect(DEFAULTS.currency).toBe('INR');
    expect(DEFAULTS.orderKind).toBe('SALES');
    expect(DEFAULTS.paymentStatus).toBe('AUTHORIZED');
    expect(DEFAULTS.count).toBe(5);
    expect(DEFAULTS.includeTaxes).toBe(false);
    expect(DEFAULTS.shippingCharge).toBe(149);
  });

  it('swaps reversed ranges instead of failing', () => {
    const options = createOrderOptionsSchema.parse({ minLines: 5, maxLines: 2 });
    expect(options.minLines).toBe(2);
    expect(options.maxLines).toBe(5);
  });

  it('rejects a malformed base date', () => {
    expect(() => createOrderOptionsSchema.parse({ orderDate: '04-09-2026' })).toThrow();
  });
});

describe('storefront payload shape', () => {
  it('produces well-formed XML', () => {
    expect(XMLValidator.validate(generateOne().xml)).toBe(true);
  });

  it('leaves OrderNo out by default so Sterling assigns it', () => {
    const xml = generateOne().xml;
    expect(xml).not.toContain('OrderNo=');
    expect(xml).not.toContain('NotifyAfterShipmentFlag');
  });

  it('keeps order numbers unique when a batch supplies one', () => {
    const options = createOrderOptionsSchema.parse({ count: 3, seed: 5, orderNo: 'MYORDER' });
    const numbers = [1, 2, 3].map(
      (sequence) => renderXml(buildCreateOrder(options, createFaker(5), sequence).tree),
    );
    const found = numbers.map((xml) => /OrderNo="([^"]*)"/.exec(xml)?.[1]);
    expect(found).toEqual(['MYORDER-0000001', 'MYORDER-0000002', 'MYORDER-0000003']);
  });

  it('omits the elements the storefront does not send', () => {
    const xml = generateOne({ includeTaxes: true, includeExtn: true }).xml;
    for (const element of [
      'OverallTotals',
      'PriceInfo',
      'OrderLineTranQuantity',
      'LineOverallTotals',
      'PaymentDetailsList',
    ]) {
      expect(xml).not.toContain(`<${element}`);
    }
  });

  it('puts Currency on the order header', () => {
    expect(parseOne()['@_Currency']).toBe('INR');
  });

  it('mirrors the storefront organisation, customer and carrier attributes', () => {
    const order = parseOne({ enterpriseCode: 'POTHYS', sellerOrganizationCode: 'POTHYS' });
    expect(order['@_EnterpriseCode']).toBe('POTHYS');
    expect(order['@_BuyerOrganizationCode']).toBe('POTHYS');
    expect(order['@_SellerOrganizationCode']).toBe('POTHYS');
    expect(order['@_BillToID']).toBe(order['@_CustomerID']);
    expect(order['@_DeliveryMethod']).toBe('SHP');
    expect(order['@_SCAC']).toBe('ups');
    expect(order['@_CarrierServiceCode']).toBe('express');
    expect(order['@_ScacAndService']).toBe('ups_express');
  });

  it('sequences customer ids from the configured start', () => {
    const orders = createOrderGenerator.generate({ ...DEFAULTS, count: 3 }).map((doc) =>
      parser.parse(renderXml(doc.tree)).Order,
    );
    expect(orders.map((order) => order['@_CustomerID'])).toEqual(['100000010', '100000011', '100000012']);
  });

  it('uses a consistent Indian address and a valid PIN code', () => {
    const order = parseOne();
    const address = order.PersonInfoShipTo;
    expect(address['@_Country']).toBe('IN');
    expect(address['@_ZipCode']).toMatch(/^[1-9]\d{5}$/);
    const match = INDIA_LOCATIONS.find(
      (location) => location.city === address['@_City'] && location.state === address['@_State'],
    );
    expect(match).toBeDefined();
    expect(address['@_ZipCode']).toBe(match?.pinCode);
    expect(address['@_EMailID']).toMatch(/@example\.com$/);
    expect(address['@_DayPhone']).toBeUndefined();
    expect(order.PersonInfoBillTo['@_DayPhone']).toMatch(/^\d{10}$/);
  });

  it('sends dates in the storefront ISO format', () => {
    const line = toArray(parseOne().OrderLines.OrderLine)[0];
    expect(line?.['@_ReqDeliveryDate']).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('nests PaymentDetails directly under PaymentMethod', () => {
    const paymentMethod = parseOne({ includePaymentMethod: true }).PaymentMethods.PaymentMethod;
    expect(paymentMethod['@_PaymentType']).toBe('STRIPE_CARD');
    expect(paymentMethod.PaymentDetails['@_ChargeType']).toBe('AUTHORIZATION');
    expect(paymentMethod.PaymentDetails['@_PaymentReference2']).toBe('STRIPE');
    expect(paymentMethod.PaymentDetails['@_PaymentReference3']).toBe(DEFAULTS.paymentStatus);
    expect(paymentMethod.PaymentDetails['@_AuthorizationID']).toMatch(/^pi_/);
  });

  it('omits OrderNo, OrderType, EntryType and ShipNode by default', () => {
    const order = parseOne();
    expect(order['@_OrderNo']).toBeUndefined();
    expect(order['@_OrderType']).toBeUndefined();
    expect(order['@_EntryType']).toBeUndefined();
    expect(toArray(order.OrderLines.OrderLine)[0]?.['@_ShipNode']).toBeUndefined();
  });

  it('emits OrderNo only when one is supplied', () => {
    expect(parseOne({ count: 1, orderNo: 'ORD0000001' })['@_OrderNo']).toBe('ORD0000001');
  });

  it('emits ShipNode when ship nodes are supplied', () => {
    const line = toArray(parseOne({ shipNodes: 'DC001,STORE-1001' }).OrderLines.OrderLine)[0];
    expect(['DC001', 'STORE-1001']).toContain(line?.['@_ShipNode']);
  });
});

describe('optional blocks', () => {
  it('omits HeaderCharges when the shipping charge is zero', () => {
    expect(generateOne({ shippingCharge: 0 }).xml).not.toContain('HeaderCharges');
  });

  it('omits taxes by default and includes them on request', () => {
    expect(generateOne().xml).not.toContain('LineTaxes');
    const xml = generateOne({ includeTaxes: true }).xml;
    expect(xml).toContain('LineTaxes');
    expect(xml).toContain('HeaderTaxes');
  });

  it('omits the payment block when switched off', () => {
    expect(generateOne({ includePaymentMethod: false }).xml).not.toContain('PaymentMethods');
  });

  it('repeats the ship-to address on every line when requested', () => {
    const order = parseOne({ includeLineShipTo: true, minLines: 2, maxLines: 2 });
    for (const line of toArray(order.OrderLines.OrderLine)) {
      expect(line.PersonInfoShipTo['@_City']).toBe(order.PersonInfoShipTo['@_City']);
    }
  });
});

describe('order type presets', () => {
  it('sales order stays lean: no cross-references, no receiving node', () => {
    const order = parseOne({ receivingNode: 'DC001' });
    expect(order['@_DocumentType']).toBe('0001');
    expect(order['@_ProcessPaymentOnReturnOrder']).toBeUndefined();
    expect(order['@_ReceivingNode']).toBeUndefined();

    const line = toArray(order.OrderLines.OrderLine)[0];
    expect(line?.DerivedFrom).toBeUndefined();
    expect(line?.ChainedFrom).toBeUndefined();
    expect(line?.['@_ReturnReason']).toBeUndefined();
    expect(line?.['@_ReceivingNode']).toBeUndefined();
  });

  it('return order references the source order line with <DerivedFrom>', () => {
    const order = parseOne({
      orderKind: 'RETURN',
      receivingNode: 'RET-DC',
      returnReason: 'DAMAGED',
      minLines: 2,
      maxLines: 2,
    });
    expect(order['@_DocumentType']).toBe('0003');
    expect(order['@_ProcessPaymentOnReturnOrder']).toBe('Y');
    expect(order['@_ReceivingNode']).toBe('RET-DC');

    const lines = toArray(order.OrderLines.OrderLine);
    expect(lines[0]?.['@_ReturnReason']).toBe('DAMAGED');
    expect(lines[0]?.DerivedFrom).toMatchObject({
      '@_DocumentType': '0001',
      '@_EnterpriseCode': DEFAULTS.enterpriseCode,
      '@_OrderNo': 'ORD0000001',
      '@_PrimeLineNo': '1',
      '@_SubLineNo': '1',
    });
    expect(lines[1]?.DerivedFrom['@_PrimeLineNo']).toBe('2');
    expect(lines[0]?.ChainedFrom).toBeUndefined();
  });

  it('purchase order buys from the vendor and references the demand with <ChainedFrom>', () => {
    const order = parseOne({
      orderKind: 'PURCHASE',
      enterpriseCode: 'POTHYS',
      sellerOrganizationCode: 'VENDOR-01',
      receivingNode: 'DC001',
    });
    expect(order['@_DocumentType']).toBe('0005');
    expect(order['@_BuyerOrganizationCode']).toBe('POTHYS');
    expect(order['@_SellerOrganizationCode']).toBe('VENDOR-01');
    expect(order['@_ReceivingNode']).toBe('DC001');

    const line = toArray(order.OrderLines.OrderLine)[0];
    expect(line?.ChainedFrom).toMatchObject({
      '@_OrderNo': 'ORD0000001',
      '@_PrimeLineNo': '1',
    });
    expect(line?.DerivedFrom).toBeUndefined();
  });

  it('transfer order moves goods from a ship node to a receiving node', () => {
    const order = parseOne({
      orderKind: 'TRANSFER',
      shipNodes: 'STORE-1001',
      receivingNode: 'DC001',
    });
    expect(order['@_DocumentType']).toBe('0006');
    expect(order['@_ReceivingNode']).toBe('DC001');

    const line = toArray(order.OrderLines.OrderLine)[0];
    expect(line?.['@_ShipNode']).toBe('STORE-1001');
    expect(line?.['@_ReceivingNode']).toBe('DC001');
    expect(line?.ChainedFrom['@_OrderNo']).toBe('ORD0000001');
  });

  it('omits ReceivingNode when it is left blank', () => {
    const order = parseOne({ orderKind: 'RETURN', receivingNode: '' });
    expect(order['@_ReceivingNode']).toBeUndefined();
    expect(toArray(order.OrderLines.OrderLine)[0]?.['@_ReceivingNode']).toBeUndefined();
  });

  it('omits the cross-reference when no source prefix is set', () => {
    const order = parseOne({ orderKind: 'RETURN', sourceOrderNoPrefix: '' });
    expect(toArray(order.OrderLines.OrderLine)[0]?.DerivedFrom).toBeUndefined();
  });
});

describe('totals', () => {
  it('keeps line prices and the payment limit consistent', () => {
    const order = parseOne({ includePaymentMethod: true, minLines: 3, maxLines: 3, minQty: 1, maxQty: 4 });
    const lines = toArray(order.OrderLines.OrderLine);
    const lineSubTotal = lines.reduce(
      (sum, line) => sum + Number(line.LinePriceInfo['@_ExtendedPrice']),
      0,
    );
    const shipping = Number(order.HeaderCharges.HeaderCharge['@_ChargeAmount']);
    const limit = Number(order.PaymentMethods.PaymentMethod['@_MaxChargeLimit']);

    expect(limit).toBeCloseTo(lineSubTotal + shipping, 2);
    for (const line of lines) {
      const unitPrice = Number(line.LinePriceInfo['@_UnitPrice']);
      const quantity = Number(line['@_OrderedQty']);
      expect(Number(line.LinePriceInfo['@_ExtendedPrice'])).toBeCloseTo(unitPrice * quantity, 2);
      expect(line.LinePriceInfo['@_RetailPrice']).toBe(line.LinePriceInfo['@_UnitPrice']);
    }
  });

  it('adds tax to the payment limit when taxes are enabled', () => {
    const order = parseOne({
      includePaymentMethod: true,
      includeTaxes: true,
      minLines: 1,
      maxLines: 1,
      minQty: 1,
      maxQty: 1,
    });
    const line = toArray(order.OrderLines.OrderLine)[0]!;
    const extended = Number(line.LinePriceInfo['@_ExtendedPrice']);
    const lineTax = Number(line.LineTaxes.LineTax['@_Tax']);
    const shipping = Number(order.HeaderCharges.HeaderCharge['@_ChargeAmount']);
    const shippingTax = Number(order.HeaderTaxes.HeaderTax['@_Tax']);
    const limit = Number(order.PaymentMethods.PaymentMethod['@_MaxChargeLimit']);

    expect(limit).toBeCloseTo(extended + lineTax + shipping + shippingTax, 2);
  });

  it('rounds to two decimals with no floating point drift', () => {
    const order = parseOne({
      minLines: 1,
      maxLines: 1,
      minUnitPrice: 19.99,
      maxUnitPrice: 19.99,
      minQty: 3,
      maxQty: 3,
    });
    const line = toArray(order.OrderLines.OrderLine)[0];
    expect(line?.LinePriceInfo['@_ExtendedPrice']).toBe('59.97');
  });
});

describe('determinism and batching', () => {
  it('is deterministic for a given seed', () => {
    const first = createOrderGenerator.generate({ ...DEFAULTS, seed: 123, count: 3 });
    const second = createOrderGenerator.generate({ ...DEFAULTS, seed: 123, count: 3 });
    expect(first.map((doc) => renderXml(doc.tree))).toEqual(second.map((doc) => renderXml(doc.tree)));
  });

  it('produces different data for a different seed', () => {
    const first = createOrderGenerator.generate({ ...DEFAULTS, seed: 1, count: 1 });
    const second = createOrderGenerator.generate({ ...DEFAULTS, seed: 2, count: 1 });
    expect(renderXml(first[0]!.tree)).not.toEqual(renderXml(second[0]!.tree));
  });

  it('generates the requested number of lines per order', () => {
    const order = parseOne({ minLines: 4, maxLines: 4 });
    const lines = toArray(order.OrderLines.OrderLine);
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line['@_PrimeLineNo'])).toEqual(['1', '2', '3', '4']);
  });
});

describe('JSON output', () => {
  it('mirrors the XML structure with plain property names', () => {
    const { document } = generateOne({ minLines: 1, maxLines: 1, enterpriseCode: 'POTHYS' });
    const parsed = JSON.parse(renderJson(document.tree));
    expect(parsed.Order.EnterpriseCode).toBe('POTHYS');
    expect(parsed.Order.Currency).toBe('INR');
    expect(parsed.Order.OrderLines.OrderLine.PrimeLineNo).toBe('1');
    expect(parsed.Order.OrderLines.OrderLine.Item.ItemID).toMatch(/^(SKU|SRV)-\d{4}$/);
  });

  it('carries no @-prefixed keys anywhere in the document', () => {
    const { document } = generateOne({ includeTaxes: true });
    expect(renderJson(document.tree)).not.toMatch(/"@/);
  });
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * YCP0428 guard.
 *
 * Sterling validates a createOrder input against an API security template,
 * and rejects any element the template does not list with
 * "YCP0428 API Security Violation". Adding an element to build.ts therefore
 * needs a matching template entry — these tests fail until it is reviewed.
 *
 * Confirmed against a real instance: `LineOverallTotals` was rejected.
 */
const CORE_ELEMENTS = [
  'ChainedFrom',
  'DerivedFrom',
  'HeaderCharge',
  'HeaderCharges',
  'Item',
  'LinePriceInfo',
  'Order',
  'OrderLine',
  'OrderLines',
  'PaymentDetails',
  'PaymentMethod',
  'PaymentMethods',
  'PersonInfoBillTo',
  'PersonInfoShipTo',
];

/** Emitted only when the matching option is switched on. */
const OPTIONAL_ELEMENTS = ['Extn', 'HeaderTax', 'HeaderTaxes', 'LineTax', 'LineTaxes'];

const ALL_ORDER_KINDS = ['SALES', 'RETURN', 'PURCHASE', 'TRANSFER'] as const;

function elementsOf(xml: string): string[] {
  const names = [...xml.matchAll(/<([A-Za-z][A-Za-z0-9_]*)/g)].map((match) => match[1] ?? '');
  return [...new Set(names)].filter(Boolean);
}

describe('createOrder element allow-list', () => {
  for (const orderKind of ALL_ORDER_KINDS) {
    it(`${orderKind} emits only core elements with the default options`, () => {
      const { xml } = generateOne({ orderKind, receivingNode: 'NODE1' });
      expect(elementsOf(xml).filter((name) => !CORE_ELEMENTS.includes(name))).toEqual([]);
    });

    it(`${orderKind} only adds documented optional elements when extras are on`, () => {
      const { xml } = generateOne({
        orderKind,
        receivingNode: 'NODE1',
        includeTaxes: true,
        includePaymentMethod: true,
        includeLineShipTo: true,
        includeExtn: true,
      });
      const allowed = [...CORE_ELEMENTS, ...OPTIONAL_ELEMENTS];
      expect(elementsOf(xml).filter((name) => !allowed.includes(name))).toEqual([]);
    });

    it(`${orderKind} never emits LineOverallTotals`, () => {
      const { xml } = generateOne({ orderKind, receivingNode: 'NODE1', includeTaxes: true });
      expect(xml).not.toContain('LineOverallTotals');
      expect(xml).not.toContain('OverallTotals');
    });
  }
});