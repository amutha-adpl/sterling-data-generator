/**
 * Contract every Sterling API generator implements.
 *
 * A generator is a self-contained folder under `src/generators/` that knows how
 * to turn a set of user options into one or more `XmlNode` documents. The web UI
 * is data-driven: it renders its form from `fields` and `defaults`, so adding a
 * new API means adding one folder and one `registerGenerator()` call.
 */

import type { z } from 'zod';
import type { XmlNode } from '../core/xml.js';

export type OutputFormat = 'xml' | 'json';

interface BaseField {
  /** Option key, must match the key in the options schema. */
  name: string;
  label: string;
  /** Form section the field belongs to. */
  group: string;
  /** Short hint shown under the field. */
  help?: string;
  /** Native input type override for text fields, e.g. `date`. */
  inputType?: string;
}

export interface NumberField extends BaseField {
  kind: 'number';
  min: number;
  max: number;
  step?: number;
}

export interface TextField extends BaseField {
  kind: 'text';
  placeholder?: string;
  maxLength?: number;
}

export interface SelectField extends BaseField {
  kind: 'select';
  options: ReadonlyArray<{ value: string; label: string }>;
}

export interface BooleanField extends BaseField {
  kind: 'boolean';
}

export type FieldSpec = NumberField | TextField | SelectField | BooleanField;

/** One generated payload (for createOrder: one `<Order>` document). */
export interface GeneratedDocument {
  /** Stable identifier, also used as the file name. */
  key: string;
  /** Human readable line for the preview list, e.g. `ORD0000001 - 3 lines`. */
  label: string;
  /** Root element of the payload. */
  tree: XmlNode;
}

export interface GeneratorDefinition<TOptions> {
  id: string;
  label: string;
  /** Sterling API / transaction name, e.g. `createOrder`. */
  apiName: string;
  description: string;
  formats: ReadonlyArray<OutputFormat>;
  fields: ReadonlyArray<FieldSpec>;
  defaults: TOptions;
  schema: z.ZodType<TOptions, z.ZodTypeDef, unknown>;
  generate(options: TOptions): GeneratedDocument[];
}

/** UI-facing projection of a generator (no functions, safe to serialise). */
export interface GeneratorSummary {
  id: string;
  label: string;
  apiName: string;
  description: string;
  formats: ReadonlyArray<OutputFormat>;
  fields: ReadonlyArray<FieldSpec>;
  defaults: Record<string, unknown>;
}
