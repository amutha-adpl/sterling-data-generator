/**
 * Saved payload templates.
 *
 * Lets you keep a payload that worked, reload it later, tweak it and send it
 * again - so a test case does not have to be re-created from scratch.
 *
 * Stored in the browser's localStorage. Templates hold generated sample data
 * only: never credentials, never the OMS token.
 */

export interface SavedTemplate {
  id: string;
  name: string;
  generatorId: string;
  /** Sterling API this payload is posted to, e.g. `createOrder`. */
  apiName: string;
  options: Record<string, unknown>;
  xml: string;
  json: string | null;
  savedAt: string;
}

const STORAGE_KEY = 'sterling-data-generator.templates.v1';

function read(): SavedTemplate[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedTemplate[]) : [];
  } catch {
    return [];
  }
}

function write(templates: SavedTemplate[]): SavedTemplate[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // Storage full or blocked - the templates simply will not persist.
  }
  return templates;
}

export function listTemplates(): SavedTemplate[] {
  return read().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export type NewTemplate = Omit<SavedTemplate, 'id' | 'savedAt'>;

export function saveTemplate(input: NewTemplate): SavedTemplate[] {
  const template: SavedTemplate = {
    ...input,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: new Date().toISOString(),
  };
  return write([template, ...read()]);
}

export function deleteTemplate(id: string): SavedTemplate[] {
  return write(read().filter((template) => template.id !== id));
}