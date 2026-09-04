/**
 * JSON renderer for the same `XmlNode` tree used by the XML renderer.
 *
 * Convention (Badgerfish-style, kept deliberately simple):
 *   - attributes are prefixed with `@`
 *   - child elements become object keys
 *   - repeated siblings collapse into an array
 *   - an element with no attributes and no children renders as an empty object
 *
 * Example:
 *   <Order OrderNo="ORD0000001"><PriceInfo Currency="USD" /></Order>
 *   -> { "Order": { "@OrderNo": "ORD0000001", "PriceInfo": { "@Currency": "USD" } } }
 */

import type { XmlNode } from './xml.js';

export type JsonValue = string | number | boolean | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export function toJson(node: XmlNode): JsonObject {
  const out: JsonObject = {};

  for (const [name, value] of Object.entries(node.attrs ?? {})) {
    if (value === undefined) continue;
    out[`@${name}`] = value;
  }

  const groups = new Map<string, XmlNode[]>();
  for (const child of node.children ?? []) {
    const bucket = groups.get(child.name);
    if (bucket) bucket.push(child);
    else groups.set(child.name, [child]);
  }

  for (const [name, siblings] of groups) {
    out[name] = siblings.length === 1 && siblings[0] ? toJson(siblings[0]) : siblings.map(toJson);
  }

  return out;
}

/** Wrap a node so the root element name is preserved: `{ "Order": { ... } }`. */
export function toNamedJson(node: XmlNode): JsonObject {
  return { [node.name]: toJson(node) };
}

export function renderJson(node: XmlNode): string {
  return `${JSON.stringify(toNamedJson(node), null, 2)}\n`;
}

/** Render a list of documents: a single object, or an array when there is more than one. */
export function renderJsonDocuments(nodes: XmlNode[]): string {
  const first = nodes[0];
  if (nodes.length === 1 && first) return renderJson(first);
  return `${JSON.stringify(nodes.map(toNamedJson), null, 2)}\n`;
}
