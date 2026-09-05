import { useState } from 'react';
import type { OmsInvokeResponse, OutputFormat } from '../api.js';
import { copyText } from '../clipboard.js';
import { hintFor } from '../omsErrorHints.js';
import CodePreview from './CodePreview.js';

interface Props {
  result: OmsInvokeResponse;
  /** Shown next to the status pill, e.g. "Send order ORD0000001". */
  label?: string;
  onClose?: () => void;
}

/**
 * Formatted OMS response.
 *
 * Errors open with the body visible (that is where the useful detail is);
 * successful calls start collapsed so the payload stays in view.
 */
export default function ResponsePanel({ result, label, onClose }: Props) {
  const [showBody, setShowBody] = useState(!result.ok);
  const [showRequest, setShowRequest] = useState(false);
  const [copied, setCopied] = useState(false);

  const format: OutputFormat = looksLikeJson(result.body) ? 'json' : 'xml';

  const copy = async () => {
    const ok = await copyText(result.body);
    setCopied(ok);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className={result.ok ? 'response response--ok' : 'response response--error'}>
      <header className="response__head">
        <span className={result.ok ? 'pill pill--ok' : 'pill pill--error'}>HTTP {result.status}</span>
        <span className="response__api">{result.api}</span>
        {label ? <span className="response__label">{label}</span> : null}
        {result.retried ? (
          <span className="response__note">token had expired — re-logged in and retried</span>
        ) : null}
        <span className="response__spacer" />
        {result.request ? (
          <button
            className="btn btn--ghost"
            type="button"
            onClick={() => setShowRequest((value) => !value)}
          >
            {showRequest ? 'Hide request' : 'Show request'}
          </button>
        ) : null}
        {result.body ? (
          <button className="btn btn--ghost" type="button" onClick={() => setShowBody((value) => !value)}>
            {showBody ? 'Hide body' : 'Show body'}
          </button>
        ) : null}
        {result.body ? (
          <button className="btn btn--ghost" type="button" onClick={() => void copy()}>
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
        {onClose ? (
          <button className="btn btn--ghost" type="button" onClick={onClose} aria-label="Dismiss response">
            ×
          </button>
        ) : null}
      </header>

      {showRequest && result.request ? (
        <div className="response__request">
          <div className="response__request-meta">
            POST /smcfs/restapi/invoke/{result.request.api}?_loginid=…&amp;_token=…
            <span className="response__label"> · {result.request.contentType}</span>
            <span className="response__label">
              {' '}
              · {result.request.payload.length} chars
            </span>
          </div>
          <div className="response__body">
            <CodePreview source={result.request.payload} format="xml" />
          </div>
        </div>
      ) : null}

      {result.error ? (
        <dl className="response__error">
          <div>
            <dt>ErrorCode</dt>
            <dd>{result.error.code}</dd>
          </div>
          <div>
            <dt>Description</dt>
            <dd>{result.error.description}</dd>
          </div>
          {result.error.uniqueExceptionId ? (
            <div>
              <dt>Exception id</dt>
              <dd>{result.error.uniqueExceptionId}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {hintFor(result.error) ? <p className="response__hint">{hintFor(result.error)}</p> : null}

      {showBody && result.body ? (
        <div className="response__body">
          <CodePreview source={prettify(result.body, format)} format={format} />
        </div>
      ) : null}
    </section>
  );
}

function looksLikeJson(body: string): boolean {
  const trimmed = body.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

function prettify(body: string, format: OutputFormat): string {
  if (format !== 'json') return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}