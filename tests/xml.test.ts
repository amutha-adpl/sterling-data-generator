import { XMLValidator } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';
import { renderJsonDocuments, toJson } from '../src/core/json.js';
import { escapeXml, renderXml, type XmlNode } from '../src/core/xml.js';

describe('renderXml', () => {
  it('renders attributes and self-closing elements', () => {
    const node: XmlNode = {
      name: 'Order',
      attrs: { OrderNo: 'ORD1', DraftOrderFlag: 'N', ShipNode: undefined },
      children: [{ name: 'PriceInfo', attrs: { Currency: 'USD' } }],
    };
    expect(renderXml(node)).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Order OrderNo="ORD1" DraftOrderFlag="N">',
        '  <PriceInfo Currency="USD" />',
        '</Order>',
        '',
      ].join('\n'),
    );
  });

  it('escapes the five XML entities in attribute values', () => {
    const value = `A & B <c> "d" 'e'`;
    expect(escapeXml(value)).toBe('A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;');
    const node: XmlNode = { name: 'Note', attrs: { NoteText: value } };
    expect(renderXml(node, { declaration: false })).toContain(
      'NoteText="A &amp; B &lt;c&gt; &quot;d&quot; &apos;e&apos;"',
    );
    expect(XMLValidator.validate(renderXml(node))).toBe(true);
  });

  it('repeats sibling elements instead of collapsing them', () => {
    const node: XmlNode = {
      name: 'OrderLines',
      children: [
        { name: 'OrderLine', attrs: { PrimeLineNo: '1' } },
        { name: 'OrderLine', attrs: { PrimeLineNo: '2' } },
      ],
    };
    const xml = renderXml(node, { declaration: false });
    expect(xml.match(/<OrderLine /g)).toHaveLength(2);
    expect(XMLValidator.validate(xml)).toBe(true);
  });
});

describe('renderJson', () => {
  it('prefixes attributes with groups repeated siblings into arrays', () => {
    const node: XmlNode = {
      name: 'Order',
      attrs: { OrderNo: 'ORD1', HoldFlag: undefined },
      children: [
        { name: 'OrderLine', attrs: { PrimeLineNo: '1' } },
        { name: 'OrderLine', attrs: { PrimeLineNo: '2' } },
      ],
    };
    expect(toJson(node)).toEqual({
      'OrderNo': 'ORD1',
      OrderLine: [{ 'PrimeLineNo': '1' }, { 'PrimeLineNo': '2' }],
    });
  });

  it('renders one document as an object and many as an array', () => {
    const node: XmlNode = { name: 'Order', attrs: { OrderNo: 'ORD1' } };
    expect(JSON.parse(renderJsonDocuments([node]))).toEqual({ Order: { 'OrderNo': 'ORD1' } });
    expect(JSON.parse(renderJsonDocuments([node, node]))).toEqual([
      { Order: { 'OrderNo': 'ORD1' } },
      { Order: { 'OrderNo': 'ORD1' } },
    ]);
  });
});
