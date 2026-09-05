import type { FieldSpec } from '../api.js';

export type OptionValue = string | number | boolean;

interface Props {
  fields: ReadonlyArray<FieldSpec>;
  options: Record<string, unknown>;
  status: string;
  isError: boolean;
  onChange: (name: string, value: OptionValue) => void;
  onReset: () => void;
  onSubmit: () => void;
}

/**
 * Renders the option form straight from the generator metadata, so a new API
 * needs no UI changes.
 */
export default function OptionsForm({
  fields,
  options,
  status,
  isError,
  onChange,
  onReset,
  onSubmit,
}: Props) {
  const groups = new Map<string, FieldSpec[]>();
  for (const field of fields) {
    const bucket = groups.get(field.group);
    if (bucket) bucket.push(field);
    else groups.set(field.group, [field]);
  }

  return (
    <form
      className="panel panel--form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      autoComplete="off"
    >
      <div className="form-groups">
        {[...groups].map(([group, groupFields]) => (
          <fieldset className="form-group" key={group}>
            <h2 className="form-group__title">{group}</h2>
            <div className="form-grid">
              {groupFields.map((field) => (
                <Field
                  key={field.name}
                  field={field}
                  value={options[field.name]}
                  onChange={onChange}
                />
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="form-footer">
        <button type="submit" className="btn btn--primary">
          Generate
        </button>
        <button type="button" className="btn btn--ghost" onClick={onReset}>
          Reset defaults
        </button>
        <span className={`status${isError ? ' status--error' : ''}`} role="status" aria-live="polite">
          {status}
        </span>
      </div>
    </form>
  );
}

interface FieldProps {
  field: FieldSpec;
  value: unknown;
  onChange: (name: string, value: OptionValue) => void;
}

function Field({ field, value, onChange }: FieldProps) {
  if (field.kind === 'boolean') {
    return (
      <div className="form-row form-row--full">
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(event) => onChange(field.name, event.target.checked)}
          />
          <span>{field.label}</span>
        </label>
        {field.help ? <span className="form-row__help">{field.help}</span> : null}
      </div>
    );
  }

  const isWide = field.kind === 'select' || field.kind === 'text' || field.kind === 'combo';

  return (
    <div className={`form-row${isWide ? ' form-row--full' : ''}`}>
      <label className="form-row__label" htmlFor={`field-${field.name}`}>
        {field.label}
      </label>

      {field.kind === 'select' ? (
        <select
          id={`field-${field.name}`}
          value={String(value ?? '')}
          onChange={(event) => onChange(field.name, event.target.value)}
        >
          {field.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.kind === 'combo' ? (
        <>
          <input
            id={`field-${field.name}`}
            type="text"
            list={`options-${field.name}`}
            value={String(value ?? '')}
            placeholder={field.placeholder}
            onChange={(event) => onChange(field.name, event.target.value)}
          />
          <datalist id={`options-${field.name}`}>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </datalist>
        </>
      ) : field.kind === 'number' ? (
        <input
          id={`field-${field.name}`}
          type="number"
          value={value === undefined || value === null ? '' : String(value)}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          onChange={(event) =>
            onChange(field.name, event.target.value === '' ? 0 : Number(event.target.value))
          }
        />
      ) : (
        <input
          id={`field-${field.name}`}
          type={field.inputType ?? 'text'}
          value={String(value ?? '')}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          onChange={(event) => onChange(field.name, event.target.value)}
        />
      )}

      {field.help ? <span className="form-row__help">{field.help}</span> : null}
    </div>
  );
}