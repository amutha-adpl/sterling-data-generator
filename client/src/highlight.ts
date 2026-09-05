/**
 * Lightweight XML / JSON syntax highlighting.
 *
 * Text is escaped first (`&`, `<`, `>`), then tokenised. Quotes are left as-is
 * on purpose so string literals and attribute values stay recognisable.
 */

function escapeHtml(value: string): string {
  return value.replace(/[&<>]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[char] ?? char);
}

export function highlightXml(source: string): string {
  return escapeHtml(source).replace(/&lt;[\s\S]*?&gt;/g, (tag) =>
    tag
      .replace(/([\w:.-]+)=("[^"]*")/g, '<span class="tok-attr">$1</span>=<span class="tok-str">$2</span>')
      .replace(/^(&lt;\/?)([\w:.-]+)/, '$1<span class="tok-tag">$2</span>'),
  );
}

export function highlightJson(source: string): string {
  return escapeHtml(source).replace(
    /("(?:\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"\s*:?)|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, stringToken: string | undefined, keywordToken: string | undefined, numberToken: string | undefined) => {
      if (stringToken) {
        return stringToken.trimEnd().endsWith(':')
          ? `<span class="tok-key">${stringToken.replace(/:$/, '')}</span>:`
          : `<span class="tok-str">${stringToken}</span>`;
      }
      if (keywordToken) return `<span class="tok-key">${keywordToken}</span>`;
      if (numberToken) return `<span class="tok-num">${numberToken}</span>`;
      return match;
    },
  );
}

export function highlight(source: string, format: OutputFormatLike): string {
  return format === 'json' ? highlightJson(source) : highlightXml(source);
}

type OutputFormatLike = 'xml' | 'json';