/**
 * Minimal XML tree model + renderer.
 *
 * Sterling APIs exchange XML documents, so every generator builds a tree of
 * `XmlNode` objects and the renderers (xml / json) turn that single tree into
 * the requested output format. Keeping one source of truth means the XML and
 * JSON previews can never drift apart.
 */

export type XmlValue = string | number | boolean;

export interface XmlNode {
  /** Element name, e.g. `OrderLine`. */
  name: string;
  /** Attributes. Values of `undefined` are skipped (Sterling treats missing as "not supplied"). */
  attrs?: Record<string, XmlValue | undefined>;
  /** Child elements, rendered in array order. */
  children?: XmlNode[];
  /** Optional character data (rarely used for Sterling payloads, but supported). */
  text?: string;
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/** Escape the five XML predefined entities. Applies to both text and attribute values. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

export function toXmlValue(value: XmlValue): string {
  return typeof value === 'string' ? escapeXml(value) : escapeXml(String(value));
}

export interface RenderXmlOptions {
  /** Prepend `<?xml version="1.0" encoding="UTF-8"?>`. Default `true`. */
  declaration?: boolean;
  /** Indentation unit for nested elements. Default two spaces. */
  indent?: string;
  /** Starting indent level, used when embedding a node inside a wrapper element. */
  depth?: number;
}

/**
 * Render an XML tree to a pretty-printed string.
 * Elements without children are rendered as self-closing tags (`<PriceInfo Currency="USD" />`),
 * which matches how Sterling sample payloads are usually written.
 */
export function renderXml(node: XmlNode, options: RenderXmlOptions = {}): string {
  const { declaration = true, indent = '  ', depth = 0 } = options;
  const body = renderNode(node, indent, depth);
  return declaration ? `<?xml version="1.0" encoding="UTF-8"?>\n${body}\n` : `${body}\n`;
}

function renderNode(node: XmlNode, indent: string, depth: number): string {
  const pad = indent.repeat(depth);
  const attrs = renderAttrs(node.attrs);
  const openTag = attrs ? `<${node.name} ${attrs}` : `<${node.name}`;
  const hasChildren = (node.children?.length ?? 0) > 0;
  const hasText = node.text !== undefined && node.text.length > 0;

  if (!hasChildren && !hasText) {
    return `${pad}${openTag} />`;
  }

  if (!hasChildren) {
    return `${pad}${openTag}>${escapeXml(node.text ?? '')}</${node.name}>`;
  }

  const lines = [`${pad}${openTag}>`];
  for (const child of node.children ?? []) {
    lines.push(renderNode(child, indent, depth + 1));
  }
  lines.push(`${pad}</${node.name}>`);
  return lines.join('\n');
}

function renderAttrs(attrs: XmlNode['attrs']): string {
  if (!attrs) return '';
  const parts: string[] = [];
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined) continue;
    parts.push(`${name}="${toXmlValue(value)}"`);
  }
  return parts.join(' ');
}
