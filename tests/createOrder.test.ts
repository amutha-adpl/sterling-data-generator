import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { createFaker } from '../src/core/rng.js';
import { buildCreateOrder } from '../src/generators/createOrder/build.js';
import { createOrderGenerator } from '../src/generators/createOrder/index.js';
import { createOrderOptionsSchema, DEFAULTS } from '../src/generators/createOrder/options.js';
import { renderJson } from '../src/core/json.js';
import { renderXml } from '../src/core/xml.js';

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

function generateOne(overrides: Partial<typeof DEFAULTS> = {}) {
  const options = createOrderOptionsSchema.parse(overrides);
  const document = buildCreateOrder(options, createFaker(options.seed), 1);
  return { options, document, xml: renderXml(document.tree) };
}

describe('createOrder options', () => {
  it('applies documented defaults', () => {
    expect(DEFAULTS.enterpriseCode).toBe('DEFAULT');
    expect(DEFAULTS.documentType).toBe('0001');
    expect(DEFAULTS.count).toBe(5);
    expect(DEFAULTS.currency).toBe('USD');
  });

  it('swaps reversed ranges instead of failing', () => {
    const options = createOrderOptionsSchema.parse({ minLines: 5, maxLines: 2 });
    expect(options.minLines).toBe(2);
    expect(options.maxLines).toBe(5);
  });

  it('rejects a malformed order date', () => {
    expect(() => createOrderOptionsSchema.parse({ orderDate: '04-09-2026' })).toThrow();
  });
});

describe('createOrder payload', () => {
  it('produces well-formed XML', () => {
    const { xml } = generateOne();
    expect(XMLValidator.validate(xml)).toBe(true);
  });

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

  it('numbers orders sequentially from 1', () => {
    const documents = createOrderGenerator.generate({ ...DEFAULTS, count: 3, orderNoPrefix: 'TEST' });
    expect(documents.map((doc) => doc.key)).toEqual(['TEST0000001', 'TEST0000002', 'TEST0000003']);
  });

  it('generates the requested number of lines per order', () => {
    const { document } = generateOne({ minLines: 4, maxLines: 4 });
    const lines = document.tree.children?.find((child) => child.name === 'OrderLines')?.children ?? [];
    expect(lines).toHaveLength(4);
    expect(lines.map((line) => line.attrs?.PrimeLineNo)).toEqual(['1', '2', '3', '4']);
  });

  it('omits ShipNode when no ship nodes are configured', () => {
    const { document } = generateOne({ shipNodes: '  ' });
    const line = document.tree.children?.find((child) => child.name === 'OrderLines')?.children?.[0];
    expect(line?.attrs?.ShipNode).toBeUndefined();
  });

  it('omits taxes and payment blocks when switched off', () => {
    const { xml } = generateOne({ includeTaxes: false, includePaymentMethod: false });
    expect(xml).not.toContain('LineTaxes');
    expect(xml).not.toContain('HeaderTaxes');
    expect(xml).not.toContain('PaymentMethods');
  });

  it('omits HeaderCharges when the shipping charge is zero', () => {
    const { xml } = generateOne({ shippingCharge: 0 });
    expect(xml).not.toContain('HeaderCharges');
  });
});

describe('createOrder totals', () => {
  it('line totals add up to the order total', () => {
    const { document } = generateOne({ minLines: 3, maxLines: 3, minQty: 1, maxQty: 4 });
    const parsed = parser.parse(renderXml(document.tree));
    const order = parsed.Order;

    const lines = toArray(order.OrderLines.OrderLine);
    const lineSubTotal = lines.reduce((sum, line) => sum + Number(line.LineOverallTotals['@_ExtendedPrice']), 0);
    const lineTax = lines.reduce(
      (sum, line) => sum + Number(line.LineTaxes?.LineTax?.['@_Tax'] ?? 0),
      0,
    );
    const headerCharge = Number(order.HeaderCharges?.HeaderCharge?.['@_ChargeAmount'] ?? 0);
    const headerTax = Number(order.HeaderTaxes?.HeaderTax?.['@_Tax'] ?? 0);
    const totals = order.OverallTotals;

    expect(Number(totals['@_LineSubTotal'])).toBeCloseTo(lineSubTotal, 2);
    expect(Number(totals['@_SubTotal'])).toBeCloseTo(lineSubTotal + headerCharge, 2);
    expect(Number(totals['@_GrandTax'])).toBeCloseTo(lineTax + headerTax, 2);
    expect(Number(totals['@_GrandTotal'])).toBeCloseTo(
      lineSubTotal + headerCharge + lineTax + headerTax,
      2,
    );

    for (const line of lines) {
      const extended = Number(line.LineOverallTotals['@_ExtendedPrice']);
      const tax = Number(line.LineTaxes?.LineTax?.['@_Tax'] ?? 0);
      expect(Number(line.LineOverallTotals['@_LineTotal'])).toBeCloseTo(extended + tax, 2);
      expect(extended).toBeCloseTo(
        Number(line.LinePriceInfo['@_UnitPrice']) * Number(line['@_OrderedQty']),
        2,
      );
    }
  });

  it('rounds to two decimals with no floating point drift', () => {
    const { document } = generateOne({
      minLines: 1,
      maxLines: 1,
      minUnitPrice: 19.99,
      maxUnitPrice: 19.99,
      minQty: 3,
      maxQty: 3,
    });
    const parsed = parser.parse(renderXml(document.tree));
    expect(parsed.Order.OverallTotals['@_LineSubTotal']).toBe('59.97');
  });
});

describe('JSON output', () => {
  it('mirrors the XML structure with @-prefixed attributes', () => {
    const { document } = generateOne({ minLines: 1, maxLines: 1 });
    const parsed = JSON.parse(renderJson(document.tree));
    expect(parsed.Order['@EnterpriseCode']).toBe(DEFAULTS.enterpriseCode);
    expect(parsed.Order['@OrderNo']).toBe('ORD0000001');
    expect(parsed.Order.OrderLines.OrderLine['@PrimeLineNo']).toBe('1');
    expect(parsed.Order.OrderLines.OrderLine.Item['@ItemID']).toMatch(/^(SKU|SRV)-\d{4}$/);
  });
});

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}
