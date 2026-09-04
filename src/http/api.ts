/**
 * HTTP API used by the web UI.
 *
 *   GET  /api/health      - liveness probe
 *   GET  /api/generators  - metadata + form fields for every registered generator
 *   POST /api/generate    - { generatorId, options } -> rendered documents
 *
 * There is deliberately no "send to OMS" endpoint: this tool only produces
 * payloads for preview and download.
 */

import { Router } from 'express';
import { renderJson, renderJsonDocuments } from '../core/json.js';
import { renderXml } from '../core/xml.js';
import { getGenerator, listGenerators } from '../generators/registry.js';
import type { GeneratedDocument, OutputFormat } from '../generators/types.js';

export const apiRouter = Router();

apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

apiRouter.get('/generators', (_req, res) => {
  res.json({ generators: listGenerators() });
});

apiRouter.post('/generate', (req, res) => {
  const { generatorId, options } = (req.body ?? {}) as {
    generatorId?: unknown;
    options?: unknown;
  };

  if (typeof generatorId !== 'string') {
    res.status(400).json({ error: { message: 'Body must contain a string "generatorId".' } });
    return;
  }

  const generator = getGenerator(generatorId);
  if (!generator) {
    res.status(404).json({ error: { message: `Unknown generator: ${generatorId}` } });
    return;
  }

  const parsed = generator.schema.safeParse(options ?? {});
  if (!parsed.success) {
    res.status(400).json({
      error: {
        message: 'Invalid options.',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  const startedAt = Date.now();
  const resolvedOptions = parsed.data;
  const documents = generator.generate(resolvedOptions);
  const generatedAt = new Date().toISOString();
  const supports = (format: OutputFormat) => generator.formats.includes(format);

  res.json({
    generatorId: generator.id,
    apiName: generator.apiName,
    options: resolvedOptions,
    documents: documents.map((document) => ({
      key: document.key,
      label: document.label,
      xml: supports('xml') ? renderXml(document.tree) : null,
      json: supports('json') ? renderJson(document.tree) : null,
    })),
    // Ready-to-save bundle for "download all". A single order is emitted as-is;
    // multiple orders are wrapped in <Orders> (XML) / an array (JSON).
    bundle: {
      xml: supports('xml')
        ? renderXml({
            name: 'Orders',
            attrs: { ApiName: generator.apiName, Count: documents.length, GeneratedAt: generatedAt },
            children: documents.map((document) => document.tree),
          })
        : null,
      json: supports('json') ? renderJsonDocuments(documents.map(toTree)) : null,
    },
    meta: {
      count: documents.length,
      generatedAt,
      durationMs: Date.now() - startedAt,
    },
  });
});

function toTree(document: GeneratedDocument) {
  return document.tree;
}
