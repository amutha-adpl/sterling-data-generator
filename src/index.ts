/**
 * Application entry point: small Express server that exposes the JSON API in
 * `src/http/api.ts` and serves the React UI.
 *
 * Development: `npm run dev` runs this on :3001 and the Vite dev server on :3000
 * (Vite proxies /api here). Production: `npm run build && npm start` serves the
 * built UI from `dist/client` on the same port as the API.
 */

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import express from 'express';
import { HOST, PORT } from './config.js';
import { apiRouter } from './http/api.js';
import { omsRouter } from './http/omsRouter.js';
import { createOrderGenerator } from './generators/createOrder/index.js';
import { getOrderListGenerator } from './generators/getOrderList/index.js';
import { getOrderDetailsGenerator } from './generators/getOrderDetails/index.js';
import { confirmShipmentGenerator } from './generators/confirmShipment/index.js';
import { registerGenerator } from './generators/registry.js';

// Register the generators supported by this build.
registerGenerator(createOrderGenerator);
registerGenerator(getOrderListGenerator);
registerGenerator(getOrderDetailsGenerator);
registerGenerator(confirmShipmentGenerator);

/**
 * Locate the built React UI.
 *
 * The relative path differs depending on how the server was started:
 *   - `tsx src/index.ts`          -> this file is <root>/src/           -> ../dist/client
 *   - `node dist/server/index.js` -> this file is <root>/dist/server/   -> ../client
 * Probing both (plus the working directory) keeps `npm start` and
 * `npm run serve` working from a single build output.
 */
function resolveClientDir(): string | undefined {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const candidates = [
    path.join(here, '../dist/client'),
    path.join(here, '../client'),
    path.join(process.cwd(), 'dist/client'),
  ];
  return candidates.find((dir) => existsSync(path.join(dir, 'index.html')));
}

const clientDir = resolveClientDir();

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use('/api', apiRouter);
app.use('/api/oms', omsRouter);
app.use('/api', (_req, res) => {
  res.status(404).json({ error: { message: 'Unknown API route.' } });
});

if (clientDir) {
  const staticDir = clientDir;
  const indexFile = path.join(clientDir, 'index.html');
  app.use(express.static(staticDir));
  // Any non-API path is handled by the React app (client-side rendering).
  app.get('*', (_req, res) => {
    res.sendFile(indexFile);
  });
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : 'Unexpected server error';
  console.error('[sterling-data-generator]', error);
  res.status(500).json({ error: { message } });
});

app.listen(PORT, HOST, () => {
  console.log(`Sterling sample data generator listening on http://${HOST}:${PORT}`);
  if (!clientDir) {
    console.log('No built UI found (dist/client) - run "npm run build" or use "npm run dev".');
  }
});