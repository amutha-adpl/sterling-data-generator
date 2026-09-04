/**
 * Registry of available generators.
 *
 * Kept intentionally tiny: one Map, one registration call per generator.
 * New APIs are added in `src/index.ts` with `registerGenerator(...)`.
 */

import type { GeneratorDefinition, GeneratorSummary } from './types.js';

const registry = new Map<string, GeneratorDefinition<never>>();

export function registerGenerator<TOptions>(definition: GeneratorDefinition<TOptions>): void {
  registry.set(definition.id, definition as unknown as GeneratorDefinition<never>);
}

export function getGenerator(id: string): GeneratorDefinition<never> | undefined {
  return registry.get(id);
}

export function listGenerators(): GeneratorSummary[] {
  return [...registry.values()].map((definition) => ({
    id: definition.id,
    label: definition.label,
    apiName: definition.apiName,
    description: definition.description,
    formats: definition.formats,
    fields: definition.fields,
    defaults: definition.defaults as unknown as Record<string, unknown>,
  }));
}
