import type { GeneratedDocument, OutputFormat } from '../api.js';

interface Props {
  formats: ReadonlyArray<OutputFormat>;
  format: OutputFormat;
  documents: GeneratedDocument[];
  currentIndex: number;
  onFormatChange: (format: OutputFormat) => void;
  onIndexChange: (index: number) => void;
  onCopy: () => void;
  onDownloadOne: () => void;
  onDownloadAll: () => void;
  /** Sends the current order to the OMS. */
  onSend: () => void;
  canSend: boolean;
  sending: boolean;
}

export default function PreviewToolbar({
  formats,
  format,
  documents,
  currentIndex,
  onFormatChange,
  onIndexChange,
  onCopy,
  onDownloadOne,
  onDownloadAll,
  onSend,
  canSend,
  sending,
}: Props) {
  const hasMany = documents.length > 1;

  return (
    <div className="preview-toolbar">
      <div className="segmented" role="tablist" aria-label="Output format">
        {formats.map((item) => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={item === format}
            className={`segmented__item${item === format ? ' is-active' : ''}`}
            onClick={() => onFormatChange(item)}
          >
            {item.toUpperCase()}
          </button>
        ))}
      </div>

      {hasMany ? (
        <div className="order-nav">
          <button
            type="button"
            className="btn btn--icon"
            aria-label="Previous order"
            onClick={() => onIndexChange((currentIndex - 1 + documents.length) % documents.length)}
          >
            &larr;
          </button>
          <span className="order-nav__label">
            {currentIndex + 1} / {documents.length}
          </span>
          <button
            type="button"
            className="btn btn--icon"
            aria-label="Next order"
            onClick={() => onIndexChange((currentIndex + 1) % documents.length)}
          >
            &rarr;
          </button>
          <select
            className="order-nav__select"
            aria-label="Select order"
            value={currentIndex}
            onChange={(event) => onIndexChange(Number(event.target.value))}
          >
            {documents.map((document, index) => (
              <option key={document.key} value={index}>
                {document.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="preview-toolbar__right">
        <button type="button" className="btn btn--ghost" onClick={onCopy}>
          Copy
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={onDownloadOne}
          disabled={documents.length === 0}
        >
          Download this order
        </button>
        <button type="button" className="btn btn--primary" onClick={onDownloadAll}>
          Download all
        </button>
        <button
          type="button"
          className="btn btn--send"
          onClick={onSend}
          disabled={!canSend || sending}
          title={canSend ? 'Send this order to the connected OMS' : 'Connect to an OMS first'}
        >
          {sending ? 'Sending…' : 'Send to OMS'}
        </button>
      </div>
    </div>
  );
}