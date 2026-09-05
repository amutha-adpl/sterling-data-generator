import { highlight } from '../highlight.js';
import type { OutputFormat } from '../api.js';

interface Props {
  source: string;
  format: OutputFormat;
}

export default function CodePreview({ source, format }: Props) {
  return (
    <pre className="code">
      <code dangerouslySetInnerHTML={{ __html: highlight(source, format) }} />
    </pre>
  );
}