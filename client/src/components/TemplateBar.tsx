import type { SavedTemplate } from '../templates.js';

interface Props {
  templates: SavedTemplate[];
  activeId: string | null;
  /** False while there is nothing generated to save. */
  canSave: boolean;
  onSave: (name: string) => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

/**
 * Save, reload and re-send payloads.
 *
 * Stored in the browser only; templates contain generated sample data and no
 * credentials or tokens.
 */
export default function TemplateBar({
  templates,
  activeId,
  canSave,
  onSave,
  onLoad,
  onDelete,
  onClear,
}: Props) {
  const active = templates.find((template) => template.id === activeId) ?? null;

  const handleSave = () => {
    const suggestion = `Order ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;
    const name = window.prompt('Save this payload as:', suggestion);
    if (name === null) return;
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <div className="template-bar">
      {active ? (
        <span className="badge badge--saved">Template: {active.name}</span>
      ) : (
        <span className="template-bar__label">Generated</span>
      )}

      <select
        className="template-bar__select"
        aria-label="Saved templates"
        value={activeId ?? ''}
        onChange={(event) => (event.target.value ? onLoad(event.target.value) : onClear())}
        disabled={templates.length === 0}
      >
        <option value="">
          {templates.length === 0 ? 'No saved templates' : `Saved templates (${templates.length})`}
        </option>
        {templates.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name} — {template.apiName} — {new Date(template.savedAt).toLocaleString()}
          </option>
        ))}
      </select>

      <button
        className="btn btn--ghost"
        type="button"
        onClick={() => void handleSave()}
        disabled={!canSave}
        title={canSave ? 'Save the current payload so you can reload and re-send it' : 'Generate a payload first'}
      >
        Save as…
      </button>

      <button
        className="btn btn--ghost"
        type="button"
        onClick={() => active && onDelete(active.id)}
        disabled={!active}
      >
        Delete
      </button>

      <button className="btn btn--ghost" type="button" onClick={onClear} disabled={!active}>
        Back to generated
      </button>
    </div>
  );
}